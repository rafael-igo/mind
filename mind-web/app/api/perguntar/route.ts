import { NextResponse } from "next/server";
import { orquestrar } from "@/lib/core";
import { usuarioDaRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // Identidade vem da SESSÃO (cookie assinado) — nunca do corpo: ninguém "se declara" rafael.
    const usuario = usuarioDaRequest(req);
    if (!usuario) return NextResponse.json({ erro: "faça login para falar com a Mind" }, { status: 401 });
    const body = await req.json();
    const texto = String(body?.texto ?? "").trim();
    if (!texto) {
      return NextResponse.json({ erro: "informe 'texto'" }, { status: 400 });
    }
    const r = await orquestrar({ usuario, texto });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}
