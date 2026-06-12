/**
 * Teste das Fases 0, 1, 2 e 3 (roda sem servidor):
 *   node --experimental-strip-types scripts/teste.ts
 */
import fs from "node:fs";
import path from "node:path";
import { carregarGrafo, carregarMemoria, carregarPermissoes, grafoVisivel, orquestrar, resolverDadosRaiz, sensibilidadeDoMeta } from "../lib/core.ts";
import { calcularSla, resumirSla } from "../lib/motor-sla.ts";
import { gerarMermaid } from "../lib/projecao.ts";
import { parseOperacaoGrafo } from "../lib/grafo-editor.ts";

// Testes são herméticos: nunca capturam no ingestor (senão cada rodada polui a memória recente)
// e não dependem do Ollama/pgvector (a busca vetorial degrada para lexical quando indisponível).
process.env.MIND_INGESTOR_URL = "";
process.env.MIND_OLLAMA_URL = "http://127.0.0.1:9"; // porta fechada => ollamaDisponivel()=false
process.env.MIND_VETOR_DB = "";

function ok(cond: boolean, msg: string) {
  console.log(`${cond ? "✅" : "❌"} ${msg}`);
  if (!cond) process.exitCode = 1;
}

const raiz = resolverDadosRaiz();
console.log("Raiz dos dados:", raiz, "\n");

// --- Fase 0: grafo carrega e valida ---
const g = carregarGrafo(raiz);
ok(g.nos.length > 0 && g.arestas.length > 0, `Fase 0 — grafo carrega e valida (${g.nos.length} nós, ${g.arestas.length} arestas)`);

// --- Fase 1: recuperação + permissão + fala ---
const r1 = await orquestrar({ usuario: "operador-exemplo", texto: "o que é pendente aéreo?" }, raiz);
ok(r1.contexto.includes("pendente-aereo") && r1.permitido,
  `Fase 1 — operador pergunta 'pendente aéreo' → acha e responde (modo: ${r1.modo})`);
console.log("   →", r1.resposta, "\n");

const r2 = await orquestrar({ usuario: "operador-exemplo", texto: "qual o salário dos funcionários?" }, raiz);
ok(!r2.permitido && r2.modo === "negado",
  "Fase 1 — operador pergunta 'salário' (confidencial) → NEGado");
console.log("   →", r2.resposta, "\n");

const r3 = await orquestrar({ usuario: "rafael", texto: "qual o salário dos funcionários?" }, raiz);
ok(r3.permitido && r3.contexto.includes("tabela-salarios"),
  "Fase 1 — criador pergunta 'salário' → PERMITIDO");
console.log("   →", r3.resposta, "\n");

const r4 = await orquestrar({ usuario: "operador-exemplo", texto: "como funciona o credenciamento lunar?" }, raiz);
ok(r4.modo === "sem-memoria", "Fase 1 — pergunta sem registro → 'sem memória' (não inventa)");
console.log("   →", r4.resposta, "\n");

// --- Fase 2: Motor de SLA determinístico ---
const agora = new Date();
const h = (n: number) => new Date(agora.getTime() + n * 3600_000).toISOString();
const calc = calcularSla(
  [
    // evento em 24h (=> crítica, prazo 2h), pendência aberta há 3h => ESTOURADO
    { convidado: "Teste Crítico", tipo: "pendente-aereo", abertaEm: h(-3), eventoEm: h(24) },
    // evento em 5 dias (=> alta, prazo 8h), aberta há 1h => no prazo
    { convidado: "Teste Alta", tipo: "pendente-aereo", abertaEm: h(-1), eventoEm: h(5 * 24) },
    // evento em 30 dias (=> normal, prazo 24h), aberta há 30h => ESTOURADO
    { convidado: "Teste Normal", tipo: "hospedagem", abertaEm: h(-30), eventoEm: h(30 * 24) },
  ],
  agora
);
ok(
  calc[0].estourado && calc[0].prioridade === "critica" &&
    calc.find((c) => c.convidado === "Teste Alta")!.estourado === false &&
    calc.find((c) => c.convidado === "Teste Normal")!.estourado === true,
  "Fase 2 — Motor de SLA classifica prioridade e estouro corretamente (determinístico)"
);

const r5 = await orquestrar({ usuario: "operador-exemplo", texto: "quais convidados estão estourando o SLA?" }, raiz);
ok(r5.modo === "motor-sla" && r5.resposta.includes("Motor de SLA"),
  "Fase 2 — orquestrador roteia pergunta de SLA para o motor (LLM roteia, código calcula)");
console.log("   →", r5.resposta, "\n");

// --- Fase 3: Cognição + Freio ---
const r6 = await orquestrar({ usuario: "operador-exemplo", texto: "cliente quer alterar o controle de salas do evento" }, raiz);
const idProposta = r6.contexto[0];
ok(r6.modo === "freio-proposta" && !!idProposta && r6.resposta.includes("FREIO"),
  `Fase 3 — pedido de mudança → motor cognitivo propõe e PARA no freio (${idProposta})`);
ok(!carregarMemoria(raiz).some((d) => d.id === `decisao-${idProposta}`),
  "Fase 3 — antes da aprovação, NADA foi consolidado na memória");

const r7 = await orquestrar({ usuario: "operador-exemplo", texto: `aprovar proposta ${idProposta}` }, raiz);
ok(r7.modo === "freio-decisao" && !r7.permitido,
  "Fase 3 — operador NÃO pode aprovar (freio exige diretor+)");
console.log("   →", r7.resposta);

const r8 = await orquestrar({ usuario: "rafael", texto: `aprovar proposta ${idProposta}` }, raiz);
ok(r8.modo === "freio-decisao" && r8.permitido && r8.resposta.includes("APROVADA"),
  "Fase 3 — criador aprova → freio libera");
console.log("   →", r8.resposta);

ok(carregarMemoria(raiz).some((d) => d.id === `decisao-${idProposta}`),
  "Fase 3 — decisão aprovada CONSOLIDADA na memória (camada recente)");

const r9 = await orquestrar({ usuario: "rafael", texto: `aprovar proposta ${idProposta}` }, raiz);
ok(!r9.resposta.includes("APROVADA") && r9.resposta.includes("já foi decidida"),
  "Fase 3 — proposta não pode ser decidida duas vezes");

// Limpeza: artefatos criados pelo teste não viram estado permanente
fs.rmSync(path.join(raiz, "operacao", "propostas", `${idProposta}.json`), { force: true });
fs.rmSync(path.join(raiz, "memoria", "recente", `decisao-${idProposta}.md`), { force: true });

// --- Fase 4: projeção Mermaid + edição do grafo via chat (com freio) ---
const mermaid = gerarMermaid(g);
ok(mermaid.startsWith("flowchart") && mermaid.includes("controle-de-salas") && mermaid.includes("-->"),
  "Fase 4 — projeção Mermaid gerada do JSON (fonte da verdade)");

const opParse = parseOperacaoGrafo('adicionar nó modulo "Rooming List" em atendimento-rsvp', g);
ok(opParse?.op === "adicionar-no" && opParse.no.id === "rooming-list",
  "Fase 4 — comando de chat vira operação determinística de grafo");

const r10 = await orquestrar({ usuario: "rafael", texto: 'adicionar nó modulo "Rooming List" em atendimento-rsvp' }, raiz);
const idProp2 = r10.contexto[0];
ok(r10.modo === "freio-proposta" && r10.resposta.includes("Operação executável"),
  "Fase 4 — edição de grafo pelo chat vira proposta no freio (não executa direto)");
ok(!carregarGrafo(raiz).nos.some((n) => n.id === "rooming-list"),
  "Fase 4 — antes da aprovação, o grafo JSON está INTACTO");

const r11 = await orquestrar({ usuario: "rafael", texto: `aprovar proposta ${idProp2}` }, raiz);
const gDepois = carregarGrafo(raiz);
ok(r11.permitido && r11.resposta.includes("Grafo atualizado") && gDepois.nos.some((n) => n.id === "rooming-list"),
  "Fase 4 — aprovação aplica a operação: nó novo no JSON e o diagrama reorganiza");
ok(gerarMermaid(gDepois).includes("rooming-list"),
  "Fase 4 — projeção Mermaid re-renderiza com o nó novo");

// --- Fase 5: Motor de Criatividade + Área do Criador ---
const r12 = await orquestrar({ usuario: "operador-exemplo", texto: "tive uma ideia para melhorar o transfer dos convidados" }, raiz);
ok(r12.modo === "negado" && !r12.permitido,
  "Fase 5 — Motor de Criatividade é exclusivo da Área do Criador (operador NEGado)");

const r13 = await orquestrar({ usuario: "rafael", texto: "brainstorm: como reduzir os atrasos no aéreo dos convidados?" }, raiz);
const idExp = r13.contexto[0];
ok(r13.modo === "criatividade" && !!idExp && r13.resposta.includes("HIPÓTESES"),
  `Fase 5 — criador explora → exploração criada com abordagens rotuladas como hipótese (${idExp})`);
ok(!carregarMemoria(raiz).some((d) => d.id === idExp),
  "Fase 5 — exploração fica no workspace (operacao/criatividade), NÃO vira memória direto");

const r14 = await orquestrar({ usuario: "operador-exemplo", texto: `promover exploracao ${idExp}` }, raiz);
ok(r14.modo === "negado" && !r14.permitido,
  "Fase 5 — operador NÃO promove exploração (nível máximo apenas)");

const r15 = await orquestrar({ usuario: "rafael", texto: `promover exploracao ${idExp}` }, raiz);
const idProp3 = r15.contexto[0];
ok(r15.modo === "freio-proposta" && !!idProp3 && r15.resposta.includes("FREIO"),
  `Fase 5 — promover exploração → proposta ${idProp3} criada e PARADA no freio`);

const r16 = await orquestrar({ usuario: "rafael", texto: `aprovar proposta ${idProp3}` }, raiz);
ok(r16.resposta.includes("APROVADA") && carregarMemoria(raiz).some((d) => d.id === `decisao-${idProp3}`),
  "Fase 5 — aprovação consolida a exploração promovida na memória (única porta de escrita)");

const r17 = await orquestrar({ usuario: "rafael", texto: `promover exploracao ${idExp}` }, raiz);
ok(r17.resposta.includes("já foi promovida"),
  "Fase 5 — exploração não pode ser promovida duas vezes");

// Limpeza dos artefatos da Fase 5
fs.rmSync(path.join(raiz, "operacao", "criatividade", `${idExp}.json`), { force: true });
fs.rmSync(path.join(raiz, "operacao", "propostas", `${idProp3}.json`), { force: true });
fs.rmSync(path.join(raiz, "memoria", "recente", `decisao-${idProp3}.md`), { force: true });

// --- Fase 6: expansão de domínios (credenciamento) + view cruzada de cascata ---
const g6 = carregarGrafo(raiz);
ok(g6.nos.some((n) => n.id === "credenciamento") &&
  g6.arestas.some((a) => a.de === "check-in-nfc" && a.para === "atendimento-rsvp"),
  "Fase 6 — domínio credenciamento no grafo, com aresta cruzando para o RSVP");

const { cascataTransitiva } = await import("../lib/motor-cognitivo.ts");
const niveis = cascataTransitiva(g6, "check-in-nfc", 3);
ok(niveis.length > 1 && niveis.some((nv) => nv.itens.some((i) => i.cruzaDominio && i.dominio === "atendimento-rsvp")),
  "Fase 6 — cascata transitiva atravessa a fronteira de domínio (credenciamento → RSVP)");

const r18 = await orquestrar({ usuario: "rafael", texto: "o que quebra se eu mexer no check-in nfc?" }, raiz);
ok(r18.modo === "cascata" && ["check-in-nfc", "credenciamento"].includes(r18.contexto[0]) && r18.resposta.includes("⤫"),
  "Fase 6 — pergunta de impacto roteia para a view cruzada e marca o cruzamento de domínio");
console.log("   →", r18.resposta, "\n");

const r19 = await orquestrar({ usuario: "operador-exemplo", texto: "como funciona a cascata logística?" }, raiz);
ok(r19.modo !== "cascata" && r19.contexto.includes("cascata-logistica"),
  "Fase 6 — pergunta de CONHECIMENTO sobre cascata continua indo para a memória (não confunde com a view)");

// --- Permissão em bases externas: docs com `publico:` (sem `sensibilidade:`) não caem no default interno ---
ok(sensibilidadeDoMeta({ publico: "diretoria, gestao-operacoes" }) === "restrito" &&
  sensibilidadeDoMeta({ publico: "diretoria, lideranca" }) === "confidencial" &&
  sensibilidadeDoMeta({ publico: "lideranca, diretoria, todas-areas" }) === "interno" &&
  sensibilidadeDoMeta({ sensibilidade: "alta", publico: "todas-areas" }) === "restrito",
  "Permissão — campo `publico:` de base externa vira sensibilidade (resumo de diretoria NÃO fica interno)");

// --- Painel → chat: debater um nó do grafo ("explica o nó <id>") ---
const r20 = await orquestrar({ usuario: "operador-exemplo", texto: "explica o nó motor-sla" }, raiz);
ok(r20.permitido && r20.contexto[0] === "motor-sla" && r20.resposta.includes("Motor de SLA") && r20.resposta.includes("Ligações"),
  "Card→chat — 'explica o nó <id>' responde com a ficha do nó e suas ligações");

const r21 = await orquestrar({ usuario: "operador-exemplo", texto: "explica o nó papel-coordenador" }, raiz);
ok(!r21.permitido && r21.modo === "negado",
  "Card→chat — nó restrito NEGado para operador (sensibilidade do nó vale no debate)");

const r22 = await orquestrar({ usuario: "rafael", texto: "debater o nó check-in-nfc" }, raiz);
ok(r22.permitido && r22.contexto.includes("check-in-nfc") && r22.contexto.includes("processo-de-check-in-nfc"),
  "Card→chat — memória ligada ao nó entra no contexto do debate");

// --- Nó em FOCO (card → chat): o humano pergunta, a Mind anexa o contexto do nó ---
const r23 = await orquestrar({ usuario: "operador-exemplo", texto: "quem cuida disso aqui no dia a dia?", foco: "motor-sla" }, raiz);
ok(r23.permitido && r23.contexto[0] === "motor-sla" && r23.modo !== "sem-memoria",
  "Foco — pergunta livre com nó em foco responde com a ficha (não cai em 'sem memória')");

const r24 = await orquestrar({ usuario: "rafael", texto: "o que quebra se eu mexer aqui?", foco: "check-in-nfc" }, raiz);
ok(r24.modo === "cascata" && r24.contexto[0] === "check-in-nfc" && r24.resposta.includes("⤫"),
  "Foco — 'o que quebra se eu mexer aqui?' usa o nó em foco como alvo da cascata");

const r25 = await orquestrar({ usuario: "rafael", texto: "ajustar o prazo de sincronização para 2 minutos", foco: "bloco-regras-checkin" }, raiz);
ok(r25.modo === "freio-proposta" && r25.resposta.includes("Regras de Check-in"),
  "Foco — pedido de mudança com foco mira o nó focado (proposta no freio)");
fs.rmSync(path.join(raiz, "operacao", "propostas", `${r25.contexto[0]}.json`), { force: true });

const r26 = await orquestrar({ usuario: "operador-exemplo", texto: "me explica isso", foco: "papel-coordenador" }, raiz);
ok(!r26.permitido && r26.modo === "negado",
  "Foco — nó restrito em foco NEGado para operador (foco não fura permissão)");

// --- Pensamento de gerente: referências, trilha de escalonamento e registro de lacuna ---
const r27 = await orquestrar({ usuario: "operador-exemplo", texto: "o que é pendente aéreo?" }, raiz);
ok(r27.contexto.includes("pendente-aereo") && r27.contexto.includes("sla-rsvp"),
  "Gerente — a Mind SEGUE as referências do doc ([[relacionados]]): sla-rsvp entra no contexto");

const r28 = await orquestrar({ usuario: "operador-exemplo", texto: "convidado está há 5 dias pendente, qual o próximo passo?" }, raiz);
ok(r28.resposta.includes("escala para") && r28.resposta.includes("Consultor"),
  "Gerente — pergunta de encaminhamento traz a trilha de escalonamento do grafo");

const r29 = await orquestrar({ usuario: "operador-exemplo", texto: "registrar: convidado com mais de 5 dias pendente escala para o coordenador com prioridade crítica" }, raiz);
const idReg = r29.contexto[0];
ok(r29.modo === "registro" && !!idReg && !carregarMemoria(raiz).some((d) => d.id === idReg),
  "Gerente — 'registrar:' cria pré-memória no _inbox (lacuna vira candidata a conhecimento)");
{
  const { listarInbox } = await import("../lib/memoria-editor.ts");
  const reg = listarInbox(raiz).find((d) => d.id === idReg);
  ok(!!reg && reg.corpo.includes("5 dias") && reg.tags.includes("regra-proposta"),
    "Gerente — o registro guarda a regra proposta e quem registrou");
  if (reg) fs.rmSync(reg.arquivo, { force: true });
}

// --- Ciclo do conhecimento completo: registrar → _inbox → recente (homologação) → profunda ---
{
  const { listarInbox, aprovarDoInbox, consolidarParaProfunda } = await import("../lib/memoria-editor.ts");
  const rCiclo = await orquestrar({ usuario: "operador-exemplo", texto: "registrar: regra de teste do ciclo completo da Mind" }, raiz);
  const idCiclo = rCiclo.contexto[0];
  aprovarDoInbox(raiz, idCiclo, "recente");
  const emHomologacao = carregarMemoria(raiz).find((d) => d.id === idCiclo);
  ok(!!emHomologacao && emHomologacao.comunidade === "recente",
    "Ciclo — aprovado do _inbox entra em HOMOLOGAÇÃO (recente, já buscável)");
  const cons = consolidarParaProfunda(raiz, idCiclo);
  const consolidado = carregarMemoria(raiz).find((d) => d.id === idCiclo);
  ok(!!consolidado && consolidado.comunidade === "profunda" && !listarInbox(raiz).some((d) => d.id === idCiclo),
    "Ciclo — homologado CONSOLIDA para profunda (vira conhecimento)");
  let recusouCiclo = "";
  try { consolidarParaProfunda(raiz, idCiclo); } catch (e) { recusouCiclo = String(e); }
  ok(recusouCiclo.includes("recente"),
    "Ciclo — só memória recente consolida (profunda não re-consolida)");
  fs.rmSync(cons.arquivo, { force: true });
}

ok(carregarMemoria(raiz).some((d) => d.id === "ciclo-do-conhecimento") &&
  carregarGrafo(raiz).nos.some((n) => n.id === "motor-consolidacao" && n.status === "planejado"),
  "Ciclo — mapa de workers/LLMs registrado como conhecimento e no grafo (motor-consolidacao planejado)");

// --- Memória editável: input de dados/arquivos + edição dos RAGs (curadoria humana) ---
const me = await import("../lib/memoria-editor.ts");
const novoDoc = me.criarDoc(raiz, { titulo: "Teste de Curadoria Mind", corpo: "Conteúdo de teste.", comunidade: "_inbox", sensibilidade: "interno", tags: ["teste"] });
ok(!carregarMemoria(raiz).some((d) => d.id === novoDoc.id) && me.listarInbox(raiz).some((d) => d.id === novoDoc.id),
  "Memória — doc novo no _inbox é PRÉ-memória: invisível à busca até a curadoria");

me.aprovarDoInbox(raiz, novoDoc.id, "profunda");
ok(carregarMemoria(raiz).some((d) => d.id === novoDoc.id && d.comunidade === "profunda"),
  "Memória — aprovação do _inbox publica na comunidade profunda");

me.editarDoc(raiz, novoDoc.id, { corpo: "Conteúdo editado.", sensibilidade: "restrito" });
const docEditado = carregarMemoria(raiz).find((d) => d.id === novoDoc.id)!;
ok(docEditado.corpo === "Conteúdo editado." && docEditado.sensibilidade === "restrito",
  "Memória — edição de RAG altera corpo e sensibilidade preservando o restante");

ok(me.ehDaMind(docEditado.arquivo, raiz) && !me.ehDaMind("/tmp/doc-de-base-externa.md", raiz),
  "Memória — só arquivos da memória da Mind são editáveis (bases externas read-only)");

const up = me.importarArquivo(raiz, "regras-novas.html", "<h1>Regras</h1><p>Corpo &amp; teste</p><script>x()</script>", "rafael");
const upDoc = me.listarInbox(raiz).find((d) => d.id === up.id)!;
ok(upDoc.corpo.includes("Corpo & teste") && !upDoc.corpo.includes("<p>") && !upDoc.corpo.includes("x()"),
  "Memória — upload .html converte para texto limpo e cai no _inbox");

me.mandarParaLixeira(raiz, novoDoc.id);
ok(!carregarMemoria(raiz).some((d) => d.id === novoDoc.id) && fs.readdirSync(path.join(raiz, "memoria", "_lixeira")).some((f) => f.includes(novoDoc.id)),
  "Memória — lixeira tira o doc da busca sem apagar de verdade");

// Limpeza dos artefatos de memória do teste
fs.rmSync(up.arquivo, { force: true });
for (const f of fs.readdirSync(path.join(raiz, "memoria", "_lixeira")).filter((f) => f.includes(novoDoc.id)))
  fs.rmSync(path.join(raiz, "memoria", "_lixeira", f), { force: true });

// --- Revisão dos motores (12/jun): limites de consumo e gravação por domínio ---
{
  const muitos = Array.from({ length: 20 }, (_, i) => ({
    convidado: `Pessoa ${i + 1}`, tipo: "pendente-aereo", abertaEm: h(-30), eventoEm: h(24),
  }));
  const resumoCap = resumirSla(calcularSla(muitos));
  ok(resumoCap.includes("e mais 5") && resumoCap.split("\n").filter((l) => l.startsWith("- ")).length === 15,
    "Motores — resumo do SLA limita o consumo: 15 piores casos em texto + contagem do resto");

  const r33 = await orquestrar({ usuario: "rafael", texto: 'adicionar nó modulo "Totem de Impressao" em credenciamento' }, raiz);
  const idProp4 = r33.contexto[0];
  await orquestrar({ usuario: "rafael", texto: `aprovar proposta ${idProp4}` }, raiz);
  const credJson = JSON.parse(fs.readFileSync(path.join(raiz, "grafo", "credenciamento.json"), "utf8"));
  const atendJson = JSON.parse(fs.readFileSync(path.join(raiz, "grafo", "atendimento.json"), "utf8"));
  ok(credJson.nos.some((n: any) => n.id === "totem-de-impressao") && !atendJson.nos.some((n: any) => n.id === "totem-de-impressao"),
    "Motores — operação de grafo grava no ARQUIVO do domínio certo (credenciamento.json, não atendimento)");
  // limpeza: desfaz o nó de teste e os artefatos do freio
  credJson.nos = credJson.nos.filter((n: any) => n.id !== "totem-de-impressao");
  credJson.arestas = credJson.arestas.filter((a: any) => a.de !== "totem-de-impressao" && a.para !== "totem-de-impressao");
  fs.writeFileSync(path.join(raiz, "grafo", "credenciamento.json"), JSON.stringify(credJson, null, 2) + "\n");
  fs.rmSync(path.join(raiz, "operacao", "propostas", `${idProp4}.json`), { force: true });
  fs.rmSync(path.join(raiz, "memoria", "recente", `decisao-${idProp4}.md`), { force: true });
}

// --- Governança do grafo: cada nível vê o SEU grafo (auditoria 12/jun) ---
{
  const perm = carregarPermissoes(raiz);
  const gTudo = carregarGrafo(raiz);
  const operador = perm.usuarios.find((u) => u.id === "operador-exemplo")!;
  const dono = perm.usuarios.find((u) => u.id === "rafael")!;
  const gOp = grafoVisivel(gTudo, perm, operador);
  ok(!gOp.nos.some((n) => n.id === "papel-coordenador") && !gOp.nos.some((n) => n.id === "area-do-criador") &&
    !gOp.arestas.some((a) => a.de === "papel-coordenador" || a.para === "papel-coordenador") &&
    grafoVisivel(gTudo, perm, dono).nos.some((n) => n.id === "papel-coordenador"),
    "Governança — projeção por nível: operador não vê nó restrito/confidencial (nem as arestas); o dono vê tudo");

  const rTrilha = await orquestrar({ usuario: "operador-exemplo", texto: "convidado pendente, qual o próximo passo?" }, raiz);
  ok(rTrilha.resposta.includes("escala para") && !rTrilha.resposta.includes("Gestão de fila"),
    "Governança — trilha de escalonamento para operador NÃO vaza descrição de papel restrito");
}

// --- Fase 7: conversa com memória de sessão (follow-up resolve pelo histórico) ---
const r30 = await orquestrar({
  usuario: "operador-exemplo",
  texto: "e quem fica responsavel por resolver isso?",
  historico: [
    { de: "eu", texto: "o que é pendente aéreo?" },
    { de: "mind", texto: "Pendente Aéreo é um status do grupo PROCESSAMENTO..." },
  ],
}, raiz);
ok(r30.modo !== "sem-memoria" && r30.contexto.includes("pendente-aereo"),
  "Fase 7 — follow-up sem termos próprios acha a memória certa pelo histórico da conversa");

const r31 = await orquestrar({ usuario: "operador-exemplo", texto: "e quem fica responsavel por resolver isso?" }, raiz);
ok(r31.modo === "sem-memoria" || !r31.contexto.includes("pendente-aereo"),
  "Fase 7 — sem histórico, o mesmo follow-up não acha (prova que o histórico fez a diferença)");

// --- Fase 8 (v1): composição — memória + trilha do grafo + Motor de SLA na MESMA resposta ---
const r32 = await orquestrar({ usuario: "operador-exemplo", texto: "convidado pendente há dias, qual o próximo passo?" }, raiz);
ok(r32.resposta.includes("escala para") && r32.resposta.includes("[Motor de SLA]") && r32.contexto.includes("motor-sla"),
  "Fase 8 — orquestrador compõe: memória + trilha de escalonamento + Motor de SLA juntos");

// --- Autenticação: senha (scrypt) e token de sessão (HMAC) ---
const { hashSenha, verificarSenha, criarToken, verificarToken } = await import("../lib/auth.ts");
const hSenha = hashSenha("teste-123");
ok(verificarSenha("teste-123", hSenha) && !verificarSenha("errada", hSenha) && !verificarSenha("teste-123", undefined),
  "Auth — senha verifica, rejeita errada e rejeita usuário sem senha cadastrada");
const token = criarToken("rafael", 1);
const [pl] = token.split(".");
ok(verificarToken(token) === "rafael" && verificarToken(`${pl}.assinatura-falsa`) === null && verificarToken("lixo") === null,
  "Auth — token de sessão valida e detecta adulteração");
ok(verificarToken(criarToken("rafael", -1)) === null,
  "Auth — token expirado não vale");

// --- Memória vetorial: degradação silenciosa quando Ollama está desligado ---
const { ollamaDisponivel, buscarVetorial } = await import("../lib/memoria-vetorial.ts");
ok((await ollamaDisponivel(true)) === false && (await buscarVetorial("pendente aéreo")) === null,
  "Vetorial — Ollama desligado → busca vetorial indisponível e Mind degrada para lexical");

// Limpeza: desfaz a edição de teste no grafo e remove artefatos
const arqGrafo = path.join(raiz, "grafo", "atendimento.json");
const dadosGrafo = JSON.parse(fs.readFileSync(arqGrafo, "utf8"));
dadosGrafo.nos = dadosGrafo.nos.filter((n: any) => n.id !== "rooming-list");
dadosGrafo.arestas = dadosGrafo.arestas.filter((a: any) => a.de !== "rooming-list" && a.para !== "rooming-list");
fs.writeFileSync(arqGrafo, JSON.stringify(dadosGrafo, null, 2) + "\n");
fs.rmSync(path.join(raiz, "operacao", "propostas", `${idProp2}.json`), { force: true });
fs.rmSync(path.join(raiz, "memoria", "recente", `decisao-${idProp2}.md`), { force: true });
