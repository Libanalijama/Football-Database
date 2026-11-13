/** Authenticated, explicitly requested cloud verification. No runtime/demo data is added. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { getDatabase, migrateDatabase, closeDatabase, getCached, setCached } from '../src/lib/server/db';
import { createEpisode, getEpisode, updateEpisode, getProgram, mutateProgram, rotateOutputToken, validOutputToken, missingMedia } from '../src/lib/server/store';
import { saveAsset, getAsset } from '../src/lib/server/assets';
import { episodeSchema } from '../src/lib/server/models';
import { tokenHash } from '../src/lib/server/auth';
import { createGraphic } from '../src/lib/graphics/registry';

async function main() {
  assert(existsSync('.env.production.local'), 'Configure .env.production.local with the authorised TGIQ database first');
  process.loadEnvFile('.env.production.local');
  assert(process.env.DATABASE_URL, 'DATABASE_URL required');
  const checks: string[] = []; const episodeIds: string[] = []; const assetIds: string[] = []; const blobUrls: string[] = []; const cacheKey = `verification:${randomUUID()}`;
  let initialProgram: Awaited<ReturnType<typeof getProgram>> | undefined;
  let programChanged = false; let originalOutputHash: string | null = null; let ownedOutputHash: string | null = null; let verificationGraphicId: string | null = null;
  try {
    await migrateDatabase();
    const db = await getDatabase(); assert.equal(db.kind, 'postgres');
    const basic = await db.query('SELECT 1 AS connected'); assert.equal(Number(basic.rows[0].connected), 1); checks.push('Authenticated PostgreSQL SELECT');
    const migration = await db.query('SELECT version FROM tgiq_migrations WHERE version=1'); assert.equal(Number(migration.rows[0].version),1); checks.push('Schema migration 1');
    initialProgram = await getProgram(); assert(initialProgram.graphic === null, 'Verification requires a deliberately blank program; current snapshot preserved');
    const originalAccess=await db.query("SELECT output_token_hash FROM program WHERE id='main'"); originalOutputHash=originalAccess.rows[0].output_token_hash ? String(originalAccess.rows[0].output_token_hash) : null;
    const graphic = createGraphic('profile-player'); verificationGraphicId=graphic.id; graphic.title = 'Database verification'; graphic.fields['Nationality'] = 'Test-only editorial value';
    const episode = await createEpisode(`Database verification ${new Date().toISOString()}`); episodeIds.push(episode.id);
    const saved = await updateEpisode(episode.id, { expectedVersion: episode.version, items: [{ id:randomUUID(), title:'Persistence verification', graphic, subjectIds:['verification:identity'], sourceScope:{competition:'test',season:'test-only'}, sourceSnapshot:{zero:0,missing:null}, overrides:{editorial:'Retained independently'}, mediaIds:['missing-test-only'] }] });
    assert.deepEqual((await getEpisode(saved.id)).items[0].sourceSnapshot,{zero:0,missing:null}); assert.deepEqual(await missingMedia(saved),['missing-test-only']); checks.push('Episode source snapshot, overrides, null versus zero, missing-media report');
    assert.deepEqual(episodeSchema.parse(JSON.parse(JSON.stringify(saved))),saved); checks.push('Episode JSON schema roundtrip');
    const duplicate = await createEpisode(`${saved.name} copy`,saved); episodeIds.push(duplicate.id); assert.notEqual(duplicate.id,saved.id); assert.notEqual(duplicate.items[0].id,saved.items[0].id); assert.deepEqual(duplicate.items[0].graphic,saved.items[0].graphic); checks.push('Duplicate episode/rundown identities');
    await assert.rejects(updateEpisode(saved.id,{expectedVersion:1,name:'Stale'}),{status:409}); checks.push('Episode stale-write rejection');
    const taken = await mutateProgram({action:'take',expectedVersion:initialProgram.version,graphic}); programChanged = true; assert.deepEqual(taken.graphic,graphic); checks.push('Authoritative program snapshot');
    const concurrent = await Promise.allSettled([mutateProgram({action:'freeze',expectedVersion:taken.version}),mutateProgram({action:'unfreeze',expectedVersion:taken.version})]); assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1); assert.equal(concurrent.filter(x=>x.status==='rejected').length,1); checks.push('Concurrent program compare-and-swap');
    const current = await getProgram(); const frozen = await mutateProgram({action:'freeze',expectedVersion:current.version}); assert(frozen.frozen); assert.deepEqual(frozen.graphic,graphic); checks.push('Freeze without provider dependency');
    await closeDatabase(); const restored = await getProgram(); assert.deepEqual(restored,frozen); assert.deepEqual((await getEpisode(saved.id)).items[0].overrides,{editorial:'Retained independently'}); checks.push('Connection reopen persistence');
    const tokenA = await rotateOutputToken(); assert(await validOutputToken(tokenA)); const tokenB = await rotateOutputToken(); ownedOutputHash=tokenHash(tokenB); assert(!await validOutputToken(tokenA)); assert(await validOutputToken(tokenB)); checks.push('Revocable read-only access token digests');
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
    const asset = await saveAsset(new File([bytes],'verification.png',{type:'image/png'}),{origin:'Agent-owned test fixture',attribution:'Database verification',rights:'Test-only; removed after verification'}); assetIds.push(asset.id);
    const read = await getAsset(asset.id); assert.equal(read.sha256,asset.sha256);
    if(read.url){ blobUrls.push(String(read.url)); const { get }=await import('@vercel/blob'); const stored=await get(String(read.url),{access:'private',token:process.env.BLOB_READ_WRITE_TOKEN}); assert(stored?.statusCode===200); assert.deepEqual(Buffer.from(await new Response(stored.stream).arrayBuffer()),bytes); const publicRead=await fetch(String(read.url)); assert(!publicRead.ok); checks.push('Authenticated private Blob upload/read, public denial, media origin/hash'); }
    else { assert.equal(read.bytes_base64,bytes.toString('base64')); checks.push('Durable database media bytes/origin/hash'); }
    await setCached(cacheKey,{zero:0,missing:null},60); assert.deepEqual(await getCached(cacheKey),{zero:0,missing:null}); checks.push('Independent provider cache');
    const latest = await getProgram(); await mutateProgram({action:'clear',expectedVersion:latest.version}); checks.push('Deliberate clear');
    const report = { verifiedAt:new Date().toISOString(),storage:'Prisma Postgres',plan:'Free',authenticated:true,checks,checksPassed:checks.length,cloudHostingDeployed:false };
    writeFileSync('docs/POSTGRES_VERIFICATION.json',JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  } finally {
    const db = await getDatabase();
    // Only agent-created verification rows in the newly provisioned database are removed.
    for(const id of episodeIds) await db.query('DELETE FROM episodes WHERE id=$1',[id]);
    for(const id of assetIds) await db.query('DELETE FROM assets WHERE id=$1',[id]);
    if(blobUrls.length){const {del}=await import('@vercel/blob');await del(blobUrls,{token:process.env.BLOB_READ_WRITE_TOKEN});}
    await db.query('DELETE FROM provider_cache WHERE cache_key=$1',[cacheKey]);
    if(programChanged && initialProgram){ const current=await getProgram(); if(current.graphic?.id===verificationGraphicId) await mutateProgram({action:'clear',expectedVersion:current.version}); const last=await getProgram(); if(last.frozen!==initialProgram.frozen) await mutateProgram({action:initialProgram.frozen?'freeze':'unfreeze',expectedVersion:last.version}); if(ownedOutputHash) await db.query("UPDATE program SET output_token_hash=$1 WHERE id='main' AND output_token_hash=$2",[originalOutputHash,ownedOutputHash]); }
    await closeDatabase();
  }
}
main().catch(error=>{console.error('Remote PostgreSQL verification failed:',error instanceof Error?error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[redacted connection]'):'Unknown error');process.exitCode=1;});
