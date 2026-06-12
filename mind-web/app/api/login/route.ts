import { NextResponse } from "next/server";
import { carregarPermissoes } from "@/lib/core";
import { verificarSenha, criarToken, cookieDeSessao } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.usuario ?? "").trim();
    const senha = String(body?.senha ?? "");
    const usuario = carregarPermissoes().usuarios.find((u) => u.id === id);
    // mensagem única: não revela se o erro foi o usuário ou a senha
    if (!usuario || !verificarSenha(senha, usuario.senha_hash)) {
      return NextResponse.json({ erro: "Usuário ou senha inválidos." }, { status: 401 });
    }
    const r = NextResponse.json({ usuario: usuario.id, nome: usuario.nome, nivel: usuario.nivel });
    r.headers.set("set-cookie", cookieDeSessao(criarToken(usuario.id)));
    return r;
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}
