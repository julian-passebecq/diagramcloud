import {capacityShare,floorScenario,onlineIntervals,type Activity} from '../intelligence/capacityScenario';
/** Form decoding only. Arithmetic and interval semantics remain owned by capacityScenario. */
export const CAPACITY_ACTIVITY_LIMIT=100;
export type CapacityActivityDraft={key:number;resourceId:string;startSeconds:string;endSeconds:string};
export type CapacityDraft={mode:'share'|'floor';basis:string;capacityCu:string;usageCuSeconds:string;windowSeconds:string;startSeconds:string;endSeconds:string;tailSeconds:string;floorCu:string;noActivity:boolean;activities:CapacityActivityDraft[]};
export const blankActivity=(key:number):CapacityActivityDraft=>({key,resourceId:'',startSeconds:'',endSeconds:''});
export const blankCapacityDraft=():CapacityDraft=>({mode:'share',basis:'',capacityCu:'',usageCuSeconds:'',windowSeconds:'',startSeconds:'',endSeconds:'',tailSeconds:'',floorCu:'',noActivity:false,activities:[blankActivity(0)]});
function supplied(value:unknown,label:string,positive=false){
 if(typeof value!=='string'||!value.trim())throw Error(`${label} is unknown. Supply a value explicitly.`);
 if(value.length>100||!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))throw Error(`${label} must be a finite ${positive?'positive':'nonnegative'} number.`);
 const number=Number(value.trim());if(number===0&&/[1-9]/.test(value.trim().split(/e/i)[0]))throw Error(`${label} is too small to represent without rounding to zero.`);if(!Number.isFinite(number)||number<0||(positive&&number===0))throw Error(`${label} must be a finite ${positive?'positive':'nonnegative'} number.`);return number;
}
export function calculateCapacityDraft(draft:CapacityDraft){
 if(!draft||!['share','floor'].includes(draft.mode))throw Error('Choose a compute capacity calculation.');
 if(typeof draft.basis!=='string'||!draft.basis.trim()||draft.basis.length>2000)throw Error('Supply an assumption/source basis of 1–2000 characters. This is not verification.');
 const basis=draft.basis.trim(),capacityCu=supplied(draft.capacityCu,'Capacity (CU)',true);
 if(draft.mode==='share'){
  const usageCuSeconds=supplied(draft.usageCuSeconds,'Usage (CU-seconds)'),seconds=supplied(draft.windowSeconds,'Reporting duration (seconds)',true);
  const share=capacityShare(usageCuSeconds,{capacityCu,seconds});
  if(usageCuSeconds>0&&share.percent===0)throw Error('The calculated share is too small to represent without rounding to zero.');
  return {mode:'share' as const,basis,capacityCu,seconds,usageCuSeconds,...share};
 }
 if(typeof draft.noActivity!=='boolean'||!Array.isArray(draft.activities)||draft.activities.length>CAPACITY_ACTIVITY_LIMIT)throw Error(`Supply at most ${CAPACITY_ACTIVITY_LIMIT} activity rows.`);
 const options={basis,capacityCu,startSeconds:supplied(draft.startSeconds,'Reporting start (seconds)'),endSeconds:supplied(draft.endSeconds,'Reporting end (seconds)',true),tailSeconds:supplied(draft.tailSeconds,'Idle tail (seconds)'),floorCu:supplied(draft.floorCu,'Floor per online resource (CU)')};
 if(!draft.noActivity&&!draft.activities.length)throw Error('Activity is unknown. Supply rows or explicitly assume no activity.');
 const activities:Activity[]=draft.noActivity?[]:draft.activities.map((row,index)=>{
  if(!row||typeof row.resourceId!=='string'||!row.resourceId.trim()||row.resourceId!==row.resourceId.trim()||row.resourceId.length>160)throw Error(`Activity ${index+1}: supply a stable resource ID of 1–160 characters without surrounding whitespace.`);
  return {resourceId:row.resourceId.trim(),startSeconds:supplied(row.startSeconds,`Activity ${index+1} start`),endSeconds:supplied(row.endSeconds,`Activity ${index+1} end`)};
 });
 if(options.tailSeconds>0&&activities.some(a=>a.endSeconds+options.tailSeconds===a.endSeconds))throw Error('The supplied idle tail is too small to represent at these activity offsets.');
 const result=floorScenario(activities,options),intervals=onlineIntervals(activities,options.tailSeconds,options);
 if((result.onlineResourceSeconds>0&&options.floorCu>0&&result.floorCuSeconds===0)||(result.floorCuSeconds>0&&result.sharePercent===0))throw Error('The calculated floor or share is too small to represent without rounding to zero.');
 return {mode:'floor' as const,...options,...result,intervals,explicitNoActivity:draft.noActivity,budgetCuSeconds:capacityShare(0,{capacityCu,seconds:options.endSeconds-options.startSeconds}).budgetCuSeconds};
}
export type CapacityDraftResult=ReturnType<typeof calculateCapacityDraft>;
