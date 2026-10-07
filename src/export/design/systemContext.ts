import type {Project} from '../../core/model';
import type {SpecEdge,SpecNode} from '../../core/viewspec';
import {placeLabel,summaryCards} from './architecture';
import {designContext,eyebrowOf,footerParts,type DesignOptions} from './context';
import {clipMono,f,footerLine,header,KIND_TAG,labelText,legendStrip,markers,monoWidth,MONO,nodeBox,sansLines,svgDocument,treatmentOf,treatmentStyle,TREATMENT_LABEL,txt,type Box,type LegendItem,type Treatment} from './kit';
import {xml} from '../diagram';

const M=48,BW=176,BH=64,G=144,BOUND=432,GV=24,PAD=16,CH=28,CG=8,MAX_SIDE=7,MAX_CHIPS=12;
export type ContextRole='entry'|'sink'|'inner'|'isolated';
/**
 * Roles from connection direction only, inside the view: an entry has outgoing but no incoming connection, a sink
 * incoming but no outgoing, an inner component both, an isolated one neither. Self-loops are ignored. No actor is invented.
 */
export function contextRoles(nodes:SpecNode[],edges:SpecEdge[]):Map<string,ContextRole>{
 const ids=new Set(nodes.map(n=>n.id)),into=new Set<string>(),out=new Set<string>();
 for(const e of edges){if(e.from===e.to||!ids.has(e.from)||!ids.has(e.to))continue;out.add(e.from);into.add(e.to);}
 return new Map(nodes.map(n=>[n.id,into.has(n.id)&&out.has(n.id)?'inner':out.has(n.id)?'entry':into.has(n.id)?'sink':'isolated']));
}

/**
 * System context (C4 level-1 style): the view as one dashed system boundary listing its inner components as chips,
 * entry points (no incoming connection) outside on the left and sinks (no outgoing connection) outside on the right.
 * Each outside component gets one connector to or from the boundary carrying its connection labels. When no component
 * is an entry or a sink, the view has no clear boundary and its components are only listed.
 */
export function contextSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'context',options),{spec,t}=c,ids=new Set(spec.nodes.map(n=>n.id)),edges=spec.edges.filter(e=>e.from!==e.to&&ids.has(e.from)&&ids.has(e.to));
 const roles=contextRoles(spec.nodes,edges),byPos=(a:SpecNode,b:SpecNode)=>a.position.y-b.position.y||a.position.x-b.position.x||a.id.localeCompare(b.id);
 const of=(r:ContextRole)=>spec.nodes.filter(n=>roles.get(n.id)===r).sort(byPos),allL=of('entry'),allR=of('sink'),inner=of('inner'),isolated=of('isolated');
 const clear=allL.length+allR.length>0,members=clear?[...inner,...isolated]:[...spec.nodes].sort(byPos),left=allL.slice(0,MAX_SIDE),right=allR.slice(0,MAX_SIDE);
 const chips=members.length>MAX_CHIPS?members.slice(0,MAX_CHIPS-1):members,more=members.length-chips.length;
 const contentW=BW*2+G*2+BOUND,hdr=header(eyebrowOf(c,'System context'),spec.title,c.purpose,M,M,contentW,t,c.editorial),top=M+hdr.height+44;
 const out:string[]=[],treatments=new Set<Treatment>(),used=new Set<string>(),boxes:(Box&{id:string})[]=[];
 const head=(s:string,x:number,y:number,anchor:'start'|'middle'|'end'='start')=>out.push(txt(s,x,y,{size:8,fill:t.soft,font:MONO,tracking:0.14,anchor}));
 // Geometry: the boundary is tall enough for its chips and for both side stacks, which are centred on it so every connector runs straight.
 const rows=Math.ceil((chips.length+(more?1:0))/2),chipsH=56+Math.max(1,rows)*(CH+CG)-CG+PAD,span=(n:number)=>n*BH+Math.max(0,n-1)*GV;
 const bh=Math.ceil(Math.max(chipsH,span(left.length)+2*PAD+24,span(right.length)+2*PAD+24,120)/4)*4,bx=M+BW+G,by=top,cy=by+bh/2;
 const place=(list:SpecNode[],x:number)=>{const y0=Math.round((cy-span(list.length)/2)/4)*4;return list.map((n,i)=>({id:n.id,x,y:y0+i*(BH+GV),w:BW,h:BH}));};
 const sideL=place(left,M),sideR=place(right,M+contentW-BW);boxes.push(...sideL,...sideR);
 if(left.length)head(`ENTRY POINTS · ${allL.length}`,M,sideL[0].y-12);if(right.length)head(`SINKS · ${allR.length}`,M+contentW,sideR[0].y-12,'end');
 // Boundary: dashed, view title as a mono eyebrow, counts beneath, chips in two columns.
 const internal=edges.filter(e=>members.some(m=>m.id===e.from)&&members.some(m=>m.id===e.to)).length;
 out.push(`<g data-dd-role="boundary"><rect x="${f(bx)}" y="${f(by)}" width="${BOUND}" height="${bh}" rx="8" fill="${t.wash}" stroke="${t.muted}" stroke-width="1.2" stroke-dasharray="6,4"/>`+
  txt(clipMono(`SYSTEM · ${spec.title}`.toUpperCase(),BOUND-2*PAD,9,0.14),bx+PAD,by+22,{size:9,fill:t.muted,font:MONO,tracking:0.14})+
  txt(clipMono(`${members.length} component(s) · ${internal} internal connection(s)`,BOUND-2*PAD,9),bx+PAD,by+38,{size:9,fill:t.soft,font:MONO})+'</g>');
 const cw=(BOUND-2*PAD-CG)/2;
 chips.forEach((n,i)=>{const x=bx+PAD+(i%2)*(cw+CG),y=by+56+Math.floor(i/2)*(CH+CG),focal=c.focal.has(n.id),tr=treatmentOf(n.kind,n.basis??'unspecified',focal),s=treatmentStyle(tr,t);treatments.add(tr);
  const tag=KIND_TAG[n.kind],tw=Math.max(28,Math.ceil(monoWidth(tag,7,0.08)+10)),name=sansLines(n.label,cw-tw-24,11,1,true)[0]??'';
  out.push(`<g data-node-id="${xml(n.id)}" data-dd-role="${roles.get(n.id)}"><title>${xml(`${n.label} · ${n.kind} · ${roles.get(n.id)==='isolated'?'no connection in this view':'inside the boundary'}`)}</title>`+
   `<rect x="${f(x)}" y="${f(y)}" width="${f(cw)}" height="${CH}" rx="4" fill="${t.paper}"/><rect x="${f(x)}" y="${f(y)}" width="${f(cw)}" height="${CH}" rx="4" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1"${s.dash?` stroke-dasharray="${s.dash}"`:''}/>`+
   `<rect x="${f(x+8)}" y="${f(y+8)}" width="${tw}" height="12" rx="2" fill="none" stroke="${focal?t.accent:t.soft}" stroke-opacity="0.6" stroke-width="0.8"/>`+
   txt(tag,x+8+tw/2,y+17,{size:7,fill:focal?t.accent:t.soft,font:MONO,anchor:'middle',tracking:0.08})+txt(name,x+tw+16,y+18,{size:11,fill:t.ink,weight:600})+'</g>');});
 if(more){const i=chips.length,x=bx+PAD+(i%2)*(cw+CG),y=by+56+Math.floor(i/2)*(CH+CG);
  out.push(`<g data-dd-role="more"><rect x="${f(x)}" y="${f(y)}" width="${f(cw)}" height="${CH}" rx="4" fill="none" stroke="${t.rule}" stroke-dasharray="3,3"/>`+txt(`+${more} more`,x+cw/2,y+18,{size:9,fill:t.muted,font:MONO,anchor:'middle'})+'</g>');}
 // One connector per outside component, summarising its connections to or from the boundary.
 const inside=new Set(members.map(m=>m.id)),conns:{id:string;side:'l'|'r';pts:{x:number;y:number}[];es:SpecEdge[]}[]=[];
 for(const b of sideL){const es=edges.filter(e=>e.from===b.id&&inside.has(e.to));if(es.length)conns.push({id:b.id,side:'l',es,pts:[{x:b.x+b.w,y:b.y+b.h/2},{x:bx,y:b.y+b.h/2}]});}
 for(const b of sideR){const es=edges.filter(e=>e.to===b.id&&inside.has(e.from));if(es.length)conns.push({id:b.id,side:'r',es,pts:[{x:bx+BOUND,y:b.y+b.h/2},{x:b.x,y:b.y+b.h/2}]});}
 const name=(id:string)=>spec.nodes.find(n=>n.id===id)?.label??id;
 for(const k of conns){const link=k.es.every(e=>e.kind==='query');used.add(link?'link':'muted');
  out.push(`<path data-dd-from="${xml(k.side==='l'?k.id:'boundary')}" data-dd-to="${xml(k.side==='l'?'boundary':k.id)}" data-dd-edges="${xml(k.es.map(e=>e.id).join(' '))}" d="M ${f(k.pts[0].x)} ${f(k.pts[0].y)} L ${f(k.pts[1].x)} ${f(k.pts[1].y)}" fill="none" stroke="${link?t.link:t.muted}" stroke-width="1.2" marker-end="url(#${c.slug}-${link?'link':'arrow'})">`+
   `<title>${xml(k.es.map(e=>`${name(e.from)} → ${name(e.to)}${e.label?`: ${e.label}`:''} (${e.kind})`).join('; '))}</title></path>`);}
 for(const b of boxes){const s=spec.nodes.find(n=>n.id===b.id)!,tr=treatmentOf(s.kind,s.basis??'unspecified',c.focal.has(s.id));treatments.add(tr);
  out.push(nodeBox({...b,attr:'data-node-id',name:s.label,sub:s.provider&&s.provider!=='Generic'?s.provider:s.summary,tag:KIND_TAG[s.kind],treatment:tr,opens:!!s.opens,
   title:`${s.label} · ${s.kind} · ${roles.get(s.id)==='entry'?'entry point: no incoming connection in this view':'sink: no outgoing connection in this view'}${s.opens?' · opens a detail view':''}`},t).replace('<g ',`<g data-dd-role="${roles.get(s.id)}" `));}
 const placed:Box[]=[],bound={x:bx,y:by,w:BOUND,h:bh};
 for(const k of conns){const labels=[...new Set(k.es.map(e=>(e.label||e.kind).replace(/\s*\((inferred|possible)\)$/,'')))],extra=labels.length>1?` +${labels.length-1}`:'';
  const base=labelText(labels[0]),text=extra?clipMono(base,(G-24)-monoWidth(extra,8,0.06),8,0.06)+extra:base,chip=placeLabel(text,k.pts,[...boxes,bound],placed,t);if(chip){placed.push(chip.box);out.push(chip.svg);}}
 const areaBottom=Math.max(by+bh,...boxes.map(b=>b.y+b.h)),bypass=edges.filter(e=>!inside.has(e.from)&&!inside.has(e.to)).length,lost=[...sideL,...sideR].filter(b=>!conns.some(k=>k.id===b.id)).length;
 const notes=[...(!spec.nodes.length?['This view has no public components.']:!edges.length?['This view has no connections: no entry point or sink can be told apart, so components are listed.']:!clear?['Every component both receives and sends inside this view: it has no clear boundary, so components are listed.']:[]),
  ...(clear&&!inner.length?['No component both receives and sends: the boundary holds no inner component.']:[]),
  ...(clear&&isolated.length?[`${isolated.length} component(s) without a connection in this view are listed inside the boundary.`]:[]),
  ...(allL.length+allR.length-left.length-right.length>0?[`${allL.length+allR.length-left.length-right.length} more outside component(s) not drawn (limit ${MAX_SIDE} per side).`]:[]),
  ...(bypass?[`${bypass} connection(s) between outside components bypass the boundary and are not drawn${lost?` (${lost} outside component(s) have no connector)`:''}.`]:[]),
  ...(clear?['Entry points and sinks come from connection direction inside this view, never from an actor list.']:[])];
 notes.forEach((n,i)=>out.push(txt(n,M,areaBottom+32+i*15,{size:10,fill:t.muted,italic:true})));
 const tOrder:Treatment[]=['focal','backend','store','external','input','optional'];
 const items:LegendItem[]=[...tOrder.filter(x=>treatments.has(x)).map(x=>({kind:'box' as const,treatment:x,label:x==='focal'?(c.focalReason==='hint'?'Focal':'Most connected'):TREATMENT_LABEL[x]})),
  {kind:'line',stroke:'muted',dashed:true,label:'System boundary (this view)'},...(used.has('muted')?[{kind:'line' as const,stroke:'muted' as const,label:'Flow (summarised)'}]:[]),
  ...(used.has('link')?[{kind:'line' as const,stroke:'link' as const,label:'Request / API'}]:[])];
 const ly=areaBottom+32+notes.length*15+12,legend=legendStrip(items,M,ly,contentW,t);
 let y=ly+legend.height+12;const cards=c.editorial?summaryCards(c,M,y+8,contentW):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:contentW+2*M,height:y+M,title:`${spec.title} · system context`,
  desc:clear?`System context of the public view ${spec.viewId}: ${allL.length} entry point(s) on the left, ${allR.length} sink(s) on the right and ${members.length} component(s) inside the boundary, from connection direction only.`:`System context of the public view ${spec.viewId}: no clear boundary, ${spec.nodes.length} component(s) listed.`,
  t,theme:c.theme,type:'context',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+out.join('')+legend.svg+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,contentW,t)});
}
