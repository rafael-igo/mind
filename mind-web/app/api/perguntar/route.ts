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
    const foco = body?.foco ? String(body.foco) : undefined;
    // Fase 7 — memória de sessão: últimas trocas (saneadas e limitadas) viajam com a pergunta
    const historico = Array.isArray(body?.historico)
      ? body.historico.slice(-8).map((h: any) => ({
          de: h?.de === "eu" ? "eu" as const : "mind" as const,
          texto: String(h?.texto ?? "").slice(0, 400),
        })).filter((h: any) => h.texto)
      : undefined;
    if (!texto) {
      return NextResponse.json({ erro: "informe 'texto'" }, { status: 400 });
    }
    const r = await orquestrar({ usuario, texto, foco, historico });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}
