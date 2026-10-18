import test from 'node:test';
import assert from 'node:assert/strict';
import {scanRepository,type ScanFile} from '../src/core/scan/scanner';
import {documentFromScan} from '../src/core/scan/document';
import {validateDocument} from '../src/core/model';
import {conceptSpec} from '../src/export/concept';

const now=new Date('2026-10-14T12:00:00Z');
for(const [name,sources,from,to,sourceFile,line] of [
 ['TypeScript modules',[{path:'src/a/index.ts',text:'// Synthetic source\nimport {b} from "../b";\n'},{path:'src/b/index.ts',text:'export const b=1;'}],'m:.:a','m:.:b','src/a/index.ts',2],
 ['JavaScript files',[{path:'src/a/index.js',text:'// Synthetic source\nimport {b} from "./helper";\n'},{path:'src/a/helper.js',text:'export const b=1;'},{path:'src/b/index.js',text:'export const c=2;'}],'f:src/a/index.js','f:src/a/helper.js','src/a/index.js',2],
 ['Python modules',[{path:'src/a/main.py',text:'# Synthetic source\nfrom b.worker import work\n'},{path:'src/b/worker.py',text:'def work(): pass\n'}],'m:.:a','m:.:b','src/a/main.py',2],
 ['Python sibling files',[{path:'src/a/main.py',text:'# Synthetic source\nfrom . import helper\n'},{path:'src/a/helper.py',text:'value=1\n'},{path:'src/b/worker.py',text:'value=2\n'}],'f:src/a/main.py','f:src/a/helper.py','src/a/main.py',2],
] as [string,ScanFile[],string,string,string,number][]){
 test('static '+name+' imports remain source dependencies with stable IDs',()=>{
  const files=[{path:'package.json',text:'{"name":"synthetic-imports"}'},...sources],model=scanRepository(files);
  const relation=model.links.find(l=>l.from===from&&l.to===to);assert.ok(relation);assert.equal(relation.kind,'dependency');assert.equal(relation.label,'imports');assert.equal(relation.confidence,'confirmed');assert.equal(relation.count,1);
  assert.deepEqual(relation.evidence,[{file:sourceFile,line,finding:sources.find(f=>f.path===sourceFile)!.text.split('\n')[line-1].includes('helper')?'import '+(name==='Python sibling files'?'.helper':'./helper'):name==='Python modules'?'import b.worker':'import ../b',confidence:'confirmed'}]);
  const doc=documentFromScan(model,{now}).document;assert.doesNotThrow(()=>validateDocument(doc));assert.equal(doc.observations.length,0);
  // Compare the pre-fix semantic kind only: changing its meaning must not rename any canonical entity or citation.
  const oldKinds={...model,links:model.links.map(l=>l.label==='imports'?{...l,kind:'batch' as const}:l)},oldDocument=documentFromScan(oldKinds,{now}).document;
  assert.deepEqual(doc.nodes,oldDocument.nodes);assert.deepEqual(doc.views,oldDocument.views);assert.deepEqual(doc.blocks,oldDocument.blocks);assert.deepEqual(doc.sources,oldDocument.sources);
  assert.deepEqual(doc.edges.map(({kind:_kind,...e})=>e),oldDocument.edges.map(({kind:_kind,...e})=>e));
  assert.ok(doc.edges.some(e=>e.kind==='dependency'));
  const view=doc.views.find(v=>v.edgeIds.length)!;const concept=conceptSpec(doc,view.id,{now});assert.ok(concept.spec.flows.length);assert.ok(concept.spec.flows.every(f=>f.kind==='control'));
 });
}

test('workspace and explicit cross-container imports are dependencies without changing data lineage',()=>{
 const files:ScanFile[]=[{path:'package.json',text:'{"name":"workspace","workspaces":["packages/*"]}'},
  {path:'packages/a/package.json',text:'{"name":"@synthetic/a"}'},{path:'packages/b/package.json',text:'{"name":"@synthetic/b"}'},
  {path:'packages/a/src/api/index.ts',text:'import {b} from "@synthetic/b";\nimport {b as same} from "../../../b/src/service";\n'},
  {path:'packages/a/src/helper/index.ts',text:'export const helper=1;'},
  {path:'packages/b/src/service/index.ts',text:'export const b=1;'},
  {path:'data/report.sql',text:'CREATE TABLE totals AS SELECT * FROM orders;\n'}];
 const model=scanRepository(files),relation=model.links.find(l=>l.from==='c:packages/a'&&l.to==='c:packages/b');
 assert.ok(relation);assert.equal(relation.kind,'dependency');assert.equal(relation.count,2);assert.equal(relation.confidence,'confirmed');assert.deepEqual(relation.evidence.map(e=>e.kind==='selection-metadata'?null:[e.file,e.line]),[['packages/a/src/api/index.ts',1],['packages/a/src/api/index.ts',2]]);
 const data=model.links.find(l=>l.from==='t:orders'&&l.to==='t:totals');assert.ok(data);assert.equal(data.kind,'batch');assert.equal(data.layer,'data');
 assert.equal(documentFromScan(model,{now}).document.observations.length,0);
});
