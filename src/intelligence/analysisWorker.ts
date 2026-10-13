import {analyzePickedFolder} from './acquisition';
import {compileGraphSnapshot,previewGraphReimport,validateGraphSnapshot} from './graphSnapshot';
import type {Project} from '../core/model';
import type {AnalysisOptions} from './types';
type Request={kind:'picked';files:{file:File;path:string}[];options:AnalysisOptions}|{kind:'graph';text:string;current?:Project;validateOnly?:boolean};
const worker=self as unknown as {onmessage:((e:MessageEvent<Request>)=>void)|null;postMessage:(value:unknown)=>void};
worker.onmessage=async({data})=>{try{
 if(data.kind==='picked'){
  const files=data.files.map(({file,path})=>{Object.defineProperty(file,'webkitRelativePath',{value:path});return file;});
  const result=await analyzePickedFolder(files,data.options,undefined,progress=>worker.postMessage({progress}));
  worker.postMessage({result});
 }else{
  if(new TextEncoder().encode(data.text).byteLength>4*1024*1024)throw new Error('GraphSnapshot exceeds 4 MiB');
  const graph=validateGraphSnapshot(JSON.parse(data.text));
  if(data.validateOnly)worker.postMessage({result:graph});
  else{const compiled=compileGraphSnapshot(graph),proposal=data.current?previewGraphReimport(data.current,graph,data.current.revision):null;worker.postMessage({result:{compiled,proposal}});}
 }
 }catch(error){worker.postMessage({error:error instanceof Error?error.message:String(error)});}};
