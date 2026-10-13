import {buildSourceAnalysisBundle} from './sourceBundle';
import {validateAnalysisProfile,type AnalysisProfile} from './profile';
import type {ScanFile} from '../core/scan/scanner';
const worker=self as unknown as {onmessage:((e:MessageEvent<{files:ScanFile[];profile:AnalysisProfile;repositoryId:string;revision:string}>)=>void)|null;postMessage:(value:unknown)=>void};
worker.onmessage=async({data})=>{try{const profile=validateAnalysisProfile(data.profile),runtime=profile.analyzers.includes('tree-sitter')?await (await import('./browserDeepRuntime')).browserDeepRuntime():undefined;
 const result=await buildSourceAnalysisBundle(data.files,{repositoryId:data.repositoryId,revision:data.revision},profile,{runtime,onProgress:progress=>worker.postMessage({progress})});worker.postMessage({result});
 }catch(e){worker.postMessage({error:e instanceof Error?e.message:String(e)});}};
