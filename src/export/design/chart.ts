import type {EvidenceBlock,Project} from '../../core/model';
import {designContext,eyebrowOf,footerParts,type DesignContext,type DesignOptions} from './context';
import {summaryCards} from './architecture';
import {clipMono,f,footerLine,header,legendStrip,lines,markers,monoWidth,MONO,sansLines,svgDocument,txt} from './kit';
import {xml} from '../diagram';

type Table=Extract<EvidenceBlock,{type:'table'}>;
const M=48;
const PROVENANCE:Record<EvidenceBlock['provenance'],{tag:string;note:string}>={
 synthetic:{tag:'SYNTHETIC DATA',note:'Illustrative values made up for teaching or design. Not a measured or verified result.'},
 'source-derived':{tag:'SOURCE-DERIVED',note:'Values transcribed from the cited sources; not independently verified.'},
 reference:{tag:'REFERENCE',note:'Reference values from the cited documentation.'},
 author:{tag:'AUTHOR-PROVIDED',note:'Values entered by the author; not verified by DiagramCloud.'}};

/** A table evidence block that can be charted: at least two rows and one column whose values are all numbers. */
export function chartableTable(c:DesignContext):{block:Table;category:number;series:number[]}|undefined{
 const {doc,spec}=c,ids=spec.nodes.flatMap(n=>n.evidenceRefs);
 for(const id of ids){const b=doc.blocks.find(x=>x.id===id);if(!b||b.type!=='table'||b.rows.length<2)continue;
  const numeric=b.columns.map((_,k)=>b.rows.every(r=>r[k]===null||typeof r[k]==='number')&&b.rows.some(r=>typeof r[k]==='number'));
  const series=numeric.flatMap((n,k)=>n?[k]:[]).slice(0,3);if(!series.length)continue;
  return {block:b,category:Math.max(0,numeric.findIndex(n=>!n)),series};}
 return undefined;
}
export function niceTicks(min:number,max:number):number[]{
 const span=max-min||Math.abs(max)||1,step0=span/5,mag=10**Math.floor(Math.log10(step0)),step=[1,2,2.5,5,10].map(m=>m*mag).find(s=>s>=step0)!;
 const out:number[]=[];for(let k=Math.floor(min/step);k<=Math.ceil(max/step-1e-9);k++)out.push(k*step);return out;
}
const fmt=(v:number)=>Math.abs(v)>=1e6?`${+(v/1e6).toFixed(1)}M`:Math.abs(v)>=1e4?`${+(v/1e3).toFixed(1)}k`:String(+v.toFixed(2));

/**
 * Chart: the first table evidence block of the view's components with a numeric column, as grouped bars (up to three
 * series). Its provenance is printed on the figure in the accent tag, so a synthetic table is never mistaken for a
 * result. Without a chartable table, the figure says so.
 */
export function chartSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'chart',options),{spec,t}=c,found=chartableTable(c),contentW=720;
 const hdr=header(eyebrowOf(c,'Chart'),found?found.block.title:spec.title,found?`From the evidence of ${spec.title}.`:'No table evidence with numbers on this view\'s components: attach a table block to chart it.',M,M,contentW,t,c.editorial);
 const out:string[]=[];let bottom=M+hdr.height+24;
 if(found){const {block,category,series}=found,p=PROVENANCE[block.provenance],top=M+hdr.height+28;
  // Provenance tag first: the reader sees what kind of numbers these are before the bars.
  const tw=Math.ceil(monoWidth(p.tag,8,0.12))+14;
  out.push(`<g data-provenance="${block.provenance}"><rect x="${M}" y="${top}" width="${tw}" height="16" rx="2" fill="${t.accentTint}" stroke="${t.accent}" stroke-width="0.8"/>${txt(p.tag,M+7,top+11.5,{size:8,fill:t.accent,font:MONO,tracking:0.12})}${txt(p.note,M+tw+10,top+12,{size:10,fill:t.muted,italic:true})}</g>`);
  const rows=block.rows.slice(0,24),vals=rows.flatMap(r=>series.map(k=>typeof r[k]==='number'?r[k] as number:0)),ticks=niceTicks(Math.min(0,...vals),Math.max(0,...vals));
  const px=M+56,pw=contentW-56,py=top+44,ph=260,lo=ticks[0],hi=ticks[ticks.length-1],Y=(v:number)=>py+ph-(v-lo)/(hi-lo||1)*ph;
  for(const v of ticks)out.push(`<line x1="${px}" y1="${f(Y(v))}" x2="${px+pw}" y2="${f(Y(v))}" stroke="${v===0?t.ruleSolid:t.rule}" stroke-width="1"/>`,txt(fmt(v),px-8,Y(v)+3,{size:8,fill:t.soft,font:MONO,anchor:'end'}));
  const slot=pw/rows.length,bw=Math.min(36,(slot-12)/series.length);
  rows.forEach((r,i)=>{const x0=px+i*slot+(slot-bw*series.length)/2;
   series.forEach((k,s)=>{const v=typeof r[k]==='number'?r[k] as number:null;if(v===null)return;const y=Math.min(Y(v),Y(0)),h=Math.abs(Y(v)-Y(0));
    out.push(`<rect data-value="${v}" x="${f(x0+s*bw)}" y="${f(y)}" width="${f(bw-2)}" height="${f(Math.max(h,0.5))}" rx="1" fill="${series.length===1?t.muted:t.series[s]}" fill-opacity="${series.length===1?0.85:0.9}"><title>${xml(`${String(r[category]??i+1)} · ${block.columns[k]}: ${v}`)}</title></rect>`);
    if(series.length===1)out.push(txt(fmt(v),x0+s*bw+bw/2-1,v>=0?y-5:y+h+11,{size:8,fill:t.muted,font:MONO,anchor:'middle'}));});
   out.push(txt(clipMono(String(r[category]??i+1),slot-4,8),px+i*slot+slot/2,py+ph+16,{size:8,fill:t.muted,font:MONO,anchor:'middle'}));});
  out.push(txt(clipMono(block.columns[category]??'',pw,8,0.12).toUpperCase(),px+pw,py+ph+34,{size:8,fill:t.soft,font:MONO,anchor:'end',tracking:0.12}));
  if(block.rows.length>rows.length)out.push(txt(`${block.rows.length-rows.length} more row(s) not drawn.`,px,py+ph+34,{size:10,fill:t.muted,italic:true}));
  bottom=py+ph+44;
  const legend=legendStrip(series.map((k,s)=>({kind:'swatch' as const,fill:series.length===1?t.muted:t.series[s],label:block.columns[k]})),M,bottom+12,contentW,t);out.push(legend.svg);
  bottom+=12+legend.height;
  const srcs=block.sourceIds.map(id=>c.doc.sources.find(s=>s.id===id)?.title).filter(Boolean) as string[];
  if(srcs.length){out.push(lines(sansLines(`Sources: ${srcs.join('; ')}`,contentW,10,2),M,bottom+14,14,{size:10,fill:t.muted}));bottom+=34;}
 }
 let y=bottom+12;const cards=c.editorial?summaryCards(c,M,y+8,contentW):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:contentW+2*M,height:y+12+M-12,title:`${found?.block.title??spec.title} · chart`,
  desc:found?`Bar chart of ${found.block.title} (${PROVENANCE[found.block.provenance].tag.toLowerCase()}): ${found.series.map(k=>found.block.columns[k]).join(', ')} by ${found.block.columns[found.category]}.`:`No chartable table on the public view ${spec.viewId}.`,
  t,theme:c.theme,type:'chart',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+out.join('')+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,contentW,t)});
}
