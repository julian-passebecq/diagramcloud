import {useState} from 'react';
import {Button} from '@fluentui/react-components';
import {errorMessage,type Project} from '../core/model';
import {MAX_METRICS,draftOf,emptyMetric,metricsBlock,metricsWarning,type MetricRow,type MetricsBlock,type MetricsDraft} from '../core/metrics';
import {emptyMeasure,measureClashes,measureDraftOf,measureErrors,measureOf,type MeasureDraft} from '../core/evidenceForms';

type Props={sources:Project['sources'];block?:MetricsBlock;newId:()=>string;submitLabel:string;onSubmit:(block:MetricsBlock)=>void;onError:(error:string)=>void};
/** A form row: the KPI card text, and an optional structured reading as typed (the value stays text until it parses). */
type Row=Omit<MetricRow,'measure'>&{reading?:MeasureDraft};
type Draft=Omit<MetricsDraft,'items'>&{items:Row[]};
const rowOf=({measure,...r}:MetricRow):Row=>({...r,...(measure?{reading:measureDraftOf(measure)}:{})});

/**
 * Visual editor for a metrics evidence block: one row per KPI card, with provenance and sources kept explicit. A row may
 * carry a structured baseline or current reading (metric, value, unit, scope, window, basis) for the comparison figure;
 * its errors are shown beside it, nothing is repaired, and applying is one edit.
 */
export function MetricsEditor(p:Props){
 const fresh=():Draft=>{const d:MetricsDraft=p.block?draftOf(p.block):{title:'',provenance:'synthetic',sourceIds:[],items:[emptyMetric()]};return {...d,items:d.items.map(rowOf)};};
 const [draft,setDraft]=useState(fresh),[tried,setTried]=useState(false);
 const set=(patch:Partial<Draft>)=>setDraft(d=>({...d,...patch}));
 const setRow=(i:number,patch:Partial<Row>)=>setDraft(d=>({...d,items:d.items.map((r,n)=>n===i?{...r,...patch}:r)}));
 const setReading=(i:number,patch:Partial<MeasureDraft>)=>setDraft(d=>({...d,items:d.items.map((r,n)=>n===i&&r.reading?{...r,reading:{...r.reading,...patch}}:r)}));
 const move=(i:number,delta:number)=>{const items=[...draft.items],[row]=items.splice(i,1);items.splice(i+delta,0,row);set({items});};
 const toggleSource=(id:string,on:boolean)=>set({sourceIds:on?[...draft.sourceIds,id]:draft.sourceIds.filter(s=>s!==id)});
 const warning=metricsWarning(draft),preview=draft.items.filter(r=>r.label.trim()||r.value.trim());
 const readingErrors=draft.items.map(r=>r.reading?measureErrors(r.reading,draft.provenance):[]),clashes=measureClashes(draft.items.map(r=>({...(r.reading?{measure:r.reading}:{})})));
 const blocked=readingErrors.some(e=>e.length>0)||clashes.length>0;
 const submit=()=>{setTried(true);
  const first=readingErrors.map((e,n)=>e.length?`Metric ${n+1} reading: ${e[0]}`:'').find(Boolean)??clashes[0];if(first)throw new Error(first);
  const items:MetricRow[]=draft.items.map(({reading,...r})=>({...r,...(reading?{measure:measureOf(reading,draft.provenance)}:{})}));
  p.onSubmit(metricsBlock({...draft,items},p.block??{id:p.newId()}));if(!p.block){setDraft(fresh());setTried(false);}};
 return <form className="property-form metrics-editor" onSubmit={e=>{e.preventDefault();try{submit();}catch(error){p.onError(errorMessage(error));}}}>
  <label>Title<input aria-label="Metrics title" required maxLength={160} value={draft.title} onChange={e=>set({title:e.target.value})}/></label>
  <label>Provenance<select aria-label="Metrics provenance" value={draft.provenance} onChange={e=>set({provenance:e.target.value as MetricsDraft['provenance']})}>
   <option value="synthetic">Synthetic / illustrative numbers</option><option value="source-derived">Source-derived</option><option value="reference">Reference</option><option value="author">Author-supplied</option>
  </select></label>
  {p.sources.length>0&&<fieldset className="metric-sources"><legend>Sources</legend>{p.sources.map(s=><label key={s.id} className="check"><input type="checkbox" checked={draft.sourceIds.includes(s.id)} onChange={e=>toggleSource(s.id,e.target.checked)}/>{s.title}</label>)}</fieldset>}
  {warning&&<p className="micro metric-warning" role="note">{warning}</p>}
  {draft.items.map((r,i)=><fieldset key={i} className="metric-row"><legend>Metric {i+1}</legend>
   <div className="two-fields"><label>Value<input aria-label={`Metric ${i+1} value`} maxLength={80} placeholder="e.g. 42 %" value={r.value} onChange={e=>setRow(i,{value:e.target.value})}/></label>
   <label>Label<input aria-label={`Metric ${i+1} label`} maxLength={160} placeholder="What it measures" value={r.label} onChange={e=>setRow(i,{label:e.target.value})}/></label></div>
   <label>Note<input aria-label={`Metric ${i+1} note`} maxLength={500} placeholder="Scope, period or caveat" value={r.note} onChange={e=>setRow(i,{note:e.target.value})}/></label>
   {r.reading?<ReadingFields n={i+1} m={r.reading} set={patch=>setReading(i,patch)} errors={readingErrors[i]} show={tried||!!(r.reading.value||r.reading.from||r.reading.to)} onRemove={()=>setRow(i,{reading:undefined})}/>
    :<Button size="small" appearance="subtle" aria-label={`Add a structured reading to metric ${i+1}`} onClick={()=>setRow(i,{reading:{...emptyMeasure(r.label.trim()),basis:draft.provenance==='synthetic'?'estimate':'measured'}})}>+ Baseline or current reading</Button>}
   <div className="toolbar"><Button size="small" appearance="subtle" aria-label={`Move metric ${i+1} up`} disabled={i===0} onClick={()=>move(i,-1)}>↑</Button><Button size="small" appearance="subtle" aria-label={`Move metric ${i+1} down`} disabled={i===draft.items.length-1} onClick={()=>move(i,1)}>↓</Button><Button size="small" appearance="subtle" aria-label={`Remove metric ${i+1}`} disabled={draft.items.length===1} onClick={()=>set({items:draft.items.filter((_,n)=>n!==i)})}>Remove</Button></div>
  </fieldset>)}
  {clashes.map((m,i)=><p key={i} className="micro metric-warning" role="note">{m}</p>)}
  <Button size="small" disabled={draft.items.length>=MAX_METRICS} onClick={()=>set({items:[...draft.items,emptyMetric()]})}>+ Add metric</Button>
  {preview.length>0&&<div className="metrics metrics-preview" aria-label="Metrics preview">{preview.map((r,i)=><div key={i}><strong>{r.value}</strong><span>{r.label}</span>{r.note&&<small>{r.note}</small>}</div>)}</div>}
  <Button appearance="primary" type="submit" disabled={tried&&blocked}>{p.submitLabel}</Button>
 </form>;
}
/** The structured reading of one metric: what the comparison figure reads. Supplied values only; nothing is inferred. */
function ReadingFields({n,m,set,errors,show,onRemove}:{n:number;m:MeasureDraft;set:(patch:Partial<MeasureDraft>)=>void;errors:string[];show:boolean;onRemove:()=>void}){
 return <fieldset className="metric-reading" aria-label={`Metric ${n} reading`}><legend>Reading for the comparison figure</legend>
  <div className="two-fields"><label>Role<select aria-label={`Metric ${n} reading role`} value={m.role} onChange={e=>set({role:e.target.value as MeasureDraft['role']})}><option value="baseline">Baseline</option><option value="current">Current</option></select></label>
  <label>Basis<select aria-label={`Metric ${n} reading basis`} value={m.basis} onChange={e=>set({basis:e.target.value as MeasureDraft['basis']})}><option value="measured">Measured (supplied measurement)</option><option value="estimate">Estimate</option><option value="derived">Derived (arithmetic over supplied values)</option></select></label></div>
  <div className="two-fields"><label>Metric<input aria-label={`Metric ${n} reading metric`} maxLength={160} placeholder="e.g. p95 latency" value={m.metric} onChange={e=>set({metric:e.target.value})}/></label>
  <label>Scope<input aria-label={`Metric ${n} reading scope`} maxLength={160} placeholder="e.g. checkout API" value={m.scope} onChange={e=>set({scope:e.target.value})}/></label></div>
  <div className="two-fields"><label>Number<input aria-label={`Metric ${n} reading value`} inputMode="decimal" maxLength={40} placeholder="e.g. 420" value={m.value} onChange={e=>set({value:e.target.value})}/></label>
  <label>Unit<input aria-label={`Metric ${n} reading unit`} maxLength={24} placeholder="e.g. ms" value={m.unit} onChange={e=>set({unit:e.target.value})}/></label></div>
  <div className="two-fields"><label>Window from<input aria-label={`Metric ${n} reading window from`} maxLength={40} placeholder="2026-09-01" value={m.from} onChange={e=>set({from:e.target.value})}/></label>
  <label>Window to<input aria-label={`Metric ${n} reading window to`} maxLength={40} placeholder="2026-09-07" value={m.to} onChange={e=>set({to:e.target.value})}/></label></div>
  {show&&errors.map((x,i)=><p key={i} className="micro metric-warning" role="note" data-reading-error={n}>{x}</p>)}
  <p className="micro">A baseline and a current reading of one metric, unit and scope over windows of equal length are compared; a difference is not a cause.</p>
  <Button size="small" appearance="subtle" aria-label={`Remove the reading of metric ${n}`} onClick={onRemove}>Remove reading</Button>
 </fieldset>;
}
