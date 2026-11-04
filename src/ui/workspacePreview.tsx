import {createContext,useContext,useMemo,useSyncExternalStore,type ReactNode} from 'react';
import type {Project} from '../core/model';
import {publicDocument} from '../core/operations';

/** Ephemeral permitted pointers only. Never a route, document patch or saved selection. */
export type WorkspacePreviewTarget=Readonly<{nodeId?:string;viewId?:string}>;
export type WorkspacePreviewActions={preview:(target:WorkspacePreviewTarget)=>()=>void;clear:()=>void};
const EMPTY:WorkspacePreviewTarget|null=null;
const noop=()=>{};
const noActions:WorkspacePreviewActions={preview:()=>noop,clear:noop};
const same=(a:WorkspacePreviewTarget|null,b:WorkspacePreviewTarget|null)=>a===b||!!a&&!!b&&a.nodeId===b.nodeId&&a.viewId===b.viewId;

/** Caller supplies a Project cut. Public projection precedes IDs and membership checks.
 * Leases prevent a delayed pointer leave from clearing a newer keyboard preview.
 * A new store is required for a new object/audience cut, including same-revision edits.
 */
export function createWorkspacePreviewStore(input:Project,publicMode=false){
 const project=publicMode?publicDocument(input):input;
 const nodes=new Set(project.nodes.map(n=>n.id)),views=new Map(project.views.map(v=>[v.id,new Set(v.nodeIds)]));
 let snapshot:WorkspacePreviewTarget|null=EMPTY,sequence=0;
 const leases=new Map<number,WorkspacePreviewTarget>(),listeners=new Set<()=>void>();
 const publish=()=>{const next=Array.from(leases.values()).at(-1)??EMPTY;if(same(snapshot,next))return;snapshot=next;for(const listener of listeners)listener();};
 const actions:WorkspacePreviewActions={
  preview(target){
   const {nodeId,viewId}=target;
   if((!nodeId&&!viewId)||(nodeId&&!nodes.has(nodeId))||(viewId&&!views.has(viewId))||(nodeId&&viewId&&!views.get(viewId)?.has(nodeId)))return noop;
   const token=++sequence;leases.set(token,Object.freeze({...nodeId?{nodeId}:{},...viewId?{viewId}:{}}));publish();
   let released=false;return()=>{if(released)return;released=true;leases.delete(token);publish();};
  },
  clear(){leases.clear();publish();}
 };
 return {actions,getSnapshot:()=>snapshot,getServerSnapshot:()=>EMPTY,subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}};
}
export type WorkspacePreviewStore=ReturnType<typeof createWorkspacePreviewStore>;
const PreviewContext=createContext<WorkspacePreviewStore|null>(null);
/** Publishing does not set provider/App state. Only subscribing leaf consumers rerender. */
export function WorkspacePreviewProvider({project,publicMode=false,children}:{project:Project;publicMode?:boolean;children:ReactNode}){
 const store=useMemo(()=>createWorkspacePreviewStore(project,publicMode),[project,publicMode]);
 return <PreviewContext.Provider value={store}>{children}</PreviewContext.Provider>;
}
const emptySubscribe=()=>noop,emptySnapshot=()=>EMPTY;
/** Outside an explicitly mounted workspace provider, preview is disabled. */
export function useWorkspacePreview():WorkspacePreviewTarget|null{
 const store=useContext(PreviewContext);
 return useSyncExternalStore(store?.subscribe??emptySubscribe,store?.getSnapshot??emptySnapshot,store?.getServerSnapshot??emptySnapshot);
}
/** Publisher-only hook: no snapshot subscription and therefore no hover-driven rerender. */
export function useWorkspacePreviewActions():WorkspacePreviewActions{return useContext(PreviewContext)?.actions??noActions;}
