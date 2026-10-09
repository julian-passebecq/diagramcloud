import test from 'node:test';
import assert from 'node:assert/strict';
import {deepAnalyzeWorker} from '../src/intelligence/deepClient';
import {deepAnalyze} from '../src/intelligence/deepAnalysis';
import {analysisProfile,type AnalysisProfile} from '../src/intelligence/profile';
import type {ScanFile} from '../src/core/scan/scanner';
import {nodeDeepRuntime} from '../scripts/lib/deepRuntime';
test('actual Deep client caches four exact validated generated inputs, clones results and clears on abort',async()=>{
 const runtime=await nodeDeepRuntime(),original=globalThis.Worker,profile=analysisProfile('deep'),identity={repositoryId:'synthetic',revision:'a'.repeat(40)};
 let created=0,hold=false,badIdentity=false;
 class WorkerMock{
  onmessage:((event:{data:unknown})=>void)|null=null;onerror:((event:{message:string})=>void)|null=null;terminated=false;
  constructor(){created++;}terminate(){this.terminated=true;}
  postMessage(data:{files:ScanFile[];profile:AnalysisProfile;repositoryId:string;revision:string}){if(hold)return;void deepAnalyze(data.files,data.profile,runtime,data).then(result=>{if(badIdentity)result.parserVersion+='-mismatch';if(!this.terminated)this.onmessage?.({data:{result}});}).catch(error=>this.onerror?.({message:String(error)}));}
 }
 Object.defineProperty(globalThis,'Worker',{value:WorkerMock,configurable:true,writable:true});
 try{
  const files=[{path:'main.ts',text:'export function synthetic() { return 1; }'}],first=await deepAnalyzeWorker(files,profile,identity);first.items[0].label='caller mutation';
  const reused=await deepAnalyzeWorker(files,profile,identity);assert.equal(created,1);assert(!reused.items.some(i=>i.label==='caller mutation'));
  const changed=[{path:'main.ts',text:'export function changed() { return 2; }'}];await deepAnalyzeWorker(changed,profile,identity);assert.equal(created,2);
  await deepAnalyzeWorker(files,{...profile,includeInferred:false},identity);assert.equal(created,3);
  await deepAnalyzeWorker(files,profile,{...identity,revision:'b'.repeat(40)});assert.equal(created,4);
  await deepAnalyzeWorker([{path:'other.ts',text:'export function other() {}'}],profile,identity);assert.equal(created,5);
  await deepAnalyzeWorker(files,profile,identity);assert.equal(created,6,'oldest fifth entry evicts the initial generated result');
  const stopped=new AbortController();stopped.abort();await assert.rejects(deepAnalyzeWorker(files,profile,identity,stopped.signal),/cancelled/);await deepAnalyzeWorker(files,profile,identity);assert.equal(created,7,'aborted request clears generated reuse');
  hold=true;const controller=new AbortController(),pending=deepAnalyzeWorker(changed,profile,identity,controller.signal);await new Promise(r=>setTimeout(r,20));controller.abort();await assert.rejects(pending,/cancelled/);hold=false;
  await deepAnalyzeWorker(files,profile,identity);assert.equal(created,9,'in-flight cancellation clears cache and terminates worker');
  badIdentity=true;await assert.rejects(deepAnalyzeWorker([{path:'mismatch.ts',text:'const mismatch = 1;'}],profile,identity),/identity differs/);badIdentity=false;
  const partial=[...files,{path:'unsupported.txt',text:'inert'}];await deepAnalyzeWorker(partial,profile,identity);await deepAnalyzeWorker(partial,profile,identity);assert.equal(created,12,'partial acquisition is not reused with another omission report');
 }finally{Object.defineProperty(globalThis,'Worker',{value:original,configurable:true,writable:true});}
});
