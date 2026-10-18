import type {Project} from '../core/model';
import type {AnalysisOptions} from './types';
import type {analyzePickedFolder} from './acquisition';
import type {compileGraphSnapshot,previewGraphReimport,GraphSnapshot} from './graphSnapshot';
/** One worker per explicit operation. Termination cancels CPU parsing as well as
 * pending reads. No stale completion can mutate an authoring document. */
function run<T>(request:unknown,signal?:AbortSignal,onProgress?:(value:{read:number;total:number;path:string})=>void):Promise<T>{
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Analysis cancelled','AbortError'));return;}
  const worker=new Worker(new URL('./analysisWorker.ts',import.meta.url),{type:'module'});
  const finish=()=>{worker.terminate();signal?.removeEventListener('abort',cancel);};
  const cancel=()=>{finish();reject(new DOMException('Analysis cancelled','AbortError'));};
  signal?.addEventListener('abort',cancel,{once:true});
  worker.onmessage=({data})=>{if(data.progress){onProgress?.(data.progress);return;}finish();if(data.error)reject(new Error(data.error));else resolve(data.result as T);};
  worker.onerror=e=>{finish();reject(new Error(e.message||'Analysis worker failed'));};
  try{worker.postMessage(request);}catch(e){finish();reject(e);}
 });
}
export const analyzePickedFolderWorker=(files:ArrayLike<File>,options:AnalysisOptions,signal?:AbortSignal,onProgress?:(value:{read:number;total:number;path:string})=>void)=>run<Awaited<ReturnType<typeof analyzePickedFolder>>>({kind:'picked',files:Array.from(files,file=>({file,path:file.webkitRelativePath})),options},signal,onProgress);
export const validateGraphWorker=(text:string,signal?:AbortSignal)=>run<GraphSnapshot>({kind:'graph',text,validateOnly:true},signal);
export const compileGraphWorker=(text:string,current?:Project,signal?:AbortSignal)=>run<{compiled:ReturnType<typeof compileGraphSnapshot>;proposal:ReturnType<typeof previewGraphReimport>|null}>({kind:'graph',text,current},signal);
