import type { GoalEvent } from './schema';
/** Events are goals credited to a side. Own-goal flags describe the scorer, not a score reversal. */
export function groupScorers(events:GoalEvent[],team:'home'|'away'):Array<{name:string;minutes:string[]}> {
 const group=new Map<string,string[]>();
 for(const e of events.filter(e=>e.team===team)){const name=`${e.name}${e.ownGoal?' (OG)':''}${e.penalty?' (P)':''}`;group.set(name,[...(group.get(name)??[]),e.minute]);}
 return [...group].map(([name,minutes])=>({name,minutes}));
}
/** A shootout is never supplied to this function; it lives in match.shootout. */
export function runningScores(events:GoalEvent[]):GoalEvent[] {
 let home=0,away=0;
 return events.map(e=>{if(e.team==='home')home++;else away++;return {...e,homeScore:e.homeScore??home,awayScore:e.awayScore??away};});
}
