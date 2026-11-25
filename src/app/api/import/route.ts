import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { getRole } from "@/lib/auth";
import { normalize } from "@/lib/normalize";

/** Étape 1 — analyse (pas d'écriture en base). Réservée admin|sante. */
export async function POST(req: NextRequest) {
  const role = await getRole();
  if (role === "lecteur") {
    return NextResponse.json({ error: "Connexion requise pour importer un registre." }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }

  try {
    let rows: unknown[][];
    if (/\.csv$/i.test(file.name)) {
      const text = await file.text();
      const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
      rows = parsed.data;
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
    }
    if (rows.length < 2) throw new Error("Aucune ligne de données trouvée.");

    const ds = normalize(rows, file.name);
    return NextResponse.json({
      src: ds.src,
      rows: ds.rows,
      exploitable: ds.recs.length,
      incomplete: ds.incomplete,
      mapping: ds.mapping,
      pii: ds.pii,
      ignored: ds.ignored,
      inferred: ds.inferred,
      unknownGeo: ds.unknownGeo,
      counts: {
        SS: ds.recs.filter((r) => r.geno === "SS").length,
        AS: ds.recs.filter((r) => r.geno === "AS").length,
        other: ds.recs.filter((r) => r.geno !== "SS" && r.geno !== "AS").length,
      },
      // Jeu normalisé transmis au client pour confirmation ; aucune écriture tant
      // que l'utilisateur n'a pas cliqué « Intégrer au tableau de bord ».
      pendingRecords: ds.recs,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fichier illisible.";
    return NextResponse.json({ error: `Import impossible : ${message}` }, { status: 422 });
  }
}
