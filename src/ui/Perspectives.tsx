import {useLayoutEffect,useMemo,useRef} from 'react';
import type {Project} from '../core/model';
import {perspectivesFor,pathTo,PERSPECTIVE_LABEL,type PerspectiveState} from '../core/viewspec';

const STATE_LABEL:Record<PerspectiveState,string>={available:'available',partial:'partial: a related view',unknown:'unknown for this component',unsupported:'not in this project'};

/**
 * The same component (same stable ID) through other perspectives. Only what the document contains: a perspective is
 * available, partial (a drilldown or parent view), unknown (the project has it, not for this component) or unsupported.
 */
export function PerspectiveStrip({doc,nodeId,onOpen}:{doc:Project;nodeId:string;onOpen:(viewId:string)=>void}){
 // The caller supplies the permitted document; no private/global source is consulted here.
 const scope=useMemo(()=>({doc,nodeId,onOpen,alive:true}),[doc,nodeId,onOpen]),current=useRef(scope);current.current=scope;
 useLayoutEffect(()=>{scope.alive=true;return()=>{scope.alive=false;};},[scope]);
 const list=perspectivesFor(doc,nodeId).map(item=>{const views=item.views.filter(view=>pathTo(doc,view.viewId).length>0);return {...item,views,state:item.views.length&&!views.length?'unknown' as const:item.state};});
 const open=(perspective:typeof list[number]['perspective'],viewId:string)=>{
  if(current.current!==scope||!scope.alive)return;
  const supplied=perspectivesFor(scope.doc,scope.nodeId).find(item=>item.perspective===perspective);
  if(!supplied?.views.some(view=>view.viewId===viewId)||!pathTo(scope.doc,viewId).length)return;
  scope.onOpen(viewId);
 };
 return <section className="perspective-strip" aria-label="Perspectives">
  <div className="eyebrow">PERSPECTIVES</div>
  <div className="perspective-chips">{list.map(item=>{const target=item.views[0],name=PERSPECTIVE_LABEL[item.perspective],label=`${name}: ${STATE_LABEL[item.state]}${item.views.length>1?` (${item.views.length} views)`:''}`;
   if(item.views.length>1)return <details key={item.perspective} style={{minWidth:0,maxWidth:'100%'}}><summary className={`perspective-chip state-${item.state}`} aria-label={label} style={{cursor:'pointer'}}>{name} · choose view ({item.views.length})</summary><ul style={{margin:'6px 0',paddingLeft:18,maxWidth:'100%',overflowWrap:'anywhere'}}>{item.views.map(view=><li key={view.viewId}><button type="button" style={{maxWidth:'100%',whiteSpace:'normal',overflowWrap:'anywhere',textAlign:'left'}} onClick={()=>open(item.perspective,view.viewId)}>{view.title} · {view.viewId}</button></li>)}</ul></details>;
   return target?<button key={item.perspective} type="button" className={`perspective-chip state-${item.state}`} title={`${label}. Open “${target.title}”.`} aria-label={label} onClick={()=>open(item.perspective,target.viewId)}>{name}</button>
    :<span key={item.perspective} className={`perspective-chip state-${item.state}`} title={label} aria-label={label}>{name}</span>;})}</div>
 </section>;
}
