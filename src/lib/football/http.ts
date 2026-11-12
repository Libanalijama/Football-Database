import { AsyncLocalStorage } from 'node:async_hooks';
import { z } from 'zod';
import { getCached, setCached } from '../server/db';

export class ProviderError extends Error {
  constructor(public code: string, message: string, public status = 503) { super(message); this.name = 'ProviderError'; }
}
export type SourceDocument = { body: Record<string, unknown>; sourceUrl: string; retrievedAt: string };
type CacheEntry = { document: SourceDocument; expires: number };
const freshness = new AsyncLocalStorage<boolean>();
export function withFreshProviderData<T>(fresh:boolean,work:()=>Promise<T>):Promise<T>{return freshness.run(fresh,work);}
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<SourceDocument>>();
let nextSlot = 0;
let blockedUntil = 0;
const rootSchema = z.record(z.string(), z.unknown());
const allowedHosts = new Set(['site.api.espn.com', 'site.web.api.espn.com', 'www.espn.com']);
const wait = (milliseconds:number) => new Promise(resolve => setTimeout(resolve, milliseconds));

/** Public page JSON only: never evaluates scripts or follows provider-private references. */
export function parseEspnPageData(html:string):Record<string,unknown> {
  const marker = "window['__espnfitt__']=";
  const start = html.indexOf(marker);
  if (start < 0) throw new ProviderError('SCHEMA_CHANGED', 'ESPN page data is unavailable.');
  const content = html.slice(start + marker.length);
  let depth=0, quoted=false, escaped=false, end=-1;
  for (let i=0; i<content.length; i++) {
    const char=content[i];
    if (quoted) { if (escaped) escaped=false; else if (char==='\\') escaped=true; else if(char==='"') quoted=false; continue; }
    if(char==='"') quoted=true;
    else if(char==='{') depth++;
    else if(char==='}') { depth--; if(depth===0){end=i+1;break;} }
  }
  if (end<0) throw new ProviderError('SCHEMA_CHANGED', 'ESPN page data is incomplete.');
  try { return rootSchema.parse(JSON.parse(content.slice(0,end))); }
  catch { throw new ProviderError('SCHEMA_CHANGED', 'ESPN page data format changed.'); }
}

export async function espnRequest(url:string, ttl=300_000, page=false):Promise<SourceDocument> {
  const parsed = new URL(url);
  if (parsed.protocol!=='https:' || !allowedHosts.has(parsed.hostname)) throw new ProviderError('INVALID_SOURCE', 'Unsupported source.',400);
  const force=freshness.getStore()===true;
  const existing=force?undefined:cache.get(url);
  if(existing && existing.expires>Date.now()) return existing.document;
  const inflight=pending.get(url); if(inflight) return inflight;
  const task=(async()=>{
    try {
      const saved = force ? null : await getCached<SourceDocument>(`espn:${url}`);
      /* Preserve finite retention even for durable response caching. */

      if(saved && rootSchema.safeParse(saved.body).success && saved.sourceUrl===url && typeof saved.retrievedAt==='string'){cache.set(url,{document:saved,expires:Date.now()+Math.max(0,ttl-(Date.now()-Date.parse(saved.retrievedAt)))});return saved;}
    } catch { /* Data browsing remains available if the independent cache storage is down. */ }
    if(blockedUntil>Date.now()) throw new ProviderError('RATE_LIMITED','ESPN is temporarily unavailable; retry shortly.',429);
    const slot=Math.max(Date.now(),nextSlot); nextSlot=slot+250;
    if(slot-Date.now()>15_000) throw new ProviderError('BUSY','Data requests are busy. Retry shortly.',429);
    await wait(Math.max(0,slot-Date.now()));
    for(let attempt=0;attempt<2;attempt++) {
      let response:Response;
      try { response=await fetch(url,{headers:{Accept:page?'text/html':'application/json','User-Agent':'TGIQ-Production/1.0'},signal:AbortSignal.timeout(8000),cache:'no-store'}); }
      catch(error) { throw new ProviderError('TIMEOUT',error instanceof Error && /abort|timeout/i.test(error.name+' '+error.message)?'ESPN request timed out.':'ESPN could not be reached.'); }
      if(response.status===429) { blockedUntil=Date.now()+Math.max(30_000, Math.min(120_000,Number(response.headers.get('retry-after')||30)*1000)); throw new ProviderError('RATE_LIMITED','ESPN rate limit reached; retry later.',429); }
      if(response.status>=500 && attempt===0) { await wait(600); continue; }
      if(!response.ok) throw new ProviderError(response.status===404?'UNAVAILABLE':'SOURCE_ERROR',`ESPN returned ${response.status}.`,response.status===404?404:503);
      let body:Record<string,unknown>;
      try { body=page?parseEspnPageData(await response.text()):rootSchema.parse(await response.json()); }
      catch(error) { if(error instanceof ProviderError) throw error; throw new ProviderError('SCHEMA_CHANGED','ESPN response format changed.'); }
      const document={body,sourceUrl:url,retrievedAt:new Date().toISOString()};
      try { await setCached(`espn:${url}`,document,Math.floor(ttl/1000)); } catch { /* Cache persistence cannot turn a successful source fetch into a source failure. */ }
      cache.delete(url); cache.set(url,{document,expires:Date.now()+ttl});
      while(cache.size>250) cache.delete(cache.keys().next().value!);
      return document;
    }
    throw new ProviderError('SOURCE_ERROR','ESPN is unavailable.');
  })();
  pending.set(url,task);
  try{return await task;}finally{pending.delete(url);}
}
export function clearProviderCache(){cache.clear();pending.clear();nextSlot=0;blockedUntil=0;}
