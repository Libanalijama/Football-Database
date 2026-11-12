import { templateIds, type GraphicDocument } from './schema';
export type Template = {id:GraphicDocument['templateId'];label:string;family:string;orientation:'fullscreen'|'sidebar';fields:string[];maxRows:number;reference?:string};
const entry = (id:GraphicDocument['templateId'],label:string,family:string,reference?:string,fields:string[]=[],maxRows=6):Template=>({id,label,family,orientation:family==='Profiles'||family==='Transfers'?'sidebar':'fullscreen',fields,maxRows,reference});
export const templates:Template[] = [
 entry('profile-player','Player profile','Profiles','profiles/player.png',['Nationality','Position','Date of birth','Height','Preferred foot','Joined','Previous club'],4),
 entry('profile-manager','Manager profile','Profiles','profiles/manager.png',['Nationality','Appointed','Previous club','Previous role']),
 entry('profile-owner','Owner profile','Profiles','profiles/owner.png',['Ownership group','Club acquired','Group role','Other group club']),
 entry('profile-executive','Executive profile','Profiles','profiles/executive.png',['Role','In role since','At club since','Previous role','Also CEO of']),
 entry('transfer-announcement','Transfer announcement','Transfers','transfers/announcement.png',['Status','From','To','Initial fee','Currency','Contract','Date','Contract end','Option years']),
 entry('transfer-fees','Fee breakdown','Transfers','transfers/fees.png',['Status','From','To','Initial fee','Conditional add-ons','Maximum fee','Currency','Date']),
 entry('transfer-clubs','Club to club','Transfers','transfers/clubs.png',['Status','From','To','Deal type','Date']),
 entry('transfer-contract','Contract details','Transfers','transfers/contract.png',['Status','Contract end','Length at signing','Deal type','Option years','Date']),
 entry('comparison-player','Player comparison','Comparisons','comparisons/player.png',[],5),
 entry('comparison-manager','Manager comparison','Comparisons','comparisons/manager.png',[],5),
 entry('comparison-season','Season comparison','Comparisons','comparisons/season.png',[],5),
 entry('comparison-finances','Financial comparison','Comparisons','comparisons/finances.png',['Units'],4),
 entry('comparison-arguments','Opposing arguments','Comparisons','comparisons/arguments.png',['Question','Left heading','Right heading'],3),
 entry('statistics-player','Player statistics','Statistics','statistics/player.png',[],4),
 entry('statistics-match','Match statistics','Statistics','statistics/match.png',[],5),
 entry('statistics-finances','Club finances','Statistics','statistics/finances.png',['Year ended','Units'],4),
 entry('statistics-big-number','Big number','Statistics','statistics/big-number.png',['Explanation'],1),
 entry('timeline-player','Player career','Timelines','timelines/player.png',[],6),
 entry('timeline-manager','Manager career','Timelines','timelines/manager.png',[],5),
 entry('timeline-history','Historical events','Timelines','timelines/history.png',[],4),
 entry('scoreboard-result','Match result','Scoreboards','scoreboards/result.png',['Half time','Venue']),
 entry('scoreboard-scorers','Scoring sequence','Scoreboards','scoreboards/scorers.png',[],7),
 entry('scoreboard-details','Match details','Scoreboards','scoreboards/details.png',['Match date','Kick-off','Venue','Referee','Attendance','Half time']),
 entry('scoreboard-cup','Cup result','Scoreboards','scoreboards/cup.png',['Half time','Venue','Extra time']),
 entry('table-league','League table','Tables',undefined,['Columns','Points deduction notes'],8),
 entry('table-extract','Selected positions','Tables',undefined,['Columns','Points deduction notes'],6),
 entry('ranking-players','Player leaderboard','Tables',undefined,['Metric','Units','Ties'],8),
 entry('ranking-editorial','Editorial ranking','Tables',undefined,['Ranking basis','As of','Ties'],6),
];
export const templateRegistry = Object.fromEntries(templates.map(t=>[t.id,t])) as Record<string,Template>;
export function createGraphic(templateId:string, partial:Partial<GraphicDocument>={}):GraphicDocument {
 if(!templateIds.includes(templateId as GraphicDocument['templateId']))throw new Error('Unknown graphic template');
 const template=templateRegistry[templateId];
 return { id:globalThis.crypto?.randomUUID?.()??`graphic-${Date.now()}`,templateId:template.id,title:'',subtitle:'',kicker:template.label,placement:'left',background:template.orientation==='sidebar'?'transparent':'navy',fields:Object.fromEntries(template.fields.map(f=>[f,null])),subjects:[],metrics:[],rows:[],source:{},page:0,...partial };
}
export function pageCount(graphic:GraphicDocument):number {
 const template=templateRegistry[graphic.templateId];
 if(template.family==='Profiles') {
  const labels=[...(graphic.subjects[0]?.facts??[]).map(f=>f.label),...Object.entries(graphic.fields).filter(([k,v])=>k!=='Logo URL'&&v!==null&&v!=='').map(([k])=>k)];
  return Math.max(1,Math.ceil(new Set(labels).size/4));
 }
 if(template.family==='Transfers') {
  const keys=graphic.templateId==='transfer-contract'?['Contract end','Length at signing','Deal type','Option years']:graphic.templateId==='transfer-fees'?['Initial fee','Conditional add-ons','Maximum fee']:graphic.templateId==='transfer-announcement'?['Initial fee','Contract','Contract end','Option years']:['Deal type'];
  return Math.max(1,Math.ceil(keys.filter(k=>graphic.fields[k]!==null&&graphic.fields[k]!==undefined&&graphic.fields[k]!=='').length/(graphic.templateId==='transfer-announcement'?2:graphic.templateId==='transfer-contract'?3:4)));
 }
 if(graphic.templateId==='scoreboard-result'||graphic.templateId==='scoreboard-cup') {
  const max=Math.max(...(['home','away'] as const).map(team=>new Set(graphic.match?.events.filter(e=>e.team===team).map(e=>`${e.name}/${Boolean(e.ownGoal)}/${Boolean(e.penalty)}`)).size));
  return Math.max(1,Math.ceil(max/5));
 }
 const count=graphic.templateId==='scoreboard-scorers'?graphic.match?.events.length??0:graphic.templateId==='comparison-arguments'?graphic.rows.length:graphic.templateId==='scoreboard-details'?Object.entries(graphic.fields).filter(([k,v])=>k!=='Logo URL'&&v!==null&&v!=='').length:graphic.templateId.startsWith('comparison-')||graphic.templateId.startsWith('statistics-')?graphic.metrics.length:graphic.rows.length;
 return Math.max(1,Math.ceil(count/template.maxRows));
}
/** Competition ranking: 1, 2, 2, 4. Call only for numerically equivalent metric definitions. */
export function sharedRanks<T extends { value: number | null }>(items:T[]):Array<T&{rank:number|null}> {
 const sorted=[...items].sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity));
 let previous:number|null=null,rank:number|null=null;
 return sorted.map((item,index)=>{if(item.value===null)return {...item,rank:null};if(index===0||item.value!==previous)rank=index+1;previous=item.value;return {...item,rank};});
}
