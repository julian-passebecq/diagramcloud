import {useEffect,useRef,useState} from 'react';
import type {WorkbenchLayout} from '../core/workbenchLayout';
import {arrangementScopeKey,changeWorkspaceArrangements,readWorkspaceArrangements,restoreWorkspaceArrangement,type ArrangementScope,type ArrangementStorage} from '../core/workspaceArrangements';
export function browserArrangementStorage():ArrangementStorage|null{try{return window.localStorage;}catch{return null;}}
/** Keyed by the parent scope: names and notices never survive a project/audience/host change. */
export function WorkspaceArrangements({scope,layout,storage=browserArrangementStorage,isCurrent,onRestore}:{scope:ArrangementScope;layout:WorkbenchLayout;storage?:()=>ArrangementStorage|null;isCurrent:()=>boolean;onRestore:(layout:WorkbenchLayout)=>void}){
 const [read,setRead]=useState(()=>readWorkspaceArrangements(storage(),scope)),[name,setName]=useState(''),[selected,setSelected]=useState(''),[notice,setNotice]=useState('');
 const picker=useRef<HTMLSelectElement>(null);
 const key=arrangementScopeKey(scope);
 const refresh=()=>{if(!isCurrent())return;const next=readWorkspaceArrangements(storage(),scope);setRead(next);setSelected(value=>next.entries.some(e=>e.name===value)?value:'');setNotice('Arrangement list refreshed; current layout unchanged.');};
 useEffect(()=>{const changed=(event:StorageEvent)=>{if(event.key===key||event.key===null){if(!isCurrent())return;setNotice('Saved arrangements changed in another tab. Refresh the list before using them.');}};window.addEventListener('storage',changed);return ()=>window.removeEventListener('storage',changed);},[key,isCurrent]);
 const act=(action:Parameters<typeof changeWorkspaceArrangements>[3])=>{if(!isCurrent())return;const result=changeWorkspaceArrangements(storage(),scope,read.basis,action);if(!result.ok){setNotice(result.message);return;}picker.current?.focus();setRead(result.read);if(action.type==='save'){setSelected(action.name);setName('');setNotice('Workspace arrangement saved in this browser. Project and Undo history unchanged.');}else{setSelected('');setNotice(action.type==='delete'?'Saved arrangement deleted. Current layout unchanged.':'Invalid arrangement data discarded. Current layout unchanged.');}};
 const restore=()=>{if(!isCurrent())return;const result=restoreWorkspaceArrangement(storage(),scope,read.basis,selected);if(!result.ok){setNotice(result.message);return;}if(!isCurrent())return;onRestore(result.layout);setNotice('Workspace arrangement restored. Project, selected component, route and canvas camera unchanged.');};
 return <section className="wb-arrangements" aria-label="Saved workspace arrangements">
  <h3>Saved arrangements</h3><p>For this project, {scope.audience==='author'?'author':'public'} audience and browser host only. An arrangement keeps pane sizes, floating panes and density. Restore is explicit; opening a project never applies a saved arrangement automatically.</p>
  {read.status==='corrupt'&&<p role="alert">Saved arrangement data is invalid or unsupported. It has been left untouched.</p>}
  {read.status==='unavailable'&&<p role="alert">Browser storage is unavailable. Layout changes still work for this session.</p>}
  <label>Arrangement name<input className="wb-native" aria-label="Arrangement name" maxLength={60} value={name} onChange={event=>setName(event.target.value)}/></label>
  <button type="button" className="wb-native" disabled={!name.trim()||read.status==='corrupt'} onClick={()=>act({type:'save',name:name.trim(),layout})}>Save arrangement</button>
  <label>Saved arrangements<select ref={picker} className="wb-native" aria-label="Saved workspace arrangement" value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Choose an arrangement</option>{read.entries.map(entry=><option key={entry.name} value={entry.name}>{entry.name}</option>)}</select></label>
  <div className="wb-arrangement-actions"><button type="button" className="wb-native" disabled={!selected} onClick={restore}>Restore arrangement</button><button type="button" className="wb-native" disabled={!selected} onClick={()=>act({type:'delete',name:selected})}>Delete arrangement</button><button type="button" className="wb-native" onClick={refresh}>Refresh arrangements</button></div>
  {read.status==='corrupt'&&<button type="button" className="wb-native" onClick={()=>act({type:'discard-corrupt'})}>Discard invalid arrangement data</button>}
  <p role="status" aria-live="polite">{notice}</p>
 </section>;
}
