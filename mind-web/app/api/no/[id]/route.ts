import { NextResponse } from "next/server";
import { carregarGrafo, carregarMemoria } from "@/lib/core";
import { cascataTransitiva } from "@/lib/motor-cognitivo";

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
    // Fase 6 — view cruzada: cascata transitiva (3 níveis) com marcação de cruzamento de domínio
    const cascata = cascataTransitiva(g, no.id, 3);
    return NextResponse.json({ no, arestas, memoria: docs, cascata });
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}
