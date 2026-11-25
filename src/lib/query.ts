import type { Filters } from "@/types/record";

/** Sérialise les filtres client en objet de query string, réutilisé par les appels
 * `/api/zones`, `/api/records` (GET) et `/api/ai`, `/api/reports` (POST, champ `filters`). */
export function filtersToQuery(f: Filters): Record<string, string> {
  const q: Record<string, string> = {};
  if (f.type !== "both") q.type = f.type;
  if (f.period !== "all") q.period = f.period;
  if (f.locs) q.locs = [...f.locs].join(",");
  if (f.sel) q.sel = f.sel;
  return q;
}
