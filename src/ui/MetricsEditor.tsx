import {useState} from 'react';
import {Button} from '@fluentui/react-components';
import {errorMessage,type Project} from '../core/model';
import {MAX_METRICS,draftOf,emptyMetric,metricsBlock,metricsWarning,type MetricRow,type MetricsBlock,type MetricsDraft} from '../core/metrics';

type Props={sources:Project['sources'];block?:MetricsBlock;newId:()=>string;submitLabel:string;onSubmit:(block:MetricsBlock)=>void;onError:(error:string)=>void};

/** Visual editor for a metrics evidence block: one row per KPI card, with provenance and sources kept explicit. */
export function MetricsEditor(p:Props){
 const fresh=():MetricsDraft=>p.block?draftOf(p.block):{title:'',provenance:'synthetic',sourceIds:[],items:[emptyMetric()]};
 const [draft,setDraft]=useState(fresh);
 const set=(patch:Partial<MetricsDraft>)=>setDraft(d=>({...d,...patch}));
 const setRow=(i:number,patch:Partial<MetricRow>)=>set({items:draft.items.map((r,n)=>n===i?{...r,...patch}:r)});
 const move=(i:number,delta:number)=>{const items=[...draft.items],[row]=items.splice(i,1);items.splice(i+delta,0,row);set({items});};
 const toggleSource=(id:string,on:boolean)=>set({sourceIds:on?[...draft.sourceIds,id]:draft.sourceIds.filter(s=>s!==id)});
 const warning=metricsWarning(draft),preview=draft.items.filter(r=>r.label.trim()||r.value.trim());
 return <form className="property-form metrics-editor" onSubmit={e=>{e.preventDefault();try{p.onSubmit(metricsBlock(draft,p.block??{id:p.newId()}));if(!p.block)setDraft(fresh());}catch(error){p.onError(errorMessage(error));}}}>
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
   <div className="toolbar"><Button size="small" appearance="subtle" aria-label={`Move metric ${i+1} up`} disabled={i===0} onClick={()=>move(i,-1)}>↑</Button><Button size="small" appearance="subtle" aria-label={`Move metric ${i+1} down`} disabled={i===draft.items.length-1} onClick={()=>move(i,1)}>↓</Button><Button size="small" appearance="subtle" aria-label={`Remove metric ${i+1}`} disabled={draft.items.length===1} onClick={()=>set({items:draft.items.filter((_,n)=>n!==i)})}>Remove</Button></div>
  </fieldset>)}
  <Button size="small" disabled={draft.items.length>=MAX_METRICS} onClick={()=>set({items:[...draft.items,emptyMetric()]})}>+ Add metric</Button>
  {preview.length>0&&<div className="metrics metrics-preview" aria-label="Metrics preview">{preview.map((r,i)=><div key={i}><strong>{r.value}</strong><span>{r.label}</span>{r.note&&<small>{r.note}</small>}</div>)}</div>}
  <Button appearance="primary" type="submit">{p.submitLabel}</Button>
 </form>;
}
