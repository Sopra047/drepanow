export type Genotype = "AA" | "AS" | "SS" | "SC" | "Autre";
export type Sexe = "M" | "F" | "?";
export type Symptomatique = "Oui" | "Non" | "Inconnu";

export interface PatientRecord {
  id?: number;
  code: string;
  dateTest: Date | null;
  dateEnr: Date | null;
  sexe: Sexe;
  age: number | null;
  quartier: string;
  localite: string;
  geno: Genotype;
  symp: Symptomatique;
  contexte: string;
  hopital: string;
  atcd: string;
}

export interface FieldMapping {
  k: string;
  label: string;
  req: boolean;
  src: string | null;
}

export interface IncompleteRow {
  line: number;
  why: string;
}

export interface NormalizedDataset {
  src: string;
  rows: number;
  recs: PatientRecord[];
  incomplete: IncompleteRow[];
  mapping: FieldMapping[];
  pii: string[];
  ignored: string[];
  inferred: number;
  unknownGeo: string[];
  lastDate: Date | null;
}

export type PriorityLevel = "hi" | "md" | "lo";

export interface Zone {
  k: string;
  name: string;
  localite: string;
  ss: number;
  as: number;
  n: number;
  recs: PatientRecord[];
  ll: [number, number];
  score: number;
  lvl: PriorityLevel;
}

export type DataType = "both" | "SS" | "AS";
export type Period = "all" | "2026" | "90" | "30";

export interface Filters {
  type: DataType;
  period: Period;
  locs: Set<string> | null;
  sel: string | null;
}

export type UserRole = "lecteur" | "sante" | "admin";
