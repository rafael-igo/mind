/**
 * Autenticação da Mind — sem dependências externas (node:crypto):
 * - senha: scrypt com salt ("scrypt:<salt>:<hash>"), comparação em tempo constante;
 * - sessão: token "payload.assinatura" (HMAC-SHA256) em cookie HTTP-only.
 * O segredo vem de MIND_AUTH_SEGREDO ou de operacao/.segredo-auth (gerado uma vez,
 * fora do Git) — assim a sessão sobrevive a restart sem configurar nada.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolverDadosRaiz } from "./core.ts";

export const COOKIE_SESSAO = "mind_sessao";

// ----------------------------- Senha -----------------------------

export function hashSenha(senha: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(senha, salt, 32).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verificarSenha(senha: string, guardado?: string): boolean {
  if (!guardado) return false; // usuário sem senha cadastrada não entra
  const [esquema, salt, hash] = guardado.split(":");
  if (esquema !== "scrypt" || !salt || !hash) return false;
  const calculado = crypto.scryptSync(senha, salt, 32);
  const esperado = Buffer.from(hash, "hex");
  return calculado.length === esperado.length && crypto.timingSafeEqual(calculado, esperado);
}

// ----------------------------- Segredo -----------------------------

let segredoCache: Buffer | null = null;

function segredo(): Buffer {
  if (segredoCache) return segredoCache;
  const env = process.env.MIND_AUTH_SEGREDO;
  if (env) return (segredoCache = Buffer.from(env, "utf8"));
  const arq = path.join(resolverDadosRaiz(), "operacao", ".segredo-auth");
  if (!fs.existsSync(arq)) {
    fs.mkdirSync(path.dirname(arq), { recursive: true });
    fs.writeFileSync(arq, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  return (segredoCache = Buffer.from(fs.readFileSync(arq, "utf8").trim(), "utf8"));
}

// ----------------------------- Token de sessão -----------------------------

function assinar(payload: string): string {
  return crypto.createHmac("sha256", segredo()).update(payload).digest("base64url");
}

export function criarToken(usuarioId: string, ttlHoras = 12): string {
  const payload = Buffer.from(
    JSON.stringify({ u: usuarioId, exp: Date.now() + ttlHoras * 3600_000 }),
    "utf8"
  ).toString("base64url");
  return `${payload}.${assinar(payload)}`;
}

/** Devolve o id do usuário se o token for válido e não expirado; senão null. */
export function verificarToken(token?: string | null): string | null {
  if (!token) return null;
  const [payload, assinatura] = token.split(".");
  if (!payload || !assinatura) return null;
  const esperada = assinar(payload);
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof u !== "string" || typeof exp !== "number" || Date.now() > exp) return null;
    return u;
  } catch {
    return null;
  }
}

// ----------------------------- Sessão a partir da Request -----------------------------

/** Extrai o usuário logado do cookie da request (APIs do Next). */
export function usuarioDaRequest(req: Request): string | null {
  const cookies = req.headers.get("cookie") ?? "";
  const m = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE_SESSAO}=([^;]+)`));
  return verificarToken(m?.[1] ?? null);
}

export function cookieDeSessao(token: string, ttlHoras = 12): string {
  return `${COOKIE_SESSAO}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttlHoras * 3600}`;
}

export function cookieDeLogout(): string {
  return `${COOKIE_SESSAO}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
