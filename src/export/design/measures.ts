import type {EvidenceBlock} from '../../core/model';
import type {SpecEdge} from '../../core/viewspec';
import {DAY,intervalOf,isError,spanText,windowOf} from '../../core/schedule';
import type {DesignContext} from './context';

/**
 * Evidence read by the measured figures (Sankey, Gantt, baseline/current comparison) from one public view: only blocks
 * attached to its public components and connections of the view, never a guess. Shared by availability (what is missing)
 * and the renderers (what is drawn), so the SVG, the book, the deck and the Studio note give the same reasons.
 */
type Schedule=Extract<EvidenceBlock,{type:'schedule'}>;
type Metrics=Extract<EvidenceBlock,{type:'metrics'}>;
const blocksOf=<T extends EvidenceBlock['type']>(c:DesignContext,type:T)=>{
 const ids=[...new Set(c.spec.nodes.flatMap(n=>n.evidenceRefs))];
 return ids.flatMap(id=>{const b=c.doc.blocks.find(b=>b.id===id);return b&&b.type===type?[b as Extract<EvidenceBlock,{type:T}>]:[];});
};

// ---- Schedule (Gantt) --------------------------------------------------------------------------------------------
export type ScheduleRow={id:string;label:string;basis:'supplied'|'estimate';start:number;end:number;startText:string;endText:string;duration?:string;note?:string;nodes:string[];blocks:string[];provenance:EvidenceBlock['provenance'];timezone:string};
export type ScheduleEvidence={rows:ScheduleRow[];dateOnly:boolean;timezones:string[];conflicts:string[];blocks:Schedule[];estimates:number};
export function scheduleOf(c:DesignContext):ScheduleEvidence{
 const blocks=blocksOf(c,'schedule'),labels=new Map(c.doc.nodes.map(n=>[n.id,n.label])),rows:ScheduleRow[]=[],conflicts:string[]=[];
 const bases=new Set(blocks.map(b=>b.timezone==='date-only'));
 if(bases.size>1)conflicts.push(`${blocks.filter(b=>b.timezone==='date-only').map(b=>b.title).join(', ')} ${blocks.filter(b=>b.timezone==='date-only').length===1?'is':'are'} date-only and ${blocks.filter(b=>b.timezone!=='date-only').map(b=>b.title).join(', ')} timed: one axis needs one time basis, and a date is never converted to a time.`);
 for(const b of blocks){const dateOnly=b.timezone==='date-only';
  for(const i of b.items){const x=intervalOf(i,dateOnly);if(isError(x)){conflicts.push(`${b.title} / ${i.label}: ${x.error}.`);continue;}
   const endText=i.end??(dateOnly?new Date(x.end-DAY).toISOString().slice(0,10):new Date(x.end).toISOString().replace(':00.000Z','Z'));
   const same=rows.find(r=>r.id===i.id);
   if(same){if(same.start!==x.start||same.end!==x.end||same.basis!==i.basis)conflicts.push(`Item ${i.id} is ${same.startText} → ${same.endText} (${same.basis}) in ${same.blocks.join(', ')} but ${i.start} → ${endText} (${i.basis}) in ${b.title}: conflicting inputs are not merged or averaged.`);else same.blocks.push(b.title);continue;}
   rows.push({id:i.id,label:i.label,basis:i.basis,start:x.start,end:x.end,startText:i.start,endText,...(i.duration?{duration:i.duration}:{}),...(i.note?{note:i.note}:{}),nodes:i.nodeIds.flatMap(id=>labels.has(id)?[labels.get(id)!]:[]),blocks:[b.title],provenance:b.provenance,timezone:b.timezone});}}
 rows.sort((a,b)=>a.start-b.start||a.end-b.end||a.id.localeCompare(b.id));
 return {rows,dateOnly:[...bases][0]??true,timezones:[...new Set(blocks.map(b=>b.timezone))],conflicts,blocks,estimates:rows.filter(r=>r.basis==='estimate').length};
}

// ---- Baseline / current comparison -------------------------------------------------------------------------------
export type Reading={metric:string;value:number;unit:string;scope:string;from:string;to:string;length:number;basis:'measured'|'estimate'|'derived';role:'baseline'|'current';label:string;block:string;provenance:EvidenceBlock['provenance']};
export type ComparisonRow={metric:string;scope:string;unit:string;baseline:Reading;current:Reading;difference:number;relative?:number;relativeNote?:string;basis:string;windowLength:string};
export type ComparisonEvidence={rows:ComparisonRow[];unavailable:{metric:string;reason:string}[];readings:number;blocks:Metrics[]};
const fmtValue=(r:Reading)=>`${r.value} ${r.unit}`;
export function comparisonOf(c:DesignContext):ComparisonEvidence{
 const blocks=blocksOf(c,'metrics').filter(b=>b.items.some(i=>i.measure)),readings:Reading[]=[];
 for(const b of blocks)for(const i of b.items){const m=i.measure;if(!m)continue;const w=windowOf(m.window);if(isError(w))continue;
  readings.push({metric:m.metric,value:m.value,unit:m.unit,scope:m.scope,from:m.window.from,to:m.window.to,length:w.end-w.start,basis:m.basis,role:m.role,label:i.label,block:b.title,provenance:b.provenance});}
 const rows:ComparisonRow[]=[],unavailable:ComparisonEvidence['unavailable']=[];
 for(const metric of [...new Set(readings.map(r=>r.metric))]){
  const of=readings.filter(r=>r.metric===metric),bScopes=new Set(of.filter(r=>r.role==='baseline').map(r=>r.scope)),cScopes=new Set(of.filter(r=>r.role==='current').map(r=>r.scope));
  if(bScopes.size&&cScopes.size&&![...bScopes].some(s=>cScopes.has(s))){unavailable.push({metric,reason:`the baseline covers ${[...bScopes].join(', ')} and the current reading covers ${[...cScopes].join(', ')}: different scopes are not compared`});continue;}
  for(const scope of [...new Set(of.map(r=>r.scope))]){
   const here=of.filter(r=>r.scope===scope),base=here.filter(r=>r.role==='baseline'),cur=here.filter(r=>r.role==='current'),name=`${metric} (${scope})`;
   if(!base.length){unavailable.push({metric:name,reason:'no baseline reading for this scope: a current value alone is not a change'});continue;}
   if(!cur.length){unavailable.push({metric:name,reason:'no current reading for this scope: a baseline alone is not a change'});continue;}
   if(base.length>1||cur.length>1){unavailable.push({metric:name,reason:`${base.length} baseline and ${cur.length} current readings in ${[...new Set(here.map(r=>r.block))].join(', ')}: ambiguous, none is chosen and nothing is averaged`});continue;}
   const [b,k]=[base[0],cur[0]];
   if(b.unit!==k.unit){unavailable.push({metric:name,reason:`baseline in ${b.unit} and current in ${k.unit}: incompatible units, never converted`});continue;}
   if(b.length!==k.length){unavailable.push({metric:name,reason:`baseline window ${b.from} → ${b.to} (${spanText(b.length)}) and current window ${k.from} → ${k.to} (${spanText(k.length)}) differ in length: not comparable`});continue;}
   const difference=k.value-b.value,bases=new Set([b.basis,k.basis]);
   rows.push({metric,scope,unit:b.unit,baseline:b,current:k,difference,...(b.value===0?{relativeNote:'Relative change unavailable: the baseline is zero.'}:{relative:difference/Math.abs(b.value)}),
    basis:bases.has('estimate')?'estimate-based':bases.has('derived')?'from derived inputs':'measured inputs',windowLength:spanText(b.length)});}}
 return {rows,unavailable,readings:readings.length,blocks};
}
export const readingText=fmtValue;

// ---- Sankey bands ------------------------------------------------------------------------------------------------
type Quantity=NonNullable<SpecEdge['quantity']>;
export type Band=SpecEdge&{quantity:Quantity};
const groupKey=(q:Quantity)=>`${q.unit}\u0000${q.scope??''}\u0000${q.window?`${q.window.from}/${q.window.to}`:''}`;
/**
 * The bands a Sankey may draw: connections between two different components of the view whose quantity shares the most
 * common unit, scope and window (ties: first in connection order). Others are listed, never summed. Two connections with
 * equal labels or endpoints stay two flows; only one measurement ID on several connections of the drawn group is
 * ambiguous: those bands are reported and not counted, never deduplicated by guess.
 */
export function sankeyBands(spec:{nodes:{id:string}[];edges:SpecEdge[]}):{bands:Band[];unit?:string;scope?:string;window?:string;otherGroup:Band[];selfLoops:Band[];unquantified:SpecEdge[];ambiguous:{measurementId:string;edges:Band[]}[]}{
 const ids=new Set(spec.nodes.map(n=>n.id)),inView=spec.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)),quantified=inView.filter((e):e is Band=>!!e.quantity);
 const drawable=quantified.filter(e=>e.from!==e.to),count=new Map<string,number>();for(const e of drawable)count.set(groupKey(e.quantity),(count.get(groupKey(e.quantity))??0)+1);
 const key=[...count].sort((a,b)=>b[1]-a[1])[0]?.[0],group=drawable.filter(e=>groupKey(e.quantity)===key);
 const byMeasurement=new Map<string,Band[]>();for(const e of group)if(e.quantity.measurementId)byMeasurement.set(e.quantity.measurementId,[...(byMeasurement.get(e.quantity.measurementId)??[]),e]);
 const ambiguous=[...byMeasurement].filter(([,es])=>es.length>1).map(([measurementId,edges])=>({measurementId,edges})),dropped=new Set(ambiguous.flatMap(a=>a.edges.map(e=>e.id)));
 const first=group[0]?.quantity;
 return {bands:group.filter(e=>!dropped.has(e.id)),...(first?{unit:first.unit}:{}),...(first?.scope?{scope:first.scope}:{}),...(first?.window?{window:`${first.window.from} → ${first.window.to}`}:{}),
  otherGroup:drawable.filter(e=>groupKey(e.quantity)!==key),selfLoops:quantified.filter(e=>e.from===e.to),unquantified:inView.filter(e=>!e.quantity),ambiguous};
}
