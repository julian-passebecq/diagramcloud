/**
 * Pure host logic of the standalone DiagramCloud VS Code / Cursor viewer (no `vscode` import, unit-tested).
 * The extension reads one DiagramCloud document chosen by the person, validates it, and sends the webview only its
 * public projection (publicDocument) with a `diagramcloud.host-session/1` offer. Every return from the webview passes
 * the host guard: wrong session, stale revision, replay, a kind this host has no route for, ungranted capability or a
 * closed panel are refused. A refusal keeps the original intent unchanged: the webview is told why and offered
 * "Download return file", which saves that same intent where the person chooses. Nothing is written to the document,
 * applied, published or sent over a network.
 */
import {validateDocument} from '../../../src/core/model';
import {publicDocument} from '../../../src/core/operations';
import {HOST_SESSION_FORMAT,negotiateCapabilities,parseReturnFile,retainedReturnFile,RETURN_REFUSAL_TEXT,type HostReturnKind,type HostSessionOffer,type ReturnBinding,type ReturnGuard,type ReturnRefusal} from '../../../src/react/hostSession';
import type {ViewerSelection} from '../../../src/react/viewerBoundary';

export type ViewerOpen={type:'open';document:unknown;session:HostSessionOffer;selection:ViewerSelection;allowedViewIds:string[];title:string};
/** A refusal shown in the webview. `saveId` is present when the refused input can be saved unchanged as a return file. */
export type ViewerRefused={type:'refused';refusal:ReturnRefusal;reason:string;via:'live'|'file';saveId?:string};
export type ToWebview=ViewerOpen|{type:'select';selection:ViewerSelection}|ViewerRefused;
/**
 * Return kinds this host routes. Source requests arrive through the viewer's own source message and are never opened
 * automatically, so a `source` return intent has no route here and is refused as `unsupported-route`.
 */
export const HOST_ROUTES:readonly HostReturnKind[]=['selection','navigate','query','render'];
export const RETAINED_FILE_NAME='diagramcloud.host-return.refused.json';
export const MAX_DOCUMENT_TEXT=8*1024*1024;
export const OPEN_REFUSED='DiagramCloud could not open this file: it is not a valid DiagramCloud document, or it has no public view.';

/** Validate the chosen file and build the webview's open message from its public projection only. */
export function openMessage(text:string,grants:readonly string[],sessionId:string):{ok:true;message:ViewerOpen;binding:ReturnBinding}|{ok:false;reason:string}{
 try{
  if(typeof text!=='string'||text.length>MAX_DOCUMENT_TEXT)return {ok:false,reason:OPEN_REFUSED};
  const project=publicDocument(validateDocument(JSON.parse(text) as unknown));if(!project.views.length)return {ok:false,reason:OPEN_REFUSED};
  const session:HostSessionOffer={format:HOST_SESSION_FORMAT,sessionId,audience:'public',grants:[...grants].slice(0,12)},negotiation=negotiateCapabilities(session);
  if(negotiation.state!=='ready')return {ok:false,reason:negotiation.reason};
  return {ok:true,message:{type:'open',document:project,session,selection:{projectId:project.id,baseRevision:project.revision,viewId:project.rootViewId},allowedViewIds:project.views.map(v=>v.id),title:project.title},
   binding:{sessionId,projectId:project.id,baseRevision:project.revision,audience:'public',granted:negotiation.granted,routes:HOST_ROUTES}};
 }catch{return {ok:false,reason:OPEN_REFUSED};}
}

/** `retain`: a refused intent the person may save unchanged (keyed by the webview's saveId). */
export type HostAction={reply?:ToWebview;show?:{language:'json'|'xml';content:string};retain?:{saveId:string;text:string};log:string;warn?:string};
const selectionOf=(i:{projectId:string;baseRevision:number;viewId:string;nodeId?:string;edgeId?:string}):ViewerSelection=>({projectId:i.projectId,baseRevision:i.baseRevision,viewId:i.viewId,...(i.nodeId?{nodeId:i.nodeId}:{}),...(i.edgeId?{edgeId:i.edgeId}:{})});

/** A return intent (live message or loaded file) through the guard, and what the host does with it. */
export function handleReturn(guard:ReturnGuard|undefined,input:unknown,via:'live'|'file'):HostAction{
 if(!guard)return {log:`${via}: ${RETURN_REFUSAL_TEXT.disposed}`,warn:RETURN_REFUSAL_TEXT.disposed};
 const verdict=guard.accept(input);
 if(!verdict.ok){
  const reason=RETURN_REFUSAL_TEXT[verdict.reason],text=retainedReturnFile(verdict),saveId=text?(verdict.retained as {intentId:string}).intentId:undefined;
  return {log:`${via}: ${reason}`,warn:reason,reply:{type:'refused',refusal:verdict.reason,reason,via,...(saveId?{saveId}:{})},...(saveId&&text?{retain:{saveId,text}}:{})};
 }
 const i=verdict.intent,where=`${i.projectId}@${i.baseRevision} ${i.viewId}${i.nodeId?' / '+i.nodeId:i.edgeId?' / '+i.edgeId:''}`;
 if(i.kind==='selection'||i.kind==='navigate')return {reply:{type:'select',selection:selectionOf(i)},log:`${via}: accepted ${i.kind} ${where}`};
 if(i.kind!=='query'&&i.kind!=='render')return {log:`${via}: ${RETURN_REFUSAL_TEXT['unsupported-route']}`,warn:RETURN_REFUSAL_TEXT['unsupported-route']};
 return {show:{language:i.kind==='render'?'xml':'json',content:i.payload!},log:`${via}: accepted ${i.kind} ${where}; opened as an untitled, unsaved document.`};
}
/** The file fallback: a `diagramcloud.host-return/1` file chosen by the person, through the same guard. */
export const handleReturnFile=(guard:ReturnGuard|undefined,text:string)=>handleReturn(guard,parseReturnFile(text),'file');

/** Refused intents kept for "Download return file": the most recent `max`, each saved at most once. */
export function createRetainedStore(max=8){
 const kept=new Map<string,string>();
 return {keep(saveId:string,text:string){kept.delete(saveId);kept.set(saveId,text);while(kept.size>max)kept.delete(kept.keys().next().value!);},
  take(saveId:unknown):string|undefined{if(typeof saveId!=='string')return undefined;const text=kept.get(saveId);kept.delete(saveId);return text;},
  clear(){kept.clear();},get size(){return kept.size;}};
}

/** A host-controlled selection request from a card click: same session binding, exact project and revision. */
export function handleSelectionRequest(guard:ReturnGuard|undefined,input:unknown):HostAction{
 if(!guard||guard.disposed)return {log:`selection: ${RETURN_REFUSAL_TEXT.disposed}`};
 const b=guard.binding,i=input as Partial<ViewerSelection>|null;
 if(!i||typeof i!=='object'||typeof i.viewId!=='string'||i.projectId!==b.projectId||i.baseRevision!==b.baseRevision)return {log:`selection: ${RETURN_REFUSAL_TEXT.stale}`};
 return {reply:{type:'select',selection:selectionOf(i as ViewerSelection)},log:`selection: ${i.projectId}@${i.baseRevision} ${i.viewId}${i.nodeId?' / '+i.nodeId:i.edgeId?' / '+i.edgeId:''}`};
}

/** Webview HTML: one nonce script, local style, no network (connect-src 'none'), no fonts, no remote images. */
export function webviewHtml(cspSource:string,scriptUri:string,styleUri:string,nonce:string):string{
 const attr=(s:string)=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
 if(!/^[A-Za-z0-9]{16,64}$/.test(nonce))throw new Error('Invalid nonce');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${attr(cspSource)} data:; style-src ${attr(cspSource)} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src 'none'; connect-src 'none'; frame-src 'none'; form-action 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${attr(styleUri)}"><title>DiagramCloud viewer</title><style>body{margin:0;padding:12px;background:#f4f6fa;color:#1b2b45;font-family:system-ui,sans-serif}</style></head><body><main id="diagramcloud-root"><p role="status">Waiting for a DiagramCloud document.</p></main><script nonce="${nonce}" src="${attr(scriptUri)}"></script></body></html>`;
}
