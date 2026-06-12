import { NextResponse } from "next/server";
import { carregarGrafo, carregarMemoria, carregarPermissoes, rankDe } from "@/lib/core";
import { cascataTransitiva } from "@/lib/motor-cognitivo";
import { usuarioDaRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = usuarioDaRequest(req);
    if (!id) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    const g = carregarGrafo();
    const no = g.nos.find((n) => n.id === params.id);
    if (!no) return NextResponse.json({ erro: "nó não encontrado" }, { status: 404 });
    // sensibilidade do nó vale no card: operador não abre nó restrito
    const perm = carregarPermissoes();
    const usuario = perm.usuarios.find((u) => u.id === id);
    const rank = usuario ? rankDe(perm, usuario.nivel) : 0;
    if (rank < (perm.sensibilidadeParaRankMinimo[no.sensibilidade] ?? 0)) {
      return NextResponse.json({ erro: "seu nível de acesso não permite consultar este nó" }, { status: 403 });
    }
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
