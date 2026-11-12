import { randomBytes, randomUUID } from 'node:crypto';
import { getDatabase } from './db';
import { episodeSchema, episodeUpdateSchema, programMutationSchema, type Episode, type ProgramState } from './models';
import { HttpError } from './http';
import { tokenHash } from './auth';
import type { z } from 'zod';

export async function listEpisodes(includeArchived = false) {
  const db = await getDatabase();
  const { rows } = await db.query(`SELECT document FROM episodes ${includeArchived ? '' : 'WHERE archived=0'} ORDER BY updated_at DESC`);
  return rows.map(row => episodeSchema.parse(JSON.parse(String(row.document))));
}
export async function getEpisode(id: string): Promise<Episode> {
  const db = await getDatabase(); const { rows } = await db.query(`SELECT document FROM episodes WHERE id=$1`, [id]);
  if (!rows.length) throw new HttpError(404, 'Episode not found');
  return episodeSchema.parse(JSON.parse(String(rows[0].document)));
}
export async function createEpisode(name: string, source?: Episode): Promise<Episode> {
  const now = new Date().toISOString();
  const episode = episodeSchema.parse({ schemaVersion: 1, id: randomUUID(), name, version: 1, archived: false, items: source?.items.map(item => ({ ...item, id: randomUUID() })) ?? [], createdAt: now, updatedAt: now });
  const db = await getDatabase();
  await db.query(`INSERT INTO episodes(id,name,version,archived,document,created_at,updated_at) VALUES($1,$2,1,0,$3,$4,$4)`, [episode.id, episode.name, JSON.stringify(episode), now]);
  return episode;
}
export async function updateEpisode(id: string, input: z.infer<typeof episodeUpdateSchema>) {
  const changes = episodeUpdateSchema.parse(input); const existing = await getEpisode(id);
  if (existing.version !== changes.expectedVersion) throw new HttpError(409, 'Episode changed on another device. Reload before saving.');
  if (changes.items && new Set(changes.items.map(item => item.id)).size !== changes.items.length) throw new HttpError(400, 'Rundown item IDs must be unique');
  const episode = episodeSchema.parse({ ...existing, ...changes, id: existing.id, version: existing.version + 1, updatedAt: new Date().toISOString() });
  const db = await getDatabase();
  const { rowCount } = await db.query(`UPDATE episodes SET name=$1,version=$2,archived=$3,document=$4,updated_at=$5 WHERE id=$6 AND version=$7`, [episode.name, episode.version, episode.archived ? 1 : 0, JSON.stringify(episode), episode.updatedAt, id, changes.expectedVersion]);
  if (!rowCount) throw new HttpError(409, 'Episode changed on another device. Reload before saving.');
  return episode;
}
export async function missingMedia(episode: Episode) {
  const ids = [...new Set(episode.items.flatMap(item => item.mediaIds))]; const db = await getDatabase(); const missing: string[] = [];
  for (const id of ids) { const { rows } = await db.query(`SELECT id FROM assets WHERE id=$1`, [id]); if (!rows.length) missing.push(id); }
  return missing;
}
export async function getProgram(): Promise<ProgramState> {
  const db = await getDatabase(); const { rows } = await db.query(`SELECT version, graphic, frozen, updated_at FROM program WHERE id='main'`);
  const row = rows[0];
  return { version: Number(row.version), graphic: row.graphic ? JSON.parse(String(row.graphic)) : null, frozen: Boolean(row.frozen), updatedAt: String(row.updated_at) };
}
/** One database read authenticates read-only output access and returns the current state. */
export async function getProgramByOutputToken(token: string | null): Promise<ProgramState | null> {
  if(!token || token.length > 200) return null;
  const db = await getDatabase();
  const { rows } = await db.query(`SELECT version,graphic,frozen,updated_at FROM program WHERE id='main' AND output_token_hash=$1`,[tokenHash(token)]);
  if(!rows.length) return null; const row=rows[0];
  return {version:Number(row.version),graphic:row.graphic?JSON.parse(String(row.graphic)):null,frozen:Boolean(row.frozen),updatedAt:String(row.updated_at)};
}
export async function mutateProgram(input: z.infer<typeof programMutationSchema>): Promise<ProgramState> {
  const data = programMutationSchema.parse(input);
  const current = await getProgram();
  if (data.expectedVersion !== current.version) throw new HttpError(409, 'Program changed on another device. Refresh the on-air preview.');
  if (data.action === 'take' && !data.graphic) throw new HttpError(400, 'Prepare a graphic first');
  const next: ProgramState = { ...current, version: current.version + 1, updatedAt: new Date().toISOString() };
  if (data.action === 'take') next.graphic = data.graphic!;
  if (data.action === 'clear') next.graphic = null;
  if (data.action === 'freeze') next.frozen = true;
  if (data.action === 'unfreeze') next.frozen = false;
  const db = await getDatabase();
  const { rowCount } = await db.query(`UPDATE program SET version=$1,graphic=$2,frozen=$3,updated_at=$4 WHERE id='main' AND version=$5`, [next.version, next.graphic ? JSON.stringify(next.graphic) : null, next.frozen ? 1 : 0, next.updatedAt, current.version]);
  if (!rowCount) throw new HttpError(409, 'Program changed on another device. Refresh the on-air preview.');
  return next;
}
export async function rotateOutputToken() {
  const token = randomBytes(32).toString('base64url'); const db = await getDatabase();
  await db.query(`UPDATE program SET output_token_hash=$1 WHERE id='main'`, [tokenHash(token)]);
  return token;
}
export async function outputAccessConfigured() {
  const db = await getDatabase(); const { rows } = await db.query(`SELECT output_token_hash FROM program WHERE id='main'`); return Boolean(rows[0]?.output_token_hash);
}
export async function validOutputToken(token: string | null) {
  if (!token || token.length > 200) return false;
  const db = await getDatabase(); const { rows } = await db.query(`SELECT output_token_hash FROM program WHERE id='main' AND output_token_hash=$1`, [tokenHash(token)]); return rows.length > 0;
}
