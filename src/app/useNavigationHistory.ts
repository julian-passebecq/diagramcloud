import {useEffect,useRef,useState} from 'react';
import type {Project} from '../core/model';

export type NavigationSheet='diagram'|'overview'|'structure'|'relationships'|'evidence';
export type NavigationEntry={path:string[];view:string;selected:string|null;selectedEdge:string|null;sheet:NavigationSheet};
export type NavigationHistoryState={scope:string;entries:NavigationEntry[];index:number};
export const NAVIGATION_UNAVAILABLE_MESSAGE='This navigation target is unavailable in the current permitted context.';
const sheets:NavigationSheet[]=['diagram','overview','structure','relationships','evidence'];
const stableId=(value:unknown):value is string=>typeof value==='string'&&/^[a-z][a-z0-9_.-]{0,79}$/.test(value);
const scopeOf=(projectId:string,publicMode:boolean)=>JSON.stringify([projectId,publicMode?'public':'author']);
export function createNavigationHistory(projectId:string,publicMode:boolean):NavigationHistoryState{return {scope:scopeOf(projectId,publicMode),entries:[],index:-1};}

/** Internal session IDs only. The caller supplies the current already permitted document, never a historical snapshot. */
export function resolveNavigationEntry(doc:Project,input:unknown):NavigationEntry|undefined{
 if(!input||typeof input!=='object'||Array.isArray(input))return;
 const e=input as Record<string,unknown>,keys=['path','view','selected','selectedEdge','sheet'];
 if(Object.keys(e).length!==keys.length||keys.some(key=>!Object.hasOwn(e,key))||!Array.isArray(e.path)||!e.path.length||e.path.length>doc.views.length||!e.path.every(stableId)||new Set(e.path).size!==e.path.length||e.path[0]!==doc.rootViewId||!stableId(e.view)||!e.path.includes(e.view)||!sheets.includes(e.sheet as NavigationSheet))return;
 if((e.selected!==null&&!stableId(e.selected))||(e.selectedEdge!==null&&!stableId(e.selectedEdge))||(e.selected!==null&&e.selectedEdge!==null))return;
 const path=e.path as string[];
 const views=new Map(doc.views.map(v=>[v.id,v])),nodes=new Map(doc.nodes.map(n=>[n.id,n]));
 for(let i=0;i<path.length;i++){
  const view=views.get(path[i]);if(!view)return;
  // Verify the exact recorded chain; pathToView's [target] fallback is not reachability evidence.
  if(i+1<path.length&&!view.nodeIds.some(id=>nodes.get(id)?.childViewId===path[i+1]))return;
 }
 const active=views.get(e.view)!;
 if(e.selected!==null&&(!nodes.has(e.selected as string)||!active.nodeIds.includes(e.selected as string)))return;
 if(e.selectedEdge!==null){const edge=doc.edges.find(edge=>edge.id===e.selectedEdge);if(!edge||!active.edgeIds.includes(edge.id)||!active.nodeIds.includes(edge.source)||!active.nodeIds.includes(edge.target))return;}
 // activeView may be an ancestor: a selected parent can already have its child open.
 return {path:[...path],view:e.view,selected:e.selected as string|null,selectedEdge:e.selectedEdge as string|null,sheet:e.sheet as NavigationSheet};
}
const equal=(a:NavigationEntry,b:NavigationEntry)=>a.view===b.view&&a.selected===b.selected&&a.selectedEdge===b.selectedEdge&&a.sheet===b.sheet&&a.path.length===b.path.length&&a.path.every((id,index)=>id===b.path[index]);
/** Copy only canonical pointers; authoring history, preferences and Pin remain separate. */
export function recordNavigationEntry(state:NavigationHistoryState,doc:Project,publicMode:boolean,input:NavigationEntry):NavigationHistoryState{
 const scoped=state.scope===scopeOf(doc.id,publicMode)?state:createNavigationHistory(doc.id,publicMode),entry=resolveNavigationEntry(doc,input);
 if(!entry)return scoped;
 const previous=scoped.entries[scoped.index];if(previous&&equal(previous,entry))return scoped;
 const entries=[...scoped.entries.slice(0,scoped.index+1),entry].slice(-50);return {scope:scoped.scope,entries,index:entries.length-1};
}
export function moveNavigationHistory(state:NavigationHistoryState,doc:Project,publicMode:boolean,delta:-1|1):{history:NavigationHistoryState;state:'unchanged'|'unavailable'|'restored';entry?:NavigationEntry}{
 if(state.scope!==scopeOf(doc.id,publicMode))return {history:createNavigationHistory(doc.id,publicMode),state:'unchanged'};
 const index=state.index+delta;if((delta!==-1&&delta!==1)||index<0||index>=state.entries.length)return {history:state,state:'unchanged'};
 const entry=resolveNavigationEntry(doc,state.entries[index]);
 if(!entry){
  const entries=state.entries.filter((_,i)=>i!==index);return {history:{scope:state.scope,entries,index:state.index-(index<state.index?1:0)},state:'unavailable'};
 }
 return {history:{...state,index},state:'restored',entry};
}

/** Session-only return context. Scope reset happens synchronously, before flags or a stale callback can use old entries. */
export function useNavigationHistory(project:Project,publicMode:boolean,current:NavigationEntry,onRestore:(entry:NavigationEntry)=>void,onUnavailable?:()=>void){
 const scope=scopeOf(project.id,publicMode),history=useRef(createNavigationHistory(project.id,publicMode));
 if(history.current.scope!==scope)history.current=createNavigationHistory(project.id,publicMode);
 const live=useRef({project,publicMode,current,onRestore,onUnavailable});live.current={project,publicMode,current,onRestore,onUnavailable};
 const [,refresh]=useState(0);
 useEffect(()=>{
  const active=live.current,next=recordNavigationEntry(history.current,active.project,active.publicMode,active.current);
  if(next!==history.current){history.current=next;refresh(value=>value+1);}
 },[scope,project,current.path,current.view,current.selected,current.selectedEdge,current.sheet]);
 const go=(delta:-1|1)=>{
  const active=live.current,previous=history.current,out=moveNavigationHistory(previous,active.project,active.publicMode,delta);history.current=out.history;
  if(out.state==='restored')active.onRestore(out.entry!);else if(out.state==='unavailable')active.onUnavailable?.();
  if(out.history!==previous)refresh(value=>value+1);
 };
 return {go,canBack:history.current.index>0,canForward:history.current.index<history.current.entries.length-1};
}
