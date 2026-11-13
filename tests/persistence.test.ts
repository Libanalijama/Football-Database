import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDatabase, getDatabase, getCached, setCached } from '../src/lib/server/db';
import { checkPassword, hashPassword, makeSession, validSession, assertOrigin, assertProducer, authConfigured } from '../src/lib/server/auth';
import { createEpisode, getEpisode, getProgram, listEpisodes, mutateProgram, rotateOutputToken, updateEpisode, validOutputToken, missingMedia } from '../src/lib/server/store';
import { episodeSchema } from '../src/lib/server/models';
import { createGraphic } from '../src/lib/graphics/registry';
import { saveAsset, getAsset } from '../src/lib/server/assets';
import { GET as readProgram, POST as writeProgram } from '../src/app/api/program/route';
import { GET as readSession, POST as login } from '../src/app/api/session/route';
import { POST as importEpisode } from '../src/app/api/episodes/route';

const temporary = mkdtempSync(join(tmpdir(), 'tgiq-persistence-'));
let priorEnvironment: NodeJS.ProcessEnv;
beforeAll(() => {
  priorEnvironment = { ...process.env };
  delete process.env.DATABASE_URL; delete process.env.DATABASE_URL_UNPOOLED; delete process.env.DATABASE_URL_POOLED; delete process.env.VERCEL;
  process.env.PRODUCER_AUTH_MODE = 'password';
  process.env.TGIQ_SQLITE_PATH = join(temporary, 'test.sqlite');
  process.env.PRODUCER_PASSWORD_HASH = hashPassword('correct test password');
  process.env.SESSION_SECRET = 'a'.repeat(64);
});
afterAll(async () => {
  await closeDatabase(); process.env = priorEnvironment; rmSync(temporary, { recursive: true, force: true });
});

describe('producer authentication', () => {
  it('hashes credentials and authenticates signed expiring sessions', () => {
    expect(checkPassword('correct test password')).toBe(true); expect(checkPassword('wrong')).toBe(false);
    const now = Date.now(); const session = makeSession(now);
    expect(validSession(session, now + 1000)).toBe(true);
    expect(validSession(`${session}x`, now)).toBe(false);
    expect(validSession(session, now + 13 * 60 * 60 * 1000)).toBe(false);
  });
  it('blocks cross-origin and unprotected mutations', () => {
    expect(() => assertOrigin(new Request('https://studio.test/api/program', { method: 'POST', headers: { origin: 'https://hostile.test', 'x-tgiq-csrf': '1' } }))).toThrow('Origin');
    expect(() => assertOrigin(new Request('https://studio.test/api/program', { method: 'POST' }))).toThrow('protection');
    expect(() => assertProducer(new Request('https://studio.test/api/program?token=readonly'), true)).toThrow('sign-in');
  });
});

describe('durable episodes and authoritative program', () => {
  it('survives database reopen with editorial overrides, figures and media references intact', async () => {
    const episode = await createEpisode('Filming 12 November');
    const graphic = createGraphic('profile-player');
    graphic.title = 'Moisés Caicedo'; graphic.fields['appearanceCount'] = 0;
    const updated = await updateEpisode(episode.id, { expectedVersion: episode.version, items: [{ id: 'item-1', title: 'Profile', graphic, subjectIds: ['espn:123'], sourceScope: { competition: 'eng.1', season: 2026 }, sourceSnapshot: { appearances: 0, assists: null }, overrides: { nationality: 'Editorial correction' }, mediaIds: ['missing-media-id'] }] });
    await closeDatabase();
    expect(await getEpisode(episode.id)).toEqual(updated);
    expect(await missingMedia(updated)).toEqual(['missing-media-id']);
    expect(episodeSchema.parse(JSON.parse(JSON.stringify(updated)))).toEqual(updated);
  });
  it('duplicates the snapshot under fresh episode and rundown identities', async () => {
    const [original] = await listEpisodes();
    const duplicate = await createEpisode(`${original.name} copy`, original);
    expect(duplicate.id).not.toBe(original.id); expect(duplicate.items[0].id).not.toBe(original.items[0].id);
    expect(duplicate.items[0].graphic).toEqual(original.items[0].graphic);
  });
  it('rejects stale episode versions and duplicate rundown identities', async () => {
    const [episode] = await listEpisodes();
    await updateEpisode(episode.id, { expectedVersion: episode.version, name: 'Updated' });
    await expect(updateEpisode(episode.id, { expectedVersion: episode.version, name: 'Stale' })).rejects.toMatchObject({ status: 409 });
    const current = await getEpisode(episode.id);
    await expect(updateEpisode(episode.id, { expectedVersion: current.version, items: [current.items[0], current.items[0]] })).rejects.toMatchObject({ status: 400 });
  });
  it('preserves program snapshot when providers fail, freezes and rejects late changes', async () => {
    const initial = await getProgram(); const graphic = createGraphic('scoreboard-result');
    graphic.title = 'Prepared before failure';
    const taken = await mutateProgram({ action: 'take', expectedVersion: initial.version, graphic });
    expect(taken.frozen).toBe(true);
    // No provider is consulted by snapshot persistence or program control.
    await closeDatabase(); expect(await getProgram()).toEqual(taken);
    await expect(mutateProgram({ action: 'clear', expectedVersion: initial.version })).rejects.toMatchObject({ status: 409 });
    const unfrozen = await mutateProgram({ action: 'unfreeze', expectedVersion: taken.version });
    expect(unfrozen.graphic).toEqual(graphic); expect(unfrozen.frozen).toBe(false);
    const frozen = await mutateProgram({ action: 'freeze', expectedVersion: unfrozen.version });
    expect(frozen.graphic).toEqual(graphic); expect(frozen.frozen).toBe(true);
    const cleared = await mutateProgram({ action: 'clear', expectedVersion: frozen.version }); expect(cleared.graphic).toBeNull();
  });
  it('allows only one concurrent program write at a version', async () => {
    const program = await getProgram();
    const outcomes = await Promise.allSettled([mutateProgram({ action: 'freeze', expectedVersion: program.version }), mutateProgram({ action: 'unfreeze', expectedVersion: program.version })]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
  });
  it('rotates read-only output access and stores only its digest', async () => {
    const first = await rotateOutputToken(); expect(await validOutputToken(first)).toBe(true);
    const second = await rotateOutputToken(); expect(await validOutputToken(first)).toBe(false); expect(await validOutputToken(second)).toBe(true);
    const db = await getDatabase(); const result = await db.query('SELECT output_token_hash FROM program'); expect(result.rows[0].output_token_hash).not.toBe(second);
  });
  it('refuses local disk persistence in a Vercel production runtime', async () => {
    await closeDatabase(); process.env.VERCEL = '1';
    try { await expect(getDatabase()).rejects.toThrow('Connect durable storage'); } finally { delete process.env.VERCEL; }
  });
  it('keeps cache expiry independent from saved snapshots and preserves zero/null', async () => {
    await setCached('expired', { goals: 0, assists: null }, -1); expect(await getCached('expired')).toBeNull();
    await setCached('current', { goals: 0, assists: null }, 60); expect(await getCached('current')).toEqual({ goals: 0, assists: null });
    expect((await listEpisodes()).length).toBeGreaterThan(0);
  });
});


describe('HTTP access and media boundaries', () => {
  it('signs in via protected login and uses the cookie for producer state reads', async () => {
    const response = await login(new Request('https://studio.test/api/session', { method: 'POST', headers: { origin: 'https://studio.test', 'x-tgiq-csrf': '1' }, body: JSON.stringify({ password: 'correct test password' }) }));
    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie')!;
    expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('Secure');
    const program = await readProgram(new Request('https://studio.test/api/program', { headers: { cookie } }));
    expect(program.status).toBe(200); expect(await program.json()).toHaveProperty('version');
  });
  it('does not rate-limit repeated successful producer sign-ins', async () => {
    for (let index = 0; index < 12; index++) {
      const response = await login(new Request('https://studio.test/api/session', { method: 'POST', headers: { 'x-tgiq-csrf': '1', 'x-forwarded-for': 'test-normal-signins' }, body: JSON.stringify({ password: 'correct test password' }) }));
      expect(response.status).toBe(200);
    }
  });
  it('still rate-limits repeated failed sign-ins', async () => {
    for (let index = 0; index < 11; index++) {
      const response = await login(new Request('https://studio.test/api/session', { method: 'POST', headers: { 'x-tgiq-csrf': '1', 'x-forwarded-for': 'test-invalid-signins' }, body: JSON.stringify({ password: 'wrong test password' }) }));
      expect(response.status).toBe(index < 10 ? 401 : 429);
    }
  });
  it('keeps the output token read-only and denies uncredentialed reads', async () => {
    const token = await rotateOutputToken();
    const read = await readProgram(new Request(`https://studio.test/api/program?token=${token}`)); expect(read.status).toBe(200);
    const unauthorized = await readProgram(new Request('https://studio.test/api/program')); expect(unauthorized.status).toBe(401);
    const state = await getProgram();
    const mutation = await writeProgram(new Request(`https://studio.test/api/program?token=${token}`, { method: 'POST', headers: { 'x-tgiq-csrf': '1' }, body: JSON.stringify({ action: 'clear', expectedVersion: state.version }) }));
    expect(mutation.status).toBe(401); expect(await getProgram()).toEqual(state);
  });
  it('rejects incompatible import schemas without creating an episode', async () => {
    const count = (await listEpisodes()).length; const cookie = `tgiq_producer=${makeSession()}`;
    const response = await importEpisode(new Request('https://studio.test/api/episodes', { method: 'POST', headers: { cookie, 'x-tgiq-csrf': '1' }, body: JSON.stringify({ import: { schemaVersion: 99 } }) }));
    expect(response.status).toBe(400); expect((await listEpisodes()).length).toBe(count);
  });
  it('persists image bytes and origin metadata through reopen', async () => {
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
    const file = new File([bytes], 'identity.png', { type: 'image/png' });
    const saved = await saveAsset(file, { origin: 'Producer-owned test image', attribution: 'Production', rights: 'Test fixture' });
    await closeDatabase(); const read = await getAsset(saved.id);
    expect(read.bytes_base64).toBe(bytes.toString('base64')); expect(read.origin).toBe('Producer-owned test image'); expect(read.sha256).toBe(saved.sha256);
  });
  it('rejects an image with a forged MIME type', async () => {
    const file = new File(['This is not a PNG picture'], 'identity.png', { type: 'image/png' });
    await expect(saveAsset(file, {})).rejects.toMatchObject({ status: 400 });
  });
});


describe('passwordless producer sessions', () => {
  async function openMode<T>(callback: () => Promise<T>) {
    const mode = process.env.PRODUCER_AUTH_MODE; const password = process.env.PRODUCER_PASSWORD_HASH;
    process.env.PRODUCER_AUTH_MODE = 'open'; delete process.env.PRODUCER_PASSWORD_HASH;
    try { return await callback(); } finally { process.env.PRODUCER_AUTH_MODE = mode; if(password) process.env.PRODUCER_PASSWORD_HASH = password; }
  }
  it('opens the studio without a password and issues a signed protected cookie', async () => openMode(async () => {
    expect(authConfigured()).toBe(true);
    const response = await readSession(new Request('https://studio.test/api/session'));
    expect(await response.json()).toEqual({authenticated:true,configured:true,mode:'open'});
    const cookie=response.headers.get('set-cookie')!;
    expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('SameSite=Strict'); expect(cookie).toContain('Secure');
    const token=cookie.split(';')[0].split('=')[1]; expect(validSession(token)).toBe(true);
  }));
  it('keeps a producer cookie required until the studio session is opened', async () => openMode(async () => {
    const before=await readProgram(new Request('https://studio.test/api/program')); expect(before.status).toBe(401); expect(before.headers.get('set-cookie')).toBeNull();
    const session=await readSession(new Request('https://studio.test/api/session')); const cookie=session.headers.get('set-cookie')!.split(';')[0];
    const after=await readProgram(new Request('https://studio.test/api/program',{headers:{cookie}})); expect(after.status).toBe(200);
    const reload=await readSession(new Request('https://studio.test/api/session',{headers:{cookie}})); expect((await reload.json()).authenticated).toBe(true); expect(reload.headers.get('set-cookie')).toBeNull();
  }));
  it('never turns a read-only output token into producer access', async () => openMode(async () => {
    const token=await rotateOutputToken(); const state=await getProgram();
    const read=await readProgram(new Request(`https://studio.test/api/program?token=${token}`)); expect(read.status).toBe(200); expect(read.headers.get('set-cookie')).toBeNull();
    const write=await writeProgram(new Request(`https://studio.test/api/program?token=${token}`,{method:'POST',headers:{'x-tgiq-csrf':'1'},body:JSON.stringify({action:'clear',expectedVersion:state.version})})); expect(write.status).toBe(401); expect(await getProgram()).toEqual(state);
  }));
  it('retains origin and CSRF protection with an automatic producer cookie', async () => openMode(async () => {
    const blocked=await readSession(new Request('https://studio.test/api/session',{headers:{origin:'https://outside.test'}})); expect(blocked.status).toBe(403); expect(blocked.headers.get('set-cookie')).toBeNull();
    const session=await readSession(new Request('https://studio.test/api/session')); const cookie=session.headers.get('set-cookie')!.split(';')[0];const state=await getProgram();
    const write=await writeProgram(new Request('https://studio.test/api/program',{method:'POST',headers:{cookie},body:JSON.stringify({action:'clear',expectedVersion:state.version})}));expect(write.status).toBe(403);expect(await getProgram()).toEqual(state);
    const post=await login(new Request('https://studio.test/api/session',{method:'POST',headers:{'x-tgiq-csrf':'1',origin:'https://studio.test'}}));expect(post.status).toBe(200);expect((await post.json()).mode).toBe('open');
  }));
  it('still requires configured session signing instead of issuing unsigned cookies', async () => openMode(async () => {
    const secret=process.env.SESSION_SECRET;delete process.env.SESSION_SECRET;
    try { const response=await readSession(new Request('https://studio.test/api/session'));expect(await response.json()).toEqual({authenticated:false,configured:false,mode:'open'});expect(response.headers.get('set-cookie')).toBeNull(); } finally {process.env.SESSION_SECRET=secret;}
  }));
});
