import {publicDocument} from '../core/operations';
import type {Project,ProjectNode,ProjectView} from '../core/model';
import {CLAIM_LABEL,presentedObservation} from '../core/realization';
import {buildScene} from './scene';
import {orderedViews} from './drawio';

/**
 * AtlasNote cheatsheet export (`urn:atlasnote:cheatsheet:1.1`, the JSON AtlasNote's "Cheatsheet source" dialog validates
 * and imports). One 1200 × 1600 page per public view, root first then each drilldown: the view title, its description,
 * a graph diagram with the canvas positions scaled into the page, and a component table. A story page follows when the
 * project has public story steps. AtlasNote draws its own generic shapes: no vendor artwork, no raw SVG, no evidence
 * blocks, sources or private content (everything goes through publicDocument first).
 */
export const ATLASNOTE_LIMITS={pages:64,nodes:80,edges:240,rows:10,storySteps:60};
const PAGE={width:1200,height:1600},X=80,W=1040;
const FRAME={title:{x:X,y:56,width:W,height:64},description:{x:X,y:128,width:W,height:84},diagram:{x:X,y:228,width:W,height:820},section:{x:X,y:1076,width:W,height:40},table:{x:X,y:1124,width:W,height:416},footer:{x:X,y:1548,width:W,height:32}};
const CAPTION=28,PAD=10;
const KIND_LABEL:Record<ProjectNode['kind'],string>={source:'Source',process:'Process',storage:'Storage',model:'Model',report:'Report',app:'Application',control:'Control',physics:'Physics',function:'Function',table:'Table'};

type Frame={x:number;y:number;width:number;height:number};
type Block=Record<string,unknown>&{id:string;type:string};
type Page={id:string;title:string;blocks:Block[];frames:Record<string,Frame>;outline:{id:string;label:string;blockId:string}[]};
export type AtlasCheatsheet={schemaVersion:'1.1';id:string;title:string;subtitle?:string;pageSize:{width:number;height:number};meta:Record<string,string>;pages:Page[]};

/** Plain text AtlasNote accepts: no control characters, bounded length, never empty where a label is required. */
function clean(s:string,max:number){const t=s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ').replace(/\s+/g,' ').trim();return t.length>max?`${t.slice(0,max-1)}…`:t;}
const round=(n:number)=>Math.round(n*100)/100;

/**
 * Canvas boxes (the shared export scene) placed by their centres, scaled uniformly into the diagram frame and centred.
 * AtlasNote draws only the label inside a box and puts connection labels in the gap between boxes, so boxes are drawn
 * smaller than on the canvas (80 % wide, 60 % high) and a sparse view may spread up to 1.4× to leave room for labels.
 */
function nodeFrames(scene:{id:string;x:number;y:number;w:number;h:number}[],width:number,height:number){
 const minX=Math.min(...scene.map(s=>s.x)),minY=Math.min(...scene.map(s=>s.y)),maxX=Math.max(...scene.map(s=>s.x+s.w)),maxY=Math.max(...scene.map(s=>s.y+s.h));
 const fit=Math.min(1,(width-2*PAD)/(maxX-minX),(height-2*PAD)/(maxY-minY)),size=(s:{w:number;h:number})=>({w:Math.max(1,round(s.w*.8*fit)),h:Math.max(1,round(s.h*.6*fit))});
 const centres=scene.map(s=>({id:s.id,cx:s.x+s.w/2,cy:s.y+s.h/2,...size(s)}));
 const cx0=Math.min(...centres.map(c=>c.cx)),cy0=Math.min(...centres.map(c=>c.cy)),spanX=Math.max(...centres.map(c=>c.cx))-cx0,spanY=Math.max(...centres.map(c=>c.cy))-cy0;
 const bw=Math.max(...centres.map(c=>c.w)),bh=Math.max(...centres.map(c=>c.h));
 const k=Math.min(1.4,spanX?(width-2*PAD-bw)/spanX:Infinity,spanY?(height-2*PAD-bh)/spanY:Infinity),ox=(width-spanX*k)/2,oy=(height-spanY*k)/2;
 const out:Record<string,Frame>={};
 for(const c of centres){
  const x=Math.min(width-c.w,Math.max(0,round(ox+(c.cx-cx0)*k-c.w/2))),y=Math.min(height-c.h,Math.max(0,round(oy+(c.cy-cy0)*k-c.h/2)));
  out[c.id]={x,y,width:c.w,height:c.h};
 }
 return out;
}

function viewPage(d:Project,view:ProjectView,root:boolean,titleOf:Map<string,string>):Page{
 const p=`v.${view.id}`,byId=new Map(d.nodes.map(n=>[n.id,n]));
 const all=buildScene(d,view).nodes,scene=all.slice(0,ATLASNOTE_LIMITS.nodes),kept=new Set(scene.map(s=>s.id));
 const edges=d.edges.filter(e=>view.edgeIds.includes(e.id)&&kept.has(e.source)&&kept.has(e.target)&&e.source!==e.target);
 const shownEdges=edges.slice(0,ATLASNOTE_LIMITS.edges);
 const blocks:Block[]=[],frames:Record<string,Frame>={},outline:Page['outline']=[];
 const add=(b:Block,f:Frame)=>{blocks.push(b);frames[b.id]={...f};};
 add({id:`${p}.title`,type:'text',role:'title',text:clean(root?`${d.title} · ${view.title}`:view.title,240)||view.id},FRAME.title);
 const description=clean(view.description||(root?d.summary:''),1200);
 if(description)add({id:`${p}.description`,type:'text',role:'body',style:{fontSize:19,minFontSize:14,overflow:'shrink'},text:description},FRAME.description);
 if(scene.length){
  const hidden=all.length-scene.length,droppedEdges=edges.length-shownEdges.length;
  const caption=clean([`${scene.length} components, ${shownEdges.length} connections`,hidden?`${hidden} more components in DiagramCloud`:'',droppedEdges?`${droppedEdges} more connections in DiagramCloud`:'',scene.some(s=>byId.get(s.id)?.childViewId)?'› opens a detail page':'','dashed: dependency'].filter(Boolean).join(' · '),300);
  add({id:`${p}.diagram`,type:'diagram',family:'graph',layout:'manual',
   nodes:scene.map(s=>{const n=byId.get(s.id)!;return {id:n.id,label:`${clean(n.label,150)||n.id}${n.childViewId?' ›':''}`,shape:n.kind==='storage'||n.kind==='table'?'rect':'roundedRect'};}),
   nodeFrames:nodeFrames(scene,FRAME.diagram.width,FRAME.diagram.height-CAPTION),
   edges:shownEdges.map(e=>{const label=clean(e.label,100);return {from:e.source,to:e.target,...(label?{label}:{}),...(e.kind==='dependency'?{dashed:true}:{})};}),
   caption},FRAME.diagram);
  outline.push({id:`a.${view.id}.diagram`,label:clean(view.title,240)||view.id,blockId:`${p}.diagram`});
  const rows=scene.slice(0,ATLASNOTE_LIMITS.rows).map(s=>{
   const n=byId.get(s.id)!,obs=presentedObservation(d,n.id);
   const detail=[n.childViewId&&titleOf.has(n.childViewId)?`Opens: ${titleOf.get(n.childViewId)}`:'',obs?`${CLAIM_LABEL[obs.claim]} by ${obs.sourceApp} (${obs.observedAt.slice(0,10)})`:''].filter(Boolean).join('; ');
   return [clean(n.label,150)||n.id,clean(n.provider==='Generic'?KIND_LABEL[n.kind]:`${KIND_LABEL[n.kind]} · ${n.provider}`,120),clean(n.summary,160)||'—',clean(detail,200)||'—'];
  });
  add({id:`${p}.section`,type:'text',role:'section',text:'Components'},FRAME.section);
  add({id:`${p}.table`,type:'table',style:{fontSize:15,minFontSize:11,overflow:'shrink'},columns:['Component','Type','Summary','Detail'],rows,widths:[.24,.16,.4,.2]},FRAME.table);
  outline.push({id:`a.${view.id}.table`,label:`${clean(view.title,220)||view.id}: components`,blockId:`${p}.table`});
  if(scene.length>rows.length)add({id:`${p}.footer`,type:'text',role:'caption',text:`${scene.length-rows.length} more components in the diagram above; full details in DiagramCloud.`},FRAME.footer);
 }else add({id:`${p}.empty`,type:'text',role:'body',text:'This view has no public components.'},FRAME.diagram);
 return {id:p,title:clean(view.title,240)||view.id,blocks,frames,outline};
}

function storyPage(d:Project,titleOf:Map<string,string>):Page{
 const steps=d.story.slice(0,ATLASNOTE_LIMITS.storySteps),items=steps.map(s=>clean(`${s.title} (${titleOf.get(s.viewId)??s.viewId}): ${s.narration}`,600));
 const title={id:'s.story.title',type:'text',role:'title',text:'Story'},list={id:'s.story.steps',type:'list',ordered:true,style:{fontSize:20,minFontSize:12,overflow:'shrink'},items};
 return {id:'s.story',title:'Story',blocks:[title,list],frames:{[title.id]:{...FRAME.title},[list.id]:{x:X,y:150,width:W,height:1390}},outline:[{id:'a.story',label:'Story',blockId:list.id}]};
}

export function atlasnoteCheatsheet(input:Project,now=new Date()):AtlasCheatsheet{
 const d=publicDocument(input),hasStory=d.story.length>0,all=orderedViews(d),views=all.slice(0,ATLASNOTE_LIMITS.pages-(hasStory?1:0));
 const titleOf=new Map(views.map(v=>[v.id,clean(v.title,200)||v.id]));
 const pages=views.map((v,i)=>viewPage(d,v,i===0,titleOf));
 if(hasStory)pages.push(storyPage(d,titleOf));
 const dropped=all.length-views.length;
 const provenance=`Exported from DiagramCloud project “${clean(d.title,160)}” (${d.id}, revision ${d.revision}) on ${now.toISOString().slice(0,10)}. Public content only: positions come from the DiagramCloud canvas; evidence tables, sources and images stay in DiagramCloud.${dropped?` ${dropped} further views are not included (AtlasNote's 64-page limit).`:''}`;
 const subtitle=clean(d.summary,500);
 return {schemaVersion:'1.1',id:`diagramcloud-${d.id}`.slice(0,120),title:clean(d.title,240)||d.id,...(subtitle?{subtitle}:{}),pageSize:{...PAGE},meta:{provenance,preset:'architecture'},pages};
}

export const atlasnoteCheatsheetJson=(input:Project,now=new Date())=>JSON.stringify(atlasnoteCheatsheet(input,now),null,2);
