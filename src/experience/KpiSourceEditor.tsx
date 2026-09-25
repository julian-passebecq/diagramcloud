import {useState} from 'react';
import {Button} from '@fluentui/react-components';
import type {ExperienceItem,ExperiencePack} from './model';
import {METRIC_LABEL,countableSources,kpiDisplay,publicWarning,withSource,type KpiMetric} from './kpi';

type Kpi=Extract<ExperienceItem,{type:'kpi'}>;

/** Choose what a KPI tile counts (a model or table and one of its counts) or go back to a typed value. One undo step per apply. */
export function KpiSourceEditor(p:{pack:ExperiencePack;item:Kpi;onApply:(edit:{item:Kpi;label:string})=>void;onClose:()=>void}){
 const i=p.item,sources=countableSources(p.pack);
 const [sourceId,setSourceId]=useState(i.derive?.itemId??''),[metric,setMetric]=useState<KpiMetric|''>(i.derive?.metric??''),[note,setNote]=useState(i.note);
 const counts=sources.find(s=>s.item.id===sourceId)?.counts??{},metrics=Object.keys(counts) as KpiMetric[];
 const pick=(id:string)=>{
  setSourceId(id);
  const next=sources.find(s=>s.item.id===id)?.counts;
  if(!next){if(i.derive&&note===i.note)setNote(kpiDisplay(p.pack,i).note);return;}
  if(!metric||next[metric]===undefined)setMetric(Object.keys(next)[0] as KpiMetric);
 };
 let edit:{item:Kpi;label:string}|null=null,error='';
 try{edit=withSource(p.pack,i,sourceId&&metric?{itemId:sourceId,metric}:null,note);}catch(x){error=x instanceof Error?x.message:String(x);}
 const shown=edit?kpiDisplay(p.pack,edit.item):null,warning=sourceId?publicWarning(p.pack,i,sourceId):null;
 return <form className="xp-model-editor xp-kpi-editor" aria-label={`Count source for ${i.title}`} onSubmit={e=>{e.preventDefault();if(edit?.label)p.onApply(edit);}}>
  <header><strong>Count source: {i.title}</strong><span className="xp-muted">Count tables, relationships, measures or rows instead of typing a number. The tile recounts whenever the source changes.</span><Button size="small" onClick={p.onClose}>Close count source</Button></header>
  <div className="xp-model-row">
   <label>Counts from <select aria-label="Count from" value={sourceId} onChange={e=>pick(e.target.value)}>
    <option value="">Nothing: typed value</option>
    {sources.map(s=><option key={s.item.id} value={s.item.id}>{s.item.title} ({s.item.type})</option>)}
   </select></label>
   <label>Count <select aria-label="Count" value={metric} disabled={!sourceId} onChange={e=>setMetric(e.target.value as KpiMetric)}>
    {!sourceId&&<option value="">—</option>}
    {metrics.map(m=><option key={m} value={m}>{METRIC_LABEL[m]} ({counts[m]})</option>)}
   </select></label>
  </div>
  <div className="xp-model-row"><label style={{flex:1}}>Note <input aria-label="Tile note" style={{flex:1}} value={note} maxLength={1000} onChange={e=>setNote(e.target.value)}/></label></div>
  {sourceId&&<p className="xp-muted xp-kpi-tokens">Tokens for the note: {metrics.map(m=><code key={m}>{`{${m}}`}={counts[m]}</code>)}</p>}
  {!sourceId&&i.derive&&<p className="xp-muted xp-kpi-tokens">The current count and note are kept as typed text.</p>}
  {warning&&<p role="note" className="xp-alert">{warning}</p>}
  {error&&<p role="alert" className="xp-model-error">{error}</p>}
  <div className="xp-model-row">
   {shown&&<output aria-label="Tile preview" className="xp-kpi-preview"><strong>{shown.value}{i.unit?` ${i.unit}`:''}</strong>{shown.note&&<> · {shown.note}</>}{shown.from&&<small> (counted from {shown.from})</small>}</output>}
   <Button size="small" appearance="primary" type="submit" disabled={!edit?.label}>Apply count source</Button>
  </div>
 </form>;
}
