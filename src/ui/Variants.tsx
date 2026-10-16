import {useMemo,useState} from 'react';
import {Button} from '@fluentui/react-components';
import {errorMessage,type Project} from '../core/model';
import {addVariant,applyVariant,discardVariant,rebaseVariant,selectVariant,variantState,VARIANT_SELECT_NOTE,type VariantStatus} from '../core/variants';
import {ChangePreview} from '../app/ReviewShell';

type Props={project:Project;viewId:string;live:()=>Project;onCommit:(next:Project)=>boolean};
const BADGE:Record<VariantStatus,string>={current:'Baseline current',stale:'Stale baseline',broken:'Cannot apply'};
const EXAMPLE='[\n {"op":"test","path":"/nodes/@<id>/label","value":"<current label>"},\n {"op":"replace","path":"/nodes/@<id>/label","value":"<new label>"}\n]';

/**
 * Variants panel (Edit mode only). A variant is a named change set against a recorded baseline of one view. Selecting
 * compares it (architecture delta + change preview) and changes nothing; Apply is the only path that changes the model:
 * revalidated against the live project, refused on a stale baseline, committed as one undoable revision.
 */
export function VariantsPanel({project,viewId,live,onCommit}:Props){
 const [selected,setSelected]=useState<string|null>(null),[id,setId]=useState(''),[title,setTitle]=useState(''),[ops,setOps]=useState(''),[notice,setNotice]=useState<{kind:'ok'|'refused';text:string}|null>(null);
 const variants=project.variants??[];
 const selection=useMemo(()=>selected&&variants.some(v=>v.id===selected)?selectVariant(project,selected):null,[project,selected]);
 const act=(f:(d:Project)=>Project,ok:(before:Project,after:Project)=>string)=>{setNotice(null);
  try{const before=live(),next=f(before);if(!onCommit(next)){setNotice({kind:'refused',text:'Refused: the project did not accept this revision. Nothing was applied.'});return false;}setNotice({kind:'ok',text:ok(before,live())});return true;}
  catch(e){setNotice({kind:'refused',text:errorMessage(e)});return false;}};
 const create=()=>{let operations:unknown;try{operations=JSON.parse(ops);}catch(e){setNotice({kind:'refused',text:`Operations are not valid JSON: ${errorMessage(e)}`});return;}
  if(act(d=>addVariant(d,{id:id.trim(),title:title.trim(),viewId,operations}),(b)=>`Variant ${id.trim()} recorded against revision ${b.revision} of view ${viewId}. Nothing in the model changed.`)){setSelected(id.trim());setId('');setTitle('');setOps('');}};
 return <section className="inspector variants-panel" aria-label="Variants">
  <div className="eyebrow">VARIANTS</div><h2>Baseline-bound variants</h2>
  <p className="micro">A variant is a named change set against a recorded baseline of one view, not a second diagram. It stays a candidate: selecting it compares, and only Apply changes the model, as one undoable revision. Local, test and production instances are delivery declarations, not variants.</p>
  {variants.length===0?<p className="muted">No variant yet.</p>:<ul className="variant-list">{variants.map(v=>{const s=variantState(project,v.id).status;
   return <li key={v.id}><Button size="small" appearance={selected===v.id?'primary':'secondary'} aria-pressed={selected===v.id} onClick={()=>{setNotice(null);setSelected(selected===v.id?null:v.id);}}>{`Compare ${v.title}`}</Button> <span className={`chip variant-${s}`} data-variant-status={s}>{BADGE[s]}</span><br/><span className="micro">view {v.viewId} · baseline revision {v.base.revision} · <span className="stable-id">{v.id}</span>{v.origin!=='author'&&` · ${v.origin==='ai'?'AI suggestion':'imported'}${v.suggestedBy?` by ${v.suggestedBy}`:''}`}</span></li>;})}</ul>}
  {selection&&<section className="note-card" aria-label="Variant comparison">
   <p className="micro">{VARIANT_SELECT_NOTE}</p>
   <p className={selection.state.status==='current'?'micro':'revision-warning'} role={selection.state.status==='current'?'status':'alert'} data-testid="variant-state">{selection.state.message}</p>
   {selection.delta&&<><h3>Changes against the baseline</h3><ul data-testid="variant-ledger">{selection.delta.ledger.map((l,i)=><li key={i}>{l}</li>)}</ul></>}
   {selection.refused&&selection.state.status==='current'&&<p className="validation-error" role="alert">{selection.refused}</p>}
   {selection.preview&&<ChangePreview preview={selection.preview}/>}
   <div className="toolbar">
    <Button appearance="primary" disabled={selection.state.status!=='current'} onClick={()=>{const v=selection.state.variant;if(act(d=>applyVariant(d,v.id),(b,a)=>`Applied ${v.title} as revision ${a.revision}. One Undo restores revision ${b.revision} and the variant.`))setSelected(null);}}>Apply variant</Button>
    {selection.state.status==='stale'&&<Button onClick={()=>act(d=>rebaseVariant(d,selection.state.variant.id),(b)=>`Rebased on revision ${b.revision}. Compare again before applying.`)}>Rebase on current baseline</Button>}
    <Button onClick={()=>{const v=selection.state.variant;if(act(d=>discardVariant(d,v.id),()=>`Discarded ${v.title}. One Undo restores it.`))setSelected(null);}}>Discard variant</Button>
   </div></section>}
  {notice&&<p className={notice.kind==='ok'?'micro':'validation-error'} role={notice.kind==='ok'?'status':'alert'} data-testid="variant-notice">{notice.text}</p>}
  <form className="property-form" aria-label="New variant" onSubmit={e=>{e.preventDefault();create();}}>
   <h3>New variant of view {viewId}</h3>
   <label>Variant ID<input value={id} onChange={e=>setId(e.target.value)} placeholder="read-cache" pattern="[a-z][a-z0-9_.\-]{0,79}" required/></label>
   <label>Title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={160} required/></label>
   <label>Operations (JSON Patch, @id addressing)<textarea value={ops} onChange={e=>setOps(e.target.value)} rows={7} spellCheck={false} placeholder={EXAMPLE} required/></label>
   <p className="micro">Components and connections the variant adds take IDs starting with “{id.trim()||'<variant ID>'}.”, so they never collide with canonical IDs.</p>
   <Button type="submit">Record variant</Button>
  </form>
 </section>;
}
