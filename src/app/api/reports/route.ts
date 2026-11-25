import { NextRequest, NextResponse } from "next/server";
import { getRole, getSession } from "@/lib/auth";
import { getDataset } from "@/lib/data";
import { parseFilters } from "@/lib/filters";
import { buildAiContext, generateReport, REPORT_TYPES } from "@/lib/ai";
import { prisma } from "@/lib/db";

/** Génération de rapport — réservée au personnel (admin|sante), jamais au
 * visiteur public. Gating fait ici côté serveur, pas seulement dans l'UI.
 * Contenu généré localement à partir des données (pas d'appel IA externe). */
export async function POST(req: NextRequest) {
  const role = await getRole();
  if (role === "lecteur") {
    return NextResponse.json({ error: "Connexion requise pour générer un rapport." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const typeId = body?.type as string;
  const scopeKey = body?.scope as string | undefined;
  const kits = body?.kits as string | undefined;
  const filtersRaw = body?.filters ?? {};

  if (!REPORT_TYPES.some((r) => r.id === typeId)) {
    return NextResponse.json({ error: "Type de rapport invalide." }, { status: 400 });
  }

  const filters = parseFilters(new URLSearchParams(filtersRaw));
  const ds = await getDataset();
  const ctx = buildAiContext(ds, filters);
  const scope = scopeKey
    ? ctx.quartiers.find((z) => `${z.localite}|${z.quartier}` === scopeKey)
    : null;
  const scopeLabel = scope ? `le quartier ${scope.quartier} (${scope.localite})` : "le district de santé de Foumban";

  const content = generateReport(typeId as "action" | "sensib" | "kits", ctx, scopeLabel, scope ?? null, kits);

  const session = await getSession();
  await prisma.generatedReport.create({
    data: {
      type: typeId,
      scope: scopeLabel,
      content,
      filters: JSON.stringify(filtersRaw),
      authorEmail: session?.email ?? null,
    },
  });

  return NextResponse.json({ type: typeId, scope: scopeLabel, content, totals: ctx.totaux, topZones: ctx.quartiers.slice(0, 5) });
}
