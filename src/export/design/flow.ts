import type {Project} from '../../core/model';
import type {SpecEdge,SpecNode} from '../../core/viewspec';
import {architectureSvg,summaryCards,type ArchitectureLayout} from './architecture';
import {designContext,eyebrowOf,footerParts,type DesignContext,type DesignOptions} from './context';
import {layersOf} from './layers';
import {clipMono,f,footerLine,header,KIND_TAG,labelText,legendStrip,markers,monoWidth,MONO,nodeBox,svgDocument,treatmentOf,txt,type LegendItem,type Treatment} from './kit';
import {xml} from '../diagram';

/**
 * Reading order of a view: a rank per component (longest path from the components nothing points to), cycles broken
 * at the earliest component in canvas order. Deterministic, and only a reading aid: it is not a measured time order.
 */
export function flowRanks(nodes:SpecNode[],edges:SpecEdge[]):Map<string,number>{
 const order=[...nodes].sort((a,b)=>a.position.x-b.position.x||a.position.y-b.position.y||a.id.localeCompare(b.id)),ids=new Set(order.map(n=>n.id));
 const inner=edges.filter(e=>ids.has(e.from)&&ids.has(e.to)&&e.from!==e.to),indeg=new Map(order.map(n=>[n.id,0])),rank=new Map<string,number>(),done=new Set<string>();
 for(const e of inner)indeg.set(e.to,indeg.get(e.to)!+1);
 while(done.size<order.length){
  let next=order.find(n=>!done.has(n.id)&&indeg.get(n.id)===0);
  if(!next)next=order.filter(n=>!done.has(n.id)).sort((a,b)=>indeg.get(a.id)!-indeg.get(b.id)!)[0];// cycle: break it
  done.add(next.id);rank.set(next.id,Math.max(0,...inner.filter(e=>e.to===next!.id&&done.has(e.from)&&e.from!==next!.id).map(e=>(rank.get(e.from)??0)+1)));
  for(const e of inner)if(e.from===next.id&&!done.has(e.to))indeg.set(e.to,indeg.get(e.to)!-1);
 }
 return rank;
}

/** Swimlane: one lane per repository (two or more), else per layer; columns follow the reading order. */
export function swimlaneLayout(c:DesignContext):ArchitectureLayout{
 const {spec}=c,ranks=flowRanks(spec.nodes,spec.edges);
 const lanes=spec.groups.length>=2
  ?[...spec.groups.map(g=>({id:g.id,title:g.title,members:g.members})),...(spec.nodes.some(n=>!n.group)?[{id:'other',title:'Not in a repository',members:spec.nodes.filter(n=>!n.group).map(n=>n.id)}]:[])]
  :layersOf(spec.nodes).map(l=>({id:l.id,title:l.name,members:l.nodes.map(n=>n.id)}));
 const positions:Record<string,{x:number;y:number}>={};let laneY=0;
 for(const lane of lanes){const used=new Map<number,number>();let rows=1;
  for(const id of lane.members){const r=ranks.get(id)??0,k=used.get(r)??0;used.set(r,k+1);rows=Math.max(rows,k+1);positions[id]={x:r*290,y:laneY+k*140};}
  laneY+=rows*140+90;}
 return {type:'swimlane',label:'Swimlane',positions,lanes,desc:`Swimlane by ${spec.groups.length>=2?'repository':'layer'}`};
}
export const swimlaneSvg=(input:Project,viewId:string,options:DesignOptions={})=>architectureSvg(input,viewId,options,swimlaneLayout);

/** Messages of a view in reading order: breadth-first from the components nothing points to, each connection once. */
export function flowMessages(nodes:SpecNode[],edges:SpecEdge[]):SpecEdge[]{
 const ranks=flowRanks(nodes,edges),ids=new Set(nodes.map(n=>n.id));
 return edges.filter(e=>ids.has(e.from)&&ids.has(e.to)).sort((a,b)=>(ranks.get(a.from)??0)-(ranks.get(b.from)??0)||(ranks.get(a.to)??0)-(ranks.get(b.to)??0)||a.id.localeCompare(b.id));
}

const M=48,MAX_MESSAGES=18,STEP=44,PW=144,PH=64,COL=184;
/**
 * Sequence: participants are the view's components in reading order, each with a dashed lifeline; every connection of
 * the view is one numbered message, top to bottom in reading order. Self-explanatory about what it is not: the order
 * is derived from the connections, not from timing.
 */
export function sequenceSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'sequence',options),{spec,t}=c,ranks=flowRanks(spec.nodes,spec.edges);
 const parts=[...spec.nodes].sort((a,b)=>(ranks.get(a.id)??0)-(ranks.get(b.id)??0)||a.position.y-b.position.y||a.position.x-b.position.x).slice(0,10);
 const col=new Map(parts.map((p,i)=>[p.id,i])),all=flowMessages(parts,spec.edges),msgs=all.slice(0,MAX_MESSAGES),dropped=spec.edges.length-msgs.length;
 const contentW=Math.max(640,parts.length*COL-(COL-PW)),hdr=header(eyebrowOf(c,'Sequence'),spec.title,c.purpose,M,M,contentW,t,c.editorial);
 const top=M+hdr.height+28,ox=M+(contentW-(parts.length*COL-(COL-PW)))/2,cx=(i:number)=>ox+i*COL+PW/2,y0=top+PH+28,bottom=y0+Math.max(1,msgs.length)*STEP+8;
 const out:string[]=[],treatments=new Set<Treatment>();
 parts.forEach((p,i)=>out.push(`<line x1="${f(cx(i))}" y1="${top+PH}" x2="${f(cx(i))}" y2="${bottom}" stroke="${t.ruleSolid}" stroke-width="1" stroke-dasharray="4,4"/>`));
 msgs.forEach((m,k)=>{const a=col.get(m.from)!,b=col.get(m.to)!,y=y0+k*STEP+STEP/2,accent=c.focal.size>1&&c.focal.has(m.from)&&c.focal.has(m.to),link=!accent&&m.kind==='query';
  const stroke=accent?t.accent:link?t.link:t.muted,marker=`url(#${c.slug}-${accent?'accent':link?'link':'arrow'})`,dash=m.kind==='control'||m.kind==='dependency'?' stroke-dasharray="5,4"':'';
  const label=`${k+1} · ${m.label?labelText(m.label.replace(/\s*\((inferred|possible)\)$/,'')):m.kind.toUpperCase()}`;
  if(a===b){const x=cx(a);out.push(`<path data-edge-id="${xml(m.id)}" d="M ${f(x)} ${f(y-10)} H ${f(x+32)} Q ${f(x+40)} ${f(y-10)} ${f(x+40)} ${f(y-2)} V ${f(y+2)} Q ${f(x+40)} ${f(y+10)} ${f(x+32)} ${f(y+10)} H ${f(x+4)}" fill="none" stroke="${stroke}" stroke-width="1.2"${dash} marker-end="${marker}"/>`,
   `<rect x="${f(x+46)}" y="${f(y-6)}" width="${f(monoWidth(label,8,0.06)+8)}" height="12" rx="2" fill="${t.paper}"/>`,txt(label,x+50,y+3,{size:8,fill:t.soft,font:MONO,tracking:0.06}));return;}
  const x1=cx(a)+(b>a?4:-4),x2=cx(b)+(b>a?-4:4),mid=(x1+x2)/2,w=monoWidth(label,8,0.06)+8;
  out.push(`<line data-edge-id="${xml(m.id)}" x1="${f(x1)}" y1="${f(y)}" x2="${f(x2)}" y2="${f(y)}" stroke="${stroke}" stroke-width="1.2"${dash} marker-end="${marker}"><title>${xml(`${m.from} → ${m.to}${m.label?`: ${m.label}`:''}`)}</title></line>`,
   `<rect x="${f(mid-w/2)}" y="${f(y-21)}" width="${f(w)}" height="12" rx="2" fill="${t.paper}"/>`,txt(label,mid,y-12,{size:8,fill:t.soft,font:MONO,anchor:'middle',tracking:0.06}));});
 parts.forEach((p,i)=>{const tr=treatmentOf(p.kind,p.basis??'unspecified',c.focal.has(p.id));treatments.add(tr);
  out.push(nodeBox({id:p.id,x:ox+i*COL,y:top,w:PW,h:PH,name:p.label,tag:KIND_TAG[p.kind],treatment:tr,opens:!!p.opens,title:`${p.label} · ${p.kind}`},t));});
 const notes=[`Order derived from the connections (reading order), not from timing.`,...(dropped>0?[`${dropped} connection(s) not drawn (limit ${MAX_MESSAGES} messages or ${spec.nodes.length>10?'more than 10 participants':'outside the participants'}).`]:[])];
 notes.forEach((n,i)=>out.push(txt(n,M,bottom+22+i*15,{size:10,fill:t.muted,italic:true})));
 const items:LegendItem[]=[...(['focal','backend','store','external','input','optional'] as Treatment[]).filter(x=>treatments.has(x)).map(x=>({kind:'box' as const,treatment:x,label:x==='focal'?'Focal':x==='backend'?'Participant':x})),
  {kind:'line',stroke:'muted',label:'Message'},...(msgs.some(m=>m.kind==='query')?[{kind:'line' as const,stroke:'link' as const,label:'Request / API'}]:[])];
 const ly=bottom+22+notes.length*15+16,legend=legendStrip(items,M,ly,contentW,t);
 let y=ly+legend.height+12;const cards=c.editorial?summaryCards(c,M,y+8,contentW):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:contentW+2*M,height:y+12+M-12,title:`${spec.title} · sequence`,desc:`Sequence of ${msgs.length} message(s) between ${parts.length} participant(s) of the public view ${spec.viewId}, in reading order.`,
  t,theme:c.theme,type:'sequence',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+out.join('')+legend.svg+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,contentW,t)});
}

/**
 * Story timeline: the project's guided story as a horizontal axis of numbered steps (title, view, component). Steps on
 * private views are not drawn and are counted. Without a story, the figure says so instead of inventing one.
 */
export function timelineSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const c=designContext(input,viewId,'timeline',options),{doc,spec,t}=c,steps=doc.story.filter(s=>doc.views.some(v=>v.id===s.viewId)).slice(0,12),hidden=input.story.length-steps.length;
 const SLOT=200,contentW=Math.max(640,steps.length*SLOT),hdr=header(eyebrowOf(c,'Story timeline'),doc.title,steps.length?`The guided story, step by step. Highlighted: steps on ${spec.title}.`:'This project has no public story yet: add steps in the story composer.',M,M,contentW,t,c.editorial);
 const axisY=M+hdr.height+112,ox=M+(contentW-steps.length*SLOT)/2,out:string[]=[];
 if(steps.length){out.push(`<line x1="${f(ox)}" y1="${axisY}" x2="${f(ox+steps.length*SLOT)}" y2="${axisY}" stroke="${t.ruleSolid}" stroke-width="1.2" marker-end="url(#${c.slug}-arrow)"/>`);
  steps.forEach((s,i)=>{const x=ox+i*SLOT+SLOT/2,here=s.viewId===spec.viewId,up=i%2===1,vt=doc.views.find(v=>v.id===s.viewId)?.title??s.viewId,node=s.nodeId?doc.nodes.find(n=>n.id===s.nodeId)?.label:undefined;
   const titleLines=clipMono(s.title,SLOT-24,11*0.9),ty=up?axisY-84:axisY+34;
   out.push(`<g data-step="${i+1}"${here?' data-focal="true"':''}><line x1="${f(x)}" y1="${axisY}" x2="${f(x)}" y2="${f(up?axisY-48:axisY+14)}" stroke="${here?t.accent:t.ruleSolid}" stroke-width="1"/>`,
    `<circle cx="${f(x)}" cy="${axisY}" r="${here?7:5}" fill="${here?t.accent:t.paper}" stroke="${here?t.accent:t.muted}" stroke-width="1.2"/>`,
    txt(String(i+1).padStart(2,'0'),x,up?ty-14:ty-12,{size:8,fill:here?t.accent:t.soft,font:MONO,anchor:'middle',tracking:0.14}),
    txt(titleLines,x,ty+2,{size:11,fill:t.ink,weight:600,anchor:'middle'}),txt(clipMono(vt,SLOT-24,9),x,ty+17,{size:9,fill:t.muted,font:MONO,anchor:'middle'}),
    node?txt(clipMono(node,SLOT-24,8),x,ty+30,{size:8,fill:t.soft,font:MONO,anchor:'middle'}):'','</g>');});}
 const bottom=axisY+88+(hidden>0?16:0);
 if(hidden>0)out.push(txt(`${hidden} step(s) on private views not drawn.`,M,axisY+92,{size:10,fill:t.muted,italic:true}));
 const legend=legendStrip(steps.length?[{kind:'box',treatment:'focal',label:'Step on this view'},{kind:'box',treatment:'backend',label:'Step'}]:[],M,bottom+24,contentW,t);
 let y=bottom+24+legend.height+12;const cards=c.editorial?summaryCards(c,M,y+8,contentW):undefined;if(cards)y+=cards.height+24;
 return svgDocument({slug:c.slug,width:contentW+2*M,height:y+12+M-12,title:`${doc.title} · story timeline`,desc:`Story timeline of ${steps.length} public step(s)${hidden>0?`; ${hidden} on private views not drawn`:''}.`,
  t,theme:c.theme,type:'timeline',viewId:spec.viewId,defs:markers(c.slug,t),body:hdr.svg+out.join('')+legend.svg+(cards?.svg??'')+footerLine(footerParts(c),M,y+12,contentW,t)});
}
