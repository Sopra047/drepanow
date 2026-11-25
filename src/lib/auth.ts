import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { UserRole } from "@/types/record";

const COOKIE = "drp-session";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || "dev-secret-change-me");

export interface Session {
  email: string;
  role: Extract<UserRole, "admin" | "sante">;
}

/** Signe une session valable 8h pour un compte staff (admin|sante). */
export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());
}

async function verify(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.role !== "admin" && payload.role !== "sante") return null;
    return { email: String(payload.email), role: payload.role };
  } catch {
    return null;
  }
}

/** Rôle effectif de la requête courante. Par défaut "lecteur" (visiteur public,
 * aucune connexion requise) tant qu'aucune session staff valide n'est présente. */
export async function getRole(): Promise<UserRole> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return "lecteur";
  const session = await verify(token);
  return session?.role ?? "lecteur";
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return verify(token);
}

export const SESSION_COOKIE = COOKIE;
export const SESSION_MAX_AGE = 8 * 60 * 60;
