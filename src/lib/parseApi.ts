import type { PatientRecord, Zone } from "@/types/record";

/** Les dates traversent JSON en chaînes ISO ; on les "ranime" en Date côté client
 * pour réutiliser telles quelles les fonctions de src/lib (fmtD, tri, filtres). */
export function reviveRecord(r: PatientRecord): PatientRecord {
  return {
    ...r,
    dateTest: r.dateTest ? new Date(r.dateTest) : null,
    dateEnr: r.dateEnr ? new Date(r.dateEnr) : null,
  };
}

export function reviveZone(z: Zone): Zone {
  return { ...z, recs: z.recs.map(reviveRecord) };
}
