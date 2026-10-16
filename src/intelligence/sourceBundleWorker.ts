import {buildSourceAnalysisBundle} from './sourceBundle';
import {validateAnalysisProfile,type AnalysisProfile} from './profile';
import type {ScanFile} from '../core/scan/scanner';
const worker=self as unknown as {onmessage:((e:MessageEvent<{files:ScanFile[];profile:AnalysisProfile;repositoryId:string;revision:string}>)=>void)|null;postMessage:(value:unknown)=>void};
worker.onmessage=async({data})=>{
 let profile:AnalysisProfile;
 try{profile=validateAnalysisProfile(data.profile);}catch{worker.postMessage({error:'Selected source request refused.'});return;}
 let runtime;
 try{runtime=profile.analyzers.includes('tree-sitter')?await (await import('./browserDeepRuntime')).browserDeepRuntime():undefined;}
 catch{worker.postMessage({error:'Selected analyzer runtime could not start.',gapCause:'consumer-error'});return;}
 try{
  const result=await buildSourceAnalysisBundle(data.files,{repositoryId:data.repositoryId,revision:data.revision},profile,{runtime,onProgress:progress=>worker.postMessage({progress})});worker.postMessage({result});
 }catch{worker.postMessage({error:'Selected source analysis failed; no candidate produced.'});}
};
