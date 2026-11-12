import { describe, expect, it } from 'vitest';
import { createGraphic, pageCount, sharedRanks, templates } from '../src/lib/graphics/registry';
import { graphicSchema, templateIds } from '../src/lib/graphics/schema';
import { graphicReadiness } from '../src/lib/graphics/readiness';
import { groupScorers, runningScores } from '../src/lib/graphics/scorekeeping';
describe('graphic documents and scoring',()=>{
 it('covers every reference plus four table/ranking variants with valid empty documents',()=>{
  expect(templates.filter(t=>t.reference)).toHaveLength(24);expect(templates).toHaveLength(28);
  for(const t of templates)expect(graphicSchema.safeParse(createGraphic(t.id)).success).toBe(true);
  expect(new Set(templates.map(t=>t.id)).size).toBe(templateIds.length);
 });
 it('rejects unknown imported layouts and invalid numeric values',()=>{
  expect(graphicSchema.safeParse({...createGraphic('profile-player'),templateId:'unknown'}).success).toBe(false);
  expect(graphicSchema.safeParse({...createGraphic('statistics-player'),metrics:[{label:'Goals',value:NaN}]}).success).toBe(false);
  expect(()=>createGraphic('unknown')).toThrow();
 });
 it('preserves zero while null remains unavailable, Unicode, scope, units and attribution',()=>{
  const doc=createGraphic('comparison-player',{subjects:[{id:'espn:1',name:'Moisés Caicedo',season:'2024',competition:'eng.1'}],metrics:[{label:'Goals',value:0,other:null,unit:'goals',source:'ESPN season 2024'}],source:{provider:'ESPN',competition:'eng.1',season:'2024'}});
  doc.metrics[0].provenance={provider:'espn',sourceUrl:'https://example.org/stat',retrievedAt:'2026-11-12T20:00:00Z',competition:'eng.1',season:2024,scope:'competition-season',teamId:'359'};doc.metrics[0].rawValue=0;doc.metrics[0].rawUnit='count';doc.metrics[0].key='goals';
  expect(graphicSchema.parse(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
 });
 it('groups scorer minutes and preserves own goal and in-match penalty distinctions',()=>{
  const events=[{team:'home' as const,name:'A',minute:"24′"},{team:'away' as const,name:'B',minute:"39′",ownGoal:true},{team:'home' as const,name:'A',minute:"90+2′"},{team:'away' as const,name:'C',minute:"61′",penalty:true}];
  expect(groupScorers(events,'home')).toEqual([{name:'A',minutes:["24′","90+2′"]}]);
  expect(groupScorers(events,'away').map(e=>e.name)).toEqual(['B (OG)','C (P)']);
  expect(runningScores(events).map(e=>[e.homeScore,e.awayScore])).toEqual([[1,0],[1,1],[2,1],[2,2]]);
 });
 it('never converts an unstarted fixture to a goalless final or merges a cup shootout',()=>{
  const g=createGraphic('scoreboard-cup',{match:{home:{id:'h',name:'Home'},away:{id:'a',name:'Away'},homeScore:null,awayScore:null,status:'Scheduled',events:[]}});
  expect(graphicSchema.parse(g).match?.homeScore).toBeNull();
  g.match={...g.match!,homeScore:3,awayScore:3,status:'After extra time',shootout:{home:2,away:3}};
  expect(graphicSchema.parse(g).match).toMatchObject({homeScore:3,awayScore:3,shootout:{home:2,away:3}});
 });
 it('requires financial source attribution, period and units before take',()=>{
  const graphic=createGraphic('statistics-finances',{metrics:[{label:'Revenue',value:0}]});
  expect(graphicReadiness(graphic)).toContain('Add the source URL.');
  expect(graphicReadiness(graphic)).toContain('Set the financial units.');
  graphic.source={url:'https://example.org/annual-report',attribution:'Annual report',reportingPeriod:'FY2025'};graphic.fields.Units='GBP millions';
  expect(graphicReadiness(graphic)).toEqual([]);
 });
 it('matches transfer, grouped-scorer and detail pagination to their renderer limits',()=>{
  expect(pageCount(createGraphic('transfer-announcement',{fields:{'Initial fee':'10m','Contract':'Five years','Contract end':'2030','Option years':'1'}}))).toBe(2);
  expect(pageCount(createGraphic('transfer-contract',{fields:{'Contract end':'2034','Length at signing':'9.5 years','Deal type':'Extension','Option years':'1'}}))).toBe(2);
  const scoreboard=createGraphic('scoreboard-result',{match:{home:{id:'h',name:'Home'},away:{id:'a',name:'Away'},homeScore:6,awayScore:0,status:'Full time',events:Array.from({length:6},(_,i)=>({team:'home',name:`Scorer ${i}`,minute:String(i)}))}});
  expect(pageCount(scoreboard)).toBe(2);
  scoreboard.match!.events=[{team:'home',name:'A',minute:'1'},{team:'home',name:'A',minute:'2',ownGoal:false,penalty:false}];
  expect(pageCount(scoreboard)).toBe(1);
  expect(pageCount(createGraphic('scoreboard-details',{fields:Object.fromEntries(Array.from({length:7},(_,i)=>[String(i),String(i)]))}))).toBe(2);
 });
 it('uses shared competition ranks and leaves missing numbers unranked',()=>{
  expect(sharedRanks([{value:3},{value:null},{value:5},{value:3},{value:1}]).map(r=>r.rank)).toEqual([1,2,2,4,null]);
 });
 it('paginates dense profile facts, metric cards, long scorer lists and league tables',()=>{
  expect(pageCount(createGraphic('profile-player',{subjects:[{id:'p',name:'Player',facts:Array.from({length:9},(_,i)=>({label:String(i),value:i}))}]}))).toBe(3);
  expect(pageCount(createGraphic('statistics-player',{metrics:Array.from({length:9},(_,i)=>({label:String(i),value:i}))}))).toBe(3);
  expect(pageCount(createGraphic('table-league',{rows:Array.from({length:20},(_,i)=>({label:String(i),rank:i+1}))}))).toBe(3);
  expect(pageCount(createGraphic('comparison-arguments',{rows:Array.from({length:7},(_,i)=>({label:String(i),value:'A',other:'B'}))}))).toBe(3);
 });
});
