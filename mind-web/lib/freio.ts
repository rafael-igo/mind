/**
 * Freio (controle inibitório, Fase 3) — toda ação que MUDA A VERDADE para aqui.
 * Propostas ficam em operacao/propostas/<id>.json com status "pendente";
 * só rank >= RANK_MINIMO_APROVACAO (diretor/criador) decide. Aprovada =>
 * consolida em memoria/recente/decisao-<id>.md (vira memória curada).
 */
import fs from "node:fs";
import path from "node:path";
import type { PropostaRascunho } from "./motor-cognitivo.ts";
import { aplicarOperacaoGrafo, descreverOperacao } from "./grafo-editor.ts";

export const RANK_MINIMO_APROVACAO = 50;

export interface Proposta extends PropostaRascunho {
  id: string;
  criadaEm: string;
  status: "pendente" | "aprovada" | "rejeitada";
  decididaPor?: string;
  decididaEm?: string;
  arquivoDecisao?: string;
  grafoAplicado?: boolean;
}

export function dirPropostas(raiz: string): string {
  return path.join(raiz, "operacao", "propostas");
}

export function criarProposta(raiz: string, rascunho: PropostaRascunho): Proposta {
  const id = `prop-${Date.now().toString(36)}`;
  const proposta: Proposta = { id, criadaEm: new Date().toISOString(), status: "pendente", ...rascunho };
  const dir = dirPropostas(raiz);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(proposta, null, 2));
  return proposta;
}

export function carregarProposta(raiz: string, id: string): Proposta | null {
  const arq = path.join(dirPropostas(raiz), `${id}.json`);
  if (!fs.existsSync(arq)) return null;
  return JSON.parse(fs.readFileSync(arq, "utf8"));
}

export function listarPropostas(raiz: string, status?: Proposta["status"]): Proposta[] {
  const dir = dirPropostas(raiz);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Proposta)
    .filter((p) => !status || p.status === status)
    .sort((a, b) => a.criadaEm.localeCompare(b.criadaEm));
}

export interface ResultadoDecisao {
  ok: boolean;
  erro?: "nao-encontrada" | "ja-decidida" | "rank-insuficiente" | "operacao-grafo-falhou";
  detalhe?: string;
  proposta?: Proposta;
}

/** Decide uma proposta. Aprovada => consolida na memória (camada recente). */
export function decidirProposta(
  raiz: string,
  id: string,
  decisao: "aprovada" | "rejeitada",
  decisor: { id: string; nivel: string; rank: number }
): ResultadoDecisao {
  const proposta = carregarProposta(raiz, id);
  if (!proposta) return { ok: false, erro: "nao-encontrada" };
  if (proposta.status !== "pendente") return { ok: false, erro: "ja-decidida", proposta };
  if (decisor.rank < RANK_MINIMO_APROVACAO) return { ok: false, erro: "rank-insuficiente", proposta };

  // Fase 4 — a operação de grafo só é aplicada AQUI, na aprovação (chat propõe, freio executa).
  // Se falhar, a proposta continua pendente — nada fica meio-aplicado.
  if (decisao === "aprovada" && proposta.operacaoGrafo) {
    try {
      aplicarOperacaoGrafo(raiz, proposta.operacaoGrafo);
      proposta.grafoAplicado = true;
    } catch (err) {
      return { ok: false, erro: "operacao-grafo-falhou", detalhe: String(err), proposta };
    }
  }

  proposta.status = decisao;
  proposta.decididaPor = decisor.id;
  proposta.decididaEm = new Date().toISOString();

  if (decisao === "aprovada") {
    proposta.arquivoDecisao = consolidarNaMemoria(raiz, proposta);
  }

  fs.writeFileSync(path.join(dirPropostas(raiz), `${id}.json`), JSON.stringify(proposta, null, 2));
  return { ok: true, proposta };
}

/** A consolidação é a ÚNICA porta de escrita na memória vinda do ciclo cognitivo. */
function consolidarNaMemoria(raiz: string, p: Proposta): string {
  const dir = path.join(raiz, "memoria", "recente");
  fs.mkdirSync(dir, { recursive: true });
  const data = (p.decididaEm ?? new Date().toISOString()).slice(0, 10);
  const corpo = `---
id: decisao-${p.id}
titulo: Decisão aprovada — ${p.pedido.slice(0, 70)}
tipo: decisao
comunidade: recente
sensibilidade: interno
tags: [decisao, freio, ${p.noAlvo}]
proposta: ${p.id}
aprovada_por: ${p.decididaPor}
atualizado_em: ${data}
---

# Decisão aprovada — ${p.pedido}

- **Pedido por:** ${p.autor} (${p.nivel}) em ${p.criadaEm.slice(0, 10)}
- **Aprovada por:** ${p.decididaPor} em ${data}
- **Nó-alvo:** ${p.tituloAlvo} (\`${p.noAlvo}\`)
- **Cascata avaliada:** ${p.cascata.length ? p.cascata.map((c) => `${c.titulo} [${c.relacao}]`).join("; ") : "nenhuma"}
- **Memória consultada:** ${p.memoriaRelacionada.join(", ") || "nenhuma"}${p.operacaoGrafo ? `\n- **Operação aplicada no grafo:** ${descreverOperacao(p.operacaoGrafo)}` : ""}

## Proposta aprovada

${p.propostaTexto}

## Raciocínio do motor

${p.raciocinio}
`;
  const arquivo = path.join(dir, `decisao-${p.id}.md`);
  fs.writeFileSync(arquivo, corpo);
  return arquivo;
}
