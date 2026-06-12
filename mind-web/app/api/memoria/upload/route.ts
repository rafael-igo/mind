import { NextResponse } from "next/server";
import { carregarMemoria, carregarPermissoes, resolverDadosRaiz } from "@/lib/core";
import { importarArquivo } from "@/lib/memoria-editor";
import { indexarMemoria } from "@/lib/memoria-vetorial";
import { usuarioDaRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Upload de arquivo (.md/.txt/.html) → _inbox (pré-memória) para curadoria. */
export async function POST(req: Request) {
  const raiz = resolverDadosRaiz();
  const id = usuarioDaRequest(req);
  const usuario = carregarPermissoes(raiz).usuarios.find((u) => u.id === id);
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  try {
    const form = await req.formData();
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File)) return NextResponse.json({ erro: "envie o campo 'arquivo'" }, { status: 400 });
    if (arquivo.size > 2_000_000) return NextResponse.json({ erro: "arquivo acima de 2MB" }, { status: 400 });
    const r = importarArquivo(raiz, arquivo.name, await arquivo.text(), usuario.id);
    indexarMemoria(carregarMemoria(raiz)).catch(() => {});
    return NextResponse.json({ ok: true, ...r, comunidade: "_inbox" });
  } catch (e) {
    return NextResponse.json({ erro: String(e instanceof Error ? e.message : e) }, { status: 400 });
  }
}
