import {useEffect,useRef,useState} from 'react';
import './saved-contexts.css';
import {Button,Input} from '@fluentui/react-components';
import {newId} from '../core/model';
import {SAVED_CONTEXT_LIMIT,addSavedContext,clearSavedContexts,readSavedContexts,removeSavedContext,watchSavedContexts,
 type DimensionResult,type SavedContext,type SavedContextAudience,type SavedContextRead,type SavedContextStorage,type SemanticContext} from '../core/savedContext';

type Props={projectId:string;projectRevision:number;audience:SavedContextAudience;host:string;storage:()=>SavedContextStorage|null;
 capture:()=>SemanticContext|undefined;onRestore:(entry:SavedContext)=>DimensionResult[]|undefined};
const DIMENSION_LABELS:Record<DimensionResult['dimension'],string>={path:'Parent path',view:'View',selection:'Selected component or connection',sheet:'Sheet',perspective:'Perspective',environment:'Environment',snapshot:'Snapshot',lesson:'Lesson depth',variant:'Variant',tour:'Tour position'};
const STATE_LABELS:Record<DimensionResult['state'],string>={kept:'restored',fallback:'unavailable · safe fallback used',changed:'changed since saved',reserved:'recorded, not restored'};
const readNotice=(read:SavedContextRead)=>read.status==='corrupt'?'Saved contexts for this project cannot be read. They were left untouched; clear them to save new ones.':read.status==='unavailable'?'Browser storage is unavailable here. Saved contexts cannot be kept; navigation still works.':'';

/**
 * Browser-local saved contexts for one project, audience and host. Saving stores stable-ID pointers only; restoring
 * navigates through the caller, which resolves every dimension against the permitted document. Never a revision.
 */
export function SavedContexts({projectId,projectRevision,audience,host,storage,capture,onRestore}:Props){
 const scope=JSON.stringify([projectId,audience,host]);
 const [state,setState]=useState<{scope:string;read:SavedContextRead}>(()=>({scope,read:readSavedContexts(storage(),projectId,audience,host)}));
 const [label,setLabel]=useState(''),[notice,setNotice]=useState<{scope:string;text:string;kind:'ok'|'alert'}|null>(null),[result,setResult]=useState<{scope:string;id:string;dimensions:DimensionResult[]}|null>(null);
 // Keyboard focus: when the focused entry disappears, focus goes to the next entry's Restore or to the name field.
 const root=useRef<HTMLElement>(null),focusNext=useRef<string|null>(null);
 useEffect(()=>{const sel=focusNext.current;if(!sel)return;focusNext.current=null;(root.current?.querySelector<HTMLElement>(sel)??root.current?.querySelector<HTMLElement>('[data-focus="saved-context-name"]'))?.focus();});
 const reload=()=>setState({scope,read:readSavedContexts(storage(),projectId,audience,host)});
 // A scope change (project, audience, host) reads only its own saved contexts.
 useEffect(()=>{if(state.scope!==scope)reload();},[scope]);
 useEffect(()=>watchSavedContexts(window,projectId,audience,host,()=>{setState({scope,read:readSavedContexts(storage(),projectId,audience,host)});setNotice({scope,kind:'ok',text:'Saved contexts changed in another tab; the list was reloaded.'});}),[scope]);
 const read=state.scope===scope?state.read:readSavedContexts(storage(),projectId,audience,host);
 const shownNotice=notice?.scope===scope?notice:null,shownResult=result?.scope===scope?result:null;
 const save=()=>{
  const context=capture();if(!context){setNotice({scope,kind:'alert',text:'The current navigation cannot be saved here. Nothing was stored.'});return;}
  const entry:SavedContext={id:newId('context'),label:label.trim().slice(0,120)||`Saved context ${read.entries.length+1}`,savedAt:new Date().toISOString(),projectRevision,context};
  const out=addSavedContext(storage(),projectId,audience,host,entry);
  if(out.ok){setState({scope,read:{status:'ok',entries:out.entries}});setLabel('');setNotice({scope,kind:'ok',text:`Saved “${entry.label}” in this browser.`});return;}
  reload();setNotice({scope,kind:'alert',text:out.reason==='full'?`At most ${SAVED_CONTEXT_LIMIT} saved contexts per project. Remove one first.`:out.reason==='corrupt'?'Saved contexts cannot be read; nothing was overwritten. Clear them first.':'Browser storage refused the save. Nothing was stored.'});
 };
 const restore=(entry:SavedContext)=>{const dimensions=onRestore(entry);if(!dimensions)return;setNotice(null);setResult({scope,id:entry.id,dimensions});};
 const remove=(entry:SavedContext)=>{const at=read.entries.findIndex(e=>e.id===entry.id),after=read.entries[at+1]??read.entries[at-1];focusNext.current=after?`[data-saved-context="${CSS.escape(after.id)}"] [data-restore]`:'[data-focus="saved-context-name"]';const out=removeSavedContext(storage(),projectId,audience,host,entry.id);if(out.ok)setState({scope,read:{status:'ok',entries:out.entries}});else reload();setNotice({scope,kind:out.ok?'ok':'alert',text:out.ok?`Removed “${entry.label}”.`:'Browser storage refused the change.'});};
 const clear=()=>{focusNext.current='[data-focus="saved-context-name"]';const ok=clearSavedContexts(storage(),projectId,audience,host);reload();setResult(null);setNotice({scope,kind:ok?'ok':'alert',text:ok?'Saved contexts for this project were cleared.':'Browser storage refused the change.'});};
 const problem=readNotice(read);
 return <section ref={root} className="saved-contexts" aria-label="Saved contexts" data-testid="saved-contexts">
  <div className="eyebrow">SAVED CONTEXTS</div>
  <p className="micro">Saves where you are (path, view, selection, sheet, environment) in this browser only. No project change, no Undo step; private objects never reach a public context.</p>
  {problem&&<p className="revision-warning" role="alert">{problem}</p>}
  {read.status==='corrupt'&&<Button size="small" onClick={clear}>Clear saved contexts</Button>}
  {read.status!=='corrupt'&&read.status!=='unavailable'&&<div className="toolbar"><Input size="small" data-focus="saved-context-name" aria-label="Saved context name" placeholder="Name (optional)" value={label} maxLength={120} onChange={(_,d)=>setLabel(d.value)} onKeyDown={e=>{if(e.key==='Enter')save();}}/><Button size="small" appearance="primary" onClick={save}>Save context</Button></div>}
  {shownNotice&&<p className={shownNotice.kind==='ok'?'micro':'validation-error'} role={shownNotice.kind==='ok'?'status':'alert'}>{shownNotice.text}</p>}
  {read.entries.length>0&&<ul className="saved-context-list">{read.entries.map(entry=><li key={entry.id} data-saved-context={entry.id}>
   <span><b>{entry.label}</b> <span className="micro">revision {entry.projectRevision}</span></span>
   <span className="toolbar"><Button size="small" data-restore onClick={()=>restore(entry)} aria-label={`Restore ${entry.label}`}>Restore</Button><Button size="small" appearance="subtle" onClick={()=>remove(entry)} aria-label={`Remove ${entry.label}`}>Remove</Button></span>
   {shownResult?.id===entry.id&&<ul className="saved-context-result" role="status" aria-label="Restored dimensions">{shownResult.dimensions.map(d=><li key={d.dimension} data-dimension={d.dimension} data-state={d.state}>{DIMENSION_LABELS[d.dimension]}: {STATE_LABELS[d.state]}{d.explanation?` — ${d.explanation}`:''}</li>)}</ul>}
  </li>)}</ul>}
  {read.entries.length===0&&!problem&&<p className="muted">No saved context for this project yet.</p>}
 </section>;
}
