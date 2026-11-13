// Next automatically loads .env.local; standalone migration scripts load it explicitly.
import { existsSync } from 'node:fs';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const { getDatabase, migrateDatabase, closeDatabase } = await import('../src/lib/server/db.ts');
await migrateDatabase();
const db = await getDatabase();
await db.query('SELECT 1');
console.log(`TGIQ schema migration 1 ready (${db.kind}).`);
await closeDatabase();
