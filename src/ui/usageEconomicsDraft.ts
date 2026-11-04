import {normalizeUsage,summarizeUsage,type UsageEvent} from '../intelligence/usageEconomics';
/** Form metadata is not a billing record or Project field. Only normalized leaf calls enter the shared arithmetic. */
export const USAGE_RECORD_LIMIT=50,USAGE_ALLOCATION_LIMIT=10,USAGE_DRAFT_BYTES=256*1024;
export type UsageAllocationDraft={key:number;featureId:string;basisPoints:string};
export type UsageRecordDraft={key:number;authority:string;id:string;source:string;inputTokens:string;outputTokens:string;cachedInputTokens:string;reasoningOutputTokens:string;amount:string;currency:string;costBasis:string;costSource:string;allocations:UsageAllocationDraft[]};
export type UsageDraft={basis:string;windowStart:string;windowEnd:string;featureFilter:string;records:UsageRecordDraft[]};
export const blankUsageRecord=(key:number):UsageRecordDraft=>({key,authority:'',id:'',source:'',inputTokens:'',outputTokens:'',cachedInputTokens:'',reasoningOutputTokens:'',amount:'',currency:'',costBasis:'',costSource:'',allocations:[]});
export const blankUsageDraft=():UsageDraft=>({basis:'',windowStart:'',windowEnd:'',featureFilter:'',records:[blankUsageRecord(0)]});
function text(value:unknown,label:string,max=200){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(`${label}: supply 1–${max} characters.`);return value.trim();}
function identity(value:unknown,label:string){const result=text(value,label);if(value!==result)throw Error(`${label}: surrounding whitespace is ambiguous.`);return result;}
function utc(value:unknown,label:string){const result=text(value,label,30);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(result)||!Number.isFinite(Date.parse(result))||new Date(result).toISOString()!==(result.includes('.')?result:result.replace('Z','.000Z')))throw Error(`${label}: supply a real UTC timestamp, for example 2026-01-01T00:00:00Z.`);return result;}
function tokens(value:unknown,label:string):number|null{if(typeof value!=='string'||value.length>100)throw Error(`${label}: invalid supplied count.`);if(!value.trim())return null;if(!/^\d+$/.test(value.trim()))throw Error(`${label}: supply a nonnegative integer or leave unknown.`);const n=Number(value);if(!Number.isSafeInteger(n)||n>1e12)throw Error(`${label}: maximum count is 1000000000000.`);return n;}
function cost(value:string):number|null{if(!value.trim())return null;if(value.length>100||!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))throw Error('Cost: supply a finite nonnegative amount.');const n=Number(value);if(!Number.isFinite(n)||n>1e9||n===0&&/[1-9]/.test(value.trim().split(/e/i)[0]))throw Error('Cost is out of range or rounds to zero.');return n;}
export function calculateUsageDraft(draft:UsageDraft){
 if(!draft||new TextEncoder().encode(JSON.stringify(draft)).length>USAGE_DRAFT_BYTES)throw Error('Usage draft exceeds 256 KiB.');
 const basis=text(draft.basis,'Usage basis',2000),windowStart=utc(draft.windowStart,'Window start'),windowEnd=utc(draft.windowEnd,'Window end');if(Date.parse(windowEnd)<=Date.parse(windowStart))throw Error('Reporting window must end after it starts.');
 if(!Array.isArray(draft.records)||!draft.records.length||draft.records.length>USAGE_RECORD_LIMIT)throw Error(`Supply 1–${USAGE_RECORD_LIMIT} leaf-call records; no records means unknown.`);
 const provenance=new Map<string,{authority:string;id:string;source:string;costSource:string|null}>();
 const records:UsageEvent[]=draft.records.map((row,index)=>{
  const prefix=`Record ${index+1}`,authority=identity(row.authority,prefix+' authority'),id=identity(row.id,prefix+' call ID'),source=text(row.source,prefix+' source/provenance',2000);
  const amount=cost(row.amount);let suppliedCost:UsageEvent['cost']=null,costSource:string|null=null;
  if(amount===null){if(row.currency.trim()||row.costBasis.trim()||row.costSource.trim())throw Error(prefix+': cost is unknown; clear incomplete cost fields or supply its amount explicitly.');}
  else{if(!/^[A-Z]{3}$/.test(row.currency)||!['metered','estimate','subscription-allocation'].includes(row.costBasis))throw Error(prefix+': supply a three-letter currency and explicit cost basis.');costSource=text(row.costSource,prefix+' cost/rate citation',2000);suppliedCost={amount,currency:row.currency,basis:row.costBasis as NonNullable<UsageEvent['cost']>['basis']};}
  if(!Array.isArray(row.allocations)||row.allocations.length>USAGE_ALLOCATION_LIMIT)throw Error(`Supply at most ${USAGE_ALLOCATION_LIMIT} allocations per record.`);
  const allocations=row.allocations.map(a=>{const featureId=identity(a.featureId,prefix+' feature ID'),basisPoints=tokens(a.basisPoints,prefix+' basis points');if(basisPoints===null||basisPoints>10000)throw Error(prefix+': supply allocation basis points from 0 to 10000.');return {featureId,basisPoints};});
  const evidence={authority,id,source,costSource},key=JSON.stringify([authority,id]),previous=provenance.get(key);if(previous&&JSON.stringify(previous)!==JSON.stringify(evidence))throw Error('Duplicate call identity has conflicting source/provenance.');provenance.set(key,evidence);
  return {authority,id,kind:'leaf-call',inputTokens:tokens(row.inputTokens,prefix+' input tokens'),outputTokens:tokens(row.outputTokens,prefix+' output tokens'),cachedInputTokens:tokens(row.cachedInputTokens,prefix+' cached input'),reasoningOutputTokens:tokens(row.reasoningOutputTokens,prefix+' reasoning output'),cost:suppliedCost,allocations};
 });
 if(typeof draft.featureFilter!=='string'||draft.featureFilter.length>2000)throw Error('Feature filter exceeds 2000 characters.');
 const selectedFeatures=draft.featureFilter.trim()?draft.featureFilter.split('\n').filter(v=>v.trim()).map(v=>identity(v,'Feature filter ID')):undefined;
 const events=normalizeUsage(records);
 // Do not turn a positive supplied amount into a zero allocation due to floating-point underflow.
 for(const event of events)if(event.cost&&event.cost.amount>0){const points=event.allocations.reduce((n,a)=>n+a.basisPoints,0);for(const p of [...event.allocations.map(a=>a.basisPoints),10000-points])if(p>0&&event.cost.amount*(p/10000)===0)throw Error('Positive allocated cost rounds to zero; supply a representable amount.');}
 const totals=summarizeUsage(events,selectedFeatures);
 return {basis,windowStart,windowEnd,submittedRows:draft.records.length,events,totals,provenance:[...provenance.values()],selectedFeatures,unknownCachedCalls:events.filter(e=>e.cachedInputTokens===null).length,unknownReasoningCalls:events.filter(e=>e.reasoningOutputTokens===null).length};
}
export type UsageDraftResult=ReturnType<typeof calculateUsageDraft>;
