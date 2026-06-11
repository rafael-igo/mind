/**
 * Motor Cognitivo (Fase 3) — raciocina sobre um PEDIDO DE MUDANÇA:
 * localiza o nó-alvo no grafo, levanta a cascata (arestas que tocam o nó),
 * cruza com a memória e redige proposta + perguntas. NÃO muda nada — a
 * proposta para no freio (lib/freio.ts) até aprovação humana.
 * Puro (sem fs): recebe grafo/memória e um chamador de LLM opcional.
 */
import type { Grafo, No, DocMemoria } from "./core.ts";
import type { OperacaoGrafo } from "./grafo-editor.ts";

export interface ItemCascata {
  no: string; // id do nó afetado
  titulo: string;
  tipo: string;
  relacao: string; // ex.: "contem", "depende-de", "aciona" (+ direção)
}

export interface PropostaRascunho {
  pedido: string;
  autor: string;
  nivel: string;
  noAlvo: string;
  tituloAlvo: string;
  cascata: ItemCascata[];
  memoriaRelacionada: string[]; // ids de docs
  raciocinio: string;
  perguntas: string[];
  propostaTexto: string;
  /** Operação determinística sobre o grafo (Fase 4) — só o freio aplica, na aprovação. */
  operacaoGrafo?: OperacaoGrafo;
}

function normalizarLocal(s: string): string {
  const nfd = s.toLowerCase().normalize("NFD");
  let out = "";
  for (const ch of nfd) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x300 && c <= 0x36f) continue;
    out += ch;
  }
  return out;
}

/** Acha o nó do grafo que melhor casa com o pedido; sem match, cai no nó de domínio. */
export function encontrarNoAlvo(texto: string, grafo: Grafo): No {
  const termos = normalizarLocal(texto).split(/\W+/).filter((t) => t.length > 3);
  let melhor: { no: No; score: number } | null = null;
  for (const no of grafo.nos) {
    const alvo = normalizarLocal(`${no.titulo} ${no.id} ${no.descricao ?? ""}`);
    let score = 0;
    for (const t of termos) if (alvo.includes(t)) score += 1;
    if (score > 0 && (!melhor || score > melhor.score)) melhor = { no, score };
  }
  return melhor?.no ?? grafo.nos.find((n) => n.tipo === "dominio") ?? grafo.nos[0];
}

/** Cascata: todo nó ligado ao alvo por uma aresta, em qualquer direção. */
export function cascataDe(grafo: Grafo, noId: string): ItemCascata[] {
  const porId = new Map(grafo.nos.map((n) => [n.id, n]));
  const itens: ItemCascata[] = [];
  for (const a of grafo.arestas) {
    const outroId = a.de === noId ? a.para : a.para === noId ? a.de : null;
    if (!outroId) continue;
    const outro = porId.get(outroId);
    if (!outro) continue;
    const direcao = a.de === noId ? "→" : "←";
    itens.push({
      no: outro.id,
      titulo: outro.titulo,
      tipo: outro.tipo,
      relacao: `${a.tipo} ${direcao}${a.label ? ` (${a.label})` : ""}`,
    });
  }
  return itens;
}

// ------------------- View cruzada de cascata (Fase 6) -------------------

export interface ItemCascataProfunda extends ItemCascata {
  dominio: string | null;
  /** true quando o nó está em OUTRO domínio que o de origem — é onde a mudança "vaza" de plataforma. */
  cruzaDominio: boolean;
  /** nó pelo qual o impacto chegou (para reconstruir o caminho). */
  via: string;
}

export interface NivelCascata {
  profundidade: number;
  itens: ItemCascataProfunda[];
}

function dominioDe(no: No): string | null {
  return no.tipo === "dominio" ? no.id : no.dominio ?? null;
}

/**
 * Cascata TRANSITIVA: caminha as arestas em largura (qualquer direção) a partir do nó,
 * atravessando fronteiras de domínio — a view cruzada que mostra onde uma mudança
 * num domínio (ex.: RSVP) respinga em outro (ex.: credenciamento).
 */
export function cascataTransitiva(grafo: Grafo, noId: string, maxProfundidade = 3): NivelCascata[] {
  const porId = new Map(grafo.nos.map((n) => [n.id, n]));
  const origem = porId.get(noId);
  if (!origem) return [];
  const dominioOrigem = dominioDe(origem);
  const visitados = new Set<string>([noId]);
  const niveis: NivelCascata[] = [];
  let fronteira = [noId];

  for (let prof = 1; prof <= maxProfundidade && fronteira.length; prof++) {
    const itens: ItemCascataProfunda[] = [];
    const proxima: string[] = [];
    for (const id of fronteira) {
      for (const item of cascataDe(grafo, id)) {
        if (visitados.has(item.no)) continue;
        visitados.add(item.no);
        const no = porId.get(item.no)!;
        itens.push({ ...item, dominio: dominioDe(no), cruzaDominio: dominioDe(no) !== dominioOrigem, via: id });
        proxima.push(item.no);
      }
    }
    if (itens.length) niveis.push({ profundidade: prof, itens });
    fronteira = proxima;
  }
  return niveis;
}

const SYSTEM_PROPOSTA =
  "Você é o Motor Cognitivo da Mind. Recebe um pedido de mudança, o nó-alvo do grafo da empresa, " +
  "a cascata de nós afetados e a memória relacionada. Redija uma PROPOSTA objetiva em PT-BR: " +
  "o que mudar, impactos em cada nó da cascata e riscos. Liste no fim de 2 a 4 PERGUNTAS que " +
  "precisam de resposta humana antes de executar. NÃO execute nada: a decisão final é humana (freio).";

export async function montarProposta(args: {
  pedido: string;
  autor: string;
  nivel: string;
  grafo: Grafo;
  memoria: DocMemoria[];
  buscarDocs: (texto: string, docs: DocMemoria[]) => { doc: DocMemoria; score: number }[];
  chamarLlm?: (sistema: string, usuario: string) => Promise<string | null>;
}): Promise<PropostaRascunho> {
  const alvo = encontrarNoAlvo(args.pedido, args.grafo);
  const cascata = cascataDe(args.grafo, alvo.id);
  const relacionados = args.buscarDocs(args.pedido, args.memoria).slice(0, 3).map((a) => a.doc);

  const raciocinio =
    `Pedido toca o nó "${alvo.titulo}" (${alvo.id}, tipo ${alvo.tipo}). ` +
    (cascata.length
      ? `Cascata: ${cascata.map((c) => `${c.titulo} [${c.relacao}]`).join("; ")}.`
      : "Nenhuma aresta ligada — mudança isolada no nó.") +
    (relacionados.length ? ` Memória relacionada: ${relacionados.map((d) => d.id).join(", ")}.` : "");

  const perguntas = [
    "Qual a urgência e o prazo desejado para a mudança?",
    ...cascata.slice(0, 3).map((c) => `Como a mudança afeta "${c.titulo}" (${c.relacao})?`),
    "Quem é o dono da mudança e quem precisa ser comunicado?",
  ];

  let propostaTexto =
    `Proposta (rascunho determinístico): atualizar "${alvo.titulo}" conforme o pedido, ` +
    `revisando os ${cascata.length} nó(s) da cascata e os documentos de memória relacionados ` +
    `antes de consolidar.`;

  if (args.chamarLlm) {
    const blocoMem = relacionados.map((d) => `### ${d.titulo} (${d.id})\n${d.corpo.slice(0, 1500)}`).join("\n\n");
    const refinada = await args.chamarLlm(
      SYSTEM_PROPOSTA,
      `Pedido de ${args.autor} (nível ${args.nivel}): ${args.pedido}\n\n` +
        `Nó-alvo: ${alvo.titulo} (${alvo.id})\nCascata:\n` +
        cascata.map((c) => `- ${c.titulo} (${c.tipo}) [${c.relacao}]`).join("\n") +
        `\n\nMemória relacionada:\n${blocoMem || "(nenhuma)"}`
    );
    if (refinada) propostaTexto = refinada;
  }

  return {
    pedido: args.pedido,
    autor: args.autor,
    nivel: args.nivel,
    noAlvo: alvo.id,
    tituloAlvo: alvo.titulo,
    cascata,
    memoriaRelacionada: relacionados.map((d) => d.id),
    raciocinio,
    perguntas,
    propostaTexto,
  };
}
