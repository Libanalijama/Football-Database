import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Pool } from 'pg';

type Row = Record<string, unknown>;
type Parameter = string | number | null;
export interface Database { query<T extends Row = Row>(sql: string, parameters?: Parameter[]): Promise<{ rows: T[]; rowCount: number }>; close(): Promise<void>; kind: 'postgres' | 'sqlite' }
let database: Promise<Database> | undefined;

export function storageStatus() {
  if (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.DATABASE_URL_POOLED) return { configured: true, kind: 'postgres' as const };
  if (!process.env.VERCEL && process.env.TGIQ_SQLITE_PATH) return { configured: true, kind: 'sqlite' as const };
  return { configured: false, kind: null };
}

export async function getDatabase(): Promise<Database> {
  if (!database) database = openDatabase().catch(error => { database = undefined; throw error; });
  return database;
}

async function openDatabase(): Promise<Database> {
  let db: Database;
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.DATABASE_URL_POOLED;
  if (connectionString) {
    // Prefer the verified direct endpoint when configured; retain the operator's explicit URL.
    const connection = new URL(connectionString);
    // Keep current pg certificate verification explicit across pg-connection-string upgrades.
    if (['prefer', 'require', 'verify-ca'].includes(connection.searchParams.get('sslmode') ?? '')) connection.searchParams.set('sslmode', 'verify-full');
    const pool = new Pool({ connectionString: connection.toString(), max: 4, connectionTimeoutMillis: 5000, query_timeout: 7000, statement_timeout: 5000, lock_timeout: 3000, idleTimeoutMillis: 10000 });
    db = { kind: 'postgres', async query<T extends Row>(sql: string, parameters: Parameter[] = []) { const result = await pool.query(sql, parameters); return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 }; }, close: () => pool.end() };
  } else {
    if (process.env.VERCEL || !process.env.TGIQ_SQLITE_PATH) throw new Error('Connect durable storage: set DATABASE_URL. For local use, run npm run setup:local.');
    const { DatabaseSync } = await import('node:sqlite');
    const path = resolve(process.env.TGIQ_SQLITE_PATH);
    mkdirSync(dirname(path), { recursive: true });
    const sqlite = new DatabaseSync(path);
    sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    db = { kind: 'sqlite', async query<T extends Row>(sql: string, parameters: Parameter[] = []) {
      // SQLite uses ordered ? bindings; PostgreSQL uses numbered parameters.
      const order: Parameter[] = [];
      const query = sql.replace(/\$(\d+)/g, (_, index: string) => { order.push(parameters[Number(index) - 1]); return '?'; });
      const statement = sqlite.prepare(query);
      if (/^\s*(SELECT|WITH|PRAGMA)/i.test(query) || /RETURNING\s/i.test(query)) {
        const rows = statement.all(...order) as T[];
        return { rows, rowCount: rows.length };
      }
      const result = statement.run(...order);
      return { rows: [], rowCount: Number(result.changes) };
    }, async close() { sqlite.close(); } };
  }
  // Cloud PostgreSQL migrations are an explicit deployment step. Never run DDL on a request.
  if (db.kind === 'sqlite') await migrate(db);
  return db;
}

const statements = [
  `CREATE TABLE IF NOT EXISTS tgiq_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS episodes (id TEXT PRIMARY KEY, name TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0, document TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS program (id TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0, graphic TEXT, frozen INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, output_token_hash TEXT)`,
  `CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, mime TEXT NOT NULL, filename TEXT NOT NULL, bytes_base64 TEXT, url TEXT, origin TEXT NOT NULL, attribution TEXT NOT NULL, rights TEXT NOT NULL, sha256 TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS provider_cache (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS auth_attempts (identity TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 1, window_start TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS episodes_updated ON episodes(updated_at)`,
  `CREATE INDEX IF NOT EXISTS provider_expiry ON provider_cache(expires_at)`,
];
async function migrate(db: Database) {
  for (const statement of statements) await db.query(statement);
  const now = new Date().toISOString();
  await db.query(`INSERT INTO program (id, version, graphic, frozen, updated_at) VALUES ('main', 0, NULL, 1, $1) ON CONFLICT(id) DO NOTHING`, [now]);
  await db.query(`INSERT INTO tgiq_migrations (version, applied_at) VALUES (1, $1) ON CONFLICT(version) DO NOTHING`, [now]);
}

export async function migrateDatabase() { const db = await getDatabase(); await migrate(db); return db.kind; }

export async function closeDatabase() { if (database) await (await database).close(); database = undefined; }

export async function getCached<T>(key: string): Promise<T | null> {
  if (!storageStatus().configured) return null;
  const db = await getDatabase();
  const result = await db.query(`SELECT payload FROM provider_cache WHERE cache_key=$1 AND expires_at>$2`, [key, new Date().toISOString()]);
  return result.rows.length ? JSON.parse(String(result.rows[0].payload)) as T : null;
}
export async function setCached(key: string, value: unknown, ttlSeconds: number) {
  if (!storageStatus().configured) return;
  const db = await getDatabase(); const now = new Date();
  await db.query(`INSERT INTO provider_cache(cache_key,payload,expires_at,created_at) VALUES($1,$2,$3,$4) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at,created_at=excluded.created_at`, [key, JSON.stringify(value), new Date(now.getTime() + ttlSeconds * 1000).toISOString(), now.toISOString()]);
  // Provider cache has a bounded retention independent of editorial snapshots.
  await db.query(`DELETE FROM provider_cache WHERE expires_at<$1`, [now.toISOString()]);
}
