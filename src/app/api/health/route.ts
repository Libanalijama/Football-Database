import { isProducer, authConfigured } from '@/lib/server/auth';
import { getDatabase, storageStatus } from '@/lib/server/db';
import { json } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const storage = storageStatus(); let ready = false;
  if (storage.configured) try { await (await getDatabase()).query('SELECT 1'); ready = true; } catch { /* expose only readiness, never connection details */ }
  return json({ ready: ready && authConfigured(), storage: { configured: storage.configured, ready, kind: storage.kind }, access: { configured: authConfigured(), authenticated: isProducer(request) }, media: { durable: ready, objectStorage: Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) } });
}
