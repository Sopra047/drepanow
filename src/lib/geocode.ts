/**
 * Géocodage via Nominatim (OpenStreetMap), gratuit et sans clé API — permet
 * d'importer des registres d'autres villes du Cameroun sans dépendre uniquement
 * des centroïdes codés en dur pour Foumban (src/lib/geo.ts).
 *
 * Politique d'usage Nominatim : 1 requête/seconde max, User-Agent descriptif
 * obligatoire. Les appels se font donc en séquence avec un délai (cf. appelant
 * dans /api/import/confirm), jamais en parallèle.
 */

interface NominatimResult {
  lat: string;
  lon: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "DrepanowAI/1.0 (cartographie sante publique Cameroun; contact: equipe-projet)";

async function query(q: string): Promise<[number, number] | null> {
  const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=cm&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "fr" } });
    if (!res.ok) return null;
    const data: NominatimResult[] = await res.json();
    if (!data.length) return null;
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {
    return null;
  }
}

/** Essaie "quartier, localité, Cameroun" puis, à défaut, "localité, Cameroun" seule
 * (un quartier précis n'est pas toujours référencé sur OpenStreetMap, la ville l'est
 * presque toujours). Retourne null si rien n'est trouvé. */
export async function geocodeQuartier(quartier: string, localite: string): Promise<[number, number] | null> {
  const precise = await query(`${quartier}, ${localite}, Cameroun`);
  if (precise) return precise;
  return query(`${localite}, Cameroun`);
}

export const NOMINATIM_RATE_LIMIT_MS = 1100;
