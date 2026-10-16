import type {Perspective,Project} from '../../core/model';
import {publicDocument} from '../../core/operations';
import {viewSpec,type SpecNode} from '../../core/viewspec';
import {compileLearningExample,learningExamplesForLesson} from './examples';
import {foilEnvironments,galaxyProcess,selfDescription} from './journeys';
import type {LearningEntry} from './catalogue';
/**
 * Semantic depth (R4-AC-12): Overview, Mechanism and Detail are explicit containment levels over one view, read from the
 * document's own childViewId drilldown (via viewSpec, so the public projection applies). Overview shows the view; Mechanism
 * also shows, inside each container, the view its node opens; Detail opens one more level and lists each component's
 * public evidence. Bounded at two levels and never revisits a view: no recursive drilldown, no new model, no inferred
 * membership. Depth is one navigation dimension: it never reads or sets the camera zoom, environment, perspective, variant,
 * run or audience (`explore` keeps them independent).
 */
export const SEMANTIC_DEPTHS=[{id:'overview',label:'Overview',level:0},{id:'architecture',label:'Mechanism',level:1},{id:'detail',label:'Detail',level:2}] as const;
export type SemanticDepth=typeof SEMANTIC_DEPTHS[number]['id'];
export const depthLabel=(depth:SemanticDepth)=>SEMANTIC_DEPTHS.find(d=>d.id===depth)!.label;
export type DepthNode={id:string;label:string;kind:SpecNode['kind'];level:number;viewId:string;container?:string;opens?:string;expanded:boolean;summary?:string;evidence?:string[]};
export type DepthEdge={id:string;from:string;to:string;label:string;kind:string;viewId:string};
export type DepthScene={format:'diagramcloud.depth-scene/1';projectId:string;viewId:string;viewTitle:string;depth:SemanticDepth;level:number;
 nodes:DepthNode[];edges:DepthEdge[];views:{viewId:string;title:string;level:number;via?:string}[];collapsed:{nodeId:string;viewId:string;title:string}[];note:string};
export const DEPTH_NOTE='Depth is a containment level over this view (explicit drilldown only). It changes no environment, perspective, variant, run, audience or camera zoom.';
export function depthScene(doc:Project,viewId:string,depth:SemanticDepth,options:{audience?:'public'|'author'}={}):DepthScene{
 const audience=options.audience??'public',level=SEMANTIC_DEPTHS.find(d=>d.id===depth)!.level,source=audience==='public'?publicDocument(doc):doc;
 const root=viewSpec(doc,viewId,{audience,now:new Date(0)}),nodes=new Map<string,DepthNode>(),edges=new Map<string,DepthEdge>(),seen=new Set([viewId]);
 const views:DepthScene['views']=[{viewId,title:root.title,level:0}];
 const add=(spec:ReturnType<typeof viewSpec>,at:number,container?:string)=>{
  for(const n of spec.nodes)if(!nodes.has(n.id))nodes.set(n.id,{id:n.id,label:n.label,kind:n.kind,level:at,viewId:spec.viewId,...(container?{container}:{}),...(n.opens?{opens:n.opens}:{}),expanded:false});
  for(const e of spec.edges)if(!edges.has(e.id))edges.set(e.id,{id:e.id,from:e.from,to:e.to,label:e.label,kind:e.kind,viewId:spec.viewId});
 };
 add(root,0);
 let frontier=[...nodes.values()].filter(n=>n.opens);
 for(let at=1;at<=level&&frontier.length;at++){
  const next:DepthNode[]=[];
  for(const holder of frontier){const child=holder.opens!;if(seen.has(child)||!source.views.some(v=>v.id===child))continue;seen.add(child);
   const spec=viewSpec(doc,child,{audience,now:new Date(0)}),before=new Set(nodes.keys());holder.expanded=true;views.push({viewId:child,title:spec.title,level:at,via:holder.id});add(spec,at,holder.id);
   next.push(...[...nodes.values()].filter(n=>!before.has(n.id)&&n.opens));}
  frontier=next;
 }
 if(level>=2){const blocks=new Map(source.blocks.map(b=>[b.id,b.title]));for(const n of nodes.values()){const s=source.nodes.find(x=>x.id===n.id);if(s){n.summary=s.summary;n.evidence=s.blockIds.flatMap(id=>blocks.has(id)?[blocks.get(id)!]:[]);}}}
 const collapsed=[...nodes.values()].filter(n=>n.opens&&!n.expanded&&!seen.has(n.opens)).flatMap(n=>{const v=source.views.find(v=>v.id===n.opens);return v?[{nodeId:n.id,viewId:v.id,title:v.title}]:[];});
 return {format:'diagramcloud.depth-scene/1',projectId:root.projectId,viewId,viewTitle:root.title,depth,level,nodes:[...nodes.values()],edges:[...edges.values()],views,collapsed,note:DEPTH_NOTE};
}
/** Independent navigation dimensions. Each action changes exactly its own dimension: zooming the camera never changes depth or environment. */
export type ExplorerState={depth:SemanticDepth;zoom:number;environmentId:string|null;perspective:Perspective|null};
export type ExplorerAction={type:'depth';depth:SemanticDepth}|{type:'zoom';zoom:number}|{type:'environment';environmentId:string|null}|{type:'perspective';perspective:Perspective|null};
export const ZOOM_LIMITS={min:0.5,max:2,step:0.25} as const;
export function explore(state:ExplorerState,action:ExplorerAction):ExplorerState{
 switch(action.type){
  case 'depth':return {...state,depth:action.depth};
  case 'zoom':return {...state,zoom:Math.min(ZOOM_LIMITS.max,Math.max(ZOOM_LIMITS.min,Math.round(action.zoom*100)/100))};
  case 'environment':return {...state,environmentId:action.environmentId};
  case 'perspective':return {...state,perspective:action.perspective};
 }
}
/** Diagrams a lesson can show: its compiled synthetic examples, and the adoption journeys explicitly linked to it below. */
export const LESSON_JOURNEYS=[
 {lessonId:'medallion-environments',journey:'foil',why:'Bronze, silver and gold refinement kept apart from DEV, TEST and PROD environment instances.'},
 {lessonId:'worktrees-ci',journey:'galaxy',why:'The intended agent procedure: session, worktree, pull request, CI, merge, handoff.'},
 {lessonId:'worktrees-ci',journey:'self',why:'DiagramCloud\'s own CI receipt, source-declared for this lesson.'},
 {lessonId:'workflow-agent',journey:'self',why:'DiagramCloud\'s own revision guard, source-declared as the review gate for this lesson.'}
] as const;
const JOURNEYS={foil:foilEnvironments,galaxy:galaxyProcess,self:selfDescription};
/** A compiled example keeps the brief compiler's private-by-default visibility (the author decides what to publish), so the lesson
 * reads it as its author, locally; nothing here is exported. A journey is read through the public projection. */
export type LessonDiagram={id:string;title:string;kind:'example'|'journey';why:string;audience:'public'|'author';load:()=>Project};
export function lessonDiagrams(entry:Pick<LearningEntry,'id'>):LessonDiagram[]{
 const examples=learningExamplesForLesson(entry.id).map(id=>({id:'example-'+id,title:compileLearningExample(id).title,kind:'example' as const,why:'Compiled from the lesson\'s authored synthetic ProjectBrief; shown to its author (private by default), not exported.',audience:'author' as const,load:()=>compileLearningExample(id)}));
 const journeys=LESSON_JOURNEYS.filter(row=>row.lessonId===entry.id).map(row=>({id:'journey-'+row.journey,title:'Adoption journey: '+JOURNEYS[row.journey]().title,kind:'journey' as const,why:row.why,audience:'public' as const,load:JOURNEYS[row.journey]}));
 return [...examples,...journeys];
}
