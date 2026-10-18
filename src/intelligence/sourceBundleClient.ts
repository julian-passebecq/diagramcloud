import type {ScanFile} from '../core/scan/scanner';
import {secretInText} from '../core/secrets';
import {validateAnalysisProfile,validateAnalysisBundle,type AnalysisProfile,type AnalysisBundle} from './profile';
import type {GapCause} from './gapDetails';
/** Fixed diagnostics retain a known processing stage, never an underlying private exception. */
export class SourceAnalysisError extends Error{
 constructor(message:string,readonly gapCause?:GapCause){super(message);}
}
const consumerFailure=()=>new SourceAnalysisError('Selected source analyzer worker failed. No candidate was produced.','consumer-error');
/** Termination cancels CPU analysis; no stale completion applies author changes. */
export function sourceBundleWorker(files:readonly ScanFile[],identity:{repositoryId:string;revision:string},profileInput:AnalysisProfile,signal?:AbortSignal,onProgress?:(p:{read:number;total:number;path:string})=>void):Promise<AnalysisBundle>{
 const profile=validateAnalysisProfile(profileInput);
 if(!/^[a-z][a-z0-9_.-]{0,79}$/.test(identity.repositoryId)||!identity.revision||identity.revision.length>120||secretInText(identity.revision))return Promise.reject(new Error('Invalid explicit repository identity/revision'));
 if(profile.repositoryIds.length&&!profile.repositoryIds.includes(identity.repositoryId))return Promise.reject(new Error('Selected repository is outside the profile repository scope'));
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Selected source analysis cancelled','AbortError'));return;}
  let worker:Worker;
  try{worker=new Worker(new URL('./sourceBundleWorker.ts',import.meta.url),{type:'module'});}catch{reject(consumerFailure());return;}
  let finished=false;
  const finish=()=>{if(finished)return;finished=true;worker.terminate();signal?.removeEventListener('abort',cancel);};
  const cancel=()=>{finish();reject(new DOMException('Selected source analysis cancelled','AbortError'));};
  signal?.addEventListener('abort',cancel,{once:true});
  worker.onmessage=({data})=>{
   if(finished)return;
   if(!data||typeof data!=='object'||Array.isArray(data)){finish();reject(consumerFailure());return;}
   if(data.progress){onProgress?.(data.progress);return;}
   finish();
   if(data.error){reject(new SourceAnalysisError('Selected source analysis failed. No candidate was produced.',data.gapCause==='consumer-error'?'consumer-error':undefined));return;}
   try{resolve(validateAnalysisBundle(data.result));}catch{reject(consumerFailure());}
  };
  worker.onerror=()=>{if(finished)return;finish();reject(consumerFailure());};
  try{worker.postMessage({files:[...files],profile,...identity});}catch{finish();reject(new SourceAnalysisError('Selected source request could not be sent. No candidate was produced.'));}
 });
}
