import { NextResponse } from "next/server";
import { cookieDeLogout } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const r = NextResponse.json({ ok: true });
  r.headers.set("set-cookie", cookieDeLogout());
  return r;
}
