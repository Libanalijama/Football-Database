/** Explicitly authorised test of the dedicated private TGIQ Blob store. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { saveAsset } from '../src/lib/server/assets';
import { getDatabase, closeDatabase } from '../src/lib/server/db';
import { makeSession } from '../src/lib/server/auth';
import { GET as readImage } from '../src/app/api/assets/[id]/route';
async function main(){
 process.loadEnvFile('.env.local'); process.loadEnvFile('.env.production.local');
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
 let id:string|undefined; let url:string|undefined;
 try{
  const asset=await saveAsset(new File([bytes],'private-store-verification.png',{type:'image/png'}),{origin:'Agent-owned transparent pixel test fixture',attribution:'Build verification',rights:'Test-only; removed after verification'});id=asset.id;assert.equal(asset.storage,'object');
  const db=await getDatabase();const row=await db.query('SELECT url,bytes_base64 FROM assets WHERE id=$1',[id]);url=String(row.rows[0].url);assert.equal(row.rows[0].bytes_base64,null);
  const unauthorized=await readImage(new Request(`https://studio.test/api/assets/${id}`),{params:Promise.resolve({id})});assert.equal(unauthorized.status,401);
  const authorized=await readImage(new Request(`https://studio.test/api/assets/${id}`,{headers:{cookie:`tgiq_producer=${makeSession()}`}}),{params:Promise.resolve({id})});assert.equal(authorized.status,200);assert.equal(authorized.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await authorized.arrayBuffer()),bytes);
  const direct=await fetch(url);assert(!direct.ok,'Private object must deny unauthenticated direct access');
  const report={verifiedAt:new Date().toISOString(),store:'tgiq-football-media',region:'fra1',access:'private',authenticated:true,checks:['Private object upload','Durable metadata in PostgreSQL','Unauthenticated app read denied','Authenticated app stream byte integrity','Direct public object read denied'],checksPassed:5};
  writeFileSync('docs/BLOB_VERIFICATION.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }finally{if(id)await(await getDatabase()).query('DELETE FROM assets WHERE id=$1',[id]);if(url){const{del}=await import('@vercel/blob');await del(url,{token:process.env.BLOB_READ_WRITE_TOKEN});}await closeDatabase();}
}
main().catch(error=>{console.error('Private media verification failed:',error instanceof Error?error.message.replace(/(?:postgres(?:ql)?|prisma):\/\/[^\s]+/g,'[redacted connection]'):'Unknown error');process.exitCode=1;});
