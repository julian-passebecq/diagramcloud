import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema,validateDocument} from '../src/core/model';
import {publicDocument,removeNode} from '../src/core/operations';
import {previewDeliveryBrief,environmentMatrix} from '../src/intelligence/delivery';
import {impactFacts,recommendRecipes,projectCollection} from '../src/intelligence/recipes';
import {DEFAULT_OPTIONS} from '../src/intelligence/types';
import {queryProject,proposePublicDesign} from '../src/intelligence/context';
import {analyzeDomainFiles,extendWithDomainFacts} from '../src/intelligence/domainAdapters';
const project=()=>documentSchema.parse({schemaVersion:1,id:'synthetic-project',title:'Synthetic product',rootViewId:'root',nodes:[{id:'api',label:'API'},{id:'data',label:'Data'}],edges:[{id:'reads',source:'api',target:'data',basis:'static-source'}],views:[{id:'root',title:'System',nodeIds:['api','data'],edgeIds:['reads'],perspective:'system'}]});
const brief=(p=project())=>({format:'diagramcloud.delivery-brief',version:1,projectId:p.id,baseRevision:p.revision,delivery:{
 environments:[{id:'dev',label:'Synthetic development'},{id:'prod',label:'PRIVATE_PROD_SENTINEL'}],artifacts:[{id:'build',label:'Declared build',version:'1'}],
 instances:[{id:'api-dev',nodeId:'api-dev-instance',componentId:'api',environmentId:'dev',artifactId:'build',declaredRevision:'aaaaaaa'}],
 promotions:[{id:'promote',fromEnvironmentId:'dev',toEnvironmentId:'prod',artifactId:'build',gates:[{id:'approval',label:'Owner approval'}]}]}});
test('delivery declarations are private typed proposals; observations are never manufactured',()=>{
 const p=project(),out=previewDeliveryBrief(p,brief(p));assert.equal(p.delivery,undefined);assert.equal(out.document.observations.length,0);
 assert.equal(out.document.delivery?.environments[0].visibility,'private');assert.equal(environmentMatrix(out.document)[0].drift,'UNKNOWN');
 assert.ok(!JSON.stringify(publicDocument(out.document)).includes('PRIVATE_PROD_SENTINEL'));assert.doesNotThrow(()=>validateDocument(out.document));
 assert.throws(()=>previewDeliveryBrief({...p,revision:1},brief(p)),/revision conflict/);
 const invalid=brief();invalid.delivery.instances[0].environmentId='missing';assert.throws(()=>previewDeliveryBrief(p,invalid),/unknown reference/);
 assert.doesNotThrow(()=>removeNode(out.document,'api'));
});
test('delivery matrix uses reviewed instance-specific evidence and never component-wide assumptions',()=>{
 const doc=previewDeliveryBrief(project(),brief()).document;
 doc.observations=[{id:'obs-component',nodeId:'api',sourceApp:'external',authority:'Synthetic test fixture',observedAt:'2026-10-09T00:00:00Z',sourceRevision:'aaaaaaa',claim:'observed',summary:'Fixture only',blockIds:[],caveat:'Synthetic test harness; no actual deployment',visibility:'private',shareable:false,reviewedAt:'2026-10-09T00:00:00Z'}];
 assert.equal(environmentMatrix(doc)[0].observed,null);
 doc.observations[0].nodeId='api-dev-instance';assert.equal(environmentMatrix(doc)[0].drift,'same-revision');doc.observations[0].sourceRevision='bbbbbbb';assert.equal(environmentMatrix(doc)[0].drift,'revision-difference');
 doc.observations[0].claim='not-observed';assert.equal(environmentMatrix(doc)[0].drift,'UNKNOWN');
 doc.observations[0].reviewedAt=undefined;assert.equal(environmentMatrix(doc)[0].drift,'UNKNOWN');
});

test('delivery identity conflicts and public citations behind discarded declarations are refused or removed',()=>{
 const p=project(),invalid=brief();invalid.delivery.instances[0].nodeId='data';assert.throws(()=>previewDeliveryBrief(p,invalid),/unused node identity/);
 const d=previewDeliveryBrief(p,brief()).document,next=brief(d);next.delivery.instances[0].componentId='data';assert.throws(()=>previewDeliveryBrief(d,next),/Conflicting deployment/);
 const self=structuredClone(d);self.delivery!.instances[0].componentId=self.delivery!.instances[0].nodeId;assert.throws(()=>validateDocument(self),/Logical components must be distinct/);
 d.sources.push({id:'private-declaration',title:'PRIVATE SOURCE',location:'selected declaration',visibility:'private'},{id:'unused-public',title:'DROPPED_SOURCE_SENTINEL',location:'private environment label in locator',visibility:'public'});
 d.delivery!.environments[0].visibility='public';d.delivery!.environments[0].sourceIds=['private-declaration','unused-public'];
 assert.ok(!JSON.stringify(publicDocument(d)).includes('DROPPED_SOURCE_SENTINEL'));
});
test('public delivery strips private environment/artifact/gate references and retains public source citations',()=>{
 const d=previewDeliveryBrief(project(),brief()).document;d.delivery!.environments[0].visibility='public';d.delivery!.instances[0].visibility='public';d.nodes.find(n=>n.id==='api-dev-instance')!.visibility='public';
 d.sources.push({id:'public-declaration',title:'Author declaration',location:'Synthetic declaration',visibility:'public'});d.delivery!.instances[0].sourceIds=['public-declaration'];d.views[0].nodeIds.push('api-dev-instance');
 const safe=publicDocument(d);assert.equal(safe.delivery?.instances.length,1);assert.equal(safe.delivery?.instances[0].artifactId,undefined);assert.equal(safe.delivery?.promotions.length,0);assert.ok(safe.sources.some(s=>s.id==='public-declaration'));assert.doesNotThrow(()=>validateDocument(safe));
});

test('instance comparison chooses actual capture time across supported timezone offsets',()=>{
 const doc=previewDeliveryBrief(project(),brief()).document;
 const base={nodeId:'api-dev-instance',sourceApp:'external',authority:'Synthetic timezone fixture',claim:'observed' as const,summary:'Synthetic fixture only',blockIds:[],caveat:'No actual deployment',visibility:'private' as const,shareable:false,reviewedAt:'2026-10-09T00:00:00Z'};
 doc.observations=[{...base,id:'earlier',observedAt:'2026-10-09T17:00:00+02:00',sourceRevision:'bbbbbbb'},{...base,id:'later',observedAt:'2026-10-09T16:00:00Z',sourceRevision:'aaaaaaa'}];
 validateDocument(doc);assert.equal(environmentMatrix(doc)[0].drift,'same-revision');assert.equal(environmentMatrix(doc)[0].observed?.capturedAt,'2026-10-09T16:00:00Z');
});
test('bounded source impact, capability recipes and public context do not expose private components',()=>{
 const p=project();assert.equal(impactFacts(p,'api',{direction:'downstream',includeInferred:false}).nodes.length,2);assert.equal(impactFacts(p,'api',{direction:'upstream',includeInferred:false}).nodes.length,1);
 assert.equal(recommendRecipes(p,DEFAULT_OPTIONS).find(r=>r.id==='data')?.availability,'unknown');assert.equal(projectCollection([p])[0].source,'independent-project');
 p.nodes[1].visibility='private';assert.ok(!JSON.stringify(queryProject(p,{kind:'components'})).includes('Data'));assert.throws(()=>queryProject(p,{kind:'impact',nodeId:'data'}),/Unknown/);assert.throws(()=>queryProject(p,{kind:'summary',path:'secret'}));
 assert.throws(()=>proposePublicDesign(p,{format:'diagramcloud.design-brief',version:1,projectId:p.id,views:[{viewId:'root',focal:['data']}]}),/outside/);
});
test('native specialist joins are exact, bounded and versioned',()=>{
 const found=analyzeDomainFiles([
 {path:'Sales.Report/definition.pbir',text:'{"version":"4.0","datasetReference":{"byPath":{"path":"../Sales.SemanticModel"}}}'},
 {path:'Sales.SemanticModel/definition/tables/Sales.tmdl',text:'table Sales\n measure Revenue'},
 {path:'Example.sln',text:'Project("type") = "A", "A/A.csproj", "id"'},
 {path:'A/A.csproj',text:'<Project><PackageReference Include="Synthetic.Library" Version="1.2.3" /></Project>'},
 {path:'openapi.json',text:JSON.stringify({openapi:'3.1.0',info:{title:'Synthetic'},paths:{'/items':{get:{responses:{'200':{content:{'application/json':{schema:{$ref:'#/components/schemas/Item'}}}}}}}},components:{schemas:{Item:{type:'object'}}}})},
 {path:'example.job.json',text:'{"name":"Synthetic job","tasks":[{"task_key":"a"},{"task_key":"b","depends_on":[{"task_key":"a"}]}]}'},
 {path:'main.bicep',text:"resource web 'Microsoft.Web/sites@2024-04-01' = {}"}
 ]);
 for(const expected of ['PBIR declared datasetReference','PackageReference 1.2.3','solution member','operation schema $ref','declared depends_on'])assert.ok(found.links.some(l=>l.label===expected),expected);
 assert.ok(found.capabilities.includes('azure'));assert.ok(found.sources.every(s=>s.parserVersion==='diagramcloud-domain/3'));assert.doesNotThrow(()=>extendWithDomainFacts(project(),found));
 const unsupported=analyzeDomainFiles([{path:'target/manifest.json',text:'{"metadata":{"dbt_schema_version":"https://schemas.getdbt.com/dbt/manifest/v999.json"},"nodes":{"model.synthetic.x":{"name":"x"}}}'}]);assert.equal(unsupported.facts.length,0);assert.ok(unsupported.diagnostics.some(d=>d.includes('Unsupported')));
});
