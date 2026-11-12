import { z } from 'zod';
import { assertOrigin, authConfigured, checkPassword, clearLoginAttempts, isProducer, limitLogin, makeSession, sessionCookie } from '@/lib/server/auth';
import { body, errorResponse, HttpError, json } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function GET(request: Request) { return json({ authenticated: isProducer(request), configured: authConfigured() }); }
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    if (!authConfigured()) throw new HttpError(503, 'Configure producer access. Run npm run setup:local for local use.');
    await limitLogin(request);
    const data = await body(request, z.object({ password: z.string().min(1).max(1024) }));
    if (!checkPassword(data.password)) throw new HttpError(401, 'Incorrect password');
    await clearLoginAttempts(request);
    const response = json({ authenticated: true }); response.headers.set('Set-Cookie', sessionCookie(makeSession(), request)); return response;
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request) { try { assertOrigin(request); const response = json({ authenticated: false }); response.headers.set('Set-Cookie', sessionCookie('', request, true)); return response; } catch (error) { return errorResponse(error); } }
