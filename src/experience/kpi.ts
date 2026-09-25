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

export const METRIC_LABEL:Record<KpiMetric,string>={tables:'Tables',facts:'Fact tables',dimensions:'Dimension tables',relationships:'Relationships',active:'Active relationships',inactive:'Inactive relationships',measures:'Measures',columns:'Columns',rows:'Rows'};

/** Items a tile can count from, with the counts each one offers. */
export function countableSources(p:ExperiencePack):{item:ExperienceItem;counts:Partial<Record<KpiMetric,number>>}[]{
 return p.items.flatMap(item=>{const counts=countsOf(item);return counts?[{item,counts}]:[];});
}

export type KpiSource={itemId:string;metric:KpiMetric}|null;
/**
 * Point a tile at a source (or back to a typed value). The stored value is refreshed to what the tile shows, so the
 * fallback used when the source is later removed is current. Going back to typed freezes the counted value and fills
 * the note's {tokens} from the old source, so the tile looks the same until someone edits it. Empty label = no change.
 */
export function withSource(p:ExperiencePack,i:Kpi,source:KpiSource,note:string):{item:Kpi;label:string}{
 const same=(source?.itemId??'')===(i.derive?.itemId??'')&&(source?.metric??'')===(i.derive?.metric??'')&&note===i.note;
 if(same)return {item:i,label:''};
 if(!source){
  const shown=kpiDisplay(p,{...i,note}),{derive:_,...rest}=i;
  return {item:{...rest,value:shown.value,note:shown.note},label:`Typed value: “${i.title}”`};
 }
 const src=p.items.find(x=>x.id===source.itemId);
 if(!src||src.id===i.id)throw new Error('Choose a model or table to count from.');
 const n=countsOf(src)?.[source.metric];
 if(n===undefined)throw new Error(`“${src.title}” cannot provide ${METRIC_LABEL[source.metric].toLowerCase()}.`);
 return {item:{...i,derive:{...source},value:n.toLocaleString('en-US'),note},label:`Count source: “${i.title}” counts ${METRIC_LABEL[source.metric].toLowerCase()} of “${src.title}”`};
}

/** Why a tile counting this source would be left out of public exports, or null. Mirrors publicPack's item rule. */
export function publicWarning(p:ExperiencePack,i:Kpi,sourceId:string):string|null{
 const src=p.items.find(x=>x.id===sourceId);if(!src||i.visibility!=='public')return null;
 const privateSource=src.sourceIds.find(s=>p.sources.find(x=>x.id===s)?.visibility!=='public');
 const why=src.visibility!=='public'?'is private':src.approval!=='approved'?`is ${src.approval}, not approved`:privateSource?'cites a private source':null;
 return why?`“${src.title}” ${why}, so this tile will be left out of public exports (a count can reveal what was redacted).`:null;
}
