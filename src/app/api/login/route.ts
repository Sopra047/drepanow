import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({ email: "", password: "" }));
  if (!email || !password) {
    return NextResponse.json({ error: "Identifiant et mot de passe requis." }, { status: 400 });
  }

  const user = await prisma.staffUser.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "Identifiants invalides." }, { status: 401 });
  }

  const role = user.role === "admin" ? "admin" : "sante";
  const token = await createSessionToken({ email: user.email, role });

  const res = NextResponse.json({ email: user.email, role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return res;
}
