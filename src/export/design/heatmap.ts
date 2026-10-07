import type {EvidenceBlock,Project} from '../../core/model';
import {designContext,eyebrowOf,footerParts,type DesignOptions} from './context';
import {summaryCards} from './architecture';
import {chartableTable} from './chart';
import {clipMono,f,footerLine,header,legendStrip,lines,markers,monoWidth,MONO,sansLines,svgDocument,txt,type Tokens} from './kit';
import {xml} from '../diagram';

type Table=Extract<EvidenceBlock,{type:'table'}>;
const M=48,MAX_COLS=8,MAX_ROWS=24,CELL_H=28;
const PROVENANCE:Record<EvidenceBlock['provenance'],{tag:string;note:string}>={
 synthetic:{tag:'SYNTHETIC DATA',note:'Illustrative values made up for teaching or design. Not a measured or verified result.'},
 'source-derived':{tag:'SOURCE-DERIVED',note:'Values transcribed from the cited sources; not independently verified.'},
 reference:{tag:'REFERENCE',note:'Reference values from the cited documentation.'},
 author:{tag:'AUTHOR-PROVIDED',note:'Values entered by the author; not verified by DiagramCloud.'}};
const fmt=(v:number)=>Math.abs(v)>=1e6?`${+(v/1e6).toFixed(1)}M`:Math.abs(v)>=1e4?`${+(v/1e3).toFixed(1)}k`:String(+v.toFixed(2));
/** The accent at a given opacity, as rgba, for legend swatches. */
const tint=(t:Tokens,a:number)=>{const h=t.accent.replace('#','');return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`;};
const LO=0.06,HI=0.86,STRONG=0.55;
/** Every numeric column of a table (all values numbers or empty, at least one number), up to eight. */
const numericColumns=(block:Table)=>block.columns.flatMap((_,k)=>block.rows.every(r=>r[k]===null||typeof r[k]==='number')&&block.rows.some(r=>typeof r[k]==='number')?[k]:[]);
export const heatmapColumns=(block:Table):number[]=>numericColumns(block).slice(0,MAX_COLS);
/** Per-column normalisation: 0 at the column minimum, 1 at its maximum; a constant column sits at the middle. */
export function normalise(values:(number|null)[]):(number|null)[]{
 const nums=values.filter((v):v is number=>v!==null),lo=Math.min(...nums),hi=Math.max(...nums);
 return values.map(v=>v===null?null:hi===lo?0.5:(v-lo)/(hi-lo));
}

/**
 * Heatmap: the first table evidence block of the view's components with numeric columns, one row per table row
 * (labelled by its category column) and one column per numeric column (up to eight). Each cell is shaded with the
 * accent in proportion to its value normalised within its own column, so columns with different units stay comparable.
 * The provenance is printed before the cells, so synthetic values are never mistaken for results.
 */
export function heatmapSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'heatmap',options),{spec,t}=c,found=chartableTable(c),contentW=720;
 const hdr=header(eyebrowOf(c,'Heatmap'),found?found.block.title:spec.title,found?`From the evidence of ${spec.title}. Shade is normalised per column, from its minimum to its maximum.`:'No table evidence with numbers on this view\'s components: attach a table block to map it.',M,M,contentW,t,c.editorial);
 const out:string[]=[];let bottom=M+hdr.height+24,cols:number[]=[];
 if(found){const {block,category}=found,p=PROVENANCE[block.provenance],top=M+hdr.height+28;cols=heatmapColumns(block);
  // Provenance tag first: the reader sees what kind of numbers these are before the cells.
  const tw=Math.ceil(monoWidth(p.tag,8,0.12))+14;
  out.push(`<g data-provenance="${block.provenance}"><rect x="${M}" y="${top}" width="${tw}" height="16" rx="2" fill="${t.accentTint}" stroke="${t.accent}" stroke-width="0.8"/>${txt(p.tag,M+tw/2,top+11.5,{size:8,fill:t.accent,font:MONO,anchor:'middle',tracking:0.12})}${txt(p.note,M+tw+10,top+12,{size:10,fill:t.muted,italic:true})}</g>`);
  const rows=block.rows.slice(0,MAX_ROWS),LABEL_W=Math.min(240,Math.max(96,Math.ceil((Math.max(...rows.map((r,i)=>monoWidth(String(r[category]??i+1),10)))+24)/4)*4));
  const cw=Math.min(128,Math.floor((contentW-LABEL_W)/cols.length/4)*4),gx=M+LABEL_W,hy=top+48,gy=hy+28;
  const norms=cols.map(k=>normalise(rows.map(r=>typeof r[k]==='number'?r[k] as number:null)));
  cols.forEach((k,j)=>{const x=gx+j*cw+cw/2,vals=rows.map(r=>r[k]).filter((v):v is number=>typeof v==='number');
   out.push(txt(clipMono(block.columns[k].toUpperCase(),cw-8,8,0.1),x,hy,{size:8,fill:t.muted,font:MONO,anchor:'middle',tracking:0.1}),
    txt(clipMono(`${fmt(Math.min(...vals))}–${fmt(Math.max(...vals))}`,cw-8,7),x,hy+12,{size:7,fill:t.soft,font:MONO,anchor:'middle'}));});
  out.push(txt(clipMono(String(block.columns[category]??'').toUpperCase(),LABEL_W-16,8,0.1),M,hy,{size:8,fill:t.soft,font:MONO,tracking:0.1}));
  rows.forEach((r,i)=>{const y=gy+i*CELL_H;
   out.push(`<g data-row="${i}">`+txt(clipMono(String(r[category]??i+1),LABEL_W-16,10),M,y+CELL_H/2+3.5,{size:10,fill:t.ink,font:MONO}));
   cols.forEach((k,j)=>{const v=typeof r[k]==='number'?r[k] as number:null,n=norms[j][i],x=gx+j*cw;
    if(v===null||n===null){out.push(`<rect data-column="${xml(block.columns[k])}" x="${x+2}" y="${y+2}" width="${cw-4}" height="${CELL_H-4}" rx="2" fill="none" stroke="${t.rule}" stroke-dasharray="3,3"/>`,txt('—',x+cw/2,y+CELL_H/2+3,{size:8,fill:t.soft,font:MONO,anchor:'middle'}));return;}
    const a=LO+(HI-LO)*n;
    out.push(`<rect data-column="${xml(block.columns[k])}" data-value="${v}" data-norm="${f(n)}" x="${x+2}" y="${y+2}" width="${cw-4}" height="${CELL_H-4}" rx="2" fill="${t.accent}" fill-opacity="${Math.round(a*100)/100}"><title>${xml(`${String(r[category]??i+1)} · ${block.columns[k]}: ${v}`)}</title></rect>`,
     txt(clipMono(fmt(v),cw-8,8),x+cw/2,y+CELL_H/2+3,{size:8,fill:n>=STRONG?t.inkStrong:t.ink,font:MONO,anchor:'middle'}));});
   out.push('</g>');});
  out.push(`<line x1="${M}" y1="${gy-4}" x2="${gx+cols.length*cw}" y2="${gy-4}" stroke="${t.ruleSolid}" stroke-width="1"/>`);
  bottom=gy+rows.length*CELL_H+8;
  if(block.rows.length>rows.length){out.push(txt(`${block.rows.length-rows.length} more row(s) not drawn.`,M,bottom+12,{size:10,fill:t.muted,italic:true}));bottom+=20;}
  if(numericColumns(block).length>cols.length){out.push(txt(`Only the first ${MAX_COLS} numeric columns are drawn.`,M,bottom+12,{size:10,fill:t.muted,italic:true}));bottom+=20;}
  const legend=legendStrip([{kind:'swatch',fill:tint(t,LO),label:'Column minimum'},{kind:'swatch',fill:tint(t,(LO+HI)/2),label:'Midpoint'},{kind:'swatch',fill:tint(t,HI),label:'Column maximum'}],M,bottom+12,contentW,t);out.push(legend.svg);
  bottom+=12+legend.height;
  const srcs=block.sourceIds.map(id=>c.doc.sources.find(s=>s.id===id)?.title).filter(Boolean) as string[];
  if(srcs.length){out.push(lines(sansLines(`Sources: ${srcs.join('; ')}`,contentW,10,2),M,bottom+14,14,{size:10,fill:t.muted}));bottom+=34;}
 }
 let y=bottom+12;const cards=c.editorial?summaryCards(c,M,y+8,contentW):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:contentW+2*M,height:y+M,title:`${found?.block.title??spec.title} · heatmap`,
  desc:found?`Heatmap of ${found.block.title} (${PROVENANCE[found.block.provenance].tag.toLowerCase()}): ${cols.map(k=>found.block.columns[k]).join(', ')} by ${found.block.columns[found.category]}, shaded per column from minimum to maximum.`:`No table with numbers on the public view ${spec.viewId}.`,
  t,theme:c.theme,type:'heatmap',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+out.join('')+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,contentW,t)});
}
