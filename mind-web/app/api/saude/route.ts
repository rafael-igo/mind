import { NextResponse } from "next/server";
import { saudeVetorial } from "@/lib/memoria-vetorial";

export const dynamic = "force-dynamic";

/** Monitor do painel: gateway LLM, Ollama (liga sob demanda) e memória vetorial. */
export async function GET() {
  const [vetorial, gateway] = await Promise.all([
    saudeVetorial(),
    (async () => {
      const base = process.env.MIND_LLM_BASE_URL;
      if (!base) return false;
      try {
        const r = await fetch(`${base.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(1500) });
        return r.ok;
      } catch {
        return false;
      }
    })(),
  ]);
  return NextResponse.json({ gateway, ollama: vetorial.ollama, vetorial: { banco: vetorial.banco, chunks: vetorial.chunks } });
}
