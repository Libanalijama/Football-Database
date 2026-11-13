import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { Pool } from 'pg';
import { del } from '@vercel/blob';
const access=JSON.parse(readFileSync('.data/production-access.json','utf8'));
const base=access.url;let cookie='';const checks=[];const timings=[];let assetId;let episodeId;
const request=async(path,options={})=>{const started=performance.now();const response=await fetch(base+path,{...options,headers:{...options.headers,...(cookie?{cookie}:{})},signal:AbortSignal.timeout(40000)});timings.push({path:path.split('?')[0],status:response.status,ms:Math.round(performance.now()-started)});return response;};
const readJson=async(response)=>{assert(response.headers.get('content-type')?.includes('application/json'),`Expected JSON, received HTTP ${response.status}`);return response.json();};
const mutate=async(path,value)=>request(path,{method:'POST',headers:{'Content-Type':'application/json','x-tgiq-csrf':'1',origin:base},body:JSON.stringify(value)});
try{
 const health=await readJson(await request('/api/health'));assert(health.ready&&health.storage.kind==='postgres'&&health.media.objectStorage);checks.push('Public production health: PostgreSQL and object storage ready');
 const unauthorized=await request('/api/football?kind=competitions');assert.equal(unauthorized.status,401);checks.push('Producer data requires authentication');
 const signedIn=await mutate('/api/session',{password:access.producerPassword});assert.equal(signedIn.status,200);cookie=signedIn.headers.get('set-cookie').split(';')[0];assert(signedIn.headers.get('set-cookie').includes('Secure'));checks.push('Production-only producer credentials authenticate with secure session');
 const statuses=await readJson(await request('/api/football?kind=status'));assert(statuses.data);checks.push('Provider operational status available');
 const scopes=[];
 for(const competition of ['eng.1','esp.1']){
  const league=await readJson(await request(`/api/football?kind=league&competition=${competition}`));assert(league.data.teams.length>1);const season=league.data.season;const team=league.data.teams[Math.min(3,league.data.teams.length-1)];
  const roster=await readJson(await request(`/api/football?kind=team&competition=${competition}&season=${season}&id=${team.id}`));assert(roster.data.squad.length);const subject=roster.data.squad[0];
  const profile=await readJson(await request(`/api/football?kind=player&competition=${competition}&season=${season}&id=${subject.id}&teamId=${team.id}`));assert.equal(profile.data.player.id,subject.id);assert(profile.data.player.name);assert.equal(profile.data.provenance.provider,'espn');
  scopes.push({competition,season,teamId:team.id,team:team.name,playerId:subject.id,player:profile.data.player.name,statistics:profile.data.statistics.length,notices:profile.data.notices});checks.push(`No-key ESPN ${competition}: discovered team, roster and player with provenance`);
 }
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');const form=new FormData();form.set('file',new File([bytes],'deployment-verification.png',{type:'image/png'}));form.set('origin','Agent-owned transparent pixel verification fixture');form.set('attribution','Deployment verification');form.set('rights','Test-only; removed after verification');
 const uploaded=await request('/api/assets',{method:'POST',headers:{'x-tgiq-csrf':'1',origin:base},body:form});assert.equal(uploaded.status,201);const asset=(await readJson(uploaded)).asset;assetId=asset.id;assert.equal(asset.storage,'object');
 const image=await request(asset.url);assert.equal(image.status,200);assert.deepEqual(Buffer.from(await image.arrayBuffer()),bytes);checks.push('Deployed private Blob upload and authenticated image delivery');
 const publicImage=await fetch(base+asset.url);assert.equal(publicImage.status,401);checks.push('Deployed private image denies unauthenticated access');
 const forbidden=await fetch(base+'/api/program',{method:'POST',headers:{'Content-Type':'application/json','x-tgiq-csrf':'1',origin:base},body:JSON.stringify({action:'clear',expectedVersion:0})});assert.equal(forbidden.status,401);checks.push('Public requests cannot mutate program');
 const report={verifiedAt:new Date().toISOString(),url:base,commit:'3b09a062dedf1dc9585c60af19a8deca041b2c96',checks,checksPassed:checks.length,scopes,timings,programUntouched:true};writeFileSync('docs/LIVE_HTTP_VERIFICATION.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
} catch(error){console.error('Live verification failed:',error.message);process.exitCode=1;}
finally{
 if(assetId||episodeId){process.loadEnvFile('.env.production.local');const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});try{if(assetId){const {rows}=await pool.query('SELECT url FROM assets WHERE id=$1',[assetId]);if(rows[0]?.url)await del(rows[0].url,{token:process.env.BLOB_READ_WRITE_TOKEN});await pool.query('DELETE FROM assets WHERE id=$1',[assetId]);}if(episodeId)await pool.query('DELETE FROM episodes WHERE id=$1',[episodeId]);}finally{await pool.end();}}
}
