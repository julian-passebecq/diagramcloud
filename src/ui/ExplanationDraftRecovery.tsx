import {useEffect,useRef,useState} from 'react';
import {browserDraftStorage,changeExplanationDraft,encodeExplanationDraft,explanationDraftKey,readExplanationDraft,type DraftRecord,type DraftScope} from '../intelligence/explanationDraftStorage';

/** Mounted only inside the private Edit authoring dialog. Never mounts in public mode. */
export function useExplanationDraftRecovery(record:DraftRecord,projectId:string,onRecover:(record:DraftRecord)=>void){
 const [scope]=useState<DraftScope>(()=>({host:window.location.host,projectId:record.basis.projectId,audience:'author'}));
 const [read,setRead]=useState(()=>projectId===scope.projectId?readExplanationDraft(browserDraftStorage(),scope):{status:'unavailable' as const,raw:null}),[enabled,setEnabled]=useState(false),[notice,setNotice]=useState(''),[blocked,setBlocked]=useState(false);
 const refreshButton=useRef<HTMLButtonElement>(null);
 const observed=useRef(read);observed.current=read;
 const inScope=projectId===scope.projectId;
 let encoded:string|null=null;try{encoded=encodeExplanationDraft(scope,record);}catch{/* Unsupported unfinished input stays in the form. */}
 const saved=inScope&&!blocked&&read.status==='ready'&&encoded!==null&&read.raw===encoded;
 const save=()=>{
  const result=changeExplanationDraft(browserDraftStorage(),scope,observed.current.raw,record);
  if(result.ok){observed.current=result.read;setRead(result.read);setNotice('');setBlocked(false);}else{setEnabled(false);setBlocked(true);setNotice(result.message);}
 };
 useEffect(()=>{if(enabled&&inScope)save();},[encoded,enabled,inScope]);
 useEffect(()=>{const changed=(event:StorageEvent)=>{if(event.key!==null&&event.key!==explanationDraftKey(scope))return;if(event.newValue===observed.current.raw&&event.key!==null)return;setEnabled(false);setBlocked(true);setNotice('Draft conflict: another tab changed the saved copy. Autosave stopped. Refresh saved draft before recovering or deleting it.');};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[scope]);
 const refresh=()=>{setEnabled(false);const next=readExplanationDraft(browserDraftStorage(),scope);observed.current=next;setRead(next);setBlocked(false);setNotice('Saved copy refreshed. Your form is unchanged; recovery is explicit.');};
 const recover=()=>{const next=readExplanationDraft(browserDraftStorage(),scope);if(next.raw!==read.raw||next.status!=='ready'||!next.record){setEnabled(false);setBlocked(true);setNotice('Draft conflict: saved copy changed or is unavailable. Refresh saved draft.');return;}setEnabled(false);setBlocked(false);setNotice('Recovered saved draft with its original source binding. Autosave is off until you enable it.');onRecover(structuredClone(next.record));};
 const remove=()=>{refreshButton.current?.focus();setEnabled(false);const result=changeExplanationDraft(browserDraftStorage(),scope,read.raw,null);if(result.ok){observed.current=result.read;setRead(result.read);setBlocked(false);setNotice('Saved draft deleted. The form remains unchanged.');}else{setBlocked(true);setNotice(result.message);}};
 return {saved,panel:<section aria-label="Private draft recovery">
  <h3>Private draft recovery</h3><p>Opt in to save this request in this browser, for this host and project only. Includes private authored text and source IDs, not the source Project. Anyone using this browser profile may read it. Recovery is explicit; this is not a Project save.</p>
  <label><input type="checkbox" checked={enabled} disabled={!inScope||blocked||read.status==='corrupt'||read.status==='unavailable'||(read.status==='ready'&&!saved)} onChange={e=>setEnabled(e.target.checked)}/>Autosave this private draft in this browser</label>
  <p aria-label="Draft save state">{!inScope?'Different project: draft storage is paused.':saved?'Saved locally as a private draft.':enabled?'Unsaved changes; saving private draft…':'Not saved: current form has no confirmed matching saved copy.'} {!enabled&&'Autosave is off.'}</p>
  {read.status==='ready'&&<p>Saved draft available: original revision {read.record!.basis.revision}, fingerprint {read.record!.basis.fingerprint}. Recovering replaces this form, including unfinished work. Download the current draft first if needed. To save a different form, delete this saved copy explicitly before enabling autosave.</p>}
  {read.status==='corrupt'&&<p role="alert">Saved draft is corrupt or unsupported. It was left untouched. Download your current form before explicitly deleting the saved copy.</p>}
  {read.status==='unavailable'&&<p role="alert">Browser draft storage is unavailable. Keep the form open or download a backup.</p>}
  {notice&&<p aria-label="Draft storage notice">{notice}</p>}
  <div className="toolbar"><button ref={refreshButton} type="button" disabled={!inScope} onClick={refresh}>Refresh saved draft</button><button type="button" disabled={!inScope||blocked||read.status!=='ready'} onClick={recover}>Recover saved draft</button><button type="button" disabled={!inScope||blocked||read.raw===null} onClick={remove}>Delete saved draft</button></div>
 </section>};
}
