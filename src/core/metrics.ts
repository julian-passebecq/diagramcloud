import {blockSchema,type EvidenceBlock} from './model';

/**
 * Metrics evidence authoring: the form edits a draft, and only a draft that passes blockSchema becomes a block.
 * Kept free of React so the rules are unit-tested and shared by the add and edit paths.
 */
export type MetricsBlock=Extract<EvidenceBlock,{type:'metrics'}>;
export type MetricRow={label:string;value:string;note:string};
export type MetricsDraft={title:string;provenance:EvidenceBlock['provenance'];sourceIds:string[];items:MetricRow[]};
export const MAX_METRICS=12;
export const emptyMetric=():MetricRow=>({label:'',value:'',note:''});

export function draftOf(block:MetricsBlock):MetricsDraft{
 return {title:block.title,provenance:block.provenance,sourceIds:[...block.sourceIds],items:block.items.length?block.items.map(i=>({...i})):[emptyMetric()]};
}

/** Trims every field and drops rows left completely empty; a row with a value or note but no label is an error. */
export function metricsBlock(draft:MetricsDraft,base:Pick<MetricsBlock,'id'>&Partial<Pick<MetricsBlock,'visibility'>>):MetricsBlock{
 const items=draft.items.map(i=>({label:i.label.trim(),value:i.value.trim(),note:i.note.trim()})).filter(i=>i.label||i.value||i.note);
 items.forEach((i,n)=>{if(!i.label)throw new Error(`Metric ${n+1}: add a label (what the number measures).`);});
 if(!items.length)throw new Error('Add at least one metric with a label.');
 if(items.length>MAX_METRICS)throw new Error(`A metrics block holds at most ${MAX_METRICS} metrics.`);
 return blockSchema.parse({id:base.id,title:draft.title.trim(),type:'metrics',provenance:draft.provenance,sourceIds:draft.sourceIds,visibility:base.visibility??'public',items}) as MetricsBlock;
}

/** A nudge, not a block: numbers without a source read as verified claims unless they are marked synthetic. */
export function metricsWarning(draft:Pick<MetricsDraft,'provenance'|'sourceIds'>):string|null{
 if(draft.provenance==='synthetic')return null;
 if(draft.sourceIds.length)return null;
 return draft.provenance==='source-derived'
  ?'Source-derived numbers should link the source they came from.'
  :'These numbers are not linked to a source. Mark illustrative figures as synthetic, or link the source they came from.';
}
