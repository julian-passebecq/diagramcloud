/** Webview side of the standalone viewer: renders the public viewer, forwards intents, applies host selections. */
import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DiagramCloudViewer} from '../../../src/react';
import type {ToWebview,ViewerOpen,ViewerRefused} from './hostCore';

declare function acquireVsCodeApi():{postMessage(message:unknown):void};
const host=acquireVsCodeApi();

/** The host refused a return: say why, and offer the refused intent, unchanged, as a return file saved by the host. */
function Refusal({refused,onDismiss}:{refused:ViewerRefused;onDismiss:()=>void}){
 const [asked,setAsked]=useState(false);
 return <section role="alert" aria-label="Host refused the return" className="viewer-refusal">
  <p>{refused.via==='file'?'Return file: ':''}{refused.reason}</p>
  {refused.saveId?<><p>The refused intent is kept unchanged. Saving it as a return file does not resend it: this host refuses it again for the same reason.</p>
   <button type="button" disabled={asked} onClick={()=>{setAsked(true);host.postMessage({type:'saveReturn',saveId:refused.saveId});}}>Download return file</button></>
   :<p>Nothing to download: the input was not a return intent.</p>}
  <button type="button" onClick={onDismiss}>Dismiss</button>
 </section>;
}

function ViewerHost(){
 const [open,setOpen]=useState<ViewerOpen|null>(null),[refused,setRefused]=useState<ViewerRefused|null>(null);
 useEffect(()=>{
  const receive=(event:MessageEvent)=>{const message=event.data as ToWebview|null;if(!message||typeof message!=='object')return;
   if(message.type==='open'){setOpen(message);setRefused(null);}
   // A host selection only applies to the session it was made for.
   if(message.type==='select')setOpen(old=>old&&old.selection.projectId===message.selection.projectId?{...old,selection:message.selection}:old);
   if(message.type==='refused'&&typeof message.reason==='string')setRefused({type:'refused',refusal:message.refusal,reason:message.reason,via:message.via==='file'?'file':'live',...(typeof message.saveId==='string'?{saveId:message.saveId}:{})});};
  window.addEventListener('message',receive);host.postMessage({type:'ready'});return()=>window.removeEventListener('message',receive);
 },[]);
 if(!open)return <p role="status">Waiting for a DiagramCloud document.</p>;
 return <>{refused&&<Refusal key={(refused.saveId??'')+refused.reason} refused={refused} onDismiss={()=>setRefused(null)}/>}
  <DiagramCloudViewer key={open.session.sessionId} label={`DiagramCloud viewer: ${open.title}`.slice(0,160)} apiVersion={1} document={open.document} allowedViewIds={open.allowedViewIds} selection={open.selection} session={open.session}
  onSelectionChange={intent=>host.postMessage({type:'select',intent})} onNavigateView={intent=>host.postMessage({type:'select',intent})} onOpenSource={intent=>host.postMessage({type:'source',intent})}
  onReturn={intent=>host.postMessage({type:'return',intent})}/></>;
}
createRoot(document.getElementById('diagramcloud-root')!).render(<ViewerHost/>);
