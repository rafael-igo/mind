import { NextResponse } from "next/server";
import { carregarGrafo, carregarMemoria, carregarPermissoes, grafoVisivel, podeVer } from "@/lib/core";
import { cascataTransitiva } from "@/lib/motor-cognitivo";
import { usuarioDaRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = usuarioDaRequest(req);
    if (!id) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    const perm = carregarPermissoes();
    const usuario = perm.usuarios.find((u) => u.id === id);
    if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    // TUDO neste card (nó, arestas, cascata) sai do grafo VISÍVEL ao usuário:
    // nó restrito não abre, nem aparece como vizinho/cascata de um nó permitido.
    const g = grafoVisivel(carregarGrafo(), perm, usuario);
    const no = g.nos.find((n) => n.id === params.id);
    if (!no) {
      const existe = carregarGrafo().nos.some((n) => n.id === params.id);
      return existe
        ? NextResponse.json({ erro: "seu nível de acesso não permite consultar este nó" }, { status: 403 })
        : NextResponse.json({ erro: "nó não encontrado" }, { status: 404 });
    }
    const arestas = g.arestas.filter((a) => a.de === no.id || a.para === no.id);
    // Memória ligada: só os docs que o usuário PODE ver (nem metadado de doc bloqueado sai)
    const docs = carregarMemoria()
      .filter((d) => (no.memoria ?? []).includes(d.id) && podeVer(perm, usuario, d.sensibilidade, d.tags))
      .map((d) => ({ id: d.id, titulo: d.titulo, comunidade: d.comunidade, sensibilidade: d.sensibilidade }));
    // Fase 6 — view cruzada: cascata transitiva (3 níveis) sobre o grafo visível
    const cascata = cascataTransitiva(g, no.id, 3);
    return NextResponse.json({ no, arestas, memoria: docs, cascata });
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}
