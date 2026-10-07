import type {EvidenceBlock,Project} from '../../core/model';
import type {SpecEdge} from '../../core/viewspec';
import {designContext,eyebrowOf,footerParts,type DesignOptions} from './context';
import {summaryCards} from './architecture';
import {flowRanks} from './flow';
import {f,footerLine,header,legendStrip,lines,markers,monoWidth,MONO,sansLines,svgDocument,txt,type LegendItem} from './kit';
import {xml} from '../diagram';

type Quantity=NonNullable<SpecEdge['quantity']>;
type Band=SpecEdge&{quantity:Quantity};
const M=48,BAR=12,GAP=30,PLOT=320,MIN_NODE=4,LAST_W=150;
const PROVENANCE:Record<EvidenceBlock['provenance'],{tag:string;note:string}>={
 synthetic:{tag:'SYNTHETIC QUANTITIES',note:'Illustrative amounts made up for teaching or design. Not measured or verified.'},
 'source-derived':{tag:'SOURCE-DERIVED QUANTITIES',note:'Amounts transcribed from the cited sources; not independently verified.'},
 reference:{tag:'REFERENCE QUANTITIES',note:'Reference amounts from the cited documentation.'},
 author:{tag:'AUTHOR-PROVIDED QUANTITIES',note:'Amounts entered by the author; not verified by DiagramCloud.'}};
const fmt=(v:number)=>Math.abs(v)>=1e9?`${+(v/1e9).toFixed(1)}G`:Math.abs(v)>=1e6?`${+(v/1e6).toFixed(1)}M`:Math.abs(v)>=1e4?`${+(v/1e3).toFixed(1)}k`:String(+v.toFixed(2));
const clipSans=(s:string,w:number,size:number)=>{const l=sansLines(s,w,size,1)[0]??'';return l.length<s.replace(/\s+/g,' ').trim().length?`${l.replace(/.$/,'')}…`:l;};
/** The figure's one unit: the most common among the view's quantities (ties: first in connection order). Different units are never summed. */
export function sankeyUnit(edges:SpecEdge[]):string|undefined{
 const count=new Map<string,number>();for(const e of edges)if(e.quantity)count.set(e.quantity.unit,(count.get(e.quantity.unit)??0)+1);
 return [...count].sort((a,b)=>b[1]-a[1])[0]?.[0];
}

/**
 * Sankey: each public connection of the view that states a quantity becomes a band whose thickness is proportional to
 * its value, in one unit (the most common; connections in other units are listed, never summed). Columns follow the
 * reading order from connections (not timing); a component is as tall as the larger of what enters and what leaves it.
 * The quantities' provenance is printed before the bands, and synthetic bands are outlined when provenance is mixed.
 * Without quantities, the figure says how to add one rather than inventing amounts.
 */
export function sankeySvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'sankey',options),{spec,t}=c,unit=sankeyUnit(spec.edges);
 const byId=new Map(spec.nodes.map(n=>[n.id,n]));
 const bands=spec.edges.filter((e):e is Band=>!!e.quantity&&e.quantity.unit===unit&&e.from!==e.to&&byId.has(e.from)&&byId.has(e.to));
 const otherUnit=spec.edges.filter(e=>e.quantity&&e.quantity.unit!==unit),selfLoops=spec.edges.filter(e=>e.quantity&&e.quantity.unit===unit&&e.from===e.to),unquantified=spec.edges.filter(e=>!e.quantity);
 const provs=[...new Set(bands.map(b=>b.quantity.provenance))].sort(),mixed=provs.length>1;
 // Columns from the reading order, compacted so empty ranks leave no gap.
 const ranks=flowRanks(spec.nodes,spec.edges),members=spec.nodes.filter(n=>bands.some(b=>b.from===n.id||b.to===n.id));
 const used=[...new Set(members.map(n=>ranks.get(n.id)??0))].sort((a,b)=>a-b),col=new Map(members.map(n=>[n.id,used.indexOf(ranks.get(n.id)??0)])),cols=used.length;
 const colW=Math.max(150,Math.min(220,Math.floor(960/Math.max(1,cols-1)))),contentW=Math.max(720,(cols-1)*colW+BAR+8+LAST_W);
 const hdr=header(eyebrowOf(c,'Sankey'),spec.title,bands.length?`How much moves along each connection of ${spec.title}, in ${unit}.`:'This view has no connection quantities: nothing to draw as bands.',M,M,contentW,t,c.editorial);
 const out:string[]=[];let bottom=M+hdr.height+24;
 if(bands.length){
  const top=M+hdr.height+28,p=mixed?{tag:'MIXED PROVENANCE',note:`${bands.filter(b=>b.quantity.provenance==='synthetic').length} of ${bands.length} band(s) synthetic (dashed outline): illustrative, not measured. Others: ${provs.filter(x=>x!=='synthetic').join(', ')}.`}:PROVENANCE[provs[0] as EvidenceBlock['provenance']];
  const tw=Math.ceil(monoWidth(p.tag,8,0.12))+14,noteLs=sansLines(p.note,contentW-tw-10,10,2);
  out.push(`<g data-provenance="${mixed?'mixed':provs[0]}"><rect x="${M}" y="${top}" width="${tw}" height="16" rx="2" fill="${t.accentTint}" stroke="${t.accent}" stroke-width="0.8"/>${txt(p.tag,M+7,top+11.5,{size:8,fill:t.accent,font:MONO,tracking:0.12})}${lines(noteLs,M+tw+10,top+12,13,{size:10,fill:t.muted,italic:true})}</g>`);
  // Node totals: the larger of what enters and what leaves (only bands in the figure's unit).
  const inT=new Map<string,number>(),outT=new Map<string,number>();
  for(const b of bands){outT.set(b.from,(outT.get(b.from)??0)+b.quantity.value);inT.set(b.to,(inT.get(b.to)??0)+b.quantity.value);}
  const total=(id:string)=>Math.max(inT.get(id)??0,outT.get(id)??0);
  const columns=Array.from({length:cols},(_,k)=>members.filter(n=>col.get(n.id)===k).sort((a,b)=>a.position.y-b.position.y||a.position.x-b.position.x||a.id.localeCompare(b.id)));
  const fit=Math.min(...columns.map(ns=>{const sum=ns.reduce((a,n)=>a+total(n.id),0);return sum>0?(PLOT-(ns.length-1)*GAP-ns.length*MIN_NODE)/sum:Infinity;}));
  const k=Number.isFinite(fit)&&fit>0?fit:0,thick=(v:number)=>Math.max(1,v*k),hOf=(id:string)=>Math.max(MIN_NODE,thick(total(id)));
  const heights=columns.map(ns=>ns.reduce((a,n)=>a+hOf(n.id),0)+(ns.length-1)*GAP),plotH=Math.max(...heights),py=top+16+noteLs.length*13+30;
  const box=new Map<string,{x:number;y:number;h:number}>();
  columns.forEach((ns,ci)=>{let y=py+(plotH-heights[ci])/2;for(const n of ns){const h=hOf(n.id);box.set(n.id,{x:M+ci*colW,y,h});y+=h+GAP;}});
  // Stack bands at each end in the order of the other end, so they do not cross inside a component.
  const yOf=(id:string)=>box.get(id)!.y,outOff=new Map<string,number>(),inOff=new Map<string,number>(),geo=new Map<string,{y0:number;y1:number;h:number}>();
  const order=[...bands].sort((a,b)=>yOf(a.from)-yOf(b.from)||yOf(a.to)-yOf(b.to)||a.id.localeCompare(b.id));
  for(const b of [...order].sort((a,b)=>yOf(a.to)-yOf(b.to)||a.id.localeCompare(b.id))){const h=thick(b.quantity.value),o=outOff.get(b.from)??0;geo.set(b.id,{y0:yOf(b.from)+o,y1:0,h});outOff.set(b.from,o+h);}
  for(const b of order){const g=geo.get(b.id)!,o=inOff.get(b.to)??0;g.y1=yOf(b.to)+o;inOff.set(b.to,o+g.h);}
  for(const b of order){const g=geo.get(b.id)!,a=box.get(b.from)!,z=box.get(b.to)!,x0=a.x+BAR,x1=z.x,dx=Math.max(60,Math.abs(x1-x0)/2),q=b.quantity,syn=q.provenance==='synthetic';
   const d=`M${f(x0)},${f(g.y0)} C${f(x0+dx)},${f(g.y0)} ${f(x1-dx)},${f(g.y1)} ${f(x1)},${f(g.y1)} L${f(x1)},${f(g.y1+g.h)} C${f(x1-dx)},${f(g.y1+g.h)} ${f(x0+dx)},${f(g.y0+g.h)} ${f(x0)},${f(g.y0+g.h)} Z`;
   const tip=`${byId.get(b.from)!.label} → ${byId.get(b.to)!.label}: ${q.value} ${q.unit} (${q.provenance})${q.note?` · ${q.note}`:''}`;
   out.push(`<path data-dd-edge="${xml(b.id)}" data-dd-value="${q.value}" data-dd-unit="${xml(q.unit)}" data-dd-provenance="${q.provenance}" data-dd-thickness="${f(g.h)}" d="${d}" fill="${syn&&mixed?t.accent:t.muted}" fill-opacity="${syn&&mixed?0.16:0.22}"${mixed&&syn?` stroke="${t.accent}" stroke-width="0.9" stroke-dasharray="4,3"`:''}><title>${xml(tip)}</title></path>`);
   const label=`${fmt(q.value)} ${q.unit}`;
   if(g.h>=11&&monoWidth(label,8)<=Math.max(0,x1-x0-16))out.push(txt(label,(x0+x1)/2,(g.y0+g.y1)/2+g.h/2+3,{size:8,fill:t.ink,font:MONO,anchor:'middle'}));}
  // Components: a bar, its name above it and its total below, never over the bands.
  // The last column is labelled to the right of its bars, so its names never sit on the incoming bands.
  for(const n of members){const b=box.get(n.id)!,last=col.get(n.id)===cols-1&&cols>1,lx=last?b.x+BAR+8:b.x,ly=last?b.y+b.h/2-2:b.y-6;
   out.push(`<rect data-dd-node="${xml(n.id)}" data-dd-total="${total(n.id)}" x="${f(b.x)}" y="${f(b.y)}" width="${BAR}" height="${f(b.h)}" rx="2" fill="${c.focal.has(n.id)?t.accent:t.ink}"><title>${xml(`${n.label}: ${fmt(total(n.id))} ${unit}`)}</title></rect>`,
    txt(clipSans(n.label,last?LAST_W:colW-24,10),lx,ly,{size:10,fill:t.ink,weight:600}),
    txt(`${fmt(total(n.id))} ${unit}`,lx,last?ly+13:b.y+b.h+11,{size:8,fill:t.soft,font:MONO}));}
  bottom=py+plotH+26;
  const notes=[
   'Band thickness is proportional to the stated value. Columns follow the reading order from connections, not timing.',
   ...(otherUnit.length?[`${otherUnit.length} connection(s) in other units, not drawn and never summed: ${otherUnit.slice(0,4).map(e=>`${byId.get(e.from)?.label??e.from} → ${byId.get(e.to)?.label??e.to} ${fmt(e.quantity!.value)} ${e.quantity!.unit}`).join('; ')}${otherUnit.length>4?'; …':''}.`]:[]),
   ...(selfLoops.length?[`${selfLoops.length} connection(s) from a component to itself, not drawn.`]:[]),
   ...(unquantified.length?[`${unquantified.length} connection(s) without a quantity, not drawn.`]:[])];
  for(const note of notes){const ls=sansLines(note,contentW,10,2);out.push(`<g data-dd-note="">${lines(ls,M,bottom+12,14,{size:10,fill:t.muted,italic:true})}</g>`);bottom+=ls.length*14+4;}
  const items:LegendItem[]=[{kind:'swatch',fill:/^#[0-9a-f]{6}$/i.test(t.muted)?`${t.muted}48`:t.muted,label:`Band · ${unit}`},{kind:'swatch',fill:t.ink,label:'Component'},...(mixed?[{kind:'line' as const,stroke:'accent' as const,dashed:true,label:'Synthetic quantity'}]:[])];
  const legend=legendStrip(items,M,bottom+14,contentW,t);out.push(legend.svg);bottom+=14+legend.height;
 }else{
  const msg=['No connection on this view states a quantity, so there are no bands to draw.','To add one, give a connection a "quantity" field in the JSON: {"value": 1200, "unit": "rows/day", "provenance": "author"}. The provenance (source-derived, synthetic, reference or author) is printed on the figure.'];
  const ls=msg.flatMap(m=>sansLines(m,contentW,11,3));out.push(`<g data-dd-empty="">${lines(ls,M,bottom+8,16,{size:11,fill:t.muted})}</g>`);bottom+=8+ls.length*16;
 }
 let y=bottom+12;const cards=c.editorial?summaryCards(c,M,y+8,contentW):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:contentW+2*M,height:y+M,title:`${spec.title} · sankey`,
  desc:bands.length?`Sankey of ${bands.length} connection quantit${bands.length===1?'y':'ies'} in ${unit} (${mixed?'mixed provenance':PROVENANCE[provs[0] as EvidenceBlock['provenance']].tag.toLowerCase()}) on the public view ${spec.viewId}.`:`No connection quantities on the public view ${spec.viewId}.`,
  t,theme:c.theme,type:'sankey',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+out.join('')+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,contentW,t)});
}
