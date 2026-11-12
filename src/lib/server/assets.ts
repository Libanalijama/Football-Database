import { createHash, randomUUID } from 'node:crypto';
import { getDatabase } from './db';
import { HttpError } from './http';
import type { z } from 'zod';
import { assetMetadataSchema } from './models';

const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
function matchesImage(bytes: Uint8Array, mime: string) {
  if (mime === 'image/png') return Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (mime === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === 'image/webp') return Buffer.from(bytes.subarray(0,4)).toString() === 'RIFF' && Buffer.from(bytes.subarray(8,12)).toString() === 'WEBP';
  if (mime === 'image/gif') return ['GIF87a', 'GIF89a'].includes(Buffer.from(bytes.subarray(0,6)).toString());
  return false;
}
export async function saveAsset(file: File, rawMetadata: z.input<typeof assetMetadataSchema>) {
  if (!allowed.has(file.type)) throw new HttpError(400, 'Upload PNG, JPEG, WebP or GIF');
  if (file.size > 3_000_000 || file.size < 12) throw new HttpError(413, 'Image must be smaller than 3 MB');
  const metadata = assetMetadataSchema.parse(rawMetadata);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesImage(bytes, file.type)) throw new HttpError(400, 'Image contents do not match its file type');
  const id = randomUUID(); const sha256 = createHash('sha256').update(bytes).digest('hex'); const now = new Date().toISOString();
  let storedUrl: string | null = null; let base64: string | null = Buffer.from(bytes).toString('base64');
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`tgiq/${id}/${file.name.replace(/[^a-z0-9._-]/gi,'_')}`, Buffer.from(bytes), { access: 'private', addRandomSuffix: false, contentType: file.type, token: process.env.BLOB_READ_WRITE_TOKEN });
    storedUrl = blob.url; base64 = null;
  }
  const db = await getDatabase();
  await db.query(`INSERT INTO assets(id,mime,filename,bytes_base64,url,origin,attribution,rights,sha256,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [id,file.type,file.name.slice(0,200),base64,storedUrl,metadata.origin,metadata.attribution,metadata.rights,sha256,now]);
  return { id, url: `/api/assets/${id}`, mime: file.type, filename: file.name, ...metadata, sha256, createdAt: now, storage: storedUrl ? 'object' : 'database' };
}
export async function getAsset(id: string) {
  const db = await getDatabase(); const { rows } = await db.query(`SELECT * FROM assets WHERE id=$1`, [id]);
  if (!rows.length) throw new HttpError(404, 'Image unavailable'); return rows[0];
}
