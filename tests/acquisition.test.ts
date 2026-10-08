import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePickedFolder,ACQUISITION_PROFILES} from '../src/intelligence/acquisition';
import {readAcquisitionAnalysis,attachAcquisitionContext} from '../src/intelligence/materialize';
import {documentFromAtlas,rescanRepository,validateManifest} from '../src/core/atlas';
import {publicDocument} from '../src/core/operations';
import {validateDocument} from '../src/core/model';

function file(path:string,text:string,onRead=()=>{},size?:number):File{
  const bytes=new TextEncoder().encode(text);
  return {name:path.split('/').at(-1),webkitRelativePath:`fixture/${path}`,size:size??bytes.length,arrayBuffer:async()=>{onRead();return bytes.buffer;}} as File;
}
test('empty, unknown and docs-only folders produce validated useful candidates',async()=>{
  for(const files of [[],[file('thing.xyz','unknown')],[file('README.md','# Scope\n[Details](details.md)'),file('details.md','# Details')]]){
    const result=await analyzePickedFolder(files,{depth:'standard'});
    assert.equal(validateDocument(result.document).nodes.length,1);
    assert.equal(result.document.edges.length,0);
    assert.ok(readAcquisitionAnalysis(JSON.parse(JSON.stringify(result.document))));
  }
  const docs=await analyzePickedFolder([file('README.md','# Scope\n[Details](details.md)'),file('details.md','# Details')],{depth:'standard'});
  assert.equal(docs.analysis.documentMap.links[0].toPath,'details.md');
});
test('gates oversized files, secrets, path traversal and nested repositories before reads',async()=>{
  let forbidden=0;
  const files=[file('good.py','import os'),file('too-big.py','',()=>forbidden++,ACQUISITION_PROFILES.quick.fileBytes+1),file('.env','TOKEN=abc',()=>forbidden++),file('../escape.py','import os',()=>forbidden++),file('nested/.git','gitdir: elsewhere',()=>forbidden++),file('nested/source.py','import os',()=>forbidden++),file('.worktrees/source.py','import os',()=>forbidden++)];
  const result=await analyzePickedFolder(files,{depth:'quick'});
  assert.equal(forbidden,0);assert.equal(result.read,1);assert.equal(result.analysis.sourceIdentity.scopeComplete,false);
});
test('depth changes actual count and byte budgets, with deterministic path ordering',async()=>{
  let reads=0;const files=Array.from({length:201},(_,i)=>file(`src/f${String(i).padStart(3,'0')}.py`,'pass',()=>reads++));
  const quick=await analyzePickedFolder(files.reverse(),{depth:'quick'});assert.equal(reads,200);assert.equal(quick.analysis.inventory.limited,1);
  const standard=await analyzePickedFolder(files,{depth:'standard'});assert.equal(standard.read,201);
  const ordered=await analyzePickedFolder([...files].reverse(),{depth:'standard'});assert.equal(standard.analysis.sourceIdentity.contentDigest,ordered.analysis.sourceIdentity.contentDigest);
});
test('content digest changes with actual bytes while HEAD remains only a hint',async()=>{
  const sha='a'.repeat(40),head=file('.git/HEAD',sha);
  const a=await analyzePickedFolder([head,file('main.py','pass')],{depth:'standard'});
  const b=await analyzePickedFolder([head,file('main.py','import os')],{depth:'standard'});
  assert.equal(a.analysis.sourceIdentity.sourceRevision,sha);assert.equal(a.analysis.sourceIdentity.dirtyState,'unknown');
  assert.notEqual(a.analysis.sourceIdentity.contentDigest,b.analysis.sourceIdentity.contentDigest);
  assert.equal(a.document.id,b.document.id);
});
test('content safety removes secret-bearing document and source findings',async()=>{
  const result=await analyzePickedFolder([file('README.md','# Scope\n-----BEGIN PRIVATE KEY-----'),file('main.py','-----BEGIN PRIVATE KEY-----')],{depth:'standard'});
  assert.equal(result.analysis.documentMap.documents.length,0);assert.equal(result.document.nodes.length,1);
  assert.equal(result.analysis.inventory.entries.filter(e=>e.state==='unsafe').length,2);
});
test('public projection contains no private filenames, excerpts or source report',async()=>{
  const result=await analyzePickedFolder([file('sensitive-name.md','# PRIVATE_SENTINEL'),file('package.json','{"name":"private-package","dependencies":{"pg":"1"}}')],{depth:'standard'});
  const publicProject=publicDocument(result.document),serialized=JSON.stringify(publicProject);
  for(const secret of ['sensitive-name','PRIVATE_SENTINEL','private-package','analysis-context','contentDigest'])assert.ok(!serialized.includes(secret),secret);
  assert.equal(readAcquisitionAnalysis(publicProject),undefined);
});
test('cancel before/during reading yields AbortError and no candidate',async()=>{
  const before=new AbortController();before.abort();await assert.rejects(analyzePickedFolder([],{depth:'quick'},before.signal),{name:'AbortError'});
  const during=new AbortController();let reads=0;
  await assert.rejects(analyzePickedFolder([file('a.py','pass',()=>{reads++;during.abort();}),file('b.py','pass',()=>reads++)],{depth:'quick'},during.signal),{name:'AbortError'});
  assert.equal(reads,1);
});
test('Hybrid preserves separate private documentation through repeated repository rescans',async()=>{
  const manifest=validateManifest({format:'diagramcloud.project-manifest',version:1,project:{id:'hybrid',title:'Hybrid'},repositories:[{id:'one',title:'One',host:'local',locator:'declared-one'},{id:'two',title:'Two',host:'local',locator:'declared-two'}]});
  let project=documentFromAtlas(manifest).document;
  const first=await analyzePickedFolder([file('README.md','# FIRST_PRIVATE')],{depth:'quick'});
  project=attachAcquisitionContext(rescanRepository(project,'one',first.model).document,first.analysis,'one');
  const second=await analyzePickedFolder([file('README.md','# SECOND_PRIVATE')],{depth:'quick'});
  project=attachAcquisitionContext(rescanRepository(project,'two',second.model).document,second.analysis,'two');
  assert.equal(readAcquisitionAnalysis(project,'one')?.documentMap.documents[0].headings[0].title,'FIRST_PRIVATE');
  project=attachAcquisitionContext(rescanRepository(project,'one',second.model).document,second.analysis,'one');
  assert.equal(project.id,'atlas-hybrid');assert.equal(readAcquisitionAnalysis(project,'one')?.documentMap.documents[0].headings[0].title,'SECOND_PRIVATE');
  assert.ok(readAcquisitionAnalysis(project,'two'));assert.ok(!JSON.stringify(publicDocument(project)).includes('SECOND_PRIVATE'));
});
test('malformed persisted analysis fails closed without exposing unvalidated context',async()=>{
  const result=await analyzePickedFolder([],{depth:'quick'});
  const block=result.document.blocks.find(block=>block.id==='analysis-context-0');assert.ok(block&&block.type==='code');
  const data=JSON.parse(block.code);data.inventory.entries=[{path:'../../private',bytes:'bad',state:'unsafe'}];block.code=JSON.stringify(data);
  assert.equal(readAcquisitionAnalysis(result.document),undefined);
});
