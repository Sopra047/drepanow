import type { PatientRecord, Zone } from "@/types/record";
import type { Stats } from "@/lib/zones";

export interface ZonesResponse {
  source: {
    src: string;
    sources: string[];
    rows: number;
    exploitable: number;
    inferred: number;
    lastDate: string | null;
    hospitals: string[];
  };
  stats: Stats;
  zones: Zone[];
  localites: [string, number][];
}

export interface RecordsResponse {
  records: PatientRecord[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  err?: boolean;
  q?: string;
}
