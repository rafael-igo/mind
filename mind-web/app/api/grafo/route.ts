import { NextResponse } from "next/server";
import { carregarGrafo } from "@/lib/core";
import { gerarMermaid } from "@/lib/projecao";
import { usuarioDaRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (!usuarioDaRequest(req)) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    const g = carregarGrafo();
    // O JSON é a fonte da verdade; o Mermaid vai junto como projeção pronta para render.
    return NextResponse.json({ ...g, mermaid: gerarMermaid(g) });
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}
