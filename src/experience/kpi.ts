import type {ExperienceItem,ExperiencePack} from './model';

/**
 * KPI tiles that count from another item instead of repeating a typed number. The count is computed wherever the
 * tile is drawn (app, HTML, PowerPoint), so editing the source item updates the tile. The note may use {tokens}
 * for the same counts. When the source is missing, the stored value is shown and nothing is counted.
 */
export const MODEL_METRICS=['tables','facts','dimensions','relationships','active','inactive','measures','columns'] as const;
export const TABLE_METRICS=['rows'] as const;
export const KPI_METRICS=[...MODEL_METRICS,...TABLE_METRICS] as const;
export type KpiMetric=typeof KPI_METRICS[number];
type Kpi=Extract<ExperienceItem,{type:'kpi'}>;

/** Every count an item can provide, or null when the item cannot be counted. */
export function countsOf(source:ExperienceItem|undefined):Partial<Record<KpiMetric,number>>|null{
 if(source?.type==='model'){
  const active=source.relationships.filter(r=>r.active).length;
  return {tables:source.tables.length,facts:source.tables.filter(t=>t.kind==='fact').length,dimensions:source.tables.filter(t=>t.kind==='dimension').length,
   relationships:source.relationships.length,active,inactive:source.relationships.length-active,measures:source.measures.length,columns:source.tables.reduce((n,t)=>n+t.columns.length,0)};
 }
 if(source?.type==='table')return {rows:source.rows.length};
 return null;
}
export const metricFits=(source:ExperienceItem|undefined,metric:KpiMetric)=>countsOf(source)?.[metric]!==undefined;

export type KpiDisplay={value:string;note:string;from?:string};
/** Value and note as they should be shown. `from` names the counted item when the tile is derived. */
export function kpiDisplay(p:ExperiencePack,i:Kpi):KpiDisplay{
 if(!i.derive)return {value:i.value,note:i.note};
 const source=p.items.find(x=>x.id===i.derive!.itemId),counts=countsOf(source),n=counts?.[i.derive.metric];
 if(n===undefined||!counts||!source)return {value:i.value,note:i.note};
 const note=i.note.replace(/\{(\w+)\}/g,(whole,key:string)=>{const v=counts[key as KpiMetric];return v===undefined?whole:String(v);});
 return {value:n.toLocaleString('en-US'),note,from:source.title};
}
