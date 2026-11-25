import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents (expérimental, Next 16) semble interférer avec l'instance
  // singleton de PrismaClient dans les routes compilées (crash silencieux observé
  // uniquement sur les routes touchant Prisma, jamais via /api/me qui n'y touche
  // pas) — désactivé pour tester/écarter cette piste.
  // Leaflet initialise la carte de façon impérative sur un nœud DOM (L.map(container)),
  // ce qui n'est pas idempotent. Le double montage volontaire du Strict Mode (dev only)
  // le fait échouer ("Map container is being reused by another instance"). Désactivé ici
  // car React 19 ne garde Strict Mode qu'en dev — comportement de production inchangé.
  reactStrictMode: false,
  // Le code est vérifié avec `tsc --noEmit` à chaque modification (en local, hors build).
  // Sur l'hébergement mutualisé (nodevenv/symlink CloudLinux), la vérification TypeScript
  // interne de `next build` échoue à résoudre @types/react et @types/node à travers le lien
  // symbolique alors que Webpack compile correctement — désactivée ici pour ne pas bloquer
  // le déploiement sur ce faux positif d'environnement.
  typescript: {
    ignoreBuildErrors: true,
  },
  // Hébergement mutualisé à mémoire limitée (LVE/CageFS) : par défaut Next.js lance
  // un worker de build par cœur CPU détecté, ce qui peut dépasser le plafond mémoire
  // du compte et provoquer un SIGABRT en cours de build. Un seul worker = plus lent
  // mais fiable sur ce type d'environnement contraint.
  experimental: {
    cpus: 1,
  },
  // Empêche Webpack d'intégrer le client Prisma dans le bundle serveur. Le client
  // généré repère son moteur natif via des chemins relatifs à son propre dossier
  // dans node_modules ; une fois regroupé par Webpack, cette localisation casse et
  // Prisma ne trouve plus son moteur au moment de l'exécution (plantage silencieux
  // du processus, 500 vide — observé uniquement via les routes compilées, jamais
  // en ligne de commande directe). Recommandation officielle Next.js + Prisma.
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
