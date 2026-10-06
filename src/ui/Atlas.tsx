import {useState} from 'react';
import {Button} from '@fluentui/react-components';
import {REPOSITORY_HOSTS,type Project,type SnapshotRepository} from '../core/model';
import {compareSnapshots,staleRepositories,REPOSITORY_ROLES,type ManifestRepository} from '../core/atlas';

type NewRepository={id:string;title:string;host:SnapshotRepository['host'];locator:string;role:ManifestRepository['role'];purpose?:string};
const CHANGE_LABEL={added:'added',removed:'removed','revision-changed':'new revision',unchanged:'same revision',unknown:'unknown (a revision is missing)'} as const;
const short=(sha?:string)=>sha?sha.slice(0,12):'unknown';
const when=(iso?:string)=>iso?iso.slice(0,19).replace('T',' '):'—';

/**
 * Project atlas panel: the revision vector of the active snapshot (each repository at its own revision, never one
 * project SHA), stale or missing sources, comparison with an earlier snapshot, and the explicit actions that change
 * membership or content: rescan one repository from a picked folder, or declare another repository.
 */
export function AtlasPanel({doc,readOnly,busy,onRescan,onAdd}:{doc:Project;readOnly:boolean;busy:boolean;onRescan:(repoId:string,files:FileList)=>void;onAdd:(repo:NewRepository)=>void}){
 const atlas=doc.atlas!;
 // '' follows the current snapshot (it changes after a rescan or an added repository); undefined compares with the one before it.
 const [shown,setShown]=useState(''),[picked,setAgainst]=useState<string|undefined>();
 const [draft,setDraft]=useState<NewRepository>({id:'',title:'',host:'github',locator:'',role:'application'});
 const snap=atlas.snapshots.find(s=>s.id===shown)??atlas.snapshots.find(s=>s.id===atlas.activeSnapshotId)!;
 const previous=atlas.snapshots[atlas.snapshots.findIndex(s=>s.id===snap.id)-1],against=picked??previous?.id??'';
 const other=atlas.snapshots.find(s=>s.id===against&&s.id!==snap.id);
 const stale=new Map(staleRepositories(snap).map(s=>[s.id,s.reasons]));
 const changes=other?compareSnapshots(other.capturedAt<snap.capturedAt?other:snap,other.capturedAt<snap.capturedAt?snap:other):[];
 const valid=/^[a-z][a-z0-9-]{0,23}$/.test(draft.id)&&draft.title.trim()&&draft.locator.trim();
 return <div className="atlas-panel" data-testid="atlas-panel">
  <p>Each repository keeps its own revision: this is a <b>revision vector</b>, not one project SHA. Nothing is polled or fetched; a repository changes only when you rescan it from a local folder.</p>
  <div className="atlas-controls">
   <label>Snapshot <select aria-label="Snapshot" value={shown&&shown!==atlas.activeSnapshotId?snap.id:''} onChange={e=>setShown(e.target.value)}>{atlas.snapshots.map(s=><option key={s.id} value={s.id===atlas.activeSnapshotId?'':s.id}>{when(s.capturedAt)}{s.id===atlas.activeSnapshotId?' (current)':''}</option>)}</select></label>
   {atlas.snapshots.length>1&&<label>Compare with <select aria-label="Compare with snapshot" value={against} onChange={e=>setAgainst(e.target.value)}><option value="">—</option>{atlas.snapshots.filter(s=>s.id!==snap.id).map(s=><option key={s.id} value={s.id}>{when(s.capturedAt)}</option>)}</select></label>}
  </div>
  <div className="table-scroll"><table className="atlas-table" aria-label="Repositories">
   <thead><tr><th>Repository</th><th>Host</th><th>Revision</th><th>Branch</th><th>Scan</th><th>Attention</th>{!readOnly&&<th><span className="sr-only">Actions</span></th>}</tr></thead>
   <tbody>{snap.repositories.map(r=><tr key={r.id} data-testid={`atlas-repo-${r.id}`}>
    <td><b>{r.title}</b><div className="micro">{r.id} · {r.locator}</div></td><td>{r.host}</td>
    <td><code title={r.revision}>{short(r.revision)}</code><div className="micro">{r.revision?`from ${r.authority}`:''}</div></td><td>{r.ref??'unknown'}</td>
    <td>{r.scanStatus}{r.scannedAt?<div className="micro">{when(r.scannedAt)}</div>:null}</td>
    <td>{stale.get(r.id)?.length?<ul className="atlas-stale">{stale.get(r.id)!.map(x=><li key={x}>{x}</li>)}</ul>:'—'}</td>
    {!readOnly&&<td>{snap.id===atlas.activeSnapshotId&&<label className={`file-button${busy?' disabled':''}`} title="Pick this repository's local folder. Only this repository's part of the atlas is replaced, after review.">Rescan…<input type="file" aria-label={`Rescan ${r.title}`} disabled={busy} {...{webkitdirectory:'',directory:''}} onChange={e=>{const f=e.target.files;if(f?.length)onRescan(r.id,f);e.target.value='';}}/></label>}</td>}
   </tr>)}</tbody>
  </table></div>
  {other&&<section aria-label="Snapshot comparison"><h4>Changes between {when(other.capturedAt<snap.capturedAt?other.capturedAt:snap.capturedAt)} and {when(other.capturedAt<snap.capturedAt?snap.capturedAt:other.capturedAt)}</h4>
   <ul className="atlas-changes">{changes.map(c=><li key={c.id} data-change={c.change}><b>{c.title}</b>: {CHANGE_LABEL[c.change]}{c.change==='revision-changed'?` (${short(c.from)} → ${short(c.to)})`:''}</li>)}</ul>
   <p className="micro">Component-level differences are shown by the review when a rescan is applied (same IDs, changed content).</p></section>}
  {!readOnly&&<details className="atlas-add"><summary>Add repository</summary>
   <p className="micro">Membership is explicit: the repository is added as a card, not scanned, revision unknown until you rescan it.</p>
   <div className="atlas-form">
    <label>ID<input aria-label="Repository ID" value={draft.id} placeholder="e.g. billing" onChange={e=>setDraft({...draft,id:e.target.value.trim()})}/></label>
    <label>Title<input aria-label="Repository title" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
    <label>Host<select aria-label="Repository host" value={draft.host} onChange={e=>setDraft({...draft,host:e.target.value as NewRepository['host']})}>{REPOSITORY_HOSTS.map(h=><option key={h}>{h}</option>)}</select></label>
    <label>Role<select aria-label="Repository role" value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value as NewRepository['role']})}>{REPOSITORY_ROLES.map(h=><option key={h}>{h}</option>)}</select></label>
    <label className="wide">Locator (URL or name, no credentials)<input aria-label="Repository locator" value={draft.locator} onChange={e=>setDraft({...draft,locator:e.target.value.trim()})}/></label>
   </div>
   <Button disabled={!valid||busy} onClick={()=>{onAdd({...draft,title:draft.title.trim()});setDraft({id:'',title:'',host:draft.host,locator:'',role:'application'});}}>Add repository</Button>
  </details>}
 </div>;
}
