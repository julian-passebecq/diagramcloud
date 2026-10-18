import type {Project,ProjectEdge} from '../core/model';
import {repositoryOutputFacts} from './recipes';
import {overviewProjection} from '../export/projectOverview';
import {pathTo,perspectiveOf, repositoryOf} from '../core/viewspec';
import {readEvolutionHistory} from './evolution';
import {readAcquisitionAnalysis} from './materialize';

export type NavigationFilters={query?:string;environmentId?:string;snapshotId?:string;maxNodes?:number;maxDepth?:number};
export type NavigationBranch={id:string;label:string;kind:string;basis:string;sourceIds:string[];children:NavigationBranch[];omitted:number;workspaceId?:string};
/** Runtime pointers to canonical entities. Filters never rename, move, or select entities. */
export function projectNavigation(input:Project,options:NavigationFilters&{publicMode?:boolean}={}){
 const p=overviewProjection(input,options.publicMode??false),nodes=new Map(p.nodes.map(n=>[n.id,n])),views=new Map(p.views.map(v=>[v.id,v]));
 const query=(options.query??'').trim().toLocaleLowerCase(),limit=Math.max(1,Math.min(500,options.maxNodes??200)),depthLimit=Math.max(0,Math.min(5,options.maxDepth??5));
 const atlas=p.atlas?.snapshots.find(s=>s.id===p.atlas?.activeSnapshotId),history=readEvolutionHistory(p),snapshot=history.snapshots.find(s=>s.id===options.snapshotId);
 const filterProblems:string[]=[];if(options.environmentId&&!p.delivery?.environments.some(e=>e.id===options.environmentId))filterProblems.push('Selected environment is unavailable in this projection.');if(options.snapshotId&&!snapshot)filterProblems.push('Selected retained evolution snapshot is unavailable in this projection.');
 const environmentIds=options.environmentId?new Set(p.delivery?.instances.filter(i=>i.environmentId===options.environmentId).flatMap(i=>[i.componentId,i.nodeId])??[]):undefined;
 const snapshotIds=snapshot?new Set(snapshot.nodes.map(n=>n.id)):undefined;
 const eligible=(id:string)=>{const n=nodes.get(id);return !!n&&(!query||[n.id,n.label,n.kind,...n.tags,...n.sourceIds].some(s=>s.toLocaleLowerCase().includes(query)))&&(!environmentIds||environmentIds.has(id))&&(!snapshotIds||snapshotIds.has(id))&&!filterProblems.length;};
 const children=(id:string)=>views.get(nodes.get(id)?.childViewId??'')?.nodeIds??[];
 const matchesBranch=(id:string,trail=new Set<string>()):boolean=>!trail.has(id)&&(eligible(id)||children(id).some(child=>matchesBranch(child,new Set([...trail,id]))));
 let remaining=limit,omitted=0;
 const branch=(id:string,depth=0,trail=new Set<string>()):NavigationBranch|undefined=>{
  const n=nodes.get(id);if(!n||trail.has(id)||!matchesBranch(id))return undefined;if(!remaining){omitted++;return undefined;}remaining--;
  const childIds=children(id).filter(child=>matchesBranch(child)),next=new Set([...trail,id]);
  const childBranches=depth<depthLimit?childIds.flatMap(child=>{const b=branch(child,depth+1,next);return b?[b]:[];}):[];
  const hidden=depth>=depthLimit?childIds.length:childIds.length-childBranches.length;omitted+=depth>=depthLimit?hidden:0;
  return {id:n.id,label:n.label,kind:n.kind,basis:n.basis??'unknown',sourceIds:n.sourceIds,children:childBranches,omitted:hidden,workspaceId:n.experienceWorkspaceId};
 };
 const logicalEntities=p.experience?.entities.filter(e=>e.type!=='repository'&&nodes.has(e.id))??[],logicalIds=new Set(logicalEntities.map(e=>e.id)),logicalChildren=new Set(logicalEntities.flatMap(e=>e.children).filter(id=>logicalIds.has(id)));
 const roots=logicalEntities.length?logicalEntities.filter(e=>!logicalChildren.has(e.id)).map(e=>e.id):views.get(p.rootViewId)?.nodeIds??[];
 const project=roots.flatMap(id=>{const b=branch(id);return b?[b]:[];});
 // The physical tree is rooted only in the atlas's explicit repository card/namespace.
 remaining=limit;
 const repositories=(atlas?.repositories??[]).flatMap(r=>{
  const id=r.nodeId??`repo-${r.id}`,card=nodes.get(id),memberIds=p.nodes.filter(n=>n.id.startsWith(r.id+'.')).map(n=>n.id),rootIds=card?.childViewId?views.get(card.childViewId)?.nodeIds??[]:memberIds.filter(id=>!p.nodes.some(n=>children(n.id).includes(id)&&n.id.startsWith(r.id+'.')));
  const ownMatch=!query||[r.id,r.title,r.locator].some(s=>s.toLocaleLowerCase().includes(query));
  const descendants=rootIds.flatMap(id=>{const b=branch(id);return b?[b]:[];});
  if(!descendants.length&&(!ownMatch||environmentIds||snapshotIds||filterProblems.length))return [];
  const analysis=readAcquisitionAnalysis(p,r.id);
  return [{...r,children:descendants,memberCount:memberIds.length,acquisition:analysis?{profile:analysis.sourceIdentity.profile,complete:analysis.sourceIdentity.scopeComplete,selectedFiles:analysis.inventory.selectedFiles,readFiles:analysis.inventory.readFiles,readBytes:analysis.inventory.readBytes,limited:analysis.inventory.limited,omitted:analysis.inventory.omittedEntries}:undefined}];
 });
 const crosswalk=(p.experience?.relations??[]).flatMap(relation=>{
  const a=nodes.get(relation.source),b=nodes.get(relation.target),ra=repositoryOf(p,relation.source),rb=repositoryOf(p,relation.target);
  if(!a||!b||(!ra&&!rb)||(ra&&rb))return [];
  const logical=ra?b:a,physical=ra?a:b,repository=(ra??rb)!;
  if(!eligible(logical.id)&&!eligible(physical.id))return [];
  return [{id:relation.id,logicalId:logical.id,logicalLabel:logical.label,physicalId:physical.id,physicalLabel:physical.label,repositoryId:repository.id,repositoryTitle:repository.title,kind:relation.kind,assertion:relation.assertion,sourceIds:relation.sourceIds,origin:'Explicit experience relation',revision:repository.revision??'UNKNOWN'}];
 });
 const groupedViews=p.views.filter(v=>(!query||[v.id,v.title,v.description,perspectiveOf(v)].some(s=>s.toLocaleLowerCase().includes(query)))&&(!environmentIds&&!snapshotIds||v.nodeIds.some(id=>(!environmentIds||environmentIds.has(id))&&(!snapshotIds||snapshotIds.has(id))))&&!filterProblems.length).reduce<Record<string,Project['views']>>((groups,v)=>{(groups[perspectiveOf(v)]??=[]).push(v);return groups;},{});
 return {projectId:p.id,revision:p.revision,project,repositories,crosswalk,groupedViews,environments:p.delivery?.environments.map(e=>({id:e.id,label:e.label}))??[],snapshots:history.snapshots.map(s=>({id:s.id,label:s.label,capturedAt:s.capturedAt,documentRevision:s.documentRevision})),selectionExists:(id:string)=>nodes.has(id),selectionVisible:(id:string)=>eligible(id),filtered:!!query||!!environmentIds||!!options.snapshotId,filterProblems,omitted,budget:{nodesPerHierarchy:limit,maxDepth:depthLimit},logicalOrigin:logicalEntities.length?'Declared experience entities mapped by exact canonical ID':'Authored root and child-view membership',note:'Logical scope and physical repository membership remain independent. Environment and retained-snapshot filters use explicit stable IDs; no branch, deployment, or history is inferred.'};
}

export function selectionContext(p:Project,selection:{nodeId?:string;viewId?:string}={}){
 const node=p.nodes.find(n=>n.id===selection.nodeId),view=p.views.find(v=>v.id===selection.viewId),ids=new Set(node?[node.id]:view?.nodeIds??p.nodes.map(n=>n.id));
 const components=p.nodes.filter(n=>ids.has(n.id)),blockIds=new Set(components.flatMap(n=>n.blockIds)),blocks=p.blocks.filter(b=>blockIds.has(b.id)),sourceIds=new Set([...components.flatMap(n=>n.sourceIds),...blocks.flatMap(b=>b.sourceIds)]);
 const repository=node?repositoryOf(p,node.id):undefined;
 return {node,view,repository,components,blocks,sources:p.sources.filter(s=>sourceIds.has(s.id)),relations:p.edges.filter(e=>ids.has(e.source)||ids.has(e.target)),observations:p.observations.filter(o=>ids.has(o.nodeId)),selection:{nodeId:node?.id,viewId:view?.id},scope:node?'selected-component':view?'selected-view':'current-project'};
}

/** Runtime read-only rows from the permitted Project, never a richer producer relation or persisted model. */
export type RelationshipTableRow={id:string;source:{id:string;label:string};target:{id:string;label:string};label:string;kind:ProjectEdge['kind'];basis:NonNullable<ProjectEdge['basis']>|'unspecified';quantity?:NonNullable<ProjectEdge['quantity']>;views:{id:string;title:string}[];endpointSources:{id:string;title:string;location:string}[]};
export type RelationshipTableFacts={projectId:string;revision:number;scope:'project'|'repository';state:'available'|'unavailable';rows:RelationshipTableRow[];views:{id:string;title:string;connectionCount:number}[];total:number};
/** Public projection precedes repository membership, source lookup, counts and pagination. */
export function relationshipTableFacts(input:Project,options:{publicMode?:boolean;repositoryId?:string}={}):RelationshipTableFacts{
 const p=overviewProjection(input,options.publicMode??false),explicit=options.repositoryId!==undefined,scope=explicit?'repository' as const:'project' as const;
 const empty=():RelationshipTableFacts=>({projectId:p.id,revision:p.revision,scope,state:'unavailable',rows:[],views:[],total:0});
 if(explicit&&!p.atlas?.snapshots.find(s=>s.id===p.atlas?.activeSnapshotId)?.repositories.some(r=>r.id===options.repositoryId))return empty();
 const scoped=repositoryOutputFacts(p,options.repositoryId),nodes=new Map(scoped.nodes.map(n=>[n.id,n])),sources=new Map(p.sources.map(s=>[s.id,s]));
 const rows:RelationshipTableRow[]=scoped.edges.flatMap(e=>{
  const source=nodes.get(e.source),target=nodes.get(e.target);if(!source||!target)return [];
  const ids=[...new Set([...source.sourceIds,...target.sourceIds])];
  return [{id:e.id,source:{id:source.id,label:source.label},target:{id:target.id,label:target.label},label:e.label,kind:e.kind,basis:e.basis??'unspecified',...(e.quantity?{quantity:{...e.quantity}}:{}),
   views:p.views.filter(v=>v.edgeIds.includes(e.id)).map(v=>({id:v.id,title:v.title})),
   endpointSources:ids.flatMap(id=>{const s=sources.get(id);return s?[{id:s.id,title:s.title,location:s.location}]:[];})}];
 });
 const edgeIds=new Set(rows.map(e=>e.id)),views=p.views.flatMap(v=>{const count=v.edgeIds.filter(id=>edgeIds.has(id)).length;return count?[{id:v.id,title:v.title,connectionCount:count}]:[];});
 return {projectId:p.id,revision:p.revision,scope,state:'available',rows,views,total:rows.length};
}

/** Transient pointers for read-only inspection, not a document, permission or saved selection format. */
export type ConnectionInspectionTarget={projectId:string;revision:number;viewId:string;edgeId:string};
export type ConnectionInspectionFacts={state:'unavailable'}|{state:'available';projectId:string;revision:number;view:{id:string;title:string};row:RelationshipTableRow};
export const CONNECTION_INSPECTION_UNAVAILABLE='This connection is unavailable in the current permitted view.';
/** Resolve current permitted membership before asking the existing row producer for any connection facts. */
export function connectionInspectionFacts(input:Project,target:ConnectionInspectionTarget,options:{publicMode?:boolean}={}):ConnectionInspectionFacts{
 const p=overviewProjection(input,options.publicMode??false);
 if(target.projectId!==p.id||target.revision!==p.revision)return {state:'unavailable'};
 const view=p.views.find(view=>view.id===target.viewId),edge=p.edges.find(edge=>edge.id===target.edgeId);
 if(!view||!edge||!pathTo(p,view.id).length||!view.edgeIds.includes(edge.id)||
  !view.nodeIds.includes(edge.source)||!view.nodeIds.includes(edge.target)||
  !p.nodes.some(node=>node.id===edge.source)||!p.nodes.some(node=>node.id===edge.target))return {state:'unavailable'};
 const row=relationshipTableFacts(p).rows.find(row=>row.id===edge.id);
 return row?{state:'available',projectId:p.id,revision:p.revision,view:{id:view.id,title:view.title},row}:{state:'unavailable'};
}
