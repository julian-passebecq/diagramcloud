import {publicDocument} from '../core/operations';
import type {Project,ProjectEdge,ProjectNode} from '../core/model';
import {viewSpec,PERSPECTIVE_LABEL,type ViewSpec} from '../core/viewspec';
import {buildScene,svgPolylinePath} from './scene';
import {measureLines} from './measure';
import {xml} from './diagram';

/**
 * Rendering styles for one view. The meaning comes from the renderer-neutral ViewSpec (nodes, typed edges, basis,
 * confidence, path, revision vector, omissions); the geometry from the shared export scene (positions and the
 * box-avoiding orthogonal routes). Standard is the existing SVG export; this module adds:
 *  - blueprint: an original "DataPass Blueprint" engineering-drawing grammar (grid, zone references, high-contrast
 *    linework, typed line patterns, legend and a title block carrying project, view, revision vector, date and
 *    provenance). No third-party branding, artwork or fonts.
 *  - editorial: a quiet publication style (paper, thin ink, numbered callouts with a caption list), informed by the
 *    diagram-design project's visual grammar only (no code or assets reused).
 * Both are static SVG with system fonts: no network, no script, every component keeps data-node-id.
 */
export type SvgStyle='blueprint'|'editorial';
const FONT="Arial, Helvetica, 'Liberation Sans', sans-serif";
const EDGE_PATTERN:Record<ProjectEdge['kind'],string>={batch:'',stream:'10 4 2 4',query:'14 6',control:'2 5',dependency:'6 5'};
const EDGE_LABEL:Record<ProjectEdge['kind'],string>={batch:'Batch / data flow',stream:'Stream',query:'Query / request',control:'Control',dependency:'Dependency'};
const KIND_LABEL:Record<ProjectNode['kind'],string>={source:'Source',process:'Process',storage:'Storage',model:'Model',report:'Report',app:'Application',control:'Control',physics:'Physics',function:'Function',table:'Table'};
const BASIS_LABEL:Record<string,string>={planned:'planned (declared)','static-source':'read from source',unknown:'unknown',unspecified:'without a stated basis'};
const r=(n:number)=>Math.round(n*10)/10;

type Box={x:number;y:number;w:number;h:number};
function lines(text:string,width:number,size:number,max:number,bold=false){return measureLines(text,width,{size,bold},max).lines;}
function tspans(ls:string[],x:number,y:number,lh:number){return ls.map((l,i)=>`<tspan x="${r(x)}"${i?` dy="${lh}"`:''}>${xml(l)}</tspan>`).join('');}
const text=(ls:string[],x:number,y:number,size:number,fill:string,opts:{bold?:boolean;lh?:number;anchor?:'middle'|'end';extra?:string}={})=>ls.length?`<text x="${r(x)}" y="${r(y)}" font-size="${size}" fill="${fill}"${opts.bold?' font-weight="700"':''}${opts.anchor?` text-anchor="${opts.anchor}"`:''}${opts.extra??''}>${tspans(ls,x,y,opts.lh??size*1.25)}</text>`:'';

function prepare(input:Project,viewId:string,now:Date){
 const d=publicDocument(input),id=d.views.some(v=>v.id===viewId)?viewId:d.rootViewId,view=d.views.find(v=>v.id===id)!;
 const spec=viewSpec(input,id,{now}),scene=buildScene(d,view);
 return {spec,scene,byId:new Map(spec.nodes.map(n=>[n.id,n])),edgeById:new Map(spec.edges.map(e=>[e.id,e]))};
}
/** Revision vector lines for a title block: each repository at its own revision, never one project SHA. */
function vector(spec:ViewSpec,max:number){
 if(!spec.snapshot)return [`Project revision ${spec.projectRevision} (no repository snapshot)`];
 const reps=spec.snapshot.repositories,out=reps.slice(0,max).map(x=>`${x.id} @ ${x.revision?x.revision.slice(0,12):'unknown'}${x.scanStatus==='scanned'?'':` (${x.scanStatus})`}`);
 if(reps.length>max)out.push(`+ ${reps.length-max} more repositories`);return out;
}
function provenance(spec:ViewSpec){
 const count=(b:string)=>spec.nodes.filter(n=>n.basis===b).length;
 const parts=(['planned','static-source','unknown','unspecified'] as const).map(b=>[b,count(b)] as const).filter(([,n])=>n).map(([b,n])=>`${n} ${BASIS_LABEL[b]}`);
 const observed=spec.nodes.filter(n=>n.observation).length;
 return `Components: ${parts.join(' · ')||'none'}${observed?` · ${observed} presented observation(s)`:''}`;
}

// ---------------------------------------------------------------------------------------------------- blueprint
const BP={paper:'#0b2545',grid:'#16365c',major:'#21497a',ink:'#eaf2ff',line:'#9ec5ff',muted:'#8fb0d8',accent:'#ffd166',fill:'#0f2f55'};
function blueprintNode(kind:ProjectNode['kind'],b:Box){
 const {x,y,w,h}=b;
 if(kind==='storage'||kind==='table')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${BP.fill}" stroke="${BP.ink}" stroke-width="1.5"/><line x1="${x}" y1="${y+10}" x2="${x+w}" y2="${y+10}" stroke="${BP.ink}" stroke-width="1"/>`;
 if(kind==='control'){const c=Math.min(12,h/3,w/6);return `<polygon points="${x+c},${y} ${x+w-c},${y} ${x+w},${y+c} ${x+w},${y+h-c} ${x+w-c},${y+h} ${x+c},${y+h} ${x},${y+h-c} ${x},${y+c}" fill="${BP.fill}" stroke="${BP.ink}" stroke-width="1.5"/>`;}
 if(kind==='app'||kind==='report')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${BP.fill}" stroke="${BP.ink}" stroke-width="1.5"/><rect x="${x+4}" y="${y+4}" width="${w-8}" height="${h-8}" fill="none" stroke="${BP.line}" stroke-width=".6"/>`;
 return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${BP.fill}" stroke="${BP.ink}" stroke-width="1.5"/>`;
}
const zoneCol=(i:number)=>String.fromCharCode(65+(i%26));

export function blueprintSvg(input:Project,viewId=input.rootViewId,now=new Date()):string{
 const {spec,scene,byId,edgeById}=prepare(input,viewId,now),b=scene.bounds;
 const margin=60,zone=200,frame=18,legendW=330,blockW=470;
 const diagramW=Math.max(b.width,legendW+blockW+40),width=Math.ceil(diagramW+2*margin),top=margin+60,diagramH=b.height;
 const rowsIn:[string,string[]][]=[['PROJECT',[spec.projectTitle]],['PROJECT ID',[`${spec.projectId} · revision ${spec.projectRevision}`]],['VIEW ID',[spec.viewId]],['PERSPECTIVE',[PERSPECTIVE_LABEL[spec.perspective]]],
  ['REVISIONS',vector(spec,6)],['DATE',[`${spec.publication.generatedAt.slice(0,16).replace('T',' ')} UTC`]],['PROVENANCE',[provenance(spec)]],...(spec.omissions.length?[['NOTES',spec.omissions] as [string,string[]]]:[]),
  ['STATUS',['Explanatory drawing · planned/designed unless an observation is shown · not live telemetry']]];
 const blockRows=rowsIn.map(([k,vals])=>{const ls=vals.flatMap(v=>lines(v,blockW-130,10,3));return {k,ls,h:Math.max(20,8+14*ls.length)};});
 const blockH=blockRows.reduce((a,x)=>a+x.h,0),legendH=60+18*(spec.legend.edgeKinds.length+spec.legend.kinds.length)+(spec.legend.confidences.length?18:0);
 const footH=Math.max(blockH,legendH)+30,height=Math.ceil(top+diagramH+40+footH+margin);
 const ox=margin-b.x+(diagramW-b.width)/2,oy=top-b.y;
 // Grid, frame and zone references (A, B, C… across, 1, 2, 3… down) for locating components.
 const grid=[`<defs><pattern id="bp-minor" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="${BP.grid}" stroke-width=".6"/></pattern><pattern id="bp-major" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#bp-minor)"/><path d="M 100 0 L 0 0 0 100" fill="none" stroke="${BP.major}" stroke-width="1"/></pattern>`,
  `<marker id="bp-arrow" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M 1 1 L 11 6 L 1 11" fill="none" stroke="${BP.line}" stroke-width="1.6"/></marker></defs>`,
  `<rect width="100%" height="100%" fill="${BP.paper}"/><rect width="100%" height="100%" fill="url(#bp-major)"/>`,
  `<rect x="${frame}" y="${frame}" width="${width-2*frame}" height="${height-2*frame}" fill="none" stroke="${BP.ink}" stroke-width="2"/><rect x="${frame+6}" y="${frame+6}" width="${width-2*frame-12}" height="${height-2*frame-12}" fill="none" stroke="${BP.line}" stroke-width=".7"/>`];
 const cols=Math.ceil((width-2*frame)/zone),rows=Math.ceil((height-2*frame)/zone);
 for(let i=0;i<cols;i++){const x=frame+i*zone+zone/2;grid.push(text([zoneCol(i)],x,frame+15,10,BP.muted,{anchor:'middle'}),text([zoneCol(i)],x,height-frame-5,10,BP.muted,{anchor:'middle'}));if(i)grid.push(`<line x1="${frame+i*zone}" y1="${frame}" x2="${frame+i*zone}" y2="${frame+6}" stroke="${BP.ink}"/><line x1="${frame+i*zone}" y1="${height-frame-6}" x2="${frame+i*zone}" y2="${height-frame}" stroke="${BP.ink}"/>`);}
 for(let j=0;j<rows;j++){const y=frame+j*zone+zone/2+4;grid.push(text([String(j+1)],frame+3,y,10,BP.muted),text([String(j+1)],width-frame-9,y,10,BP.muted));}
 const zoneOf=(x:number,y:number)=>`${zoneCol(Math.floor((x-frame)/zone))}${Math.floor((y-frame)/zone)+1}`;
 // Title strip.
 const head=[text([spec.projectTitle.toUpperCase().slice(0,90)],margin,margin+4,11,BP.muted),text(lines(spec.title,diagramW,22,1,true),margin,margin+32,22,BP.ink,{bold:true}),
  text([`${PERSPECTIVE_LABEL[spec.perspective].toUpperCase()} PERSPECTIVE · ${spec.path.map(p=>p.title).join(' › ').slice(0,140)}`],margin,margin+50,10,BP.muted)];
 // Connections, then components, then labels on a paper halo.
 const edges=scene.edges.map(e=>{const s=edgeById.get(e.id);const kind=s?.kind??'batch';return `<path data-edge-id="${xml(e.id)}" d="${svgPolylinePath(e.points)}" fill="none" stroke="${BP.line}" stroke-width="1.5"${EDGE_PATTERN[kind]?` stroke-dasharray="${EDGE_PATTERN[kind]}"`:''} marker-end="url(#bp-arrow)"/>`;}).join('');
 const nodes=scene.nodes.map(n=>{const s=byId.get(n.id);if(!s)return '';const x=n.x+ox,y=n.y+oy,box={x,y,w:n.w,h:n.h};
  const label=lines(s.label.toUpperCase(),n.w-20,13,2,true),meta=`${KIND_LABEL[s.kind]}${s.provider&&s.provider!=='Generic'?` · ${s.provider}`:''}`;
  const tags=[s.confidence,s.basis!=='unspecified'?BASIS_LABEL[s.basis??'unspecified']:'',s.observation?`${s.observation.claim} (${s.observation.sourceApp})`:''].filter(Boolean).join(' · ');
  return `<g data-node-id="${xml(s.id)}">${blueprintNode(s.kind,box)}${text([zoneOf(x,y)],x+n.w-6,y+14,9,BP.accent,{anchor:'end'})}${text([meta.toUpperCase().slice(0,40)],x+10,y+24,9,BP.muted)}${text(label,x+10,y+44,13,BP.ink,{bold:true,lh:16})}`+
   `${text(lines(tags,n.w-20,9,1),x+10,y+n.h-22,9,BP.line)}${text(lines(`ID ${s.id}${s.opens?' · opens detail ›':''}`,n.w-20,8.5,1),x+10,y+n.h-9,8.5,BP.muted)}</g>`;}).join('');
 const labels=scene.edges.map(e=>e.label&&e.label.lines.length?`<text x="${r(e.label.x+ox)}" y="${r(e.label.y+oy)}" font-size="10" fill="${BP.ink}"${e.label.anchor==='middle'?' text-anchor="middle"':''} paint-order="stroke" stroke="${BP.paper}" stroke-width="4" stroke-linejoin="round">${tspans(e.label.lines,e.label.x+ox,e.label.y+oy,e.label.lineHeight)}</text>`:'').join('');
 // Legend (bottom left) and title block (bottom right).
 const fy=top+diagramH+40,lx=margin,bx=width-margin-blockW;
 const legend=[`<rect x="${lx}" y="${fy}" width="${legendW}" height="${legendH}" fill="${BP.paper}" stroke="${BP.ink}" stroke-width="1.2"/>`,text(['LEGEND'],lx+12,fy+20,11,BP.ink,{bold:true})];
 let ly=fy+42;
 for(const k of spec.legend.edgeKinds as ProjectEdge['kind'][]){legend.push(`<line x1="${lx+12}" y1="${ly-4}" x2="${lx+70}" y2="${ly-4}" stroke="${BP.line}" stroke-width="1.5"${EDGE_PATTERN[k]?` stroke-dasharray="${EDGE_PATTERN[k]}"`:''} marker-end="url(#bp-arrow)"/>`,text([EDGE_LABEL[k]],lx+84,ly,10,BP.ink));ly+=18;}
 for(const k of spec.legend.kinds as ProjectNode['kind'][]){legend.push(blueprintNode(k,{x:lx+22,y:ly-12,w:38,h:14}).replace(/stroke-width="1.5"/g,'stroke-width="1"'),text([KIND_LABEL[k]],lx+84,ly,10,BP.ink));ly+=18;}
 if(spec.legend.confidences.length){legend.push(text([`Confidence: ${spec.legend.confidences.join(', ')} (scanner evidence)`],lx+12,ly,10,BP.muted));}
 const block=[`<rect x="${bx}" y="${fy}" width="${blockW}" height="${blockH}" fill="${BP.paper}" stroke="${BP.ink}" stroke-width="1.6"/>`];
 let by=fy;
 for(const {k,ls,h} of blockRows){
  block.push(`<line x1="${bx}" y1="${by+h}" x2="${bx+blockW}" y2="${by+h}" stroke="${BP.line}" stroke-width=".7"/><line x1="${bx+112}" y1="${by}" x2="${bx+112}" y2="${by+h}" stroke="${BP.line}" stroke-width=".7"/>`,text([k],bx+10,by+14,9,BP.muted,{bold:true}),text(ls,bx+122,by+14,10,BP.ink,{lh:14}));by+=h;}
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(`${spec.title} (blueprint)`)}" data-style="blueprint" data-view-id="${xml(spec.viewId)}"><title>${xml(`${spec.title} · ${spec.projectTitle}`)}</title><g font-family="${FONT}">${grid.join('')}${head.join('')}<g transform="translate(${r(ox)},${r(oy)})">${edges}</g>${nodes}${labels}${legend.join('')}${block.join('')}</g></svg>`;
}

// ---------------------------------------------------------------------------------------------------- editorial
const ED={paper:'#fbf8f2',ink:'#1f1d1a',muted:'#6b645a',rule:'#d9d1c3',accent:'#b4441c'};
export function editorialSvg(input:Project,viewId=input.rootViewId,now=new Date()):string{
 const {spec,scene,byId,edgeById}=prepare(input,viewId,now),b=scene.bounds;
 const margin=56,listW=300,gap=40,top=margin+110,width=Math.ceil(margin*2+b.width+gap+listW),ox=margin-b.x,oy=top-b.y;
 const numbers=new Map(scene.nodes.map((n,i)=>[n.id,i+1]));
 const purpose=lines(spec.purpose||spec.projectTitle,b.width+gap+listW,14,2);
 const head=[text([spec.projectTitle.toUpperCase().slice(0,80)],margin,margin,10,ED.accent,{bold:true}),
  `<text x="${margin}" y="${margin+38}" font-size="30" fill="${ED.ink}" font-family="Georgia, 'Times New Roman', serif">${xml(spec.title.slice(0,70))}</text>`,text(purpose,margin,margin+66,14,ED.muted,{lh:19}),
  `<line x1="${margin}" y1="${top-24}" x2="${width-margin}" y2="${top-24}" stroke="${ED.ink}" stroke-width="1.2"/>`];
 const edges=scene.edges.map(e=>{const k=edgeById.get(e.id)?.kind??'batch';return `<path data-edge-id="${xml(e.id)}" d="${svgPolylinePath(e.points)}" transform="translate(${ox},${oy})" fill="none" stroke="${ED.ink}" stroke-width="1"${k==='dependency'?' stroke-dasharray="4 4"':''} marker-end="url(#ed-arrow)"/>`;}).join('');
 const nodes=scene.nodes.map(n=>{const s=byId.get(n.id);if(!s)return '';const x=n.x+ox,y=n.y+oy,no=numbers.get(n.id)!;
  return `<g data-node-id="${xml(s.id)}"><rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" fill="${ED.paper}" stroke="${s.opens?ED.accent:ED.ink}" stroke-width="${s.opens?1.6:1}"/>`+
   `<circle cx="${x}" cy="${y}" r="11" fill="${ED.ink}"/>${text([String(no)],x,y+4,11,ED.paper,{anchor:'middle',bold:true})}`+
   `${text(lines(s.label,n.w-24,15,2,true),x+14,y+34,15,ED.ink,{bold:true,lh:19})}${text(lines(s.summary,n.w-24,11,2),x+14,y+n.h-30,11,ED.muted,{lh:14})}</g>`;}).join('');
 const labels=scene.edges.map(e=>e.label&&e.label.lines.length?`<text x="${r(e.label.x+ox)}" y="${r(e.label.y+oy)}" font-size="10" font-style="italic" fill="${ED.muted}"${e.label.anchor==='middle'?' text-anchor="middle"':''} paint-order="stroke" stroke="${ED.paper}" stroke-width="4">${tspans(e.label.lines,e.label.x+ox,e.label.y+oy,e.label.lineHeight)}</text>`:'').join('');
 // Caption list: numbered callouts with kind and basis, in reading order.
 const lx=margin+b.width+gap;let ly=top;const list=[text(['KEY'],lx,ly-4,10,ED.accent,{bold:true})];ly+=16;
 for(const n of scene.nodes){const s=byId.get(n.id);if(!s)continue;const title=lines(`${numbers.get(n.id)}. ${s.label}`,listW,12,2,true),meta=lines(`${KIND_LABEL[s.kind]}${s.basis!=='unspecified'?` · ${BASIS_LABEL[s.basis??'unspecified']}`:''}${s.confidence?` · ${s.confidence}`:''}${s.opens?' · has detail':''}`,listW,10,1);
  list.push(text(title,lx,ly,12,ED.ink,{bold:true,lh:15}),text(meta,lx,ly+15*title.length+1,10,ED.muted));ly+=15*title.length+24;}
 const footY=Math.max(top+b.height,ly)+36;
 const foot=[`<line x1="${margin}" y1="${footY-18}" x2="${width-margin}" y2="${footY-18}" stroke="${ED.rule}"/>`,
  text([`${spec.projectId} · view ${spec.viewId} · ${vector(spec,4).join(' · ')}`.slice(0,220)],margin,footY,10,ED.muted),
  text([`${provenance(spec)} · ${spec.publication.generatedAt.slice(0,10)} · public content only${spec.omissions.length?` · ${spec.omissions.join(' ')}`:''}`.slice(0,240)],margin,footY+15,10,ED.muted)];
 const height=Math.ceil(footY+15+margin);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(`${spec.title} (editorial)`)}" data-style="editorial" data-view-id="${xml(spec.viewId)}"><title>${xml(`${spec.title} · ${spec.projectTitle}`)}</title><defs><marker id="ed-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 9 5 L 0 9" fill="none" stroke="${ED.ink}" stroke-width="1.2"/></marker></defs><rect width="100%" height="100%" fill="${ED.paper}"/><g font-family="${FONT}">${head.join('')}${edges}${nodes}${labels}${list.join('')}${foot.join('')}</g></svg>`;
}

export function styledSvg(input:Project,viewId:string,style:SvgStyle,now=new Date()):string{return style==='blueprint'?blueprintSvg(input,viewId,now):editorialSvg(input,viewId,now);}
