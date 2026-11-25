import { NextResponse } from "next/server";

/**
 * Empêche toute mise en cache des routes API par un proxy/CDN intermédiaire
 * (observé sur l'hébergement PlanetHoster : le cache LiteSpeed servait une
 * réponse vide mémorisée pendant qu'un déploiement précédent était cassé,
 * au lieu de redemander au serveur Node). Les données de santé filtrées
 * dépendent de l'état courant de la base — elles ne doivent jamais être
 * mises en cache en amont de l'application.
 */
export function proxy() {
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
