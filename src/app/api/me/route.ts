import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/** Rôle effectif de la requête courante. Toujours 200 : un visiteur sans session
 * est un consultation publique valide (rôle "lecteur"), pas une erreur. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ role: "lecteur" as const });
  return NextResponse.json({ role: session.role, email: session.email });
}
