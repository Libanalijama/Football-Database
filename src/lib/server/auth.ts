import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { getDatabase } from './db';
import { HttpError } from './http';

export const SESSION_COOKIE = 'tgiq_producer';
const lifetimeSeconds = 12 * 60 * 60;
export function producerAuthMode(): 'open' | 'password' { return process.env.PRODUCER_AUTH_MODE === 'open' ? 'open' : 'password'; }
export function authConfigured() { return Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32 && (producerAuthMode() === 'open' || process.env.PRODUCER_PASSWORD_HASH)); }
function secret() { if (!authConfigured()) throw new HttpError(503, 'Configure producer session security. Run npm run setup:local for local use.'); return process.env.SESSION_SECRET!; }
export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) { return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function checkPassword(password: string): boolean {
  const encoded = process.env.PRODUCER_PASSWORD_HASH ?? '';
  const [salt, expected] = encoded.split(':');
  if (!salt || !expected || !/^[a-f0-9]{128}$/.test(expected)) return false;
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(expected, 'hex'));
}
export function makeSession(now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ expires: now + lifetimeSeconds * 1000, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret()).update(payload).digest('base64url')}`;
}
export function validSession(token: string | undefined, now = Date.now()) {
  if (!token || !authConfigured()) return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  const expected = createHmac('sha256', secret()).update(payload).digest('base64url');
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString()); return typeof data.expires === 'number' && data.expires > now && data.expires <= now + lifetimeSeconds * 1000; } catch { return false; }
}
export function sessionFromRequest(request: Request) { const cookie = request.headers.get('cookie') ?? ''; return cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1); }
export function isProducer(request: Request) { return validSession(sessionFromRequest(request)); }
export function assertProducer(request: Request, mutation = false) {
  if (!isProducer(request)) throw new HttpError(401, producerAuthMode() === 'open' ? 'Producer session required' : 'Producer sign-in required');
  if (mutation) assertOrigin(request);
}
export function assertOrigin(request: Request) {
  if (request.headers.get('x-tgiq-csrf') !== '1') throw new HttpError(403, 'Missing request protection');
  assertSessionOrigin(request);
}
export function assertSessionOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin && origin !== process.env.APP_ORIGIN) throw new HttpError(403, 'Origin is not allowed');
}
export function sessionCookie(token: string, request: Request, clear = false) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : lifetimeSeconds}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
function loginIdentity(request: Request) { return createHash('sha256').update(request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local').digest('hex'); }
export async function clearLoginAttempts(request: Request) {
  const db = await getDatabase();
  await db.query(`DELETE FROM auth_attempts WHERE identity=$1`, [loginIdentity(request)]);
}
export async function limitLogin(request: Request) {
  const identity = loginIdentity(request);
  const db = await getDatabase(); const start = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await db.query(`DELETE FROM auth_attempts WHERE window_start<$1`, [start]);
  const row = await db.query(`INSERT INTO auth_attempts(identity,attempts,window_start) VALUES($1,1,$2) ON CONFLICT(identity) DO UPDATE SET attempts=auth_attempts.attempts+1 RETURNING attempts`, [identity, new Date().toISOString()]);
  if (Number(row.rows[0]?.attempts) > 10) throw new HttpError(429, 'Too many sign-in attempts. Try again in 15 minutes.');
}
export function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
