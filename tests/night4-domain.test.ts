import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument,documentSchema} from '../src/core/model';
import {analyzeDomainFiles,extendWithDomainFacts} from '../src/intelligence/domainAdapters';

const blank=()=>documentSchema.parse({schemaVersion:1,id:'synthetic-project',title:'Synthetic',rootViewId:'root',
 nodes:[{id:'root-node',label:'Project'}],edges:[],views:[{id:'root',title:'Project',nodeIds:['root-node']}]});
test('NIGHT4 native dbt manifest uses unique IDs and explicit dependency lineage',()=>{
 const selected=[{path:'target/manifest.json',text:JSON.stringify({metadata:{dbt_schema_version:'https://schemas.getdbt.com/dbt/manifest/v12.json'},
  nodes:{'model.shop.orders':{name:'orders',depends_on:{nodes:['source.shop.raw']}},
   'test.shop.orders':{name:'test_orders',depends_on:{nodes:['model.shop.orders']}}},sources:{'source.shop.raw':{name:'raw'}}})}];
 const found=analyzeDomainFiles(selected);
 assert.ok(found.capabilities.includes('dbt'));
 assert.equal(found.facts.length,3);
 assert.equal(found.links.length,2);
 const doc=extendWithDomainFacts(blank(),found);
 assert.equal(doc.views.find(v=>v.id==='domain-view-dbt')?.edgeIds.length,2);
 assert.ok(doc.edges.every(x=>x.visibility==='private'&&x.basis==='static-source'));
 assert.doesNotThrow(()=>validateDocument(doc));
});
test('NIGHT4 selected Databricks jobs and .NET ProjectReferences are static',()=>{
 const found=analyzeDomainFiles([
  {path:'databricks.yml',text:'resources:\n  jobs:\n    training:\n      tasks:\n        - task_key: load\n        - task_key: train\n          depends_on:\n            - task_key: load\n'},
  {path:'A/A.csproj',text:'<Project><ItemGroup><ProjectReference Include="../B/B.csproj" /></ItemGroup></Project>'},
  {path:'B/B.csproj',text:'<Project></Project>'},
  {path:'openapi.yaml',text:'openapi: 3.1.0\ninfo:\n  title: Synthetic API\npaths:\n  /items:\n    get:\n      operationId: listItems'}
 ]);
 assert.ok(found.capabilities.includes('databricks'));
 assert.ok(found.capabilities.includes('dotnet'));
 assert.ok(found.links.some(x=>x.label==='declared depends_on'));
 assert.ok(found.links.some(x=>x.label==='ProjectReference'));
 assert.ok(found.facts.some(x=>x.label==='GET /items'));
 assert.ok(extendWithDomainFacts(blank(),found).views.some(v=>v.id==='domain-view-dotnet'));
});
test('NIGHT4 PBIR/TMDL declarations produce generic private artifacts, never runtime claims',()=>{
 const f=analyzeDomainFiles([{path:'Retail.Report/definition.pbir',text:'{"version":"4.0","datasetReference":{"byPath":{"path":"../Retail.SemanticModel"}}}'},
 {path:'Retail.SemanticModel/definition/tables/Sales.tmdl',text:"table 'Sales'\n  measure 'Revenue'"}]);
 assert.ok(f.capabilities.includes('fabric'));
 assert.ok(f.facts.some(x=>x.kind==='table'));
 assert.ok(f.facts.every(x=>!/runtime|live traffic|verified in production/i.test(x.summary)));
 const d=extendWithDomainFacts(blank(),f);
 assert.ok(d.nodes.filter(x=>x.id.startsWith('domain-')).every(x=>x.visibility==='private'));
});
