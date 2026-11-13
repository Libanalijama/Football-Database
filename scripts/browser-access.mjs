/** Producer-only access bootstrap. Never call this for read-only output contexts. */
import fs from 'node:fs/promises';

export async function enterProducer(page, { baseURL, accessPath, password, timeout = 60000 } = {}) {
 const target = baseURL || process.env.TGIQ_TEST_URL || 'http://localhost:3001';
 const started = Date.now();
 const response = await page.context().request.get(new URL('/api/session', target).href, {
  headers: { Origin: new URL(target).origin }, timeout,
 });
 let state;
 try { state = await response.json(); } catch { throw Error(`Producer session is unavailable (${response.status()}).`); }
 if (!response.ok()) throw Error(state.error || `Producer session is unavailable (${response.status()}).`);
 if (state.authenticated) {
  // APIRequestContext and its browser context share cookies, including the open-mode bootstrap cookie.
  await page.goto(target);
  await page.getByRole('heading', { name: 'Football production', exact: true }).waitFor({ timeout });
  return { mode: state.mode || 'password', authenticated: true, credentialRequired: false, status: response.status(), elapsedMs: Date.now() - started };
 }
 if (state.mode === 'open') throw Error('Producer session security is not configured.');
 // Credentials are read only when the target explicitly requires password access.
 let secret = password;
 if (!secret) {
  const path = accessPath || process.env.TGIQ_TEST_ACCESS;
  if (!path) throw Error('Password access is enabled. Set TGIQ_TEST_ACCESS to its private access JSON file.');
  try { secret = JSON.parse(await fs.readFile(path, 'utf8')).producerPassword; }
  catch { throw Error('Password access is enabled, but the optional test access file is unavailable.'); }
 }
 if (!secret) throw Error('The password-mode test access file needs producerPassword.');
 await page.goto(target);
 await page.getByLabel('Producer password').fill(secret);
 const signedIn = page.waitForResponse(r => new URL(r.url()).pathname === '/api/session' && r.request().method() === 'POST', { timeout });
 await page.getByRole('button', { name: 'Sign in', exact: true }).click();
 const login = await signedIn;
 let result;
 try { result = await login.json(); } catch { throw Error(`Producer sign-in is unavailable (${login.status()}).`); }
 if (!login.ok() || !result.authenticated) throw Error(result.error || 'Producer sign-in failed.');
 await page.getByRole('heading', { name: 'Football production', exact: true }).waitFor({ timeout });
 return { mode: result.mode || 'password', authenticated: true, credentialRequired: true, status: login.status(), elapsedMs: Date.now() - started };
}
