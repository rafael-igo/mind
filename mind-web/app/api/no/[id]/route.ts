import { NextResponse } from "next/server";
import { carregarGrafo } from "@/lib/core";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const g = carregarGrafo();
    const no = g.nos.find((n) => n.id === params.id);
    if (!no) return NextResponse.json({ erro: "nó não encontrado" }, { status: 404 });
    const arestas = g.arestas.filter((a) => a.de === no.id || a.para === no.id);
    return NextResponse.json({ no, arestas });
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}
