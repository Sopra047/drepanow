import { prisma } from "@/lib/db";

/** Charge le cache de géolocalisation (quartiers géocodés hors Foumban) sous forme
 * de lookup `"quartier|localite" (normalisé) -> [lat, lon]`, consommé par `zones()`. */
export async function loadGeoCache(): Promise<Record<string, [number, number]>> {
  const rows = await prisma.quartierLocation.findMany({ select: { key: true, lat: true, lon: true } });
  const map: Record<string, [number, number]> = {};
  for (const r of rows) map[r.key] = [r.lat, r.lon];
  return map;
}
