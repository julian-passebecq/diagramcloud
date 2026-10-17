import type {EvidenceBlock,Project} from '../../core/model';
import {DAY} from '../../core/schedule';
import {designContext,eyebrowOf,footerParts,type DesignOptions} from './context';
import {summaryCards} from './architecture';
import {clipMono,f,footerLine,header,legendStrip,lines,monoWidth,MONO,sansLines,svgDocument,txt} from './kit';
import {xml} from '../diagram';
import {figureAvailability,withheldSvg} from './availability';
import {scheduleOf,type ScheduleRow} from './measures';

const M=48,W=960,LABEL_W=270,ROW=34,MAX_ROWS=24,HOUR=3600000;
const PROVENANCE:Record<EvidenceBlock['provenance'],{tag:string;note:string}>={
 synthetic:{tag:'SYNTHETIC SCHEDULE',note:'Illustrative dates made up for teaching or design: not a plan of record and not observed timing.'},
 'source-derived':{tag:'SOURCE-DERIVED SCHEDULE',note:'Dates transcribed from the cited sources; not independently verified.'},
 reference:{tag:'REFERENCE SCHEDULE',note:'Dates from the cited reference documentation.'},
 author:{tag:'AUTHOR-PROVIDED SCHEDULE',note:'Dates entered by the author; not verified by DiagramCloud.'}};
const clipSans=(s:string,w:number,size:number,bold=false)=>{const l=sansLines(s,w,size,1,bold)[0]??'';return l.length<s.replace(/\s+/g,' ').trim().length?`${l.replace(/.$/,'')}…`:l;};

/** Calendar ticks inside [t0, t1]: the finest step whose count fits the plot, aligned to UTC days, months or years. */
export function ganttTicks(t0:number,t1:number,width:number,dateOnly:boolean):{at:number;label:string}[]{
 const max=Math.max(2,Math.floor(width/88)),span=t1-t0;
 const fixed=[...(dateOnly?[]:[HOUR,2*HOUR,3*HOUR,6*HOUR,12*HOUR]),DAY,2*DAY,7*DAY,14*DAY];
 const step=fixed.find(s=>span/s<=max);
 if(step){const first=step>=DAY?Math.ceil(t0/DAY)*DAY:Math.ceil(t0/step)*step,out:{at:number;label:string}[]=[];
  for(let at=first;at<=t1&&out.length<=max;at+=step){const iso=new Date(at).toISOString();out.push({at,label:step>=DAY?iso.slice(0,10):`${iso.slice(5,10)} ${iso.slice(11,16)}Z`});}return out;}
 for(const months of [1,2,3,6,12,24,60]){const out:{at:number;label:string}[]=[],d=new Date(t0);let y=d.getUTCFullYear(),m=d.getUTCMonth();
  for(let k=0;k<400;k++){const at=Date.UTC(y,m,1);if(at>t1)break;if(at>=t0&&m%months===0)out.push({at,label:months>=12?String(y):`${y}-${String(m+1).padStart(2,'0')}`});m++;if(m===12){m=0;y++;}}
  if(out.length<=max)return out;}
 return [];
}

/**
 * Gantt (scheduled timeline): each supplied or estimated schedule item on the public components of a view becomes a bar
 * on a calendar axis, from its start to its end or duration. Estimates are dashed and say so; the evidence provenance
 * is printed before the bars. Items are dated facts from evidence, never a run, observed timing or a scheduler output,
 * and a story order is never turned into elapsed time. Without schedule items, or when items conflict (the same item ID
 * with two intervals, or date-only mixed with timed), the figure is withheld (availability.ts) and names what is missing.
 */
export function ganttSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'gantt',options),{spec,t}=c,a=figureAvailability(c,'gantt');
 if(!a.available)return withheldSvg(c,a,{label:'Gantt'});
 const s=scheduleOf(c),shown=s.rows.slice(0,MAX_ROWS),omitted=s.rows.length-shown.length,provs=[...new Set(s.blocks.map(b=>b.provenance))].sort(),mixed=provs.length>1;
 const hdr=header(eyebrowOf(c,'Gantt'),spec.title,`Supplied dates of ${shown.length} schedule item${shown.length===1?'':'s'} on ${spec.title}${s.estimates?', estimates dashed':''}: dated evidence, not a run and not observed timing.`,M,M,W,t,c.editorial),out:string[]=[];
 const top=M+hdr.height+28,p=mixed?{tag:'MIXED PROVENANCE',note:`Schedule blocks with ${provs.join(', ')} provenance; each bar's tooltip names its block.`}:PROVENANCE[provs[0]];
 const tw=Math.ceil(monoWidth(p.tag,8,0.12))+14,noteLs=sansLines(p.note,W-tw-10,10,2);
 out.push(`<g data-provenance="${mixed?'mixed':provs[0]}"><rect x="${M}" y="${top}" width="${tw}" height="16" rx="2" fill="${t.accentTint}" stroke="${t.accent}" stroke-width="0.8"/>${txt(p.tag,M+7,top+11.5,{size:8,fill:t.accent,font:MONO,tracking:0.12})}${lines(noteLs,M+tw+10,top+12,13,{size:10,fill:t.muted,italic:true})}</g>`);
 const t0=Math.min(...shown.map(r=>r.start)),t1=Math.max(...shown.map(r=>r.end)),px=M+LABEL_W,pw=W-LABEL_W,X=(v:number)=>px+(v-t0)/(t1-t0)*pw;
 const axisY=top+16+noteLs.length*13+28,rowsTop=axisY+12,rowsBottom=rowsTop+shown.length*ROW,ticks=ganttTicks(t0,t1,pw,s.dateOnly);
 out.push(`<g data-gantt-axis="" data-gantt-from="${new Date(t0).toISOString()}" data-gantt-to="${new Date(t1).toISOString()}">`,`<line x1="${px}" y1="${rowsTop}" x2="${px+pw}" y2="${rowsTop}" stroke="${t.ruleSolid}"/>`);
 let lastRight=-Infinity;
 for(const k of ticks){const x=X(k.at),half=monoWidth(k.label,8)/2;out.push(`<line x1="${f(x)}" y1="${rowsTop}" x2="${f(x)}" y2="${rowsBottom}" stroke="${t.rule}"/>`);
  if(x-half>lastRight+8&&x+half<=W+M+M/2){out.push(txt(k.label,x,axisY,{size:8,fill:t.soft,font:MONO,anchor:'middle'}));lastRight=x+half;}}
 out.push('</g>');
 shown.forEach((r:ScheduleRow,i)=>{const y=rowsTop+i*ROW,est=r.basis==='estimate',x0=X(r.start),x1=X(r.end),w=Math.max(2,x1-x0);
  const tip=`${r.label}: ${r.startText} → ${r.endText}${r.duration?` (${r.duration})`:''} · ${est?'estimate':'supplied'} · ${r.blocks.join(', ')}${r.nodes.length?` · ${r.nodes.join(', ')}`:''}${r.note?` · ${r.note}`:''}`;
  if(i%2===1)out.push(`<rect x="${M}" y="${f(y)}" width="${W}" height="${ROW}" fill="${t.paper2}" fill-opacity="0.5"/>`);
  out.push(`<g data-dd-item="${xml(r.id)}" data-dd-basis="${r.basis}" data-dd-start="${xml(r.startText)}" data-dd-end="${xml(r.endText)}">`,
   txt(clipSans(r.label,LABEL_W-16,11,true),M+4,y+14,{size:11,fill:t.ink,weight:600}),
   txt(clipMono(`${est?'EST · ':''}${r.startText} → ${r.endText}${r.nodes.length?` · ${r.nodes.join(', ')}`:''}`,LABEL_W-16,8),M+4,y+27,{size:8,fill:est?t.accent:t.soft,font:MONO}),
   `<rect x="${f(x0)}" y="${f(y+10)}" width="${f(w)}" height="14" rx="2" fill="${t.accent}" fill-opacity="${est?0.18:0.85}"${est?` stroke="${t.accent}" stroke-width="1" stroke-dasharray="4,3"`:''}><title>${xml(tip)}</title></rect>`,'</g>');});
 let bottom=rowsBottom+8;
 const notes=[
  `Dates as supplied (${s.timezones.join(', ')}). ${s.dateOnly?'Date-only items cover whole days; an end date is the last day.':'The axis is in UTC; each item keeps its supplied offset in its tooltip.'}`,
  'Bars are dated intervals from evidence: not runs, not observed timing and not a scheduler. A story or step order is presentation order, never elapsed time.',
  ...(s.estimates?[`${s.estimates} item${s.estimates===1?'':'s'} declared as estimate${s.estimates===1?'':'s'} (dashed, EST): not supplied dates.`]:[]),
  ...(omitted?[`${omitted} further item(s) not drawn (${MAX_ROWS}-row readability limit; the full schedule stays in evidence).`]:[])];
 for(const note of notes){const ls=sansLines(note,W,10,3);out.push(`<g data-dd-note="">${lines(ls,M,bottom+12,14,{size:10,fill:t.muted,italic:true})}</g>`);bottom+=ls.length*14+4;}
 const legend=legendStrip([{kind:'swatch',fill:t.accent,label:'Supplied interval'},...(s.estimates?[{kind:'line' as const,stroke:'accent' as const,dashed:true,label:'Estimate'}]:[])],M,bottom+14,W,t);out.push(legend.svg);bottom+=14+legend.height;
 const sources=[...new Set(s.blocks.flatMap(b=>b.sourceIds))].map(id=>c.doc.sources.find(x=>x.id===id)?.title).filter(Boolean);
 if(sources.length){const ls=sansLines(`Sources: ${sources.join('; ')}`,W,10,2);out.push(lines(ls,M,bottom+12,14,{size:10,fill:t.muted}));bottom+=ls.length*14+6;}
 let y=bottom+12;const cards=c.editorial?summaryCards(c,M,y+8,W):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:W+2*M,height:y+M,title:`${spec.title} · gantt`,
  desc:`Gantt of ${shown.length} schedule item(s) on the public view ${spec.viewId}, ${new Date(t0).toISOString().slice(0,10)} to ${new Date(t1-(s.dateOnly?DAY:0)).toISOString().slice(0,10)}${s.estimates?`, ${s.estimates} estimate(s)`:''} (${mixed?'mixed provenance':PROVENANCE[provs[0]].tag.toLowerCase()}). Dated evidence, not a run or observed timing.`,
  t,theme:c.theme,type:'gantt',viewId:spec.viewId,defs:'',body:hdr.svg+out.join('')+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,W,t)});
}
