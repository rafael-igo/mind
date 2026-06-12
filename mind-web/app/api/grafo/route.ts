import { NextResponse } from "next/server";
import { carregarGrafo, carregarPermissoes, grafoVisivel } from "@/lib/core";
import { gerarMermaid } from "@/lib/projecao";
import { usuarioDaRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const id = usuarioDaRequest(req);
    if (!id) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    const perm = carregarPermissoes();
    const usuario = perm.usuarios.find((u) => u.id === id);
    if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    // Cada nível vê o SEU grafo: nós acima do rank somem da projeção (e do Mermaid).
    const g = grafoVisivel(carregarGrafo(), perm, usuario);
    return NextResponse.json({ ...g, mermaid: gerarMermaid(g) });
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}
