import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

/** Pilote JS pur (mariadb) au lieu du moteur natif Rust de Prisma — voir la note
 * dans prisma/schema.prisma (generator client) pour le pourquoi.
 *
 * DB_SOCKET_PATH (optionnel) : connexion via socket Unix local plutôt que TCP
 * host:port — contournement testé sur l'hébergement PlanetHoster/N0C où les
 * connexions réseau sortantes des processus gérés par Passenger semblent
 * bloquées (le même code fonctionne en lancement direct dans le terminal,
 * jamais via Passenger, uniquement sur les routes qui ouvrent une connexion).
 *
 * DB_SSL (optionnel) : à mettre à "true" pour les bases MySQL/MariaDB cloud qui
 * exigent TLS (ex. TiDB Cloud Serverless, utilisé pour l'hébergement Vercel —
 * les fonctions serverless ne peuvent pas atteindre une base en localhost). */
function buildConnectionConfig(databaseUrl: string, socketPath?: string, ssl?: boolean) {
  const u = new URL(databaseUrl);
  const user = decodeURIComponent(u.username);
  const password = decodeURIComponent(u.password);
  const database = u.pathname.replace(/^\//, "");

  if (socketPath) {
    return { socketPath, user, password, database };
  }
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : undefined,
    user,
    password,
    database,
    ...(ssl ? { ssl: {} } : {}),
  };
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const config = buildConnectionConfig(
    process.env.DATABASE_URL!,
    process.env.DB_SOCKET_PATH,
    process.env.DB_SSL === "true"
  );
  const adapter = new PrismaMariaDb(config);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
