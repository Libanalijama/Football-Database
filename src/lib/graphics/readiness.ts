import type { GraphicDocument } from './schema';
/** Production preflight validates only concrete requirements for the chosen graphic. */
export function graphicReadiness(g:GraphicDocument):string[] {
 const issues:string[]=[];
 const editorial=/^(profile-(owner|executive)|transfer-|comparison-(finances|arguments)|statistics-finances|timeline-|ranking-editorial)/.test(g.templateId);
 if(editorial){
  if(!g.source.url)issues.push('Add the source URL.');
  if(!g.source.attribution)issues.push('Add the attribution.');
  if(!g.source.reportingPeriod)issues.push('Add the reporting period or date.');
 }
 if(g.templateId.startsWith('profile-')&&!g.subjects[0]?.name.trim())issues.push('Select a subject.');
 if(g.templateId.startsWith('transfer-')){
  if(!g.subjects[0]?.name.trim())issues.push('Select a transfer subject.');
  if(!['confirmed','reported'].includes(String(g.fields.Status??'').trim().toLowerCase()))issues.push('Set the transfer status to confirmed or reported.');
 }
 if(g.templateId.startsWith('comparison-')&&g.templateId!=='comparison-arguments'&&g.subjects.filter(s=>s.name.trim()).length<2)issues.push('Select both comparison subjects.');
 if((g.templateId.startsWith('statistics-')||g.templateId.startsWith('comparison-')&&g.templateId!=='comparison-arguments')&&!g.metrics.some(m=>m.label.trim()))issues.push('Select at least one metric.');
 if(g.templateId.startsWith('scoreboard-')&&!g.match)issues.push('Select a match.');
 if((g.templateId.startsWith('timeline-')||g.templateId.startsWith('table-')||g.templateId.startsWith('ranking-')||g.templateId==='comparison-arguments')&&!g.rows.some(r=>r.label.trim()))issues.push('Add at least one row.');
 if(g.templateId==='comparison-finances'||g.templateId==='statistics-finances'){
  if(!g.fields.Units&&!g.metrics.every(m=>Boolean(m.unit)))issues.push('Set the financial units.');
 }
 return issues;
}
