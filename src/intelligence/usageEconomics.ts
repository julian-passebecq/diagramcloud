/** Pure presentation arithmetic over normalized producer records. No billing API, price inference or token scoring.
 * Host filters private records BEFORE calling this module; selected feature filters never renormalize attribution.
 */
export type UsageEvent={authority:string;id:string;kind:'leaf-call';inputTokens:number|null;outputTokens:number|null;
 cachedInputTokens:number|null;reasoningOutputTokens:number|null;cost:{amount:number;currency:string;basis:'metered'|'estimate'|'subscription-allocation'}|null;
 allocations:{featureId:string;basisPoints:number}[]};
export type UsageTotals={calls:number;inputTokens:number;outputTokens:number;cachedInputTokens:number;reasoningOutputTokens:number;
 unknownInputCalls:number;unknownOutputCalls:number;unknownCostCalls:number;unattributedCalls:number;
 costs:{currency:string;basis:string;knownTotal:number;allocated:number;unattributed:number}[];
 features:{featureId:string;inputTokens:number;outputTokens:number;unknownInputCalls:number;unknownOutputCalls:number;unknownCostCalls:number;costs:{currency:string;basis:string;amount:number}[]}[]};
function bad():never{throw Error('Invalid or conflicting usage evidence. Leaf-call identity, units and allocation must be explicit.');}
const isObject=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const token=(v:unknown):v is number|null=>v===null||(typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=1e12);
const label=(v:unknown):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=200;
const stable=(x:unknown):string=>Array.isArray(x)?'['+x.map(stable).join(',')+']':isObject(x)?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':JSON.stringify(x);
function exact(x:unknown,ks:string[]):asserts x is Record<string,unknown>{if(!isObject(x)||Object.keys(x).length!==ks.length||ks.some(k=>!Object.hasOwn(x,k)))bad();}
export function normalizeUsage(input:unknown):UsageEvent[]{
 if(!Array.isArray(input)||input.length>10000)bad();const out=new Map<string,UsageEvent>();
 for(const raw of input){exact(raw,['authority','id','kind','inputTokens','outputTokens','cachedInputTokens','reasoningOutputTokens','cost','allocations']);
  if(!label(raw.authority)||!label(raw.id)||raw.kind!=='leaf-call'||![raw.inputTokens,raw.outputTokens,raw.cachedInputTokens,raw.reasoningOutputTokens].every(token))bad();
  if(raw.cachedInputTokens!==null&&(raw.inputTokens===null||Number(raw.cachedInputTokens)>Number(raw.inputTokens)))bad();
  if(raw.reasoningOutputTokens!==null&&(raw.outputTokens===null||Number(raw.reasoningOutputTokens)>Number(raw.outputTokens)))bad();
  if(raw.cost!==null){exact(raw.cost,['amount','currency','basis']);if(typeof raw.cost.amount!=='number'||!Number.isFinite(raw.cost.amount)||raw.cost.amount<0||raw.cost.amount>1e9||typeof raw.cost.currency!=='string'||!/^[A-Z]{3}$/.test(raw.cost.currency)||!['metered','estimate','subscription-allocation'].includes(String(raw.cost.basis)))bad();}
  if(!Array.isArray(raw.allocations)||raw.allocations.length>100)bad();let sum=0;const seen=new Set<string>();
  for(const a of raw.allocations){exact(a,['featureId','basisPoints']);if(!label(a.featureId)||seen.has(a.featureId)||!Number.isInteger(a.basisPoints)||Number(a.basisPoints)<0||Number(a.basisPoints)>10000)bad();sum+=Number(a.basisPoints);seen.add(a.featureId);}
  if(sum>10000)bad();
  const e=structuredClone(raw) as UsageEvent;e.allocations.sort((a,b)=>a.featureId.localeCompare(b.featureId,'en'));
  const key=JSON.stringify([e.authority,e.id]),prev=out.get(key);if(prev&&stable(prev)!==stable(e))bad();out.set(key,e);
 }
 return [...out.values()].sort((a,b)=>a.authority.localeCompare(b.authority,'en')||a.id.localeCompare(b.id,'en'));
}
export function summarizeUsage(input:unknown,selectedFeatures?:readonly string[]):UsageTotals{
 const events=normalizeUsage(input);if(selectedFeatures&&(!Array.isArray(selectedFeatures)||!selectedFeatures.every(label)))bad();
 const selected=selectedFeatures===undefined?undefined:new Set(selectedFeatures);
 const out:UsageTotals={calls:events.length,inputTokens:0,outputTokens:0,cachedInputTokens:0,reasoningOutputTokens:0,unknownInputCalls:0,unknownOutputCalls:0,unknownCostCalls:0,unattributedCalls:0,costs:[],features:[]};
 const costMap=new Map<string,UsageTotals['costs'][number]>(),features=new Map<string,UsageTotals['features'][number]>();
 for(const e of events){out.inputTokens+=e.inputTokens??0;out.outputTokens+=e.outputTokens??0;out.cachedInputTokens+=e.cachedInputTokens??0;out.reasoningOutputTokens+=e.reasoningOutputTokens??0;
  if(e.inputTokens===null)out.unknownInputCalls++;if(e.outputTokens===null)out.unknownOutputCalls++;if(e.cost===null)out.unknownCostCalls++;
  const allocated=e.allocations.reduce((n,a)=>n+a.basisPoints,0)/10000;if(allocated<1)out.unattributedCalls++;
  if(e.cost){const key=JSON.stringify([e.cost.currency,e.cost.basis]),row=costMap.get(key)??{currency:e.cost.currency,basis:e.cost.basis,knownTotal:0,allocated:0,unattributed:0};row.knownTotal+=e.cost.amount;row.allocated+=e.cost.amount*allocated;row.unattributed+=e.cost.amount*(1-allocated);costMap.set(key,row);}
  for(const a of e.allocations){if(selected&&!selected.has(a.featureId))continue;const row=features.get(a.featureId)??{featureId:a.featureId,inputTokens:0,outputTokens:0,unknownInputCalls:0,unknownOutputCalls:0,unknownCostCalls:0,costs:[]};const fraction=a.basisPoints/10000;
   if(fraction>0){if(e.inputTokens===null)row.unknownInputCalls++;if(e.outputTokens===null)row.unknownOutputCalls++;if(e.cost===null)row.unknownCostCalls++;}
   row.inputTokens+=(e.inputTokens??0)*fraction;row.outputTokens+=(e.outputTokens??0)*fraction;
   if(e.cost){let cost=row.costs.find(c=>c.currency===e.cost!.currency&&c.basis===e.cost!.basis);if(!cost){cost={currency:e.cost.currency,basis:e.cost.basis,amount:0};row.costs.push(cost);}cost.amount+=e.cost.amount*fraction;}
   features.set(a.featureId,row);
  }
 }
 // Cached/reasoning fields are subsets, never added to input+output. Known totals explicitly omit unknown calls.
 for(const n of [out.inputTokens,out.outputTokens,out.cachedInputTokens,out.reasoningOutputTokens])if(!Number.isSafeInteger(n))bad();
 out.costs=[...costMap.values()].sort((a,b)=>(a.currency+a.basis).localeCompare(b.currency+b.basis,'en'));
 out.features=[...features.values()].sort((a,b)=>a.featureId.localeCompare(b.featureId,'en'));return out;
}

/** A mean-value frontier within ONE explicit evaluation protocol. It is not statistical dominance, a vendor ranking
 * or a claim that differently configured agents/harnesses are comparable. Missing-cost points remain excluded.
 */
export type ParetoPoint={id:string;protocol:string;score:number;cost:number|null;source:string};
export function paretoByProtocol(input:readonly ParetoPoint[]):{protocol:string;frontier:ParetoPoint[];dominated:ParetoPoint[];missingCost:ParetoPoint[]}[]{
 if(!Array.isArray(input)||input.length>10000)bad();const groups=new Map<string,ParetoPoint[]>(),ids=new Set<string>();
 for(const p of input){exact(p,['id','protocol','score','cost','source']);if(!label(p.id)||!label(p.protocol)||!label(p.source)||typeof p.score!=='number'||!Number.isFinite(p.score)||p.score<0||p.score>1||(p.cost!==null&&(typeof p.cost!=='number'||!Number.isFinite(p.cost)||p.cost<0)))bad();
  const key=JSON.stringify([p.protocol,p.id]);if(ids.has(key))bad();ids.add(key);const group=groups.get(p.protocol)??[];group.push(structuredClone(p) as ParetoPoint);groups.set(p.protocol,group);
 }
 return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b,'en')).map(([protocol,all])=>{
  const known=all.filter(p=>p.cost!==null),dominated=known.filter(p=>known.some(q=>q.id!==p.id&&q.cost!<=p.cost!&&q.score>=p.score&&(q.cost!<p.cost!||q.score>p.score)));
  return {protocol,frontier:known.filter(p=>!dominated.includes(p)),dominated,missingCost:all.filter(p=>p.cost===null)};
 });
}
