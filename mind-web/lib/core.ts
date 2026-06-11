/**
 * Núcleo da Mind (framework-agnóstico).
 * Carrega o grafo (fonte da verdade), a memória (markdown) e as permissões,
 * e implementa o fluxo Escuta -> Orquestrador -> Fala (Fase 1).
 */
import fs from "node:fs";
import path from "node:path";
import { calcularSla, resumirSla, type Pendencia } from "./motor-sla.ts";
import { montarProposta } from "./motor-cognitivo.ts";
import { criarProposta, decidirProposta, RANK_MINIMO_APROVACAO } from "./freio.ts";

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
  modo: "gateway" | "offline" | "negado" | "sem-memoria" | "motor-sla" | "freio-proposta" | "freio-decisao";
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
function parseFrontmatter(texto: string): { meta: Record<string, string>; corpo: string } {
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
        docs.push({
          id,
          titulo: meta.titulo || f,
          tipo: meta.tipo || meta.categoria || "conceito",
          comunidade: meta.comunidade || com.nome,
          sensibilidade: normalizarSensibilidade(meta.sensibilidade),
          tags: parseLista(meta.tags),
          corpo,
          arquivo: path.join(com.dir, f),
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
  const usuariosRaw = JSON.parse(fs.readFileSync(path.join(dir, "usuarios.exemplo.json"), "utf8"));
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
    let score = 0;
    for (const t of termos) {
      if (normalizar(doc.titulo).includes(t)) score += 5;
      else if (alvo.includes(t)) score += 1;
    }
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

// --------------------------- Orquestrador ---------------------------

const SYSTEM_PROMPT =
  "Você é a Mind, o cérebro digital da empresa. Responda com base APENAS no contexto fornecido " +
  "(memória curada). Se o contexto não responder, diga que não há registro. Seja direto e em PT-BR.";

export interface PerguntaInput {
  usuario: string;
  texto: string;
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
      } as const;
      return {
        usuario: usuario.id, nivel: usuario.nivel, rank,
        permitido: r.erro !== "rank-insuficiente",
        contexto: [cmdFreio.id], modo: "freio-decisao", resposta: msgs[r.erro!],
      };
    }
    const p = r.proposta!;
    const resposta = p.status === "aprovada"
      ? `Proposta ${p.id} APROVADA por ${p.decididaPor}. Decisão consolidada na memória (decisao-${p.id}).`
      : `Proposta ${p.id} rejeitada por ${p.decididaPor}. Nada foi alterado.`;
    return {
      usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
      contexto: [p.id], modo: "freio-decisao", resposta,
    };
  }

  // Fase 2 — motor determinístico: a LLM (ou o roteador) decide QUEM responde; o código calcula.
  if (pedeMotorSla(input.texto)) {
    const resultados = calcularSla(carregarPendencias(raiz));
    return {
      usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
      contexto: ["motor-sla"], modo: "motor-sla",
      resposta: resumirSla(resultados),
    };
  }

  // Fase 3 — pedido de mudança: motor cognitivo raciocina a cascata e a proposta PARA no freio.
  if (pedeMudanca(input.texto)) {
    const grafo = carregarGrafo(raiz);
    const rascunho = await montarProposta({
      pedido: input.texto,
      autor: usuario.id,
      nivel: usuario.nivel,
      grafo,
      memoria: memoria.filter((d) => podeVer(perm, usuario, d.sensibilidade, d.tags)),
      buscarDocs: buscar,
      chamarLlm: (sistema, texto) => chamarGateway(sistema, texto, modeloParaNivel(usuario.nivel)),
    });
    const proposta = criarProposta(raiz, rascunho);
    const resposta =
      `🧠 Proposta ${proposta.id} criada e PARADA NO FREIO (nada foi alterado).\n\n` +
      `Nó-alvo: ${proposta.tituloAlvo} (${proposta.noAlvo})\n` +
      `Cascata: ${proposta.cascata.length ? proposta.cascata.map((c) => c.titulo).join(", ") : "nenhuma"}\n\n` +
      `${proposta.propostaTexto}\n\nPerguntas em aberto:\n` +
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
  if (achados.length === 0) {
    return {
      usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
      contexto: [], modo: "sem-memoria",
      resposta: "Não encontrei nada na memória sobre isso ainda.",
    };
  }

  // Permissão determinística: se o MELHOR match é bloqueado, nega (não cai num doc fraco visível)
  const topo = achados[0];
  if (!podeVer(perm, usuario, topo.doc.sensibilidade, topo.doc.tags)) {
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
  const blocoContexto = contexto
    .map((d) => `### ${d.titulo} (${d.id})\n${d.corpo}`)
    .join("\n\n");

  // Fala: tenta o gateway; se não houver, modo offline (prova recuperação + permissão)
  // O controle de acesso é determinístico e já aconteceu acima — o LLM não deve recusar por confidencialidade.
  const viaGateway = await chamarGateway(
    SYSTEM_PROMPT,
    `Pergunta de ${usuario.id} (nível de acesso: ${usuario.nivel}): ${input.texto}\n\n` +
      `A Mind já verificou as permissões: este usuário PODE ver todos os documentos do contexto abaixo. ` +
      `Responda a pergunta normalmente, sem recusar por sensibilidade ou confidencialidade.\n\n` +
      `Contexto da memória:\n${blocoContexto}`,
    modeloParaNivel(usuario.nivel)
  );

  if (viaGateway) {
    return {
      usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
      contexto: contexto.map((d) => d.id), modo: "gateway", resposta: viaGateway,
    };
  }

  const primeiraLinha = contexto[0].corpo.split("\n").find((l) => l.trim().length > 0) ?? "";
  return {
    usuario: usuario.id, nivel: usuario.nivel, rank, permitido: true,
    contexto: contexto.map((d) => d.id), modo: "offline",
    resposta: `[offline] Encontrei na memória: "${contexto[0].titulo}". ${primeiraLinha}`,
  };
}
