export const fmtD = (d: Date | string | null) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
};

export const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** "AA" -> "A/A", "SC" -> "S/C", mais "Autre" reste "Autre" (pas de découpage à 2 lettres). */
export const genoLabel = (geno: string) => (geno.length === 2 ? `${geno[0]}/${geno[1]}` : geno);
