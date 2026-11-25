import { prisma } from "@/lib/db";
import type { Genotype, PatientRecord, Sexe, Symptomatique } from "@/types/record";

export interface Dataset {
  src: string;
  sources: string[];
  rows: number;
  inferred: number;
  recs: PatientRecord[];
  lastDate: Date | null;
}

/** Charge l'ensemble des fiches de tous les registres importés (cumulatif — chaque
 * import s'ajoute aux précédents au lieu de remplacer le jeu de données actif).
 * C'est ce qui permet d'agréger progressivement des registres de plusieurs hôpitaux
 * et de plusieurs villes sur une même carte nationale. */
export async function getDataset(): Promise<Dataset> {
  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "asc" },
    include: { records: true },
  });

  if (!batches.length) {
    return { src: "Aucun registre importé", sources: [], rows: 0, inferred: 0, recs: [], lastDate: null };
  }

  const recs: PatientRecord[] = batches.flatMap((b) =>
    b.records.map((r) => ({
      id: r.id,
      code: r.code,
      dateTest: r.dateTest,
      dateEnr: r.dateEnr,
      sexe: r.sexe as Sexe,
      age: r.age,
      quartier: r.quartier,
      localite: r.localite,
      geno: r.geno as Genotype,
      symp: r.symp as Symptomatique,
      contexte: r.contexte,
      hopital: r.hopital,
      atcd: r.atcd,
    }))
  );

  const sources = [...new Set(batches.map((b) => b.source))];
  const src = sources.length > 1 ? `${sources.length} registres importés` : sources[0];
  const rows = batches.reduce((s, b) => s + b.rows, 0);
  const inferred = batches.reduce((s, b) => s + b.inferred, 0);
  const lastDate = recs.reduce<Date | null>(
    (m, r) => (r.dateEnr && (!m || r.dateEnr > m) ? r.dateEnr : m),
    null
  );

  return { src, sources, rows, inferred, recs, lastDate };
}
