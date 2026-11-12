import type { Team, Player, Metric, Match, MatchEvent, Provenance, Standing, Leader } from './types';
import { ProviderError } from './http';
export type Raw = Record<string, unknown>;
export const obj = (value:unknown):Raw => value && typeof value==='object' && !Array.isArray(value)?value as Raw:{};
export const array = (value:unknown):Raw[] => Array.isArray(value)?value.map(obj):[];
export const values = (value:unknown):unknown[] => Array.isArray(value)?value:[];
export const str = (value:unknown):string|null => typeof value==='string' && value.trim()?value:typeof value==='number'?String(value):null;
export const num = (value:unknown):number|null => value===null||value===undefined||value===''?null:typeof value==='number' && Number.isFinite(value)?value:typeof value==='string' && /^[-+]?\d+(\.\d+)?$/.test(value.trim())?Number(value):null;
export const sourceLink = (links:unknown):string|null => array(links).map(l=>str(l.href)).find(h=>h?.startsWith('https://www.espn.com/'))||null;
export function normalizeTeam(value:unknown):Team {
 const t=obj(value),id=str(t.id),name=str(t.displayName)||str(t.name);
 if(!id||!name) throw new ProviderError('SCHEMA_CHANGED','ESPN team identity is missing.');
 return {id,provider:'espn',name,shortName:str(t.shortDisplayName)||name,abbreviation:str(t.abbreviation)||name,crest:str(t.logo)||str(obj(array(t.logos)[0]).href),color:str(t.color),venue:str(obj(t.venue).fullName),sourceUrl:sourceLink(t.links)||str(t.clubhouse)};
}
export function normalizePlayer(value:unknown,team:Team|null=null,scope?:Provenance):Player {
 const a=obj(value),id=str(a.id),name=str(a.displayName)||str(a.fullName);
 if(!id||!name) throw new ProviderError('SCHEMA_CHANGED','ESPN player identity is missing.');
 return {id,provider:'espn',name,firstName:str(a.firstName),lastName:str(a.lastName),portrait:str(obj(a.headshot).href),position:str(obj(a.position).displayName)||str(obj(a.position).name),jersey:str(a.jersey),nationality:str(a.citizenship),birthDate:str(a.dateOfBirth)||str(a.displayDOB),age:num(a.age),height:str(a.displayHeight),weight:str(a.displayWeight),team,sourceUrl:sourceLink(a.links),scope};
}
export function normalizeMetrics(stats:unknown,provenance:Provenance):Metric[] {
 return array(stats).filter(s=>str(s.name)).map(s=>({key:str(s.name)!,label:str(s.displayName)||str(s.label)||str(s.name)!,value:num(s.value)??num(s.displayValue),displayValue:str(s.displayValue)??str(s.value),unit:str(s.name)==='possessionPct'?'%':/Pct$/.test(str(s.name)||'')?'ratio':/minutes|timePlayed/i.test(str(s.name)||'')?'minutes':'count',provenance}));
}
export function categoryStats(value:unknown):Raw[]{return array(obj(obj(value).splits).categories).flatMap(c=>array(c.stats));}
export function normalizeEvents(input:unknown,homeId:string,awayId:string):MatchEvent[] {
 let home=0,away=0;
 const ordered=array(input).map((event,index)=>({event,index})).sort((a,b)=>{
  const periodA=num(obj(a.event.period).number)??0,periodB=num(obj(b.event.period).number)??0;
  const clockA=num(obj(a.event.clock).value),clockB=num(obj(b.event.clock).value);
  if(periodA!==periodB)return periodA-periodB;
  if(clockA!==null&&clockB!==null&&clockA!==clockB)return clockA-clockB;
  return a.index-b.index;
 });
 return ordered.map(({event:e,index})=>{
  const kind=str(obj(e.type).type)||str(obj(e.type).text)||'event';
  const shootout=e.shootout===true;
  const ownGoal=e.ownGoal===true||/own.goal/i.test(kind);
  const teamId=str(obj(e.team).id),scored=e.scoringPlay===true&&!shootout;
  // ESPN scoring event team identifies the side credited with the goal, including own goals.
  if(scored && teamId===homeId) home++;
  if(scored && teamId===awayId) away++;
  const athlete=obj(array(e.participants)[0]?.athlete||array(e.athletesInvolved)[0]);
  return {id:str(e.id)||String(index),kind:scored?'goal':kind,text:str(e.shortText)||str(e.text)||str(obj(e.type).text)||'',minute:str(obj(e.clock).displayValue),clock:num(obj(e.clock).value),teamId,player:str(athlete.displayName),playerId:str(athlete.id),ownGoal,penalty:e.penaltyKick===true||/penalty/i.test(kind),shootout,homeScore:scored?home:null,awayScore:scored?away:null};
 });
}
export function normalizeMatch(value:unknown,provenance:Provenance,details?:Raw):Match {
 const e=obj(value),competition=array(e.competitions)[0]||{},competitors=array(competition.competitors);
 const h=competitors.find(c=>c.homeAway==='home'),a=competitors.find(c=>c.homeAway==='away');
 if(!h||!a||!str(e.id)) throw new ProviderError('SCHEMA_CHANGED','ESPN match identity is missing.');
 const home=normalizeTeam(h.team),away=normalizeTeam(a.team),status=obj(obj(competition.status).type),state=status.state==='pre'||status.state==='in'||status.state==='post'?status.state:'unavailable';
 const completed=status.completed===true && state==='post' && !/cancel|postpone|abandon/i.test(str(status.name)||'');
 const scoreAllowed=state==='in'||completed;
 const sources=details?array(obj(details.boxscore).teams):competitors;
 const lineups=array(details?.rosters).map(r=>({teamId:str(obj(r.team).id)||'',formation:str(r.formation),players:array(r.roster).map(p=>({id:str(obj(p.athlete).id)||'',name:str(obj(p.athlete).displayName)||'',jersey:str(p.jersey),position:str(obj(p.position).displayName),starter:typeof p.starter==='boolean'?p.starter:null,substituted:p.subbedIn===true||p.subbedOut===true,statistics:normalizeMetrics(p.stats,provenance)}))}));
 return {id:str(e.id)!,provider:'espn',competition:provenance.competition,season:num(obj(e.season).year)??provenance.season,name:str(e.name)||`${home.name} v ${away.name}`,kickoff:str(competition.date)||str(e.date)||'',status:str(status.shortDetail)||str(status.detail)||str(status.description)||'Unavailable',state,completed,home,away,homeScore:scoreAllowed?num(h.score):null,awayScore:scoreAllowed?num(a.score):null,homeShootout:num(h.shootoutScore),awayShootout:num(a.shootoutScore),homeAggregate:num(h.aggregateScore),awayAggregate:num(a.aggregateScore),venue:str(obj(details?.gameInfo).venue?obj(obj(details?.gameInfo).venue).fullName:obj(competition.venue).fullName),attendance:num(obj(details?.gameInfo).attendance)??num(competition.attendance),events:normalizeEvents(details?.keyEvents||competition.details,home.id,away.id),statistics:sources.map(s=>({teamId:str(obj(s.team).id)||str(s.id)||'',metrics:normalizeMetrics(s.statistics,provenance)})),lineups,note:array(competition.notes).map(n=>str(n.headline)||str(n.text)).filter(Boolean).join(' · ')||null,sourceUrl:sourceLink(e.links),provenance};
}
export function normalizeStandings(root:unknown,provenance:Provenance):Standing[]{
 const p=obj(root),groups=array(p.children),sources=groups.length?groups:[p];
 return sources.flatMap(group=>{
  if(array(group.children).length)return normalizeStandings(group,provenance);
  return array(obj(group.standings).entries).map(entry=>{
   const stats=array(entry.stats),get=(key:string)=>num(stats.find(s=>s.name===key)?.value); const deduction=get('deductions');
   const note=[str(obj(entry.note).description),deduction?`${deduction} points deducted`:null].filter(Boolean).join(' · ')||null;
   return {rank:get('rank'),team:normalizeTeam(entry.team),played:get('gamesPlayed'),won:get('wins'),drawn:get('ties'),lost:get('losses'),goalsFor:get('pointsFor'),goalsAgainst:get('pointsAgainst'),goalDifference:get('pointDifferential'),points:get('points'),note,group:str(group.name),provenance};
  });
 });
}
export function normalizeLeaders(page:unknown,provenance:Provenance):Leader[]{
 const stats=obj(obj(obj(page).page).content).statistics; const p=obj(stats),tables=array(p.tables),rows=values(p.tableRows);
 if(!tables.length||!rows.length)throw new ProviderError('SCHEMA_CHANGED','ESPN scoring leaders are unavailable.');
 const title=str(p.pageTitle)||'';
 if(provenance.season && !title.includes(String(provenance.season)))throw new ProviderError('SEASON_UNAVAILABLE','ESPN leaders returned a different season.',404);
 return tables.flatMap((table,index)=>{
  const headers=array(table.headers),metricIndex=headers.findIndex(h=>h.type==='totalGoals'||h.type==='goalAssists'),category=str(headers[metricIndex]?.type); if(!category)return [];
  let rank=0,previous:number|null=null;
  return values(rows[index]).map((row,rowIndex)=>{
   const cells=values(row),a=obj(cells[1]),t=obj(cells[2]);const id=(str(a.uid)||'').match(/~a:(\d+)/)?.[1]||(str(a.href)||'').match(/\/id\/(\d+)/)?.[1]; const teamId=(str(t.href)||'').match(/\/id\/(\d+)/)?.[1];
   if(!id||!teamId)throw new ProviderError('SCHEMA_CHANGED','ESPN leader identity is unavailable.');
   const value=num(obj(cells[metricIndex]).value); if(rowIndex===0||value!==previous)rank=rowIndex+1;previous=value;
   const team=normalizeTeam({id:teamId,displayName:t.name,links:[{href:t.href}]});
   return {category,label:category==='totalGoals'?'Goals':'Assists',rank,player:normalizePlayer({id,displayName:a.name,links:[{href:a.href}]},team,provenance),value,displayValue:str(obj(cells[metricIndex]).value),provenance};
  });
 });
}
