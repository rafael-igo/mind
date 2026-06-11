/**
 * Editor do grafo (Fase 4) — instruções de chat viram OPERAÇÕES determinísticas
 * sobre o JSON fonte da verdade. NUNCA executa direto: a operação viaja dentro
 * da proposta e só é aplicada pelo freio na aprovação (Git dá o rollback).
 */
import fs from "node:fs";
import path from "node:path";
import { carregarGrafo, validarGrafo, type Aresta, type Grafo, type No } from "./core.ts";

export type OperacaoGrafo =
  | { op: "adicionar-no"; no: No; arestaDominio?: Aresta }
  | { op: "adicionar-aresta"; aresta: Aresta };

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const TIPOS_NO = ["dominio", "papel", "motor", "modulo", "bloco-regra"];
const TIPOS_ARESTA = ["contem", "fluxo", "escala-para", "delega-para", "depende-de", "aciona"];

/**
 * Reconhece comandos estruturados no texto do chat:
 *   adicionar nó <tipo> "Título" [em <dominio-id>]
 *   adicionar aresta <de> -> <para> [tipo <tipo>]
 * Sem match => null (a proposta segue sem operação executável).
 */
export function parseOperacaoGrafo(texto: string, grafo: Grafo): OperacaoGrafo | null {
  const t = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const mNo = t.match(/adicionar\s+(?:um\s+)?no\s+(dominio|papel|motor|modulo|bloco-regra)\s+"([^"]+)"(?:\s+em\s+([a-z0-9-]+))?/);
  if (mNo && TIPOS_NO.includes(mNo[1])) {
    // título original (com acentos) extraído do texto cru entre aspas
    const tituloCru = texto.match(/"([^"]+)"/)?.[1] ?? mNo[2];
    const dominioId = mNo[3] ?? grafo.nos.find((n) => n.tipo === "dominio")?.id ?? null;
    const no: No = {
      id: slug(tituloCru),
      tipo: mNo[1] as No["tipo"],
      titulo: tituloCru,
      dominio: mNo[1] === "dominio" ? null : dominioId,
      sensibilidade: "interno",
      status: "planejado",
      memoria: [],
    };
    const arestaDominio: Aresta | undefined =
      no.tipo !== "dominio" && dominioId ? { de: dominioId, para: no.id, tipo: "contem" } : undefined;
    return { op: "adicionar-no", no, arestaDominio };
  }

  const mAr = t.match(/adicionar\s+(?:uma\s+)?aresta\s+([a-z0-9-]+)\s*(?:->|para)\s*([a-z0-9-]+)(?:\s+tipo\s+([a-z-]+))?/);
  if (mAr) {
    const tipo = (mAr[3] && TIPOS_ARESTA.includes(mAr[3]) ? mAr[3] : "fluxo") as Aresta["tipo"];
    return { op: "adicionar-aresta", aresta: { de: mAr[1], para: mAr[2], tipo } };
  }

  return null;
}

/** Aplica a operação no arquivo de domínio do grafo, validando ANTES de gravar. */
export function aplicarOperacaoGrafo(raiz: string, op: OperacaoGrafo): void {
  const arquivo = path.join(raiz, "grafo", "atendimento.json");
  const dados = JSON.parse(fs.readFileSync(arquivo, "utf8"));

  if (op.op === "adicionar-no") {
    if (dados.nos.some((n: No) => n.id === op.no.id)) throw new Error(`nó já existe: ${op.no.id}`);
    dados.nos.push(op.no);
    if (op.arestaDominio) dados.arestas.push(op.arestaDominio);
  } else {
    dados.arestas.push(op.aresta);
  }

  // valida o grafo COMPLETO (todos os arquivos) com a mudança aplicada em memória
  const completo = carregarGrafo(raiz);
  if (op.op === "adicionar-no") {
    completo.nos.push(op.no);
    if (op.arestaDominio) completo.arestas.push(op.arestaDominio);
  } else {
    completo.arestas.push(op.aresta);
  }
  validarGrafo(completo);

  dados.atualizado_em = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2) + "\n");
}

export function descreverOperacao(op: OperacaoGrafo): string {
  if (op.op === "adicionar-no")
    return `adicionar nó ${op.no.tipo} "${op.no.titulo}" (${op.no.id})${op.arestaDominio ? ` ligado a ${op.arestaDominio.de}` : ""}`;
  return `adicionar aresta ${op.aresta.de} -> ${op.aresta.para} (${op.aresta.tipo})`;
}
