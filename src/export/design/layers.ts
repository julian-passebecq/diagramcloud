import type {Project,ProjectNode} from '../../core/model';
import type {SpecNode} from '../../core/viewspec';
import {designContext,eyebrowOf,footerParts,type DesignContext,type DesignOptions} from './context';
import {summaryCards} from './architecture';
import {clipMono,f,footerLine,header,labelChip,legendStrip,lines,markers,monoWidth,MONO,overlaps,sansLines,svgDocument,treatmentOf,treatmentStyle,TREATMENT_LABEL,txt,
 type Box,type LegendItem,type P,type Treatment} from './kit';
import {xml} from '../diagram';

const M=48;
/** Layers of a view, top to bottom, by component kind (the same reading as the MosaicStudio layer cake). */
export const LAYERS:{id:string;name:string;kinds:ProjectNode['kind'][]}[]=[
 {id:'experience',name:'Experience',kinds:['app','report']},{id:'services',name:'Services & compute',kinds:['process','function','model','physics']},
 {id:'control',name:'Control',kinds:['control']},{id:'data',name:'Data',kinds:['storage','table']},{id:'sources',name:'Sources',kinds:['source']}];
export function layersOf(nodes:SpecNode[]){return LAYERS.map(l=>({...l,nodes:nodes.filter(n=>l.kinds.includes(n.kind))})).filter(l=>l.nodes.length);}
const basisLine=(ns:SpecNode[])=>{const read=ns.filter(n=>n.basis==='static-source').length,planned=ns.filter(n=>n.basis==='planned').length;
 return [`${ns.length} component${ns.length===1?'':'s'}`,read?`${read} read from source`:'',planned?`${planned} planned`:''].filter(Boolean).join(' · ');};

/** Layer stack: full-width bands, index tag, name and basis line, component chips, links counted between bands, one focal band. */
export function layerStackSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'layers',options),{spec,t}=c,layers=layersOf(spec.nodes),contentW=880;
 const hdr=header(eyebrowOf(c,'Layer stack'),spec.title,c.purpose,M,M,contentW,t,c.editorial);
 const gutter=56,bx=M+gutter,bw=contentW-gutter,bh=72,gap=28,top=M+hdr.height+28;
 const layerOf=new Map(layers.flatMap((l,i)=>l.nodes.map(n=>[n.id,i] as const)));
 const focalLayer=layers.findIndex(l=>l.nodes.some(n=>c.focal.has(n.id)));
 let down=0,up=0;const between=layers.map(()=>0);
 for(const e of spec.edges){const a=layerOf.get(e.from),b=layerOf.get(e.to);if(a===undefined||b===undefined||a===b)continue;if(a<b)down++;else up++;for(let i=Math.min(a,b);i<Math.max(a,b);i++)between[i]++;}
 const out:string[]=[];
 layers.forEach((l,i)=>{const y=top+i*(bh+gap),focal=i===focalLayer,s=focal?treatmentStyle('focal',t):{fill:t.backend,stroke:t.ruleSolid};
  out.push(`<g data-layer="${l.id}"><rect x="${bx}" y="${y}" width="${bw}" height="${bh}" rx="6" fill="${t.paper}"/><rect x="${bx}" y="${y}" width="${bw}" height="${bh}" rx="6" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1"/>`,
   `<rect x="${bx+14}" y="${y+14}" width="28" height="14" rx="2" fill="none" stroke="${focal?t.accent:t.soft}" stroke-opacity="0.7" stroke-width="0.8"/>`,txt(`L${i+1}`,bx+28,y+24,{size:8,fill:focal?t.accent:t.soft,font:MONO,anchor:'middle',tracking:0.08}),
   txt(l.name,bx+56,y+28,{size:13,fill:t.ink,weight:600}),txt(clipMono(basisLine(l.nodes),236,9),bx+56,y+46,{size:9,fill:t.muted,font:MONO}));
  // Component chips on the right, two rows at most; the rest is counted.
  const cx0=bx+300,cx1=bx+bw-14;let cx=cx0,row=0,shown=0;
  for(const n of l.nodes){const label=clipMono(n.label,150,8,0.04),w=Math.ceil(monoWidth(label,8,0.04))+14;
   if(cx+w>cx1){if(row===1)break;row++;cx=cx0;}
   const fc=c.focal.has(n.id),cy=y+14+row*24;
   out.push(`<g data-node-id="${xml(n.id)}"><title>${xml(`${n.label} · ${n.kind} · basis ${n.basis}`)}</title><rect x="${f(cx)}" y="${cy}" width="${w}" height="18" rx="2" fill="${fc?t.accentTint:t.paper}" stroke="${fc?t.accent:t.rule}" stroke-width="1"${n.basis==='unknown'?' stroke-dasharray="4,3"':''}/>${txt(label,cx+7,cy+12.5,{size:8,fill:fc?t.ink:t.muted,font:MONO,tracking:0.04})}</g>`);
   cx+=w+8;shown++;}
  if(shown<l.nodes.length)out.push(txt(`+${l.nodes.length-shown} MORE`,cx1,y+bh-10,{size:8,fill:t.soft,font:MONO,anchor:'end',tracking:0.08}));
  out.push('</g>');
  if(i<layers.length-1&&between[i]){const gy=y+bh+gap/2,chip=labelChip(`${between[i]} LINK${between[i]===1?'':'S'}`,bx+bw/2+40,gy+3,t,'start');
   out.push(`<line x1="${bx+bw/2}" y1="${y+bh}" x2="${bx+bw/2}" y2="${y+bh+gap}" stroke="${t.muted}" stroke-width="1"/>`,chip.svg);}
 });
 const bottom=top+layers.length*(bh+gap)-gap;
 // Direction: the majority of cross-layer connections, drawn once in the gutter.
 if(layers.length>1&&(down||up)){const ax=M+20,dn=down>=up;
  out.push(`<line x1="${ax}" y1="${dn?top+8:bottom-8}" x2="${ax}" y2="${dn?bottom-12:top+12}" stroke="${t.muted}" stroke-width="1.2" marker-end="url(#${c.slug}-arrow)"/>`,
   txt('FLOW',ax,top-8,{size:8,fill:t.soft,font:MONO,anchor:'middle',tracking:0.14}));}
 const items:LegendItem[]=[...(focalLayer>=0?[{kind:'box' as const,treatment:'focal' as Treatment,label:c.focalReason==='auto'?'Focal layer · most connected':'Focal layer'}]:[]),
  {kind:'box',treatment:'backend',label:'Layer'},...(spec.nodes.some(n=>n.basis==='unknown')?[{kind:'box' as const,treatment:'optional' as Treatment,label:TREATMENT_LABEL.optional}]:[]),
  ...(down||up?[{kind:'line' as const,stroke:'muted' as const,label:`Flow ${down>=up?'downward':'upward'} (${Math.max(down,up)} of ${down+up})`}]:[])];
 const legend=legendStrip(items,M,bottom+32,contentW,t);
 let y=bottom+32+legend.height+12;const cards=c.editorial?summaryCards(c,M,y+8,contentW):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:contentW+2*M,height:y+12+M-12,title:`${spec.title} · layer stack`,desc:`Layer stack of the public view ${spec.viewId}: ${layers.map(l=>`${l.name} (${l.nodes.length})`).join(', ')}.`,
  t,theme:c.theme,type:'layers',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+out.join('')+legend.svg+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,contentW,t)});
}

// ------------------------------------------------------------------------------------------------ exploded stack
type Plane={key:string;title:string;sub:string;names:string[];nodes:{id:string;label:string;kind:ProjectNode['kind'];basis:string;u:number;v:number}[];edges:[number,number][];focal:boolean;via?:number};
const PW=340,PD=150,TH=8,GAP=200,TW=40,TD=26,TZ=6,MAX_TILE_LABELS=12;

/** Planes: the drilldown chain through this view (parent kept on top), else the view's layers. */
export function explodedPlanes(c:DesignContext):{planes:Plane[];basis:'drilldown'|'layers'}{
 const {doc,spec}=c,chain=spec.path.map(p=>p.viewId);
 const opening=(viewId:string)=>{const v=doc.views.find(v=>v.id===viewId);return doc.nodes.find(n=>v?.nodeIds.includes(n.id)&&n.childViewId&&doc.views.some(w=>w.id===n.childViewId));};
 if(chain.length<3){const next=opening(chain[chain.length-1]);if(next?.childViewId&&!chain.includes(next.childViewId))chain.push(next.childViewId);}
 if(chain.length<3){const next=opening(chain[chain.length-1]);if(next?.childViewId&&!chain.includes(next.childViewId))chain.push(next.childViewId);}
 const ids=chain.slice(-4);
 if(ids.length>=2)return {basis:'drilldown',planes:ids.map((id,i)=>{const v=doc.views.find(v=>v.id===id)!,ns=doc.nodes.filter(n=>v.nodeIds.includes(n.id));
  const xs=ns.map(n=>v.positions[n.id]?.x??0),ys=ns.map(n=>v.positions[n.id]?.y??0),mx=Math.min(...xs),my=Math.min(...ys),rx=Math.max(...xs)-mx||1,ry=Math.max(...ys)-my||1;
  const index=new Map(ns.map((n,k)=>[n.id,k])),nextId=ids[i+1],via=nextId?ns.findIndex(n=>n.childViewId===nextId):-1;
  return {key:id,title:v.title,sub:`${ns.length} component${ns.length===1?'':'s'}${nextId&&via>=0?` · ${ns[via].label} opens the next level`:''}`,names:ns.slice(0,4).map(n=>n.label),
   nodes:ns.map((n,k)=>({id:n.id,label:n.label,kind:n.kind,basis:n.basis??'unspecified',u:Math.max(xs.length>1?(xs[k]-mx)/rx:0.5,0),v:ys.length>1?(ys[k]-my)/ry:0.5})),
   edges:doc.edges.filter(e=>v.edgeIds.includes(e.id)&&index.has(e.source)&&index.has(e.target)).map(e=>[index.get(e.source)!,index.get(e.target)!] as [number,number]),focal:id===spec.viewId,...(via>=0?{via}:{})};})};
 const layers=layersOf(spec.nodes).slice(0,5),focalLayer=layers.findIndex(l=>l.nodes.some(n=>c.focal.has(n.id)));
 return {basis:'layers',planes:layers.map((l,i)=>{const n=l.nodes.length,cols=n>5?Math.ceil(n/2):n,index=new Map(l.nodes.map((x,k)=>[x.id,k]));
  return {key:l.id,title:l.name,sub:basisLine(l.nodes),names:l.nodes.slice(0,4).map(x=>x.label),
   nodes:l.nodes.map((x,k)=>({id:x.id,label:x.label,kind:x.kind,basis:x.basis??'unspecified',u:cols>1?(k%cols)/(cols-1):0.5,v:n>5?Math.floor(k/cols):0.5})),
   edges:spec.edges.filter(e=>index.has(e.from)&&index.has(e.to)).map(e=>[index.get(e.from)!,index.get(e.to)!] as [number,number]),focal:i===(focalLayer>=0?focalLayer:-1)};})};
}

/**
 * Exploded axonometric stack (2:1 dimetric): iso(x,y,z) = (ox + x − y, oy + (x + y)/2 − z). Faces are shaded (top base,
 * left +7 % ink, right +15 % ink), the focal plane is tinted with the accent, labels sit in a right-hand column on
 * horizontal leaders, and dashed trace lines join the component that opens a level to the level below.
 */
export function explodedSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'exploded',options),{spec,t}=c,{planes,basis}=explodedPlanes(c),N=planes.length;
 const labelW=300,stackW=PW+PD,contentW=stackW+60+labelW;
 const hdr=header(eyebrowOf(c,basis==='drilldown'?'Exploded drilldown':'Exploded layers'),spec.title,c.purpose,M,M,contentW,t,c.editorial);
 const zMax=(N-1)*GAP,ox=M+PD,oy=M+hdr.height+40+zMax,iso=(x:number,y:number,z:number):P=>({x:ox+x-y,y:oy+(x+y)/2-z}),pts=(ps:P[])=>ps.map(p=>`${f(p.x)},${f(p.y)}`).join(' ');
 const zOf=(i:number)=>(N-1-i)*GAP,tile=(p:Plane['nodes'][number])=>({x:24+p.u*(PW-48-TW),y:24+p.v*(PD-48-TD)});
 const out:string[]=[],traces:string[]=[],treatments=new Set<Treatment>();
 // Tile labels: at most MAX_TILE_LABELS per plane, placed top plane first and, within a plane, the component that opens the next level, then the
 // focal ones, then document order; a label that would touch one already placed is left out, and the plane's entry counts what stays in tooltips.
 const shown=new Map<number,Map<number,string>>();{const placed:Box[]=[];
  planes.forEach((p,i)=>{const z=zOf(i),m=new Map<number,string>(),order=p.nodes.map((n,k)=>({k,rank:p.via===k?0:c.focal.has(n.id)?1:2})).sort((a,b)=>a.rank-b.rank||a.k-b.k);
   for(const {k} of order){if(m.size>=MAX_TILE_LABELS)break;const T=tile(p.nodes[k]),at=iso(T.x+TW/2,T.y+TD,z),label=clipMono(p.nodes[k].label,64,7),w=monoWidth(label,7);
    const b={x:at.x-w/2-2,y:at.y+11-7*0.75-2,w:w+4,h:7*0.97+4};if(placed.some(q=>overlaps(b,q,0)))continue;placed.push(b);
    m.set(k,txt(label,at.x,at.y+11,{size:7,fill:t.muted,font:MONO,anchor:'middle',extra:` stroke="${p.focal?t.accentTint:t.wash}" stroke-width="3" stroke-linejoin="round" paint-order="stroke"`}));}
   shown.set(i,m);});}
 for(let i=N-1;i>=0;i--){const p=planes[i],z=zOf(i),focal=p.focal;
  const top=[iso(0,0,z),iso(PW,0,z),iso(PW,PD,z),iso(0,PD,z)],left=[iso(0,PD,z),iso(PW,PD,z),iso(PW,PD,z-TH),iso(0,PD,z-TH)],right=[iso(PW,0,z),iso(PW,PD,z),iso(PW,PD,z-TH),iso(PW,0,z-TH)];
  const stroke=focal?t.accent:t.externalStroke;
  out.push(`<g data-plane="${xml(p.key)}"${focal?' data-focal="true"':''}>`,
   ...[[left,focal?t.accentLeft:t.faceLeft],[right,focal?t.accentRight:t.faceRight]].map(([poly,shade])=>`<polygon points="${pts(poly as P[])}" fill="${t.backend}"/><polygon points="${pts(poly as P[])}" fill="${shade}" stroke="${stroke}" stroke-width="0.8" stroke-linejoin="round"/>`),
   `<polygon points="${pts(top)}" fill="${t.backend}"/><polygon points="${pts(top)}" fill="${focal?t.accentTint:t.wash}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round"/>`);
  // Connections in the plane: right-angle in plane coordinates, so they read as isometric runs.
  for(const [a,b] of p.edges.slice(0,24)){const A=tile(p.nodes[a]),B=tile(p.nodes[b]),ax=A.x+TW/2,ay=A.y+TD/2,bx2=B.x+TW/2,by=B.y+TD/2;
   out.push(`<polyline points="${pts([iso(ax,ay,z),iso(bx2,ay,z),iso(bx2,by,z)])}" fill="none" stroke="${t.muted}" stroke-width="0.8" stroke-opacity="0.7"/>`);}
  p.nodes.forEach((n,k)=>{const T=tile(n),fc=c.focal.has(n.id)&&!!spec.nodes.find(s=>s.id===n.id),tr=treatmentOf(n.kind,n.basis,fc),s=treatmentStyle(tr,t);treatments.add(tr);
   const tz=z+TZ,tt=[iso(T.x,T.y,tz),iso(T.x+TW,T.y,tz),iso(T.x+TW,T.y+TD,tz),iso(T.x,T.y+TD,tz)],tl=[iso(T.x,T.y+TD,tz),iso(T.x+TW,T.y+TD,tz),iso(T.x+TW,T.y+TD,z),iso(T.x,T.y+TD,z)],trr=[iso(T.x+TW,T.y,tz),iso(T.x+TW,T.y+TD,tz),iso(T.x+TW,T.y+TD,z),iso(T.x+TW,T.y,z)];
   const via=p.via===k;
   out.push(`<g data-node-id="${xml(n.id)}"><title>${xml(`${n.label} · ${n.kind}${via?' · opens the next level':''}`)}</title>`,
    ...[tl,trr].map((poly,j)=>`<polygon points="${pts(poly)}" fill="${t.backend}"/><polygon points="${pts(poly)}" fill="${j?t.faceRight:t.faceLeft}" stroke="${s.stroke}" stroke-width="0.6"/>`),
    `<polygon points="${pts(tt)}" fill="${t.backend}"/><polygon points="${pts(tt)}" fill="${s.fill}" stroke="${via?t.accent:s.stroke}" stroke-width="${via?1.2:0.8}"${s.dash?` stroke-dasharray="${s.dash}"`:''}/>`,
    '</g>');
   if(via&&i<N-1){const from=iso(T.x+TW/2,T.y+TD/2,z),to=iso(PW/2,PD/2,zOf(i+1));traces.push(`<line x1="${f(from.x)}" y1="${f(from.y)}" x2="${f(from.x)}" y2="${f(to.y)}" stroke="${t.accent}" stroke-width="1" stroke-dasharray="4,3"/><circle cx="${f(from.x)}" cy="${f(to.y)}" r="2.5" fill="${t.accent}"/>`);}
  });
  // Tile labels after every tile of the plane, so a later tile never covers an earlier label.
  out.push(...(shown.get(i)?.values()??[]),'</g>');
 }
 // Label column: one entry per plane on a horizontal leader from the plane's right corner.
 const hidden=(i:number)=>planes[i].nodes.length-(shown.get(i)?.size??0),lx=M+stackW+60,labels=planes.map((p,i)=>{const corner=iso(PW,0,zOf(i)),y=corner.y;
  return `<line x1="${f(corner.x+6)}" y1="${f(y)}" x2="${f(lx-10)}" y2="${f(y)}" stroke="${p.focal?t.accent:t.ruleSolid}" stroke-width="0.8"/><circle cx="${f(corner.x+6)}" cy="${f(y)}" r="2" fill="${p.focal?t.accent:t.soft}"/>`+
   txt(String(i+1).padStart(2,'0'),lx,y-14,{size:9,fill:p.focal?t.accent:t.soft,font:MONO,tracking:0.14})+txt(clipMono(p.title,labelW,13*0.9),lx,y+4,{size:13,fill:t.ink,weight:600})+
   lines(sansLines(p.sub,labelW,10,2),lx,y+20,13,{size:10,fill:t.muted})+txt(clipMono(p.names.join(' · '),labelW,8),lx,y+20+13*sansLines(p.sub,labelW,10,2).length+4,{size:8,fill:t.soft,font:MONO})+
   (hidden(i)?txt(`${p.nodes.length-hidden(i)} of ${p.nodes.length} labelled · ${hidden(i)} name${hidden(i)===1?'':'s'} in tooltips`,lx,y+20+13*sansLines(p.sub,labelW,10,2).length+17,{size:8,fill:t.soft,font:MONO}):'');}).join('');
 const bottom=oy+(PW+PD)/2+TH+12;
 const items:LegendItem[]=[{kind:'box',treatment:'focal',label:basis==='drilldown'?'Current level / focal':'Focal layer'},...(['backend','store','external','input','optional'] as Treatment[]).filter(x=>treatments.has(x)).map(x=>({kind:'box' as const,treatment:x,label:TREATMENT_LABEL[x]})),
  ...(traces.length?[{kind:'line' as const,stroke:'accent' as const,dashed:true,label:'Opens the level below'}]:[])];
 const legend=legendStrip(items,M,bottom+24,contentW,t);
 let y=bottom+24+legend.height+12;const cards=c.editorial?summaryCards(c,M,y+8,contentW):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:contentW+2*M,height:y+12+M-12,title:`${spec.title} · exploded ${basis==='drilldown'?'drilldown':'layers'}`,
  desc:`Exploded axonometric stack of ${N} ${basis==='drilldown'?'drilldown levels':'layers'}: ${planes.map(p=>p.title).join(' › ')}.`,t,theme:c.theme,type:'exploded',viewId:spec.viewId,defs:markers(c.slug,t),
  body:hdr.svg+out.join('')+traces.join('')+labels+legend.svg+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,contentW,t)});
}
