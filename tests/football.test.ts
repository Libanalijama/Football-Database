import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeMetrics, normalizeMatch, normalizeEvents, normalizeStandings, normalizeLeaders, normalizePlayer } from '../src/lib/football/normalize';
import { parseEspnPageData, espnRequest, clearProviderCache, withFreshProviderData } from '../src/lib/football/http';
import { getLeague, getPlayer, getTeam } from '../src/lib/football/espn';
import { reconcileMetrics } from '../src/lib/football/supplement';
import type { Provenance } from '../src/lib/football/types';
const scope:Provenance={provider:'espn',sourceUrl:'https://site.api.espn.com/verified',retrievedAt:'2026-11-12T23:00:00Z',competition:'eng.1',season:2024,scope:'competition-season',teamId:'359'};
const team=(id:string,name=id)=>({id,displayName:name});
function fixture(status:Record<string,unknown>,extra:Record<string,unknown>={}){return {id:'99',season:{year:2024},competitions:[{date:'2024-10-01T19:00Z',status:{type:status},competitors:[{homeAway:'home',team:team('1','Home'),score:'0',...extra},{homeAway:'away',team:team('2','Away'),score:'0'}]}]};}
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();clearProviderCache();});
describe('football normalization',()=>{
 it('retains missing values as null and genuine zero as zero',()=>{
  const m=normalizeMetrics([{name:'missing',displayValue:'--'},{name:'zero',value:0,displayValue:'0'},{name:'passPct',value:.9},{name:'possessionPct',value:75.3}],scope);
  expect(m.map(s=>s.value)).toEqual([null,0,.9,75.3]);expect(m.map(s=>s.unit)).toEqual(['count','count','ratio','%']);expect(m[1].provenance).toEqual(scope);
 });
 it('never turns pre-match or cancelled scores into a final 0–0',()=>{
  for(const status of [{state:'pre',name:'STATUS_SCHEDULED',completed:false},{state:'post',name:'STATUS_CANCELED',completed:true}]){const m=normalizeMatch(fixture(status),scope);expect(m.homeScore).toBeNull();expect(m.awayScore).toBeNull();expect(m.completed).toBe(false);}
  expect(normalizeMatch(fixture({state:'post',completed:true,name:'STATUS_FULL_TIME'}),scope).homeScore).toBe(0);
 });
 it('keeps aggregate and shootout separate from regulation score',()=>{
  const m=normalizeMatch(fixture({state:'post',completed:true,name:'STATUS_FULL_TIME'},{score:'1',shootoutScore:'5',aggregateScore:'3'}),scope);
  expect(m.homeScore).toBe(1);expect(m.homeShootout).toBe(5);expect(m.homeAggregate).toBe(3);expect(m.awayShootout).toBeNull();
 });
 it('preserves home-away running order, own goals and in-match penalties without counting shootouts',()=>{
  const events=normalizeEvents([{id:'1',type:{text:'Own Goal'},team:{id:'2'},scoringPlay:true,ownGoal:true,athletesInvolved:[{id:'30',displayName:'Álex Moreno'}]},{id:'2',type:{type:'penalty---scored'},team:{id:'1'},scoringPlay:true,participants:[{athlete:{id:'40',displayName:'Player'}}]},{id:'3',type:{type:'penalty---scored'},team:{id:'1'},scoringPlay:true,shootout:true}], '1','2');
  expect(events.map(e=>[e.homeScore,e.awayScore])).toEqual([[0,1],[1,1],[null,null]]);expect(events[0].player).toBe('Álex Moreno');expect(events[0].ownGoal).toBe(true);expect(events[1].penalty).toBe(true);
 });
 it('orders reversed goals chronologically before deriving the running score',()=>{
  const events=normalizeEvents([{id:'late',scoringPlay:true,type:{text:'Goal'},clock:{value:4200},team:{id:'2'}},{id:'early',scoringPlay:true,type:{text:'Goal'},clock:{value:1200},team:{id:'1'}}],'1','2');expect(events.map(e=>[e.id,e.homeScore,e.awayScore])).toEqual([['early',1,0],['late',1,1]]);
 });
 it('does not invent an absent portrait',()=>{expect(normalizePlayer({id:'123',displayName:'A name'}).portrait).toBeNull();});
 it('retains provider table ranks and points-deduction notes',()=>{
  const rows=normalizeStandings({children:[{name:'League',standings:{entries:[{team:team('1'),stats:[{name:'rank',value:2},{name:'points',value:24},{name:'deductions',value:3}]}]}}]},scope);
  expect(rows[0].rank).toBe(2);expect(rows[0].note).toContain('3 points deducted');expect(rows[0].played).toBeNull();
 });
 it('assigns shared numerical leader ranks and rejects a silently substituted season',()=>{
  const page={page:{content:{statistics:{pageTitle:'Scoring Stats - 2024-25',tables:[{headers:[{type:'rank'},{type:'athlete'},{type:'team'},{type:'totalGoals'}]}],tableRows:[[[1,{name:'One',uid:'s:600~a:1'},{name:'Club',href:'https://www.espn.com/soccer/club/_/id/359/club'},{value:'10'}],[2,{name:'Two',uid:'s:600~a:2'},{name:'Club',href:'https://www.espn.com/soccer/club/_/id/359/club'},{value:'10'}],[3,{name:'Three',uid:'s:600~a:3'},{name:'Club',href:'https://www.espn.com/soccer/club/_/id/359/club'},{value:'8'}]]]}}}};
  expect(normalizeLeaders(page,scope).map(l=>l.rank)).toEqual([1,1,3]);expect(()=>normalizeLeaders(page,{...scope,season:2023})).toThrow('different season');
 });
});
describe('isolated public ESPN page parser',()=>{
 it('reads a bounded JSON object without evaluating a script',()=>{const page={page:{content:{statistics:{text:'brace } and quote " plus slash \\'}}}};expect(parseEspnPageData(`<script>window['__espnfitt__']=${JSON.stringify(page)};throw new Error('must not execute')</script>`)).toEqual(page);});
 it('detects missing and changed page schema',()=>{expect(()=>parseEspnPageData('<html>Changed</html>')).toThrow('unavailable');expect(()=>parseEspnPageData("window['__espnfitt__']={bad};")).toThrow('format changed');});
});
describe('provider request protection',()=>{
 it('coalesces requests and reuses cached responses',async()=>{const fetcher=vi.fn().mockResolvedValue(new Response('{"athlete":{"id":"1"}}',{status:200}));vi.stubGlobal('fetch',fetcher);const u='https://site.api.espn.com/test';const [a,b]=await Promise.all([espnRequest(u),espnRequest(u)]);expect(a).toEqual(b);await espnRequest(u);expect(fetcher).toHaveBeenCalledTimes(1);});
 it('performs a deliberate fresh source request without altering saved snapshots',async()=>{
  const f=vi.fn(async()=>new Response(JSON.stringify({value:f.mock.calls.length})));vi.stubGlobal('fetch',f);const url='https://site.api.espn.com/refresh';expect((await espnRequest(url)).body.value).toBe(1);expect((await espnRequest(url)).body.value).toBe(1);expect((await withFreshProviderData(true,()=>espnRequest(url))).body.value).toBe(2);expect(f).toHaveBeenCalledTimes(2);
 });
 it('rejects private or arbitrary endpoints',async()=>{await expect(espnRequest('http://sports.core.api.espn.pvt/private')).rejects.toMatchObject({code:'INVALID_SOURCE'});});
 it('returns timeout and response-schema errors instead of demo data',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new DOMException('timed out','TimeoutError')));await expect(espnRequest('https://site.api.espn.com/timeout')).rejects.toMatchObject({code:'TIMEOUT'});clearProviderCache();
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('[]')));await expect(espnRequest('https://site.api.espn.com/changed')).rejects.toMatchObject({code:'SCHEMA_CHANGED'});
 });
 it('backs off after rate limiting',async()=>{const f=vi.fn().mockResolvedValue(new Response('',{status:429}));vi.stubGlobal('fetch',f);await expect(espnRequest('https://site.api.espn.com/limited')).rejects.toMatchObject({code:'RATE_LIMITED'});await expect(espnRequest('https://site.api.espn.com/other')).rejects.toMatchObject({code:'RATE_LIMITED'});expect(f).toHaveBeenCalledTimes(1);});
 it('rejects unknown competitions and unavailable historical seasons before loading an entity',async()=>{
  await expect(getLeague('unknown.1')).rejects.toMatchObject({code:'UNKNOWN_COMPETITION'});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({season:{year:2026},seasons:[{year:2026}]}))));await expect(getLeague('eng.1',1901)).rejects.toMatchObject({code:'SEASON_UNAVAILABLE'});
 });
 it('reports a missing roster honestly while retaining the verified team',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(input:string)=>new Response(JSON.stringify(input.includes('standings')?{season:{year:2026},seasons:[{year:2026}],children:[{standings:{entries:[{team:team('359','Arsenal'),stats:[{name:'rank',value:1}]}]}}]}:input.includes('/roster?')?{season:{year:2026},team:team('359','Arsenal'),athletes:[]}:{season:{year:2026},events:[]}))));
  const result=await getTeam('eng.1','359',2026);expect(result.squad).toEqual([]);expect(result.capabilities.squad.available).toBe(false);expect(result.team.name).toBe('Arsenal');
 });
 it('uses selected-season roster figures instead of current biography statistics',async()=>{
  vi.stubEnv('API_FOOTBALL_KEY','unavailable-optional-key');vi.stubEnv('SPORTMONKS_API_TOKEN','unavailable-optional-key');
  vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
   const data=input.endsWith('/standings')?{season:{year:2026},seasons:[{year:2026},{year:2024}]}:input.includes('standings?')?{season:{year:2024}}:input.includes('/roster?')?{season:{year:2024},team:team('359','Arsenal'),athletes:[{id:'280555',displayName:'Bukayo Saka',statistics:{splits:{categories:[{stats:[{name:'totalGoals',value:16,displayValue:'16'}]}]}}}]}:input.includes('/overview?')?{statistics:{names:['totalGoals'],displayNames:['Goals'],splits:[{leagueSlug:'eng.1',teamId:'359',displayName:'2026-27 English Premier League',stats:['3']}]}}:{athlete:{id:'280555',displayName:'Bukayo Saka',team:team('359','Arsenal'),statsSummary:{statistics:[{name:'totalGoals',value:3}]}}};return new Response(JSON.stringify(data));
  }));
  const result=await getPlayer('eng.1','280555',2024,'359');expect(result.statistics[0].value).toBe(16);expect(result.statistics[0].provenance.season).toBe(2024);expect(result.player.scope?.scope).toBe('current-profile');expect(result.notices.join(' ')).toContain('current profile');
 });
});
describe('supplementary source reconciliation',()=>{
 it('requires explicit identity mappings and preserves conflicting records',()=>{
  const metric=normalizeMetrics([{name:'totalGoals',value:5}],scope)[0];const a={entity:{provider:'espn' as const,id:'100',kind:'player' as const},metric,definition:'Competition goals'};const b={entity:{provider:'api-football' as const,id:'other',kind:'player' as const},metric:{...metric,value:6,provenance:{...scope,provider:'api-football' as const}},definition:'Competition goals'};const mapping={primary:a.entity,secondary:b.entity,verifiedBy:'Producer',verifiedAt:'2026-11-12',sourceUrl:'https://source.example/identity'};
  expect(reconcileMetrics(a,b,mapping)).toMatchObject({conflict:true,selectedProvider:'espn'});expect(reconcileMetrics(a,b,mapping).records).toHaveLength(2);expect(()=>reconcileMetrics(a,{...b,metric:{...b.metric,unit:'per 90'}},mapping)).toThrow('scope, units or definition');expect(()=>reconcileMetrics(a,b,{...mapping,secondary:{...b.entity,id:'name-only'}})).toThrow('mapping');
 });
});
