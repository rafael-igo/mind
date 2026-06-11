import { NextResponse } from "next/server";
import { carregarGrafo } from "@/lib/core";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(carregarGrafo());
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}
