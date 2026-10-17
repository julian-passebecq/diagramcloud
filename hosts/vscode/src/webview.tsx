/** Webview side of the standalone viewer: renders the public viewer, forwards intents, applies host selections. */
import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DiagramCloudViewer} from '../../../src/react';
import type {ToWebview,ViewerOpen} from './hostCore';

declare function acquireVsCodeApi():{postMessage(message:unknown):void};
const host=acquireVsCodeApi();

function ViewerHost(){
 const [open,setOpen]=useState<ViewerOpen|null>(null);
 useEffect(()=>{
  const receive=(event:MessageEvent)=>{const message=event.data as ToWebview|null;if(!message||typeof message!=='object')return;
   if(message.type==='open')setOpen(message);
   // A host selection only applies to the session it was made for.
   if(message.type==='select')setOpen(old=>old&&old.selection.projectId===message.selection.projectId?{...old,selection:message.selection}:old);};
  window.addEventListener('message',receive);host.postMessage({type:'ready'});return()=>window.removeEventListener('message',receive);
 },[]);
 if(!open)return <p role="status">Waiting for a DiagramCloud document.</p>;
 return <DiagramCloudViewer key={open.session.sessionId} label={`DiagramCloud viewer: ${open.title}`.slice(0,160)} apiVersion={1} document={open.document} allowedViewIds={open.allowedViewIds} selection={open.selection} session={open.session}
  onSelectionChange={intent=>host.postMessage({type:'select',intent})} onNavigateView={intent=>host.postMessage({type:'select',intent})} onOpenSource={intent=>host.postMessage({type:'source',intent})}
  onReturn={intent=>host.postMessage({type:'return',intent})}/>;
}
createRoot(document.getElementById('diagramcloud-root')!).render(<ViewerHost/>);
