import {deepAnalyze} from './deepAnalysis';
import {browserDeepRuntime} from './browserDeepRuntime';
import type {AnalysisProfile} from './profile';
import type {ScanFile} from '../core/scan/scanner';
const worker=self as unknown as {onmessage:((e:MessageEvent<{files:ScanFile[];profile:AnalysisProfile;repositoryId:string;revision:string}>)=>void)|null;postMessage:(value:unknown)=>void};
worker.onmessage=async({data})=>{try{
 const result=await deepAnalyze(data.files,data.profile,await browserDeepRuntime(),{repositoryId:data.repositoryId,revision:data.revision,onProgress:progress=>worker.postMessage({progress})});worker.postMessage({result});
 }catch(e){worker.postMessage({error:e instanceof Error?e.message:String(e)});}};