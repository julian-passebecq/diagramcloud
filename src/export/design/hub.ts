import type {Project} from '../../core/model';
import type {SpecEdge,SpecNode} from '../../core/viewspec';
import {placeLabel,summaryCards} from './architecture';
import {designContext,eyebrowOf,footerParts,type DesignOptions} from './context';
import {elbowPath,footerLine,header,KIND_TAG,labelText,legendStrip,markers,MONO,nodeBox,svgDocument,treatmentOf,TREATMENT_LABEL,txt,type Box,type LegendItem,type P,type Treatment} from './kit';
import {xml} from '../diagram';

const M=48,BW=176,BH=64,FW=208,G=192,GV=24,TOP_GAP=112,MAX_SIDE=7,MAX_TOP=3;
type Role='up'|'down'|'both';
/** The hub's centre: the first focal component, else the most connected one (ties broken by id); undefined when empty. */
export function hubCentre(nodes:SpecNode[],edges:SpecEdge[],focal:Set<string>):SpecNode|undefined{
 const first=[...focal].find(id=>nodes.some(n=>n.id===id));if(first)return nodes.find(n=>n.id===first);
 const deg=new Map(nodes.map(n=>[n.id,0]));for(const e of edges)if(e.from!==e.to&&deg.has(e.from)&&deg.has(e.to)){deg.set(e.from,deg.get(e.from)!+1);deg.set(e.to,deg.get(e.to)!+1);}
 return [...nodes].sort((a,b)=>deg.get(b.id)!-deg.get(a.id)!||a.id.localeCompare(b.id))[0];
}
/** Direct neighbours of the centre: upstream (only point to it), downstream (only receive from it), both ways. */
export function hubNeighbours(centre:string,nodes:SpecNode[],edges:SpecEdge[]):Map<string,Role>{
 const ids=new Set(nodes.map(n=>n.id)),into=new Set<string>(),out=new Set<string>();
 for(const e of edges){if(e.from===e.to||!ids.has(e.from)||!ids.has(e.to))continue;if(e.to===centre)into.add(e.from);if(e.from===centre)out.add(e.to);}
 return new Map([...new Set([...into,...out])].map(id=>[id,into.has(id)&&out.has(id)?'both':into.has(id)?'up':'down']));
}
/** Nesting of bends: index 0 is the bend nearest the target; lines never cross when ordered this way. */
function nest(ls:{k:number;s:number;a:number}[]):Map<number,number>{
 const out=new Map<number,number>(),fwd=ls.filter(l=>l.s<l.a).sort((p,q)=>p.s-q.s),back=ls.filter(l=>l.s>l.a).sort((p,q)=>q.s-p.s);
 fwd.forEach((l,i)=>out.set(l.k,i));back.forEach((l,i)=>out.set(l.k,i));ls.filter(l=>l.s===l.a).forEach(l=>out.set(l.k,-1));return out;
}
const spread=(start:number,len:number,i:number,n:number)=>Math.round((start+len*(i+1)/(n+1))/4)*4;

/**
 * Hub (ego network): one component at the centre, its direct upstream neighbours on the left, downstream on the right
 * and both-way neighbours on top, each connection drawn once as a rounded right-angle connector. Components that are
 * not adjacent, connections between neighbours and neighbours over the limits are counted, never drawn.
 */
export function hubSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'hub',options),{spec,t}=c,ids=new Set(spec.nodes.map(n=>n.id)),edges=spec.edges.filter(e=>ids.has(e.from)&&ids.has(e.to));
 const centre=hubCentre(spec.nodes,edges,c.focal),byId=new Map(spec.nodes.map(n=>[n.id,n])),roles=centre?hubNeighbours(centre.id,spec.nodes,edges):new Map<string,Role>();
 const order=(r:Role,axis:'x'|'y')=>[...roles].filter(([,x])=>x===r).map(([id])=>byId.get(id)!).sort((a,b)=>a.position[axis]-b.position[axis]||a.id.localeCompare(b.id));
 const allUp=order('up','y'),allDown=order('down','y'),allBoth=order('both','x'),up=allUp.slice(0,MAX_SIDE),down=allDown.slice(0,MAX_SIDE),both=allBoth.slice(0,MAX_TOP);
 const shown=new Set<string>([...(centre?[centre.id]:[]),...[...up,...down,...both].map(n=>n.id)]),overflow=allUp.length+allDown.length+allBoth.length-up.length-down.length-both.length;
 const drawn=edges.filter(e=>centre&&e.from!==e.to&&(e.from===centre.id||e.to===centre.id)&&shown.has(e.from)&&shown.has(e.to));
 const between=edges.filter(e=>centre&&e.from!==centre.id&&e.to!==centre.id&&roles.has(e.from)&&roles.has(e.to)).length,others=spec.nodes.length-(centre?1:0)-roles.size;
 const contentW=BW*2+G*2+FW,hdr=header(eyebrowOf(c,'Hub'),spec.title,c.purpose,M,M,contentW,t,c.editorial),top=M+hdr.height+44;
 const out:string[]=[],boxes:(Box&{id:string})[]=[],treatments=new Set<Treatment>(),used=new Set<string>();
 const head=(s:string,x:number,y:number,anchor:'start'|'middle'|'end'='start')=>out.push(txt(s,x,y,{size:8,fill:t.soft,font:MONO,tracking:0.14,anchor}));
 let areaBottom=top;
 if(centre){
  // Geometry: top row (both ways) above the centre; side columns centred on it, kept clear of the top connectors' bends.
  const fx=M+BW+G,rowW=both.length*BW+Math.max(0,both.length-1)*GV,rowX=M+(contentW-rowW)/2,trb=top+BH;
  const sideEdges=(r:Role)=>drawn.filter(e=>roles.get(e.from===centre.id?e.to:e.from)===r).length;
  const fh=Math.max(96,Math.ceil((Math.max(sideEdges('up'),sideEdges('down'))+1)*16/4)*4);
  const span=(n:number)=>n*BH+Math.max(0,n-1)*GV,maxSpan=Math.max(span(up.length),span(down.length));
  let fy=both.length?trb+TOP_GAP:top;const minSide=both.length?trb+64:top;if(fy+fh/2-maxSpan/2<minSide)fy=minSide+maxSpan/2-fh/2;fy=Math.round(fy/4)*4;
  const cy=fy+fh/2,focalBox={id:centre.id,x:fx,y:fy,w:FW,h:fh};boxes.push(focalBox);
  const place=(list:SpecNode[],x:number)=>{const y0=Math.round((cy-span(list.length)/2)/4)*4;return list.map((n,i)=>({id:n.id,x,y:y0+i*(BH+GV),w:BW,h:BH}));};
  const sideL=place(up,M),sideR=place(down,M+contentW-BW),topRow=both.map((n,i)=>({id:n.id,x:rowX+i*(BW+GV),y:top,w:BW,h:BH}));boxes.push(...sideL,...sideR,...topRow);
  const boxOf=new Map(boxes.map(b=>[b.id,b]));
  if(up.length)head(`UPSTREAM · ${allUp.length}`,M,sideL[0].y-12);if(down.length)head(`DOWNSTREAM · ${allDown.length}`,M+contentW,sideR[0].y-12,'end');
  if(both.length)head(`BOTH WAYS · ${allBoth.length}`,rowX,top-12);
  // Attach points: each box side spreads its connectors, ordered by neighbour; the centre's sides likewise.
  const routes=new Map<string,P[]>(),sides:[Role,(e:SpecEdge)=>string][]=[['up',e=>e.from],['down',e=>e.to],['both',e=>e.from===centre.id?e.to:e.from]];
  for(const [role,other] of sides){
   const list=drawn.filter(e=>roles.get(other(e))===role),nb=(e:SpecEdge)=>boxOf.get(other(e))!;
   list.sort((a,b)=>(role==='both'?nb(a).x-nb(b).x:nb(a).y-nb(b).y)||a.id.localeCompare(b.id));
   const at=new Map<string,number>();const ends=list.map((e,k)=>{const b=nb(e),mine=list.filter(x=>other(x)===other(e)),i=mine.indexOf(e);
    const s=role==='both'?spread(b.x,b.w,i,mine.length):spread(b.y,b.h,i,mine.length),a=role==='both'?spread(fx,FW,k,list.length):spread(fy,fh,k,list.length);at.set(e.id,a);return {k,s,a};});
   // A single connector between two boxes whose bands overlap runs straight.
   ends.forEach(l=>{if(list.length===1&&Math.abs(l.s-l.a)<=BH/2){const lo=role==='both'?Math.max(nb(list[0]).x,fx)+8:Math.max(nb(list[0]).y,fy)+8,hi=role==='both'?Math.min(nb(list[0]).x+BW,fx+FW)-8:Math.min(nb(list[0]).y+BH,fy+fh)-8;
    if(lo<=hi){const m=Math.round((lo+hi)/8)*4;l.s=m;l.a=m;}}});
   const lv=nest(ends);
   list.forEach((e,k)=>{const b=nb(e),{s,a}=ends[k],i=lv.get(k)!;let pts:P[];
    if(role==='up'){const bx=fx-20-Math.max(0,i)*12;pts=s===a?[{x:b.x+b.w,y:s},{x:fx,y:a}]:[{x:b.x+b.w,y:s},{x:bx,y:s},{x:bx,y:a},{x:fx,y:a}];}
    else if(role==='down'){const bx=fx+FW+20+Math.max(0,i)*12;pts=s===a?[{x:fx+FW,y:a},{x:b.x,y:s}]:[{x:fx+FW,y:a},{x:bx,y:a},{x:bx,y:s},{x:b.x,y:s}];}
    else{const n=ends.filter(x=>Math.sign(x.a-x.s)===Math.sign(a-s)).length,ly=trb+20+(n-1-Math.max(0,i))*10;
     const p=s===a?[{x:s,y:trb},{x:a,y:fy}]:[{x:s,y:trb},{x:s,y:ly},{x:a,y:ly},{x:a,y:fy}];pts=e.to===centre.id?p:[...p].reverse();}
    routes.set(e.id,pts);});
  }
  // Connectors first, then boxes, then labels on masks.
  for(const e of drawn){const pts=routes.get(e.id);if(!pts)continue;
   const accent=c.focal.size>1&&c.focal.has(e.from)&&c.focal.has(e.to),link=!accent&&e.kind==='query',dashed=e.kind==='control'||e.kind==='dependency'||e.basis==='unknown';
   used.add(accent?'accent':link?'link':'muted');if(dashed)used.add('dashed');
   out.push(`<path data-edge-id="${xml(e.id)}" d="${elbowPath(pts)}" fill="none" stroke="${accent?t.accent:link?t.link:t.muted}" stroke-width="${accent?1.6:1.2}"${dashed?' stroke-dasharray="5,4"':''} marker-end="url(#${c.slug}-${accent?'accent':link?'link':'arrow'})"><title>${xml(`${byId.get(e.from)?.label??e.from} → ${byId.get(e.to)?.label??e.to}${e.label?`: ${e.label}`:''} (${e.kind})`)}</title></path>`);}
  for(const b of boxes){const s=byId.get(b.id)!,isCentre=b.id===centre.id,tr=treatmentOf(s.kind,s.basis??'unspecified',isCentre||(c.focal.has(s.id)&&c.focal.size>1));treatments.add(tr);
   out.push(nodeBox({...b,name:s.label,sub:s.provider&&s.provider!=='Generic'?s.provider:s.summary,tag:KIND_TAG[s.kind],treatment:tr,opens:!!s.opens,
    title:`${s.label} · ${s.kind} · ${isCentre?'centre':roles.get(s.id)==='up'?'upstream':roles.get(s.id)==='down'?'downstream':'both ways'}${s.opens?' · opens a detail view':''}`},t));}
  const placed:Box[]=[];
  for(const e of drawn){const pts=routes.get(e.id);if(!pts)continue;const chip=placeLabel(labelText((e.label||e.kind).replace(/\s*\((inferred|possible)\)$/,'')),pts,boxes,placed,t);if(chip){placed.push(chip.box);out.push(chip.svg);}}
  areaBottom=Math.max(...boxes.map(b=>b.y+b.h));
 }
 const notes=[...(!spec.nodes.length?['This view has no public components.']:!drawn.length?['This view has no connections to the centre: a hub needs at least one.']:[]),
  ...(others>0?[`${others} other component(s) not shown (not directly connected to ${centre?.label}).`]:[]),...(overflow>0?[`${overflow} more neighbour(s) not drawn (limit ${MAX_SIDE} per side, ${MAX_TOP} on top).`]:[]),
  ...(between>0?[`${between} connection(s) between neighbours not drawn.`]:[])];
 notes.forEach((n,i)=>out.push(txt(n,M,areaBottom+32+i*15,{size:10,fill:t.muted,italic:true})));
 const tOrder:Treatment[]=['focal','backend','store','external','input','optional'];
 const items:LegendItem[]=[...tOrder.filter(x=>treatments.has(x)).map(x=>({kind:'box' as const,treatment:x,label:x==='focal'?(c.focalReason==='hint'?'Centre · focal':'Centre · most connected'):TREATMENT_LABEL[x]})),
  ...(used.has('muted')?[{kind:'line' as const,stroke:'muted' as const,label:'Flow'}]:[]),...(used.has('link')?[{kind:'line' as const,stroke:'link' as const,label:'Request / API'}]:[]),
  ...(used.has('accent')?[{kind:'line' as const,stroke:'accent' as const,label:'Focal path'}]:[]),...(used.has('dashed')?[{kind:'line' as const,stroke:'muted' as const,dashed:true,label:'Control / dependency'}]:[])];
 const ly=areaBottom+32+notes.length*15+12,legend=legendStrip(items,M,ly,contentW,t);
 let y=ly+legend.height+12;const cards=c.editorial?summaryCards(c,M,y+8,contentW):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:contentW+2*M,height:y+12+M-12,title:`${spec.title} · hub`,
  desc:centre?`Hub of ${centre.label} in the public view ${spec.viewId}: ${allUp.length} upstream, ${allDown.length} downstream and ${allBoth.length} both-way neighbour(s); ${Math.max(0,others)} other component(s) not shown.`:`Hub of the public view ${spec.viewId}: no public components.`,
  t,theme:c.theme,type:'hub',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+out.join('')+legend.svg+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,contentW,t)});
}
