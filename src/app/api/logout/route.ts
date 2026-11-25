import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/** Retour à la consultation publique (rôle "lecteur") — pas d'écran bloquant. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
