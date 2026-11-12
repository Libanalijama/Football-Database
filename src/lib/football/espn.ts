import type { Competition, FootballProvider, LeagueData, TeamData, PlayerData, MatchData, SearchData, Provenance, Metric, Team } from './types';
import { espnRequest, ProviderError, type SourceDocument } from './http';
import { obj, array, values, str, num, normalizeTeam, normalizePlayer, normalizeMetrics, categoryStats, normalizeMatch, normalizeStandings, normalizeLeaders } from './normalize';

export const VERIFIED_COMPETITIONS:Competition[] = [
 {id:'700',slug:'eng.1',name:'English Premier League',logo:'https://a.espncdn.com/i/leaguelogos/soccer/500/23.png'},
 {id:'740',slug:'esp.1',name:'Spanish LALIGA',logo:'https://a.espncdn.com/i/leaguelogos/soccer/500/15.png'},
];
const base='https://site.api.espn.com/apis/site/v2/sports/soccer';
const web='https://site.web.api.espn.com/apis/common/v3/sports/soccer';
const unavailable=(reason:string)=>({available:false,reason});
const supported={available:true};
function competition(slug:string):Competition {
 const found=VERIFIED_COMPETITIONS.find(c=>c.slug===slug);
 if(!found)throw new ProviderError('UNKNOWN_COMPETITION','Competition is outside the verified ESPN catalogue.',400);
 return found;
}
function identifier(id:string){if(!/^\d{1,14}$/.test(id))throw new ProviderError('INVALID_ID','Invalid ESPN identifier.',400);return id;}
function provenance(doc:SourceDocument,slug:string,season:number|null,scope:Provenance['scope']='competition-season',teamId?:string):Provenance{return {provider:'espn',sourceUrl:doc.sourceUrl,retrievedAt:doc.retrievedAt,competition:slug,season,scope,...(teamId?{teamId}:{})};}
function requireShape(condition:unknown,message:string):asserts condition {if(!condition)throw new ProviderError('SCHEMA_CHANGED',message);}
async function seasonContext(slug:string,requested?:number){
 competition(slug);
 const current=await espnRequest(`https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`,3600000);
 requireShape(Array.isArray(current.body.seasons)&&num(obj(current.body.season).year)!==null,'ESPN season catalogue is unavailable.');
 const seasons=array(current.body.seasons).map(s=>num(s.year)).filter((n):n is number=>n!==null);
 const season=requested??num(obj(current.body.season).year)!;
 if(!seasons.includes(season))throw new ProviderError('SEASON_UNAVAILABLE','Season is unavailable in the ESPN catalogue.',404);
 const standings=season===num(obj(current.body.season).year)?current:await espnRequest(`https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings?season=${season}`,600000);
 if(num(obj(standings.body.season).year)!==season)throw new ProviderError('SEASON_UNAVAILABLE','ESPN returned a different season.',404);
 return {season,seasons,currentSeason:num(obj(current.body.season).year)!,standings};
}
function statusFromSettled(result:PromiseSettledResult<unknown>,missing:string){return result.status==='fulfilled'?supported:unavailable(result.reason instanceof Error?result.reason.message:missing);}
function noticeFromSettled(result:PromiseSettledResult<unknown>,label:string):string[]{return result.status==='rejected'?[`${label}: ${result.reason instanceof Error?result.reason.message:'Unavailable'}`]:[];}
async function scoringLeaders(slug:string,season:number){
 const doc=await espnRequest(`https://www.espn.com/soccer/stats/_/league/${slug}/season/${season}`,600000,true);
 return normalizeLeaders(doc.body,provenance(doc,slug,season));
}
async function seasonMatches(slug:string,season:number,currentSeason:number){
 if(season===currentSeason){
  const doc=await espnRequest(`${base}/${slug}/scoreboard`,30000);
  requireShape(Array.isArray(doc.body.events),'ESPN fixtures format changed.');
  return array(doc.body.events).filter(e=>num(obj(e.season).year)===season).map(e=>normalizeMatch(e,provenance(doc,slug,season,'match')));
 }
 // ESPN accepts calendar years, but not the attempted date ranges. Filter every event by its explicit football season.
 const docs=await Promise.all([espnRequest(`${base}/${slug}/scoreboard?dates=${season}&limit=1000`,600000),espnRequest(`${base}/${slug}/scoreboard?dates=${season+1}&limit=1000`,600000)]);
 const matches=docs.flatMap(doc=>array(doc.body.events).filter(e=>num(obj(e.season).year)===season).map(e=>normalizeMatch(e,provenance(doc,slug,season,'match'))));
 return [...new Map(matches.map(m=>[m.id,m])).values()].sort((a,b)=>b.kickoff.localeCompare(a.kickoff));
}
export async function getCompetitions():Promise<Competition[]>{return VERIFIED_COMPETITIONS;}
export async function getLeague(slug:string,requested?:number):Promise<LeagueData>{
 const context=await seasonContext(slug,requested),{season,seasons,standings}=context;
 const scope=provenance(standings,slug,season),rows=normalizeStandings(standings.body,scope);
 const [teamsResult,matchesResult,leadersResult]=await Promise.allSettled([
  espnRequest(`${base}/${slug}/teams?limit=100`,3600000),seasonMatches(slug,season,context.currentSeason),scoringLeaders(slug,season),
 ]);
 let teams:Team[]=rows.map(row=>row.team);
 // The list endpoint is current, so it must never replace missing historical season membership.
 if(!teams.length && season===context.currentSeason && teamsResult.status==='fulfilled'){
  const league=array(array(teamsResult.value.body.sports)[0]?.leagues)[0];
  requireShape(league && Array.isArray(league.teams),'ESPN team list format changed.');
  teams=array(league.teams).map(t=>normalizeTeam(t.team));
 }
 requireShape(teams.length,'ESPN returned no teams for this season.');
 return {competition:competition(slug),season,seasons,teams,matches:matchesResult.status==='fulfilled'?matchesResult.value:[],standings:rows,leaders:leadersResult.status==='fulfilled'?leadersResult.value:[],provenance:scope,capabilities:{teams:supported,standings:rows.length?supported:unavailable('No standings returned.'),fixtures:statusFromSettled(matchesResult,'Fixtures unavailable.'),leaders:statusFromSettled(leadersResult,'Leaders unavailable.'),globalPlayerSearch:unavailable('Search is bounded to a selected team squad, competition team names and loaded fixtures.'),historicalSeasons:supported},notices:[...noticeFromSettled(matchesResult,'Fixtures'),...noticeFromSettled(leadersResult,'Leaders'),...(season===context.currentSeason?['Fixtures show the latest ESPN match day. Open a team for its selected-season schedule.']:[])]};
}
export async function getTeam(slug:string,id:string,requested?:number):Promise<TeamData>{
 identifier(id);const context=await seasonContext(slug,requested),{season}=context;
 const [roster,schedule]=await Promise.allSettled([espnRequest(`${base}/${slug}/teams/${id}/roster?season=${season}`,300000),Promise.all([espnRequest(`${base}/${slug}/teams/${id}/schedule?season=${season}&fixture=false`,60000),espnRequest(`${base}/${slug}/teams/${id}/schedule?season=${season}&fixture=true`,60000)])]);
 if(roster.status==='rejected')throw roster.reason;
 const doc=roster.value,p=doc.body;
 requireShape(Array.isArray(p.athletes)&&obj(p.team).id,'ESPN roster format changed.');
 if(num(obj(p.season).year)!==season)throw new ProviderError('SEASON_UNAVAILABLE','ESPN roster returned a different season.',404);
 const team=normalizeTeam(p.team),scope=provenance(doc,slug,season,season===context.currentSeason?'current-squad':'competition-season',id);
 const squad=array(p.athletes).map(a=>normalizePlayer(a,team,scope));
 const standingsScope=provenance(context.standings,slug,season,'competition-season',id),rows=normalizeStandings(context.standings.body,standingsScope),row=rows.find(s=>s.team.id===id);
 if(!row)throw new ProviderError('TEAM_SCOPE_MISMATCH','This team is not in the selected competition and season standings.',404);
 const statistics:Metric[]=(['played','won','drawn','lost','goalsFor','goalsAgainst','goalDifference','points'] as const).map(key=>({key,label:({played:'Played',won:'Wins',drawn:'Draws',lost:'Losses',goalsFor:'Goals for',goalsAgainst:'Goals against',goalDifference:'Goal difference',points:'Points'})[key],value:row[key],displayValue:row[key]===null?null:String(row[key]),unit:'count',provenance:standingsScope}));
 let matches:TeamData['matches']=[];const notices=noticeFromSettled(schedule,'Schedule');
 if(schedule.status==='fulfilled'){
  for(const doc of schedule.value){
   if(num(obj(doc.body.season).year)!==season)notices.push('Schedule returned a different season and was excluded.');
   else matches.push(...array(doc.body.events).filter(e=>num(obj(e.season).year)===season).map(e=>normalizeMatch(e,provenance(doc,slug,season,'match',id))));
  }
  matches=[...new Map(matches.map(m=>[m.id,m])).values()].sort((a,b)=>Math.abs(Date.parse(a.kickoff)-Date.now())-Math.abs(Date.parse(b.kickoff)-Date.now()));
 }
 return {team,squad,matches,statistics,provenance:scope,notices,capabilities:{squad:squad.length?supported:unavailable('ESPN returned an empty squad.'),statistics:supported,fixtures:matches.length?supported:unavailable('No scoped fixtures returned.'),manager:unavailable('Manager information is not mapped; use editorial fields.'),history:unavailable('Complete team and player history is not available from these verified feeds.')}};
}
export async function getPlayer(slug:string,id:string,requested?:number,teamId?:string):Promise<PlayerData>{
 identifier(id);if(teamId)identifier(teamId);const {season,currentSeason}=await seasonContext(slug,requested);
 const [profile,overview,roster]=await Promise.allSettled([espnRequest(`${web}/${slug}/athletes/${id}`,3600000),espnRequest(`${web}/${slug}/athletes/${id}/overview?season=${season}`,300000),teamId?espnRequest(`${base}/${slug}/teams/${teamId}/roster?season=${season}`,300000):Promise.resolve(null)]);
 if(profile.status==='rejected')throw profile.reason;
 const athlete=obj(profile.value.body.athlete);requireShape(str(athlete.id)===id,'ESPN player identity changed.');
 const bioScope=provenance(profile.value,slug,null,'current-profile'),currentTeam=obj(athlete.team).id?normalizeTeam(athlete.team):null;
 let team=season===currentSeason&&!teamId?currentTeam:null,statistics:Metric[]=[],scope=provenance(profile.value,slug,season),rosterAthlete:Record<string,unknown>|undefined;
 const notices=[...noticeFromSettled(overview,'Player statistics')];
 if(teamId && roster.status==='fulfilled' && roster.value){
  const doc=roster.value;
  if(num(obj(doc.body.season).year)===season){
   rosterAthlete=array(doc.body.athletes).find(a=>str(a.id)===id);
   if(rosterAthlete){team=normalizeTeam(doc.body.team);scope=provenance(doc,slug,season,'competition-season',teamId);statistics=normalizeMetrics(categoryStats(rosterAthlete.statistics),scope);}
  }
  if(!rosterAthlete)notices.push('Player is not listed in the selected team and season roster.');
 }
 if(!statistics.length && overview.status==='fulfilled'){
  const stats=obj(overview.value.body.statistics),names=values(stats.names),labels=values(stats.displayNames),splits=array(stats.splits).filter(s=>s.leagueSlug===slug&&(!teamId||str(s.teamId)===teamId)&&(str(s.displayName)||'').startsWith(String(season)));
  // Do not add same-season statistics across clubs or silently replace the selected team scope.
  if(splits.length===1){const split=splits[0];scope=provenance(overview.value,slug,season,'competition-season',str(split.teamId)||undefined);statistics=normalizeMetrics(names.map((name,index)=>({name,displayName:labels[index]||name,displayValue:values(split.stats)[index]})),scope);const scopedTeamId=str(split.teamId);
   const teamFilter=array(stats.filters).find(f=>f.name==='team');const option=array(teamFilter?.options).find(t=>str(t.value)===scopedTeamId);
   if(scopedTeamId&&option)team=normalizeTeam({id:scopedTeamId,displayName:option.displayValue});
   else if(scopedTeamId===currentTeam?.id)team=currentTeam;
   else team=null;}
  else if(splits.length>1)notices.push('Multiple team-at-the-time records exist. Select a team to choose a statistical scope.');
 }
 const player=normalizePlayer({...rosterAthlete,...athlete,headshot:athlete.headshot||rosterAthlete?.headshot},team,bioScope);
 if(season!==currentSeason)notices.push('Age, position and other biography fields are current profile values. Selected-season statistics and team membership have separate provenance.');
 if(!player.portrait)notices.push('ESPN did not supply a profile photo. Upload a licensed replacement if required.');
 return {player,currentTeam,statistics,history:[],provenance:scope,notices,capabilities:{profile:supported,statistics:statistics.length?supported:unavailable('No statistics match this competition, season and team.'),photo:player.portrait?supported:unavailable('No profile photo supplied.'),history:unavailable('Complete career history is not available from the verified profile feed.'),advancedStatistics:unavailable('xG, ratings and other advanced metrics are not provided by these verified feeds.'),contracts:unavailable('Contract and transfer information requires sourced editorial entry.')}};
}
export async function getMatch(slug:string,id:string):Promise<MatchData>{
 competition(slug);identifier(id);const doc=await espnRequest(`${base}/${slug}/summary?event=${id}`,30000);
 const header=obj(doc.body.header);requireShape(str(header.id)===id&&Array.isArray(header.competitions),'ESPN match summary format changed.');
 const leagueIds=array(header.leagues).map(l=>str(l.id));if(leagueIds.length&&!leagueIds.includes(competition(slug).id))throw new ProviderError('MATCH_SCOPE_MISMATCH','Match belongs to a different competition.',404);
 const season=num(obj(header.season).year),scope=provenance(doc,slug,season,'match');const match=normalizeMatch(header,scope,doc.body);
 return {match,provenance:scope,notices:[],capabilities:{details:supported,events:match.events.length?supported:unavailable('No events supplied.'),lineups:match.lineups.length?supported:unavailable('Lineups are not available for this fixture.'),bench:match.lineups.some(l=>l.players.some(p=>p.starter===false))?supported:unavailable('No bench supplied.'),formations:match.lineups.some(l=>l.formation)?supported:unavailable('No formation supplied.'),teamStatistics:match.statistics.some(s=>s.metrics.length)?supported:unavailable('No team statistics supplied.'),playerMatchStatistics:match.lineups.some(l=>l.players.some(p=>p.statistics.length))?supported:unavailable('No player statistics supplied.')}};
}
export async function search(slug:string,query:string,requested?:number,teamId?:string):Promise<SearchData>{
 const q=query.trim().toLocaleLowerCase();if(q.length<2||q.length>80)throw new ProviderError('INVALID_QUERY','Enter between 2 and 80 characters.',400);
 const league=await getLeague(slug,requested),results:SearchData['results']=[];
 for(const t of league.teams)if(`${t.name} ${t.abbreviation}`.toLocaleLowerCase().includes(q))results.push({kind:'team',id:t.id,name:t.name,detail:`${league.competition.name} · ${league.season}`,image:t.crest,origin:'remote',competition:slug,season:league.season});
 for(const m of league.matches)if(m.name.toLocaleLowerCase().includes(q))results.push({kind:'match',id:m.id,name:`${m.home.name} v ${m.away.name}`,detail:`${m.kickoff.slice(0,10)} · ${m.status}`,image:null,origin:'remote',competition:slug,season:league.season});
 if(teamId){const team=await getTeam(slug,teamId,league.season);for(const p of team.squad)if(p.name.toLocaleLowerCase().includes(q))results.push({kind:'player',id:p.id,name:p.name,detail:`${team.team.name} · ${league.competition.name} · ${league.season}`,image:p.portrait,teamId,origin:'remote',competition:slug,season:league.season});}
 return {results:results.slice(0,60),boundary:teamId?'Selected team squad, competition team names and loaded fixtures.':'Competition team names and loaded fixtures. Select a team to search its squad.',provenance:league.provenance,notices:[]};
}
export const espn:FootballProvider={id:'espn',getCompetitions,getLeague,getTeam,getPlayer,getMatch,search};
export function providerStatus(){return {default:'espn',espn:{configured:true,keyRequired:false},optional:[{id:'api-football',configured:Boolean(process.env.API_FOOTBALL_KEY),status:process.env.API_FOOTBALL_KEY?'Credential detected; adapter not enabled.':'Not configured'},{id:'sportmonks',configured:Boolean(process.env.SPORTMONKS_API_TOKEN),status:process.env.SPORTMONKS_API_TOKEN?'Credential detected; adapter not enabled.':'Not configured'}]};}
