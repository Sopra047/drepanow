# Drepanow AI

Application web de cartographie de la drépanocytose au Cameroun (cas S/S, porteurs A/S) à l'échelle du quartier, avec tableau de bord, assistant conversationnel (réponses générées localement à partir des données, sans IA générative externe) et import de registres d'électrophorèse.

**Accès public par défaut** : la consultation (carte, indicateurs, graphiques, assistant IA en lecture) ne nécessite aucune connexion. La connexion (bouton « Se connecter ») est réservée au personnel de santé (rôles Administrateur / Utilisateur santé) pour l'import des registres et la génération de rapports PDF.

## Prérequis

- Node.js ≥ 20.9 (développé et déployé avec Node 22 ; voir `engines` dans `package.json`)
- Une base MySQL/MariaDB accessible (locale ou distante — voir ci-dessous)

## Démarrage local

```bash
# 1. Base de données locale (ou utiliser une base MySQL existante)
docker run --name drepanow-mysql -e MYSQL_ROOT_PASSWORD=devpassword -e MYSQL_DATABASE=drepanow -p 3306:3306 -d mysql:8

# 2. Variables d'environnement
cp .env.example .env.local   # puis éditer DATABASE_URL/SESSION_SECRET

# 3. Dépendances + schéma + données
npm install
npm run db:push   # ⚠️ Prisma CLI ne lit pas .env.local automatiquement (contrairement à `next dev`) —
npm run db:seed   # charger les variables dans le shell avant (ex. `set -a && source .env.local && set +a`
                   # sous bash, ou `Get-Content .env.local | ... ` côté PowerShell), sinon il utilisera `.env`.

# 4. Lancer
npm run dev
```

Ouvrir http://localhost:3000 — le tableau de bord s'affiche directement, sans connexion.

### Comptes de démonstration (créés par `npm run db:seed`)

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Administrateur | `admin@drepanow.ai` | `demo-drepanow` |
| Utilisateur santé | `agent.foumban@minsante.cm` | `demo-drepanow` |

**À changer avant toute mise en production réelle** (voir `prisma/seed.ts`).

## Variables d'environnement

| Variable | Exemple | Notes |
|---|---|---|
| `DATABASE_URL` | `mysql://user:pass@host:3306/db` | Obligatoire. Le mot de passe doit être encodé en URL si caractères spéciaux (`@` → `%40`). |
| `DB_SOCKET_PATH` | `/tmp/mysql.sock` | Optionnel — force une connexion par socket Unix local plutôt que TCP host:port (voir "Hébergement PlanetHoster/N0C" ci-dessous). |
| `DB_SSL` | `true` | Optionnel — à activer pour une base cloud qui exige TLS (ex. TiDB Cloud Serverless, voir "Hébergement Vercel" ci-dessous). |
| `SESSION_SECRET` | — | Signature des cookies de session. Générer avec `openssl rand -base64 32`. |
| `NODE_ENV` | `production` | Définir en déploiement. |

## Structure

- `src/lib/normalize.ts` — détection des colonnes, anonymisation, normalisation des registres importés.
- `src/lib/zones.ts` — agrégation par quartier, score et niveau de priorité (3×S/S + A/S).
- `src/lib/ai.ts` — contexte de données (`buildAiContext`), réponses du chat et génération des rapports (logique locale, sans appel IA externe).
- `src/lib/db.ts` — client Prisma, connecté via pilote JS pur (`@prisma/adapter-mariadb`), pas le moteur natif (voir plus bas pourquoi).
- `src/app/api/*` — routes serveur (zones, records, import, ai, reports, login/logout/me). Le contrôle de rôle (`getRole()` dans `src/lib/auth.ts`) est appliqué côté serveur dans chaque route sensible, pas seulement dans l'interface.
- `src/proxy.ts` — middleware : interdit la mise en cache des réponses `/api/*` par un proxy/CDN intermédiaire.
- `src/components/*` — Dashboard, carte (Leaflet), filtres, graphiques, chat IA, modale de rapport, flux d'import.
- `server.js` — point d'entrée pour hébergement cPanel/Passenger (voir ci-dessous) ; en dev classique, `npm run dev` suffit.
- `prisma/schema.prisma` — modèle de données MySQL.
- `prisma/seed.ts` — comptes de démo + chargement du registre réel (`data/registre-hraf-foumban.xlsx`, non versionné).

## Hébergement Vercel

Alternative au cPanel/Passenger ci-dessous ; plus simple, pas de contournement spécifique nécessaire (`server.js`, `DB_SOCKET_PATH`, `experimental.cpus` dans `next.config.ts` ne sont pas utilisés par Vercel).

1. Pousser le repo sur GitHub/GitLab/Bitbucket, puis importer le projet sur [vercel.com](https://vercel.com) (détection automatique de Next.js).
2. Base de données : les fonctions serverless de Vercel ne peuvent pas atteindre une base MySQL en `localhost` — il faut une base MySQL/MariaDB joignable publiquement. Recommandé : [TiDB Cloud Serverless](https://tidbcloud.com) (compatible MySQL, palier gratuit permanent).
   - Créer un cluster Serverless, récupérer les identifiants de connexion (hôte, port, utilisateur au format `xxxxxxx.root`, mot de passe).
   - TiDB Cloud exige TLS : définir `DB_SSL=true` en plus de `DATABASE_URL`.
3. Dans les "Environment Variables" du projet Vercel, définir `DATABASE_URL`, `DB_SSL=true`, `SESSION_SECRET` (ne pas définir `DB_SOCKET_PATH`).
4. `npm run db:push` (depuis un poste local pointant vers la base cloud, via `DATABASE_URL`/`DB_SSL` dans `.env.local`) pour créer le schéma, puis `npm run db:seed` si besoin des comptes de démo.

## Hébergement mutualisé cPanel/Passenger (PlanetHoster/N0C)

Ce projet a été durci pour tourner sur de l'hébergement mutualisé à base de CloudLinux + Phusion Passenger. Plusieurs choix dans le code existent spécifiquement pour ça :

- **`server.js`** : Passenger exécute ce fichier directement au lieu de `next start`. En production, le serveur doit écouter sur le canal spécial nommé littéralement `"passenger"` (pas un port TCP classique) — voir le commentaire en tête du fichier et la [doc N0C](https://kb.n0c.com/knowledge-base/gestion-des-applications-node-js/).
- **`next.config.ts`** :
  - `experimental.cpus: 1` — l'hébergement a une mémoire limitée par compte (LVE/CageFS) ; le parallélisme par défaut de Next.js (un worker de build par cœur CPU) peut dépasser ce plafond et faire planter le build (`SIGABRT`).
  - `typescript.ignoreBuildErrors: true` — la vérification TypeScript interne de `next build` échoue à résoudre `@types/react`/`@types/node` à travers le lien symbolique `nodevenv` de CloudLinux, alors que le code est bien vérifié (`tsc --noEmit` passe sans erreur en local/CI). Webpack compile correctement malgré cet avertissement.
  - `serverExternalPackages: ["@prisma/client", "prisma"]` — empêche Webpack de regrouper le client Prisma dans le bundle serveur.
  - `npm run build` utilise Webpack (`next build --webpack`), pas Turbopack : le binaire natif de Turbopack ne charge pas sur cet hébergement (GLIBC trop ancienne). `npm run build:turbo` reste disponible pour un build Turbopack plus rapide là où c'est supporté (ex. en local).
- **`DB_SOCKET_PATH`** (pilote MySQL, `src/lib/db.ts`) : contournement pour un symptôme encore mal compris — **les connexions réseau sortantes semblent échouer uniquement pour les processus gérés par Passenger** (le même code, lancé directement dans un terminal sur le même serveur, fonctionne parfaitement). Se connecter par socket Unix local (`/tmp/mysql.sock` ou équivalent) au lieu de TCP `host:port` contourne le problème dans certains cas. **Ce point n'est pas entièrement résolu** — voir "Problème ouvert" ci-dessous.
- **Pilote MySQL en JS pur** (`@prisma/adapter-mariadb` + `mariadb`, dans `src/lib/db.ts`) au lieu du moteur natif Rust habituel de Prisma : plus léger, évite de dépendre d'un binaire natif soumis aux mêmes problèmes de GLIBC que Turbopack. ⚠️ `@prisma/adapter-mariadb@6.19.3` fixe en interne une version vulnérable de `mariadb` (CVE multiples, dont des injections SQL) — neutralisé via `overrides` dans `package.json`. À revérifier à chaque mise à jour de `@prisma/adapter-mariadb`.

### Problème ouvert (non résolu au moment de la rédaction)

Sur l'environnement de déploiement testé, les routes qui ouvrent une connexion réseau (base de données) depuis un processus **géré par Passenger** échouent systématiquement avec une réponse HTTP 500 vide (pas d'erreur applicative catchable — le processus semble se faire interrompre au niveau système). Le même code, avec les mêmes identifiants, fonctionne parfaitement :
- en lançant `node server.js` directement dans un terminal SSH sur ce même serveur ;
- en local, avec `next start` ou `node server.js`.

Hypothèse la plus probable restante : une règle de pare-feu/sandbox (CageFS) spécifique aux processus Passenger bloque les connexions sortantes (même vers `localhost`). Le contournement par socket Unix (`DB_SOCKET_PATH`) est à tester en priorité sur ce point précis avant toute autre piste. Si le problème persiste, contacter le support de l'hébergeur avec les éléments suivants :
- La route fonctionne en lancement direct (`PORT=3000 NODE_ENV=production node server.js` + `curl localhost:3000/...`), jamais via Passenger.
- Reproductible avec un pilote de base de données 100 % JavaScript (pas de binaire natif) — élimine les pistes mémoire/GLIBC.
- Demander explicitement : règles réseau/pare-feu spécifiques aux processus Passenger, différentes d'une session shell interactive.

## Dépendances — points d'attention

- `prisma`/`@prisma/client`/`@prisma/adapter-mariadb` sont épinglés en `6.19.3` (pas de caret) : Prisma 7 déplace `datasource.url` hors du schéma (breaking change de configuration), non testé avec ce projet.
- `next`/`eslint-config-next` doivent toujours être mis à jour **ensemble**, à la même version exacte.
- `xlsx` est installé depuis la build officielle corrigée de SheetJS (`cdn.sheetjs.com`) — le paquet npm standard a des CVE non corrigées.
- `npm audit` résiduel (`deepmerge-ts` via l'outil CLI `prisma`, `minimatch` via `@typescript-eslint`) : dépendances d'outils de développement, jamais exécutées par l'application en production. À revérifier périodiquement.

## Pistes pour la suite

- **Géolocalisation** : `src/lib/geo.ts` contient des centroïdes approximatifs codés en dur pour Foumban ; les autres villes passent par un géocodage automatique (OpenStreetMap Nominatim, mis en cache dans `QuartierLocation`). Une table dédiée avec validation humaine serait plus fiable à grande échelle.
- **Rapports PDF** : la modale génère un aperçu HTML imprimé via `window.print()` ; pour un export PDF serveur sans dépendre du navigateur, brancher Playwright/Puppeteer sur `/api/reports`.
- **PostgreSQL + PostGIS** : envisageable si besoin de géométries avancées (polygones de quartiers) plutôt que des points.

## Données

`data/registre-hraf-foumban.xlsx` est le registre réel (Hôpital Régional Annexe de Foumban, 42 lignes) — exclu du contrôle de version (`.gitignore`) car ce sont des données de santé, même anonymisées à l'import.
