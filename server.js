/**
 * Point d'entrée requis par l'hébergement cPanel/Passenger (PlanetHoster/N0C et la
 * plupart des hébergeurs mutualisés) : Passenger exécute directement ce fichier
 * ("Application startup file" dans Setup Node.js App) au lieu de `next start`.
 *
 * IMPORTANT (N0C) : en production, Passenger attend que le serveur écoute sur le
 * canal spécial nommé littéralement "passenger" (pas un port TCP classique comme
 * 3000) — c'est ainsi que Passenger communique avec le processus Node en interne.
 * Voir https://kb.n0c.com/knowledge-base/gestion-des-applications-node-js/
 * ("Étape 2 – Programmation de l'application"). Sans ça, Passenger ne relaie pas
 * correctement les requêtes dynamiques vers l'application.
 *
 * En local/dev classique, on continue d'utiliser `npm run dev` (next dev) —
 * ce fichier ne sert qu'au déploiement en production.
 */
const { createServer } = require("node:http");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = "127.0.0.1";
// "passenger" dans tous les cas sous Passenger (indépendant du mode dev/production
// de Next.js — ce sont deux réglages distincts). N'est surchargé par PORT que pour
// mes propres tests manuels en local (ex. PORT=3000 node server.js).
const port = process.env.PORT || "passenger";

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Pas de parsing manuel de req.url (l'ancienne API url.parse() est dépréciée
  // et déconseillée pour raisons de sécurité) — Next.js parse la requête lui-même.
  createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error("Erreur serveur :", req.url, err);
      res.statusCode = 500;
      res.end("Erreur interne du serveur");
    });
  }).listen(port, hostname, () => {
    console.log(`> Drepanow AI prêt (port: ${port})`);
  });
});
