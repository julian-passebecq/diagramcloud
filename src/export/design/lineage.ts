import type {Project} from '../../core/model';
import type {SpecEdge,SpecNode} from '../../core/viewspec';
import {placeLabel,summaryCards} from './architecture';
import {designContext,eyebrowOf,footerParts,type DesignOptions} from './context';
import {flowRanks} from './flow';
import {hubCentre} from './hub';
import {elbowPath,f,footerLine,header,KIND_TAG,labelText,legendStrip,markers,MONO,nodeBox,svgDocument,treatmentOf,txt,type Box,type LegendItem,type P} from './kit';
import {xml} from '../diagram';

const M=48,BW=168,BH=64,G=112,GV=32,LANE=8,CLANE=6;
export type LineageRole='subject'|'upstream'|'downstream'|'both'|'unrelated';
/** Transitive lineage of a subject: every component it is reached from (upstream) and every component it reaches (downstream). */
export function lineageRoles(subject:string,nodes:SpecNode[],edges:SpecEdge[]):Map<string,LineageRole>{
 const ids=new Set(nodes.map(n=>n.id)),inner=edges.filter(e=>e.from!==e.to&&ids.has(e.from)&&ids.has(e.to));
 const reach=(fwd:boolean)=>{const seen=new Set<string>(),todo=[subject];while(todo.length){const at=todo.pop()!;for(const e of inner){const [a,b]=fwd?[e.from,e.to]:[e.to,e.from];if(a===at&&b!==subject&&!seen.has(b)){seen.add(b);todo.push(b);}}}return seen;};
 const up=reach(false),down=reach(true);
 return new Map(nodes.map(n=>[n.id,n.id===subject?'subject':up.has(n.id)&&down.has(n.id)?'both':up.has(n.id)?'upstream':down.has(n.id)?'downstream':'unrelated']));
}
/** A connection is on the lineage when it lies on a path into the subject (upstream) or out of it (downstream). */
function edgeRole(e:SpecEdge,roles:Map<string,LineageRole>):'upstream'|'downstream'|'other'{
 const r=(id:string)=>roles.get(id),isUp=(x?:LineageRole)=>x==='upstream'||x==='both',isDown=(x?:LineageRole)=>x==='downstream'||x==='both';
 if(isUp(r(e.from))&&(isUp(r(e.to))||r(e.to)==='subject'))return 'upstream';
 if((isDown(r(e.from))||r(e.from)==='subject')&&isDown(r(e.to)))return 'downstream';
 return 'other';
}

/**
 * Lineage: the view's components left to right in reading order (one column per flowRanks rank), one subject (first
 * focal, else the most connected), everything transitively upstream and downstream of it drawn normally, and every
 * unrelated component muted and counted. Connections run as rounded right-angle connectors through the gaps between
 * columns and the corridors between rows; a connection that goes back in the reading order closes a cycle and says so.
 */
export function lineageSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'lineage',options),{spec,t}=c,ids=new Set(spec.nodes.map(n=>n.id)),all=spec.edges.filter(e=>ids.has(e.from)&&ids.has(e.to));
 const edges=all.filter(e=>e.from!==e.to),selfLoops=all.length-edges.length,byId=new Map(spec.nodes.map(n=>[n.id,n])),ranks=flowRanks(spec.nodes,edges);
 const subject=hubCentre(spec.nodes,edges,c.focal),roles=subject?lineageRoles(subject.id,spec.nodes,edges):new Map<string,LineageRole>();
 const cols=Math.max(1,...spec.nodes.map(n=>(ranks.get(n.id)??0)+1)),column:SpecNode[][]=Array.from({length:cols},()=>[]);
 for(const n of [...spec.nodes].sort((a,b)=>a.position.y-b.position.y||a.position.x-b.position.x||a.id.localeCompare(b.id)))column[ranks.get(n.id)??0].push(n);
 const rows=Math.max(1,...column.map(x=>x.length)),back=edges.filter(e=>(ranks.get(e.to)??0)<=(ranks.get(e.from)??0));
 const leftGap=back.some(e=>(ranks.get(e.to)??0)===0),rightGap=back.some(e=>(ranks.get(e.from)??0)===cols-1);
 const gridW=cols*BW+(cols-1)*G+(leftGap?G/2:0)+(rightGap?G/2:0),contentW=Math.max(640,gridW),hdr=header(eyebrowOf(c,'Lineage'),spec.title,c.purpose,M,M,contentW,t,c.editorial);
 const top=M+hdr.height+60,ox=M+(contentW-gridW)/2+(leftGap?G/2:0),colX=(i:number)=>ox+i*(BW+G),rowY=(k:number)=>top+k*(BH+GV);
 const box=new Map<string,Box&{id:string}>();column.forEach((ns,i)=>ns.forEach((n,k)=>box.set(n.id,{id:n.id,x:colX(i),y:rowY(k),w:BW,h:BH})));const boxes=[...box.values()];
 const gapX=(g:number)=>g<0?colX(0)-G/2:colX(g)+BW+G/2,corridor=(k:number)=>rowY(k)-GV/2,mid=(b:Box)=>b.y+b.h/2;
 // Plan: adjacent forward connections use one gap; the others also use a corridor between rows, picked nearest the two ends.
 type Plan={e:SpecEdge;a:Box&{id:string};b:Box&{id:string};g1:number;g2?:number;k?:number};
 const plans:Plan[]=edges.map(e=>{const a=box.get(e.from)!,b=box.get(e.to)!,ca=ranks.get(e.from)??0,cb=ranks.get(e.to)??0;if(cb===ca+1)return {e,a,b,g1:ca};
  const want=(mid(a)+mid(b))/2;let k=0;for(let i=1;i<=rows;i++)if(Math.abs(corridor(i)-want)<Math.abs(corridor(k)-want))k=i;return {e,a,b,g1:ca,g2:cb-1,k};});
 const turnY=(p:Plan)=>p.k===undefined?mid(p.b):corridor(p.k),backY=(p:Plan)=>p.k===undefined?mid(p.a):corridor(p.k);
 // Attach points: each side spreads its connectors at h·(i+1)/(n+1), ordered by where they turn.
 const sy=new Map<string,number>(),ty=new Map<string,number>();
 for(const b of boxes){const outs=plans.filter(p=>p.a.id===b.id).sort((p,q)=>turnY(p)-turnY(q)||p.e.id.localeCompare(q.e.id)),ins=plans.filter(p=>p.b.id===b.id).sort((p,q)=>backY(p)-backY(q)||p.e.id.localeCompare(q.e.id));
  outs.forEach((p,i)=>sy.set(p.e.id,Math.round((b.y+b.h*(i+1)/(outs.length+1))/4)*4));ins.forEach((p,i)=>ty.set(p.e.id,Math.round((b.y+b.h*(i+1)/(ins.length+1))/4)*4));}
 // Lanes: every vertical run in a gap and every horizontal run in a corridor gets its own track.
 const gapUse=new Map<number,{id:string;s:number;e:number;key:string}[]>(),corUse=new Map<number,{id:string;lo:number}[]>();
 const useGap=(g:number,id:string,key:string,y1:number,y2:number)=>gapUse.set(g,[...(gapUse.get(g)??[]),{id,s:y1,e:y2,key}]);
 for(const p of plans){const s=sy.get(p.e.id)!,d=ty.get(p.e.id)!;
  if(p.k===undefined){if(s!==d)useGap(p.g1,p.e.id,'1',s,d);}
  else{const cy=corridor(p.k);useGap(p.g1,p.e.id,'1',s,cy);useGap(p.g2!,p.e.id,'2',cy,d);corUse.set(p.k,[...(corUse.get(p.k)??[]),{id:p.e.id,lo:Math.min(gapX(p.g1),gapX(p.g2!))}]);}}
 const laneX=new Map<string,number>(),laneY=new Map<string,number>();
 for(const [g,us] of gapUse){// Nested tracks, counted from the target side: rising runs (lowest start first), then falling runs (highest start first), so parallel runs do not cross.
  const rise=(u:{s:number;e:number})=>u.e<u.s?0:1;us.sort((a,b)=>rise(a)-rise(b)||(rise(a)?a.s-b.s:b.s-a.s)||a.id.localeCompare(b.id)||a.key.localeCompare(b.key));const step=us.length>1?Math.min(LANE,(G-32)/(us.length-1)):0;
  us.forEach((u,i)=>laneX.set(`${u.id}:${u.key}`,Math.round((gapX(g)+((us.length-1)/2-i)*step)*2)/2));}
 for(const [k,us] of corUse){us.sort((a,b)=>a.lo-b.lo||a.id.localeCompare(b.id));const step=us.length>1?Math.min(CLANE,(GV-12)/(us.length-1)):0;
  us.forEach((u,i)=>laneY.set(u.id,Math.round((corridor(k)+(i-(us.length-1)/2)*step)*2)/2));}
 const routes=new Map<string,P[]>();
 for(const p of plans){const s=sy.get(p.e.id)!,d=ty.get(p.e.id)!,x0=p.a.x+p.a.w,x9=p.b.x;
  if(p.k===undefined){const x=laneX.get(`${p.e.id}:1`);routes.set(p.e.id,x===undefined?[{x:x0,y:s},{x:x9,y:d}]:[{x:x0,y:s},{x,y:s},{x,y:d},{x:x9,y:d}]);}
  else{const x1=laneX.get(`${p.e.id}:1`)!,x2=laneX.get(`${p.e.id}:2`)!,cy=laneY.get(p.e.id)!;routes.set(p.e.id,[{x:x0,y:s},{x:x1,y:s},{x:x1,y:cy},{x:x2,y:cy},{x:x2,y:d},{x:x9,y:d}]);}}
 // Connectors first, then boxes, then labels on masks. Muted elements sit at reduced opacity with a dashed outline.
 const out:string[]=[],used=new Set<string>(),count=(r:LineageRole)=>[...roles.values()].filter(x=>x===r).length;
 if(rows&&spec.nodes.length){const heads=column.map((ns,i)=>ns.length?txt(`STEP ${i+1}`,colX(i),top-36,{size:8,fill:t.soft,font:MONO,tracking:0.14}):'');out.push(...heads);}
 for(const p of plans){const e=p.e,role=subject?edgeRole(e,roles):'other',muted=role==='other',link=e.kind==='query',dashed=muted||e.kind==='control'||e.kind==='dependency'||e.basis==='unknown';
  used.add(muted?'other':link?'link':'muted');if(!muted&&dashed)used.add('dashed');
  out.push(`<path data-edge-id="${xml(e.id)}" data-dd-lineage="${role}"${back.includes(e)?' data-dd-cycle="true"':''} d="${elbowPath(routes.get(e.id)!)}" fill="none" stroke="${link&&!muted?t.link:t.muted}" stroke-width="1.2"${muted?' stroke-opacity="0.4"':''}${dashed?' stroke-dasharray="5,4"':''} marker-end="url(#${c.slug}-${link&&!muted?'link':'arrow'})"><title>${xml(`${byId.get(e.from)?.label??e.from} → ${byId.get(e.to)?.label??e.to}${e.label?`: ${e.label}`:''} (${e.kind}${muted?', not on the lineage':''})`)}</title></path>`);}
 const tint=(r:LineageRole)=>r==='upstream'?t.series[0]:r==='downstream'?t.series[1]:r==='both'?t.series[2]:'';
 for(const b of boxes){const s=byId.get(b.id)!,role=roles.get(b.id)??'unrelated',muted=role==='unrelated',tr=muted?'optional':treatmentOf(s.kind,s.basis??'unspecified',role==='subject');
  if(!muted&&tr==='optional')used.add('optional');
  const bar=tint(role)?`<rect x="${f(b.x+1.5)}" y="${f(b.y+8)}" width="3" height="${f(b.h-16)}" rx="1.5" fill="${tint(role)}"/>`:'';
  out.push(`<g data-dd-lineage="${role}"${muted?' opacity="0.45"':''}>`+nodeBox({...b,name:s.label,sub:s.provider&&s.provider!=='Generic'?s.provider:s.summary,tag:KIND_TAG[s.kind],treatment:tr,opens:!!s.opens,
   title:`${s.label} · ${s.kind} · ${role==='both'?'upstream and downstream (cycle)':role}${s.opens?' · opens a detail view':''}`},t)+bar+'</g>');}
 const placed:Box[]=[];
 for(const p of plans){if(!subject||edgeRole(p.e,roles)==='other'||!p.e.label)continue;const chip=placeLabel(labelText(p.e.label.replace(/\s*\((inferred|possible)\)$/,'')),routes.get(p.e.id)!,boxes,placed,t);if(chip){placed.push(chip.box);out.push(chip.svg);}}
 // A chip on a cycle run in the right-hand gap may reach past the content: the canvas grows to hold it.
 const right=Math.max(M+contentW,...placed.map(b=>Math.ceil(b.x+b.w)));
 const areaBottom=spec.nodes.length?rowY(rows-1)+BH+GV/2:top,unrelated=count('unrelated'),both=count('both');
 const notes=[...(!spec.nodes.length?['This view has no public components.']:!edges.some(e=>e.from===subject?.id||e.to===subject?.id)?[`${subject?.label} has no connections in this view: it has no lineage here.`]:[]),
  ...(unrelated>0?[`${unrelated} unrelated component(s) muted (neither upstream nor downstream of ${subject?.label}).`]:[]),
  ...(back.length?[`${back.length} connection(s) go back in the reading order (a cycle); the order breaks it at the earliest component on the canvas.`]:[]),
  ...(both>0?[`${both} component(s) are both upstream and downstream of ${subject?.label} (in a cycle with it).`]:[]),
  ...(selfLoops>0?[`${selfLoops} self-connection(s) not drawn.`]:[]),'Columns follow the reading order derived from the connections, not a measured time order.'];
 notes.forEach((n,i)=>out.push(txt(n,M,areaBottom+28+i*15,{size:10,fill:t.muted,italic:true})));
 const items:LegendItem[]=subject?[...(count('upstream')?[{kind:'swatch' as const,fill:t.series[0],label:'Upstream'}]:[]),{kind:'box',treatment:'focal',label:c.focalReason==='hint'?'Subject · focal':c.focalReason==='auto'?'Subject · most connected':'Subject · most connected (ties by id)'},
  ...(count('downstream')?[{kind:'swatch' as const,fill:t.series[1],label:'Downstream'}]:[]),...(both?[{kind:'swatch' as const,fill:t.series[2],label:'Up- and downstream'}]:[]),
  ...(unrelated?[{kind:'box' as const,treatment:'optional' as const,label:'Unrelated (muted)'}]:[]),...(used.has('optional')?[{kind:'box' as const,treatment:'optional' as const,label:'Declared, not read'}]:[]),
  ...(used.has('muted')?[{kind:'line' as const,stroke:'muted' as const,label:'Flow'}]:[]),...(used.has('link')?[{kind:'line' as const,stroke:'link' as const,label:'Request / API'}]:[]),
  ...(used.has('dashed')?[{kind:'line' as const,stroke:'muted' as const,dashed:true,label:'Control / dependency'}]:[]),...(used.has('other')?[{kind:'line' as const,stroke:'muted' as const,dashed:true,label:'Not on the lineage'}]:[])]:[];
 const ly=areaBottom+28+notes.length*15+12,legend=legendStrip(items,M,ly,contentW,t);
 let y=ly+legend.height+12;const cards=c.editorial?summaryCards(c,M,y+8,contentW):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:right+M,height:y+12+M-12,title:`${spec.title} · lineage`,
  desc:subject?`Lineage of ${subject.label} in the public view ${spec.viewId}: ${count('upstream')+both} upstream and ${count('downstream')+both} downstream component(s); ${unrelated} unrelated component(s) muted.`:`Lineage of the public view ${spec.viewId}: no public components.`,
  t,theme:c.theme,type:'lineage',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+out.join('')+legend.svg+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,contentW,t)});
}
