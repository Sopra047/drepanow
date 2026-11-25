/**
 * Centroïdes approximatifs (district de santé de Foumban, région de l'Ouest).
 * À remplacer en production par une table `quartiers` PostGIS validée par le district
 * (cf. README du handoff design, section Géolocalisation).
 */
export const LOC_CENTER: Record<string, [number, number]> = {
  Foumban: [5.7266, 10.901],
  "Périphérie Foumban": [5.745, 10.89],
  Foumbot: [5.508, 10.633],
  Malentouen: [5.82, 10.84],
};

export const QPOS: Record<string, [number, number]> = {
  njiloum: [5.733, 10.8985],
  njidare: [5.7205, 10.906],
  mambain: [5.729, 10.9125],
  kouhouat: [5.7362, 10.9082],
  folap: [5.7178, 10.8948],
  njiden: [5.725, 10.8898],
  njiyouom: [5.7402, 10.9002],
  njimom: [5.7312, 10.8878],
  kounga: [5.7148, 10.9102],
  fotain: [5.7232, 10.9182],
  bangourin: [5.7118, 10.8992],
  madja: [5.7382, 10.9162],
  kilombo: [5.7268, 10.904],
  kouocha: [5.7442, 10.9092],
  foyet: [5.7188, 10.8848],
  "koukouet maloum": [5.7098, 10.9202],
  "montagne sacree": [5.7462, 10.893],
  "koupa matapit": [5.665, 10.8],
  maghait: [5.7552, 10.93],
  malentouen: [5.76, 10.87],
  "mandinga plateau": [5.82, 10.84],
  massuem: [5.508, 10.633],
};

export const VIEWS: Record<string, [[number, number], [number, number]]> = {
  cm: [
    [1.65, 8.4],
    [13.1, 16.2],
  ],
  ouest: [
    [4.85, 9.75],
    [6.45, 11.3],
  ],
  noun: [
    [5.3, 10.45],
    [6.15, 11.35],
  ],
  fb: [
    [5.7, 10.875],
    [5.76, 10.935],
  ],
};

export const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

export const geoKey = (quartier: string, localite: string) => `${strip(quartier)}|${strip(localite)}`;

/** Centre géographique approximatif du Cameroun — dernier recours si un quartier
 * d'une ville inconnue n'a pas pu être géocodé (cf. src/lib/geocode.ts) : mieux
 * vaut une position vaguement au centre du pays qu'un faux rattachement à Foumban. */
const CAMEROON_CENTER: [number, number] = [5.7, 12.7];

/**
 * Position d'un quartier. Ordre de résolution :
 * 1. Centroïde codé en dur (QPOS, Foumban) ;
 * 2. `geocoded` — cache de géolocalisation chargé depuis la base (autres villes,
 *    rempli par /api/import/confirm via Nominatim) ;
 * 3. Centre de la localité connue (LOC_CENTER) avec un léger écart déterministe
 *    pour éviter que plusieurs quartiers d'une même ville non géocodée se superposent ;
 * 4. Centre du Cameroun, en dernier recours.
 */
export function zonePosition(
  quartier: string,
  localite: string,
  geocoded?: Record<string, [number, number]>
): [number, number] {
  const hardcoded = QPOS[strip(quartier)];
  if (hardcoded) return hardcoded;

  const cached = geocoded?.[geoKey(quartier, localite)];
  if (cached) return cached;

  const c = LOC_CENTER[localite] || CAMEROON_CENTER;
  return [
    c[0] + ((quartier.length % 7) - 3) * 0.003,
    c[1] + ((quartier.charCodeAt(0) % 7) - 3) * 0.003,
  ];
}
