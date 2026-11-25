import type { DataType, Filters, Period } from "@/types/record";

export function parseFilters(sp: URLSearchParams): Filters {
  const type = sp.get("type");
  const period = sp.get("period");
  const locs = sp.get("locs");
  const sel = sp.get("sel");
  return {
    type: (type === "SS" || type === "AS" ? type : "both") as DataType,
    period: (["2026", "90", "30"].includes(period ?? "") ? period : "all") as Period,
    locs: locs ? new Set(locs.split(",").filter(Boolean)) : null,
    sel: sel || null,
  };
}
