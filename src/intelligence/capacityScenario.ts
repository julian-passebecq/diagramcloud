/** Transparent scenario arithmetic; not a Fabric bill, estimator of actual tenant
 * behaviour, price lookup, scheduler, smoothing or throttling simulation. */
export type CapacityWindow={capacityCu:number;seconds:number};
export type Activity={resourceId:string;startSeconds:number;endSeconds:number};
const number=(v:number,positive=false)=>{if(!Number.isFinite(v)||v<0||(positive&&v===0))throw new Error('Expected a finite nonnegative value (positive for capacity and window).');return v;};
export function capacityShare(cuSeconds:number,window:CapacityWindow):{budgetCuSeconds:number;percent:number}{
 number(cuSeconds);number(window.capacityCu,true);number(window.seconds,true);
 const budgetCuSeconds=window.capacityCu*window.seconds,percent=100*cuSeconds/budgetCuSeconds;
 if(!Number.isFinite(budgetCuSeconds)||!Number.isFinite(percent))throw new Error('Capacity arithmetic overflow.');
 return {budgetCuSeconds,percent};
}
/** Merge activity plus supplied idle tails per resource, clipped to one explicit
 * reporting interval. Overlapping sessions on the same database are not charged
 * twice; distinct databases are not merged. Activity outside the interval can
 * contribute a tail inside it. Missing observations are not supplied here as zero. */
export function onlineIntervals(activities:readonly Activity[],tailSeconds:number,window:{startSeconds:number;endSeconds:number}):{resourceId:string;startSeconds:number;endSeconds:number}[]{
 number(tailSeconds);number(window.startSeconds);number(window.endSeconds,true);
 if(window.endSeconds<=window.startSeconds||!Array.isArray(activities)||activities.length>10000)throw new Error('Invalid reporting interval or too many activities.');
 const grouped=new Map<string,{startSeconds:number;endSeconds:number}[]>();
 for(const a of activities){
  if(!a||typeof a.resourceId!=='string'||!a.resourceId.trim()||a.resourceId.length>160)throw new Error('Explicit resource identity required.');
  number(a.startSeconds);number(a.endSeconds);if(a.endSeconds<=a.startSeconds)throw new Error('Activity must have positive duration.');
  const end=a.endSeconds+tailSeconds;if(!Number.isFinite(end))throw new Error('Interval overflow.');
  const start=Math.max(a.startSeconds,window.startSeconds),finish=Math.min(end,window.endSeconds);
  if(finish<=start)continue;
  const list=grouped.get(a.resourceId)??[];list.push({startSeconds:start,endSeconds:finish});grouped.set(a.resourceId,list);
 }
 const out:{resourceId:string;startSeconds:number;endSeconds:number}[]=[];
 for(const resourceId of [...grouped.keys()].sort()){
  const rows=grouped.get(resourceId)!.sort((a,b)=>a.startSeconds-b.startSeconds||a.endSeconds-b.endSeconds);
  const merged:{startSeconds:number;endSeconds:number}[]=[];
  for(const row of rows){const prev=merged[merged.length-1];if(prev&&row.startSeconds<=prev.endSeconds)prev.endSeconds=Math.max(prev.endSeconds,row.endSeconds);else merged.push({...row});}
  out.push(...merged.map(r=>({resourceId,...r})));
 }
 return out;
}
export function floorScenario(activities:readonly Activity[],options:{tailSeconds:number;floorCu:number;capacityCu:number;startSeconds:number;endSeconds:number;basis:string}):{onlineResourceSeconds:number;floorCuSeconds:number;sharePercent:number;basis:string;excludes:string[]}{
 number(options.floorCu);if(typeof options.basis!=='string'||!options.basis.trim())throw new Error('An explicit scenario basis is required.');
 const rows=onlineIntervals(activities,options.tailSeconds,options);
 const onlineResourceSeconds=rows.reduce((sum,r)=>sum+r.endSeconds-r.startSeconds,0),floorCuSeconds=onlineResourceSeconds*options.floorCu;
 const share=capacityShare(floorCuSeconds,{capacityCu:options.capacityCu,seconds:options.endSeconds-options.startSeconds});
 return {onlineResourceSeconds,floorCuSeconds,sharePercent:share.percent,basis:options.basis,excludes:['Autoscaling above the supplied floor','Storage','GraphQL and function operations','Semantic-model queries','Smoothing, throttling and billing-price conversion']};
}
