import { NextResponse } from "next/server";
import { orquestrar } from "@/lib/core";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const usuario = String(body?.usuario ?? "").trim();
    const texto = String(body?.texto ?? "").trim();
    if (!usuario || !texto) {
      return NextResponse.json({ erro: "informe 'usuario' e 'texto'" }, { status: 400 });
    }
    const r = await orquestrar({ usuario, texto });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}
