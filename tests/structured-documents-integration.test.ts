import test from 'node:test';
import assert from 'node:assert/strict';
import {mapAuthorizedDocuments,wantedDocument} from '../src/intelligence/documents';
import {buildDocumentAnalysisBundle} from '../src/intelligence/documentBundle';
import {analysisProfile} from '../src/intelligence/profile';
import {analyzePickedFolder} from '../src/intelligence/acquisition';
import {readAcquisitionAnalysis} from '../src/intelligence/materialize';
const files=[{path:'README.md',text:'# Synthetic documentation\n[Specification](spec.json)\n'},{path:'spec.json',text:'{\n "description": "Synthetic local fixture",\n "document_ref": "notes.yaml",\n "items": [{"name":"Illustrative only"}]\n}'},{path:'notes.yaml',text:'source_ref: README.md\nsections:\n  - kind: synthetic\n'}];
test('mixed selected documents resolve exact cross-format links and produce line-qualified lexical records',async()=>{
 const map=mapAuthorizedDocuments(files);assert.deepEqual(map.documents.map(d=>d.kind).sort(),['json','markdown','yaml']);assert.equal(map.links.length,3);assert.ok(map.links.some(l=>l.fromPath==='README.md'&&l.toPath==='spec.json'&&l.kind==='document-link'));assert.ok(map.links.some(l=>l.fromPath==='spec.json'&&l.fromLine===3&&l.toPath==='notes.yaml'&&l.kind==='structured-reference'));const bundle=await buildDocumentAnalysisBundle(files,{repositoryId:'fixture',revision:'a'.repeat(40)},analysisProfile('quick',{analyzers:['documents']}));assert.ok(bundle.items.some(i=>i.label==='/items/0'));assert.ok(!JSON.stringify(bundle.items).includes('Illustrative only'));assert.ok(bundle.links.some(l=>l.kind==='structured-reference'));assert.ok(bundle.sources.every(s=>s.line>=1&&s.contentDigest.length===64));
});
test('invalid and unsafe structured targets remain unresolved and native configuration stays with its analyzer',()=>{
 const map=mapAuthorizedDocuments([{path:'README.md',text:'[Bad](bad.json)'},{path:'bad.json',text:'{"invalid":'},{path:'notes.yaml',text:'document_ref: bad.json\n'}]);assert.equal(map.links.length,0);assert.ok(map.diagnostics.some(d=>d.path==='bad.json'&&d.code==='invalid'));assert.ok(map.diagnostics.some(d=>d.path==='README.md'&&d.code==='unresolved'));for(const path of ['package.json','dbt_project.yml','databricks.yml','credentials.json','.env.yaml'])assert.equal(wantedDocument(path),false,path);
});
test('selected-folder structured document map survives private authoring retention with exact source references',async()=>{
 const input=files.map(f=>Object.assign(new File([f.text],f.path),{webkitRelativePath:'synthetic-folder/'+f.path})),result=await analyzePickedFolder(input,{depth:'quick'}),retained=readAcquisitionAnalysis(result.document);assert.ok(retained);assert.ok(retained!.documentMap.documents.some(d=>d.kind==='json'));assert.ok(retained!.documentMap.links.some(l=>l.kind==='structured-reference'));assert.ok(result.document.blocks.filter(b=>b.id.startsWith('analysis-context-')).every(b=>b.visibility==='private'));assert.equal(result.document.observations.length,0);
});
test('acquisition sends included arbitrary Databricks YAML to both lexical and specialist analyzers',async()=>{
 const selected=[{path:'databricks.yml',text:'bundle:\n  name: Synthetic bundle\ninclude:\n  - resources/*.yaml\n'},
  {path:'resources/jobs.yaml',text:'resources:\n  jobs:\n    import_job:\n      name: Synthetic import\n      tasks:\n        - task_key: read\n        - task_key: transform\n          depends_on:\n            - task_key: read\n'}];
 const input=selected.map(f=>Object.assign(new File([f.text],f.path),{webkitRelativePath:'synthetic-bundle/'+f.path})),result=await analyzePickedFolder(input,{depth:'quick'});
 assert.equal(result.analysis.inventory.entries.find(e=>e.path==='resources/jobs.yaml')?.state,'scanned');
 assert(result.analysis.documentMap.documents.some(d=>d.path==='resources/jobs.yaml'&&d.kind==='yaml'&&d.records.some(r=>r.id==='/resources/jobs/import_job/tasks/1')));
 const job=result.domain.facts.find(f=>f.label==='Synthetic import'),tasks=result.domain.facts.filter(f=>f.key.includes(':jobs:import_job:task:'));
 assert.equal(job?.path,'resources/jobs.yaml');assert.equal(job?.line,3);assert.equal(tasks.length,2);
 assert(tasks.every(t=>t.key.startsWith('databricks:databricks.yml:base:jobs:import_job:task:')));
 assert(result.domain.links.some(l=>l.from===tasks.find(t=>t.label==='read')?.key&&l.to===tasks.find(t=>t.label==='transform')?.key&&l.label==='declared depends_on'&&l.path==='resources/jobs.yaml'&&l.line===9));
 assert(result.document.nodes.some(n=>n.label==='Synthetic import'&&n.visibility==='private'));assert.equal(result.document.observations.length,0);
});

