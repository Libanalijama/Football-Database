import { z } from 'zod';
import { assertOrigin, assertSessionOrigin, authConfigured, producerAuthMode, checkPassword, clearLoginAttempts, isProducer, limitLogin, makeSession, sessionCookie } from '@/lib/server/auth';
import { body, errorResponse, HttpError, json } from '@/lib/server/http';
export const runtime = 'nodejs';
function openSession(request: Request) {
  const authenticated = isProducer(request);
  const configured = authConfigured();
  const response = json({ authenticated: configured, configured, mode: 'open' });
  if (configured && !authenticated) response.headers.set('Set-Cookie', sessionCookie(makeSession(), request));
  return response;
}
export async function GET(request: Request) {
  try {
    if (producerAuthMode() === 'open') { assertSessionOrigin(request); return openSession(request); }
    return json({ authenticated: isProducer(request), configured: authConfigured(), mode: 'password' });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    if (!authConfigured()) throw new HttpError(503, 'Configure producer session security. Run npm run setup:local for local use.');
    if (producerAuthMode() === 'open') return openSession(request);
    await limitLogin(request);
    const data = await body(request, z.object({ password: z.string().min(1).max(1024) }));
    if (!checkPassword(data.password)) throw new HttpError(401, 'Incorrect password');
    await clearLoginAttempts(request);
    const response = json({ authenticated: true, configured: true, mode: 'password' }); response.headers.set('Set-Cookie', sessionCookie(makeSession(), request)); return response;
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request) { try { assertOrigin(request); const response = json({ authenticated: false }); response.headers.set('Set-Cookie', sessionCookie('', request, true)); return response; } catch (error) { return errorResponse(error); } }
