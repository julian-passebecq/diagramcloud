import {useEffect,useRef,useState} from 'react';
import {checkoutCapability,inspectCheckout,type CheckoutIdentity,type CheckoutStatus} from './liveCheckoutClient';
export type LiveCheckoutProps={projectId:string;repositories:CheckoutIdentity[]};
/** Mount only in author mode, keyed by the current project/snapshot binding. Never writes Project or storage. */
export function LiveCheckout({projectId,repositories}:LiveCheckoutProps){
 const [allowed,setAllowed]=useState<CheckoutIdentity[]|null>(null),[selected,setSelected]=useState(''),[report,setReport]=useState<CheckoutStatus|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const generation=useRef(0),controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>{generation.current++;controller.current?.abort();},[]);
 const run=async(collect:boolean)=>{
  controller.current?.abort();const abort=new AbortController();controller.current=abort;const turn=++generation.current;
  setBusy(true);setMessage('');setReport(null);if(!collect){setAllowed(null);setSelected('');}
  try{
   if(collect){const repo=allowed?.find(r=>r.repositoryId===selected);if(!repo)throw new Error('Choose an explicitly permitted repository.');const data=await inspectCheckout(projectId,repo,abort.signal);if(turn===generation.current&&!abort.signal.aborted)setReport(data);}
   else{const cap=await checkoutCapability(projectId,repositories,abort.signal);if(turn!==generation.current||abort.signal.aborted)return;const matches=cap.repositories.filter(r=>repositories.some(x=>x.repositoryId===r.repositoryId&&x.host===r.host&&x.locator===r.locator));setAllowed(cap.available?matches:[]);setSelected(matches[0]?.repositoryId??'');setMessage(cap.reason);}
  }catch(error){if(turn===generation.current&&!abort.signal.aborted)setMessage(error instanceof Error?error.message:'Checkout inspection failed. Status unknown.');}
  finally{if(turn===generation.current&&!abort.signal.aborted)setBusy(false);}
 };
 return <section className="live-checkout" aria-label="Private local checkout">
  <h3>Local checkout · private inspection</h3><p>Inspect an explicitly configured checkout on this host. Results stay in this panel and are excluded from project saves and exports. Remote GitHub/GitLab status is unknown.</p>
  {!repositories.length?<p>No repository identities in the active project snapshot. Import a project manifest or supply its repository records first.</p>:<button type="button" disabled={busy} onClick={()=>void run(false)}>{allowed===null?'Check local checkout capability':'Recheck host capability'}</button>}
  {!!allowed?.length&&<><label>Permitted repository <select aria-label="Permitted local repository" disabled={busy} value={selected} onChange={e=>{generation.current++;controller.current?.abort();setSelected(e.target.value);setReport(null);setMessage('');}}>{allowed.map(r=><option key={r.repositoryId} value={r.repositoryId}>{r.repositoryId} · {r.host} · {r.locator}</option>)}</select></label><button type="button" disabled={busy||!selected} onClick={()=>void run(true)}>{report?'Refresh local checkout':'Inspect local checkout'}</button></>}
  {busy&&<p role="status">Inspecting the host capability or checkout…</p>}{message&&<p role="status">{message}</p>}
  {!report&&<p>Checkout state unknown. No current inspection is displayed.</p>}
  {report&&<div aria-label="Captured checkout status"><p><strong>{report.dirty?'Changes present':'Clean at capture'}</strong> · {report.headState==='unborn'?'Unborn branch; no commits':report.headState==='detached'?'Detached HEAD':`Branch: ${report.branch}`}</p><p>HEAD: <code>{report.head??'No commit yet'}</code></p><p>Captured <time dateTime={report.capturedAt}>{report.capturedAt}</time> · began {report.startedAt}. Refresh to inspect again; this is not a live subscription.</p><p>{report.scope}</p>{(['staged','unstaged','untracked','conflicts'] as const).map(kind=><details key={kind} open={report[kind].length>0}><summary>{kind[0].toUpperCase()+kind.slice(1)} ({report[kind].length})</summary>{report[kind].length?<ul>{report[kind].map((f,i)=><li key={i}><code style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{f.status} {f.path}</code></li>)}</ul>:<p>None at capture.</p>}</details>)}</div>}
 </section>;
}
