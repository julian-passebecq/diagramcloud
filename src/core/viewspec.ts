import {PERSPECTIVES,type Perspective,type Project,type ProjectEdge,type ProjectNode,type ProjectView} from './model';
import {publicDocument} from './operations';
import {presentedObservation,CLAIM_LABEL} from './realization';

/**
 * Renderer-neutral view specification (`diagramcloud.viewspec/1`): what one view means, independent of how it is drawn.
 * Every renderer (canvas, SVG standard / blueprint / editorial, draw.io, Mermaid, AtlasNote, a MosaicStudio scene)
 * consumes the same document; this is the explicit, serialisable form of one view for adapters outside DiagramCloud.
 * It never adds facts: nodes, edges, basis, confidence and evidence come from the validated document. The public
 * audience is built from publicDocument, so private items are removed, not hidden.
 */
export type SpecNode={id:string;label:string;kind:ProjectNode['kind'];provider:string;summary:string;basis:ProjectNode['basis']|'unspecified';confidence?:string;
 designStatus:ProjectNode['status'];opens?:string;evidenceRefs:string[];sourceRefs:string[];observation?:{claim:string;sourceApp:string;observedAt:string;sourceRevision:string};position:{x:number;y:number};group?:string};
export type SpecEdge={id:string;from:string;to:string;label:string;kind:ProjectEdge['kind'];basis:ProjectEdge['basis']|'unspecified';confidence?:string;quantity?:NonNullable<ProjectEdge['quantity']>};
export type ViewSpec={format:'diagramcloud.viewspec';version:1;projectId:string;projectRevision:number;projectTitle:string;viewId:string;title:string;purpose:string;
 audience:'public'|'author';perspective:Perspective;path:{viewId:string;title:string;via?:string}[];children:{nodeId:string;viewId:string;title:string}[];
 snapshot?:{id:string;capturedAt:string;repositories:{id:string;title:string;revision?:string;ref?:string;scanStatus:string}[]};
 nodes:SpecNode[];edges:SpecEdge[];groups:{id:string;title:string;members:string[]}[];legend:{kinds:string[];edgeKinds:string[];bases:string[];confidences:string[]};
 omissions:string[];publication:{policy:'publicDocument'|'authoring';generatedAt:string}};

const CONFIDENCES=['confirmed','inferred','possible'];
export const perspectiveOf=(v:Pick<ProjectView,'perspective'>):Perspective=>v.perspective??'system';

/** Drilldown path from the root to a view (the parent context a renderer must keep visible). */
export function pathTo(doc:Project,viewId:string):{viewId:string;title:string;via?:string}[]{
 const parent=new Map<string,{viewId:string;nodeId:string}>(),queue=[doc.rootViewId],seen=new Set(queue);
 while(queue.length){const id=queue.shift()!,v=doc.views.find(v=>v.id===id);if(!v)continue;
  for(const n of doc.nodes)if(v.nodeIds.includes(n.id)&&n.childViewId&&!seen.has(n.childViewId)){seen.add(n.childViewId);parent.set(n.childViewId,{viewId:id,nodeId:n.id});queue.push(n.childViewId);}}
 if(!seen.has(viewId))return [];
 const out:{viewId:string;title:string;via?:string}[]=[];let cur:string|undefined=viewId;
 while(cur){const p=parent.get(cur);out.unshift({viewId:cur,title:doc.views.find(v=>v.id===cur)?.title??cur,...(p?{via:p.nodeId}:{})});cur=p?.viewId;}
 return out;
}

/** The atlas repository a view or component belongs to (`<repo>.` prefix), if any. */
export function repositoryOf(doc:Project,id:string){
 const snap=doc.atlas?.snapshots.find(s=>s.id===doc.atlas!.activeSnapshotId);
 return snap?.repositories.find(r=>id.startsWith(`${r.id}.`)||r.nodeId===id);
}

export function viewSpec(input:Project,viewId:string,options:{audience?:'public'|'author';now?:Date}={}):ViewSpec{
 const audience=options.audience??'public',doc=audience==='public'?publicDocument(input):input;
 const view=doc.views.find(v=>v.id===viewId);
 if(!view)throw new Error(audience==='public'&&input.views.some(v=>v.id===viewId)?`View ${viewId} is not public.`:`Unknown view ${viewId}.`);
 const nodes=doc.nodes.filter(n=>view.nodeIds.includes(n.id)),ids=new Set(nodes.map(n=>n.id));
 const edges=doc.edges.filter(e=>view.edgeIds.includes(e.id)&&ids.has(e.source)&&ids.has(e.target));
 const confidence=(tags:string[])=>tags.find(t=>CONFIDENCES.includes(t));
 const edgeConfidence=(label:string)=>/\(inferred\)$/.test(label)?'inferred':/\(possible\)$/.test(label)?'possible':undefined;
 const groupOf=(id:string)=>repositoryOf(doc,id)?.id;
 const specNodes:SpecNode[]=nodes.map(n=>{const obs=presentedObservation(doc,n.id),conf=confidence(n.tags),g=groupOf(n.id);
  return {id:n.id,label:n.label,kind:n.kind,provider:n.provider,summary:n.summary,basis:n.basis??'unspecified',...(conf?{confidence:conf}:{}),designStatus:n.status,...(n.childViewId?{opens:n.childViewId}:{}),
   evidenceRefs:n.blockIds,sourceRefs:n.sourceIds,...(obs?{observation:{claim:CLAIM_LABEL[obs.claim],sourceApp:obs.sourceApp,observedAt:obs.observedAt,sourceRevision:obs.sourceRevision}}:{}),
   position:view.positions[n.id]??{x:0,y:0},...(g?{group:g}:{})};});
 const specEdges:SpecEdge[]=edges.map(e=>{const c=edgeConfidence(e.label);return {id:e.id,from:e.source,to:e.target,label:e.label,kind:e.kind,basis:e.basis??'unspecified',...(c?{confidence:c}:{}),...(e.quantity?{quantity:{...e.quantity}}:{})};});
 const groups=[...new Set(specNodes.map(n=>n.group).filter((g):g is string=>!!g))].map(g=>({id:g,title:repositoryOf(doc,`${g}.x`)?.title??g,members:specNodes.filter(n=>n.group===g).map(n=>n.id)}));
 const omissions:string[]=[];
 if(audience==='public'){const full=input.views.find(v=>v.id===viewId);if(full){const hidden=full.nodeIds.length-view.nodeIds.length,hiddenEdges=full.edgeIds.length-view.edgeIds.length;
  if(hidden>0)omissions.push(`${hidden} private or unreachable component(s) removed.`);if(hiddenEdges>0)omissions.push(`${hiddenEdges} private connection(s) removed.`);}}
 if(specNodes.some(n=>n.basis==='unknown'))omissions.push('Some components are declared but nothing was read for them (basis unknown).');
 const snap=doc.atlas?.snapshots.find(s=>s.id===doc.atlas!.activeSnapshotId);
 const uniq=(xs:(string|undefined)[])=>[...new Set(xs.filter((x):x is string=>!!x))].sort();
 return {format:'diagramcloud.viewspec',version:1,projectId:doc.id,projectRevision:doc.revision,projectTitle:doc.title,viewId,title:view.title,purpose:view.description,audience,perspective:perspectiveOf(view),
  path:pathTo(doc,viewId),children:specNodes.filter(n=>n.opens).map(n=>({nodeId:n.id,viewId:n.opens!,title:doc.views.find(v=>v.id===n.opens)?.title??n.opens!})),
  ...(snap?{snapshot:{id:snap.id,capturedAt:snap.capturedAt,repositories:snap.repositories.map(r=>({id:r.id,title:r.title,...(r.revision?{revision:r.revision}:{}),...(r.ref?{ref:r.ref}:{}),scanStatus:r.scanStatus}))}}:{}),
  nodes:specNodes,edges:specEdges,groups,legend:{kinds:uniq(specNodes.map(n=>n.kind)),edgeKinds:uniq(specEdges.map(e=>e.kind)),bases:uniq([...specNodes.map(n=>n.basis),...specEdges.map(e=>e.basis)]),confidences:uniq([...specNodes.map(n=>n.confidence),...specEdges.map(e=>e.confidence)])},
  omissions,publication:{policy:audience==='public'?'publicDocument':'authoring',generatedAt:(options.now??new Date()).toISOString()}};
}

/**
 * Where else a component can be seen. AVAILABLE: it appears in a view of that perspective. PARTIAL: one of its
 * drilldown views (or the view that opens it) has that perspective, but not the component itself. UNKNOWN: the project
 * has views of that perspective, none related to this component. UNSUPPORTED: the project has no view of that
 * perspective. Nothing is inferred beyond the document.
 */
export type PerspectiveState='available'|'partial'|'unknown'|'unsupported';
export type PerspectiveAvailability={perspective:Perspective;state:PerspectiveState;views:{viewId:string;title:string}[]};
export function perspectivesFor(doc:Project,nodeId:string):PerspectiveAvailability[]{
 const node=doc.nodes.find(n=>n.id===nodeId);
 const related=new Set<string>();if(node?.childViewId)related.add(node.childViewId);
 for(const v of doc.views)if(v.nodeIds.includes(nodeId))for(const n of doc.nodes)if(n.childViewId===v.id)for(const p of doc.views)if(p.nodeIds.includes(n.id))related.add(p.id);
 return PERSPECTIVES.map(perspective=>{
  const inPerspective=doc.views.filter(v=>perspectiveOf(v)===perspective);
  const direct=inPerspective.filter(v=>v.nodeIds.includes(nodeId)),partial=inPerspective.filter(v=>related.has(v.id)&&!v.nodeIds.includes(nodeId));
  const state:PerspectiveState=!inPerspective.length?'unsupported':direct.length?'available':partial.length?'partial':'unknown';
  return {perspective,state,views:(direct.length?direct:partial).map(v=>({viewId:v.id,title:v.title}))};
 });
}
export const PERSPECTIVE_LABEL:Record<Perspective,string>={system:'System',code:'Code',data:'Data',cloud:'Cloud',git:'Git',cicd:'CI/CD',agents:'Agents',decisions:'Decisions',evidence:'Evidence'};
