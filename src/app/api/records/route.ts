import { NextRequest, NextResponse } from "next/server";
import { getDataset } from "@/lib/data";
import { parseFilters } from "@/lib/filters";
import { applyFilters } from "@/lib/zones";

/** Registre anonymisé filtré (tableau de la vue centrale). Public : aucune colonne
 * nominative n'est jamais stockée ni renvoyée (cf. normalize.ts — minimisation). */
export async function GET(req: NextRequest) {
  const filters = parseFilters(req.nextUrl.searchParams);
  const q = req.nextUrl.searchParams.get("q")?.toLowerCase() ?? "";
  const ds = await getDataset();
  let recs = applyFilters(ds.recs, filters);
  if (q) {
    recs = recs.filter((r) =>
      `${r.quartier} ${r.code} ${r.localite} ${r.geno}`.toLowerCase().includes(q)
    );
  }
  return NextResponse.json({ records: recs });
}
