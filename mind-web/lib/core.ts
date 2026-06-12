/**
 * Núcleo da Mind (framework-agnóstico).
 * Carrega o grafo (fonte da verdade), a memória (markdown) e as permissões,
 * e implementa o fluxo Escuta -> Orquestrador -> Fala (Fase 1).
 */
import fs from "node:fs";
import path from "node:path";
import { calcularSla, resumirSla, type Pendencia } from "./motor-sla.ts";
import { montarProposta, encontrarNoAlvo, cascataTransitiva } from "./motor-cognitivo.ts";
import { criarProposta, decidirProposta, RANK_MINIMO_APROVACAO } from "./freio.ts";
import {
  explorar, salvarExploracao, carregarExploracao, rascunhoDePromocao, RANK_MINIMO_CRIADOR,
} from "./motor-criatividade.ts";
import { parseOperacaoGrafo, descreverOperacao } from "./grafo-editor.ts";
import { buscarVetorial } from "./memoria-vetorial.ts";

// ----------------------------- Tipos -----------------------------

export interface No {
  id: string;
  tipo: "dominio" | "papel" | "motor" | "modulo" | "bloco-regra";
  titulo: string;
  descricao?: string;
  dominio?: string | null;
  sensibilidade: Sensibilidade;
  status: "ideia" | "planejado" | "em-dev" | "ativo";
  memoria?: string[];
  metadados?: Record<string, unknown>;
}

export interface Aresta {
  de: string;
  para: string;
  tipo: "contem" | "fluxo" | "escala-para" | "delega-para" | "depende-de" | "aciona";
  label?: string;
}

export interface Grafo {
  nos: No[];
  arestas: Aresta[];
}

export type Sensibilidade = "publico" | "interno" | "restrito" | "confidencial";

export interface DocMemoria {
  id: string;
  titulo: string;
  tipo: string;
  /** Camada de memória: "recente" (episódica), "profunda" (semântica) ou "raiz"/nome da subpasta. */
  comunidade: string;
  sensibilidade: Sensibilidade;
  tags: string[];
  corpo: string;
  arquivo: string;
  /** Domínio do grafo a que o doc pertence (frontmatter `dominio:`). */
  dominio?: string;
  /** Referências a outros docs: frontmatter `relacionados:` + [[wikilinks]] no corpo. */
  relacionados: string[];
}

export interface Nivel {
  id: string;
  rank: number;
  titulo: string;
}

export interface Usuario {
  id: string;
  nome: string;
  nivel: string;
  tags?: string[];
  /** Hash scrypt da senha (lib/auth.ts). Usuário sem hash não consegue logar no painel. */
  senha_hash?: string;
}

export interface Permissoes {
  niveis: Nivel[];
  sensibilidadeParaRankMinimo: Record<string, number>;
  usuarios: Usuario[];
}

export interface RespostaOrquestrador {
  usuario: string;
  nivel: string;
  rank: number;
  permitido: boolean;
  contexto: string[];
  modo: "gateway" | "offline" | "negado" | "sem-memoria" | "motor-sla" | "freio-proposta" | "freio-decisao" | "criatividade" | "cascata" | "registro";
  resposta: string;
}

// ------------------------- Localizar dados -------------------------

/** Sobe a partir de um diretório procurando a raiz que tem grafo/ e memoria/. */
export function resolverDadosRaiz(): string {
  const env = process.env.MIND_DADOS;
  if (env && fs.existsSync(path.join(env, "grafo"))) return env;
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "grafo")) && fs.existsSync(path.join(dir, "memoria"))) return dir;
    const pai = path.dirname(dir);
    if (pai === dir) break;
    dir = pai;
  }
  throw new Error("Não encontrei a raiz dos dados (grafo/ + memoria/). Defina MIND_DADOS.");
}

// ----------------------------- Grafo -----------------------------

const TIPOS_NO = ["dominio", "papel", "motor", "modulo", "bloco-regra"];
const TIPOS_AR = ["contem", "fluxo", "escala-para", "delega-para", "depende-de", "aciona"];
const SENS = ["publico", "interno", "restrito", "confidencial"];
const STATUS = ["ideia", "planejado", "em-dev", "ativo"];

export function carregarGrafo(raiz = resolverDadosRaiz()): Grafo {
  const dir = path.join(raiz, "grafo");
  const arquivos = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const g: Grafo = { nos: [], arestas: [] };
  for (const f of arquivos) {
    const parte = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (Array.isArray(parte.nos)) g.nos.push(...parte.nos);
    if (Array.isArray(parte.arestas)) g.arestas.push(...parte.arestas);
  }
  validarGrafo(g);
  return g;
}

export function validarGrafo(g: Grafo): void {
  const erros: string[] = [];
  const ids = new Set<string>();
  for (const n of g.nos) {
    if (!n.id) erros.push("nó sem id");
    if (ids.has(n.id)) erros.push(`id duplicado: ${n.id}`);
    ids.add(n.id);
    if (!TIPOS_NO.includes(n.tipo)) erros.push(`${n.id}: tipo inválido '${n.tipo}'`);
    if (!SENS.includes(n.sensibilidade)) erros.push(`${n.id}: sensibilidade inválida`);
    if (!STATUS.includes(n.status)) erros.push(`${n.id}: status inválido`);
  }
  for (const a of g.arestas) {
    if (!TIPOS_AR.includes(a.tipo)) erros.push(`aresta tipo inválido '${a.tipo}'`);
    if (!ids.has(a.de)) erros.push(`aresta refere id inexistente: ${a.de}`);
    if (!ids.has(a.para)) erros.push(`aresta refere id inexistente: ${a.para}`);
  }
  if (erros.length) throw new Error("Grafo inválido:\n - " + erros.join("\n - "));
}

// ----------------------------- Memória -----------------------------

/** Parser mínimo de frontmatter YAML (só os campos que usamos). */
export function parseFrontmatter(texto: string): { meta: Record<string, string>; corpo: string } {
  const meta: Record<string, string> = {};
  if (!texto.startsWith("---")) return { meta, corpo: texto };
  const fim = texto.indexOf("\n---", 3);
  if (fim === -1) return { meta, corpo: texto };
  const head = texto.slice(3, fim).trim();
  const corpo = texto.slice(fim + 4).trim();
  for (const linha of head.split("\n")) {
    const i = linha.indexOf(":");
    if (i === -1) continue;
    const chave = linha.slice(0, i).trim();
    const valor = linha.slice(i + 1).trim();
    meta[chave] = valor;
  }
  return { meta, corpo };
}

function parseLista(v?: string): string[] {
  if (!v) return [];
  return v.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** Aceita o enum da Mind e também rótulos livres (alta/média/baixa) de bases externas. */
function normalizarSensibilidade(v?: string): Sensibilidade {
  const s = (v ?? "").toLowerCase().trim();
  if (SENS.includes(s)) return s as Sensibilidade;
  if (s === "alta" || s === "alto") return "restrito";
  if (s === "media" || s === "média" || s === "medio" || s === "médio") return "interno";
  if (s === "baixa" || s === "baixo") return "publico";
  return "interno";
}

// Audiências amplas das bases externas (campo `publico:`): se o doc é para alguma delas,
// o nível interno basta. Sem audiência ampla, o doc é de gestão/liderança — NÃO pode cair
// no default interno (um operador leria resumo de diretoria).
const AUDIENCIAS_AMPLAS = [
  "todas-areas", "todas as areas", "operador", "apoio", "consultor", "especialista",
  "agencia", "cliente-final", "ops", "ti",
];
const AUDIENCIAS_DIRECAO = ["diretoria", "lideranca", "socios", "diretor"];

/** Resolve a sensibilidade de um doc: campo `sensibilidade` manda; sem ele, deriva do `publico:`. */
export function sensibilidadeDoMeta(meta: Record<string, string>): Sensibilidade {
  if (meta.sensibilidade) return normalizarSensibilidade(meta.sensibilidade);
  const pub = (meta.publico ?? "").toLowerCase();
  if (pub) {
    if (AUDIENCIAS_AMPLAS.some((a) => pub.includes(a))) return "interno";
    // só direção/liderança listada => confidencial (rank diretor); demais gestões => restrito
    const partes = pub.replace(/^\[|\]$/g, "").split(",").map((p) => p.trim()).filter(Boolean);
    if (partes.length && partes.every((p) => AUDIENCIAS_DIRECAO.some((d) => p.includes(d)))) return "confidencial";
    return "restrito";
  }
  return "interno";
}

/** Pastas de memória: a própria da Mind + extras (env MIND_MEMORIA_EXTRA, separadas por vírgula). */
export function fontesMemoria(raiz = resolverDadosRaiz()): string[] {
  const fontes = [path.join(raiz, "memoria")];
  const extra = process.env.MIND_MEMORIA_EXTRA;
  if (extra) {
    for (const p of extra.split(",").map((x) => x.trim()).filter(Boolean)) {
      if (fs.existsSync(p)) fontes.push(p);
    }
  }
  return fontes;
}

const IGNORAR = new Set(["readme.md"]);

/** Subpastas-comunidade de uma fonte de memória. Prefixo _ (ex.: _inbox) é pré-memória: invisível. */
function comunidadesDe(dir: string): { nome: string; dir: string }[] {
  const out = [{ nome: "raiz", dir }];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
      out.push({ nome: e.name, dir: path.join(dir, e.name) });
  }
  return out;
}

export function carregarMemoria(raiz = resolverDadosRaiz()): DocMemoria[] {
  const docs: DocMemoria[] = [];
  const vistos = new Set<string>();
  for (const fonte of fontesMemoria(raiz)) {
    for (const com of comunidadesDe(fonte)) {
      const arquivos = fs.readdirSync(com.dir)
        .filter((f) => f.endsWith(".md") && !f.startsWith("_") && !IGNORAR.has(f.toLowerCase()));
      for (const f of arquivos) {
        const { meta, corpo } = parseFrontmatter(fs.readFileSync(path.join(com.dir, f), "utf8"));
        if (!corpo.trim()) continue; // ignora arquivos sem corpo/frontmatter útil
        const id = meta.id || f.replace(/\.md$/, "");
        if (vistos.has(id)) continue; // a memória própria da Mind tem precedência
        vistos.add(id);
        // Referências: frontmatter `relacionados:` + [[wikilinks]] no corpo — a Mind segue
        // essas trilhas ao montar contexto (1 salto), como um gerente que puxa o doc citado.
        const links = new Set(parseLista(meta.relacionados));
        for (const m of corpo.matchAll(/\[\[([^\]|#]+)/g)) links.add(m[1].trim());
        links.delete(id);
        docs.push({
          id,
          titulo: meta.titulo || f,
          tipo: meta.tipo || meta.categoria || "conceito",
          comunidade: meta.comunidade || com.nome,
          sensibilidade: sensibilidadeDoMeta(meta),
          tags: parseLista(meta.tags),
          corpo,
          arquivo: path.join(com.dir, f),
          dominio: meta.dominio || undefined,
          relacionados: [...links],
        });
      }
    }
  }
  return docs;
}

// --------------------------- Permissões ---------------------------

export function carregarPermissoes(raiz = resolverDadosRaiz()): Permissoes {
  const dir = path.join(raiz, "permissoes");
  const niveisRaw = JSON.parse(fs.readFileSync(path.join(dir, "niveis.json"), "utf8"));
  // usuarios.json (real, com senha, fora do Git) tem precedência sobre o exemplo
  const arqReal = path.join(dir, "usuarios.json");
  const usuariosRaw = JSON.parse(
    fs.readFileSync(fs.existsSync(arqReal) ? arqReal : path.join(dir, "usuarios.exemplo.json"), "utf8")
  );
  return {
    niveis: niveisRaw.niveis,
    sensibilidadeParaRankMinimo: niveisRaw.sensibilidade_para_rank_minimo,
    usuarios: usuariosRaw.usuarios,
  };
}

export function rankDe(p: Permissoes, nivelId: string): number {
  return p.niveis.find((n) => n.id === nivelId)?.rank ?? 0;
}

/** Regra de acesso: rank >= mínimo da sensibilidade. Tag 'pessoas' exige RH ou rank>=50. */
export function podeVer(p: Permissoes, usuario: Usuario, sensibilidade: Sensibilidade, tags: string[]): boolean {
  const rank = rankDe(p, usuario.nivel);
  const min = p.sensibilidadeParaRankMinimo[sensibilidade] ?? 0;
  if (rank < min) return false;
  if (tags.includes("pessoas")) {
    const ehRh = usuario.nivel === "rh" || (usuario.tags ?? []).includes("pessoas");
    if (!ehRh && rank < 50) return false;
  }
  return true;
}

// --------------------------- Busca ---------------------------

function normalizar(s: string): string {
  const nfd = s.toLowerCase().normalize("NFD");
  let out = "";
  for (const ch of nfd) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x300 && c <= 0x36f) continue; // remove marcas de acento combinantes
    out += ch;
  }
  return out;
}

// Palavras de pergunta/ligação não carregam significado — sem elas, "como funciona X?" busca só por X.
const STOPWORDS = new Set([
  "que", "qual", "quais", "como", "quando", "onde", "quem", "por", "porque",
  "para", "com", "sem", "sobre", "isso", "este", "esta", "esse", "essa",
  "dos", "das", "uma", "uns", "umas", "sao", "tem", "ter", "ser", "mais",
  "funciona", "existe", "pode", "fazer",
]);

export function buscar(texto: string, docs: DocMemoria[]): { doc: DocMemoria; score: number }[] {
  const termos = normalizar(texto)
    .split(/\W+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  const res = docs.map((doc) => {
    const alvo = normalizar(`${doc.titulo} ${doc.id} ${doc.tags.join(" ")} ${doc.corpo}`);
    // Eco de conversa não compete com conhecimento curado: o "título" de um chat é a
    // PERGUNTA do usuário (ecoa qualquer pergunta parecida) — chat não ganha bônus de
    // título e ainda pesa metade.
    const ehChat = doc.tipo === "chat";
    let score = 0;
    for (const t of termos) {
      if (!ehChat && normalizar(doc.titulo).includes(t)) score += 5;
      else if (alvo.includes(t)) score += 1;
    }
    if (ehChat) score *= 0.5;
    return { doc, score };
  });
  return res.filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
}

// --------------------------- Gateway LLM ---------------------------

/**
 * Modelo por nível de acesso: quanto mais alto o nível, mais capaz (e caro) o LLM.
 * O gateway precisa permitir o modelo no allowed_models do tenant; se não permitir,
 * ele cai no modelo default sem erro.
 */
const MODELO_POR_NIVEL: Record<string, string> = {
  operador: "claude-haiku-4-5",
  consultor: "claude-haiku-4-5",
  coordenador: "claude-sonnet-4-6",
  rh: "claude-sonnet-4-6",
  diretor: "claude-opus-4-8",
  criador: "claude-fable-5",
};

export function modeloParaNivel(nivel: string): string | undefined {
  return MODELO_POR_NIVEL[nivel];
}

/**
 * Chama o gateway LLM. Chave `tnt_*` => igo-ai-gateway (POST /v1/batch, header X-IGO-Ai-Key);
 * caso contrário, endpoint OpenAI-compatível. Sem config => null (modo offline).
 */
export async function chamarGateway(sistema: string, usuario: string, modeloPedido?: string): Promise<string | null> {
  const base = process.env.MIND_LLM_BASE_URL;
  const key = process.env.MIND_LLM_API_KEY;
  const modelo = modeloPedido || process.env.MIND_LLM_MODEL || "claude-haiku-4-5";
  if (!base) return null;
  const raiz = base.replace(/\/$/, "");
  try {
    if (key?.startsWith("tnt_")) {
      const r = await fetch(`${raiz}/v1/batch`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-igo-ai-key": key,
        },
        body: JSON.stringify({
          system: sistema,
          messages: [{ role: "user", content: usuario }],
          model_hint: modelo,
          task_type: "chat",
          agent: "mind",
          temperature: 0.2,
        }),
      });
      if (!r.ok) return null;
      const j: any = await r.json();
      return j?.text ?? null;
    }
    const r = await fetch(`${raiz}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        model: modelo,
        temperature: 0.2,
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: usuario },
        ],
      }),
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    return j?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

// --------------------------- Captura de memória episódica ---------------------------

/**
 * Manda a troca de chat pro mind-ingestor (memória recente do cofre Obsidian).
 * Fire-and-forget: sem MIND_INGESTOR_URL configurada, ou com o ingestor fora do ar,
 * a Mind responde normalmente — capturar memória nunca pode travar a fala.
 */
function capturarNoIngestor(
  usuario: string,
  pergunta: string,
  resposta: string,
  contexto: string[],
  sensibilidade: Sensibilidade = "interno"
): void {
  const base = process.env.MIND_INGESTOR_URL;
  if (!base) return;
  // Anti-vazamento por eco: resposta construída sobre contexto restrito/confidencial NÃO vira
  // memória episódica — o chat capturado nasceria com sensibilidade menor que a fonte e furaria
  // a permissão (um operador encontraria no eco o que não pode ver no original).
  if (SENS.indexOf(sensibilidade) >= SENS.indexOf("restrito")) return;
  fetch(`${base.replace(/\/$/, "")}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ usuario, pergunta, resposta, contexto, sensibilidade }),
  }).catch(() => {});
}

/** Maior sensibilidade entre docs (para herança na captura de chat). */
function maxSensibilidade(docs: DocMemoria[]): Sensibilidade {
  let max = 0;
  for (const d of docs) max = Math.max(max, SENS.indexOf(d.sensibilidade));
  return (SENS[max] ?? "interno") as Sensibilidade;
}

// --------------------------- Motores ---------------------------

/** Carrega pendências de operacao/pendencias.json (real) ou pendencias.exemplo.json. */
export function carregarPendencias(raiz = resolverDadosRaiz()): Pendencia[] {
  for (const nome of ["pendencias.json", "pendencias.exemplo.json"]) {
    const arq = path.join(raiz, "operacao", nome);
    if (fs.existsSync(arq)) {
      const j = JSON.parse(fs.readFileSync(arq, "utf8"));
      return Array.isArray(j.pendencias) ? j.pendencias : [];
    }
  }
  return [];
}

/** Roteamento determinístico: a pergunta é sobre estouro de SLA? */
function pedeMotorSla(texto: string): boolean {
  const t = normalizar(texto);
  return /\bsla\b/.test(t) && /(estour|venc|atras|prazo)/.test(t);
}

/** Roteamento determinístico: o texto é um PEDIDO DE MUDANÇA (vai para o motor cognitivo + freio)? */
function pedeMudanca(texto: string): boolean {
  return /(alterar|mudar|mudanca|trocar|ajustar|atualizar|remover|adicionar|incluir)/.test(normalizar(texto));
}

/** Comando de decisão do freio: "aprovar proposta <id>" | "rejeitar proposta <id>". */
function parseComandoFreio(texto: string): { decisao: "aprovada" | "rejeitada"; id: string } | null {
  const m = normalizar(texto).match(/\b(aprovar|rejeitar)\s+proposta\s+([a-z0-9-]+)/);
  if (!m) return null;
  return { decisao: m[1] === "aprovar" ? "aprovada" : "rejeitada", id: m[2] };
}

/** Roteamento (Fase 5): o texto pede EXPLORAÇÃO CRIATIVA (pensar além da memória)? */
function pedeCriatividade(texto: string): boolean {
  return /(brainstorm|ideia|inventar|criatividade|pensar fora|do zero|e se a gente)/.test(normalizar(texto));
}

/** Comando da Área do Criador: "promover exploracao <id>" → vira proposta no freio. */
function parseComandoPromover(texto: string): { id: string } | null {
  const m = normalizar(texto).match(/\bpromover\s+exploracao\s+([a-z0-9-]+)/);
  return m ? { id: m[1] } : null;
}

/**
 * Roteamento (Fase 6): pergunta de IMPACTO ("o que quebra/afeta", "cascata de X") →
 * view cruzada de cascata. Frases como "como funciona a cascata logística" NÃO casam
 * (não têm "de quê" de impacto) e seguem para a memória.
 */
function pedeCascata(texto: string): boolean {
  return /(o que (afeta|quebra|impacta)|qual o impacto|se eu mexer|cascata d[eoa]\s)/.test(normalizar(texto));
}

/** Comando do painel (card do nó → chat): "explica o nó <id>" | "debater o nó <id>". */
function parseComandoNo(texto: string): { id: string } | null {
  const m = normalizar(texto).match(/\b(?:explicar?|debater?|sobre)\s+o\s+no\s+([a-z0-9-]+)/);
  return m ? { id: m[1] } : null;
}

/**
 * Roteamento (gerente): a pergunta pede ENCAMINHAMENTO/decisão de gestão?
 * ("qual o próximo passo", "o que faremos", "quem cuida/resolve", "como proceder")
 */
function pedeEncaminhamento(texto: string): boolean {
  return /(proximo passo|o que fa(zer|remos|co)|quem (cuida|resolve|assume)|como proceder|encaminh|escalon)/.test(normalizar(texto));
}

/** Comando do chat: "registrar: <regra>" — a lacuna de conhecimento vira pré-memória (_inbox). */
function parseComandoRegistrar(texto: string): string | null {
  const m = texto.match(/^\s*registrar\s*:\s*([\s\S]+)/i);
  return m ? m[1].trim() : null;
}

/**
 * Conhecimento de GESTÃO do grafo: trilha de escalonamento + papéis de um domínio.
 * É o que um gerente sênior sabe de cabeça — entra no contexto quando a pergunta
 * pede encaminhamento e não há regra registrada que responda sozinha.
 */
function trilhaDeGestao(grafo: Grafo, dominio: string): string {
  const nosDom = grafo.nos.filter((n) => n.dominio === dominio || n.id === dominio);
  const ids = new Set(nosDom.map((n) => n.id));
  const porId = new Map(grafo.nos.map((n) => [n.id, n]));
  const escadas = grafo.arestas
    .filter((a) => a.tipo === "escala-para" && (ids.has(a.de) || ids.has(a.para)))
    .map((a) => `- ${porId.get(a.de)?.titulo ?? a.de} → escala para → ${porId.get(a.para)?.titulo ?? a.para}${a.label ? ` (quando: ${a.label})` : ""}`);
  if (!escadas.length) return "";
  const papeis = nosDom
    .filter((n) => n.tipo === "papel" && n.descricao)
    .map((n) => `- ${n.titulo}: ${n.descricao}`);
  return (
    `Trilha de escalonamento (grafo — domínio ${dominio}):\n${escadas.join("\n")}` +
    (papeis.length ? `\nPapéis do domínio:\n${papeis.join("\n")}` : "")
  );
}

/** Ficha determinística de um nó: o contexto que vai junto quando o nó está em foco/debate. */
function fichaDoNo(grafo: Grafo, no: No): string {
  const ligacoes = grafo.arestas
    .filter((a) => a.de === no.id || a.para === no.id)
    .map((a) => {
      const outroId = a.de === no.id ? a.para : a.de;
      const outro = grafo.nos.find((n) => n.id === outroId);
      return `- ${a.de === no.id ? "→" : "←"} ${outro?.titulo ?? outroId} (${a.tipo}${a.label ? `: ${a.label}` : ""})`;
    });
  return (
    `Nó "${no.titulo}" (${no.id}) — tipo ${no.tipo} · status ${no.status} · domínio ${no.dominio ?? no.id} · sensibilidade ${no.sensibilidade}` +
    (no.descricao ? `\n${no.descricao}` : "") +
    (ligacoes.length ? `\nLigações:\n${ligacoes.join("\n")}` : "\nSem ligações no grafo.")
  );
}

// --------------------------- Orquestrador ---------------------------

const SYSTEM_PROMPT =
  "Você é a Mind, o cérebro digital da empresa — pense como um GERENTE SÊNIOR de operações, não como um chat. " +
  "Responda com base no contexto fornecido (memória curada + grafo da empresa). Separe SEMPRE o que é REGISTRO " +
  "(está no contexto) do que é RECOMENDAÇÃO DE GESTÃO sua. Quando não houver regra registrada para a situação, " +
  "NÃO pare no 'não há registro': monte o melhor próximo passo CONCRETO cruzando papéis, trilha de escalonamento, " +
  "SLAs e cascata presentes no contexto — e feche oferecendo oficializar: 'para registrar essa regra, diga: " +
  "registrar: <texto da regra>'. Nunca invente fatos; recomendações são claramente rotuladas. Direto e em PT-BR.";

export interface PerguntaInput {
  usuario: string;
  texto: string;
  /** Nó em foco (card → chat): a pergunta do humano vai com a ficha deste nó como contexto. */
  foco?: string;
}

export async function orquestrar(input: PerguntaInput, raiz = resolverDadosRaiz()): Promise<RespostaOrquestrador> {
  const perm = carregarPermissoes(raiz);
  const memoria = carregarMemoria(raiz);

  // Escuta: quem está falando?
  const usuario = perm.usuarios.find((u) => u.id === input.usuario);
  if (!usuario) {
    return {
      usuario: input.usuario, nivel: "?", rank: 0, permitido: false,
      contexto: [], modo: "negado", resposta: "Usuário não identificado.",
    };
  }
  const rank = rankDe(perm, usuario.nivel);

  // Fase 3 — decisão do freio: aprovar/rejeitar proposta (só diretor/criador muda a verdade).
  const cmdFreio = parseComandoFreio(input.texto);
  if (cmdFreio) {
    const r = decidirProposta(raiz, cmdFreio.id, cmdFreio.decisao, { id: usuario.id, nivel: usuario.nivel, rank });
    if (!r.ok) {
      const msgs = {
        "nao-encontrada": `Não encontrei a proposta ${cmdFreio.id}.`,
        "ja-decidida": `A proposta ${cmdFreio.id} já foi decidida (${r.proposta?.status}).`,
        "rank-insuficiente": `O freio exige nível diretor ou acima (rank >= ${RANK_MINIMO_APROVACAO}) para decidir propostas.`,
        "operacao-grafo-falhou": `A operação no grafo falhou e a proposta segue pendente: ${r.detalhe ?? "erro desconhecido"}`,
      } as const;
      return {
        usuario: usuario.id, nivel: usuario.nivel, rank,
        permitido: r.erro !== "rank-insuficiente",
        contexto: [cmdFreio.id], modo: "freio-decisao", resposta: msgs[r.erro!],
      };
    }
    const p = r.proposta!;
    const resposta = p.status === "aprovada"
      ? `Proposta ${p.id} APROVADA por ${p.decididaPor}. Decisão consolidada na memória (decisao-${p.id}).` +
        (p.grafoAplicado && p.operacaoGrafo ? ` Grafo atualizado: ${descreverOperacao(p.operacaoGrafo)}.` : "")
      : `Proposta ${p.id} rejeitada por ${p.decididaPor}. Nada foi alterado.`;
    return {
      usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
      contexto: [p.id], modo: "freio-decisao", resposta,
    };
  }

  // Lacuna vira conhecimento: "registrar: <regra>" cria pré-memória no _inbox.
  // Qualquer um contribui; a curadoria (diretor+) decide se vira verdade.
  const textoRegistrar = parseComandoRegistrar(input.texto);
  if (textoRegistrar) {
    const { criarDoc } = await import("./memoria-editor.ts");
    const r = criarDoc(raiz, {
      titulo: textoRegistrar.split("\n")[0].slice(0, 70),
      corpo: textoRegistrar + `\n\n> Registrado pelo chat por ${usuario.id} (${usuario.nivel}).`,
      comunidade: "_inbox",
      sensibilidade: "interno",
      tags: ["regra-proposta", "chat"],
      tipo: "regra-proposta",
      fonte: `chat: ${usuario.id}`,
    });
    return {
      usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
      contexto: [r.id], modo: "registro",
      resposta:
        `📥 Registrado como pré-memória (${r.id}) no _inbox — invisível à busca até a curadoria. ` +
        `Um diretor+ aprova em 📚 memória (→ recente ou → profunda) e aí vira verdade da Mind.`,
    };
  }

  // Fase 5 — Área do Criador: promover exploração => vira proposta formal e PARA no freio.
  const cmdPromover = parseComandoPromover(input.texto);
  if (cmdPromover) {
    if (rank < RANK_MINIMO_CRIADOR) {
      return {
        usuario: usuario.id, nivel: usuario.nivel, rank, permitido: false,
        contexto: [cmdPromover.id], modo: "negado",
        resposta: "Promover explorações é exclusivo da Área do Criador (nível máximo).",
      };
    }
    const exp = carregarExploracao(raiz, cmdPromover.id);
    if (!exp) {
      return {
        usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
        contexto: [], modo: "criatividade",
        resposta: `Não encontrei a exploração ${cmdPromover.id} na Área do Criador.`,
      };
    }
    if (exp.status !== "aberta") {
      return {
        usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
        contexto: [cmdPromover.id], modo: "criatividade",
        resposta: `A exploração ${exp.id} já foi ${exp.status}${exp.propostaId ? ` (proposta ${exp.propostaId})` : ""}.`,
      };
    }
    const proposta = criarProposta(raiz, rascunhoDePromocao(exp, carregarGrafo(raiz)));
    exp.status = "promovida";
    exp.propostaId = proposta.id;
    salvarExploracao(raiz, exp);
    return {
      usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
      contexto: [proposta.id], modo: "freio-proposta",
      resposta:
        `🎨→🧠 Exploração ${exp.id} promovida: proposta ${proposta.id} criada e PARADA NO FREIO ` +
        `(nada foi alterado).\n\nPara decidir (diretor+): "aprovar proposta ${proposta.id}" ou ` +
        `"rejeitar proposta ${proposta.id}".`,
    };
  }

  // Fase 5 — Motor de Criatividade: o único que pensa ALÉM da memória (só nível máximo).
  if (pedeCriatividade(input.texto)) {
    if (rank < RANK_MINIMO_CRIADOR) {
      return {
        usuario: usuario.id, nivel: usuario.nivel, rank, permitido: false,
        contexto: [], modo: "negado",
        resposta: "O Motor de Criatividade é exclusivo da Área do Criador (nível máximo).",
      };
    }
    const exploracao = await explorar({
      problema: input.texto,
      autor: usuario.id,
      grafo: carregarGrafo(raiz),
      memoria: memoria.filter((d) => podeVer(perm, usuario, d.sensibilidade, d.tags)),
      buscarDocs: buscar,
      // nível máximo => modelo mais forte (Fable 5) decidido por modeloParaNivel
      chamarLlm: (sistema, texto) => chamarGateway(sistema, texto, modeloParaNivel(usuario.nivel)),
    });
    salvarExploracao(raiz, exploracao);
    const resposta =
      `🎨 Exploração ${exploracao.id} criada na Área do Criador (hipóteses — nada vira verdade sem freio).\n\n` +
      `${exploracao.texto}\n\nAbordagens:\n` +
      exploracao.abordagens.map((a) => `- ${a.titulo}: ${a.descricao} (risco: ${a.risco})`).join("\n") +
      `\n\nPerguntas em aberto:\n` +
      exploracao.perguntas.map((q) => `- ${q}`).join("\n") +
      `\n\nPara levar adiante: "promover exploracao ${exploracao.id}" (vira proposta e PARA no freio).`;
    return {
      usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
      contexto: [exploracao.id], modo: "criatividade", resposta,
    };
  }

  // Painel → chat: o card do nó vira debate. Monta o contexto DETERMINÍSTICO do nó
  // (ficha + ligações + memória ligada, com podeVer) e entrega ao LLM para discutir.
  const cmdNo = parseComandoNo(input.texto);
  if (cmdNo) {
    const grafo = carregarGrafo(raiz);
    const no = grafo.nos.find((n) => n.id === cmdNo.id);
    if (no) {
      if (rank < (perm.sensibilidadeParaRankMinimo[no.sensibilidade] ?? 0)) {
        return {
          usuario: usuario.id, nivel: usuario.nivel, rank, permitido: false,
          contexto: [no.id], modo: "negado",
          resposta: "Esse nó existe, mas seu nível de acesso não permite consultá-lo.",
        };
      }
      const docs = memoria.filter((d) => (no.memoria ?? []).includes(d.id) && podeVer(perm, usuario, d.sensibilidade, d.tags));
      const ficha = fichaDoNo(grafo, no);
      const blocoDocs = docs.map((d) => `### ${d.titulo} (${d.id})\n${d.corpo.slice(0, 1200)}`).join("\n\n");
      const viaGateway = await chamarGateway(
        SYSTEM_PROMPT,
        `${usuario.id} (nível ${usuario.nivel}) abriu este nó no painel e quer debatê-lo: "${input.texto}".\n` +
          `A Mind já verificou as permissões. Explique o nó com base na ficha e na memória ligada, ` +
          `aponte riscos ou lacunas que você enxerga NO REGISTRO (não invente fatos novos) e termine ` +
          `com 2 perguntas que ajudem a aprofundar o debate.\n\nFicha do nó (grafo — fonte da verdade):\n${ficha}\n\n` +
          `Memória ligada:\n${blocoDocs || "(nenhuma)"}`,
        modeloParaNivel(usuario.nivel)
      );
      const resposta = viaGateway ??
        `[offline] ${ficha}` +
        (docs.length ? `\nMemória ligada: ${docs.map((d) => d.titulo).join("; ")}` : "\nSem memória ligada a este nó.");
      if (viaGateway) {
        const sensNo = Math.max(SENS.indexOf(no.sensibilidade), SENS.indexOf(maxSensibilidade(docs)));
        capturarNoIngestor(usuario.id, input.texto, viaGateway, [no.id, ...docs.map((d) => d.id)], SENS[sensNo] as Sensibilidade);
      }
      return {
        usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
        contexto: [no.id, ...docs.map((d) => d.id)], modo: viaGateway ? "gateway" : "offline", resposta,
      };
    }
    // nó inexistente: segue o fluxo normal (busca na memória)
  }

  // Nó em FOCO (card → chat): o humano pergunta; a Mind anexa a ficha do nó como contexto.
  // Se o usuário não pode ver o nó, nega já aqui — o foco não fura permissão.
  const grafoFoco = input.foco ? carregarGrafo(raiz) : null;
  const focoNo = grafoFoco?.nos.find((n) => n.id === input.foco) ?? null;
  if (focoNo && rank < (perm.sensibilidadeParaRankMinimo[focoNo.sensibilidade] ?? 0)) {
    return {
      usuario: usuario.id, nivel: usuario.nivel, rank, permitido: false,
      contexto: [focoNo.id], modo: "negado",
      resposta: "Esse nó existe, mas seu nível de acesso não permite consultá-lo.",
    };
  }

  // Fase 6 — view cruzada de cascata: análise de impacto transitiva, atravessando domínios.
  // Determinística (anda as arestas do grafo) e respeita sensibilidade dos nós.
  if (pedeCascata(input.texto)) {
    const grafo = grafoFoco ?? carregarGrafo(raiz);
    const alvo = focoNo ?? encontrarNoAlvo(input.texto, grafo);
    const niveis = cascataTransitiva(grafo, alvo.id, 3).map((nv) => ({
      ...nv,
      itens: nv.itens.filter((i) => {
        const no = grafo.nos.find((n) => n.id === i.no)!;
        return rank >= (perm.sensibilidadeParaRankMinimo[no.sensibilidade] ?? 0);
      }),
    })).filter((nv) => nv.itens.length > 0);
    const dominiosCruzados = [...new Set(niveis.flatMap((nv) => nv.itens.filter((i) => i.cruzaDominio).map((i) => i.dominio ?? "?")))];
    const resposta = niveis.length === 0
      ? `🌊 "${alvo.titulo}" (${alvo.id}) não tem arestas no grafo — mudança isolada (ou nós fora do seu nível).`
      : `🌊 Impacto a partir de "${alvo.titulo}" (${alvo.id}):\n` +
        niveis.map((nv) =>
          `Nível ${nv.profundidade}: ` +
          nv.itens.map((i) => `${i.cruzaDominio ? "⤫ " : ""}${i.titulo} [${i.relacao}${i.via !== alvo.id ? ` via ${i.via}` : ""}]`).join("; ")
        ).join("\n") +
        (dominiosCruzados.length
          ? `\n\n⤫ A mudança CRUZA de domínio: respinga em ${dominiosCruzados.join(", ")}.`
          : "\n\nO impacto fica dentro do próprio domínio.") +
        `\n(cascata determinística pelas arestas do grafo — fonte da verdade)`;
    return {
      usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
      contexto: [alvo.id], modo: "cascata", resposta,
    };
  }

  // Fase 2 — motor determinístico: a LLM (ou o roteador) decide QUEM responde; o código calcula.
  if (pedeMotorSla(input.texto)) {
    const resultados = calcularSla(carregarPendencias(raiz));
    const resposta = resumirSla(resultados);
    capturarNoIngestor(usuario.id, input.texto, resposta, ["motor-sla"]);
    return {
      usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
      contexto: ["motor-sla"], modo: "motor-sla",
      resposta,
    };
  }

  // Fase 3 — pedido de mudança: motor cognitivo raciocina a cascata e a proposta PARA no freio.
  if (pedeMudanca(input.texto)) {
    const grafo = grafoFoco ?? carregarGrafo(raiz);
    const rascunho = await montarProposta({
      pedido: input.texto,
      autor: usuario.id,
      nivel: usuario.nivel,
      grafo,
      noAlvo: focoNo ?? undefined, // nó em foco vira o alvo da mudança
      memoria: memoria.filter((d) => podeVer(perm, usuario, d.sensibilidade, d.tags)),
      buscarDocs: buscar,
      chamarLlm: (sistema, texto) => chamarGateway(sistema, texto, modeloParaNivel(usuario.nivel)),
    });
    // Fase 4 — comando estruturado de edição do grafo vira operação executável (aplicada só na aprovação)
    const operacao = parseOperacaoGrafo(input.texto, grafo);
    if (operacao) rascunho.operacaoGrafo = operacao;
    const proposta = criarProposta(raiz, rascunho);
    const resposta =
      `🧠 Proposta ${proposta.id} criada e PARADA NO FREIO (nada foi alterado).\n\n` +
      `Nó-alvo: ${proposta.tituloAlvo} (${proposta.noAlvo})\n` +
      `Cascata: ${proposta.cascata.length ? proposta.cascata.map((c) => c.titulo).join(", ") : "nenhuma"}\n` +
      (operacao ? `Operação executável na aprovação: ${descreverOperacao(operacao)}\n` : "") +
      `\n${proposta.propostaTexto}\n\nPerguntas em aberto:\n` +
      proposta.perguntas.map((q) => `- ${q}`).join("\n") +
      `\n\nPara decidir (diretor+): "aprovar proposta ${proposta.id}" ou "rejeitar proposta ${proposta.id}".`;
    return {
      usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
      contexto: [proposta.id], modo: "freio-proposta", resposta,
    };
  }

  // Orquestrador: recupera memória relevante (limiar evita falso-positivo por 1 palavra solta)
  const LIMIAR = 2;
  const achados = buscar(input.texto, memoria).filter((a) => a.score >= LIMIAR);

  // Busca HÍBRIDA: a vetorial (Ollama+pgvector) complementa a lexical quando disponível;
  // Ollama desligado => null e a Mind segue só com a lexical (degradação silenciosa).
  // podeVer() continua sendo aplicado DEPOIS — similaridade não fura permissão.
  const vetoriais = await buscarVetorial(input.texto);
  if (vetoriais) {
    for (const v of vetoriais) {
      if (v.score < 0.55) continue; // similaridade fraca não entra
      const ja = achados.find((a) => a.doc.id === v.docId);
      if (ja) {
        // Os DOIS sinais concordam => reforça. Sem isso, o doc certo (lexical+vetorial)
        // perdia para vizinhos genéricos achados só pela vetorial (que ganhavam o x8).
        ja.score += v.score * 4;
      } else {
        const doc = memoria.find((d) => d.id === v.docId);
        if (doc) achados.push({ doc, score: v.score * 8 }); // escala comparável à lexical
      }
    }
    achados.sort((a, b) => b.score - a.score);
  }

  if (achados.length === 0 && !focoNo) {
    return {
      usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
      contexto: [], modo: "sem-memoria",
      resposta: "Não encontrei nada na memória sobre isso ainda.",
    };
  }

  // Permissão determinística: se o MELHOR match é bloqueado, nega (não cai num doc fraco visível)
  const topo = achados[0];
  if (topo && !podeVer(perm, usuario, topo.doc.sensibilidade, topo.doc.tags)) {
    return {
      usuario: usuario.id, nivel: usuario.nivel, rank, permitido: false,
      contexto: [topo.doc.id], modo: "negado",
      resposta: "Existe registro sobre isso, mas seu nível de acesso não permite consultá-lo.",
    };
  }

  const contexto = achados
    .filter((a) => podeVer(perm, usuario, a.doc.sensibilidade, a.doc.tags))
    .slice(0, 3)
    .map((a) => a.doc);

  // Nó em foco: a ficha + a memória ligada ao nó entram SEMPRE no contexto da pergunta.
  const docsFoco = focoNo
    ? memoria.filter((d) => (focoNo.memoria ?? []).includes(d.id) &&
        !contexto.some((c) => c.id === d.id) &&
        podeVer(perm, usuario, d.sensibilidade, d.tags))
    : [];

  // Pensamento de gerente (1): seguir as REFERÊNCIAS dos docs do contexto (frontmatter
  // `relacionados:` + [[wikilinks]]) — 1 salto, com permissão. Um gerente puxa o doc citado;
  // a Mind não responde "consulte o sla-rsvp" tendo o sla-rsvp na estante.
  const base = [...docsFoco, ...contexto];
  const jaIncluido = new Set(base.map((d) => d.id));
  const docsRelacionados: DocMemoria[] = [];
  for (const d of base) {
    for (const refId of d.relacionados) {
      if (jaIncluido.has(refId) || docsRelacionados.length >= 3) continue;
      const ref = memoria.find((x) => x.id === refId);
      if (ref && podeVer(perm, usuario, ref.sensibilidade, ref.tags)) {
        jaIncluido.add(ref.id);
        docsRelacionados.push(ref);
      }
    }
  }

  // Pensamento de gerente (2): pergunta de ENCAMINHAMENTO traz o que o grafo sabe de
  // gestão (trilha de escalonamento + papéis do domínio) — determinístico, custo zero.
  let trilha = "";
  if (pedeEncaminhamento(input.texto)) {
    const grafo = grafoFoco ?? carregarGrafo(raiz);
    const dominio = focoNo?.dominio ?? focoNo?.id ?? base[0]?.dominio ?? contexto[0]?.dominio;
    if (dominio) trilha = trilhaDeGestao(grafo, dominio);
  }

  const ficha = focoNo && grafoFoco ? fichaDoNo(grafoFoco, focoNo) : "";
  const blocoContexto =
    (ficha ? `### Nó em foco (grafo — fonte da verdade)\n${ficha}\n\n` : "") +
    (trilha ? `### Conhecimento de gestão (grafo)\n${trilha}\n\n` : "") +
    [...base, ...docsRelacionados].map((d) => `### ${d.titulo} (${d.id})\n${d.corpo}`).join("\n\n");
  const idsContexto = [
    ...(focoNo ? [focoNo.id] : []),
    ...docsFoco.map((d) => d.id),
    ...contexto.map((d) => d.id),
    ...docsRelacionados.map((d) => d.id),
  ];

  // Fala: tenta o gateway; se não houver, modo offline (prova recuperação + permissão)
  // O controle de acesso é determinístico e já aconteceu acima — o LLM não deve recusar por confidencialidade.
  const viaGateway = await chamarGateway(
    SYSTEM_PROMPT,
    `Pergunta de ${usuario.id} (nível de acesso: ${usuario.nivel})` +
      (focoNo ? ` — com o nó "${focoNo.titulo}" em foco no painel` : "") +
      `: ${input.texto}\n\n` +
      `A Mind já verificou as permissões: este usuário PODE ver todos os documentos do contexto abaixo. ` +
      `Responda a pergunta normalmente, sem recusar por sensibilidade ou confidencialidade.\n\n` +
      `Contexto da memória:\n${blocoContexto}`,
    modeloParaNivel(usuario.nivel)
  );

  if (viaGateway) {
    const sensFoco = focoNo ? SENS.indexOf(focoNo.sensibilidade) : 0;
    const sensMax = Math.max(sensFoco, SENS.indexOf(maxSensibilidade([...docsFoco, ...contexto])));
    capturarNoIngestor(usuario.id, input.texto, viaGateway, idsContexto, SENS[sensMax] as Sensibilidade);
    return {
      usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
      contexto: idsContexto, modo: "gateway", resposta: viaGateway,
    };
  }

  const melhorDoc = contexto[0] ?? docsFoco[0];
  const resposta =
    (melhorDoc
      ? `[offline] Encontrei na memória: "${melhorDoc.titulo}". ${melhorDoc.corpo.split("\n").find((l) => l.trim().length > 0) ?? ""}`
      : `[offline] ${ficha}`) +
    (docsRelacionados.length ? `\nRelacionados puxados: ${docsRelacionados.map((d) => d.id).join(", ")}` : "") +
    (trilha ? `\n${trilha}` : "");
  return {
    usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
    contexto: idsContexto, modo: "offline", resposta,
  };
}
