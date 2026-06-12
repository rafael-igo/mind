import { NextResponse } from "next/server";
import { carregarPermissoes } from "@/lib/core";
import { usuarioDaRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Quem sou eu (sessão atual). 401 sem sessão válida. */
export async function GET(req: Request) {
  const id = usuarioDaRequest(req);
  const usuario = id ? carregarPermissoes().usuarios.find((u) => u.id === id) : null;
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  return NextResponse.json({ usuario: usuario.id, nome: usuario.nome, nivel: usuario.nivel });
}
