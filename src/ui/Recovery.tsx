import {useState} from 'react';
import {Button} from '@fluentui/react-components';
import type {WorkspaceWarning} from '../core/storage';

type Props={
 rows:WorkspaceWarning[];
 /** Save the row exactly as stored. */
 onDownload:(id:string)=>Promise<void>;
 /** Put the row's JSON text in the JSON / AI editor so it can be fixed, validated and applied. */
 onRepair:(id:string)=>Promise<void>;
 /** Permanently remove the row from this browser. */
 onDelete:(id:string)=>Promise<void>;
};

/**
 * Stored projects that could not be loaded. Nothing here changes a row until the user acts: download a raw copy,
 * open its JSON for repair, or delete it after a second, explicit confirmation.
 */
export function RecoveryPanel(p:Props){
 const [confirm,setConfirm]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[saved,setSaved]=useState<string[]>([]);
 const run=async(id:string,action:()=>Promise<void>)=>{setBusy(id);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy('');}};
 if(!p.rows.length)return <p>Every saved project in this browser loads normally. Nothing needs recovery.</p>;
 return <section className="recovery" aria-label="Unreadable saved projects">
  <p>These saved projects could not be loaded. They are kept exactly as stored and nothing is changed until you act. Download a raw copy first: it is the only backup of a row you delete.</p>
  {error&&<p role="alert" className="validation-error">{error}</p>}
  <ul className="recovery-list">{p.rows.map(r=><li key={r.id}>
   <div className="recovery-head"><b>{r.id}</b><span className="micro">{r.savedAt?`saved ${new Date(r.savedAt).toLocaleString()}`:'no valid save time'} · {r.bytes.toLocaleString()} characters</span></div>
   <p className="recovery-reason">{r.message}</p>
   <div className="toolbar">
    <Button size="small" disabled={!!busy} onClick={()=>void run(r.id,async()=>{await p.onDownload(r.id);setSaved(v=>[...v,r.id]);})}>Download raw copy</Button>
    <Button size="small" disabled={!!busy||!r.hasJsonText} title={r.hasJsonText?undefined:'This row holds no JSON text to repair'} onClick={()=>void run(r.id,()=>p.onRepair(r.id))}>Open in JSON editor</Button>
    {confirm===r.id
     ?<><Button size="small" appearance="primary" disabled={!!busy} onClick={()=>void run(r.id,async()=>{await p.onDelete(r.id);setConfirm('');})}>Delete permanently</Button><Button size="small" onClick={()=>setConfirm('')}>Keep it</Button>
       <span role="note" className="micro recovery-warning">{saved.includes(r.id)?'You downloaded a raw copy.':'You have not downloaded a raw copy.'} Deleting removes the row from this browser for good.</span></>
     :<Button size="small" disabled={!!busy} onClick={()=>setConfirm(r.id)}>Delete from this browser…</Button>}
   </div>
  </li>)}</ul>
 </section>;
}
