import type {DesignTheme,Project} from '../../core/model';
import {publicDocument} from '../../core/operations';
import {viewSpec,type SpecEdge,type SpecNode,type ViewSpec} from '../../core/viewspec';
import {buildScene} from '../scene';
import {fanAttachPoints} from './architecture';
import {vectorOf} from './context';
import {elbowPath,f,footerLine,header,KIND_TAG,legendStrip,lines,markers,MONO,nodeBox,sansLines,slugOf,svgDocument,tokensFor,treatmentOf,txt,type LegendItem,type P,type Tokens} from './kit';
import {xml} from '../diagram';

export type ComponentStatus='unchanged'|'added'|'removed'|'changed'|'moved'|'changed moved';
export type RelationshipStatus='unchanged'|'added'|'removed'|'changed'|'rewired'|'changed rewired';
export type ViewDelta={viewId:string;before:ViewSpec;after:ViewSpec;components:Map<string,ComponentStatus>;relationships:Map<string,RelationshipStatus>;ledger:string[]};

const sig=(n:SpecNode)=>[n.label,n.kind,n.provider,n.summary,n.basis,n.designStatus].join('\u0001');
const edgeSig=(e:SpecEdge)=>[e.label,e.kind,e.basis].join('\u0001');
const MOVE=8;

/**
 * Two states of one view, compared by stable ID (diagram-design's architecture-delta vocabulary): a component is added,
 * removed, changed (label, kind, provider, summary, basis or design status differ), moved (canvas position differs by
 * more than 8 units) or both; a relationship is added, removed, changed (label, kind or basis) or rewired (same ID,
 * other endpoints). Both states are public documents. A delta has two states only: it does not establish migration
 * order, downtime or causality.
 */
export function compareView(beforeInput:Project,afterInput:Project,viewId:string,now=new Date()):ViewDelta{
 if(beforeInput.id!==afterInput.id)throw new Error(`These are two different projects (${beforeInput.id}, ${afterInput.id}): compare two versions of the same project.`);
 const has=(d:Project)=>publicDocument(d).views.some(v=>v.id===viewId);
 if(!has(beforeInput)||!has(afterInput))throw new Error(`View ${viewId} is not public in ${has(beforeInput)?'the newer':'the earlier'} version: pick a view both versions show.`);
 const before=viewSpec(beforeInput,viewId,{now}),after=viewSpec(afterInput,viewId,{now});
 const bn=new Map(before.nodes.map(n=>[n.id,n])),an=new Map(after.nodes.map(n=>[n.id,n])),be=new Map(before.edges.map(e=>[e.id,e])),ae=new Map(after.edges.map(e=>[e.id,e]));
 const components=new Map<string,ComponentStatus>(),relationships=new Map<string,RelationshipStatus>(),ledger:string[]=[];
 const name=(id:string)=>an.get(id)?.label??bn.get(id)?.label??id;
 for(const id of new Set([...bn.keys(),...an.keys()])){const a=bn.get(id),b=an.get(id);
  if(!a){components.set(id,'added');ledger.push(`ADDED · ${b!.label} (${b!.kind})`);continue;}
  if(!b){components.set(id,'removed');ledger.push(`REMOVED · ${a.label}`);continue;}
  const changed=sig(a)!==sig(b),moved=Math.abs(a.position.x-b.position.x)>MOVE||Math.abs(a.position.y-b.position.y)>MOVE;
  components.set(id,changed&&moved?'changed moved':changed?'changed':moved?'moved':'unchanged');
  if(changed){const what=a.label!==b.label?`renamed from "${a.label}"`:a.kind!==b.kind?`kind ${a.kind} → ${b.kind}`:a.provider!==b.provider?`${a.provider||'no provider'} → ${b.provider||'no provider'}`:a.basis!==b.basis?`basis ${a.basis} → ${b.basis}`:a.designStatus!==b.designStatus?`status ${a.designStatus} → ${b.designStatus}`:'summary changed';
   ledger.push(`CHANGED · ${b.label}: ${what}`);}
  if(moved)ledger.push(`MOVED · ${b.label}`);
 }
 for(const id of new Set([...be.keys(),...ae.keys()])){const a=be.get(id),b=ae.get(id);
  if(!a){relationships.set(id,'added');ledger.push(`ADDED LINK · ${name(b!.from)} → ${name(b!.to)}${b!.label?` (${b!.label})`:''}`);continue;}
  if(!b){relationships.set(id,'removed');ledger.push(`REMOVED LINK · ${name(a.from)} → ${name(a.to)}`);continue;}
  const changed=edgeSig(a)!==edgeSig(b),rewired=a.from!==b.from||a.to!==b.to;
  relationships.set(id,changed&&rewired?'changed rewired':changed?'changed':rewired?'rewired':'unchanged');
  if(rewired)ledger.push(`REWIRED · ${name(a.from)} → ${name(a.to)} now ${name(b.from)} → ${name(b.to)}`);
  if(changed)ledger.push(`CHANGED LINK · ${name(b.from)} → ${name(b.to)}: ${a.label!==b.label?`"${a.label}" → "${b.label}"`:a.kind!==b.kind?`${a.kind} → ${b.kind}`:`basis ${a.basis} → ${b.basis}`}`);
 }
 return {viewId,before,after,components,relationships,ledger};
}

const M=48,S=0.6,LEDGER=280,GAP=32;
const BADGE:Record<string,string>={added:'+',removed:'−',changed:'Δ',moved:'↗'};

function panel(doc:Project,spec:ViewSpec,which:'before'|'after',d:ViewDelta,t:Tokens,slug:string,origin:{minX:number;minY:number},ox:number,oy:number):string{
 const view=doc.views.find(v=>v.id===spec.viewId)!,scene=buildScene(doc,view),byId=new Map(spec.nodes.map(n=>[n.id,n])),edgeById=new Map(spec.edges.map(e=>[e.id,e]));
 const X=(p:P):P=>({x:(p.x-origin.minX)*S,y:(p.y-origin.minY)*S});
 const boxes=scene.nodes.map(n=>({id:n.id,x:(n.x-origin.minX)*S,y:(n.y-origin.minY)*S,w:n.w*S,h:n.h*S})),routes=fanAttachPoints(scene.edges.map(e=>e.points.map(X)),boxes);
 const paths=scene.edges.map((e,k)=>{const s=edgeById.get(e.id);if(!s)return '';const st=d.relationships.get(e.id)??'unchanged';
  const dash=st==='removed'?' stroke-dasharray="5,4"':st.includes('rewired')?' stroke-dasharray="2,3"':'',strong=st!=='unchanged';
  return `<path data-kind="relationship" data-object-id="${xml(e.id)}" data-status="${st}" data-from="${xml(s.from)}" data-to="${xml(s.to)}" d="${elbowPath(routes[k])}" fill="none" stroke="${strong?t.ink:t.muted}" stroke-opacity="${strong?1:0.55}" stroke-width="${strong?1.4:1}"${dash} marker-end="url(#${slug}-arrow)"/>`;}).join('');
 const nodes=scene.nodes.map((n,i)=>{const s=byId.get(n.id);if(!s)return '';const st=d.components.get(n.id)??'unchanged',b=boxes[i];
  const tr=st==='removed'?'optional':treatmentOf(s.kind,s.basis??'unspecified',false),marks=st.split(' ').filter(x=>BADGE[x]);
  const badge=marks.map((m,j)=>`<rect x="${f(b.x+b.w-18-j*18)}" y="${f(b.y-8)}" width="16" height="16" rx="3" fill="${t.paper}" stroke="${t.ink}" stroke-width="1"/>${txt(BADGE[m],b.x+b.w-10-j*18,b.y+4,{size:11,fill:t.ink,weight:700,anchor:'middle'})}`).join('');
  return `<g data-kind="component" data-object-id="${xml(n.id)}" data-status="${st}"${st==='unchanged'?' opacity="0.72"':''}>${nodeBox({...b,id:s.id,name:s.label,sub:s.provider&&s.provider!=='Generic'?s.provider:s.summary,tag:KIND_TAG[s.kind],treatment:tr,title:`${s.label} · ${st}`},t)}${badge}</g>`;}).join('');
 return `<g data-snapshot="${which}" transform="translate(${f(ox)} ${f(oy)})">${paths}${nodes}</g>`;
}

/** Architecture delta: Before · Changes · After, one view of two versions of the same project, both public. */
export function deltaSvg(beforeInput:Project,afterInput:Project,viewId:string,options:{theme?:DesignTheme;now?:Date}={}):string{
 const now=options.now??new Date(),d=compareView(beforeInput,afterInput,viewId,now),theme=options.theme??'light',t=tokensFor(theme),slug=slugOf(`${viewId}-delta`);
 const bd=publicDocument(beforeInput),ad=publicDocument(afterInput),sb=buildScene(bd,bd.views.find(v=>v.id===viewId)!).bounds,sa=buildScene(ad,ad.views.find(v=>v.id===viewId)!).bounds;
 const origin={minX:Math.min(sb.x,sa.x),minY:Math.min(sb.y,sa.y)},pw=(Math.max(sb.x+sb.width,sa.x+sa.width)-origin.minX)*S,ph=(Math.max(sb.y+sb.height,sa.y+sa.height)-origin.minY)*S;
 const contentW=pw*2+LEDGER+GAP*2,hdr=header(`${d.after.projectTitle} · Architecture delta`,d.after.title,`Two states of one view, compared by stable ID. ${d.ledger.length} change(s); a delta does not say in which order or why things changed.`,M,M,contentW,t,theme==='editorial');
 const top=M+hdr.height+56,lx=M+pw+GAP,out:string[]=[];
 const stamp=(s:ViewSpec,label:string)=>`${label} · revision ${s.projectRevision}${s.snapshot?` · ${vectorOf(s,2)}`:''}`;
 out.push(txt(stamp(d.before,'BEFORE').toUpperCase(),M,top-20,{size:9,fill:t.soft,font:MONO,tracking:0.12}),txt(stamp(d.after,'AFTER').toUpperCase(),lx+LEDGER+GAP,top-20,{size:9,fill:t.soft,font:MONO,tracking:0.12}));
 out.push(`<rect x="${f(M-12)}" y="${f(top-8)}" width="${f(pw+24)}" height="${f(ph+16)}" rx="8" fill="${t.wash}" stroke="${t.rule}"/>`,`<rect x="${f(lx+LEDGER+GAP-12)}" y="${f(top-8)}" width="${f(pw+24)}" height="${f(ph+16)}" rx="8" fill="${t.wash}" stroke="${t.rule}"/>`);
 out.push(panel(bd,d.before,'before',d,t,slug,origin,M,top),panel(ad,d.after,'after',d,t,slug,origin,lx+LEDGER+GAP,top));
 // Ledger: one entry per (object, change), the change word first.
 const ledger=[txt('CHANGES',lx,top+4,{size:9,fill:t.accent,font:MONO,tracking:0.14})];let ly=top+24;const max=12;
 for(const entry of d.ledger.slice(0,max)){const [word,...rest]=entry.split(' · '),ls=sansLines(rest.join(' · '),LEDGER-8,11,3);
  ledger.push(txt(word,lx,ly,{size:8,fill:t.soft,font:MONO,tracking:0.12}),lines(ls,lx,ly+14,14,{size:11,fill:t.ink}));ly+=14+ls.length*14+10;}
 if(d.ledger.length>max)ledger.push(txt(`+${d.ledger.length-max} more change(s)`,lx,ly,{size:10,fill:t.muted,italic:true}));
 if(!d.ledger.length)ledger.push(lines(sansLines('No change: same components, connections and positions.',LEDGER-8,11,3),lx,ly,14,{size:11,fill:t.muted}));
 out.push(...ledger);
 const bottom=Math.max(top+ph+8,ly)+28;
 const items:LegendItem[]=[{kind:'box',treatment:'backend',label:'+ added'},{kind:'box',treatment:'optional',label:'− removed'},{kind:'box',treatment:'backend',label:'Δ changed'},{kind:'box',treatment:'backend',label:'↗ moved'},
  {kind:'line',stroke:'muted',dashed:true,label:'Removed link'},{kind:'line',stroke:'muted',label:'Unchanged (quiet)'}];
 const legend=legendStrip(items,M,bottom,contentW,t),y=bottom+legend.height+12;
 return svgDocument({slug,width:contentW+2*M,height:y+12+M-12,title:`${d.after.title} · architecture delta`,desc:`Architecture delta of view ${viewId}: ${d.ledger.length} change(s) between revision ${d.before.projectRevision} and revision ${d.after.projectRevision}.`,
  t,theme,type:'delta',viewId,defs:markers(slug,t),body:hdr.svg+out.join('')+legend.svg+footerLine([d.after.projectId,`view ${viewId}`,`revision ${d.before.projectRevision} → ${d.after.projectRevision}`,now.toISOString().slice(0,10),'public content only'],M,y+12,contentW,t)})
  .replace('<svg ','<svg data-diagram="architecture-delta" ');
}
