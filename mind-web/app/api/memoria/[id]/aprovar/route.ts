import { NextResponse } from "next/server";
import { carregarMemoria, carregarPermissoes, rankDe, resolverDadosRaiz } from "@/lib/core";
import { aprovarDoInbox, consolidarParaProfunda, listarInbox, RANK_MINIMO_CURADORIA } from "@/lib/memoria-editor";
import { indexarMemoria } from "@/lib/memoria-vetorial";
import { usuarioDaRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Curadoria (diretor+), as duas portas do ciclo do conhecimento:
 * - doc no _inbox  → aprova para recente (homologação) ou direto para profunda;
 * - doc na recente → CONSOLIDA para profunda (vira conhecimento).
 */
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
    const noInbox = listarInbox(raiz).some((d) => d.id === params.id);
    const r = noInbox
      ? aprovarDoInbox(raiz, params.id, destino)
      : consolidarParaProfunda(raiz, params.id);
    indexarMemoria(carregarMemoria(raiz)).catch(() => {});
    return NextResponse.json({ ok: true, ...r, destino: noInbox ? destino : "profunda" });
  } catch (e) {
    return NextResponse.json({ erro: String(e instanceof Error ? e.message : e) }, { status: 400 });
  }
}
