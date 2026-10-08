import {useState} from 'react';
import {parseDocument,type Project} from '../core/model';
import {semanticEvolution} from '../intelligence/evolution';
import {secretFindings} from '../core/secrets';
import {download} from '../export/browser';
/** A transient comparison of a selected backup; never imports or rewrites facts. */
export function EvolutionPanel({project,onOpen}:{project:Project;onOpen:(view:string,node?:string)=>void}){
 const [comparison,setComparison]=useState<ReturnType<typeof semanticEvolution>>(),[error,setError]=useState('');
 const read=async(file?:File)=>{if(!file)return;setComparison(undefined);setError('');try{
  if(file.size>12*1024*1024)throw new Error('Previous document exceeds 12 MiB');
  const before=parseDocument(await file.text());if(secretFindings(before).length)throw new Error('Sensitive previous document refused');
  setComparison(semanticEvolution(before,project));
 }catch(e){setError(e instanceof Error?e.message:String(e));}};
 return <details aria-label="Project Evolution"><summary>Project Evolution · compare a previous backup</summary><p>Select a previous authoring JSON for this project. Comparison is local and does not import it. Missing components remain not-in-scope; reviewed external claims and layout changes stay distinct.</p><label>Previous project JSON<input aria-label="Previous project JSON" type="file" accept=".json,application/json" onChange={e=>{void read(e.target.files?.[0]);e.target.value='';}}/></label>
  {error&&<p role="alert">{error}</p>}{comparison&&<><p>Document revision {comparison.before.documentRevision} → {comparison.after.documentRevision} · {comparison.state}</p><ul>{comparison.reasons.map(r=><li key={r}>{r}</li>)}</ul><ol aria-label="Evolution diff rail">{comparison.changes.slice(0,500).map((c,i)=>{const node=project.nodes.find(n=>n.id===c.id),view=project.views.find(v=>v.nodeIds.includes(c.id));return <li key={i}>{c.change} · {node?.label??c.id} · {c.reason} {view&&<button onClick={()=>onOpen(view.id,c.id)}>Open current component</button>}</li>;})}</ol>{comparison.changes.length>500&&<p>Display limited to 500 changes; the comparison JSON contains the complete result.</p>}<p>{comparison.note}. Current/transition/target states require explicitly authored facts.</p><button onClick={()=>download(JSON.stringify(comparison,null,2),project.id+'.evolution.private.json','application/json')}>Download private comparison JSON</button></>}
 </details>;
}
