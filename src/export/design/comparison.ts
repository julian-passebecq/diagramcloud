import type {EvidenceBlock,Project} from '../../core/model';
import {designContext,eyebrowOf,footerParts,type DesignOptions} from './context';
import {summaryCards} from './architecture';
import {clipMono,f,footerLine,header,legendStrip,lines,monoWidth,MONO,sansLines,svgDocument,txt} from './kit';
import {xml} from '../diagram';
import {figureAvailability,withheldSvg} from './availability';
import {comparisonOf,type ComparisonRow} from './measures';

const M=48,W=960,LABEL_W=270,PLOT_W=420,ROW=58,MAX_ROWS=12,TEXT_W=196;
const PROVENANCE:Record<EvidenceBlock['provenance'],{tag:string;note:string}>={
 synthetic:{tag:'SYNTHETIC READINGS',note:'Illustrative readings made up for teaching or design: never measured results.'},
 'source-derived':{tag:'SOURCE-DERIVED READINGS',note:'Readings transcribed from the cited sources; not independently verified.'},
 reference:{tag:'REFERENCE READINGS',note:'Readings from the cited reference documentation.'},
 author:{tag:'AUTHOR-PROVIDED READINGS',note:'Readings entered by the author; not verified by DiagramCloud.'}};
const num=(v:number)=>Math.abs(v)>=1e6?Number(v.toPrecision(3)).toExponential(2):String(+v.toFixed(3));
const signed=(v:number)=>`${v>0?'+':v<0?'−':'±'}${num(Math.abs(v))}`;
const clipSans=(s:string,w:number,size:number,bold=false)=>{const l=sansLines(s,w,size,1,bold)[0]??'';return l.length<s.replace(/\s+/g,' ').trim().length?`${l.replace(/.$/,'')}…`:l;};
/** The relative change as text, or why there is none: a zero baseline never yields a percentage. */
export const relativeText=(r:ComparisonRow)=>r.relative===undefined?'relative change unavailable: baseline is zero':`${r.relative>0?'+':r.relative<0?'−':'±'}${Math.abs(r.relative*100).toFixed(1)}% of baseline`;

/**
 * Baseline and current comparison: for each metric of the public view's evidence with exactly one baseline and one
 * current reading of the same unit and scope over windows of the same length, the two supplied values side by side and
 * their difference, labelled derived arithmetic, with its basis (measured inputs, estimate-based or from derived inputs).
 * A zero baseline has no relative change. Metrics that cannot be compared are listed with the reason; when none can,
 * the figure is withheld (availability.ts). A difference is not a cause, and no money, time saving or performance is
 * inferred from the diagram.
 */
export function comparisonSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'comparison',options),{spec,t}=c,a=figureAvailability(c,'comparison');
 if(!a.available)return withheldSvg(c,a,{label:'Comparison'});
 const k=comparisonOf(c),shown=k.rows.slice(0,MAX_ROWS),omitted=k.rows.length-shown.length,provs=[...new Set(k.blocks.map(b=>b.provenance))].sort(),mixed=provs.length>1;
 const hdr=header(eyebrowOf(c,'Comparison'),spec.title,`Supplied baseline and current readings of ${shown.length} metric${shown.length===1?'':'s'} on ${spec.title}, and their derived difference.`,M,M,W,t,c.editorial),out:string[]=[];
 const top=M+hdr.height+28,p=mixed?{tag:'MIXED PROVENANCE',note:`Metrics blocks with ${provs.join(', ')} provenance; synthetic readings are never measured results.`}:PROVENANCE[provs[0]];
 const tw=Math.ceil(monoWidth(p.tag,8,0.12))+14,noteLs=sansLines(p.note,W-tw-10,10,2);
 out.push(`<g data-provenance="${mixed?'mixed':provs[0]}"><rect x="${M}" y="${top}" width="${tw}" height="16" rx="2" fill="${t.accentTint}" stroke="${t.accent}" stroke-width="0.8"/>${txt(p.tag,M+7,top+11.5,{size:8,fill:t.accent,font:MONO,tracking:0.12})}${lines(noteLs,M+tw+10,top+12,13,{size:10,fill:t.muted,italic:true})}</g>`);
 const px=M+LABEL_W,rx=px+PLOT_W+20,rw=W-LABEL_W-PLOT_W-20,headY=top+16+noteLs.length*13+26;
 out.push(txt('METRIC · SCOPE · WINDOW',M+4,headY,{size:8,fill:t.soft,font:MONO,tracking:0.1}),txt('BASELINE / CURRENT',px,headY,{size:8,fill:t.soft,font:MONO,tracking:0.1}),txt('DIFFERENCE (DERIVED)',rx,headY,{size:8,fill:t.soft,font:MONO,tracking:0.1}));
 const rowsTop=headY+10;
 shown.forEach((r,i)=>{const y=rowsTop+i*ROW,b=r.baseline,k2=r.current,bars=b.value>=0&&k2.value>=0,scale=Math.max(Math.abs(b.value),Math.abs(k2.value)),bw=(v:number)=>bars&&scale>0?Math.max(1,v/scale*(PLOT_W-TEXT_W-8)):0;
  if(i%2===1)out.push(`<rect x="${M}" y="${f(y)}" width="${W}" height="${ROW}" fill="${t.paper2}" fill-opacity="0.5"/>`);
  out.push(`<g data-dd-comparison="${xml(r.metric)}" data-dd-scope="${xml(r.scope)}" data-dd-unit="${xml(r.unit)}" data-dd-baseline="${b.value}" data-dd-current="${k2.value}" data-dd-difference="${r.difference}"${r.relative===undefined?' data-dd-relative="unavailable"':` data-dd-relative="${r.relative}"`} data-dd-basis="${xml(r.basis)}">`,
   txt(clipSans(r.metric,LABEL_W-16,11,true),M+4,y+16,{size:11,fill:t.ink,weight:600}),
   txt(clipMono(r.scope,LABEL_W-16,8),M+4,y+30,{size:8,fill:t.muted,font:MONO}),
   txt(clipMono(`${b.from}→${b.to} vs ${k2.from}→${k2.to}`,LABEL_W-16,8),M+4,y+43,{size:8,fill:t.soft,font:MONO}));
  for(const [reading,dy,label] of [[b,8,'BASE'],[k2,30,'NOW']] as const){const w=bw(reading.value),syn=reading.provenance==='synthetic',est=reading.basis!=='measured';
   out.push(`<rect x="${f(px)}" y="${f(y+dy)}" width="${f(w)}" height="14" rx="2" fill="${label==='NOW'?t.accent:t.muted}" fill-opacity="${est||syn?0.2:0.8}"${est||syn?` stroke="${label==='NOW'?t.accent:t.muted}" stroke-width="1" stroke-dasharray="4,3"`:''}><title>${xml(`${reading.role}: ${reading.value} ${reading.unit} · ${reading.basis} · ${reading.scope} · ${reading.from} → ${reading.to} · ${reading.block}`)}</title></rect>`,
    txt(clipMono(`${label} ${num(reading.value)} ${reading.unit} · ${reading.basis}${syn?' · synthetic':''}`,PLOT_W-w-6,8),px+w+6,y+dy+11,{size:8,fill:t.ink,font:MONO}));}
  out.push(txt(clipMono(`${signed(r.difference)} ${r.unit}`,rw,11),rx,y+18,{size:11,fill:t.ink,font:MONO,weight:600}),
   txt(clipMono(relativeText(r),rw,8),rx,y+32,{size:8,fill:r.relative===undefined?t.accent:t.muted,font:MONO}),
   txt(clipMono(`${r.basis} · windows of ${r.windowLength}`,rw,8),rx,y+45,{size:8,fill:t.soft,font:MONO}),'</g>');});
 let bottom=rowsTop+shown.length*ROW+8;
 const notes=[
  'Difference = current − baseline: derived arithmetic over the supplied readings, in one unit and scope over windows of the same length. A difference is not proof of causation.',
  'No money, time saving or performance is inferred from the diagram, its shape or its node count. Estimates and synthetic readings are dashed.',
  ...(shown.some(r=>r.relative===undefined)?['A zero baseline has no relative change: no percentage is shown for it.']:[]),
  ...k.unavailable.map(u=>`Not compared · ${u.metric}: ${u.reason}.`),
  ...(omitted?[`${omitted} further comparable metric(s) not drawn (${MAX_ROWS}-row readability limit).`]:[])];
 for(const note of notes){const ls=sansLines(note,W,10,3);out.push(`<g data-dd-note="">${lines(ls,M,bottom+12,14,{size:10,fill:t.muted,italic:true})}</g>`);bottom+=ls.length*14+4;}
 const legend=legendStrip([{kind:'swatch',fill:t.muted,label:'Baseline'},{kind:'swatch',fill:t.accent,label:'Current'},{kind:'line',stroke:'accent',dashed:true,label:'Estimate, derived or synthetic'}],M,bottom+14,W,t);out.push(legend.svg);bottom+=14+legend.height;
 const sources=[...new Set(k.blocks.flatMap(b=>b.sourceIds))].map(id=>c.doc.sources.find(x=>x.id===id)?.title).filter(Boolean);
 if(sources.length){const ls=sansLines(`Sources: ${sources.join('; ')}`,W,10,2);out.push(lines(ls,M,bottom+12,14,{size:10,fill:t.muted}));bottom+=ls.length*14+6;}
 let y=bottom+12;const cards=c.editorial?summaryCards(c,M,y+8,W):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:W+2*M,height:y+M,title:`${spec.title} · comparison`,
  desc:`Baseline and current comparison of ${shown.length} metric(s) on the public view ${spec.viewId} (${mixed?'mixed provenance':PROVENANCE[provs[0]].tag.toLowerCase()}); differences are derived arithmetic, not causation or savings.${k.unavailable.length?` ${k.unavailable.length} metric(s) not compared.`:''}`,
  t,theme:c.theme,type:'comparison',viewId:spec.viewId,defs:'',body:hdr.svg+out.join('')+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,W,t)});
}
