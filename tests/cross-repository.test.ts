import test from 'node:test';
import assert from 'node:assert/strict';
import {documentFromAtlas,validateManifest,prefixed} from '../src/core/atlas';
import {scanRepository} from '../src/core/scan';
import {analyzeDomainFiles} from '../src/intelligence/domainAdapters';
import {crossRepositoryCandidates,crossRepositoryPatch,repositoryAnalysis,retainedRepositoryAnalyses} from '../src/intelligence/crossRepository';
import {previewRepositoryRescan} from '../src/intelligence/refresh';
import {applyDocumentPatch} from '../src/core/patch';
import {validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
const revision='a'.repeat(40),other='b'.repeat(40);
const producer=[{path:'.git/HEAD',text:revision},{path:'Library/Library.csproj',text:'<Project><PropertyGroup><PackageId>Synthetic.Contracts</PackageId><Version>1.0.0</Version><IsPackable>true</IsPackable></PropertyGroup></Project>'}];
const consumer=[{path:'.git/HEAD',text:other},{path:'Api/Api.csproj',text:'<Project><PackageReference Include="Synthetic.Contracts" Version="1.0.0" /></Project>'}];
const atlas=()=>documentFromAtlas(validateManifest({format:'diagramcloud.project-manifest',version:1,project:{id:'synthetic-contract',title:'Synthetic contracts'},repositories:[{id:'library',title:'Library',host:'local',locator:'library',role:'library'},{id:'api',title:'API',host:'local',locator:'api',role:'service'}],relationships:[]}),{library:{model:scanRepository(producer),domain:analyzeDomainFiles(producer)},api:{model:scanRepository(consumer),domain:analyzeDomainFiles(consumer)}}).document;
test('strong producer/consumer contract joins retain citations and require a reviewed private patch',()=>{
 const doc=atlas(),reports=retainedRepositoryAnalyses(doc);assert.equal(reports.length,2);
 const result=crossRepositoryCandidates(doc,reports);assert.equal(result.candidates.length,1);assert.equal(result.unresolved.length,0);
 assert.ok(result.candidates[0].evidence.every(e=>e.path.endsWith('.csproj')&&e.line===1));
 const previousEdgeCount=doc.edges.length;const patch=crossRepositoryPatch(doc,reports,[result.candidates[0].id]),after=applyDocumentPatch(doc,patch).result;
 assert.equal(doc.edges.length,previousEdgeCount);const relationship=after.edges.find(e=>e.id===result.candidates[0].id)!;assert.equal(relationship.basis,'static-source');assert.equal(relationship.visibility,'private');assert.equal(after.observations.length,0);
 assert.ok(after.sources.some(s=>s.location?.includes('library@'+revision)));
 assert.ok(!JSON.stringify(publicDocument(after)).includes('Synthetic.Contracts'));
 assert.throws(()=>crossRepositoryPatch(after,reports,[result.candidates[0].id]),/already exists/);
});
test('same names, missing producer declaration, ranges and wrong revisions never guess relationships',()=>{
 const doc=atlas(),reports=retainedRepositoryAnalyses(doc),first=structuredClone(reports);first[0].contracts=[];
 assert.equal(crossRepositoryCandidates(doc,first).candidates.length,0);
 first[0].revision='c'.repeat(40);assert.throws(()=>crossRepositoryCandidates(doc,first),/revision differs/);
 assert.throws(()=>crossRepositoryCandidates(doc,[reports[0],reports[0]]),/Duplicate/);
 assert.equal(analyzeDomainFiles([{path:'A.csproj',text:'<Project><PackageId>Synthetic.Contracts</PackageId><Version>1.0.0</Version></Project>'}]).contracts.length,0);
 assert.equal(analyzeDomainFiles([{path:'A.csproj',text:'<Project><PackageReference Include="Synthetic.Contracts" Version="[1.0.0,2.0.0)" /></Project>'}]).contracts.length,0);
 const noMember={...reports[0],repositoryId:'unlisted'};assert.throws(()=>crossRepositoryCandidates(doc,[noMember]),/not a declared atlas member/);
});
test('OpenAPI explicit contracts resolve across supplied independent revision vectors, ambiguous producers stay unknown',()=>{
 const doc=atlas();const api=(identity:string,consume=false)=>[{path:'openapi.json',text:JSON.stringify({openapi:'3.1.0',info:{title:'Synthetic',version:'v1'},paths:{},...(consume?{'x-diagramcloud-consumes':[{id:identity,version:'v1'}]}:{'x-diagramcloud-contract-id':identity})})}];
 const reports=[repositoryAnalysis(analyzeDomainFiles(api('synthetic-order-contract')),'library',revision),repositoryAnalysis(analyzeDomainFiles(api('synthetic-order-contract',true)),'api',other)];
 assert.equal(crossRepositoryCandidates(doc,reports).candidates.length,1);
 reports[0].contracts.push({...reports[0].contracts[0],path:'duplicate/openapi.json'});const ambiguous=crossRepositoryCandidates(doc,reports);
 assert.equal(ambiguous.candidates.length,0);assert.ok(ambiguous.unresolved[0].reason.includes('Ambiguous'));
});
test('Hybrid native rescans retain author labels/positions and refresh version-qualified private receipts',()=>{
 const doc=atlas(),id=doc.nodes.find(n=>n.id.startsWith('api.domain-')&&!n.id.includes('nav'))!.id;
 doc.nodes.find(n=>n.id===id)!.label='Author label';const view=doc.views.find(v=>v.nodeIds.includes(id))!;view.positions[id]={x:887,y:441};
 const selected=[...consumer,{path:'Api/Program.cs',text:'app.MapGet("/health", () => "ok");'}];
 const after=previewRepositoryRescan(doc,'api',scanRepository(selected),undefined,new Date('2026-10-09T10:00:00Z'),analyzeDomainFiles(selected)).document;
 assert.equal(after.nodes.find(n=>n.id===id)?.label,'Author label');assert.deepEqual(after.views.find(v=>v.id===view.id)?.positions[id],{x:887,y:441});
 assert.ok(after.nodes.some(n=>n.label==='GET /health'));assert.ok(after.blocks.some(b=>b.id===prefixed('api','domain-analysis-receipt')));
 assert.equal(retainedRepositoryAnalyses(after).length,2);assert.doesNotThrow(()=>validateDocument(after));
});
test('multiple explicit consumers have distinct stable review identities and duplicated declarations are refused',()=>{
 const doc=atlas(),reports=retainedRepositoryAnalyses(doc),consumerReport=reports.find(r=>r.repositoryId==='api')!;
 consumerReport.contracts.push({...consumerReport.contracts[0],nodeKey:'dotnet:Worker/Worker.csproj',path:'Worker/Worker.csproj'});
 const result=crossRepositoryCandidates(doc,reports);assert.equal(result.candidates.length,2);assert.equal(new Set(result.candidates.map(c=>c.id)).size,2);
 const after=applyDocumentPatch(doc,crossRepositoryPatch(doc,reports,result.candidates.map(c=>c.id))).result;assert.equal(after.edges.filter(e=>result.candidates.some(c=>c.id===e.id)).length,2);
 consumerReport.contracts.push({...consumerReport.contracts[0]});assert.throws(()=>crossRepositoryCandidates(doc,reports),/Duplicate contract declarations/);
});
