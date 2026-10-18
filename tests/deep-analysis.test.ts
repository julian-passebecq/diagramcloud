import test from 'node:test';
import assert from 'node:assert/strict';
import {deepAnalyze} from '../src/intelligence/deepAnalysis';
import {analysisProfile,validateAnalysisBundle} from '../src/intelligence/profile';
import {nodeDeepRuntime} from '../scripts/lib/deepRuntime';
import {deepAnalysisPatch} from '../src/intelligence/deepProposal';
import {documentSchema,validateDocument} from '../src/core/model';
import {applyDocumentPatch} from '../src/core/patch';
import {publicDocument} from '../src/core/operations';
const identity={repositoryId:'synthetic',revision:'a'.repeat(40)};
test('actual Tree-sitter grammars extract TS/TSX/JS/Python/C# syntax with exact source ranges',async()=>{
 const runtime=await nodeDeepRuntime(),selected=[
  {path:'src/main.ts',text:'import { load } from "./load";\nexport function start() { load(); }\n// function fake() { steal(); }\nconst example="function falseSymbol() {}";'},
  {path:'src/load.ts',text:'export function load() { return 1; }'},
  {path:'src/component.tsx',text:'export function Component() { return <div>synthetic</div>; }'},
  {path:'src/helpers.js',text:'function work() { return 2; }\nfunction main() { work(); }'},
  {path:'src/module.py',text:'from .other import run\ndef start():\n    run()\n'},
  {path:'src/other.py',text:'def run():\n    return 1\n'},
  {path:'Api/Program.cs',text:'using System;\nclass Program { public void Run() { Console.WriteLine("synthetic"); } }'},
 ];
 const bundle=await deepAnalyze(selected,analysisProfile('deep'),runtime,identity);
 assert.equal(bundle.revisions.length,1);assert.ok(bundle.items.some(i=>i.label==='Component'));assert.ok(bundle.items.some(i=>i.label==='Program.Run'));
 assert.ok(!bundle.items.some(i=>i.label.includes('fake')||i.label.includes('falseSymbol')||i.label.includes('steal')));
 assert.equal(bundle.links.filter(l=>l.kind==='exact-selected-module-path').length,2);
 assert.ok(bundle.links.some(l=>l.kind==='possible-local-call-target'&&l.confidence==='possible'));
 assert.ok(bundle.items.filter(i=>i.kind==='call-site-syntax').every(i=>i.confidence==='confirmed'));
 const start=bundle.items.find(i=>i.label==='start'&&bundle.sources.find(s=>s.id===i.sourceIds[0])?.path==='src/main.ts')!;
 assert.equal(bundle.sources.find(s=>s.id===start.sourceIds[0])?.line,2);
 assert.ok(bundle.sources.every(s=>/^[a-f0-9]{64}$/.test(s.contentDigest)&&s.revision===identity.revision));assert.doesNotThrow(()=>validateAnalysisBundle(bundle));
});
test('deep profile and byte/node/link limits are enforced before or during actual parsing',async()=>{
 const runtime=await nodeDeepRuntime();await assert.rejects(()=>deepAnalyze([],analysisProfile('standard'),runtime,identity),/explicitly selected/);
 const files=[{path:'a.ts',text:'export function a(){ b(); }\nexport function b(){}'},{path:'../unsafe.ts',text:'function unsafe(){}'},{path:'node_modules/vendor/a.ts',text:'function vendor(){}'},{path:'Nested/.git',text:'gitdir: ../worktree'},{path:'Nested/a.ts',text:'function nested(){}'}];
 const bundle=await deepAnalyze(files,analysisProfile('deep',{budgets:{nodes:2,links:1}}),runtime,identity);
 assert.ok(bundle.items.length<=2);assert.ok(bundle.links.length<=1);assert.ok(bundle.omitted.items>0);assert.ok(bundle.omitted.sources>=3);
 assert.ok(!bundle.sources.some(s=>/unsafe|Nested|vendor/.test(s.path)));assert.doesNotThrow(()=>validateAnalysisBundle(bundle));
});
test('deep parse diagnostics retain invalid syntax as partial and cancellation leaves no Project mutation',async()=>{
 const runtime=await nodeDeepRuntime(),controller=new AbortController();controller.abort();await assert.rejects(()=>deepAnalyze([{path:'a.ts',text:'function a(){}'}],analysisProfile('deep'),runtime,{...identity,signal:controller.signal}),{name:'AbortError'});
 const partial=await deepAnalyze([{path:'broken.ts',text:'export function broken( {\n export const = ;'}],analysisProfile('deep'),runtime,identity);
 assert.ok(partial.diagnostics.some(d=>d.includes('syntax errors')));assert.ok(!partial.items.some(i=>i.label==='broken'));
});
test('Explicit deep syntax selection creates a private reviewed Project projection without execution or overwrites',async()=>{
 const runtime=await nodeDeepRuntime(),bundle=await deepAnalyze([{path:'synthetic.ts',text:'function privateWork(){ return 1; }\nfunction main(){ privateWork(); }'}],analysisProfile('deep'),runtime,identity);
 const current=documentSchema.parse({schemaVersion:1,id:'synthetic-deep',title:'Synthetic source',rootViewId:'root',nodes:[{id:'root-node',label:'Project'}],edges:[],views:[{id:'root',title:'Project',nodeIds:['root-node']}]}),before=JSON.stringify(current);
 const patch=deepAnalysisPatch(current,bundle,bundle.items.map(i=>i.id)),after=applyDocumentPatch(current,patch).result;assert.equal(JSON.stringify(current),before);assert.equal(after.observations.length,0);assert.doesNotThrow(()=>validateDocument(after));
 assert.ok(after.edges.some(e=>e.basis==='unknown'&&e.label.includes('possible')));assert.ok(!JSON.stringify(publicDocument(after)).includes('privateWork'));
 assert.throws(()=>deepAnalysisPatch(after,bundle,bundle.items.map(i=>i.id)),/already exists/);assert.throws(()=>applyDocumentPatch({...current,revision:1},patch),/Stale patch/);
});
