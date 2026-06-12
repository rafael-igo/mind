import { NextResponse } from "next/server";
import { carregarMemoria, carregarPermissoes, rankDe, resolverDadosRaiz } from "@/lib/core";
import { aprovarDoInbox, RANK_MINIMO_CURADORIA } from "@/lib/memoria-editor";
import { indexarMemoria } from "@/lib/memoria-vetorial";
import { usuarioDaRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Curadoria: aprova um doc do _inbox para recente|profunda (diretor+). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const raiz = resolverDadosRaiz();
  const perm = carregarPermissoes(raiz);
  const id = usuarioDaRequest(req);
  const usuario = perm.usuarios.find((u) => u.id === id);
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  if (rankDe(perm, usuario.nivel) < RANK_MINIMO_CURADORIA)
    return NextResponse.json({ erro: "aprovar memória exige nível diretor ou acima" }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({}));
    const destino = b?.destino === "profunda" ? "profunda" : "recente";
    const r = aprovarDoInbox(raiz, params.id, destino);
    indexarMemoria(carregarMemoria(raiz)).catch(() => {});
    return NextResponse.json({ ok: true, ...r, destino });
  } catch (e) {
    return NextResponse.json({ erro: String(e instanceof Error ? e.message : e) }, { status: 400 });
  }
}
