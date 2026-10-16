import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceBundleWorker,SourceAnalysisError} from '../src/intelligence/sourceBundleClient';
import {analysisProfile} from '../src/intelligence/profile';
import {buildSourceAnalysisBundle} from '../src/intelligence/sourceBundle';
import {sourceBundlePatch,StaleSourceBundleError} from '../src/intelligence/sourceBundlePatch';
import {parseManifest,documentFromAtlas} from '../src/core/atlas';

const identity={repositoryId:'synthetic',revision:'a'.repeat(40)},files=[{path:'src/a.ts',text:'export const synthetic = 1;'}];
class WorkerProbe{
 static mode:'error'|'runtime'|'input'|'invalid'|'post'|'hold'='error';
 static instances:WorkerProbe[]=[];
 onmessage?:({data}:{data:unknown})=>void;onerror?:(event:unknown)=>void;terminated=0;
 constructor(){WorkerProbe.instances.push(this);}
 terminate(){this.terminated++;}
 postMessage(){
  if(WorkerProbe.mode==='post')throw new DOMException('PRIVATE_CLONE_DETAIL','DataCloneError');
  queueMicrotask(()=>{
   if(WorkerProbe.mode==='error')this.onerror?.({message:'PRIVATE_WORKER_DETAIL'});
   else if(WorkerProbe.mode==='runtime')this.onmessage?.({data:{error:'PRIVATE_RUNTIME_DETAIL',gapCause:'consumer-error'}});
   else if(WorkerProbe.mode==='input')this.onmessage?.({data:{error:'PRIVATE_INPUT_DETAIL'}});
   else if(WorkerProbe.mode==='invalid')this.onmessage?.({data:{result:{format:'bad'}}});
  });
 }
}
async function withWorker(run:()=>Promise<void>){
 const prior=Object.getOwnPropertyDescriptor(globalThis,'Worker');
 Object.defineProperty(globalThis,'Worker',{value:WorkerProbe,writable:true,configurable:true});WorkerProbe.instances=[];
 try{await run();}finally{if(prior)Object.defineProperty(globalThis,'Worker',prior);else Reflect.deleteProperty(globalThis,'Worker');}
}
test('native worker errors, known analyzer startup failure and invalid consumer output retain sanitized processing advice',async()=>withWorker(async()=>{
 for(const mode of ['error','runtime','invalid'] as const){
  WorkerProbe.mode=mode;const before=JSON.stringify({files,identity});
  await assert.rejects(()=>sourceBundleWorker(files,identity,analysisProfile('quick')),(error:unknown)=>{
   assert(error instanceof SourceAnalysisError);assert.equal(error.gapCause,'consumer-error');assert(!error.message.includes('PRIVATE_'));assert(!JSON.stringify(error).includes('PRIVATE_'));assert.equal(error.cause,undefined);return true;
  });
  assert.equal(WorkerProbe.instances.at(-1)?.terminated,1);assert.equal(JSON.stringify({files,identity}),before);
 }
}));
test('invalid request, untyped producer rejection and cloning failure do not become consumer defects',async()=>withWorker(async()=>{
 await assert.rejects(()=>sourceBundleWorker(files,{...identity,repositoryId:'BAD ID'},analysisProfile('quick')),(error:unknown)=>{assert(error instanceof Error);assert.equal((error as SourceAnalysisError).gapCause,undefined);return true;});assert.equal(WorkerProbe.instances.length,0);
 for(const mode of ['input','post'] as const){WorkerProbe.mode=mode;await assert.rejects(()=>sourceBundleWorker(files,identity,analysisProfile('quick')),(error:unknown)=>{assert(error instanceof SourceAnalysisError);assert.equal(error.gapCause,undefined);assert(!error.message.includes('PRIVATE_'));return true;});}
}));
test('cancellation keeps AbortError and ignores late worker advice and progress',async()=>withWorker(async()=>{
 WorkerProbe.mode='hold';const controller=new AbortController();let progress=0;
 const pending=sourceBundleWorker(files,identity,analysisProfile('quick'),controller.signal,()=>progress++),probe=WorkerProbe.instances.at(-1)!;
 controller.abort();await assert.rejects(()=>pending,{name:'AbortError'});
 probe.onmessage?.({data:{progress:{read:1,total:1,path:'src/a.ts'}}});probe.onerror?.({message:'PRIVATE_LATE_ERROR'});assert.equal(progress,0);assert.equal(probe.terminated,1);
}));
test('known same-repository revision disagreement is stale advice without mutating the author document',async()=>{
 const bundle=await buildSourceAnalysisBundle(files,identity,analysisProfile('quick',{analyzers:['inventory']}));
 const make=(repoId:string,revision?:string)=>documentFromAtlas(parseManifest(JSON.stringify({format:'diagramcloud.project-manifest',version:1,project:{id:'synthetic-stale-advice',title:'Synthetic stale advice'},repositories:[{id:repoId,title:'Synthetic explicit member',host:'local',locator:'synthetic',...(revision?{revision}:{})}]})).manifest).document;
 const current=make('synthetic','b'.repeat(40)),before=JSON.stringify(current);
 assert.throws(()=>sourceBundlePatch(current,bundle,[bundle.items[0].id]),(error:unknown)=>{assert(error instanceof StaleSourceBundleError);assert.equal(error.gapCause,'stale-revision');return true;});assert.equal(JSON.stringify(current),before);
 for(const unknown of [make('synthetic'),make('other','b'.repeat(40))])assert.throws(()=>sourceBundlePatch(unknown,bundle,[bundle.items[0].id]),(error:unknown)=>{assert(error instanceof Error);assert.equal((error as StaleSourceBundleError).gapCause,undefined);return true;});
 assert.doesNotThrow(()=>sourceBundlePatch(make('synthetic',identity.revision),bundle,[bundle.items[0].id]));
 const legacy={...bundle,parserVersion:bundle.parserVersion.replace(';gaps1','')};delete legacy.diagnosticDetails;
 assert.doesNotThrow(()=>sourceBundlePatch(make('synthetic',identity.revision),legacy,[legacy.items[0].id]));
});
