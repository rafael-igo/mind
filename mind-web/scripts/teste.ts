/**
 * Teste das Fases 0, 1, 2 e 3 (roda sem servidor):
 *   node --experimental-strip-types scripts/teste.ts
 */
import fs from "node:fs";
import path from "node:path";
import { carregarGrafo, carregarMemoria, orquestrar, resolverDadosRaiz } from "../lib/core.ts";
import { calcularSla } from "../lib/motor-sla.ts";
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
