/**
 * Motor de Criatividade / Resolução de Problemas (Fase 5) — o ÚNICO motor
 * autorizado a pensar ALÉM da memória registrada: gera hipóteses e abordagens
 * novas, sempre rotuladas como exploração (não-verdade). Exclusivo da Área do
 * Criador (nível máximo) e usa o modelo mais forte disponível para o nível.
 *
 * Governança: nada daqui escreve na memória. As explorações vivem em
 * operacao/criatividade/ (workspace, invisível à busca). "Promover" uma
 * exploração cria uma PROPOSTA que PARA no freio, como qualquer mudança.
 */
import fs from "node:fs";
import path from "node:path";
import type { Grafo, DocMemoria } from "./core.ts";
import { encontrarNoAlvo, cascataDe, type PropostaRascunho } from "./motor-cognitivo.ts";

/** Área do Criador: só o nível máximo entra (criador/sócio, rank 100). */
export const RANK_MINIMO_CRIADOR = 100;

export interface Abordagem {
  titulo: string;
  descricao: string;
  risco: string;
}

export interface Exploracao {
  id: string;
  criadaEm: string;
  autor: string;
  problema: string;
  nosRelacionados: string[];
  memoriaRelacionada: string[];
  abordagens: Abordagem[];
  /** Write-up da exploração — refinado pelo LLM forte quando o gateway está de pé. */
  texto: string;
  perguntas: string[];
  status: "aberta" | "promovida" | "arquivada";
  propostaId?: string;
}

export function dirCriatividade(raiz: string): string {
  return path.join(raiz, "operacao", "criatividade");
}

const SYSTEM_CRIATIVIDADE =
  "Você é o Motor de Criatividade da Mind (Área do Criador). Diferente dos outros motores, você PODE " +
  "pensar além da memória registrada: gere abordagens novas para o problema, cruzando o grafo da " +
  "empresa e a memória fornecida. Rotule claramente o que é FATO (vem do contexto) e o que é " +
  "HIPÓTESE sua. Estruture em PT-BR: 2 a 4 abordagens (cada uma com prós, contras e risco), uma " +
  "recomendação e perguntas em aberto. NADA disso é verdade da empresa até passar pelo freio.";

export async function explorar(args: {
  problema: string;
  autor: string;
  grafo: Grafo;
  memoria: DocMemoria[];
  buscarDocs: (texto: string, docs: DocMemoria[]) => { doc: DocMemoria; score: number }[];
  chamarLlm?: (sistema: string, usuario: string) => Promise<string | null>;
}): Promise<Exploracao> {
  const alvo = encontrarNoAlvo(args.problema, args.grafo);
  const cascata = cascataDe(args.grafo, alvo.id);
  const docs = args.buscarDocs(args.problema, args.memoria).slice(0, 4).map((a) => a.doc);

  // Esqueleto determinístico: três caminhos clássicos de solução, ancorados no grafo —
  // garante exploração útil mesmo offline (e é o que o teste hermético valida).
  const abordagens: Abordagem[] = [
    {
      titulo: `Evoluir o que existe: ${alvo.titulo}`,
      descricao:
        `Resolver dentro do nó "${alvo.titulo}" (${alvo.id}), ajustando regras/processo atuais; ` +
        `menor atrito, cascata conhecida (${cascata.length} nó(s)).`,
      risco: "Pode só remediar o sintoma se a causa estiver em outro nó.",
    },
    {
      titulo: "Criar um módulo/motor novo",
      descricao: "Tratar o problema como capacidade nova da plataforma (nó novo no grafo, via proposta no freio).",
      risco: "Custo de construção e manutenção; pode duplicar algo existente.",
    },
    {
      titulo: "Piloto manual antes de automatizar",
      descricao: "Rodar a solução como processo manual num evento real, registrar o aprendizado na memória e só então automatizar.",
      risco: "Mais lento; depende de disciplina de registro.",
    },
  ];

  const perguntas = [
    "Qual resultado mensurável define que o problema foi resolvido?",
    ...(cascata.length
      ? [`A solução pode mexer em ${cascata.slice(0, 3).map((c) => `"${c.titulo}"`).join(", ")} — isso é aceitável?`]
      : []),
    "Há restrição de prazo ou orçamento para essa solução?",
  ];

  let texto =
    `Exploração (rascunho determinístico) sobre: ${args.problema}\n` +
    `Nó mais próximo no grafo: "${alvo.titulo}" (${alvo.id}). ` +
    (docs.length ? `Memória consultada: ${docs.map((d) => d.id).join(", ")}.` : "Sem memória diretamente relacionada.") +
    `\nAs abordagens abaixo são HIPÓTESES — nada vira verdade sem passar pelo freio.`;

  if (args.chamarLlm) {
    const blocoMem = docs.map((d) => `### ${d.titulo} (${d.id})\n${d.corpo.slice(0, 1500)}`).join("\n\n");
    const refinado = await args.chamarLlm(
      SYSTEM_CRIATIVIDADE,
      `Problema trazido por ${args.autor} (Área do Criador): ${args.problema}\n\n` +
        `Nó mais próximo no grafo: ${alvo.titulo} (${alvo.id})\n` +
        `Cascata: ${cascata.map((c) => c.titulo).join(", ") || "nenhuma"}\n\n` +
        `Memória relacionada:\n${blocoMem || "(nenhuma)"}`
    );
    if (refinado) texto = refinado;
  }

  return {
    id: `exp-${Date.now().toString(36)}`,
    criadaEm: new Date().toISOString(),
    autor: args.autor,
    problema: args.problema,
    nosRelacionados: [alvo.id, ...cascata.slice(0, 5).map((c) => c.no)],
    memoriaRelacionada: docs.map((d) => d.id),
    abordagens,
    texto,
    perguntas,
    status: "aberta",
  };
}

// --------------------------- Workspace (persistência) ---------------------------

export function salvarExploracao(raiz: string, e: Exploracao): void {
  const dir = dirCriatividade(raiz);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${e.id}.json`), JSON.stringify(e, null, 2));
}

export function carregarExploracao(raiz: string, id: string): Exploracao | null {
  const arq = path.join(dirCriatividade(raiz), `${id}.json`);
  if (!fs.existsSync(arq)) return null;
  return JSON.parse(fs.readFileSync(arq, "utf8"));
}

export function listarExploracoes(raiz: string, status?: Exploracao["status"]): Exploracao[] {
  const dir = dirCriatividade(raiz);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Exploracao)
    .filter((e) => !status || e.status === status)
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
}

// --------------------------- Promoção (porta para o freio) ---------------------------

/** Promover = a exploração vira PEDIDO DE MUDANÇA formal: rascunho de proposta que PARA no freio. */
export function rascunhoDePromocao(e: Exploracao, grafo: Grafo): PropostaRascunho {
  const alvo = grafo.nos.find((n) => n.id === e.nosRelacionados[0]) ?? grafo.nos[0];
  return {
    pedido: `Promover exploração ${e.id}: ${e.problema}`,
    autor: e.autor,
    nivel: "criador",
    noAlvo: alvo.id,
    tituloAlvo: alvo.titulo,
    cascata: cascataDe(grafo, alvo.id),
    memoriaRelacionada: e.memoriaRelacionada,
    raciocinio:
      `Exploração criativa ${e.id} promovida a proposta. ` +
      `Abordagens avaliadas: ${e.abordagens.map((a) => a.titulo).join("; ")}.`,
    perguntas: e.perguntas,
    propostaTexto: e.texto,
  };
}
