import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {prepareSelection,type Selection} from '../src/lib/prepare';
import type {Episode,EpisodeItem,ProgramState} from '../src/lib/server/models';
const access=JSON.parse(await readFile('.data/production-access.json','utf8'));
const base=access.url;let cookie='';
async function request(path:string,method='GET',data?:unknown){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json','x-tgiq-csrf':'1',...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});const b=await r.json();if(!r.ok)throw Error(`${path}: ${r.status} ${b.error??''}`);const c=r.headers.get('set-cookie');if(c)cookie=c.split(';')[0];return b;}
await request('/api/session','POST',{password:access.producerPassword});
const subjects=[{kind:'player',competition:'eng.1',season:2026,id:'280555',teamId:'359'},{kind:'player',competition:'esp.1',season:2026,id:'252107',teamId:'86'},{kind:'match',competition:'eng.1',season:2026,id:'401879244'}];
const items:EpisodeItem[]=[];
for(const scope of subjects){const result=await request('/api/football?'+new URLSearchParams(Object.entries(scope).map(([k,v])=>[k,String(v)])));const selection={kind:scope.kind,data:result.data} as Selection;const graphic=prepareSelection(selection);items.push({id:randomUUID(),title:graphic.title,graphic,subjectIds:graphic.subjects.map(s=>s.id),sourceScope:scope,sourceSnapshot:{graphic},overrides:{patches:[]},mediaIds:[]})}
const existing=await request('/api/episodes?archived=1');
for(const e of existing.episodes as Episode[])if(!e.archived&&e.name.startsWith('Build verification'))await request(`/api/episodes/${e.id}`,'PUT',{expectedVersion:e.version,archived:true});
const same=(existing.episodes as Episode[]).find(e=>e.name==='TGIQ · Review rundown'&&!e.archived);
let episode:Episode=same??(await request('/api/episodes','POST',{name:'TGIQ · Review rundown'})).episode;
episode=(await request(`/api/episodes/${episode.id}`,'PUT',{expectedVersion:episode.version,items})).episode;
let program:ProgramState=await request('/api/program');program=await request('/api/program','POST',{action:'clear',expectedVersion:program.version});if(!program.frozen)program=await request('/api/program','POST',{action:'freeze',expectedVersion:program.version});
const report={verifiedAt:new Date().toISOString(),url:base,episodeId:episode.id,episodeName:episode.name,items:items.map(i=>({title:i.title,template:i.graphic.templateId,scope:i.sourceScope})),outputCleared:program.graphic===null,frozen:program.frozen,notes:'Unmodified provider snapshots, no test zero/financial/example records. Build verification episodes archived, not deleted.'};await writeFile('docs/REVIEW_RUNDOWN.json',JSON.stringify(report,null,2));console.log({episode:episode.name,items:items.length,cleared:report.outputCleared,frozen:report.frozen});
