import type {Project,ProjectView} from '../core/model';
import {graphRows,readGraphHistory,type GraphFilter} from './graphSnapshot';

export type GraphProjectionOptions={filter:GraphFilter;collapsed:string[]};
/** A transient rendering projection. IDs, authoring memberships and positions
 * remain untouched. Collapsed assertions retain their IDs and expose their
 * original endpoints; they never become additional semantic relationships. */
export function graphProjection(project:Project,view:ProjectView,options:GraphProjectionOptions){
 const generation=readGraphHistory(project).at(-1);
 if(!generation||!view.id.startsWith('graph-')||view.id==='graph-root')return {project,view,groups:[],collapsedEdges:new Map<string,{from:string;to:string}>(),hidden:0};
 const rows=graphRows(project,options.filter),allowed=new Set(rows.nodes.map(n=>n.localId));
 const imported=new Set(generation.nodes.map(n=>n.localId));
 const members=view.nodeIds.filter(id=>!imported.has(id)||allowed.has(id));
 const memberSet=new Set(members),byExternal=new Map(generation.nodes.map(n=>[n.externalId,n]));
 const groupMap=new Map<string,string[]>();
 for(const n of generation.nodes)if(memberSet.has(n.localId)){
  for(const key of [...n.groups,...(n.parent?['parent:'+n.parent]:[])])groupMap.set(key,[...(groupMap.get(key)??[]),n.localId]);
 }
 const groups=[...groupMap].filter(([,ids])=>ids.length>1).map(([id,ids])=>{
  const parent=id.startsWith('parent:')?byExternal.get(id.slice(7))?.localId:undefined;
  const representative=parent&&memberSet.has(parent)?parent:ids.find(local=>generation.nodes.find(n=>n.localId===local)?.kind==='project')??ids[0];
  return {id,ids,representative,label:id.startsWith('parent:')?project.nodes.find(n=>n.id===parent)?.label??id.slice(7):id};
 });
 const representative=new Map(members.map(id=>[id,id]));
 // Stable order resolves overlapping groups without losing or duplicating a card.
 const resolve=(id:string)=>{const seen=new Set<string>();while(representative.get(id)&&representative.get(id)!==id&&!seen.has(id)){seen.add(id);id=representative.get(id)!;}return id;};
 for(const group of groups)if(options.collapsed.includes(group.id)){const anchor=resolve(group.representative);for(const id of group.ids)if(representative.get(id)===id)representative.set(id,anchor);}
 const visible=new Set(members.map(resolve)),assertionIds=new Set(rows.assertions.map(a=>a.localId)),importedEdges=new Set(generation.assertions.map(a=>a.localId));
 const collapsedEdges=new Map<string,{from:string;to:string}>();
 const edges=project.edges.filter(e=>view.edgeIds.includes(e.id)&&memberSet.has(e.source)&&memberSet.has(e.target)&&(!importedEdges.has(e.id)||assertionIds.has(e.id))).flatMap(e=>{
  const source=resolve(e.source),target=resolve(e.target);if(source===target&&(source!==e.source||target!==e.target))return [];
  if(source!==e.source||target!==e.target){collapsedEdges.set(e.id,{from:e.source,to:e.target});return [{...e,source,target,label:(e.label??'Connection')+' · collapsed endpoints'}];}return [e];
 });
 const projectedView={...view,nodeIds:members.filter(id=>visible.has(id)),edgeIds:edges.map(e=>e.id),positions:Object.fromEntries(members.filter(id=>visible.has(id)).map(id=>[id,view.positions[id]]).filter(([,p])=>p))} as ProjectView;
 return {project:{...project,edges:[...project.edges.filter(e=>!view.edgeIds.includes(e.id)),...edges]},view:projectedView,groups,collapsedEdges,hidden:view.nodeIds.length-projectedView.nodeIds.length};
}
