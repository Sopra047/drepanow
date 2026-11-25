import type {
  FieldMapping,
  Genotype,
  IncompleteRow,
  NormalizedDataset,
  PatientRecord,
} from "@/types/record";
import { QPOS } from "@/lib/geo";

/** Colonnes nominatives à exclure systématiquement (minimisation des données). */
const PII = /^(nom|prenom|name|telephone|tel|adresse|cni)/;

const ALIASES: Array<[key: string, label: string, re: RegExp, req: boolean]> = [
  ["code", "Code patient", /^(id|code)|participant|patient/, true],
  ["dateTest", "Date du test", /date.*test|test.*date/, true],
  ["sexe", "Sexe", /^sexe|genre/, true],
  ["age", "Âge", /^age/, true],
  ["quartier", "Quartier", /quartier/, true],
  ["localite", "Localité / Village", /localit|ville|village/, true],
  ["geno", "Résultat génotype", /electro|genotype|resultat|statut/, true],
  ["symp", "Symptomatique", /sympt/, true],
  ["contexte", "Contexte clinique", /contexte/, false],
  ["hopital", "Hôpital de provenance", /hopital|provenance/, false],
  ["dateEnr", "Date d'enregistrement", /enregistr/, false],
  ["atcd", "Antécédents familiaux", /antec/, false],
];

export const strip = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

export const title = (v: unknown) => {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  return s ? s.replace(/(^|[\s-])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase()) : s;
};

const xlDate = (n: number) => new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 864e5);

function parseDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" || /^\d{4,6}(\.\d+)?$/.test(String(v))) return xlDate(+v);
  const m = String(v).match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) return new Date(Date.UTC(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]));
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function normGeno(v: unknown): Genotype | "" {
  const s = String(v ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (["AA", "AS", "SS", "SC"].includes(s)) return s as Genotype;
  return s ? "Autre" : "";
}

function normCtx(v: unknown): string {
  const s = strip(v);
  if (!s) return "Non renseigné";
  if (s.startsWith("bilan")) return "Bilan prénuptial";
  if (s.startsWith("hosp")) return "Hospitalisation";
  if (s.startsWith("parent")) return "Dépistage familial";
  if (s.startsWith("rout")) return "Routine";
  return title(v);
}

/**
 * Détecte les colonnes par alias, anonymise (exclusion des colonnes nominatives,
 * recodage des identifiants patients), normalise types/texte, et exclut les lignes
 * sans génotype ou quartier. Port fidèle de la logique validée dans le prototype
 * de design (reference/Cahier_des_Charges_Drepanow_AI.pdf, section 3.4).
 */
export function normalize(rows: unknown[][], srcName: string): NormalizedDataset {
  if (!rows.length) {
    return {
      src: srcName,
      rows: 0,
      recs: [],
      incomplete: [],
      mapping: [],
      pii: [],
      ignored: [],
      inferred: 0,
      unknownGeo: [],
      lastDate: null,
    };
  }

  const head = rows[0].map((h) => String(h ?? "").trim());
  const nh = head.map((h) => strip(h));
  const idx: Record<string, number> = {};
  const mapping: FieldMapping[] = [];
  const used = new Set<number>();

  for (const [k, label, re, req] of ALIASES) {
    const i = nh.findIndex((h, j) => !used.has(j) && re.test(h));
    if (i >= 0) {
      idx[k] = i;
      used.add(i);
    }
    mapping.push({ k, label, req, src: i >= 0 ? head[i] : null });
  }

  const pii = head.filter((_h, i) => PII.test(nh[i]));
  const ignored = head.filter((h, i) => h && !used.has(i) && !PII.test(nh[i]));

  const recs: PatientRecord[] = [];
  const incomplete: IncompleteRow[] = [];
  const hosp: Record<string, number> = {};

  rows.slice(1).forEach((r, ri) => {
    const g = (k: string) => (idx[k] != null ? r[idx[k]] : "");
    if (!r.some((c) => String(c ?? "").trim())) return;

    const geno = normGeno(g("geno"));
    const q = title(g("quartier"));
    if (!geno || !q) {
      incomplete.push({ line: ri + 2, why: !geno ? "génotype manquant" : "quartier manquant" });
      return;
    }

    const sx = strip(g("sexe"))[0];
    const sy = strip(g("symp"));
    const h = String(g("hopital") || "HOP").trim().toUpperCase().slice(0, 4);
    hosp[h] = (hosp[h] || 0) + 1;

    recs.push({
      code: `${h}-${String(hosp[h]).padStart(3, "0")}`,
      dateTest: parseDate(g("dateTest")),
      dateEnr: parseDate(g("dateEnr")),
      sexe: sx === "m" ? "M" : sx === "f" ? "F" : "?",
      age: g("age") !== "" && g("age") != null ? Math.round(Number(g("age"))) : null,
      quartier: q,
      localite: title(g("localite")),
      geno,
      symp: sy.startsWith("o") ? "Oui" : sy.startsWith("n") ? "Non" : "Inconnu",
      contexte: normCtx(g("contexte")),
      hopital: String(g("hopital") || "").trim(),
      atcd: strip(g("atcd")).startsWith("o") ? "Oui" : "",
    });
  });

  // Localité manquante : déduite d'une autre fiche du même quartier.
  const byQ: Record<string, string> = {};
  recs.forEach((r) => {
    if (r.localite) byQ[strip(r.quartier)] = r.localite;
  });
  let inferred = 0;
  recs.forEach((r) => {
    if (!r.localite) {
      r.localite = byQ[strip(r.quartier)] || "Non renseignée";
      inferred++;
    }
  });

  const unknownGeo = [...new Set(recs.filter((r) => !QPOS[strip(r.quartier)]).map((r) => r.quartier))];

  const lastDate = recs.reduce<Date | null>(
    (m, r) => (r.dateEnr && (!m || r.dateEnr > m) ? r.dateEnr : m),
    null
  );

  return {
    src: srcName,
    rows: rows.length - 1,
    recs,
    incomplete,
    mapping,
    pii,
    ignored,
    inferred,
    unknownGeo,
    lastDate,
  };
}
