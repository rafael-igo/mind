import { NextResponse } from "next/server";
import { carregarMemoria, carregarPermissoes, podeVer, rankDe, resolverDadosRaiz } from "@/lib/core";
import { criarDoc, ehDaMind, listarInbox, RANK_MINIMO_CURADORIA } from "@/lib/memoria-editor";
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

/** Lista a memória visível ao usuário; diretor+ vê também o _inbox (curadoria). */
export async function GET(req: Request) {
  const { raiz, perm, usuario, rank } = sessao(req);
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  const docs = carregarMemoria(raiz)
    .filter((d) => podeVer(perm, usuario, d.sensibilidade, d.tags))
    .map((d) => ({
      id: d.id, titulo: d.titulo, tipo: d.tipo, comunidade: d.comunidade,
      sensibilidade: d.sensibilidade, tags: d.tags, tamanho: d.corpo.length,
      editavel: ehDaMind(d.arquivo, raiz),
    }));
  const inbox = rank >= RANK_MINIMO_CURADORIA
    ? listarInbox(raiz).map((d) => ({
        id: d.id, titulo: d.titulo, tipo: d.tipo, comunidade: "_inbox",
        sensibilidade: d.sensibilidade, tags: d.tags, tamanho: d.corpo.length, editavel: true,
      }))
    : [];
  return NextResponse.json({ docs, inbox, curador: rank >= RANK_MINIMO_CURADORIA });
}

/** Cria doc. Abaixo de diretor, TUDO entra no _inbox (pré-memória) para curadoria. */
export async function POST(req: Request) {
  const { raiz, usuario, rank } = sessao(req);
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  try {
    const b = await req.json();
    const curador = rank >= RANK_MINIMO_CURADORIA;
    const r = criarDoc(raiz, {
      titulo: String(b?.titulo ?? ""),
      corpo: String(b?.corpo ?? ""),
      comunidade: curador && ["profunda", "recente", "_inbox"].includes(b?.comunidade) ? b.comunidade : "_inbox",
      sensibilidade: curador && b?.sensibilidade ? b.sensibilidade : "interno",
      tags: Array.isArray(b?.tags) ? b.tags : [],
      fonte: `painel: ${usuario.id}`,
    });
    indexarMemoria(carregarMemoria(raiz)).catch(() => {});
    return NextResponse.json({ ...r, comunidade: curador ? (b?.comunidade ?? "_inbox") : "_inbox" });
  } catch (e) {
    return NextResponse.json({ erro: String(e instanceof Error ? e.message : e) }, { status: 400 });
  }
}
