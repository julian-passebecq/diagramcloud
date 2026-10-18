import {useEffect,useRef,useState} from 'react';
import type {Project} from '../core/model';
import {errorMessage} from '../core/model';
import {download} from '../export/browser';
import {acceptConceptMessage,prepareConceptPreview,type ConceptPreview,type ConceptPickResult} from '../interop/conceptPreview';
import './mosaic-preview.css';

type ResolvedPick=Extract<ConceptPickResult,{ok:true}>;
/** Preparation stays in this authorized host. The optional localhost host gets no document access through messages. */
export function MosaicPreview({project,viewId,publicOnly,onReturn}:{project:Project;viewId:string;publicOnly:boolean;onReturn:(pick:ResolvedPick)=>void}){
 const [audience,setAudience]=useState<'public'|'author'>('public'),[prepared,setPrepared]=useState<{packet:ConceptPreview;input:Project}|null>(null);
 const [hostUrl,setHostUrl]=useState(''),[message,setMessage]=useState(''),[working,setWorking]=useState(false);
 const latest=useRef({project,viewId,publicOnly});latest.current={project,viewId,publicOnly};
 const binding=useRef<{origin:string;source:Window}|null>(null),generation=useRef(0);
 const storedPacket=prepared?.packet,packet=storedPacket&&(!publicOnly||storedPacket.audience==='public')?storedPacket:undefined,current=!!prepared&&prepared.input===project&&packet?.viewId===viewId&&packet.audience===(publicOnly?'public':audience);
 const onReturnRef=useRef(onReturn);onReturnRef.current=onReturn;
 useEffect(()=>()=>{generation.current++;binding.current=null;},[]);
 useEffect(()=>{
  const listener=(event:MessageEvent)=>{
   const bound=binding.current,p=prepared?.packet,live=latest.current;
   if(!bound||!p||event.origin!==bound.origin||event.source!==bound.source)return;
   if(prepared.input!==live.project||p.viewId!==live.viewId||(live.publicOnly&&p.audience!=='public')){setMessage('Stale preview: prepare the current revision before returning a selection.');return;}
   const data=event.data;
   if(data&&typeof data==='object'&&!Array.isArray(data)&&data.format==='diagramcloud.concept-host-ready'){
    if(Object.keys(data).sort().join(',')!=='baseRevision,format,projectId,projectionSha256,version,viewId'||data.version!==1||data.projectId!==p.projectId||data.baseRevision!==p.baseRevision||data.viewId!==p.viewId||data.projectionSha256!==p.projectionSha256){setMessage('The local host has a different or stale projection. Use this packet and its matching input.');return;}
    setMessage('Local host matched this projection. Mapping returns are available; direct Mosaic selection return is unsupported.');return;
   }
   const result=acceptConceptMessage(p,event,bound);
   if(!result.ok){setMessage(`Selection refused: ${result.reason}.`);return;}
   if(result.ambiguous||result.sourceIds.length!==1){setMessage('Selection refused: ambiguous target. Inspect the source relationships instead.');return;}
   onReturnRef.current(result);
  };
  window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener);
 },[prepared]);
 const prepare=async()=>{const attempt=++generation.current;binding.current=null;setWorking(true);setMessage('');try{
  const selectedAudience=publicOnly?'public':audience;
  const next=await prepareConceptPreview(project,{projectId:project.id,baseRevision:project.revision,viewId},{audience:selectedAudience});
  if(attempt===generation.current&&latest.current.project===project&&latest.current.viewId===viewId&&latest.current.publicOnly===publicOnly)setPrepared({packet:next,input:project});
 }catch(e){if(attempt===generation.current){setPrepared(null);setMessage(errorMessage(e));}}finally{if(attempt===generation.current)setWorking(false);}};
 const openHost=()=>{if(!packet||!current)return;try{
  const url=new URL(hostUrl);if(url.protocol!=='http:'||url.hostname!=='localhost'||!url.port||url.username||url.password||url.pathname!=='/'||url.hash)throw new Error('Use the local host URL printed by concept:host: http://localhost:<port>/.');
  url.search='';url.searchParams.set('diagramcloudOrigin',window.location.origin);
  const source=window.open(url.href,'diagramcloud-mosaic-local');if(!source)throw new Error('The preview window was blocked. Allow this explicit local preview or use the file route.');
  binding.current={origin:url.origin,source};setMessage('Waiting for the local host to match this packet. No document is sent through this connection.');
 }catch(e){setMessage(errorMessage(e));}};
 const save=(kind:'packet'|'concept'|'mapping')=>{if(!packet||!current)return;const value=kind==='packet'?packet:kind==='concept'?packet.projection.spec:packet.projection.report;download(JSON.stringify(value,null,2)+'\n',`${project.id}.${viewId}.${kind}.json`,'application/json');};
 const returnMapping=(kind:'node'|'flow',targetId:string)=>{if(!packet||!current)return;const rows=kind==='node'?packet.projection.report.nodes:packet.projection.report.edges,ids=[...new Set(rows.filter(r=>r.targetId===targetId&&r.state!=='omitted').map(r=>r.sourceId))];if(ids.length!==1){setMessage('Selection refused: ambiguous target.');return;}onReturn({ok:true,projectId:packet.projectId,baseRevision:packet.baseRevision,viewId:packet.viewId,kind,sourceIds:ids,ambiguous:false});};
 return <section className="mosaic-preview" aria-label="Mosaic preview">
  <p>Prepare the selected view for the existing Mosaic viewer. The Project and its publication choices stay unchanged.</p>
  <label>Preview audience <select aria-label="Preview audience" value={publicOnly?'public':audience} onChange={e=>{generation.current++;binding.current=null;setAudience(e.target.value as 'public'|'author');setPrepared(null);setWorking(false);}}><option value="public">Public projection</option>{!publicOnly&&<option value="author">Private author preview</option>}</select></label>
  {audience==='author'&&!publicOnly&&<p className="note-card">Private author preview. The selected view may contain private components and sources. Keep its files and local host private.</p>}
  <button type="button" disabled={working} onClick={()=>void prepare()}>{working?'Preparing preview…':'Prepare Mosaic preview'}</button>
  {storedPacket&&!packet&&<p role="alert">Prepare a public preview for this mode.</p>}
  {packet&&<><p>Project {packet.projectId} · view {packet.viewId} · revision {packet.baseRevision} · {packet.audience}</p>{!current&&<p role="alert">This preview is stale. Prepare the current selection again.</p>}
   <div className="mosaic-actions"><button disabled={!current} onClick={()=>save('packet')}>Download preview packet</button><button disabled={!current} onClick={()=>save('concept')}>Download Mosaic concept</button><button disabled={!current} onClick={()=>save('mapping')}>Download source mapping</button></div>
   <details><summary>Open the local viewer host</summary><p>Save this packet and a matching Authoring JSON backup. Start the helper with the selected input and the existing owner viewer file and its SHA-256. No viewer is installed or fetched.</p><code>npm run concept:host -- document.json --view {viewId} --audience {packet.audience} --viewer concept-viewer.html --viewer-sha256 &lt;owner-sha256&gt; --packet {project.id}.{viewId}.packet.json --diagramcloud-origin {window.location.origin}</code><p>The helper prints its local URL. Its isolated viewer supports layered, isometric and 3D views when WebGL2 is available. Direct viewer picking and graceful WebGL context restoration remain owner integration limits.</p><label>Local preview host URL<input aria-label="Local preview host URL" value={hostUrl} placeholder="http://localhost:12345/" onChange={e=>setHostUrl(e.target.value)}/></label><button disabled={!current} onClick={openHost}>Connect local preview host</button></details>
   <h3>Source mapping</h3><p>Return through the mapping below. A Mosaic click remains inside the viewer; it does not send a pick to DiagramCloud.</p>
   <div className="mosaic-mapping"><table><thead><tr><th>Kind</th><th>Source ID</th><th>Target ID</th><th>Result</th><th>Return</th></tr></thead><tbody>{([['node',packet.projection.report.nodes],['flow',packet.projection.report.edges]] as const).flatMap(([kind,rows])=>rows.map(row=><tr key={`${kind}:${row.sourceId}`}><td>{kind}</td><td>{row.sourceId}</td><td>{row.targetId??'—'}</td><td>{row.state}{row.reason?` · ${row.reason}`:''}</td><td>{row.targetId&&<button disabled={!current||rows.filter(r=>r.targetId===row.targetId&&r.state!=='omitted').length!==1} onClick={()=>returnMapping(kind,row.targetId!)}>Return to {row.sourceId}</button>}</td></tr>))}</tbody></table></div>
   <h3>Projection limits</h3><ul>{packet.projection.report.lost.map((loss,i)=><li key={i}>{loss}</li>)}</ul>
  </>}{message&&<p role="status">{message}</p>}
 </section>;
}
