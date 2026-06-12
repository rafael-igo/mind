/**
 * Editor de memória (input de dados/arquivos + edição dos RAGs) — a porta de
 * CURADORIA HUMANA da memória, complementar à consolidação do freio.
 *
 * Governança:
 * - qualquer usuário logado CONTRIBUI: texto/arquivo entra em memoria/_inbox/
 *   (pré-memória, invisível à busca) aguardando curadoria;
 * - só diretor+ (rank >= 50) PUBLICA: aprova do _inbox, edita, cria direto ou
 *   manda para a _lixeira/ (nada é apagado de verdade);
 * - docs de bases externas (MIND_MEMORIA_EXTRA) são SOMENTE LEITURA — a Mind
 *   não edita o que não é dela (ehDaMind guarda isso).
 */
import fs from "node:fs";
import path from "node:path";
import {
  resolverDadosRaiz, parseFrontmatter, carregarMemoria,
  type DocMemoria, type Sensibilidade,
} from "./core.ts";

export const RANK_MINIMO_CURADORIA = 50;

export type ComunidadeEscrita = "profunda" | "recente" | "_inbox";
const COMUNIDADES: ComunidadeEscrita[] = ["profunda", "recente", "_inbox"];
const SENSIBILIDADES = ["publico", "interno", "restrito", "confidencial"];

function dirMemoria(raiz: string): string {
  return path.join(raiz, "memoria");
}

/** Só arquivos dentro de memoria/ da Mind são editáveis (bases externas: read-only). */
export function ehDaMind(arquivo: string, raiz = resolverDadosRaiz()): boolean {
  return path.resolve(arquivo).startsWith(path.resolve(dirMemoria(raiz)) + path.sep);
}

export function slugDe(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "doc";
}

/** Conversão mínima de HTML para texto (uploads .html). */
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "* ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// --------------------------- Inbox (pré-memória) ---------------------------

/** Docs do _inbox (invisíveis à busca; aparecem só na curadoria). */
export function listarInbox(raiz = resolverDadosRaiz()): DocMemoria[] {
  const dir = path.join(dirMemoria(raiz), "_inbox");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { meta, corpo } = parseFrontmatter(fs.readFileSync(path.join(dir, f), "utf8"));
      return {
        id: meta.id || f.replace(/\.md$/, ""),
        titulo: meta.titulo || f,
        tipo: meta.tipo || "conceito",
        comunidade: "_inbox",
        sensibilidade: (SENSIBILIDADES.includes(meta.sensibilidade) ? meta.sensibilidade : "interno") as Sensibilidade,
        tags: (meta.tags ?? "").replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean),
        corpo,
        arquivo: path.join(dir, f),
      };
    });
}

// --------------------------- Escrita ---------------------------

export interface NovoDoc {
  titulo: string;
  corpo: string;
  comunidade: ComunidadeEscrita;
  sensibilidade: Sensibilidade;
  tags?: string[];
  tipo?: string;
  fonte?: string;
}

function montarMarkdown(d: { id: string } & NovoDoc): string {
  const hoje = new Date().toISOString().slice(0, 10);
  return `---
id: ${d.id}
titulo: ${d.titulo}
tipo: ${d.tipo ?? "conceito"}
comunidade: ${d.comunidade.replace(/^_/, "")}
sensibilidade: ${d.sensibilidade}
tags: [${(d.tags ?? []).join(", ")}]
fonte: ${d.fonte ?? "painel-mind"}
atualizado_em: ${hoje}
---

${d.corpo.trim()}
`;
}

/** Cria um documento novo. Devolve o doc gravado (id pode ganhar sufixo para não colidir). */
export function criarDoc(raiz: string, dados: NovoDoc): { id: string; arquivo: string } {
  if (!COMUNIDADES.includes(dados.comunidade)) throw new Error(`comunidade inválida: ${dados.comunidade}`);
  if (!SENSIBILIDADES.includes(dados.sensibilidade)) throw new Error(`sensibilidade inválida: ${dados.sensibilidade}`);
  if (!dados.titulo.trim() || !dados.corpo.trim()) throw new Error("titulo e corpo são obrigatórios");
  const dir = path.join(dirMemoria(raiz), dados.comunidade);
  fs.mkdirSync(dir, { recursive: true });
  let id = slugDe(dados.titulo);
  // ids são únicos na memória inteira (a Mind resolve docs por id)
  const existentes = new Set([...carregarMemoria(raiz).map((d) => d.id), ...listarInbox(raiz).map((d) => d.id)]);
  if (existentes.has(id)) id = `${id}-${Date.now().toString(36)}`;
  const arquivo = path.join(dir, `${id}.md`);
  fs.writeFileSync(arquivo, montarMarkdown({ ...dados, id }));
  return { id, arquivo };
}

/** Localiza um doc editável (memória da Mind + _inbox) por id. */
export function acharDoc(raiz: string, id: string): DocMemoria | null {
  return (
    carregarMemoria(raiz).find((d) => d.id === id) ??
    listarInbox(raiz).find((d) => d.id === id) ??
    null
  );
}

export interface EdicaoDoc {
  titulo?: string;
  corpo?: string;
  sensibilidade?: Sensibilidade;
  tags?: string[];
}

/** Edita um doc DA MIND (recusa bases externas), preservando o restante do frontmatter. */
export function editarDoc(raiz: string, id: string, mud: EdicaoDoc): DocMemoria {
  const doc = acharDoc(raiz, id);
  if (!doc) throw new Error(`doc não encontrado: ${id}`);
  if (!ehDaMind(doc.arquivo, raiz)) throw new Error(`doc de base externa é somente leitura: ${id}`);
  if (mud.sensibilidade && !SENSIBILIDADES.includes(mud.sensibilidade)) throw new Error("sensibilidade inválida");
  const { meta } = parseFrontmatter(fs.readFileSync(doc.arquivo, "utf8"));
  meta.id = doc.id;
  if (mud.titulo?.trim()) meta.titulo = mud.titulo.trim();
  if (mud.sensibilidade) meta.sensibilidade = mud.sensibilidade;
  if (mud.tags) meta.tags = `[${mud.tags.join(", ")}]`;
  meta.atualizado_em = new Date().toISOString().slice(0, 10);
  const corpo = mud.corpo?.trim() ? mud.corpo.trim() : doc.corpo;
  const head = Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join("\n");
  fs.writeFileSync(doc.arquivo, `---\n${head}\n---\n\n${corpo}\n`);
  return { ...doc, titulo: meta.titulo, corpo, sensibilidade: (meta.sensibilidade as Sensibilidade) ?? doc.sensibilidade };
}

/** Aprova um doc do _inbox: vira memória de verdade (recente ou profunda). */
export function aprovarDoInbox(raiz: string, id: string, destino: "recente" | "profunda"): { id: string; arquivo: string } {
  const doc = listarInbox(raiz).find((d) => d.id === id);
  if (!doc) throw new Error(`doc não está no _inbox: ${id}`);
  const dir = path.join(dirMemoria(raiz), destino);
  fs.mkdirSync(dir, { recursive: true });
  const { meta, corpo } = parseFrontmatter(fs.readFileSync(doc.arquivo, "utf8"));
  meta.id = doc.id;
  meta.comunidade = destino;
  meta.atualizado_em = new Date().toISOString().slice(0, 10);
  const head = Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join("\n");
  const arquivo = path.join(dir, path.basename(doc.arquivo));
  fs.writeFileSync(arquivo, `---\n${head}\n---\n\n${corpo}\n`);
  fs.rmSync(doc.arquivo);
  return { id: doc.id, arquivo };
}

/** "Apagar" = mover para memoria/_lixeira/ (invisível à busca; nada se perde). */
export function mandarParaLixeira(raiz: string, id: string): string {
  const doc = acharDoc(raiz, id);
  if (!doc) throw new Error(`doc não encontrado: ${id}`);
  if (!ehDaMind(doc.arquivo, raiz)) throw new Error(`doc de base externa é somente leitura: ${id}`);
  const dir = path.join(dirMemoria(raiz), "_lixeira");
  fs.mkdirSync(dir, { recursive: true });
  const destino = path.join(dir, `${Date.now().toString(36)}-${path.basename(doc.arquivo)}`);
  fs.renameSync(doc.arquivo, destino);
  return destino;
}

// --------------------------- Upload ---------------------------

const EXTENSOES = new Set([".md", ".txt", ".html", ".htm"]);

/** Converte um upload em doc do _inbox. PDF/Office ainda não: converta antes (ex.: mind-ingestor). */
export function importarArquivo(raiz: string, nomeArquivo: string, conteudo: string, autor: string): { id: string; arquivo: string } {
  const ext = path.extname(nomeArquivo).toLowerCase();
  if (!EXTENSOES.has(ext)) {
    throw new Error(`extensão '${ext}' não suportada (aceito: .md, .txt, .html). Converta para texto/markdown antes.`);
  }
  const corpo = ext === ".html" || ext === ".htm" ? htmlParaTexto(conteudo) : conteudo;
  const titulo = path.basename(nomeArquivo, ext).replace(/[-_]+/g, " ").trim() || "Documento importado";
  return criarDoc(raiz, {
    titulo,
    corpo,
    comunidade: "_inbox",
    sensibilidade: "interno",
    tags: ["importado"],
    fonte: `upload de ${autor}: ${nomeArquivo}`,
  });
}
