import type {EvidenceBlock,Project} from '../../core/model';
import {designContext,eyebrowOf,footerParts,type DesignOptions} from './context';
import {summaryCards} from './architecture';
import {chartableTable,niceTicks} from './chart';
import {clipMono,f,footerLine,header,legendStrip,lines,markers,monoWidth,MONO,sansLines,svgDocument,txt} from './kit';
import {xml} from '../diagram';

const M=48,LABEL_W=112;
const PROVENANCE:Record<EvidenceBlock['provenance'],{tag:string;note:string}>={
 synthetic:{tag:'SYNTHETIC DATA',note:'Illustrative values made up for teaching or design. Not a measured or verified result.'},
 'source-derived':{tag:'SOURCE-DERIVED',note:'Values transcribed from the cited sources; not independently verified.'},
 reference:{tag:'REFERENCE',note:'Reference values from the cited documentation.'},
 author:{tag:'AUTHOR-PROVIDED',note:'Values entered by the author; not verified by DiagramCloud.'}};
const fmt=(v:number)=>Math.abs(v)>=1e6?`${+(v/1e6).toFixed(1)}M`:Math.abs(v)>=1e4?`${+(v/1e3).toFixed(1)}k`:String(+v.toFixed(2));

/** End labels: one per series at its last point, pushed apart vertically (at least 12 px) and kept inside the plot. */
export function spreadLabels(ys:number[],top:number,bottom:number,gap=12):number[]{
 const order=ys.map((y,i)=>({y,i})).sort((a,b)=>a.y-b.y||a.i-b.i),out=ys.slice();let prev=-Infinity;
 for(const o of order){o.y=Math.max(o.y,prev+gap,top);prev=o.y;}
 const over=prev-bottom;if(over>0)for(const o of order)o.y-=over;
 for(let k=order.length-2;k>=0;k--)order[k].y=Math.min(order[k].y,order[k+1].y-gap);
 for(const o of order)out[o.i]=o.y;return out;
}

/**
 * Line chart: the first table evidence block of the view's components with a numeric column, rows in order on x and
 * up to three numeric series as polylines with point markers. Each line carries a direct label at its end, so the
 * legend is a reminder rather than the only key. The table's provenance is printed first, in the accent tag, so a
 * synthetic table is never mistaken for a result. Missing values break the line. Without a chartable table, it says so.
 */
export function lineSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'line',options),{spec,t}=c,found=chartableTable(c),contentW=720;
 const hdr=header(eyebrowOf(c,'Line chart'),found?found.block.title:spec.title,found?`From the evidence of ${spec.title}.`:'No table evidence with numbers on this view\'s components: attach a table block to draw it as lines.',M,M,contentW,t,c.editorial);
 const out:string[]=[];let bottom=M+hdr.height+24;
 if(found){const {block,category,series}=found,p=PROVENANCE[block.provenance],top=M+hdr.height+28;
  const tw=Math.ceil(monoWidth(p.tag,8,0.12))+14;
  out.push(`<g data-provenance="${block.provenance}"><rect x="${M}" y="${top}" width="${tw}" height="16" rx="2" fill="${t.accentTint}" stroke="${t.accent}" stroke-width="0.8"/>${txt(p.tag,M+7,top+11.5,{size:8,fill:t.accent,font:MONO,tracking:0.12})}${txt(p.note,M+tw+10,top+12,{size:10,fill:t.muted,italic:true})}</g>`);
  const rows=block.rows.slice(0,24),num=(r:typeof rows[number],k:number)=>typeof r[k]==='number'?r[k] as number:null;
  const vals=rows.flatMap(r=>series.map(k=>num(r,k)).filter((v):v is number=>v!==null)),ticks=niceTicks(Math.min(0,...vals),Math.max(0,...vals));
  const px=M+56,pw=contentW-56-LABEL_W,py=top+44,ph=260,lo=ticks[0],hi=ticks[ticks.length-1],Y=(v:number)=>py+ph-(v-lo)/(hi-lo||1)*ph;
  const inset=16,step=(pw-2*inset)/Math.max(1,rows.length-1),X=(i:number)=>px+inset+i*step;
  for(const v of ticks)out.push(`<line x1="${px}" y1="${f(Y(v))}" x2="${px+pw}" y2="${f(Y(v))}" stroke="${v===0?t.ruleSolid:t.rule}" stroke-width="${v===0?1.2:1}"/>`,txt(fmt(v),px-8,Y(v)+3,{size:8,fill:t.soft,font:MONO,anchor:'end'}));
  // Category labels: every row when they fit, otherwise every k-th one (first and last always kept).
  const every=Math.max(1,Math.ceil(36/step));
  rows.forEach((r,i)=>{out.push(`<line x1="${f(X(i))}" y1="${py+ph}" x2="${f(X(i))}" y2="${py+ph+4}" stroke="${t.ruleSolid}" stroke-width="1"/>`);
   if(i%every===0||i===rows.length-1&&(i%every)*step>=36)out.push(txt(clipMono(String(r[category]??i+1),Math.max(step*every-6,36),8),X(i),py+ph+16,{size:8,fill:t.muted,font:MONO,anchor:'middle'}));});
  const colour=(s:number)=>t.series[s%t.series.length],ends:{s:number;x:number;y:number}[]=[];
  series.forEach((k,s)=>{const segs:string[][]=[[]],dots:string[]=[];
   rows.forEach((r,i)=>{const v=num(r,k);if(v===null){if(segs[segs.length-1].length)segs.push([]);return;}
    segs[segs.length-1].push(`${f(X(i))},${f(Y(v))}`);
    dots.push(`<circle data-value="${v}" cx="${f(X(i))}" cy="${f(Y(v))}" r="3" fill="${colour(s)}" stroke="${t.paper}" stroke-width="1"><title>${xml(`${String(r[category]??i+1)} · ${block.columns[k]}: ${v}`)}</title></circle>`);});
   const last=rows.map((r,i)=>[i,num(r,k)] as const).filter(([,v])=>v!==null).pop();if(last)ends.push({s,x:X(last[0]),y:Y(last[1]!)});
   out.push(`<g data-series="${xml(block.columns[k])}">${segs.filter(g=>g.length).map(g=>g.length>1?`<polyline points="${g.join(' ')}" fill="none" stroke="${colour(s)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`:'').join('')}${dots.join('')}</g>`);});
  const ly=spreadLabels(ends.map(e=>e.y+3),py+6,py+ph+3);
  ends.forEach((e,j)=>{const name=clipMono(block.columns[series[e.s]],LABEL_W-14,8),lx=px+pw+8,w=Math.ceil(monoWidth(name,8))+6;
   out.push(`<g data-end-label="${xml(block.columns[series[e.s]])}"><path d="M ${f(e.x+5)} ${f(e.y)} L ${f(lx-2)} ${f(ly[j]-3)}" fill="none" stroke="${colour(e.s)}" stroke-width="0.8" stroke-opacity="0.7"/>`+
    `<rect x="${f(lx)}" y="${f(ly[j]-9)}" width="${w}" height="12" rx="2" fill="${t.paper}"/>${txt(name,lx+3,ly[j],{size:8,fill:colour(e.s),font:MONO})}</g>`);});
  out.push(txt(clipMono(block.columns[category]??'',pw,8,0.12).toUpperCase(),px+pw,py+ph+34,{size:8,fill:t.soft,font:MONO,anchor:'end',tracking:0.12}));
  if(block.rows.length>rows.length)out.push(txt(`${block.rows.length-rows.length} more row(s) not drawn.`,px,py+ph+34,{size:10,fill:t.muted,italic:true}));
  bottom=py+ph+44;
  const legend=legendStrip(series.map((k,s)=>({kind:'swatch' as const,fill:colour(s),label:block.columns[k]})),M,bottom+12,contentW,t);out.push(legend.svg);
  bottom+=12+legend.height;
  const srcs=block.sourceIds.map(id=>c.doc.sources.find(s=>s.id===id)?.title).filter(Boolean) as string[];
  if(srcs.length){out.push(lines(sansLines(`Sources: ${srcs.join('; ')}`,contentW,10,2),M,bottom+14,14,{size:10,fill:t.muted}));bottom+=34;}
 }
 let y=bottom+12;const cards=c.editorial?summaryCards(c,M,y+8,contentW):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:contentW+2*M,height:y+M,title:`${found?.block.title??spec.title} · line chart`,
  desc:found?`Line chart of ${found.block.title} (${PROVENANCE[found.block.provenance].tag.toLowerCase()}): ${found.series.map(k=>found.block.columns[k]).join(', ')} over ${found.block.columns[found.category]}.`:`No chartable table on the public view ${spec.viewId}.`,
  t,theme:c.theme,type:'line',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+out.join('')+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,contentW,t)});
}
