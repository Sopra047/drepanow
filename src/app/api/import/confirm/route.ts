import { NextRequest, NextResponse } from "next/server";
import { getRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { QPOS, geoKey, strip } from "@/lib/geo";
import { geocodeQuartier, NOMINATIM_RATE_LIMIT_MS } from "@/lib/geocode";
import type { PatientRecord } from "@/types/record";

/** Étape 2 — intègre le lot analysé comme nouveau jeu de données actif, puis
 * géocode (OpenStreetMap Nominatim) les quartiers inconnus — permet d'importer
 * des registres d'autres villes que Foumban sans positions codées en dur. */
export async function POST(req: NextRequest) {
  const role = await getRole();
  if (role === "lecteur") {
    return NextResponse.json({ error: "Connexion requise." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const src: string | undefined = body?.src;
  const records: PatientRecord[] | undefined = body?.records;
  if (!src || !Array.isArray(records) || !records.length) {
    return NextResponse.json({ error: "Rien à intégrer." }, { status: 400 });
  }

  const batch = await prisma.importBatch.create({
    data: { source: src, rows: records.length, inferred: body?.inferred ?? 0 },
  });

  await prisma.patientRecord.createMany({
    data: records.map((r) => ({
      code: r.code,
      dateTest: r.dateTest ? new Date(r.dateTest) : null,
      dateEnr: r.dateEnr ? new Date(r.dateEnr) : null,
      sexe: r.sexe,
      age: r.age,
      quartier: r.quartier,
      localite: r.localite,
      geno: r.geno,
      symp: r.symp,
      contexte: r.contexte,
      hopital: r.hopital,
      atcd: r.atcd,
      batchId: batch.id,
    })),
  });

  const geocoding = await geocodeNewQuartiers(records);

  return NextResponse.json({ ok: true, batchId: batch.id, integrated: records.length, geocoding });
}

/** Géocode les quartiers qui n'ont ni centroïde codé en dur (QPOS) ni entrée en
 * cache (QuartierLocation), en séquence pour respecter la limite Nominatim
 * (1 req/s). Les échecs restent silencieux : la carte retombe sur un centroïde
 * de localité approché (src/lib/geo.ts) tant que le géocodage n'a pas réussi. */
async function geocodeNewQuartiers(records: PatientRecord[]) {
  const unique = new Map<string, { quartier: string; localite: string }>();
  for (const r of records) {
    if (QPOS[strip(r.quartier)]) continue;
    unique.set(geoKey(r.quartier, r.localite), { quartier: r.quartier, localite: r.localite });
  }
  if (!unique.size) return { attempted: 0, resolved: 0 };

  const existing = await prisma.quartierLocation.findMany({
    where: { key: { in: [...unique.keys()] } },
    select: { key: true },
  });
  for (const e of existing) unique.delete(e.key);
  if (!unique.size) return { attempted: 0, resolved: 0 };

  let resolved = 0;
  let first = true;
  for (const [key, { quartier, localite }] of unique) {
    if (!first) await new Promise((r) => setTimeout(r, NOMINATIM_RATE_LIMIT_MS));
    first = false;
    const pos = await geocodeQuartier(quartier, localite);
    if (!pos) continue;
    await prisma.quartierLocation
      .upsert({
        where: { key },
        update: {},
        create: { key, quartier, localite, lat: pos[0], lon: pos[1], source: "geocoded" },
      })
      .catch(() => {});
    resolved++;
  }
  return { attempted: unique.size, resolved };
}
