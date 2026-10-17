import {useLayoutEffect,useId,useMemo,useRef} from 'react';
import {ReactFlowProvider} from '@xyflow/react';
import {DiagramCanvas} from '../ui/Canvas';
import {architectureSvg} from '../export/design/architecture';
import {prepareViewer,VIEWER_UNAVAILABLE,liveViewerBoundary,viewerContextText,viewerSelectionIntent,viewerSourceIntent,type ViewerBoundary,type ViewerInput,type ViewerReady,type ViewerSelection,type ViewerSelectionIntent,type ViewerSourceIntent} from './viewerBoundary';
import {negotiateCapabilities,createReturnIntent,returnFileText,MAX_RETURN_BYTES,type HostReturnIntent,type HostReturnKind,type Negotiation,type ReturnTarget} from './hostSession';
import './viewer.css';

export type DiagramCloudViewerProps={document:unknown;apiVersion:1;allowedViewIds:readonly string[];selection:ViewerSelection;label?:string;onSelectionChange?:(intent:ViewerSelectionIntent)=>void;onNavigateView?:(intent:ViewerSelectionIntent)=>void;onOpenSource?:(intent:ViewerSourceIntent)=>void;
 /** Optional `diagramcloud.host-session/1` offer. Without it the viewer has no host session and stays read-only. */
 session?:unknown;
 /** Receives guarded `diagramcloud.host-return/1` intents for the negotiated session. Never applied by the viewer. */
 onReturn?:(intent:HostReturnIntent)=>void};
const noEdit=()=>{};
const PROPS=['document','apiVersion','allowedViewIds','selection','label','onSelectionChange','onNavigateView','onOpenSource','session','onReturn'];
const bytes=(text:string)=>new TextEncoder().encode(text).byteLength;
/** Public SVG of the selected view of the already-public viewer closure, or undefined when it cannot be drawn. */
function renderPayload(ready:ViewerReady):string|undefined{try{const svg=architectureSvg(ready.project,ready.selection.viewId,{theme:'light'});return bytes(svg)<=MAX_RETURN_BYTES?svg:undefined;}catch{return undefined;}}
function saveText(text:string,name:string){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export function DiagramCloudViewer(props:DiagramCloudViewerProps){
 const instance=Array.from(useId(),character=>character.codePointAt(0)!.toString(16)).join('-'),input=useMemo<ViewerInput>(()=>({document:props.document,apiVersion:props.apiVersion,allowedViewIds:props.allowedViewIds,selection:props.selection}),[props.document,props.apiVersion,props.allowedViewIds,props.selection]);
 const validProps=!Object.keys(props).some(key=>!PROPS.includes(key))&&[props.onSelectionChange,props.onNavigateView,props.onOpenSource,props.onReturn].every(callback=>callback===undefined||typeof callback==='function')&&(props.label===undefined||typeof props.label==='string'&&props.label.length>0&&props.label.length<=160);
 const boundary=useMemo<ViewerBoundary>(()=>validProps?prepareViewer(input):{state:'unavailable',message:VIEWER_UNAVAILABLE},[input,validProps]);
 const negotiation=useMemo<Negotiation|undefined>(()=>props.session===undefined?undefined:negotiateCapabilities(props.session),[props.session]);
 const capture=useMemo(()=>({input,boundary,select:props.onSelectionChange,navigate:props.onNavigateView,source:props.onOpenSource,session:negotiation,ret:props.onReturn,alive:true}),[input,boundary,props.onSelectionChange,props.onNavigateView,props.onOpenSource,negotiation,props.onReturn]);
 const live=useRef(capture);live.current=capture;
 useLayoutEffect(()=>{capture.alive=true;return()=>{capture.alive=false;};},[capture]);
 const current=()=>live.current===capture&&capture.alive&&capture.boundary.state==='ready'?liveViewerBoundary(capture.boundary,live.current.input):undefined;
 const select=(viewId:string,nodeId?:string,edgeId?:string)=>{if(!capture.select||!current()||capture.boundary.state!=='ready')return;const intent=viewerSelectionIntent(capture.boundary,live.current.input,{projectId:capture.boundary.project.id,baseRevision:capture.boundary.project.revision,viewId,...(nodeId?{nodeId}:{}),...(edgeId?{edgeId}:{})});if(intent&&live.current===capture&&capture.alive)capture.select(intent);};
 const navigate=(viewId:string)=>{if(!capture.navigate||!current()||capture.boundary.state!=='ready')return;const intent=viewerSelectionIntent(capture.boundary,live.current.input,{projectId:capture.boundary.project.id,baseRevision:capture.boundary.project.revision,viewId});if(intent&&live.current===capture&&capture.alive)capture.navigate(intent);};
 const source=(sourceId:string)=>{if(!capture.source||!current()||capture.boundary.state!=='ready')return;const intent=viewerSourceIntent(capture.boundary,live.current.input,sourceId);if(intent&&live.current===capture&&capture.alive)capture.source(intent);};
 const file=()=>{if(!current()||capture.boundary.state!=='ready')return;const text=viewerContextText(capture.boundary,live.current.input);if(text===undefined)return;saveText(text,'diagramcloud.selected-context.public.json');};
 // Host-session returns: built from the live, revalidated boundary at delivery; a disposed or replaced viewer emits nothing.
 const returnIntent=(kind:HostReturnKind):HostReturnIntent|undefined=>{
  const ready=current(),session=capture.session;if(!ready||session?.state!=='ready')return undefined;
  const target:ReturnTarget={...ready.selection};
  const payload=kind==='query'?viewerContextText(ready,live.current.input):kind==='render'?renderPayload(ready):undefined;
  if((kind==='query'||kind==='render')&&payload===undefined)return undefined;
  return createReturnIntent(session,kind,target,payload);
 };
 const sendReturn=(kind:HostReturnKind)=>{if(!capture.ret)return;const intent=returnIntent(kind);if(intent&&live.current===capture&&capture.alive)capture.ret(intent);};
 const returnFile=()=>{const intent=returnIntent('selection');if(intent&&live.current===capture&&capture.alive)saveText(returnFileText(intent),'diagramcloud.host-return.json');};
 if(boundary.state!=='ready')return <section className="diagramcloud-viewer" aria-label={typeof props.label==='string'&&props.label.length<=160?props.label:'DiagramCloud public viewer'}><p role="status">{boundary.message}</p></section>;
 const selectedView=boundary.project.views.find(v=>v.id===boundary.selection.viewId)!,selectedNode=boundary.project.nodes.find(n=>n.id===boundary.selection.nodeId),contextText=viewerContextText(boundary,input);
 const session=negotiation?.state==='ready'?negotiation:undefined,granted=(capability:'query'|'render')=>!!session?.granted.includes(capability);
 return <section className="diagramcloud-viewer" aria-label={props.label??'DiagramCloud public viewer'} data-api-version="1"><p>Public read-only viewer · document revision {boundary.project.revision}. Designed status is not observed runtime. The host controls selection.</p><p>Repository revision vectors, deployment/workspace context and custom artwork are not included in this public viewer.</p>
 <p role="status">Selection requests {props.onSelectionChange?'available':'unavailable'} · view navigation {props.onNavigateView?'available':'unavailable'} · source opening {props.onOpenSource?'available':'unavailable'}.</p>
 {negotiation&&<section className="viewer-session" aria-label="Host session">{negotiation.state==='refused'?<p role="status">{negotiation.reason}</p>:<>
  <p role="status">Host session {negotiation.sessionId} · project {boundary.project.id} · document revision {boundary.project.revision} · audience public · granted: {negotiation.granted.length?negotiation.granted.join(', '):'none (read-only)'}.</p>
  {negotiation.refused.length>0&&<ul aria-label="Capabilities not granted">{negotiation.refused.map(r=><li key={r.capability}>{r.capability}: {r.reason}</li>)}</ul>}
  <p>Returns carry this exact project, document revision, audience and session, once each. The host may refuse any of them; nothing is applied here.</p>
  <div className="viewer-intents"><button type="button" disabled={!props.onReturn} onClick={()=>sendReturn('selection')}>Return selected context to host</button>
  <button type="button" disabled={!props.onReturn||!granted('query')||contextText===undefined} onClick={()=>sendReturn('query')}>Ask host about this context</button>
  <button type="button" disabled={!props.onReturn||!granted('render')} onClick={()=>sendReturn('render')}>Return public SVG of this view</button>
  <button type="button" onClick={returnFile}>Download return file</button></div></>}</section>}
 {boundary.path.map((viewId,index)=>{const view=boundary.project.views.find(v=>v.id===viewId)!;return <ReactFlowProvider key={viewId}><DiagramCanvas doc={boundary.project} view={view} level={index} canvasId={`dc-viewer-${instance.length}-${instance}-canvas-${index}`} genericIcons strictControlledSelection selected={boundary.selection.viewId===viewId?boundary.selection.nodeId??null:null} selectedEdge={boundary.selection.viewId===viewId?boundary.selection.edgeId??null:null} edit={false} motion={false} trace="none" highlights={[]} onSelect={(nodeId,id)=>select(id,nodeId)} onEdge={(edgeId,id)=>select(id,undefined,edgeId)} onMove={noEdit} onConnect={noEdit} onGrid={noEdit} onAdd={noEdit}/></ReactFlowProvider>;})}
 <details><summary>Selected public context</summary><p>View: {selectedView.title}. Scope: {boundary.context.scope}. No whole-project fallback.</p>
 <div className="viewer-intents" aria-label="Permitted selection requests">{selectedView.nodeIds.map(id=><button type="button" key={id} disabled={!props.onSelectionChange} aria-pressed={boundary.selection.nodeId===id} onClick={()=>select(selectedView.id,id)}>Select {boundary.project.nodes.find(n=>n.id===id)!.label}</button>)}{selectedView.edgeIds.map(id=><button type="button" key={id} disabled={!props.onSelectionChange} aria-pressed={boundary.selection.edgeId===id} onClick={()=>select(selectedView.id,undefined,id)}>Select connection {id}</button>)}</div>
 {selectedNode?.childViewId&&<button type="button" disabled={!props.onNavigateView} onClick={()=>navigate(selectedNode.childViewId!)}>Open child view {boundary.project.views.find(v=>v.id===selectedNode.childViewId)!.title}</button>}
 {boundary.path.length>1&&<button type="button" disabled={!props.onNavigateView} onClick={()=>navigate(boundary.path[boundary.path.length-2])}>Open permitted parent view</button>}
 <ul>{boundary.context.components.map(n=><li key={n.id}><strong>{n.label}</strong><p>{n.summary||'Description not supplied.'}</p><p>Basis: {n.basis??'unknown'} · designed status: {n.status}</p></li>)}</ul>
 <ul aria-label="Selected public source citations">{boundary.context.sources.map(s=><li key={s.id}>{s.title}<button type="button" disabled={!props.onOpenSource} onClick={()=>source(s.id)}>Request source {s.id}</button></li>)}</ul>
 <p>The file is an inert request from the existing Completion Kit producer, with its source, safety and omission limits. Nothing is transmitted, and this viewer cannot apply responses.</p><button type="button" disabled={contextText===undefined} onClick={file}>Download selected public request</button>{contextText===undefined&&<p>{boundary.selection.edgeId?'File fallback unavailable for selected connections. Select an explicit component or view.':'Selected file unavailable under existing context safety and budget checks.'}</p>}
 </details></section>;
}
