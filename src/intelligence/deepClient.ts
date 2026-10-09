import type {ScanFile} from '../core/scan/scanner';
import {AnalysisCache,validateAnalysisBundle,analysisCacheKey,canonicalJson,sha256,type AnalysisProfile,type AnalysisBundle} from './profile';
import {prepareDeepSelection,DEEP_PARSER_VERSION} from './deepAnalysis';
const generatedCache=new AnalysisCache(4);
const cancelled=()=>new DOMException('Deep analysis cancelled','AbortError');
/** Worker termination is the cancellation boundary for synchronous WASM parsing. */
export async function deepAnalyzeWorker(input:ScanFile[],profileInput:AnalysisProfile,identity:{repositoryId:string;revision:string},signal?:AbortSignal,onProgress?:(p:{read:number;total:number;path:string})=>void):Promise<AnalysisBundle>{
 const invalidate=()=>generatedCache.clear();if(signal?.aborted){invalidate();throw cancelled();}signal?.addEventListener('abort',invalidate,{once:true});
 try{
 const files=input.map(f=>({...f})),selected=await prepareDeepSelection(files,profileInput,{...identity,signal}),profile=selected.profile;
 if(signal?.aborted){generatedCache.clear();throw cancelled();}
 const key='diagramcloud-analysis-1:'+await sha256(canonicalJson({parserVersion:DEEP_PARSER_VERSION,profile,revisions:[{...identity,contentDigest:selected.sourceDigest}]}));
 if(signal?.aborted){generatedCache.clear();throw cancelled();}
 // Omitted inputs are not part of the source digest. Refuse cached reuse for a
 // partial acquisition so its omission diagnostics cannot describe another set.
 if(!selected.omittedSources){const cached=generatedCache.get(key);if(cached){const result=validateAnalysisBundle(cached);if(await analysisCacheKey(result)!==key)throw new Error('Deep generated cache identity mismatch');if(signal?.aborted){generatedCache.clear();throw cancelled();}onProgress?.({read:selected.files.length,total:selected.files.length,path:'Identical validated generated syntax reused from memory'});return result;}}
 const result=await new Promise<AnalysisBundle>((resolve,reject)=>{if(signal?.aborted){generatedCache.clear();reject(cancelled());return;}const worker=new Worker(new URL('./deepWorker.ts',import.meta.url),{type:'module'});
  const finish=()=>{worker.terminate();signal?.removeEventListener('abort',cancel);},cancel=()=>{generatedCache.clear();finish();reject(cancelled());};signal?.addEventListener('abort',cancel,{once:true});
  worker.onmessage=({data})=>{if(data.progress){onProgress?.(data.progress);return;}finish();data.error?reject(new Error(data.error)):resolve(data.result as AnalysisBundle);};worker.onerror=e=>{finish();reject(new Error(e.message||'Deep analysis worker failed'));};try{worker.postMessage({files,profile,...identity});}catch(e){finish();reject(e);}
 });
 const valid=validateAnalysisBundle(result);if(await analysisCacheKey(valid)!==key)throw new Error('Worker source/profile identity differs from the selected request');if(signal?.aborted){generatedCache.clear();throw cancelled();}if(!selected.omittedSources)await generatedCache.put(valid);if(signal?.aborted){generatedCache.clear();throw cancelled();}return structuredClone(valid);
 }finally{signal?.removeEventListener('abort',invalidate);}
}
