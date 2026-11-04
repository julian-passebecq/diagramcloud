import type {Project,ProjectEdge,ProjectNode} from '../core/model';
import {publicDocument} from '../core/operations';
import {resolveContextPin} from '../core/contextPin';
import {selectionContext} from '../intelligence/navigation';

export type ContextPaneSelection={selectedViewId?:string;selectedNodeId?:string|null;hoveredViewId?:string|null;hoveredNodeId?:string|null;pinned:boolean;unavailable?:boolean};
export type ContextFlow={edge:ProjectEdge;direction:'input'|'output'|'loop';other:ProjectNode;destinations:{viewId:string;title:string;nodeId:string}[]};
/** Read-only detail projection: public filtering happens before selection, membership, counts and evidence. */
export function contextPaneFacts(input:Project,publicMode:boolean,selection:ContextPaneSelection){
 const doc=publicMode?publicDocument(input):input;
 const selected={...(selection.selectedViewId?{viewId:selection.selectedViewId}:{}),...(selection.selectedNodeId?{nodeId:selection.selectedNodeId}:{})};
 const hovered=selection.hoveredNodeId?{nodeId:selection.hoveredNodeId,...(selection.hoveredViewId?{viewId:selection.hoveredViewId}:{})}:null;
 const canResolve=(value:{nodeId?:string;viewId?:string})=>resolveContextPin(doc,{projectId:doc.id,...value}).state==='available';
 const preview=!selection.pinned&&hovered&&canResolve(hovered)?hovered:null;
 const target=preview??selected;
 const available=!selection.unavailable&&canResolve(target);
 const context=available?selectionContext(doc,target):null;
 const node=context?.node;
 const memberships=node?doc.views.filter(v=>v.nodeIds.includes(node.id)):[];
 const flows:ContextFlow[]=node?doc.edges.filter(e=>e.source===node.id||e.target===node.id).flatMap(edge=>{
  const direction=edge.source===node.id&&edge.target===node.id?'loop' as const:edge.target===node.id?'input' as const:'output' as const;
  const other=doc.nodes.find(n=>n.id===(direction==='input'?edge.source:edge.target));if(!other)return [];
  const destinations=doc.views.filter(v=>v.nodeIds.includes(other.id)).map(v=>({viewId:v.id,title:v.title,nodeId:other.id}));
  destinations.sort((a,b)=>Number(b.viewId===target.viewId)-Number(a.viewId===target.viewId));
  return [{edge,direction,other,destinations}];
 }):[];
 return {doc,available,preview:!!preview,pinned:selection.pinned,selection:target,context,node,memberships,flows,
  inputs:flows.filter(f=>f.direction==='input'),outputs:flows.filter(f=>f.direction==='output'),loops:flows.filter(f=>f.direction==='loop'),
  childView:node?.childViewId?doc.views.find(v=>v.id===node.childViewId):undefined};
}
