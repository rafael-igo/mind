/**
 * Memória Vetorial (decisão 11/jun/2026) — busca semântica sobre a memória Markdown.
 * Embeddings via OLLAMA LOCAL (nomic-embed-text, 768 dims) — máquina que liga sob demanda:
 * monitoramos a disponibilidade e, desligado, a Mind DEGRADA para busca lexical (nunca trava).
 * Vetores no pgvector do Postgres do mind-gateway. Peças aproveitadas do IGO AI Studio
 * (banco de peças, não dependência): chunking ~1000 tokens/overlap 200 e contrato de busca.
 * Segurança: quem chama aplica podeVer() DEPOIS — similaridade não vaza confidencial.
 */
import { createHash } from "node:crypto";
import type { DocMemoria } from "./core.ts";

const OLLAMA_URL = () => process.env.MIND_OLLAMA_URL || "";
const OLLAMA_MODELO = () => process.env.MIND_OLLAMA_MODELO || "nomic-embed-text";
const VETOR_DB = () => process.env.MIND_VETOR_DB || "";

// ---------------------------------------------------------------- Ollama (monitorado)

let cacheDisponivel: { valor: boolean; em: number } | null = null;
const CACHE_MS = 60_000;

/** O Ollama está ligado? Cacheado 60s para a máquina desligada não custar timeout a cada pergunta. */
export async function ollamaDisponivel(force = false): Promise<boolean> {
  if (!OLLAMA_URL()) return false;
  if (!force && cacheDisponivel && Date.now() - cacheDisponivel.em < CACHE_MS) return cacheDisponivel.valor;
  let valor = false;
  try {
    const r = await fetch(`${OLLAMA_URL().replace(/\/$/, "")}/api/tags`, { signal: AbortSignal.timeout(1500) });
    valor = r.ok;
  } catch {
    valor = false;
  }
  cacheDisponivel = { valor, em: Date.now() };
  return valor;
}

export async function gerarEmbedding(texto: string): Promise<number[] | null> {
  try {
    const r = await fetch(`${OLLAMA_URL().replace(/\/$/, "")}/api/embeddings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODELO(), prompt: texto.slice(0, 8000) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    return Array.isArray(j?.embedding) ? j.embedding : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Postgres (pgvector)

let _pool: any = null;
async function pool(): Promise<any | null> {
  if (!VETOR_DB()) return null;
  if (!_pool) {
    const pg = (await import("pg")).default;
    _pool = new pg.Pool({ connectionString: VETOR_DB(), max: 4 });
    _pool.on("error", () => {});
  }
  return _pool;
}

// ---------------------------------------------------------------- Chunking (peça do studio: ~1000 tokens / overlap 200)

const CHUNK_CHARS = 3600; // ~1000 tokens
const OVERLAP_CHARS = 700; // ~200 tokens

export function chunkar(corpo: string): string[] {
  const texto = corpo.trim();
  if (texto.length <= CHUNK_CHARS) return texto ? [texto] : [];
  const chunks: string[] = [];
  let inicio = 0;
  while (inicio < texto.length) {
    let fim = Math.min(inicio + CHUNK_CHARS, texto.length);
    // tenta quebrar em fim de parágrafo para preservar headings/contexto
    const quebra = texto.lastIndexOf("\n\n", fim);
    if (quebra > inicio + CHUNK_CHARS / 2) fim = quebra;
    chunks.push(texto.slice(inicio, fim).trim());
    if (fim >= texto.length) break;
    inicio = Math.max(fim - OVERLAP_CHARS, inicio + 1);
  }
  return chunks.filter(Boolean);
}

// ---------------------------------------------------------------- Indexação (incremental por hash)

export interface ResultadoIndexacao {
  indexados: number;
  pulados: number;
  chunks: number;
}

export async function indexarMemoria(docs: DocMemoria[]): Promise<ResultadoIndexacao | null> {
  const db = await pool();
  if (!db || !(await ollamaDisponivel())) return null;

  let indexados = 0, pulados = 0, chunks = 0;
  for (const doc of docs) {
    const hash = createHash("sha256").update(doc.corpo).digest("hex");
    const { rows } = await db.query("SELECT hash FROM memoria_vetores WHERE doc_id = $1 LIMIT 1", [doc.id]);
    if (rows[0]?.hash === hash) { pulados++; continue; }

    const partes = chunkar(`# ${doc.titulo}\n\n${doc.corpo}`);
    const embeddings: number[][] = [];
    for (const p of partes) {
      const e = await gerarEmbedding(p);
      if (!e) return { indexados, pulados, chunks }; // Ollama caiu no meio — para sem corromper
      embeddings.push(e);
    }
    await db.query("DELETE FROM memoria_vetores WHERE doc_id = $1", [doc.id]);
    for (let i = 0; i < partes.length; i++) {
      await db.query(
        `INSERT INTO memoria_vetores (doc_id, chunk_index, conteudo, comunidade, sensibilidade, tags, hash, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)`,
        [doc.id, i, partes[i], doc.comunidade, doc.sensibilidade, JSON.stringify(doc.tags), hash, `[${embeddings[i].join(",")}]`]
      );
      chunks++;
    }
    indexados++;
  }
  return { indexados, pulados, chunks };
}

// ---------------------------------------------------------------- Busca semântica

export interface AchadoVetorial {
  docId: string;
  conteudo: string;
  comunidade: string | null;
  sensibilidade: string;
  score: number; // similaridade de cosseno 0..1
}

/** Busca semântica. null = indisponível (sem DB ou Ollama desligado) → quem chama degrada p/ lexical. */
export async function buscarVetorial(texto: string, topK = 5): Promise<AchadoVetorial[] | null> {
  const db = await pool();
  if (!db || !(await ollamaDisponivel())) return null;
  const emb = await gerarEmbedding(texto);
  if (!emb) return null;
  const { rows } = await db.query(
    `SELECT doc_id, conteudo, comunidade, sensibilidade, 1 - (embedding <=> $1::vector) AS score
     FROM memoria_vetores ORDER BY embedding <=> $1::vector LIMIT $2`,
    [`[${emb.join(",")}]`, topK]
  );
  return rows.map((r: any) => ({
    docId: r.doc_id, conteudo: r.conteudo, comunidade: r.comunidade,
    sensibilidade: r.sensibilidade, score: Number(r.score),
  }));
}

/** Estado para o monitor (/api/saude): pgvector + Ollama + nº de chunks. */
export async function saudeVetorial(): Promise<{ ollama: boolean; banco: boolean; chunks: number | null }> {
  const ollama = await ollamaDisponivel(true);
  const db = await pool();
  if (!db) return { ollama, banco: false, chunks: null };
  try {
    const { rows } = await db.query("SELECT count(*)::int AS n FROM memoria_vetores");
    return { ollama, banco: true, chunks: rows[0].n };
  } catch {
    return { ollama, banco: false, chunks: null };
  }
}
