/** Manual online verification: not part of the offline unit suite and never imported by the product. */
import { writeFile } from 'node:fs/promises';
import { getLeague,getTeam,getPlayer,getMatch,search } from '../src/lib/football/espn';
async function main(){
 delete process.env.API_FOOTBALL_KEY;
 delete process.env.SPORTMONKS_API_TOKEN;
 const results=[];
 for(const [slug,teamId,playerId] of [['eng.1','359','280555'],['esp.1','86','252107']]){
  const start=performance.now();
  const league=await getLeague(slug);
  const team=await getTeam(slug,teamId,league.season);
  const player=await getPlayer(slug,playerId,league.season,teamId);
  const event=league.matches.find(m=>m.completed);if(!event)throw Error(`No completed summary candidate for ${slug}`);
  const {match,capabilities}=await getMatch(slug,event.id);
  const searchResult=await search(slug,player.player.name.split(' ')[0],league.season,teamId);
  if(league.teams.length<2||team.squad.length===0||player.statistics.length===0||match.lineups.length!==2||!searchResult.results.some(r=>r.id===playerId))throw Error(`Incomplete live workflow for ${slug}`);
  results.push({competition:slug,season:league.season,discoveredSeasons:league.seasons,teamCount:league.teams.length,standingsCount:league.standings.length,leaderCount:league.leaders.length,team:{id:team.team.id,name:team.team.name,squadCount:team.squad.length,fixtureResultCount:team.matches.length,provenance:team.provenance},player:{id:player.player.id,name:player.player.name,portrait:player.player.portrait,statistics:player.statistics,provenance:player.provenance},match:{id:match.id,name:match.name,homeScore:match.homeScore,awayScore:match.awayScore,eventCount:match.events.length,lineups:match.lineups.map(l=>({teamId:l.teamId,formation:l.formation,starters:l.players.filter(p=>p.starter===true).length,bench:l.players.filter(p=>p.starter===false).length,statisticsCount:l.players.reduce((n,p)=>n+p.statistics.length,0)})),capabilities,provenance:match.provenance},boundedSearchCount:searchResult.results.length,elapsedMs:Math.round(performance.now()-start)});
 }
 const record={verifiedAt:new Date().toISOString(),method:'Direct finished ESPN adapter requests, no runtime fixture fallback',paidProviderKeysPresent:false,results};
 await writeFile(new URL('../docs/ESPN_LIVE_VERIFICATION.json',import.meta.url),JSON.stringify(record,null,2)+'\n');
 console.log(JSON.stringify(record,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
