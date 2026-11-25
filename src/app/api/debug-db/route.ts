import { NextResponse } from "next/server";
import mariadb from "mariadb";

/** Route de diagnostic temporaire — à supprimer une fois le problème de
 * connexion DB en prod résolu. Ne renvoie jamais les identifiants. */
export async function GET() {
  const u = new URL(process.env.DATABASE_URL!);
  const started = Date.now();
  const dbSslRaw = JSON.stringify(process.env.DB_SSL);
  try {
    const conn = await mariadb.createConnection({
      host: u.hostname,
      port: u.port ? Number(u.port) : undefined,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ""),
      connectTimeout: 20000,
      ssl: process.env.DB_SSL?.trim().toLowerCase() === "true" ? {} : undefined,
    });
    const rows = await conn.query("SELECT 1 AS ok");
    await conn.end();
    return NextResponse.json({ success: true, ms: Date.now() - started, rows, dbSslRaw });
  } catch (e) {
    const err = e as Error & { code?: string; errno?: number; sqlState?: string };
    return NextResponse.json(
      {
        success: false,
        ms: Date.now() - started,
        name: err.name,
        message: err.message,
        code: err.code,
        errno: err.errno,
        sqlState: err.sqlState,
        dbSslRaw,
      },
      { status: 500 }
    );
  }
}
