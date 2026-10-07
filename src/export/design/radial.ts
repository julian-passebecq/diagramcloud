import type {Project} from '../../core/model';
import type {SpecEdge,SpecNode} from '../../core/viewspec';
import {summaryCards} from './architecture';
import {designContext,eyebrowOf,footerParts,type DesignOptions} from './context';
import {hubCentre} from './hub';
import {f,footerLine,header,KIND_TAG,legendStrip,markers,monoWidth,MONO,nodeBox,overlaps,svgDocument,treatmentOf,TREATMENT_LABEL,txt,type Box,type LegendItem,type Treatment} from './kit';
import {xml} from '../diagram';

const M=48,BW=120,BH=56,STEP=148,R1=176,PITCH=144,STEPS=3,MAX_RING=[10,16,22];
/** Undirected steps from the centre over the view's public connections (breadth-first); unreachable components are absent. */
export function radialSteps(centre:string,nodes:SpecNode[],edges:SpecEdge[]):Map<string,number>{
 const ids=new Set(nodes.map(n=>n.id)),adj=new Map<string,string[]>([...ids].map(id=>[id,[]]));
 for(const e of edges)if(e.from!==e.to&&ids.has(e.from)&&ids.has(e.to)){adj.get(e.from)!.push(e.to);adj.get(e.to)!.push(e.from);}
 const steps=new Map<string,number>(ids.has(centre)?[[centre,0]]:[]),queue=ids.has(centre)?[centre]:[];
 while(queue.length){const id=queue.shift()!;for(const n of [...adj.get(id)!].sort())if(!steps.has(n)){steps.set(n,steps.get(id)!+1);queue.push(n);}}
 return steps;
}
/** A box edge point on the segment from the box centre towards (dx,dy), pushed out by gap. */
const rim=(cx:number,cy:number,dx:number,dy:number,gap:number)=>{const l=Math.hypot(dx,dy)||1,k=Math.min(dx?(BW/2)/Math.abs(dx):Infinity,dy?(BH/2)/Math.abs(dy):Infinity);return {x:cx+dx*k+dx/l*gap,y:cy+dy*k+dy/l*gap};};

/**
 * Radial reach ("what is within N steps"): the subject at the centre (first focal, else most connected, ties by id),
 * rings for 1, 2 and 3 connection steps over the undirected public connections, each ring's components spaced evenly
 * (ordered by the angle of their nearest inner neighbour, then by id). Only connections between consecutive rings are
 * drawn; connections inside a ring, components farther than three steps and disconnected ones are counted, never drawn.
 */
export function radialSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'radial',options),{spec,t}=c,ids=new Set(spec.nodes.map(n=>n.id)),edges=spec.edges.filter(e=>e.from!==e.to&&ids.has(e.from)&&ids.has(e.to));
 const centre=hubCentre(spec.nodes,edges,c.focal),byId=new Map(spec.nodes.map(n=>[n.id,n])),steps=centre?radialSteps(centre.id,spec.nodes,edges):new Map<string,number>();
 const focal=new Set([...(centre?[centre.id]:[]),...[...c.focal].filter(id=>c.focalReason==='hint'&&id!==centre?.id)].slice(0,2));
 // Ring membership, then order: ring 1 by id from the top; outer rings by the circular mean angle of their placed inner
 // neighbours (then id), spaced evenly and turned as a whole to sit as close as possible to those angles.
 const angle=new Map<string,number>(centre?[[centre.id,0]]:[]),rings:SpecNode[][]=[],overflow:number[]=[];
 const cmean=(as:number[])=>{const x=as.reduce((s,a)=>s+Math.cos(a*2*Math.PI),0),y=as.reduce((s,a)=>s+Math.sin(a*2*Math.PI),0);return Math.abs(x)+Math.abs(y)<1e-9?0:((Math.atan2(y,x)/(2*Math.PI))%1+1)%1;};
 for(let k=1;k<=STEPS;k++){
  const all=spec.nodes.filter(n=>steps.get(n.id)===k),inner=(id:string)=>edges.filter(e=>e.from===id||e.to===id).map(e=>e.from===id?e.to:e.from).filter(o=>steps.get(o)===k-1&&angle.has(o)).map(o=>angle.get(o)!);
  const sorted=all.map(n=>({n,a:k===1?0:cmean(inner(n.id))})).sort((p,q)=>p.a-q.a||p.n.id.localeCompare(q.n.id)),shown=sorted.slice(0,MAX_RING[k-1]);
  const phi=k===1?0:cmean(shown.map((x,i)=>x.a-i/shown.length));
  shown.forEach((x,i)=>angle.set(x.n.id,Math.round((i/shown.length+phi)*720)/720));rings.push(shown.map(x=>x.n));overflow.push(all.length-shown.length);
 }
 const radii:number[]=[];rings.forEach((r,i)=>radii.push(Math.ceil(Math.max(i?radii[i-1]+STEP:R1,r.length*PITCH/(2*Math.PI))/4)*4));
 const used=rings.filter(r=>r.length).length,outer=used?radii[used-1]:0,contentW=Math.max(880,2*(outer+BW/2+24));
 const hdr=header(eyebrowOf(c,'Radial reach'),spec.title,c.purpose,M,M,contentW,t,c.editorial),top=M+hdr.height+40;
 const cx=Math.round((M+contentW/2)/4)*4,cy=Math.round((top+(centre?outer+BH/2+16:0))/4)*4;
 const pos=new Map<string,{x:number;y:number;k:number}>();if(centre)pos.set(centre.id,{x:cx,y:cy,k:0});
 rings.forEach((r,i)=>r.forEach(n=>{const a=-Math.PI/2+angle.get(n.id)!*2*Math.PI;pos.set(n.id,{x:Math.round((cx+radii[i]*Math.cos(a))/4)*4,y:Math.round((cy+radii[i]*Math.sin(a))/4)*4,k:i+1});}));
 const boxes:(Box&{id:string})[]=[...pos].map(([id,p])=>({id,x:p.x-BW/2,y:p.y-BH/2,w:BW,h:BH}));
 const out:string[]=[],lineKinds=new Set<string>(),treatments=new Set<Treatment>();
 // Rings: hairline circles, drawn first.
 rings.forEach((r,i)=>{if(r.length)out.push(`<circle data-dd-ring="${i+1}" cx="${f(cx)}" cy="${f(cy)}" r="${f(radii[i])}" fill="none" stroke="${t.rule}" stroke-width="1" stroke-dasharray="2,4"/>`);});
 // Connectors between consecutive rings only, straight from rim to rim, arrow in the connection's direction.
 const drawn=edges.filter(e=>pos.has(e.from)&&pos.has(e.to)&&Math.abs(pos.get(e.from)!.k-pos.get(e.to)!.k)===1);
 for(const e of drawn){const a=pos.get(e.from)!,b=pos.get(e.to)!,s=rim(a.x,a.y,b.x-a.x,b.y-a.y,2),z=rim(b.x,b.y,a.x-b.x,a.y-b.y,3);
  const accent=focal.size>1&&focal.has(e.from)&&focal.has(e.to),link=!accent&&e.kind==='query',dashed=e.kind==='control'||e.kind==='dependency'||e.basis==='unknown';
  lineKinds.add(accent?'accent':link?'link':'muted');if(dashed)lineKinds.add('dashed');
  out.push(`<path data-edge-id="${xml(e.id)}" d="M ${f(s.x)} ${f(s.y)} L ${f(z.x)} ${f(z.y)}" fill="none" stroke="${accent?t.accent:link?t.link:t.muted}" stroke-width="${accent?1.6:1.2}"${dashed?' stroke-dasharray="5,4"':''} marker-end="url(#${c.slug}-${accent?'accent':link?'link':'arrow'})"><title>${xml(`${byId.get(e.from)!.label} → ${byId.get(e.to)!.label}${e.label?`: ${e.label}`:''} (${e.kind})`)}</title></path>`);}
 for(const b of boxes){const s=byId.get(b.id)!,k=pos.get(b.id)!.k,tr=treatmentOf(s.kind,s.basis??'unspecified',focal.has(s.id));treatments.add(tr);
  out.push(nodeBox({...b,attr:'data-node-id',name:s.label,sub:s.provider&&s.provider!=='Generic'?s.provider:s.summary,tag:KIND_TAG[s.kind],treatment:tr,opens:!!s.opens,
   title:`${s.label} · ${s.kind} · ${k?`${k} step${k>1?'s':''} from ${centre!.label}`:'centre'}${s.opens?' · opens a detail view':''}`},t).replace('<g ',`<g data-dd-step="${k}" `));}
 // Ring labels on masks: the first free spot along each circle, clockwise from the upper right.
 const placed:Box[]=[],segs=drawn.map(e=>[pos.get(e.from)!,pos.get(e.to)!]);
 const crosses=(b:Box)=>segs.some(([a,z])=>{const n=Math.ceil(Math.hypot(z.x-a.x,z.y-a.y)/4);for(let i=0;i<=n;i++){const x=a.x+(z.x-a.x)*i/n,y=a.y+(z.y-a.y)*i/n;if(x>=b.x-2&&x<=b.x+b.w+2&&y>=b.y-2&&y<=b.y+b.h+2)return true;}return false;});
 rings.forEach((r,i)=>{if(!r.length)return;const s=`${i+1} STEP${i?'S':''} · ${r.length+overflow[i]}`,w=Math.ceil(monoWidth(s,8,0.14))+10;
  for(let d=0;d<360;d+=5){const a=(-60+d)*Math.PI/180,x=cx+radii[i]*Math.cos(a),y=cy+radii[i]*Math.sin(a),box={x:x-w/2,y:y-7,w,h:14};
   if(boxes.some(b=>overlaps(box,b,4))||placed.some(b=>overlaps(box,b,4))||crosses(box))continue;placed.push(box);
   out.push(`<g data-dd-ring-label="${i+1}"><rect x="${f(box.x)}" y="${f(box.y)}" width="${w}" height="14" rx="2" fill="${t.paper}"/>${txt(s,x,y+3,{size:8,fill:t.soft,font:MONO,tracking:0.14,anchor:'middle'})}</g>`);break;}});
 const areaBottom=centre?cy+outer+BH/2:top;
 const far=spec.nodes.filter(n=>(steps.get(n.id)??0)>STEPS).length,apart=spec.nodes.filter(n=>!steps.has(n.id)).length,more=overflow.reduce((a,b)=>a+b,0);
 const within=edges.filter(e=>pos.has(e.from)&&pos.has(e.to)&&pos.get(e.from)!.k===pos.get(e.to)!.k).length;
 const notes=[...(!spec.nodes.length?['This view has no public components.']:!rings[0]?.length?[`${centre!.label} has no connections in this view: nothing is within reach.`]:[]),
  ...(far?[`${far} component(s) more than ${STEPS} steps away, not drawn.`]:[]),...(apart?[`${apart} component(s) not connected to ${centre?.label}, not drawn.`]:[]),
  ...(more?[`${more} more component(s) within reach not drawn (limit ${MAX_RING.join(' / ')} per ring).`]:[]),...(within?[`${within} connection(s) inside a ring not drawn.`]:[]),
  ...(spec.nodes.length?['Steps count connections in either direction; they say nothing about order, latency or dependency strength.']:[])];
 notes.forEach((n,i)=>out.push(txt(n,M,areaBottom+32+i*15,{size:10,fill:t.muted,italic:true})));
 const order:Treatment[]=['focal','backend','store','external','input','optional'];
 const items:LegendItem[]=[...order.filter(x=>treatments.has(x)).map(x=>({kind:'box' as const,treatment:x,label:x==='focal'?(c.focalReason==='hint'?'Centre · focal':'Centre · most connected'):TREATMENT_LABEL[x]})),
  ...(lineKinds.has('muted')?[{kind:'line' as const,stroke:'muted' as const,label:'Flow'}]:[]),...(lineKinds.has('link')?[{kind:'line' as const,stroke:'link' as const,label:'Request / API'}]:[]),
  ...(lineKinds.has('accent')?[{kind:'line' as const,stroke:'accent' as const,label:'Focal path'}]:[]),...(lineKinds.has('dashed')?[{kind:'line' as const,stroke:'muted' as const,dashed:true,label:'Control / dependency'}]:[])];
 const ly=areaBottom+32+notes.length*15+12,legend=legendStrip(items,M,ly,contentW,t);
 let y=ly+legend.height+12;const cards=c.editorial?summaryCards(c,M,y+8,contentW):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:contentW+2*M,height:y+M,title:`${spec.title} · radial reach`,
  desc:centre?`Radial reach of ${centre.label} in the public view ${spec.viewId}: ${rings.map((r,i)=>`${r.length+overflow[i]} at ${i+1} step${i?'s':''}`).join(', ')}; ${far} farther and ${apart} not connected. Steps are undirected connection counts.`:`Radial reach of the public view ${spec.viewId}: no public components.`,
  t,theme:c.theme,type:'radial',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+out.join('')+legend.svg+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,contentW,t)});
}
