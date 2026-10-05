import {blockSchema,type EvidenceBlock} from './model';

/**
 * "Explain a transformation": input rows → logic → output rows, plus column mappings and the rules (grain, join
 * keys, quality rules, validation expectations, caveats). Each part is an ordinary evidence block tagged with its
 * `transform` step, so the tables, code and provenance primitives are reused. Nothing is executed: the logic is
 * displayed, and the rows are representative examples.
 */
export const TRANSFORM_STEPS=['input','logic','output','mapping','rules'] as const;
export type TransformStep=typeof TRANSFORM_STEPS[number];
export const TRANSFORM_LABEL:Record<TransformStep,string>={input:'Input rows',logic:'Transformation logic',output:'Output rows',mapping:'Column mapping',rules:'Grain, keys and quality rules'};
export const TRANSFORM_NOTE='Explanatory only: the logic is displayed, never executed, and the rows are representative examples.';

/** The blocks of one transformation, in reading order. Blocks without a step are left out. */
export function transformationParts(blocks:EvidenceBlock[]):Partial<Record<TransformStep,EvidenceBlock[]>>{
 const out:Partial<Record<TransformStep,EvidenceBlock[]>>={};
 for(const b of blocks)if(b.transform)(out[b.transform]??=[]).push(b);
 return out;
}
export const hasTransformation=(blocks:EvidenceBlock[])=>blocks.some(b=>b.transform==='input')&&blocks.some(b=>b.transform==='output');

/**
 * A starting skeleton the author then edits visually. Example rows are marked synthetic: they illustrate the
 * shape of the data, they are not a sample of a real system.
 */
export function transformationTemplate(name:string,newId:(prefix:string)=>string):EvidenceBlock[]{
 const title=name.trim()||'Transformation';
 return [
  {id:newId('input'),type:'table',transform:'input',title:`${title} · input rows`,provenance:'synthetic',visibility:'public',sourceIds:[],columns:['order_id','customer_id','amount','currency','order_ts'],rows:[['A-1001','C-17',120.5,'EUR','2026-09-01T10:02:00Z'],['A-1001','C-17',120.5,'EUR','2026-09-01T10:02:00Z'],['A-1002','C-04',null,'EUR','2026-09-01T11:15:00Z']]},
  {id:newId('logic'),type:'code',transform:'logic',language:'sql',title:`${title} · logic`,provenance:'author',visibility:'public',sourceIds:[],code:'-- Display only: DiagramCloud never runs this.\nselect order_id, customer_id, amount, currency, cast(order_ts as date) as order_date\nfrom raw_orders\nwhere amount is not null\nqualify row_number() over (partition by order_id order by order_ts desc) = 1;'},
  {id:newId('output'),type:'table',transform:'output',title:`${title} · output rows`,provenance:'synthetic',visibility:'public',sourceIds:[],columns:['order_id','customer_id','amount','currency','order_date'],rows:[['A-1001','C-17',120.5,'EUR','2026-09-01']]},
  {id:newId('mapping'),type:'table',transform:'mapping',title:`${title} · column mapping`,provenance:'author',visibility:'public',sourceIds:[],columns:['Output column','From input','Rule'],rows:[['order_id','order_id','Key; one row per order after deduplication'],['order_date','order_ts','Date part of the timestamp (UTC)'],['amount','amount','Rows with a missing amount are rejected']]},
  {id:newId('rules'),type:'table',transform:'rules',title:`${title} · grain, keys and quality rules`,provenance:'author',visibility:'public',sourceIds:[],columns:['Aspect','Statement'],rows:[['Grain','One row per order_id'],['Join key','customer_id → customers.customer_id'],['Quality rule','amount is not null; currency is ISO 4217'],['Validation expectation','Output rows ≤ input rows; no duplicate order_id'],['Caveat','Example rows are synthetic and only show the shape of the data']]}
 ].map(b=>blockSchema.parse(b));
}
