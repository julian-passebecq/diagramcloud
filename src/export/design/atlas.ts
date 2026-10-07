import type {Project,ProjectSnapshot,SnapshotRepository} from '../../core/model';
import {compareSnapshots} from '../../core/atlas/snapshot';
import {designContext,eyebrowOf,footerParts,type DesignContext,type DesignOptions} from './context';
import {placeLabel} from './architecture';
import {clipMono,elbowPath,f,footerLine,header,labelText,markers,monoWidth,MONO,sansLines,svgDocument,txt,lines,type Box,type P,type Tokens} from './kit';
import {xml} from '../diagram';

const M=56,CW=236,CH=124,GX=120,GY=28,MINW=760,MAX_ROWS=8;
export type RevisionState='changed'|'added'|'removed'|'unchanged'|'unknown'|'baseline';
export type AtlasCard={id:string;title:string;nodeId?:string;revision?:string;from?:string;ref?:string;authority:SnapshotRepository['authority'];scanStatus:SnapshotRepository['scanStatus'];opens:boolean;state:RevisionState;column:number;row:number};
const short=(s?:string)=>s?s.slice(0,7):'unknown';
const SCAN_LABEL:Record<SnapshotRepository['scanStatus'],string>={scanned:'scanned','not-scanned':'not scanned',failed:'scan failed',missing:'source missing'};
const BADGE:Record<RevisionState,string>={changed:'Δ',added:'+',removed:'−',unchanged:'=',unknown:'?',baseline:'•'};
export const STATE_LABEL:Record<RevisionState,string>={changed:'Δ changed revision',added:'+ added',removed:'− removed',unchanged:'= unchanged',unknown:'? unknown revision',baseline:'first snapshot'};
function styleOf(s:RevisionState,t:Tokens):{fill:string;stroke:string;dash?:string}{
 switch(s){case 'changed':return {fill:t.accentTint,stroke:t.accent};case 'added':return {fill:t.backend,stroke:t.link};case 'removed':return {fill:t.wash,stroke:t.externalStroke,dash:'4,3'};
  case 'unknown':return {fill:t.wash,stroke:t.optionalStroke,dash:'4,3'};default:return {fill:t.backend,stroke:t.ink};}
}

/**
 * The repositories of a project atlas, one card per repository of the latest public snapshot, each at its own revision
 * (there is no single project revision), compared with the snapshot before it when the authoring document keeps one.
 * Only repositories that reach the public document are drawn; an earlier snapshot only contributes the old revision of
 * a repository that is public now, or a removed repository its author marked public. Never a runtime observation.
 */
export function atlasCards(input:Project,doc:Project):{cards:AtlasCard[];active?:ProjectSnapshot;previous?:ProjectSnapshot}{
 const active=doc.atlas?.snapshots.find(s=>s.id===doc.atlas!.activeSnapshotId);if(!active)return {cards:[]};
 const all=input.atlas?.snapshots??[],at=all.findIndex(s=>s.id===active.id),prevFull=at>0?all[at-1]:undefined;
 const nodes=new Map(doc.nodes.map(n=>[n.id,n])),root=doc.views.find(v=>v.id===doc.rootViewId)!;
 const reachable=(r:SnapshotRepository)=>r.nodeId?nodes.has(r.nodeId):r.visibility==='public';
 // A repository that is private now stays out entirely (never "removed"); a removed one shows only when it was public.
 const shownIds=new Set(active.repositories.map(r=>r.id)),fullIds=new Set((all[at]?.repositories??[]).map(r=>r.id));
 const previous=prevFull?{...prevFull,repositories:prevFull.repositories.filter(r=>shownIds.has(r.id)||(!fullIds.has(r.id)&&reachable(r)))}:undefined;
 const changes=new Map((previous?compareSnapshots(previous,active):[]).map(c=>[c.id,c]));
 const titleOf=(r:SnapshotRepository)=>{const n=r.nodeId?nodes.get(r.nodeId):undefined;return n&&root.nodeIds.includes(n.id)?n.label:r.id;};
 const xs=[...new Set(active.repositories.flatMap(r=>r.nodeId&&root.positions[r.nodeId]?[Math.round(root.positions[r.nodeId].x)]:[]))].sort((a,b)=>a-b);
 const cards:AtlasCard[]=active.repositories.map(r=>{const ch=changes.get(r.id),pos=r.nodeId?root.positions[r.nodeId]:undefined;
  const state:RevisionState=!previous?(r.revision?'baseline':'unknown'):ch?.change==='revision-changed'?'changed':ch?.change==='added'?'added':ch?.change==='unchanged'?'unchanged':'unknown';
  return {id:r.id,title:titleOf(r),...(r.nodeId&&nodes.has(r.nodeId)?{nodeId:r.nodeId}:{}),...(r.revision?{revision:r.revision}:{}),...(state==='changed'?{from:ch!.from}:{}),...(r.ref?{ref:r.ref}:{}),
   authority:r.authority,scanStatus:r.scanStatus,opens:!!(r.nodeId&&nodes.get(r.nodeId)?.childViewId),state,column:pos?xs.indexOf(Math.round(pos.x)):xs.length,row:pos?.y??0};});
 for(const ch of changes.values())if(ch.change==='removed'){const r=previous!.repositories.find(x=>x.id===ch.id)!;
  cards.push({id:r.id,title:r.id,...(r.revision?{from:r.revision}:{}),...(r.ref?{ref:r.ref}:{}),authority:r.authority,scanStatus:r.scanStatus,opens:false,state:'removed',column:xs.length+1,row:0});}
 // Compact columns (no empty ones) and order each by its position, then id.
 const cols=[...new Set(cards.map(c=>c.column))].sort((a,b)=>a-b);for(const c of cards)c.column=cols.indexOf(c.column);
 cards.sort((a,b)=>a.column-b.column||a.row-b.row||a.id.localeCompare(b.id));
 return {cards,active,...(previous?{previous}:{})};
}

function legend(items:{label:string;fill?:string;stroke:string;dash?:string;line?:boolean}[],x:number,y:number,width:number,t:Tokens):{svg:string;height:number}{
 const out=[`<line x1="${f(x)}" y1="${f(y)}" x2="${f(x+width)}" y2="${f(y)}" stroke="${t.rule}" stroke-width="1"/>`,txt('LEGEND',x,y+22,{size:8,fill:t.soft,font:MONO,tracking:0.14})];
 let cx=x+72,cy=y+22;
 for(const it of items){const label=it.label.toUpperCase(),w=28+monoWidth(label,8,0.08)+20;if(cx+w>x+width){cx=x+72;cy+=20;}
  out.push(it.line?`<line x1="${f(cx)}" y1="${f(cy-3)}" x2="${f(cx+18)}" y2="${f(cy-3)}" stroke="${it.stroke}" stroke-width="1.2"${it.dash?` stroke-dasharray="${it.dash}"`:''}/>`
   :`<rect x="${f(cx)}" y="${f(cy-9)}" width="18" height="12" rx="3" fill="${it.fill}" stroke="${it.stroke}"${it.dash?` stroke-dasharray="${it.dash}"`:''}/>`);
  out.push(txt(label,cx+26,cy,{size:8,fill:t.muted,font:MONO,tracking:0.08}));cx+=w;}
 return {svg:out.join(''),height:cy-y+14};
}

/** Footer without the 8-character revision vector: the cards already carry every revision (7 characters). */
const atlasFooter=(c:DesignContext,n:number)=>[c.spec.projectId,`view ${c.spec.viewId}`,`${n} repositor${n===1?'y':'ies'}, each at its own revision`,c.now.toISOString().slice(0,10),'public content only',...c.spec.omissions.slice(0,1)];

function cardSvg(c:AtlasCard,b:Box,t:Tokens):string{
 const s=styleOf(c.state,t),tag=c.authority.toUpperCase(),tagW=Math.ceil(monoWidth(tag,7,0.08)+10),x=b.x+12,w=b.w-24,removed=c.state==='removed';
 const name=sansLines(c.title,w-28,12,2,true),ink=removed?t.muted:t.ink;
 const rev=c.state==='changed'?`${short(c.from)} → ${short(c.revision)}`:removed?`${short(c.from)} (removed)`:c.state==='added'?`${short(c.revision)} (new)`:short(c.revision);
 const revColor=c.state==='changed'?t.accent:c.state==='added'?t.link:c.revision||removed?ink:t.soft;
 const badgeColor=c.state==='changed'?t.accent:c.state==='added'?t.link:t.soft;
 const row=(k:string,v:string,y:number,fill:string)=>txt(k,x,y,{size:8,fill:t.soft,font:MONO,tracking:0.1})+txt(clipMono(v,w-40,10),x+40,y,{size:10,fill,font:MONO});
 const titleText=`${c.title} · revision ${c.state==='changed'?`${short(c.from)} → ${short(c.revision)}`:short(c.revision??c.from)} · ${c.ref??'ref unknown'} · ${c.authority} · ${SCAN_LABEL[c.scanStatus]}${c.opens?' · opens its scan':''} · ${STATE_LABEL[c.state]}`;
 return `<g data-dd-repo="${xml(c.id)}" data-dd-revision-state="${c.state}"${c.nodeId?` data-node-id="${xml(c.nodeId)}"`:''}${c.opens?' data-opens="true"':''}><title>${xml(titleText)}</title>`+
  `<rect x="${f(b.x)}" y="${f(b.y)}" width="${f(b.w)}" height="${f(b.h)}" rx="6" fill="${t.paper}"/>`+
  `<rect x="${f(b.x)}" y="${f(b.y)}" width="${f(b.w)}" height="${f(b.h)}" rx="6" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${c.state==='changed'?1.4:1}"${s.dash?` stroke-dasharray="${s.dash}"`:''}/>`+
  `<rect x="${f(b.x+8)}" y="${f(b.y+6)}" width="${tagW}" height="12" rx="2" fill="none" stroke="${t.soft}" stroke-opacity="0.6" stroke-width="0.8"/>`+txt(tag,b.x+8+tagW/2,b.y+15,{size:7,fill:t.soft,font:MONO,anchor:'middle',tracking:0.08})+
  `<g data-dd-badge="${c.state}"><rect x="${f(b.x+b.w-26)}" y="${f(b.y+6)}" width="18" height="16" rx="3" fill="${t.paper}" stroke="${badgeColor}" stroke-width="1"/>`+txt(BADGE[c.state],b.x+b.w-17,b.y+18,{size:11,fill:badgeColor,weight:700,anchor:'middle'})+'</g>'+
  lines(name,x,b.y+(name.length>1?38:44),15,{size:12,fill:ink,weight:600})+
  row('REV',rev,b.y+76,revColor)+row('REF',c.ref??'unknown',b.y+93,c.ref?ink:t.soft)+row('SCAN',SCAN_LABEL[c.scanStatus]+(c.opens?' · opens scan':''),b.y+110,c.opens?t.link:t.muted)+
  (c.opens?`<path d="M ${f(b.x+b.w-46)} ${f(b.y+8)} h 8 v 8" fill="none" stroke="${t.soft}" stroke-width="1"/><path d="M ${f(b.x+b.w-38)} ${f(b.y+8)} l -6 6" stroke="${t.soft}" stroke-width="1"/>`:'')+'</g>';
}

/**
 * Atlas (repository revisions): one card per repository of the latest snapshot with its short revision, ref, authority
 * and scan state; Δ / + / − against the previous snapshot; declared relationships (root view edges) as dashed
 * connectors. Without an atlas the figure says it needs `npm run atlas` and lists the view's components.
 */
export function atlasSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'atlas' as never,options),{spec,t}=c,{cards,active,previous}=atlasCards(input,c.doc);
 const out:string[]=[],notes:string[]=[];
 if(!active){
  const width=MINW,hdr=header(eyebrowOf(c,'Atlas'),spec.title,'No project atlas in this document: there are no repository revisions to draw.',M,M,width,t,c.editorial);
  let y=M+hdr.height+32;
  out.push(`<g data-dd-empty="atlas">`+txt('This figure needs a project atlas: run `npm run atlas` with a project manifest, then open the generated document.',M,y,{size:11,fill:t.ink,weight:600})+
   txt(`COMPONENTS OF THIS VIEW · ${spec.nodes.length}`,M,y+28,{size:8,fill:t.soft,font:MONO,tracking:0.14}));
  const list=spec.nodes.slice(0,24),colW=width/2;
  list.forEach((n,i)=>out.push(`<g data-node-id="${xml(n.id)}">`+txt(clipMono(`· ${n.label}`,colW-16,10),M+(i%2)*colW,y+48+Math.floor(i/2)*17,{size:10,fill:t.muted,font:MONO})+'</g>'));
  y+=48+Math.ceil(list.length/2)*17;if(spec.nodes.length>list.length){out.push(txt(`+${spec.nodes.length-list.length} more`,M,y+4,{size:10,fill:t.soft,italic:true}));y+=17;}
  out.push('</g>');
  return svgDocument({slug:c.slug,width:width+2*M,height:y+24+M,title:`${spec.title} · atlas`,desc:`Atlas figure for ${spec.title}: the document has no project atlas (npm run atlas); ${spec.nodes.length} public component(s) listed.`,
   t,theme:c.theme,type:'atlas',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+out.join('')+footerLine(footerParts(c),M,y+24,width,t)});
 }
 const captured=`${active.capturedAt.slice(0,16).replace('T',' ')} UTC`,root=c.doc.views.find(v=>v.id===c.doc.rootViewId)!;
 const ncol=Math.max(1,...cards.map(k=>k.column+1)),width=Math.max(MINW,ncol*CW+(ncol-1)*GX);
 const hdr=header(eyebrowOf(c,'Atlas · repository revisions'),root.title,`Each repository keeps its own revision; there is no single project revision. Snapshot captured ${captured}.`,M,M,width,t,c.editorial);
 const counts=(s:RevisionState)=>cards.filter(k=>k.state===s).length;
 const compare=previous?`Compared with the snapshot of ${previous.capturedAt.slice(0,10)}: ${counts('changed')} changed · ${counts('added')} added · ${counts('removed')} removed · ${counts('unchanged')} unchanged · ${counts('unknown')} unknown`
  :'No earlier snapshot kept: nothing to compare against.';
 const top0=M+hdr.height+20;out.push(txt(clipMono(compare.toUpperCase(),width,8,0.08),M,top0,{size:8,fill:t.soft,font:MONO,tracking:0.08}));
 const top=top0+28,x0=M+(width-(ncol*CW+(ncol-1)*GX))/2,colX=(i:number)=>x0+i*(CW+GX);
 const boxOf=new Map<string,Box>(),shown:AtlasCard[]=[];let hidden=0;
 for(let i=0;i<ncol;i++)cards.filter(k=>k.column===i).forEach((k,r)=>{if(r>=MAX_ROWS){hidden++;return;}boxOf.set(k.id,{x:colX(i),y:top+r*(CH+GY),w:CW,h:CH});shown.push(k);});
 const cardsBottom=Math.max(...[...boxOf.values()].map(b=>b.y+b.h));
 // Declared relationships between drawn repository cards: right side of the source to the left side of the target.
 const byNode=new Map(shown.filter(k=>k.nodeId).map(k=>[k.nodeId!,k])),edges=c.doc.edges.filter(e=>root.edgeIds.includes(e.id)&&byNode.has(e.source)&&byNode.has(e.target)&&e.source!==e.target);
 const outs=new Map<string,string[]>(),ins=new Map<string,string[]>();
 for(const e of edges){const s=byNode.get(e.source)!.id,d=byNode.get(e.target)!.id;outs.set(s,[...(outs.get(s)??[]),e.id]);ins.set(d,[...(ins.get(d)??[]),e.id]);}
 const attach=(m:Map<string,string[]>,card:string,eid:string)=>{const l=m.get(card)!,b=boxOf.get(card)!,i=l.indexOf(eid);return Math.round((b.y+40+(b.h-48)*(i+1)/(l.length+1))/2)*2;};
 const slot=new Map<number,number>(),take=(g:number)=>{const n=slot.get(g)??0;slot.set(g,n+1);return n%Math.floor((GX-24)/8);};
 let lane=0;const routes=new Map<string,P[]>();
 for(const e of edges){const s=byNode.get(e.source)!,d=byNode.get(e.target)!,sb=boxOf.get(s.id)!,db=boxOf.get(d.id)!,sy=attach(outs,s.id,e.id),ty=attach(ins,d.id,e.id);
  const sx=sb.x+sb.w,tx=db.x;
  if(d.column===s.column+1){const gx=tx-16-take(d.column)*8;routes.set(e.id,sy===ty?[{x:sx,y:sy},{x:tx,y:ty}]:[{x:sx,y:sy},{x:gx,y:sy},{x:gx,y:ty},{x:tx,y:ty}]);}
  else{const gs=sx+16+take(s.column+1)*8,gt=tx-16-take(d.column)*8,ly=cardsBottom+20+(lane++)*10;routes.set(e.id,[{x:sx,y:sy},{x:gs,y:sy},{x:gs,y:ly},{x:gt,y:ly},{x:gt,y:ty},{x:tx,y:ty}]);}}
 const label=(id:string)=>shown.find(k=>k.nodeId===id)?.title??id;
 for(const e of edges)out.push(`<path data-edge-id="${xml(e.id)}" data-dd-basis="${xml(e.basis??'unspecified')}" d="${elbowPath(routes.get(e.id)!)}" fill="none" stroke="${t.muted}" stroke-width="1.2" stroke-dasharray="5,4" marker-end="url(#${c.slug}-arrow)"><title>${xml(`${label(e.source)} → ${label(e.target)}${e.label?`: ${e.label}`:''} (declared, ${e.basis??'basis not stated'})`)}</title></path>`);
 for(const k of shown)out.push(cardSvg(k,boxOf.get(k.id)!,t));
 const placed:Box[]=[],boxes=[...boxOf.values()];
 for(const e of edges){const chip=placeLabel(labelText(e.label||e.kind),routes.get(e.id)!,boxes,placed,t);if(chip){placed.push(chip.box);out.push(chip.svg);}}
 const areaBottom=Math.max(cardsBottom,lane?cardsBottom+20+(lane-1)*10:0);
 if(!cards.length)notes.push('No repository of this snapshot is public.');
 if(hidden)notes.push(`${hidden} more repositor${hidden>1?'ies':'y'} not drawn (limit ${MAX_ROWS} per column).`);
 notes.push('Relationships are declared by the project manifest (planned); revisions come from git or the manifest, as each card says. Not runtime evidence.');
 notes.forEach((n,i)=>out.push(txt(n,M,areaBottom+32+i*15,{size:10,fill:t.muted,italic:true})));
 const items=(['changed','added','removed','unchanged','unknown'] as RevisionState[]).map(s=>({label:STATE_LABEL[s],...styleOf(s,t)}));
 if(edges.length)items.push({label:'Declared relationship',stroke:t.muted,dash:'5,4',line:true} as never);
 const ly=areaBottom+32+notes.length*15+12,leg=legend(items,M,ly,width,t),y=ly+leg.height+12;
 return svgDocument({slug:c.slug,width:width+2*M,height:y+12+M-12,title:`${root.title} · atlas`,
  desc:`Project atlas of ${root.title}: ${cards.length} repositor${cards.length===1?'y':'ies'}, each at its own revision (no single project revision), snapshot captured ${captured}${previous?`, compared with ${previous.capturedAt.slice(0,10)}`:''}.`,
  t,theme:c.theme,type:'atlas',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+out.join('')+leg.svg+footerLine(atlasFooter(c,cards.length),M,y+12,width,t)});
}
