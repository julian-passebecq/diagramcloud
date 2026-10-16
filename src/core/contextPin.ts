import type {Project} from './model';

/** Session-only pointers: no copied facts, access grants, revision snapshot or persisted Project field. */
export type ContextPin={projectId:string;viewId?:string;nodeId?:string};
export type ContextSelection={viewId?:string;nodeId?:string};
export type ContextPinResolution={state:'available';selection:ContextSelection}|{state:'unavailable'};
const stableId=(value:unknown):value is string=>typeof value==='string'&&/^[a-z][a-z0-9_.-]{0,79}$/.test(value);

/** Resolve only against the caller's already permitted projection. Never grants access or navigates. */
export function resolveContextPin(project:Project,input:unknown):ContextPinResolution{
 if(!input||typeof input!=='object'||Array.isArray(input))return {state:'unavailable'};
 const pin=input as Record<string,unknown>;
 if(Object.keys(pin).some(key=>!['projectId','viewId','nodeId'].includes(key))||pin.projectId!==project.id||!stableId(pin.projectId)||
  (pin.viewId!==undefined&&!stableId(pin.viewId))||(pin.nodeId!==undefined&&!stableId(pin.nodeId)))return {state:'unavailable'};
 const view=pin.viewId===undefined?undefined:project.views.find(v=>v.id===pin.viewId);
 const node=pin.nodeId===undefined?undefined:project.nodes.find(n=>n.id===pin.nodeId);
 if((pin.viewId!==undefined&&!view)||(pin.nodeId!==undefined&&!node)||(view&&node&&!view.nodeIds.includes(node.id)))return {state:'unavailable'};
 if(node&&!project.views.some(v=>v.nodeIds.includes(node.id)))return {state:'unavailable'};
 return {state:'available',selection:{...(view?{viewId:view.id}:{}),...(node?{nodeId:node.id}:{})}};
}

export function pinContext(project:Project,selection:ContextSelection):ContextPin|undefined{
 const candidate={projectId:project.id,...(selection.viewId!==undefined?{viewId:selection.viewId}:{}),...(selection.nodeId!==undefined?{nodeId:selection.nodeId}:{})};
 return resolveContextPin(project,candidate).state==='available'?candidate:undefined;
}
