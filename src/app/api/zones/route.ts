import { NextRequest, NextResponse } from "next/server";
import { getDataset } from "@/lib/data";
import { parseFilters } from "@/lib/filters";
import { applyFilters, stats, zones } from "@/lib/zones";
import { loadGeoCache } from "@/lib/geoCache";

/** Agrégats par quartier (carte, KPI, graphiques) — jamais de données nominatives.
 * Accessible sans connexion : la consultation est publique. */
export async function GET(req: NextRequest) {
  const filters = parseFilters(req.nextUrl.searchParams);
  const [ds, geocoded] = await Promise.all([getDataset(), loadGeoCache()]);
  const filtered = applyFilters(ds.recs, filters);

  return NextResponse.json({
    source: {
      src: ds.src,
      sources: ds.sources,
      rows: ds.rows,
      exploitable: ds.recs.length,
      inferred: ds.inferred,
      lastDate: ds.lastDate,
      hospitals: [...new Set(ds.recs.map((r) => r.hopital).filter(Boolean))],
    },
    stats: stats(filtered, filters.type),
    zones: zones(filtered, filters.type, geocoded),
    localites: Object.entries(
      ds.recs.reduce<Record<string, number>>((m, r) => {
        m[r.localite] = (m[r.localite] || 0) + 1;
        return m;
      }, {})
    ).sort((a, b) => b[1] - a[1]),
  });
}
