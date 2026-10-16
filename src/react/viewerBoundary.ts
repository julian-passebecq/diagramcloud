import {z} from 'zod';
import {documentSchema,validateDocument,MAX_DOCUMENT_BYTES,type Project} from '../core/model';
import {publicDocument,pathToView} from '../core/operations';
import {createCompletionRequest,completionRequestSchema} from '../intelligence/completionKit';

/** Local React props only. Not an owner wire protocol, capability grant or store. */
export const REACT_VIEWER_API_VERSION=1 as const;
export const VIEWER_UNAVAILABLE='Viewer unavailable: input, version, scope or selection is not supported.';
const id=z.string().regex(/^[a-z][a-z0-9_.-]{0,79}$/);
const selectionSchema=z.object({projectId:id,baseRevision:z.number().int().nonnegative(),viewId:id,nodeId:id.optional(),edgeId:id.optional()}).strict().refine(s=>!(s.nodeId&&s.edgeId));
const viewsSchema=z.array(id).min(1).max(80).refine(ids=>new Set(ids).size===ids.length);
export type ViewerSelection=z.infer<typeof selectionSchema>;
export type ViewerSelectionIntent=ViewerSelection;
export type ViewerSourceIntent=ViewerSelection&{sourceId:string};
export type ViewerInput={document:unknown;apiVersion:unknown;allowedViewIds:readonly string[];selection:ViewerSelection};
/** Internal display DTO only; never serialized as an existing external format. */
type ViewerContext={scope:'selected-component'|'selected-connection'|'selected-view';components:Project['nodes'];connections:Project['edges'];evidence:Project['blocks'];sources:Project['sources'];observations:Project['observations']};
export type ViewerReady={state:'ready';project:Project;selection:ViewerSelection;allowedViewIds:string[];path:string[];context:ViewerContext;fingerprint:string;documentIdentity:unknown};
export type ViewerBoundary=ViewerReady|{state:'unavailable';message:typeof VIEWER_UNAVAILABLE};
const refused=():ViewerBoundary=>({state:'unavailable',message:VIEWER_UNAVAILABLE});
function permittedSelection(project:Project,scope:readonly string[],selection:ViewerSelection){
 const view=project.views.find(v=>v.id===selection.viewId);
 return selection.projectId===project.id&&selection.baseRevision===project.revision&&scope.includes(selection.viewId)&&!!view&&
  (!selection.nodeId||view.nodeIds.includes(selection.nodeId))&&(!selection.edgeId||view.edgeIds.includes(selection.edgeId));
}
/** Construct only canonical public closure. No project fallback/query/history or locator parsing. */
export function prepareViewer(input:ViewerInput):ViewerBoundary{
 try{
  if(Object.keys(input).some(key=>!['document','apiVersion','allowedViewIds','selection'].includes(key)))return refused();
  if(input.apiVersion!==REACT_VIEWER_API_VERSION)return refused();
  const selection=selectionSchema.parse(input.selection),scope=viewsSchema.parse(input.allowedViewIds).sort();
  const serialized=JSON.stringify(input.document);if(typeof serialized!=='string'||new TextEncoder().encode(serialized).byteLength>MAX_DOCUMENT_BYTES)return refused();
  const publicProject=publicDocument(validateDocument(input.document));
  if(scope.some(viewId=>!publicProject.views.some(v=>v.id===viewId))||!permittedSelection(publicProject,scope,selection))return refused();
  const views=publicProject.views.filter(v=>scope.includes(v.id)),nodeIds=new Set(views.flatMap(v=>v.nodeIds)),edgeIds=new Set(views.flatMap(v=>v.edgeIds));
  const nodes=publicProject.nodes.filter(n=>nodeIds.has(n.id)).map(n=>{const row={...n};if(row.childViewId&&!scope.includes(row.childViewId))delete row.childViewId;delete row.experienceWorkspaceId;delete row.customIconAssetId;return row;});
  const observations=publicProject.observations.filter(o=>nodeIds.has(o.nodeId));
  const blockIds=new Set([...nodes.flatMap(n=>n.blockIds),...observations.flatMap(o=>o.blockIds)]),blocks=publicProject.blocks.filter(b=>blockIds.has(b.id)),assetIds=new Set(blocks.flatMap(b=>b.type==='image'?[b.assetId]:[]));
  const sourceIds=new Set([...nodes.flatMap(n=>n.sourceIds),...blocks.flatMap(b=>b.sourceIds)]);
  const project=validateDocument(documentSchema.parse({schemaVersion:1,id:publicProject.id,revision:publicProject.revision,title:'DiagramCloud public viewer',rootViewId:scope.includes(publicProject.rootViewId)?publicProject.rootViewId:selection.viewId,
   nodes,edges:publicProject.edges.filter(e=>edgeIds.has(e.id)),views,blocks,assets:publicProject.assets.filter(a=>assetIds.has(a.id)),sources:publicProject.sources.filter(s=>sourceIds.has(s.id)),observations}));
  // The original root may be outside the grant. Retain an admitted canonical
  // ancestor path instead of rerooting every child selection at the child.
  // Prefer the authored public root when it remains reachable in this closure.
  const paths=project.views.map(view=>({root:view.id,path:pathToView({...project,rootViewId:view.id},selection.viewId)})).filter(candidate=>candidate.path[0]===candidate.root);
  const authored=scope.includes(publicProject.rootViewId)?paths.find(candidate=>candidate.root===publicProject.rootViewId):undefined;
  const path=authored?.path??paths.reduce((longest,candidate)=>candidate.path.length>longest.length?candidate.path:longest,[selection.viewId]);
  project.rootViewId=path[0];validateDocument(project);
  const context=selectedViewerContext(project,selection);
  return {state:'ready',project,selection,allowedViewIds:scope,path,context,fingerprint:JSON.stringify({project,selection,scope}),documentIdentity:input.document};
 }catch{return refused();}
}

function selectedViewerContext(project:Project,selection:ViewerSelection):ViewerContext{
 // Called only after exact public view/member validation; no current-project fallback.
 const view=project.views.find(v=>v.id===selection.viewId)!,edge=selection.edgeId?project.edges.find(e=>e.id===selection.edgeId):undefined;
 const ids=new Set(selection.nodeId?[selection.nodeId]:edge?[edge.source,edge.target]:view.nodeIds),components=project.nodes.filter(n=>ids.has(n.id));
 const observations=project.observations.filter(o=>ids.has(o.nodeId)),blockIds=new Set([...components.flatMap(n=>n.blockIds),...observations.flatMap(o=>o.blockIds)]),evidence=project.blocks.filter(b=>blockIds.has(b.id));
 const sourceIds=new Set([...components.flatMap(n=>n.sourceIds),...evidence.flatMap(b=>b.sourceIds)]);
 return {scope:selection.nodeId?'selected-component':selection.edgeId?'selected-connection':'selected-view',components:structuredClone(components),
  connections:structuredClone(project.edges.filter(e=>view.edgeIds.includes(e.id)&&(edge?e.id===edge.id:selection.nodeId?e.source===selection.nodeId||e.target===selection.nodeId:true))),evidence:structuredClone(evidence),sources:structuredClone(project.sources.filter(s=>sourceIds.has(s.id))),observations:structuredClone(observations)};
}

/** Revalidate immutable identity AND actual current scope/revision/content, without incrementing any revision for an object clone. */
export function liveViewerBoundary(captured:ViewerReady,live:ViewerInput):ViewerReady|undefined{
 if(captured.documentIdentity!==live.document)return undefined;
 const current=prepareViewer(live);return current.state==='ready'&&current.fingerprint===captured.fingerprint?current:undefined;
}
export function viewerSelectionIntent(captured:ViewerReady,live:ViewerInput,target:unknown):ViewerSelectionIntent|undefined{
 const current=liveViewerBoundary(captured,live);if(!current)return undefined;
 try{const intent=selectionSchema.parse(target);return permittedSelection(current.project,current.allowedViewIds,intent)?intent:undefined;}catch{return undefined;}
}
export function viewerSourceIntent(captured:ViewerReady,live:ViewerInput,sourceId:unknown):ViewerSourceIntent|undefined{
 const current=liveViewerBoundary(captured,live);if(!current||!id.safeParse(sourceId).success||!current.context.sources.some(s=>s.id===sourceId))return undefined;
 return {...current.selection,sourceId:sourceId as string};
}
/** Reuse the existing inert request producer and its byte/omission/secret rules.
 * No new format/dialect: selected connections explicitly have no file fallback. */
export function viewerContextText(captured:ViewerReady,live:ViewerInput):string|undefined{
 const current=liveViewerBoundary(captured,live);if(!current)return undefined;
 if(current.selection.edgeId)return undefined;
 try{
  // Explicit current view is the root of this transient public scope so omitted
  // ancestors cannot cause a project fallback or erase a granted child-only view.
  const view=current.project.views.find(v=>v.id===current.selection.viewId)!,ids=new Set(view.nodeIds);
  const nodes=current.project.nodes.filter(n=>ids.has(n.id)).map(n=>{const row={...n};delete row.childViewId;return row;});
  const observations=current.project.observations.filter(o=>ids.has(o.nodeId)),blockIds=new Set([...nodes.flatMap(n=>n.blockIds),...observations.flatMap(o=>o.blockIds)]);
  const blocks=current.project.blocks.filter(b=>blockIds.has(b.id)),sourceIds=new Set([...nodes.flatMap(n=>n.sourceIds),...blocks.flatMap(b=>b.sourceIds)]),assetIds=new Set(blocks.flatMap(b=>b.type==='image'?[b.assetId]:[]));
  const project=validateDocument(documentSchema.parse({schemaVersion:1,id:current.project.id,revision:current.project.revision,title:'DiagramCloud selected public view',rootViewId:view.id,views:[view],nodes,edges:current.project.edges.filter(e=>view.edgeIds.includes(e.id)),blocks,observations,sources:current.project.sources.filter(s=>sourceIds.has(s.id)),assets:current.project.assets.filter(a=>assetIds.has(a.id))}));
  const request=createCompletionRequest(project,{requestId:'react-viewer-public-context',question:'Explain this selected public context; preserve unknown facts and propose no automatic action.',audience:'public',selection:{viewId:current.selection.viewId,...(current.selection.nodeId?{nodeId:current.selection.nodeId}:{})}});
  return JSON.stringify(completionRequestSchema.parse(request));
 }catch{return undefined;}
}
