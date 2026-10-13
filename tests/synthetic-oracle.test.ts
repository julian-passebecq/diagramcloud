import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {analyzePickedFolder} from '../src/intelligence/acquisition';
import {projectReadiness} from '../src/intelligence/readiness';
import {validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {parseManifest,documentFromAtlas} from '../src/core/atlas';
import {crossRepositoryCandidates,repositoryAnalysis} from '../src/intelligence/crossRepository';
const root=resolve('tests/fixtures/projects');
type Case={id:string;root:string;minimumOutputs:string[];documentLinks?:{fromPath:string;fromLine:number;toPath:string}[];metadataExcluded?:string[];contentExcluded?:string[];minimumDiagnostics?:number;explicitRepositoryIds?:string[]};
const truth=JSON.parse(readFileSync(join(root,'truth.json'),'utf8')) as {format:string;provenance:string;cases:Case[]};
function selectedFiles(dir:string,reads:Set<string>,prefix=''):File[]{return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const path=prefix+entry.name,full=join(dir,entry.name);if(entry.isDirectory())return selectedFiles(full,reads,path+'/');const bytes=readFileSync(full);return [{name:entry.name,webkitRelativePath:'synthetic/'+path,size:bytes.length,arrayBuffer:async()=>{reads.add(path);return Uint8Array.from(bytes).buffer;}} as File];});}
for(const oracle of truth.cases)test('independent synthetic oracle: '+oracle.id,async()=>{
 assert.equal(truth.format,'diagramcloud.synthetic-truth/1');assert.equal(truth.provenance,'synthetic');
 const reads=new Set<string>(),files=selectedFiles(join(root,oracle.root),reads),result=await analyzePickedFolder(files,{depth:'standard'});
 const project=validateDocument(result.document);assert.deepEqual(projectReadiness(project).views.filter(v=>v.required).map(v=>v.id),oracle.minimumOutputs);
 assert.equal(project.observations.length,0,'Static source never manufactures observed/verified runtime');assert.equal(project.atlas,undefined,'Discovery never creates undeclared repository membership');
 for(const path of oracle.metadataExcluded??[])assert.equal(reads.has(path),false,'Excluded metadata was read: '+path);
 for(const path of oracle.contentExcluded??[])assert.ok(result.analysis.inventory.entries.some(e=>e.path===path&&e.state==='unsafe'));
 for(const expected of oracle.documentLinks??[])assert.ok(result.analysis.documentMap.links.some(l=>l.fromPath===expected.fromPath&&l.fromLine===expected.fromLine&&l.toPath===expected.toPath),'Exact authored reference not recovered');
 if(oracle.minimumDiagnostics)assert.ok(result.domain.diagnostics.length>=oracle.minimumDiagnostics);
 const safe=JSON.stringify(publicDocument(project));for(const path of [...(oracle.metadataExcluded??[]),...(oracle.contentExcluded??[])])assert.ok(!safe.includes(path));assert.ok(!safe.includes('SYNTHETIC_NEVER_VALID_KEY'));
 if(oracle.id==='ambiguous')assert.ok(!project.edges.some(e=>/bronze|silver|gold/i.test(e.label)),'Labels do not establish medallion lineage');
 if(oracle.explicitRepositoryIds){const {manifest}=parseManifest(readFileSync(join(root,oracle.root,'project-manifest.json'),'utf8')),atlas=documentFromAtlas(manifest).document;assert.deepEqual(manifest.repositories.map(r=>r.id),oracle.explicitRepositoryIds);
  const analyses=await Promise.all(oracle.explicitRepositoryIds.map(async id=>{const acquired=await analyzePickedFolder(selectedFiles(join(root,oracle.root,id),new Set()),{depth:'standard'});return repositoryAnalysis(acquired.domain,id,id==='producer'?'a'.repeat(40):'b'.repeat(40));}));
  assert.equal(crossRepositoryCandidates(atlas,analyses).candidates.length,0,'Shared technology/name cannot manufacture cross-repository joins');
 }
});
