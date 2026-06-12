import { NextResponse } from "next/server";
import { carregarMemoria, carregarPermissoes, podeVer, rankDe, resolverDadosRaiz } from "@/lib/core";
import { acharDoc, editarDoc, ehDaMind, mandarParaLixeira, RANK_MINIMO_CURADORIA } from "@/lib/memoria-editor";
import { indexarMemoria } from "@/lib/memoria-vetorial";
import { usuarioDaRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

function sessao(req: Request) {
  const raiz = resolverDadosRaiz();
  const perm = carregarPermissoes(raiz);
  const id = usuarioDaRequest(req);
  const usuario = perm.usuarios.find((u) => u.id === id) ?? null;
  return { raiz, perm, usuario, rank: usuario ? rankDe(perm, usuario.nivel) : 0 };
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { raiz, perm, usuario, rank } = sessao(req);
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  const doc = acharDoc(raiz, params.id);
  if (!doc) return NextResponse.json({ erro: "doc não encontrado" }, { status: 404 });
  // _inbox é pré-memória: só curador enxerga; o resto segue podeVer
  if (doc.comunidade === "_inbox" && rank < RANK_MINIMO_CURADORIA)
    return NextResponse.json({ erro: "sem acesso" }, { status: 403 });
  if (doc.comunidade !== "_inbox" && !podeVer(perm, usuario, doc.sensibilidade, doc.tags))
    return NextResponse.json({ erro: "seu nível de acesso não permite consultar este documento" }, { status: 403 });
  return NextResponse.json({ ...doc, editavel: ehDaMind(doc.arquivo, raiz) });
}

/** Edição (RAG): só diretor+ e só docs da Mind. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { raiz, usuario, rank } = sessao(req);
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  if (rank < RANK_MINIMO_CURADORIA)
    return NextResponse.json({ erro: "editar a memória exige nível diretor ou acima" }, { status: 403 });
  try {
    const b = await req.json();
    const doc = editarDoc(raiz, params.id, {
      titulo: b?.titulo, corpo: b?.corpo, sensibilidade: b?.sensibilidade,
      tags: Array.isArray(b?.tags) ? b.tags : undefined,
    });
    indexarMemoria(carregarMemoria(raiz)).catch(() => {});
    return NextResponse.json({ ok: true, id: doc.id });
  } catch (e) {
    return NextResponse.json({ erro: String(e instanceof Error ? e.message : e) }, { status: 400 });
  }
}

/** "Excluir" = lixeira (memoria/_lixeira/) — nada se perde de verdade. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { raiz, usuario, rank } = sessao(req);
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  if (rank < RANK_MINIMO_CURADORIA)
    return NextResponse.json({ erro: "excluir da memória exige nível diretor ou acima" }, { status: 403 });
  try {
    const destino = mandarParaLixeira(raiz, params.id);
    indexarMemoria(carregarMemoria(raiz)).catch(() => {});
    return NextResponse.json({ ok: true, lixeira: destino });
  } catch (e) {
    return NextResponse.json({ erro: String(e instanceof Error ? e.message : e) }, { status: 400 });
  }
}
