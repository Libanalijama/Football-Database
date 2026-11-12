import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NextRequest } from 'next/server';
import { GET as football } from '../src/app/api/football/route';
import { GET as readProgram, POST as writeProgram } from '../src/app/api/program/route';
import { closeDatabase } from '../src/lib/server/db';
import { hashPassword, makeSession } from '../src/lib/server/auth';
import { rotateOutputToken } from '../src/lib/server/store';
import { clearProviderCache } from '../src/lib/football/http';
import { createGraphic } from '../src/lib/graphics/registry';
const directory=mkdtempSync(join(tmpdir(),'tgiq-source-http-'));
let server:Server,base:string,cookie:string,token:string;
let prior:NodeJS.ProcessEnv;
const actualFetch=globalThis.fetch;
beforeAll(async()=>{
 prior={...process.env};delete process.env.DATABASE_URL;delete process.env.VERCEL;
 process.env.TGIQ_SQLITE_PATH=join(directory,'program.sqlite');process.env.PRODUCER_PASSWORD_HASH=hashPassword('test only');process.env.SESSION_SECRET='f'.repeat(64);
 process.env.API_FOOTBALL_KEY='deliberately-unavailable-optional-provider';process.env.SPORTMONKS_API_TOKEN='deliberately-unavailable-optional-provider';
 cookie=`tgiq_producer=${makeSession()}`;token=await rotateOutputToken();
 server=createServer(async(req,res)=>{
  try{
   const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
   const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
   const url=`http://localhost:${(server.address() as {port:number}).port}${req.url}`;
   const request=new NextRequest(url,{method:req.method,headers,...(req.method==='POST'?{body:Buffer.concat(chunks).toString()}: {})});
   const result=req.url?.startsWith('/api/football')?await football(request):req.method==='POST'?await writeProgram(request):await readProgram(request);
   res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());
  }catch{res.writeHead(500);res.end('Test harness failed');}
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://localhost:${(server.address() as {port:number}).port}`;
 // Only ESPN requests fail. Requests to the real HTTP handlers still travel over localhost.
 vi.stubGlobal('fetch',async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.toString():input.url;
  if(new URL(url).hostname.endsWith('espn.com'))throw new DOMException('Injected source timeout','TimeoutError');
  return actualFetch(input,init);
 });
});
afterAll(async()=>{vi.unstubAllGlobals();clearProviderCache();await new Promise<void>(resolve=>server.close(()=>resolve()));await closeDatabase();process.env=prior;rmSync(directory,{recursive:true,force:true});});
const read=async()=>{const response=await fetch(`${base}/api/program?token=${token}`);expect(response.status).toBe(200);return response.json();};
const mutate=async(input:unknown)=>fetch(`${base}/api/program`,{method:'POST',headers:{cookie,'content-type':'application/json','x-tgiq-csrf':'1',origin:base},body:JSON.stringify(input)});
it('returns a real HTTP provider failure while saved output, prepared switching and reconnect stay stable',async()=>{
 const initial=await read();
 const first=createGraphic('statistics-big-number',{title:'Isolated failure test snapshot',fields:{Value:0,Label:'Recorded zero'},source:{provider:'editorial',attribution:'Test fixture',reportingPeriod:'Test only'}});
 const taken=await mutate({action:'take',expectedVersion:initial.version,graphic:first});expect(taken.status,await taken.clone().text()).toBe(200);const live=await taken.json();
 const frozen=await mutate({action:'freeze',expectedVersion:live.version});expect(frozen.status).toBe(200);const before=await frozen.json();
 clearProviderCache();
 const failure=await fetch(`${base}/api/football?kind=league&competition=eng.1`,{headers:{cookie}});expect(failure.status).toBe(503);expect(await failure.json()).toMatchObject({code:'TIMEOUT'});
 expect(await read()).toEqual(before);
 const second=createGraphic('statistics-big-number',{...first,id:'second-prepared-test-graphic',title:'Second prepared snapshot'});
 const switched=await mutate({action:'take',expectedVersion:before.version,graphic:second});expect(switched.status).toBe(200);const after=await switched.json();expect(after.graphic).toEqual(second);expect(after.frozen).toBe(true);
 await closeDatabase();expect(await read()).toEqual(after);
 const late=await mutate({action:'take',expectedVersion:before.version,graphic:first});expect(late.status).toBe(409);expect(await read()).toEqual(after);
 const denied=await fetch(`${base}/api/program?token=${token}`,{method:'POST',headers:{'content-type':'application/json','x-tgiq-csrf':'1'},body:JSON.stringify({action:'clear',expectedVersion:after.version})});expect(denied.status).toBe(401);expect(await read()).toEqual(after);
});
