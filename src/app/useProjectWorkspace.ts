import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {clone,errorMessage,type Project} from '../core/model';
import {commitHistory,redo,undo,type History} from '../core/operations';
import {loadWorkspace,saveProject,type WorkspaceWarning} from '../core/storage';
import {createLatestSaveQueue} from '../core/saveQueue';
import {readDeepLink,libraryTargetForLink,type DeepLink} from '../core/links';
/** Local authoring history and durable storage lifecycle. UI navigation and
 * generated analysis remain separate from the single validated Project. */
export function useProjectWorkspace(samples:Project[],handlers:{onLink:(project:Project,link:DeepLink)=>void;onMessage:(message:string)=>void}){
 const callbacks=useRef(handlers);callbacks.current=handlers;
 const [library,setLibrary]=useState<Project[]>(()=>clone(samples)),[history,setHistory]=useState<History>(()=>({past:[],present:clone(samples[0]),future:[]})),historyRef=useRef(history);
 const [saveState,setSaveState]=useState('Opening local workspace…'),[ready,setReady]=useState(false),[canSave,setCanSave]=useState(false),[saveError,setSaveError]=useState(''),[quarantine,setQuarantine]=useState<WorkspaceWarning[]>([]);
 useEffect(()=>{let alive=true;loadWorkspace().then(({projects:saved,warnings})=>{if(!alive)return;const byId=new Map(samples.map(s=>[s.id,clone(s)]));saved.forEach(s=>byId.set(s.id,s));const merged=[...byId.values()];setLibrary(merged);const link=readDeepLink(window.location.search),linked=link&&merged.find(s=>s.id===link.project),first=linked??merged.find(s=>s.id===samples[0].id)!;const nextHistory={past:[],present:first,future:[]} satisfies History;historyRef.current=nextHistory;setHistory(nextHistory);if(link&&libraryTargetForLink(link))callbacks.current.onLink(first,link);else if(linked)callbacks.current.onLink(linked,link);else if(link)callbacks.current.onMessage(`The link asks for project “${link.project}”, which is not in this browser’s workspace. Import it first (JSON / AI or Open project folder).`);setCanSave(true);setSaveState('Local workspace ready');if(warnings.length){setQuarantine(warnings);callbacks.current.onMessage(`${warnings.length} saved project${warnings.length===1?'':'s'} could not be read. The raw IndexedDB row${warnings.length===1?' was':'s were'} left untouched; valid projects loaded normally. Open Recovery to download, repair or delete ${warnings.length===1?'it':'them'}.`);}}).catch(e=>{if(alive){setSaveError(errorMessage(e));setSaveState('Not saved · export JSON');}}).finally(()=>{if(alive)setReady(true);});return()=>{alive=false;};},[]);
 const saveQueue=useMemo(()=>createLatestSaveQueue<Project>(saveProject,state=>{if(state.status==='saving'){setSaveState('Saving locally…');return;}if(state.status==='saved'){setSaveState('Saved locally');setSaveError('');return;}setSaveState('Not saved · export JSON');setSaveError(state.error??'Local save failed. Export a JSON backup.');}),[]);
 // Edits made while storage is unavailable exist only in memory until a backup is downloaded.
 const offlineEdits=useRef(false);
 const persist=useCallback((doc:Project)=>{setLibrary(items=>{const exists=items.some(i=>i.id===doc.id);return exists?items.map(i=>i.id===doc.id?doc:i):[...items,doc];});if(!canSave){offlineEdits.current=true;setSaveState('Not saved · export JSON');return;}void saveQueue.enqueue(doc);},[canSave,saveQueue]);
 // Ask before closing or reloading while the newest edit is not stored (saving, failed, or storage unavailable).
 useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(saveQueue.unsaved()||offlineEdits.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[saveQueue]);
 const commit=(next:Project)=>{try{const updated=commitHistory(historyRef.current,next);historyRef.current=updated;setHistory(updated);persist(updated.present);callbacks.current.onMessage('');}catch(e){callbacks.current.onMessage(errorMessage(e));}};
 const change=(mutate:(draft:Project)=>void)=>{const next=clone(historyRef.current.present);mutate(next);commit(next);};
 const historyAction=(direction:'undo'|'redo')=>{const current=historyRef.current,h=direction==='undo'?undo(current):redo(current);if(h===current)return;historyRef.current=h;setHistory(h);persist(h.present);};
 return {library,history,historyRef,setHistory,quarantine,setQuarantine,saveState,saveError,ready,saveQueue,persist,commit,change,historyAction};
}
