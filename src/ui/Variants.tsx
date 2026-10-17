import {useEffect,useMemo,useState} from 'react';
import {Button} from '@fluentui/react-components';
import {errorMessage,type Project,type ProjectNode} from '../core/model';
import {addVariant,applyVariant,discardVariant,rebaseVariant,selectVariant,variantState,VARIANT_SELECT_NOTE,type VariantStatus} from '../core/variants';
import {DRAFT_NOTE,draftAddEdge,draftAddNode,draftFromVariant,draftMoveNode,draftOperations,draftRemoveEdge,draftRemoveNode,draftUpdateEdge,draftUpdateNode,rebaseReport,recordDraft,startDraft,type VariantDraft} from '../core/variantDraft';
import {compareView} from '../export/design/delta';
import {ChangePreview} from '../app/ReviewShell';
import {EdgeInspector,Inspector} from './Inspector';
import {VariantCompare} from './VariantCompare';

type Props={project:Project;viewId:string;live:()=>Project;onCommit:(next:Project)=>boolean;selectedVariantId?:string|null;onSelect?:(id:string|null)=>void};
const BADGE:Record<VariantStatus,string>={current:'Baseline current',stale:'Stale baseline',broken:'Cannot apply'};
const EXAMPLE='[\n {"op":"test","path":"/nodes/@<id>/label","value":"<current label>"},\n {"op":"replace","path":"/nodes/@<id>/label","value":"<new label>"}\n]';
const KINDS:ProjectNode['kind'][]=['source','process','storage','model','report','app','control','physics','function','table'];
const NOT_IN_VARIANT='Evidence blocks, images and child views are not part of a variant: a variant changes components, connections and its own view. Edit them on the project.';

/**
 * Variants panel (Edit mode only). A variant is a named change set against a recorded baseline of one view. It is drawn
 * with the ordinary component and connection editors on a temporary candidate (or, as the advanced route, written as
 * JSON Patch). Selecting compares it side by side with linked selection and changes nothing; Apply is the only path that
 * changes the model: revalidated against the live project, refused on a stale baseline, committed as one undoable revision.
 * `selectedVariantId` / `onSelect` let a host control which variant is selected; without them the panel keeps its own.
 */
export function VariantsPanel({project,viewId,live,onCommit,selectedVariantId,onSelect}:Props){
 const [own,setOwn]=useState<string|null>(null),[id,setId]=useState(''),[title,setTitle]=useState(''),[ops,setOps]=useState(''),[notice,setNotice]=useState<{kind:'ok'|'refused';text:string}|null>(null);
 const [draft,setDraft]=useState<VariantDraft|null>(null),[linked,setLinked]=useState<string|null>(null);
 const controlled=selectedVariantId!==undefined,selected=controlled?selectedVariantId:own;
 const setSelected=(next:string|null)=>{if(!controlled)setOwn(next);onSelect?.(next);setLinked(null);};
 const variants=project.variants??[];
 // A draft belongs to one project: switching project discards it, so no candidate lands in another project.
 useEffect(()=>{setDraft(d=>d&&d.baseline.id!==project.id?null:d);},[project.id]);
 const selection=useMemo(()=>selected&&variants.some(v=>v.id===selected)?selectVariant(project,selected):null,[project,selected]);
 const rebase=useMemo(()=>selection?.state.status==='stale'?rebaseReport(project,selection.state.variant.id):null,[project,selection]);
 const act=(f:(d:Project)=>Project,ok:(before:Project,after:Project)=>string)=>{setNotice(null);
  try{const before=live(),next=f(before);if(!onCommit(next)){setNotice({kind:'refused',text:'Refused: the project did not accept this revision. Nothing was applied.'});return false;}setNotice({kind:'ok',text:ok(before,live())});return true;}
  catch(e){setNotice({kind:'refused',text:errorMessage(e)});return false;}};
 const create=()=>{let operations:unknown;try{operations=JSON.parse(ops);}catch(e){setNotice({kind:'refused',text:`Operations are not valid JSON: ${errorMessage(e)}`});return;}
  if(act(d=>addVariant(d,{id:id.trim(),title:title.trim(),viewId,operations}),(b)=>`Variant ${id.trim()} recorded against revision ${b.revision} of view ${viewId}. Nothing in the model changed.`)){setSelected(id.trim());setId('');setTitle('');setOps('');}};
 const begin=()=>{setNotice(null);try{setDraft(startDraft(live(),{variantId:id,title,viewId}));}catch(e){setNotice({kind:'refused',text:errorMessage(e)});}};
 const record=(d:VariantDraft)=>{if(act(l=>recordDraft(l,d),(b)=>d.revises?`Variant ${d.variantId} revised against revision ${b.revision}. Nothing in the model changed.`:`Variant ${d.variantId} recorded against revision ${b.revision} of view ${d.viewId}. Nothing in the model changed.`)){setDraft(null);setSelected(d.variantId);setId('');setTitle('');}};
 if(draft)return <section className="inspector variants-panel" aria-label="Variants"><div className="eyebrow">VARIANTS</div>
  <DraftEditor key={draft.variantId} draft={draft} liveRevision={project.revision} onChange={setDraft} onRecord={record} onCancel={()=>{setDraft(null);setNotice({kind:'ok',text:'Draft discarded. Nothing in the model changed.'});}}/>
  {notice&&<p className={notice.kind==='ok'?'micro':'validation-error'} role={notice.kind==='ok'?'status':'alert'} data-testid="variant-notice">{notice.text}</p>}
 </section>;
 return <section className="inspector variants-panel" aria-label="Variants">
  <div className="eyebrow">VARIANTS</div><h2>Baseline-bound variants</h2>
  <p className="micro">A variant is a named change set against a recorded baseline of one view, not a second diagram. It stays a candidate: selecting it compares, and only Apply changes the model, as one undoable revision. Local, test and production instances are delivery declarations, not variants.</p>
  {variants.length===0?<p className="muted">No variant yet.</p>:<ul className="variant-list">{variants.map(v=>{const s=variantState(project,v.id).status;
   return <li key={v.id}><Button size="small" appearance={selected===v.id?'primary':'secondary'} aria-pressed={selected===v.id} onClick={()=>{setNotice(null);setSelected(selected===v.id?null:v.id);}}>{`Compare ${v.title}`}</Button> <span className={`chip variant-${s}`} data-variant-status={s}>{BADGE[s]}</span><br/><span className="micro">view {v.viewId} · baseline revision {v.base.revision} · <span className="stable-id">{v.id}</span>{v.origin!=='author'&&` · ${v.origin==='ai'?'AI suggestion':'imported'}${v.suggestedBy?` by ${v.suggestedBy}`:''}`}</span></li>;})}</ul>}
  {selection&&<section className="note-card" aria-label="Variant comparison">
   <p className="micro">{VARIANT_SELECT_NOTE}</p>
   <p className={selection.state.status==='current'?'micro':'revision-warning'} role={selection.state.status==='current'?'status':'alert'} data-testid="variant-state">{selection.state.message}</p>
   {selection.delta&&<><h3>Changes against the baseline</h3><ul data-testid="variant-ledger">{selection.delta.ledger.map((l,i)=><li key={i}>{l}</li>)}</ul></>}
   {selection.delta&&selection.state.candidate&&<VariantCompare baseline={project} candidate={selection.state.candidate} delta={selection.delta} selectedId={linked} onSelect={setLinked}/>}
   {selection.refused&&selection.state.status==='current'&&<p className="validation-error" role="alert">{selection.refused}</p>}
   {selection.preview&&<ChangePreview preview={selection.preview}/>}
   {rebase&&<div role="region" aria-label="Rebase check" data-testid="rebase-report"><h3>Before rebasing</h3>
    <p className={rebase.status==='clean'?'micro':'validation-error'} role={rebase.status==='clean'?'status':'alert'}>{rebase.message}</p>
    {rebase.conflicts.length>0&&<ul data-testid="rebase-conflicts">{rebase.conflicts.map(c=><li key={c.path}><code>{c.path}</code>: recorded {JSON.stringify(c.recorded)}, now {c.missing?'missing':JSON.stringify(c.current)}</li>)}</ul>}</div>}
   <div className="toolbar">
    <Button appearance="primary" disabled={selection.state.status!=='current'} onClick={()=>{const v=selection.state.variant;if(act(d=>applyVariant(d,v.id),(b,a)=>`Applied ${v.title} as revision ${a.revision}. One Undo restores revision ${b.revision} and the variant.`))setSelected(null);}}>Apply variant</Button>
    {selection.state.status==='current'&&<Button onClick={()=>{setNotice(null);try{setDraft(draftFromVariant(live(),selection.state.variant.id));}catch(e){setNotice({kind:'refused',text:errorMessage(e)});}}}>Edit candidate visually</Button>}
    {selection.state.status==='stale'&&<Button disabled={rebase?.status!=='clean'} onClick={()=>act(d=>rebaseVariant(d,selection.state.variant.id),(b)=>`Rebased on revision ${b.revision}. Compare again before applying.`)}>Rebase on current baseline</Button>}
    <Button onClick={()=>{const v=selection.state.variant;if(act(d=>discardVariant(d,v.id),()=>`Discarded ${v.title}. One Undo restores it.`))setSelected(null);}}>Discard variant</Button>
   </div></section>}
  {notice&&<p className={notice.kind==='ok'?'micro':'validation-error'} role={notice.kind==='ok'?'status':'alert'} data-testid="variant-notice">{notice.text}</p>}
  <form className="property-form" aria-label="New variant" onSubmit={e=>{e.preventDefault();create();}}>
   <h3>New variant of view {viewId}</h3>
   <label>Variant ID<input value={id} onChange={e=>setId(e.target.value)} placeholder="read-cache" pattern="[a-z][a-z0-9_.\-]{0,79}" required/></label>
   <label>Title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={160} required/></label>
   <Button appearance="primary" type="button" onClick={begin}>Draw the candidate</Button>
   <p className="micro">Opens the candidate editor: change components, connections and positions with the usual forms, compare side by side, then record. Nothing changes until you record it.</p>
   <h4>Advanced: write the operations</h4>
   <label>Operations (JSON Patch, @id addressing)<textarea value={ops} onChange={e=>setOps(e.target.value)} rows={7} spellCheck={false} placeholder={EXAMPLE} required/></label>
   <p className="micro">Components and connections the variant adds take IDs starting with “{id.trim()||'<variant ID>'}.”, so they never collide with canonical IDs.</p>
   <Button type="submit">Record variant</Button>
  </form>
 </section>;
}

type DraftProps={draft:VariantDraft;liveRevision:number;onChange:(d:VariantDraft)=>void;onRecord:(d:VariantDraft)=>void;onCancel:()=>void};
/** The candidate editor: ordinary component and connection editors on the temporary candidate, with a live linked comparison. */
function DraftEditor({draft,liveRevision,onChange,onRecord,onCancel}:DraftProps){
 const [item,setItem]=useState<{kind:'node'|'edge';id:string}|null>(null),[error,setError]=useState(''),[linked,setLinked]=useState<string|null>(null);
 const [label,setLabel]=useState(''),[kind,setKind]=useState<ProjectNode['kind']>('process'),[from,setFrom]=useState(''),[to,setTo]=useState(''),[edgeLabel,setEdgeLabel]=useState('');
 const c=draft.candidate,view=c.views.find(v=>v.id===draft.viewId)!,members=c.nodes.filter(n=>view.nodeIds.includes(n.id)),links=c.edges.filter(e=>view.edgeIds.includes(e.id));
 const name=(nid:string)=>c.nodes.find(n=>n.id===nid)?.label??nid;
 const operations=useMemo(()=>draftOperations(draft),[draft]);
 const delta=useMemo(()=>{try{return compareView(draft.baseline,c,draft.viewId,new Date(),'author');}catch{return null;}},[draft]);
 const run=(f:()=>VariantDraft)=>{setError('');try{onChange(f());return true;}catch(e){setError(errorMessage(e));return false;}};
 const node=item?.kind==='node'?c.nodes.find(n=>n.id===item.id):undefined,edge=item?.kind==='edge'?c.edges.find(e=>e.id===item.id):undefined;
 const pos=node?view.positions[node.id]:undefined;
 return <div role="region" aria-label="Candidate editor">
  <h2>{draft.revises?'Edit variant':'New variant'} · {draft.title}</h2>
  <p className="micro">{DRAFT_NOTE}</p>
  <p className="micro">Variant <span className="stable-id">{draft.variantId}</span> · view {draft.viewId} · baseline revision {draft.baseline.revision}. New components and connections get IDs starting with “{draft.variantId}.”.</p>
  {liveRevision!==draft.baseline.revision&&<p className="revision-warning" role="alert">The project changed since this draft started (revision {draft.baseline.revision} → {liveRevision}). Recording checks every precondition and refuses a field someone else changed.</p>}
  <h3>Components in this view</h3>
  <ul className="variant-list">{members.map(n=><li key={n.id}><Button size="small" appearance={item?.id===n.id?'primary':'secondary'} aria-pressed={item?.id===n.id} onClick={()=>{setItem(item?.id===n.id?null:{kind:'node',id:n.id});setLinked(n.id);}}>{`Edit component ${n.label}`}</Button> <span className="stable-id">{n.id}</span></li>)}</ul>
  <h3>Connections in this view</h3>
  {links.length?<ul className="variant-list">{links.map(e=><li key={e.id}><Button size="small" appearance={item?.id===e.id?'primary':'secondary'} aria-pressed={item?.id===e.id} onClick={()=>{setItem(item?.id===e.id?null:{kind:'edge',id:e.id});setLinked(e.id);}}>{`Edit connection ${name(e.source)} → ${name(e.target)}`}</Button></li>)}</ul>:<p className="muted">No connection.</p>}
  {node&&<div role="region" aria-label="Candidate component">
   <Inspector doc={c} node={node} edit onUpdate={n=>run(()=>draftUpdateNode(draft,n))} onDelete={()=>{if(run(()=>draftRemoveNode(draft,node.id)))setItem(null);}} onChild={()=>setError(NOT_IN_VARIANT)} onBlock={()=>setError(NOT_IN_VARIANT)} onBlocks={()=>setError(NOT_IN_VARIANT)} onReorder={()=>setError(NOT_IN_VARIANT)} onDetach={()=>setError(NOT_IN_VARIANT)} onImage={()=>setError(NOT_IN_VARIANT)} onError={setError}/>
   <p className="micro">“Delete component” here takes it out of this view only; a canonical component stays in the project and in its other views.</p>
   <form className="property-form" aria-label="Candidate position" key={`${node.id}-${pos?.x}-${pos?.y}`} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);run(()=>draftMoveNode(draft,node.id,{x:Number(f.get('x')),y:Number(f.get('y'))}));}}>
    <div className="two-fields"><label>X<input name="x" type="number" step={10} defaultValue={pos?.x??0} required/></label><label>Y<input name="y" type="number" step={10} defaultValue={pos?.y??0} required/></label></div>
    <Button type="submit">Move component</Button>
   </form></div>}
  {edge&&<div role="region" aria-label="Candidate connection"><EdgeInspector key={edge.id} edge={edge} onUpdate={e=>run(()=>draftUpdateEdge(draft,e))} onDelete={()=>{if(run(()=>draftRemoveEdge(draft,edge.id)))setItem(null);}}/>
   <p className="micro">“Delete connection” here takes it out of this view only; a canonical connection stays in the project.</p></div>}
  <form className="property-form" aria-label="Add candidate component" onSubmit={e=>{e.preventDefault();setError('');try{const r=draftAddNode(draft,{label,kind});onChange(r.draft);setItem({kind:'node',id:r.id});setLinked(r.id);setLabel('');}catch(x){setError(errorMessage(x));}}}>
   <h3>Add a component</h3>
   <div className="two-fields"><label>New component label<input value={label} onChange={e=>setLabel(e.target.value)} maxLength={160} required/></label><label>Kind<select value={kind} onChange={e=>setKind(e.target.value as ProjectNode['kind'])}>{KINDS.map(k=><option key={k}>{k}</option>)}</select></label></div>
   <Button type="submit">Add component</Button>
  </form>
  <form className="property-form" aria-label="Add candidate connection" onSubmit={e=>{e.preventDefault();setError('');try{const r=draftAddEdge(draft,{source:from,target:to,label:edgeLabel});onChange(r.draft);setItem({kind:'edge',id:r.id});setLinked(r.id);setEdgeLabel('');}catch(x){setError(errorMessage(x));}}}>
   <h3>Add a connection</h3>
   <div className="two-fields"><label>From<select value={from} onChange={e=>setFrom(e.target.value)} required><option value="">Choose…</option>{members.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label><label>To<select value={to} onChange={e=>setTo(e.target.value)} required><option value="">Choose…</option>{members.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label></div>
   <label>Connection label<input value={edgeLabel} onChange={e=>setEdgeLabel(e.target.value)} maxLength={160}/></label>
   <Button type="submit">Add connection</Button>
  </form>
  {error&&<p className="validation-error" role="alert" data-testid="draft-error">{error}</p>}
  {delta&&<><h3>Changes against the baseline</h3><ul data-testid="draft-ledger">{delta.ledger.length?delta.ledger.map((l,i)=><li key={i}>{l}</li>):<li>No change yet.</li>}</ul>
   <VariantCompare baseline={draft.baseline} candidate={c} delta={delta} selectedId={linked} onSelect={setLinked}/></>}
  <details><summary>Advanced: the {operations.length} operation(s) this draft records</summary><pre className="micro" data-testid="draft-operations" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(operations,null,1)}</pre>
   <p className="micro">Each changed or removed value is preceded by a <code>test</code> of its baseline value, so a concurrent edit of the same field refuses the variant instead of being overwritten.</p></details>
  <div className="toolbar">
   <Button appearance="primary" disabled={!operations.length} onClick={()=>onRecord(draft)}>{draft.revises?'Save variant changes':'Record variant from draft'}</Button>
   <Button onClick={onCancel}>Cancel draft</Button>
  </div>
 </div>;
}
