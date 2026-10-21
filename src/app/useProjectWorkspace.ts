import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {clone,errorMessage,type Project} from '../core/model';
import {commitHistory,redo,undo,type History} from '../core/operations';
import {loadWorkspace,saveProject,planWorkspaceDraftSaves,type WorkspaceWarning} from '../core/storage';
import {createLatestSaveQueue} from '../core/saveQueue';
import {readDeepLink,libraryTargetForLink,type DeepLink} from '../core/links';
/** Local authoring history and durable storage lifecycle. UI navigation and
 * generated analysis remain separate from the single validated Project. */
export function useProjectWorkspace(samples:Project[],handlers:{onLink:(project:Project,link:DeepLink)=>void;onMessage:(message:string)=>void}){
 const callbacks=useRef(handlers);callbacks.current=handlers;
 const [library,setLibrary]=useState<Project[]>(()=>clone(samples)),[history,setHistory]=useState<History>(()=>({past:[],present:clone(samples[0]),future:[]})),historyRef=useRef(history);
 const [saveState,setSaveState]=useState('Opening local workspace…'),[ready,setReady]=useState(false),[canSave,setCanSave]=useState(false),[saveError,setSaveError]=useState(''),[quarantine,setQuarantine]=useState<WorkspaceWarning[]>([]);
 const initialHistory=useRef(history),early=useRef(new Map<string,Project>()),startupConflicts=useRef(new Set<string>());
 // Storage answers asynchronously. A project the reader already opened or edited meanwhile is kept: only the library
 // is merged. Opened-but-unedited switches to its stored copy; edited copies stay in memory and are saved unless a
 // stored copy of the same project exists, which is never overwritten silently.
 useEffect(()=>{let alive=true;loadWorkspace().then(({projects:saved,warnings})=>{if(!alive)return;const byId=new Map(samples.map(s=>[s.id,clone(s)]));saved.forEach(s=>byId.set(s.id,s));
  const current=historyRef.current,chosen=current!==initialHistory.current,{conflicts,pending}=planWorkspaceDraftSaves(saved,Array.from(early.current.values()));
  startupConflicts.current=new Set(conflicts);
  for(const [id,doc] of early.current)byId.set(id,doc);
  early.current.clear();
  const merged=[...byId.values()];setLibrary(merged);
  if(chosen){const id=current.present.id,edited=current.past.length>0||current.future.length>0||byId.get(id)===current.present;
   if(!edited){const stored=byId.get(id);if(stored&&stored!==current.present){const nextHistory={past:[],present:stored,future:[]} satisfies History;historyRef.current=nextHistory;setHistory(nextHistory);}}
   else byId.set(id,current.present);
   if(conflicts.length){offlineEdits.current=true;callbacks.current.onMessage('A draft made before the local workspace opened differs from a stored copy. Nothing was overwritten. Back up the affected authoring drafts before reloading.');}
  }else{const link=readDeepLink(window.location.search),linked=link&&merged.find(s=>s.id===link.project),first=linked??merged.find(s=>s.id===samples[0].id)!;const nextHistory={past:[],present:first,future:[]} satisfies History;historyRef.current=nextHistory;setHistory(nextHistory);if(link&&libraryTargetForLink(link))callbacks.current.onLink(first,link);else if(linked)callbacks.current.onLink(linked,link);else if(link)callbacks.current.onMessage(`The link asks for project “${link.project}”, which is not in this browser’s workspace. Import it first (JSON / AI or Open project folder).`);}
  setCanSave(true);setSaveState('Local workspace ready');if(!conflicts.length)offlineEdits.current=false;pending.forEach(doc=>void saveQueue.enqueue(doc));
  if(warnings.length){setQuarantine(warnings);callbacks.current.onMessage(`${warnings.length} saved project${warnings.length===1?'':'s'} could not be read. The raw IndexedDB row${warnings.length===1?' was':'s were'} left untouched; valid projects loaded normally. Open Recovery to download, repair or delete ${warnings.length===1?'it':'them'}.`);}}).catch(e=>{if(alive){setSaveError(errorMessage(e));setSaveState('Not saved · export JSON');}}).finally(()=>{if(alive)setReady(true);});return()=>{alive=false;};},[]);
 const saveQueue=useMemo(()=>createLatestSaveQueue<Project>(saveProject,state=>{if(state.status==='saving'){setSaveState('Saving locally…');return;}if(state.status==='saved'){setSaveState('Saved locally');setSaveError('');return;}setSaveState('Not saved · export JSON');setSaveError(state.error??'Local save failed. Export a JSON backup.');},doc=>doc.id),[]);
 // Edits made while storage is unavailable exist only in memory until a backup is downloaded.
 const offlineEdits=useRef(false);
 const persist=useCallback((doc:Project)=>{setLibrary(items=>{const exists=items.some(i=>i.id===doc.id);return exists?items.map(i=>i.id===doc.id?doc:i):[...items,doc];});if(!canSave){offlineEdits.current=true;early.current.set(doc.id,doc);setSaveState('Not saved · export JSON');return;}if(startupConflicts.current.has(doc.id)){offlineEdits.current=true;setSaveState('Not saved · export JSON');return;}void saveQueue.enqueue(doc);},[canSave,saveQueue]);
 // Ask before closing or reloading while the newest edit is not stored (saving, failed, or storage unavailable).
 useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(saveQueue.unsaved()||offlineEdits.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[saveQueue]);
 const commit=(next:Project)=>{try{const updated=commitHistory(historyRef.current,next);historyRef.current=updated;setHistory(updated);persist(updated.present);callbacks.current.onMessage('');}catch(e){callbacks.current.onMessage(errorMessage(e));}};
 const change=(mutate:(draft:Project)=>void)=>{const next=clone(historyRef.current.present);mutate(next);commit(next);};
 const historyAction=(direction:'undo'|'redo')=>{const current=historyRef.current,h=direction==='undo'?undo(current):redo(current);if(h===current)return;historyRef.current=h;setHistory(h);persist(h.present);};
 const unsavedProjectIds=Array.from(new Set([...saveQueue.unsavedKeys(),...startupConflicts.current,...early.current.keys()]));
 const startupError=startupConflicts.current.size?'A stored copy differs from a draft made before storage opened. Back up the affected drafts, then reload and review the stored copies. No conflicting draft was written.':'';
 return {library,history,historyRef,setHistory,quarantine,setQuarantine,saveState:startupError?'Not saved · export JSON':saveState,saveError:startupError||saveError,unsavedProjectIds,ready,saveQueue,persist,commit,change,historyAction};
}
