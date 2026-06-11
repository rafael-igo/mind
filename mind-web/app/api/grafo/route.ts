import { NextResponse } from "next/server";
import { carregarGrafo } from "@/lib/core";
import { gerarMermaid } from "@/lib/projecao";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const g = carregarGrafo();
    // O JSON é a fonte da verdade; o Mermaid vai junto como projeção pronta para render.
    return NextResponse.json({ ...g, mermaid: gerarMermaid(g) });
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}
