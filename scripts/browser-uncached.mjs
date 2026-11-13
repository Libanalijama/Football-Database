/** Read-only cache inspection plus first-use UI browsing. Never clears source caches. */
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { enterProducer } from './browser-access.mjs';
import pg from 'pg';
const BASE = process.env.TGIQ_TEST_URL || 'https://tgiq-football-database.vercel.app';
const accessPath = process.env.TGIQ_TEST_ACCESS || '.data/production-access.json';
const prefix = process.env.TGIQ_EVIDENCE_PREFIX || 'live-';
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.DATABASE_URL_POOLED;
if (!connectionString) throw Error('Load the target database environment before inspecting its source cache.');
const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1600, height: 1080 } });
const page = await context.newPage();
const result = { target: BASE, checkedAt: new Date().toISOString(), cacheInspection: 'SELECT-only on the configured remote PostgreSQL provider_cache; no deletion or entity insertion', checks: [], subjects: [], browserErrors: [] };
const mutations = [];
page.on('pageerror', e => result.browserErrors.push(e.message));
page.on('request', r => { if (r.method() !== 'GET' && /\/api\/(program|episodes|assets|football)/.test(r.url())) mutations.push({ method: r.method(), path: new URL(r.url()).pathname }); });
function check(name, pass) { result.checks.push({ name, pass: Boolean(pass) }); if (!pass) throw Error(name); }
async function cacheRows(pattern) {
 const rows = (await pool.query('SELECT cache_key, created_at, expires_at, payload FROM provider_cache WHERE cache_key LIKE $1 ORDER BY cache_key', [pattern])).rows;
 return rows.map(r => { let doc = {}; try { doc = JSON.parse(r.payload); } catch {} return { sourceUrl: r.cache_key.replace(/^espn:/, ''), createdAt: r.created_at, expiresAt: r.expires_at, retrievedAt: doc.retrievedAt ?? null }; });
}
const isFootball = (r, kind, id) => { const u = new URL(r.url()); return u.pathname === '/api/football' && u.searchParams.get('kind') === kind && u.searchParams.get('id') === id; };
try {
 result.access = await enterProducer(page, { baseURL: BASE, accessPath });
 check('Producer workspace opens', result.access.authenticated);
 const status = await context.request.get('/api/football?kind=status').then(r => r.json());
 result.providerStatus = status.data;
 check('ESPN requires no key and both paid providers are absent', status.data.espn.keyRequired === false && status.data.optional.every(p => !p.configured));
 const panel = page.locator('.browser-column');
 for (const subject of [{ competition: 'eng.1', teamId: '370', teamName: 'Fulham' }, { competition: 'esp.1', teamId: '94', teamName: 'Valencia' }]) {
  const entry = { ...subject, checkedAt: new Date().toISOString() };
  result.subjects.push(entry);
  await page.locator('select[aria-label="Competition"]').selectOption(subject.competition);
  const teamButton = panel.getByRole('button', { name: new RegExp('^' + subject.teamName + ' ') });
  await teamButton.waitFor({ timeout: 45000 });
  entry.season = await page.locator('select[aria-label="Season"]').inputValue();
  const rosterPattern = `%/${subject.competition}/teams/${subject.teamId}/roster%`;
  entry.rosterCacheBefore = await cacheRows(rosterPattern);
  check(`${subject.teamName} roster was absent from durable source cache before selection`, entry.rosterCacheBefore.length === 0);
  const rosterResponse = page.waitForResponse(r => isFootball(r, 'team', subject.teamId), { timeout: 45000 });
  await teamButton.click();
  const roster = await rosterResponse;
  entry.rosterHttpStatus = roster.status();
  const teamData = (await roster.json()).data;
  check(`${subject.teamName} team and squad retrieved successfully`, roster.ok() && teamData.team.id === subject.teamId && teamData.squad.length > 0);
  entry.squadSize = teamData.squad.length;
  entry.rosterProvenance = teamData.provenance;
  const playerButton = panel.locator('button[data-entity-kind="player"]').first();
  await playerButton.waitFor({ timeout: 45000 });
  entry.playerId = await playerButton.getAttribute('data-entity-id');
  check(`${subject.teamName} dynamically selected player belongs to returned roster`, teamData.squad.some(p => p.id === entry.playerId));
  const playerPattern = `%/${subject.competition}/athletes/${entry.playerId}%`;
  entry.playerCacheBefore = await cacheRows(playerPattern);
  check(`${subject.teamName} player profile and overview were uncached before opening`, entry.playerCacheBefore.length === 0);
  const profileResponse = page.waitForResponse(r => isFootball(r, 'player', entry.playerId), { timeout: 45000 });
  await playerButton.click();
  const profile = await profileResponse;
  entry.playerHttpStatus = profile.status();
  const playerData = (await profile.json()).data;
  check(`${subject.teamName} player identity and team match the selected provider IDs`, profile.ok() && playerData.player.id === entry.playerId && playerData.player.team?.id === subject.teamId);
  entry.playerName = playerData.player.name;
  entry.photoAvailable = Boolean(playerData.player.portrait);
  entry.statisticCount = playerData.statistics.length;
  entry.profileProvenance = playerData.player.scope;
  entry.statisticsProvenance = playerData.provenance;
  await panel.getByRole('button', { name: 'Prepare graphic', exact: true }).waitFor({ timeout: 45000 });
  await panel.getByRole('button', { name: 'Prepare graphic', exact: true }).click();
  check(`${subject.teamName} uncached player populates the reusable profile`, (await page.getByLabel('Graphic title').inputValue()) === entry.playerName && (await page.getByLabel('Graphic template').inputValue()) === 'profile-player');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.getByText('Preview ready', { exact: true }).waitFor({ timeout: 30000 });
  entry.rosterCacheAfter = await cacheRows(rosterPattern);
  entry.playerCacheAfter = await cacheRows(playerPattern);
  check(`${subject.teamName} successful provider responses were cached after first use`, entry.rosterCacheAfter.length > 0 && entry.playerCacheAfter.length > 0);
  await page.locator('.prepared-column').evaluate(el => el.scrollTop = 0);
  await page.screenshot({ path: `docs/${prefix}uncached-${subject.teamId}.png`, fullPage: true });
 }
 check('No entities, episodes, assets or program state manually created or mutated', mutations.length === 0);
 check('No browser runtime errors', result.browserErrors.length === 0);
} catch (error) {
 result.failure = String(error);
 await page.screenshot({ path: `docs/${prefix}uncached-failure.png`, fullPage: true });
 process.exitCode = 1;
} finally {
 result.mutations = mutations;
 await fs.writeFile(`docs/${prefix}uncached-results.json`, JSON.stringify(result, null, 2));
 console.log(JSON.stringify(result, null, 2));
 await browser.close();
 await pool.end();
}
