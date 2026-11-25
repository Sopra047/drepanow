import { zonePosition } from "@/lib/geo";
import type { DataType, Filters, PatientRecord, PriorityLevel, Zone } from "@/types/record";

export const LVL: Record<PriorityLevel, { t: string; c: string }> = {
  hi: { t: "Priorité forte", c: "var(--hi)" },
  md: { t: "Priorité moyenne", c: "var(--md)" },
  lo: { t: "Priorité faible", c: "var(--lo)" },
};

export function defaultFilters(): Filters {
  return { type: "both", period: "all", locs: null, sel: null };
}

export function applyFilters(recs: PatientRecord[], f: Filters): PatientRecord[] {
  const maxD = recs.reduce<Date>(
    (m, r) => (r.dateTest && r.dateTest > m ? r.dateTest : m),
    new Date(0)
  );
  return recs.filter((r) => {
    if (f.locs && !f.locs.has(r.localite)) return false;
    if (f.period !== "all") {
      if (!r.dateTest) return false;
      if (f.period === "2026" && r.dateTest.getUTCFullYear() !== 2026) return false;
      if ((f.period === "90" || f.period === "30") && (+maxD - +r.dateTest) / 864e5 > +f.period)
        return false;
    }
    return true;
  });
}

const pos = (r: PatientRecord) => r.geno === "SS" || r.geno === "AS";
export const typeOk = (r: PatientRecord, type: DataType) =>
  type === "both" ? pos(r) : r.geno === type;

/** Agrège les fiches par quartier et calcule le score / niveau de priorité.
 * Les deux : score = 3×S/S + A/S (forte ≥ 6, moyenne 3–5, faible < 3).
 * S/S seul : score = 3×S/S (mêmes seuils). A/S seul : score = A/S (forte ≥ 3, moyenne 2, faible 1). */
export function zones(
  recs: PatientRecord[],
  type: DataType = "both",
  geocoded?: Record<string, [number, number]>
): Zone[] {
  const m: Record<string, Zone> = {};
  recs.forEach((r) => {
    const k = r.localite + "|" + r.quartier;
    const z =
      m[k] ||
      (m[k] = {
        k,
        name: r.quartier,
        localite: r.localite,
        ss: 0,
        as: 0,
        n: 0,
        recs: [],
        ll: [0, 0],
        score: 0,
        lvl: "lo",
      });
    z.n++;
    z.recs.push(r);
    if (r.geno === "SS") z.ss++;
    if (r.geno === "AS") z.as++;
  });
  return Object.values(m)
    .map((z) => {
      z.ll = zonePosition(z.name, z.localite, geocoded);
      z.score = type === "SS" ? z.ss * 3 : type === "AS" ? z.as : z.ss * 3 + z.as;
      z.lvl =
        type === "AS"
          ? z.as >= 3
            ? "hi"
            : z.as >= 2
              ? "md"
              : "lo"
          : z.score >= 6
            ? "hi"
            : z.score >= 3
              ? "md"
              : "lo";
      return z;
    })
    .filter((z) => z.score > 0)
    .sort((a, b) => b.score - a.score || b.ss - a.ss || a.name.localeCompare(b.name));
}

function median(a: number[]): number | null {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface Stats {
  n: number;
  ss: number;
  as: number;
  hot: number;
  zones: number;
  sympSS: number;
  medSS: number | null;
}

export function stats(recs: PatientRecord[], type: DataType = "both"): Stats {
  const ss = recs.filter((r) => r.geno === "SS");
  const as = recs.filter((r) => r.geno === "AS");
  const zs = zones(recs, type);
  return {
    n: recs.length,
    ss: ss.length,
    as: as.length,
    hot: zs.filter((z) => z.lvl === "hi").length,
    zones: zs.length,
    sympSS: ss.length ? Math.round((ss.filter((r) => r.symp === "Oui").length / ss.length) * 100) : 0,
    medSS: median(ss.map((r) => r.age).filter((a): a is number => a != null)),
  };
}
