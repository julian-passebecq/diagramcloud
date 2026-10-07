import type {Project} from '../../core/model';
import type {SpecNode} from '../../core/viewspec';
import {designContext,eyebrowOf,footerParts,type DesignOptions} from './context';
import {fanAttachPoints,placeLabel,summaryCards} from './architecture';
import {clipMono,elbowPath,f,footerLine,header,KIND_TAG,labelText,legendStrip,markers,monoWidth,MONO,nodeBox,overlaps,svgDocument,treatmentOf,TREATMENT_LABEL,txt,
 type Box,type LegendItem,type P,type Treatment} from './kit';
import {xml} from '../diagram';

const M=48,NW=168,NH=64,CG=32,RG=28,PAD=20,TOP=36,ZG=56,ZRG=56,UNASSIGNED='Unassigned';
export type DeploymentZone={id:string;provider:string;nodes:SpecNode[]};
/** Zones of a view: one per provider as declared on its components ("Generic" or empty go to Unassigned), ordered by where their members sit. */
export function deploymentZones(nodes:SpecNode[]):DeploymentZone[]{
 const by=new Map<string,SpecNode[]>();for(const n of nodes){const p=n.provider&&n.provider.trim()&&n.provider!=='Generic'?n.provider.trim():UNASSIGNED;by.set(p,[...(by.get(p)??[]),n]);}
 const mean=(ns:SpecNode[])=>ns.reduce((s,n)=>s+n.position.x,0)/ns.length;
 return [...by].map(([provider,ns])=>({id:provider===UNASSIGNED?'unassigned':`provider-${provider.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}`,provider,
  nodes:[...ns].sort((a,b)=>a.position.x-b.position.x||a.position.y-b.position.y||a.id.localeCompare(b.id))}))
  .sort((a,b)=>(a.provider===UNASSIGNED?1:0)-(b.provider===UNASSIGNED?1:0)||mean(a.nodes)-mean(b.nodes)||a.provider.localeCompare(b.provider));
}
const segHits=(a:P,b:P,boxes:Box[])=>boxes.filter(x=>overlaps({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(b.x-a.x),h:Math.abs(b.y-a.y)},{x:x.x+1,y:x.y+1,w:x.w-2,h:x.h-2})).length;
/** Simple orthogonal route: horizontal-vertical-horizontal (or vertical-horizontal-vertical when the boxes share columns), channel chosen among the free gaps; a channel already taken by another connector costs extra, so parallel runs step aside by 8. */
export function routeBetween(s:Box,t:Box,boxes:Box[],taken:P[][]=[]):P[]{
 const hz=s.x+s.w<=t.x||t.x+t.w<=s.x,others=boxes.filter(b=>b!==s&&b!==t);
 const shared=(a:P,b:P)=>taken.filter(r=>r.slice(1).some((q,i)=>{const p=r[i];return a.x===b.x?p.x===q.x&&Math.abs(p.x-a.x)<4&&Math.min(Math.max(p.y,q.y),Math.max(a.y,b.y))-Math.max(Math.min(p.y,q.y),Math.min(a.y,b.y))>2
  :a.y===b.y&&p.y===q.y&&Math.abs(p.y-a.y)<4&&Math.min(Math.max(p.x,q.x),Math.max(a.x,b.x))-Math.max(Math.min(p.x,q.x),Math.min(a.x,b.x))>2;})).length;
 const cost=(r:P[])=>r.slice(1).reduce((n,q,i)=>n+segHits(r[i],q,others)+(i===1?shared(r[1],q)*0.5:0),0);
 const along=(lo:number,hi:number,edges:number[])=>{const cs=[...new Set([...edges.filter(v=>v>lo&&v<hi),lo,hi])].sort((a,b)=>a-b),mid=Math.round((lo+hi)/8)*4;
  const mids=cs.slice(1).map((v,i)=>Math.round((v+cs[i])/8)*4).sort((a,b)=>Math.abs(a-mid)-Math.abs(b-mid));
  return [...new Set(mids.flatMap(m=>[m,m-8,m+8,m-16,m+16]))].filter(v=>v>lo+4&&v<hi-4).concat(mid);};
 let best:P[]|undefined,score=Infinity;const consider=(r:P[])=>{const n=cost(r);if(n<score){score=n;best=r;}return !n;};
 if(hz){const right=s.x+s.w<=t.x,sx=right?s.x+s.w:s.x,tx=right?t.x:t.x+t.w,sy=s.y+s.h/2,ty=t.y+t.h/2;
  for(const x of along(Math.min(sx,tx),Math.max(sx,tx),others.flatMap(b=>[b.x,b.x+b.w])))if(consider([{x:sx,y:sy},{x,y:sy},{x,y:ty},{x:tx,y:ty}]))break;}
 else{const down=s.y+s.h<=t.y,sy=down?s.y+s.h:s.y,ty=down?t.y:t.y+t.h,sx=s.x+s.w/2,tx=t.x+t.w/2;
  for(const y of along(Math.min(sy,ty),Math.max(sy,ty),others.flatMap(b=>[b.y,b.y+b.h])))if(consider([{x:sx,y:sy},{x:sx,y},{x:tx,y},{x:tx,y:ty}]))break;}
 // Blocked: go round on the outside (a bracket along the right or left sides, or over the tops or under the bottoms).
 if(score>=1){const g=14,R=Math.max(s.x+s.w,t.x+t.w)+g,L=Math.min(s.x,t.x)-g,T=Math.min(s.y,t.y)-g,B=Math.max(s.y+s.h,t.y+t.h)+g,sy=s.y+s.h/2,ty=t.y+t.h/2,sx=s.x+s.w/2,tx=t.x+t.w/2;
  for(const r of [[{x:s.x+s.w,y:sy},{x:R,y:sy},{x:R,y:ty},{x:t.x+t.w,y:ty}],[{x:s.x,y:sy},{x:L,y:sy},{x:L,y:ty},{x:t.x,y:ty}],[{x:sx,y:s.y},{x:sx,y:T},{x:tx,y:T},{x:tx,y:t.y}],[{x:sx,y:s.y+s.h},{x:sx,y:B},{x:tx,y:B},{x:tx,y:t.y+t.h}]])if(consider(r))break;}
 const r=best!;return r[0].x===r[3].x&&r[1].x===r[0].x||r[0].y===r[3].y&&r[1].y===r[0].y?[r[0],r[3]]:r;
}

/** Deployment: one zone per provider declared on the view's public components, components in a grid inside, connections as rounded orthogonal connectors. */
export function deploymentSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c0=designContext(input,viewId,'deployment',options),c={...c0,focal:new Set([...c0.focal].slice(0,2))},{spec,t}=c,contentW=880;
 const hdr=header(eyebrowOf(c,'Deployment'),spec.title,c.purpose,M,M,contentW,t,c.editorial),zones=deploymentZones(spec.nodes);
 // Zone sizes, then rows packed left to right; zones of one row share its height.
 const sized=zones.map(z=>{const cols=Math.min(z.nodes.length<=2?z.nodes.length:z.nodes.length<=4?2:3,Math.max(1,Math.floor((contentW-2*PAD+CG)/(NW+CG)))),rows=Math.ceil(z.nodes.length/cols);
  const label=`${z.provider.toUpperCase()} · ${z.nodes.length}`,w=Math.max(cols*NW+(cols-1)*CG+2*PAD,Math.ceil(monoWidth(clipMono(label,contentW-40,8,0.14),8,0.14))+40);
  return {...z,cols,rows,label,w,h:TOP+rows*NH+(rows-1)*RG+PAD};});
 const rows:(typeof sized)[]=[];for(const z of sized){const r=rows[rows.length-1];if(r&&r.reduce((s,x)=>s+x.w+ZG,0)+z.w<=contentW)r.push(z);else rows.push([z]);}
 const top=M+hdr.height+36,boxes:(Box&{id:string})[]=[],zoneSvg:string[]=[],zoneLabels:Box[]=[];let y=top;
 for(const r of rows){const h=Math.max(...r.map(z=>z.h)),used=r.reduce((s,z)=>s+z.w,0)+ZG*(r.length-1);let x=M+Math.round((contentW-used)/8)*4;
  for(const z of r){const label=clipMono(z.label,z.w-40,8,0.14),lw=Math.ceil(monoWidth(label,8,0.14))+12,gx=x+Math.round((z.w-(z.cols*NW+(z.cols-1)*CG))/2);
   zoneLabels.push({x:x+10,y:y-6,w:lw,h:12});zoneSvg.push(`<g data-deploy-group="${xml(z.id)}" data-provider="${xml(z.provider)}"><rect x="${f(x)}" y="${f(y)}" width="${f(z.w)}" height="${f(h)}" rx="8" fill="${t.wash}" stroke="${z.provider===UNASSIGNED?t.optionalStroke:t.rule}" stroke-width="1"${z.provider===UNASSIGNED?' stroke-dasharray="4,3"':''}/>`+
    `<rect x="${f(x+10)}" y="${f(y-6)}" width="${f(lw)}" height="12" fill="${t.paper}"/>${txt(label,x+16,y+3,{size:8,fill:c.editorial?t.accent:t.soft,font:MONO,tracking:0.14})}</g>`);
   z.nodes.forEach((n,i)=>{const col=Math.floor(i/z.rows),row=i%z.rows;boxes.push({id:n.id,x:gx+col*(NW+CG),y:y+TOP+row*(NH+RG),w:NW,h:NH});});x+=z.w+ZG;}
  y+=h+ZRG;}
 const areaBottom=rows.length?y-ZRG:top+40;
 const byId=new Map(spec.nodes.map(n=>[n.id,n])),boxOf=new Map(boxes.map(b=>[b.id,b]));
 const edges=spec.edges.filter(e=>e.from!==e.to&&boxOf.has(e.from)&&boxOf.has(e.to));
 const taken:P[][]=[],routes=fanAttachPoints(edges.map(e=>{const r=routeBetween(boxOf.get(e.from)!,boxOf.get(e.to)!,boxes,taken);taken.push(r);return r;}),boxes);
 let accentEdges=0;const lineKinds=new Set<string>();
 const arrows=edges.map((s,k)=>{const accent=c.focal.size>1&&c.focal.has(s.from)&&c.focal.has(s.to),link=!accent&&s.kind==='query',dashed=s.kind==='control'||s.kind==='dependency'||s.basis==='unknown';
  if(accent)accentEdges++;lineKinds.add(accent?'accent':link?'link':'muted');if(dashed)lineKinds.add('dashed');
  return `<path data-edge-id="${xml(s.id)}" d="${elbowPath(routes[k])}" fill="none" stroke="${accent?t.accent:link?t.link:t.muted}" stroke-width="${accent?1.6:1.2}"${dashed?' stroke-dasharray="5,4"':''} marker-end="url(#${c.slug}-${accent?'accent':link?'link':'arrow'})"><title>${xml(`${byId.get(s.from)!.label} → ${byId.get(s.to)!.label}${s.label?`: ${s.label}`:''} (${s.kind})`)}</title></path>`;}).join('');
 const treatments=new Set<Treatment>();
 const nodes=boxes.map(b=>{const s=byId.get(b.id)!,tr=treatmentOf(s.kind,s.basis??'unspecified',c.focal.has(s.id));treatments.add(tr);
  return nodeBox({...b,name:s.label,sub:s.summary,tag:KIND_TAG[s.kind],treatment:tr,opens:!!s.opens,title:`${s.label} · ${s.kind} · ${s.provider&&s.provider!=='Generic'?s.provider:UNASSIGNED} · basis ${s.basis}${s.opens?' · opens a detail view':''}`},t);}).join('');
 const placed:Box[]=[],labels=edges.map((s,k)=>{if(!s.label)return '';const chip=placeLabel(labelText(s.label.replace(/\s*\((inferred|possible)\)$/,'')),routes[k],[...boxes,...zoneLabels],placed,t);if(!chip)return '';placed.push(chip.box);return chip.svg;}).join('');
 const empty=spec.nodes.length?'':txt('No public components in this view.',M,top+16,{size:12,fill:t.muted});
 const assigned=zones.filter(z=>z.provider!==UNASSIGNED).length,order:Treatment[]=['focal','backend','store','external','input','optional'];
 const items:LegendItem[]=[{kind:'swatch',fill:t.wash,label:`${assigned} provider${assigned===1?'':'s'}${zones.length>assigned?' + unassigned':''}`},
  ...order.filter(x=>treatments.has(x)).map(x=>({kind:'box' as const,treatment:x,label:x==='focal'&&c.focalReason==='auto'?'Focal · most connected':TREATMENT_LABEL[x]})),
  ...(lineKinds.has('muted')?[{kind:'line' as const,stroke:'muted' as const,label:'Flow'}]:[]),...(lineKinds.has('link')?[{kind:'line' as const,stroke:'link' as const,label:'Request / API'}]:[]),
  ...(accentEdges?[{kind:'line' as const,stroke:'accent' as const,label:'Focal path'}]:[]),...(lineKinds.has('dashed')?[{kind:'line' as const,stroke:'muted' as const,dashed:true,label:'Control / dependency'}]:[])];
 const legend=legendStrip(items,M,areaBottom+32,contentW,t);
 let yy=areaBottom+32+legend.height+12;const cards=c.editorial?summaryCards(c,M,yy+8,contentW):undefined;if(cards)yy+=cards.height+24;
 const foot=footerLine(footerParts(c),M,yy+12,contentW,t);
 return svgDocument({slug:c.slug,width:contentW+2*M,height:yy+M,title:`${spec.title} · ${spec.projectTitle}`,
  desc:`Deployment of the public view ${spec.viewId}: ${spec.nodes.length} components in ${zones.length} zones by declared provider (${zones.map(z=>`${z.provider} ${z.nodes.length}`).join(', ')||'none'}) and ${edges.length} connections. No hosts or regions are inferred.${spec.omissions.length?` ${spec.omissions.join(' ')}`:''}`,
  t,theme:c.theme,type:'deployment',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+zoneSvg.join('')+arrows+nodes+labels+empty+legend.svg+(cards?.svg??'')+foot});
}
