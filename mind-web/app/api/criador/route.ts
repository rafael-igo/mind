import { NextResponse } from "next/server";
import { carregarPermissoes, rankDe, resolverDadosRaiz } from "@/lib/core";
import { listarExploracoes, RANK_MINIMO_CRIADOR } from "@/lib/motor-criatividade";
import { listarPropostas } from "@/lib/freio";

export const dynamic = "force-dynamic";

/**
 * Área do Criador (Fase 5) — workspace do nível máximo: explorações criativas
 * abertas e propostas paradas no freio aguardando decisão. A checagem de nível
 * é server-side: o painel só esconde, quem barra é aqui.
 */
export async function GET(req: Request) {
  const raiz = resolverDadosRaiz();
  const perm = carregarPermissoes(raiz);
  const id = new URL(req.url).searchParams.get("usuario") ?? "";
  const usuario = perm.usuarios.find((u) => u.id === id);
  if (!usuario || rankDe(perm, usuario.nivel) < RANK_MINIMO_CRIADOR) {
    return NextResponse.json({ erro: "Área do Criador é exclusiva do nível máximo." }, { status: 403 });
  }
  return NextResponse.json({
    exploracoes: listarExploracoes(raiz, "aberta").map((e) => ({
      id: e.id, problema: e.problema, criadaEm: e.criadaEm, abordagens: e.abordagens.length,
    })),
    propostasPendentes: listarPropostas(raiz, "pendente").map((p) => ({
      id: p.id, pedido: p.pedido, autor: p.autor, criadaEm: p.criadaEm, noAlvo: p.tituloAlvo,
    })),
  });
}
