import {MEASURE_BASES,MEASURE_ROLES,SCHEDULE_BASES,SCHEDULE_TIMEZONE,blockSchema,timingErrors,type EvidenceBlock} from './model';
import {DURATION,intervalOf,isError,windowOf} from './schedule';

/**
 * Form drafts for structured evidence: schedule blocks (Gantt items) and metrics readings (baseline/current measures).
 * A draft holds the text the author typed; its errors are reported per field and nothing is repaired, coerced or guessed.
 * Only a draft without errors becomes a block, through blockSchema and the same timing checks as validateDocument.
 * Kept free of React so the rules are unit-tested and shared by the add and edit paths.
 */
export type ScheduleBlock=Extract<EvidenceBlock,{type:'schedule'}>;
export type ScheduleItemDraft={id:string;label:string;nodeIds:string[];start:string;end:string;duration:string;basis:typeof SCHEDULE_BASES[number];note:string};
export type ScheduleDraft=Pick<ScheduleBlock,'title'|'provenance'|'visibility'|'sourceIds'|'transform'>&{timezone:string;items:ScheduleItemDraft[]};
export const MAX_SCHEDULE_ITEMS=100;
const ID=/^[a-z][a-z0-9_.-]{0,79}$/;

/** A new item with an ID not used in the draft (item-1, item-2, ...). The author may rename it before the first apply. */
export function emptyScheduleItem(taken:readonly string[]=[]):ScheduleItemDraft{
 let n=taken.length+1;while(taken.includes(`item-${n}`))n++;
 return {id:`item-${n}`,label:'',nodeIds:[],start:'',end:'',duration:'',basis:'supplied',note:''};
}
export const emptySchedule=():ScheduleDraft=>({title:'',provenance:'author',visibility:'public',sourceIds:[],timezone:'date-only',items:[emptyScheduleItem()]});
export function scheduleDraftOf(b:ScheduleBlock):ScheduleDraft{
 return {title:b.title,provenance:b.provenance,visibility:b.visibility,sourceIds:[...b.sourceIds],...(b.transform?{transform:b.transform}:{}),timezone:b.timezone,
  items:b.items.map(i=>({id:i.id,label:i.label,nodeIds:[...i.nodeIds],start:i.start,end:i.end??'',duration:i.duration??'',basis:i.basis,note:i.note??''}))};
}
export type ScheduleErrors={block:string[];items:string[][]};
/** Every error of the draft, per item and for the block; an empty result means the draft can be applied. */
export function scheduleErrors(d:ScheduleDraft,nodeIds:readonly string[]):ScheduleErrors{
 const block:string[]=[],seen=new Set<string>(),known=new Set(nodeIds),dateOnly=d.timezone==='date-only';
 if(!d.title.trim())block.push('Add a title.');
 if(!SCHEDULE_TIMEZONE.test(d.timezone))block.push('Time basis: use date-only, UTC, an offset such as +02:00 or a time zone name such as Europe/Paris.');
 if(!d.items.length)block.push('Add at least one schedule item.');
 if(d.items.length>MAX_SCHEDULE_ITEMS)block.push(`A schedule holds at most ${MAX_SCHEDULE_ITEMS} items.`);
 const items=d.items.map(i=>{const e:string[]=[];
  if(!ID.test(i.id))e.push('ID: use a stable lowercase ID such as item-1.');else if(seen.has(i.id))e.push(`ID ${i.id} is used twice in this schedule.`);seen.add(i.id);
  if(!i.label.trim())e.push('Add a label.');
  for(const id of i.nodeIds)if(!known.has(id))e.push(`Component ${id} is not in this document.`);
  if(i.duration.trim()&&!DURATION.test(i.duration.trim()))e.push(`Duration ${i.duration.trim()} is not an ISO 8601 duration such as P5D, P2W or PT6H.`);
  else if(!i.start.trim())e.push(`Add a start (${dateOnly?'a date such as 2026-10-16':'a timestamp with an offset such as 2026-10-16T09:00:00Z'}).`);
  else{const x=intervalOf(itemOf(i),dateOnly);if(isError(x))e.push(sentence(x.error));}
  return e;});
 return {block,items};
}
export const hasErrors=(e:ScheduleErrors)=>e.block.length>0||e.items.some(x=>x.length>0);
const sentence=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1)+'.';
const itemOf=(i:ScheduleItemDraft)=>({id:i.id,label:i.label.trim(),nodeIds:i.nodeIds,start:i.start.trim(),...(i.end.trim()?{end:i.end.trim()}:{}),...(i.duration.trim()?{duration:i.duration.trim()}:{}),basis:i.basis,...(i.note.trim()?{note:i.note.trim()}:{})});
/** The block for a draft without errors; otherwise the first error is thrown and nothing is applied. */
export function scheduleBlock(d:ScheduleDraft,base:{id:string},nodeIds:readonly string[]):ScheduleBlock{
 const e=scheduleErrors(d,nodeIds),first=e.block[0]??e.items.map((x,n)=>x.length?`Item ${n+1}: ${x[0]}`:'').find(Boolean);if(first)throw new Error(first);
 const b=blockSchema.parse({id:base.id,type:'schedule',title:d.title.trim(),provenance:d.provenance,visibility:d.visibility,sourceIds:d.sourceIds,...(d.transform?{transform:d.transform}:{}),timezone:d.timezone,items:d.items.map(itemOf)}) as ScheduleBlock;
 const t=timingErrors(b,new Set(nodeIds));if(t.length)throw new Error(t[0]);
 return b;
}

/** A metrics reading as typed: the value stays text until it parses as a finite number. */
export type MeasureDraft={metric:string;value:string;unit:string;scope:string;from:string;to:string;basis:typeof MEASURE_BASES[number];role:typeof MEASURE_ROLES[number]};
type Measure=NonNullable<Extract<EvidenceBlock,{type:'metrics'}>['items'][number]['measure']>;
export const emptyMeasure=(label=''):MeasureDraft=>({metric:label,value:'',unit:'',scope:'',from:'',to:'',basis:'measured',role:'baseline'});
export const measureDraftOf=(m:Measure):MeasureDraft=>({metric:m.metric,value:String(m.value),unit:m.unit,scope:m.scope,from:m.window.from,to:m.window.to,basis:m.basis,role:m.role});
/** Errors of one reading in a block of the given provenance. A synthetic block never carries a measured reading. */
export function measureErrors(m:MeasureDraft,provenance:EvidenceBlock['provenance']):string[]{
 const e:string[]=[],v=m.value.trim();
 if(!m.metric.trim())e.push('Name the metric (e.g. p95 latency).');
 if(!v||!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(v)||!Number.isFinite(Number(v)))e.push('Value: type a number such as 420 or 0.38; the unit goes in its own field.');
 if(!m.unit.trim()||m.unit.trim().length>24)e.push('Unit: 1 to 24 characters (e.g. ms, count, EUR).');
 if(!m.scope.trim())e.push('Scope: say what was measured (e.g. checkout API).');
 if(!m.from.trim()||!m.to.trim())e.push('Window: give a from and a to, two dates or two timestamps with an offset.');
 else{const w=windowOf({from:m.from.trim(),to:m.to.trim()});if(isError(w))e.push(sentence(w.error));}
 if(provenance==='synthetic'&&m.basis==='measured')e.push('A synthetic block cannot carry a measured value; use basis estimate or derived, or change the provenance.');
 return e;
}
/** Block-level clash: two readings with the same role, metric and scope in one block. */
export function measureClashes(rows:readonly {measure?:MeasureDraft}[]):string[]{
 const seen=new Map<string,number>(),out:string[]=[];
 rows.forEach((r,n)=>{const m=r.measure;if(!m)return;const key=`${m.metric.trim()}\0${m.scope.trim()}\0${m.role}`,was=seen.get(key);
  if(was!==undefined)out.push(`Metrics ${was+1} and ${n+1} are both the ${m.role} reading of ${m.metric.trim()} for ${m.scope.trim()}; one block gives one.`);else seen.set(key,n);});
 return out;
}
export function measureOf(m:MeasureDraft,provenance:EvidenceBlock['provenance']):Measure{
 const e=measureErrors(m,provenance);if(e.length)throw new Error(e[0]);
 return {metric:m.metric.trim(),value:Number(m.value.trim()),unit:m.unit.trim(),scope:m.scope.trim(),window:{from:m.from.trim(),to:m.to.trim()},basis:m.basis,role:m.role};
}
