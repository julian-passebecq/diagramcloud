import type {Project} from '../core/model';
import {prepareConceptPreview,type ConceptPreview} from './conceptPreview';

export const CONCEPT_HOST_READY='diagramcloud.concept-host-ready';
export type ConceptHostHello={format:typeof CONCEPT_HOST_READY;version:1;projectionSha256:string;projectId:string;baseRevision:number;viewId:string};
/** Exact HTTP(S) origin only. Never accept a URL with a path, user info or opaque origin. */
export function conceptHostOrigin(value:unknown):string|null{
 if(typeof value!=='string')return null;
 try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&u.origin===value?value:null;}catch{return null;}
}
function canonical(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
 return JSON.stringify(value);
}
/** A supplied sidecar supplies only a timestamp. All content is rebuilt from the selected authorized document. */
export async function prepareConceptHostPacket(document:Project,viewId:string,audience:'public'|'author',candidate?:unknown):Promise<ConceptPreview>{
 let now:Date|undefined;
 if(candidate!==undefined){
  if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))throw new Error('Invalid preview packet.');
  const p=candidate as Record<string,unknown>;
  if(Object.keys(p).sort().join(',')!=='audience,baseRevision,format,generatedAt,projectId,projection,projectionSha256,version,viewId'||
   p.format!=='diagramcloud.concept-preview'||p.version!==1||p.projectId!==document.id||p.baseRevision!==document.revision||p.viewId!==viewId||p.audience!==audience||
   typeof p.generatedAt!=='string'||typeof p.projectionSha256!=='string'||!/^[a-f0-9]{64}$/.test(p.projectionSha256))throw new Error('Stale or invalid preview packet.');
  now=new Date(p.generatedAt);if(!Number.isFinite(now.getTime())||now.toISOString()!==p.generatedAt)throw new Error('Invalid preview timestamp.');
 }
 const fresh=await prepareConceptPreview(document,{projectId:document.id,baseRevision:document.revision,viewId},{audience,now});
 if(candidate!==undefined&&canonical(fresh)!==canonical(candidate))throw new Error('Preview packet differs from the authorized document projection.');
 return fresh;
}

const serialize=(value:unknown)=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
/** Static local helper. Viewer selection has no outbound API; mapping buttons are explicitly a separate action. */
export function conceptHostPage(packet:ConceptPreview,viewerOrigin:string,diagramcloudOrigin?:string):{html:string;script:string}{
 if(!conceptHostOrigin(viewerOrigin))throw new Error('Invalid viewer origin.');
 if(diagramcloudOrigin!==undefined&&!conceptHostOrigin(diagramcloudOrigin))throw new Error('Invalid authorized DiagramCloud origin.');
 const script=`'use strict';
const packet=${serialize(packet)},viewerOrigin=${serialize(viewerOrigin)},authorizedOpenerOrigin=${serialize(diagramcloudOrigin??null)};
const frame=document.getElementById('viewer'),status=document.getElementById('status'),mapping=document.getElementById('mapping');
const raw=new URLSearchParams(location.search).get('diagramcloudOrigin');let openerOrigin=null;
try{const u=new URL(raw);if(raw===authorizedOpenerOrigin&&['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&u.origin===raw)openerOrigin=raw;}catch{}
const hello={format:'diagramcloud.concept-host-ready',version:1,projectionSha256:packet.projectionSha256,projectId:packet.projectId,baseRevision:packet.baseRevision,viewId:packet.viewId};
if(openerOrigin&&window.opener)window.opener.postMessage(hello,openerOrigin);
document.getElementById('identity').textContent=packet.audience+' preview · '+packet.projectId+' · view '+packet.viewId+' · revision '+packet.baseRevision;
let listening=false,pending=false,queued=null;
let options={view:'layered',fit:true,chrome:'embed',theme:'light'};
function send(){if(!listening||pending||!queued)return;pending=true;const next=queued;queued=null;frame.contentWindow.postMessage({type:'datapass.concept-spec/load',spec:packet.projection.spec,options:next},viewerOrigin);status.textContent='Loading '+next.view+'…';}
function request(){queued={...options};send();}
window.addEventListener('message',e=>{
 if(e.origin!==viewerOrigin||e.source!==frame.contentWindow||!e.data||e.data.type!=='datapass.concept-spec/ready'||e.data.specVersion!=='1.0.0')return;
 if(!listening){listening=true;request();return;}
 if(!pending||!e.data.result||typeof e.data.result.ok!=='boolean')return;
 const result=e.data.result;pending=false;
 if(result.ok&&result.id===packet.projection.spec.id&&Array.isArray(result.warnings)){status.textContent='Viewer accepted '+result.id+' · '+result.warnings.length+' warning(s).';status.dataset.result='accepted';}
 else if(result.ok===false&&Array.isArray(result.issues)){status.textContent='Viewer rejected the projection · '+result.issues.length+' issue(s).';status.dataset.result='rejected';}
 else{status.textContent='Unexpected viewer result.';status.dataset.result='invalid';}
 send();
});
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{options.view=button.dataset.view;request();});
document.getElementById('fit').addEventListener('change',e=>{options.fit=e.target.checked;request();});
document.getElementById('theme').addEventListener('change',e=>{options.theme=e.target.value;request();});
for(const kind of ['node','flow']){
 const rows=kind==='node'?packet.projection.report.nodes:packet.projection.report.edges;
 const targets=kind==='node'?packet.projection.spec.nodes:packet.projection.spec.flows;
 for(const target of targets){
  const ids=[...new Set(rows.filter(r=>r.targetId===target.id&&r.state!=='omitted').map(r=>r.sourceId))];
  const button=document.createElement('button');button.textContent=kind+': '+target.label+' → '+ids.join(', ');button.dataset.kind=kind;button.dataset.targetId=target.id;
  button.disabled=ids.length!==1||!openerOrigin||!window.opener;
  if(ids.length!==1)button.title='Ambiguous mapping: inspect the mapping report; navigation is disabled.';
  button.addEventListener('click',()=>{if(!button.disabled)window.opener.postMessage({format:'diagramcloud.concept-pick',version:1,projectionSha256:packet.projectionSha256,kind,targetId:target.id},openerOrigin);});mapping.appendChild(button);
 }
}
setTimeout(()=>{if(!listening){status.textContent='Viewer did not become ready. Check the selected owner artifact and browser console.';status.dataset.result='timeout';}},15000);
`;
 const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>DiagramCloud local concept preview</title><style>body{font:15px system-ui;margin:16px;color:#17283c;background:#f5f7fb}header{display:flex;gap:12px;align-items:center;flex-wrap:wrap}button,select{font:inherit;padding:6px}iframe{display:block;width:100%;height:720px;border:1px solid #aab5c5;background:white}#mapping{display:flex;gap:8px;flex-wrap:wrap}p{max-width:1000px}button:focus-visible{outline:3px solid #1768ba}#status{min-height:24px}</style><h1>Local concept preview</h1><p id="identity"></p><header aria-label="Viewer display"><button data-view="layered">Layered 2D</button><button data-view="isometric">Isometric 2D</button><button data-view="3d">3D scene</button><label><input id="fit" type="checkbox" checked>Fit</label><label>Theme <select id="theme" aria-label="Theme"><option>light</option><option>dark</option><option>auto</option></select></label></header><p id="status" role="status" aria-live="polite">Waiting for the owner viewer…</p><p>3D requires WebGL2. Choose either 2D view if unavailable. Automatic context-loss recovery is unqualified for this owner artifact. Reduced motion follows your browser preference.</p><iframe id="viewer" title="MosaicStudio concept viewer" sandbox="allow-scripts allow-same-origin" src="${viewerOrigin}/viewer.html"></iframe><h2>Return a source mapping</h2><p>These explicit mapping buttons return a unique DiagramCloud source. They are separate from selection inside the viewer: this MosaicStudio artifact does not emit picks. Merged or ambiguous mappings cannot navigate. Without a linked DiagramCloud opener, return buttons are unavailable.</p><div id="mapping" aria-label="Source mappings"></div><script>${script}</script></html>`;
 return {html,script};
}
