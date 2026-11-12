import { z } from 'zod';
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function json(value: unknown, status = 200) { return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }); }
export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return json({ error: 'Invalid request', issues: error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) }, 400);
  console.error('TGIQ request failed:', error instanceof Error ? error.message : 'Unknown error');
  return json({ error: 'Storage unavailable. Saved output has not been changed.' }, 503);
}
export async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const text = await request.text();
  if (text.length > 3_500_000) throw new HttpError(413, 'Request too large');
  let value: unknown; try { value = JSON.parse(text); } catch { throw new HttpError(400, 'Invalid JSON'); }
  return schema.parse(value);
}
