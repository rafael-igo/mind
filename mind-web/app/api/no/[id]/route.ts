import { NextResponse } from "next/server";
import { carregarGrafo, carregarMemoria } from "@/lib/core";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const g = carregarGrafo();
    const no = g.nos.find((n) => n.id === params.id);
    if (!no) return NextResponse.json({ erro: "nó não encontrado" }, { status: 404 });
    const arestas = g.arestas.filter((a) => a.de === no.id || a.para === no.id);
    // Documentos de memória ligados ao nó (campo `memoria` do nó ou campo `nos` do doc)
    const docs = carregarMemoria()
      .filter((d) => (no.memoria ?? []).includes(d.id))
      .map((d) => ({ id: d.id, titulo: d.titulo, comunidade: d.comunidade, sensibilidade: d.sensibilidade }));
    return NextResponse.json({ no, arestas, memoria: docs });
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}
