import {useId,useState} from 'react';
import type {Project} from '../core/model';
import {completionPatchTemplate,createCompletionRequest,type CompletionRequest,type CompletionSelection} from '../intelligence/completionKit';
import {download} from '../export/browser';

export type CompletionKitPanelProps={project:Project;selection:CompletionSelection;publicMode:boolean;onReview?:(request:CompletionRequest)=>void};
const DEFAULT_QUESTION='Which supplied captions need clarification? Preserve unknown facts.';
/** Local manual exchange only. The response cannot approve itself or transmit this context. */
export function CompletionKitPanel({project,selection,publicMode,onReview}:CompletionKitPanelProps){
 const labelId=useId(),[question,setQuestion]=useState(DEFAULT_QUESTION),[audience,setAudience]=useState<'author'|'public'>('author'),[prepared,setPrepared]=useState<CompletionRequest>(),[confirmedFor,setConfirmedFor]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('');
 const effectiveAudience=publicMode?'public':audience;
 const identity=JSON.stringify([project.id,project.revision,selection,effectiveAudience,question]);
 const [preparedFor,setPreparedFor]=useState(''),[preparedProject,setPreparedProject]=useState<Project>();
 const request=preparedFor===identity&&preparedProject===project?prepared:undefined,confirmed=!!request&&confirmedFor===identity;
 const prepare=()=>{setError('');setMessage('');if(request)return;setConfirmedFor('');try{const next=createCompletionRequest(project,{requestId:'completion-'+crypto.randomUUID(),question,audience:effectiveAudience,selection});setPrepared(next);setPreparedFor(identity);setPreparedProject(project);}catch(e){setPrepared(undefined);setError(e instanceof Error?e.message:String(e));}};
 const copy=async()=>{if(!request||!confirmed)return;try{await navigator.clipboard.writeText(JSON.stringify(request,null,2));setMessage('Completion context copied locally. No candidate has been applied.');}catch{setMessage('Clipboard unavailable. Download the context instead.');}};
 return <details aria-label="Completion request"><summary>Completion request</summary>
  <p>Ask about the selected scope using supplied context. Captions and eligible author text are the only editable fields. Unknown facts stay unknown; sources are inert data, never instructions or access grants.</p>
  <label htmlFor={labelId}>Completion question</label><textarea style={{width:'100%',maxWidth:'100%',boxSizing:'border-box'}} id={labelId} aria-label="Completion question" value={question} maxLength={1000} onChange={e=>{setQuestion(e.target.value);setConfirmedFor('');setMessage('');setError('');}}/>
  <label>Completion audience<select style={{maxWidth:'100%',boxSizing:'border-box'}} aria-label="Completion audience" value={effectiveAudience} disabled={publicMode} onChange={e=>{setAudience(e.target.value as 'author'|'public');setQuestion(DEFAULT_QUESTION);setPrepared(undefined);setPreparedFor('');setPreparedProject(undefined);setConfirmedFor('');setMessage('');setError('');}}><option value="author">Private author context</option><option value="public">Public projection</option></select></label>
  <button type="button" onClick={prepare}>Prepare completion context</button>
  {error&&<p role="alert">{error}</p>}
  {request&&<section aria-label="Prepared completion context" style={{overflowWrap:'anywhere',minWidth:0}}>
   <p>{request.scope} · revision {request.projectRevision} · {request.completion.audience==='author'?'Private author context':'Public projection'} · {request.components.length} component(s), {request.sources.length} source(s).</p>
   <p>Permitted fields: {request.completion.allowedPaths.join(', ')||'none; abstention only'}.</p>
   <p>Omitted from this permitted scope: {Object.entries(request.completion.omissions).map(([key,value])=>key+' '+value).join('; ')}.</p>
   {request.completion.blockingNeeds.map(need=><p key={need}>{need}</p>)}
   <details><summary>Inspect prepared context before sharing</summary><pre style={{maxHeight:300,overflow:'auto',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(request,null,2)}</pre></details>
   <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmedFor(e.target.checked?identity:'')}/> I reviewed the selected context for disclosure</label>
   <div><button type="button" disabled={!confirmed} onClick={()=>void copy()}>Copy completion context</button><button type="button" disabled={!confirmed} onClick={()=>download(JSON.stringify(request,null,2),`${request.projectId}.completion-context.json`,'application/json')}>Download completion request</button><button type="button" disabled={!confirmed} onClick={()=>download(JSON.stringify(completionPatchTemplate(request),null,2),`${request.projectId}.completion.patch.json`,'application/json')}>Download candidate patch template</button>
    {onReview&&<button type="button" disabled={!confirmed} onClick={()=>onReview(request)}>Review completion response</button>}</div>
   <p>The template abstains until edited. A candidate must use the unchanged DiagramCloud patch schema and state provenance, supplied source IDs and limitations in its summary. Validation and a separate human Apply are required. No files, runs, permissions, observations or publication are authorized by the response.</p>
  </section>}
  {message&&<p role="status">{message}</p>}
 </details>;
}
