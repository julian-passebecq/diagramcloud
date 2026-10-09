import type {Project} from '../core/model';
import {overviewProjection} from '../export/projectOverview';
import {perspectiveOf, repositoryOf} from '../core/viewspec';
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
