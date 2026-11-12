import type { GraphicDocument } from './schema';
import { graphicReadiness } from './readiness';
export async function preloadGraphic(graphic:GraphicDocument):Promise<void> {
 const issues=graphicReadiness(graphic);
 if(issues.length)throw new Error(issues.join(' '));
 if(typeof window==='undefined')return;
 await Promise.all([
  document.fonts.load('700 48px "TGIQ Condensed"'),
  document.fonts.load('italic 600 48px "TGIQ Condensed"'),
  document.fonts.load('400 24px "TGIQ Sans"'),
 ]);
 await document.fonts.ready;
 const sources=new Set<string>([typeof graphic.fields['Logo URL']==='string'?graphic.fields['Logo URL']:'/brand/tgiq-logo.png',...graphic.subjects.flatMap(s=>[s.image,s.crest]),...graphic.rows.map(r=>r.image),graphic.match?.home.crest,graphic.match?.away.crest].filter((v):v is string=>Boolean(v)));
 await Promise.all([...sources].map(src=>new Promise<void>((resolve,reject)=>{
  const image=new Image();const timer=setTimeout(()=>reject(new Error('Image preflight timed out')),12000);
  image.onload=()=>{clearTimeout(timer);resolve();};image.onerror=()=>{clearTimeout(timer);reject(new Error('An image is unavailable. Replace or remove it before taking live.'));};image.src=src;if(image.complete&&image.naturalWidth){clearTimeout(timer);resolve();}
 })));
}
