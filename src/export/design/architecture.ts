import {buildScene,NODE_HEIGHT,NODE_WIDTH} from '../scene';
import {positionFor} from '../../core/operations';
import type {ProjectView} from '../../core/model';
import {designContext,eyebrowOf,footerParts,vectorOf,type DesignContext,type DesignOptions} from './context';
import {elbowPath,f,footerLine,header,KIND_TAG,labelChip,labelText,legendStrip,lines,markers,MONO,nodeBox,overlaps,sansLines,svgDocument,treatmentOf,TREATMENT_LABEL,txt,
 type Box,type LegendItem,type P,type Tokens,type Treatment} from './kit';
import {xml} from '../diagram';

const S=0.8,M=48;
type Side='l'|'r'|'t'|'b';
function sideOf(p:P,b:Box):Side|undefined{
 const on=(a:number,v:number)=>Math.abs(a-v)<1.5,inY=p.y>b.y-1&&p.y<b.y+b.h+1,inX=p.x>b.x-1&&p.x<b.x+b.w+1;
 if(on(p.x,b.x)&&inY)return 'l';if(on(p.x,b.x+b.w)&&inY)return 'r';if(on(p.y,b.y)&&inX)return 't';if(on(p.y,b.y+b.h)&&inX)return 'b';return undefined;
}
/** Straight two-point routes get a middle so either end can move along its side. */
function expand(r:P[]):P[]{
 if(r.length!==2)return r;const [a,b]=r;
 if(a.y===b.y){const mx=(a.x+b.x)/2;return [a,{x:mx,y:a.y},{x:mx,y:b.y},b];}
 if(a.x===b.x){const my=(a.y+b.y)/2;return [a,{x:a.x,y:my},{x:b.x,y:my},b];}
 return r;
}
/**
 * Connector rule 4: connectors sharing one side of a box each get their own attach point at L·k/(N+1), ordered by
 * where they go, so no two arrows meet at one point. Only ends that leave perpendicular to the side are moved.
 */
export function fanAttachPoints(routes:P[][],boxes:(Box&{id:string})[]):P[][]{
 const out=routes.map(r=>expand(r.map(p=>({...p}))));
 const groups=new Map<string,{k:number;start:boolean;side:Side;box:Box;order:number}[]>();
 out.forEach((r,k)=>{if(r.length<3)return;
  for(const start of [true,false]){const p=start?r[0]:r[r.length-1],q=start?r[1]:r[r.length-2],far=start?r[r.length-1]:r[0];
   for(const b of boxes){const side=sideOf(p,b);if(!side)continue;
    const perpendicular=side==='l'||side==='r'?p.y===q.y:p.x===q.x;if(!perpendicular)break;
    const key=`${b.id}:${side}`;groups.set(key,[...(groups.get(key)??[]),{k,start,side,box:b,order:side==='l'||side==='r'?far.y:far.x}]);break;}}});
 for(const g of groups.values()){if(g.length<2)continue;
  g.sort((a,b)=>a.order-b.order||a.k-b.k).forEach((e,i)=>{const r=out[e.k],p=e.start?r[0]:r[r.length-1],q=e.start?r[1]:r[r.length-2],n=g.length;
   if(e.side==='l'||e.side==='r'){const y=Math.round(e.box.y+e.box.h*(i+1)/(n+1));p.y=y;q.y=y;}else{const x=Math.round(e.box.x+e.box.w*(i+1)/(n+1));p.x=x;q.x=x;}});}
 return out;
}

/** Label on the longest free segment: above a horizontal one with a 6 px gap, beside a vertical one; never on a box. */
export function placeLabel(text:string,r:P[],boxes:Box[],placed:Box[],t:Tokens):{svg:string;box:Box}|undefined{
 const segs=r.slice(1).map((b,i)=>({a:r[i],b,len:Math.abs(b.x-r[i].x)+Math.abs(b.y-r[i].y)})).sort((p,q)=>q.len-p.len);
 for(const s of segs){
  const horizontal=s.a.y===s.b.y,mid={x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2};
  const chip=horizontal?labelChip(text,mid.x,mid.y-9,t):labelChip(text,mid.x+12,mid.y+3,t,'start');
  if(horizontal&&chip.box.w+16>s.len)continue;if(!horizontal&&s.len<28)continue;
  if(boxes.some(b=>overlaps(chip.box,b,2))||placed.some(b=>overlaps(chip.box,b,4)))continue;
  return chip;
 }
 return undefined;
}

export function summaryCards(c:DesignContext,x:number,y:number,width:number):{svg:string;height:number}{
 const {spec,t}=c,count=(b:string)=>spec.nodes.filter(n=>n.basis===b).length;
 const cards:[string,string][]=[['Drilldown path',spec.path.map(p=>p.title).join(' › ')||spec.title],['Revisions',vectorOf(spec,4)],
  ['Provenance',[[count('static-source'),'read from source'],[count('planned'),'planned'],[count('unknown'),'declared, not read'],[count('unspecified'),'basis not stated']].filter(([n])=>n).map(([n,l])=>`${n} ${l}`).join(' · ')||'no components']];
 const gap=16,w=(width-gap*2)/3,h=92;
 return {height:h,svg:cards.map(([k,v],i)=>{const cx=x+i*(w+gap);return `<rect x="${f(cx)}" y="${f(y)}" width="${f(w)}" height="${h}" rx="6" fill="${t.paper2}" stroke="${t.rule}"/>`+
  txt(k.toUpperCase(),cx+14,y+22,{size:8,fill:t.accent,font:MONO,tracking:0.14})+lines(sansLines(v,w-28,11,4),cx+14,y+42,15,{size:11,fill:t.ink});}).join('')};
}

/**
 * Authored positions closer than one box apart would draw boxes on top of each other. The figure then spreads the whole
 * layout by the smallest uniform factor that separates every pair by SPREAD_GAP on one axis (identical positions are first
 * set side by side), so the arrangement the author drew keeps its shape; a view that already fits is left untouched.
 */
const SPREAD_GAP=24;
export function spreadPositions(view:ProjectView):ProjectView{
 const ids=view.nodeIds,ps=ids.map(id=>({...positionFor(view,id)})),seen=new Map<string,number>();
 for(const p of ps){const k=`${p.x},${p.y}`,n=seen.get(k)??0;seen.set(k,n+1);p.x+=n*(NODE_WIDTH+SPREAD_GAP);}
 let s=1;
 for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const dx=Math.abs(ps[i].x-ps[j].x),dy=Math.abs(ps[i].y-ps[j].y);
  if(dx>=NODE_WIDTH+SPREAD_GAP||dy>=NODE_HEIGHT+SPREAD_GAP)continue;
  s=Math.max(s,Math.min(dx?(NODE_WIDTH+SPREAD_GAP)/dx:Infinity,dy?(NODE_HEIGHT+SPREAD_GAP)/dy:Infinity));}
 if(s===1&&ps.every((p,i)=>p.x===positionFor(view,ids[i]).x))return view;
 const x0=Math.min(...ps.map(p=>p.x)),y0=Math.min(...ps.map(p=>p.y));
 return {...view,positions:Object.fromEntries(ids.map((id,i)=>[id,{x:Math.round(x0+(ps[i].x-x0)*s),y:Math.round(y0+(ps[i].y-y0)*s)}]))};
}

/** A computed placement for the architecture renderer: positions in canvas units and optional lanes drawn behind. */
export type ArchitectureLayout={type:string;label:string;positions:Record<string,{x:number;y:number}>;lanes?:{id:string;title:string;members:string[]}[];desc?:string};

export function architectureSvg(input:Parameters<typeof designContext>[0],viewId:string,options:DesignOptions={},layout?:(c:DesignContext)=>ArchitectureLayout):string{
 const c0=designContext(input,viewId,'architecture',options),plan=layout?.(c0),c=plan?{...c0,slug:c0.slug.replace(/-architecture$/,`-${plan.type}`)}:c0;
 const {doc,spec,t}=c,view=spreadPositions(plan?{...c.view,positions:plan.positions}:c.view),scene=buildScene(doc,view),b=scene.bounds;
 const byId=new Map(spec.nodes.map(n=>[n.id,n])),edgeById=new Map(spec.edges.map(e=>[e.id,e]));
 const W0=b.width*S,contentW=Math.max(W0,640),hdr=header(eyebrowOf(c,plan?.label??'Architecture'),spec.title,c.purpose,M,M,contentW,t,c.editorial);
 const ox=M+(contentW-W0)/2-b.x*S,oy=M+hdr.height+28-b.y*S,X=(p:P):P=>({x:p.x*S+ox,y:p.y*S+oy});
 const boxes=scene.nodes.map(n=>({id:n.id,x:n.x*S+ox,y:n.y*S+oy,w:n.w*S,h:n.h*S}));
 const routes=fanAttachPoints(scene.edges.map(e=>e.points.map(X)),boxes);
 // Zones (at most three): one per repository group, only when the frame encloses its members and nothing else.
 const zones:string[]=[],zoneBoxes:Box[]=[];
 // Lanes (swimlane layouts): full-width bands behind the boxes, one per lane, label in the band head.
 for(const lane of plan?.lanes??[]){const mem=boxes.filter(x=>lane.members.includes(x.id));if(!mem.length)continue;
  const y0=Math.min(...mem.map(m=>m.y))-32,y1=Math.max(...mem.map(m=>m.y+m.h))+16;
  zones.push(`<g data-lane="${xml(lane.id)}"><rect x="${f(M-12)}" y="${f(y0)}" width="${f(contentW+24)}" height="${f(y1-y0)}" rx="6" fill="${t.wash}" stroke="${t.rule}" stroke-width="1"/>${txt(lane.title.toUpperCase().slice(0,48),M,y0+16,{size:8,fill:t.soft,font:MONO,tracking:0.14})}</g>`);}
 if(!plan?.lanes&&spec.groups.length>=2&&spec.groups.length<=3)for(const g of spec.groups){const mem=boxes.filter(x=>g.members.includes(x.id));if(!mem.length)continue;
  const z={x:Math.min(...mem.map(m=>m.x))-20,y:Math.min(...mem.map(m=>m.y))-32,w:0,h:0};z.w=Math.max(...mem.map(m=>m.x+m.w))+20-z.x;z.h=Math.max(...mem.map(m=>m.y+m.h))+20-z.y;
  if(boxes.some(x=>!g.members.includes(x.id)&&overlaps(x,z))||zoneBoxes.some(o=>overlaps(o,z,8)))continue;zoneBoxes.push(z);
  const label=g.title.toUpperCase().slice(0,40),lw=label.length*8*0.76+12;
  zones.push(`<g data-zone="${xml(g.id)}"><rect x="${f(z.x)}" y="${f(z.y)}" width="${f(z.w)}" height="${f(z.h)}" rx="8" fill="${t.wash}" stroke="${t.rule}" stroke-width="1"/><rect x="${f(z.x+10)}" y="${f(z.y-6)}" width="${f(lw)}" height="12" fill="${t.paper}"/>${txt(label,z.x+16,z.y+3,{size:8,fill:t.soft,font:MONO,tracking:0.14})}</g>`);}
 // Arrows first, then boxes, then labels on masks (masks never overlap a box).
 let accentEdges=0;const used=new Set<string>();
 const arrows=scene.edges.map((e,k)=>{const s=edgeById.get(e.id);if(!s)return '';
  const accent=c.focal.size>1&&c.focal.has(s.from)&&c.focal.has(s.to),link=!accent&&s.kind==='query',dashed=s.kind==='control'||s.kind==='dependency'||s.basis==='unknown';
  if(accent)accentEdges++;used.add(accent?'accent':link?'link':'muted');if(dashed)used.add('dashed');
  return `<path data-edge-id="${xml(e.id)}" d="${elbowPath(routes[k])}" fill="none" stroke="${accent?t.accent:link?t.link:t.muted}" stroke-width="${accent?1.6:1.2}"${dashed?' stroke-dasharray="5,4"':''} marker-end="url(#${c.slug}-${accent?'accent':link?'link':'arrow'})"><title>${xml(`${byId.get(s.from)?.label??s.from} → ${byId.get(s.to)?.label??s.to}${s.label?`: ${s.label}`:''} (${s.kind})`)}</title></path>`;}).join('');
 const treatments=new Set<Treatment>();
 const nodes=scene.nodes.map((n,i)=>{const s=byId.get(n.id);if(!s)return '';const tr=treatmentOf(s.kind,s.basis??'unspecified',c.focal.has(s.id));treatments.add(tr);
  return nodeBox({...boxes[i],id:s.id,name:s.label,sub:s.provider&&s.provider!=='Generic'?s.provider:s.summary,tag:KIND_TAG[s.kind],treatment:tr,opens:!!s.opens,
   title:`${s.label} · ${s.kind} · basis ${s.basis}${s.confidence?` · ${s.confidence}`:''}${s.opens?' · opens a detail view':''}`},t);}).join('');
 const placed:Box[]=[],labels=scene.edges.map((e,k)=>{const s=edgeById.get(e.id);if(!s?.label)return '';const chip=placeLabel(labelText(s.label.replace(/\s*\((inferred|possible)\)$/,'')),routes[k],boxes,placed,t);if(!chip)return '';placed.push(chip.box);return chip.svg;}).join('');
 const areaBottom=Math.max(b.y+b.height,...scene.nodes.map(n=>n.y+n.h))*S+oy;
 const order:Treatment[]=['focal','backend','store','external','input','optional'];
 const items:LegendItem[]=[...order.filter(x=>treatments.has(x)).map(x=>({kind:'box' as const,treatment:x,label:x==='focal'&&c.focalReason==='auto'?'Focal · most connected':TREATMENT_LABEL[x]})),
  ...(used.has('muted')?[{kind:'line' as const,stroke:'muted' as const,label:'Flow'}]:[]),...(used.has('link')?[{kind:'line' as const,stroke:'link' as const,label:'Request / API'}]:[]),
  ...(accentEdges?[{kind:'line' as const,stroke:'accent' as const,label:'Focal path'}]:[]),...(used.has('dashed')?[{kind:'line' as const,stroke:'muted' as const,dashed:true,label:'Control / dependency'}]:[])];
 const legend=legendStrip(items,M,areaBottom+28,contentW,t);
 let y=areaBottom+28+legend.height+12;const cards=c.editorial?summaryCards(c,M,y+8,contentW):undefined;if(cards)y+=cards.height+24;
 const foot=footerLine(footerParts(c),M,y+12,contentW,t),height=y+12+M-12;
 return svgDocument({slug:c.slug,width:contentW+2*M,height,title:`${spec.title} · ${spec.projectTitle}`,desc:`${plan?.desc??'Architecture'} of the public view ${spec.viewId}: ${spec.nodes.length} components and ${spec.edges.length} connections.${spec.omissions.length?` ${spec.omissions.join(' ')}`:''}`,
  t,theme:c.theme,type:plan?.type??'architecture',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+zones.join('')+arrows+nodes+labels+legend.svg+(cards?.svg??'')+foot});
}
