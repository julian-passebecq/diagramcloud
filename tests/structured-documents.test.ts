import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapStructuredDocuments,wantedStructuredDocument} from '../src/intelligence/structuredDocuments';
import {secretInText} from '../src/core/secrets';
const safe=(text:string)=>secretInText(text)===null;
test('selected JSON/YAML structures have precise lexical ranges and explicit local reference lines',()=>{
 const input=[{path:'docs/plan.json',text:'{\n  "sections": [\n    {"title":"Synthetic structure", "document_ref":"./decision.yaml#intent"}\n  ],\n  "arbitraryPath":"./not-a-ref.md",\n  "instructions":"Synthetic text must stay inert"\n}'},
 {path:'docs/decision.yaml',text:'intent:\n  label: Synthetic\n  source_refs:\n    - ../README.md\n    - ./missing.json\n'}];
 const map=mapStructuredDocuments(input,safe,['docs/plan.json','docs/decision.yaml','README.md']);
 assert.equal(map.documents.length,2);const plan=map.documents.find(d=>d.path.endsWith('plan.json'))!;
 assert.deepEqual(plan.records.find(r=>r.id==='/sections/0'),{id:'/sections/0',startLine:3,endLine:3});
 assert.deepEqual(plan.records.find(r=>r.id==='/sections'),{id:'/sections',startLine:2,endLine:4});
 assert.deepEqual(map.links,[{fromPath:'docs/decision.yaml',fromLine:4,toPath:'README.md',toLine:1,kind:'structured-reference'},{fromPath:'docs/plan.json',fromLine:3,toPath:'docs/decision.yaml',toLine:1,kind:'structured-reference'}]);
 assert(map.diagnostics.some(d=>d.code==='unresolved'&&d.line===5));assert(map.diagnostics.some(d=>d.code==='unsupported'&&d.line===3));
 assert(!JSON.stringify(map).includes('Synthetic structure'));assert(!JSON.stringify(map).includes('not-a-ref'));assert(!JSON.stringify(map).includes('must stay inert'));
});
test('document structures omit environment/secret fields and refuse unsafe native metadata',()=>{
 for(const path of ['.env.json','docs/secrets.yaml','../outside.json','C:/outside.json','vendor/model.json','package.json','databricks.yml','Chart.yaml','azuredeploy.json','docs\\model.json'])assert.equal(wantedStructuredDocument(path),false,path);
 const map=mapStructuredDocuments([{path:'docs/structure.json',text:'{"environment":{"PUBLIC_LABEL":"DO_NOT_COPY"},"password":"DO_NOT_COPY","safe":{"label":"DO_NOT_COPY"},"document_refs":["../../outside.json","https://example.invalid/doc.json","./secrets.yaml"]}'}],safe,['docs/structure.json','docs/secrets.yaml']);
 assert.deepEqual(map.documents[0].records.map(r=>r.id),['/','/safe','/document_refs']);
 assert(!JSON.stringify(map).includes('DO_NOT_COPY'));assert(!JSON.stringify(map).includes('/environment'));assert(!JSON.stringify(map).includes('/password'));assert.equal(map.links.length,0);assert(map.diagnostics.some(d=>d.code==='unsafe'));
});
test('malformed JSON, duplicate YAML mappings, aliases and custom tags retain no partial facts',()=>{
 const files=[{path:'docs/trailing.json',text:'{"document_ref":"./good.yaml",}'},{path:'docs/duplicate.yaml',text:'name: first\nname: second\n'},{path:'docs/alias.yaml',text:'a: &x {document_ref: ./good.yaml}\nb: *x'},{path:'docs/tag.yaml',text:'a: !execute Synthetic'},{path:'docs/good.yaml',text:'a:\n  list: []\n'}];
 const map=mapStructuredDocuments(files,safe);assert.deepEqual(map.documents.map(d=>d.path),['docs/good.yaml']);assert.equal(map.links.length,0);assert.equal(map.omitted.documents,4);assert.equal(map.diagnostics.filter(d=>d.code==='invalid').length,4);
 const badTarget=mapStructuredDocuments([{path:'docs/link.json',text:'{"document_ref":"./broken.json"}'},{path:'docs/broken.json',text:'not json'}],safe);
 assert.equal(badTarget.links.length,0);assert(badTarget.diagnostics.some(d=>d.code==='unresolved'));
});
test('multi-document YAML has distinct pointers and bounded deeply nested data stays lexical',()=>{
 const map=mapStructuredDocuments([{path:'docs/multi.yaml',text:'a: []\n---\nb:\n  c: {}\n'},{path:'docs/deep.json',text:'{"a":'.repeat(60)+'{}'+'}'.repeat(60)}],safe);
 assert.deepEqual(map.documents.find(d=>d.path==='docs/multi.yaml')!.records.map(r=>r.id),['/document/1','/document/1/b','/document/1/b/c','/document/0','/document/0/a']);
 assert(map.diagnostics.some(d=>d.code==='limited'&&d.path==='docs/deep.json'));assert(map.documents.every(d=>d.records.length<=2000));
});
