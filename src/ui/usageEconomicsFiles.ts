import {z} from 'zod';
import {calculateUsageDraft,USAGE_DRAFT_BYTES,USAGE_RECORD_LIMIT,USAGE_ALLOCATION_LIMIT,type UsageDraft} from './usageEconomicsDraft';
export const USAGE_FILE_FORMAT='diagramcloud.supplied-usage';
export const USAGE_FILE_REFUSAL='This usage file is invalid, unsupported or exceeds its limits. Current inputs and results are unchanged.';
const short=z.string().max(200),numeric=z.string().max(100),citation=z.string().max(2000);
const allocation=z.object({featureId:short,basisPoints:numeric}).strict();
const record=z.object({authority:short,id:short,source:citation,inputTokens:numeric,outputTokens:numeric,cachedInputTokens:numeric,reasoningOutputTokens:numeric,amount:numeric,currency:z.string().max(3),costBasis:z.enum(['','metered','estimate','subscription-allocation']),costSource:citation,allocations:z.array(allocation).max(USAGE_ALLOCATION_LIMIT)}).strict();
const envelope=z.object({format:z.literal(USAGE_FILE_FORMAT),version:z.literal(1),visibility:z.literal('private'),draft:z.object({basis:citation,windowStart:z.string().max(30),windowEnd:z.string().max(30),featureFilter:citation,records:z.array(record).min(1).max(USAGE_RECORD_LIMIT)}).strict()}).strict();
/** JSON.parse establishes grammar; this bounded lexical pass rejects duplicate decoded keys
 * (including escaped aliases) rather than silently accepting the last occurrence. */
function uniqueJsonKeys(raw:string){
 const stack:(Set<string>|null)[]=[];
 for(let i=0;i<raw.length;i++){
  const c=raw[i];if(c==='{'||c==='['){stack.push(c==='{'?new Set():null);if(stack.length>16)throw Error(USAGE_FILE_REFUSAL);}
  else if(c==='}'||c===']')stack.pop();
  else if(c==='"'){
   const start=i;for(i++;i<raw.length;i++){if(raw[i]==='\\'){i++;continue;}if(raw[i]==='"')break;}
   let next=i+1;while(/\s/.test(raw[next]??'')&&next<raw.length)next++;
   if(raw[next]===':'){const key=JSON.parse(raw.slice(start,i+1)) as string,keys=stack.at(-1);if(!keys||keys.has(key))throw Error(USAGE_FILE_REFUSAL);keys.add(key);}
  }
 }
}
export function parseUsageFile(raw:string):UsageDraft{
 try{
  if(typeof raw!=='string'||raw.length>USAGE_DRAFT_BYTES||new TextEncoder().encode(raw).byteLength>USAGE_DRAFT_BYTES)throw Error();
  const value:unknown=JSON.parse(raw);uniqueJsonKeys(raw);
  const parsed=envelope.parse(value);let key=0;
  const draft:UsageDraft={...parsed.draft,records:parsed.draft.records.map(r=>({...r,key:key++,allocations:r.allocations.map(a=>({...a,key:key++}))}))};
  calculateUsageDraft(draft);return draft;
 }catch{throw Error(USAGE_FILE_REFUSAL);}
}
export async function readUsageFile(file:Pick<Blob,'size'|'arrayBuffer'>):Promise<UsageDraft>{
 try{
  if(!Number.isSafeInteger(file.size)||file.size<1||file.size>USAGE_DRAFT_BYTES)throw Error();
  const bytes=await file.arrayBuffer();if(bytes.byteLength!==file.size||bytes.byteLength>USAGE_DRAFT_BYTES)throw Error();
  return parseUsageFile(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));
 }catch{throw Error(USAGE_FILE_REFUSAL);}
}
/** No totals, authority grants, Project identity or local UI keys enter the transport. */
export function serializeUsageFile(draft:UsageDraft):string{
 try{
  calculateUsageDraft(draft);
  const records=draft.records.map(({key:_,allocations,...r})=>({...r,allocations:allocations.map(({key:__,...a})=>a)}));
  const raw=JSON.stringify({format:USAGE_FILE_FORMAT,version:1,visibility:'private',draft:{...draft,records}});
  parseUsageFile(raw);return raw;
 }catch{throw Error('Only complete, valid usage inputs within 256 KiB can be downloaded. Current inputs and results are unchanged.');}
}
export function nextUsageDraftKey(draft:UsageDraft):number{return 1+Math.max(-1,...draft.records.flatMap(r=>[r.key,...r.allocations.map(a=>a.key)]));}
