import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {instantiateWorkflowTemplate,privateWorkflowTemplates} from '../src/intelligence/workflowTemplates';
import {validateProjectBrief,compileProjectBrief} from '../src/intelligence/brief';
import {validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';

const sourceBytes=readFileSync('examples/workflows/01-petit-client.project-brief.json'),source=JSON.parse(sourceBytes.toString('utf8'));
const sourceCard=JSON.parse(readFileSync('examples/workflows/01-petit-client.source.json','utf8'));
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const fixedUUID=()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('the supplied r3 brief remains byte-exact and retains its original synthetic private-draft card',()=>{
 assert.equal(sha(sourceBytes),'d1c33ff28eea2584d9125b433e3891fdcf373ed6de202ab1c7f552508202f8a8');
 assert.equal(sourceCard.source.entrySha256,sha(sourceBytes));assert.equal(sourceCard.source.sourceProjectId,source.project.id);
 assert.equal(sourceCard.source.archiveSha256,'bab1150ea6c19d3ee85dba9d1db60c01fb83bc94c975688941cbe890eb163c73');
 assert.equal(sourceCard.originalIndex.basis,'SYNTHETIC');assert.equal(sourceCard.originalIndex.audience,'PRIVATE_DRAFT');
 assert.equal(sourceCard.originalIndex.runtime_claim,'NONE');assert.equal(sourceCard.originalIndex.native_validation,'NOT_RUN','original dossier assertions are not rewritten by adoption');
 validateProjectBrief(source);
});

test('every explicit load gets a new valid local instance identity while source scopes, relationships and questions stay exact',()=>{
 const ids=new Set<string>(),original=validateProjectBrief(source);
 for(let i=0;i<8;i++){
  const brief=instantiateWorkflowTemplate('01-petit-client');assert.match(brief.project.id,/^client-[a-f0-9]{32}$/);assert(brief.project.id.length<=40);
  assert.notEqual(brief.project.id,source.project.id);assert(!ids.has(brief.project.id));ids.add(brief.project.id);
  assert.deepEqual(brief.scope,original.scope);assert.deepEqual(brief.relationships,original.relationships);assert.deepEqual(brief.questions,original.questions);
  assert.equal(brief.project.title,original.project.title);assert.deepEqual(Object.keys(brief).sort(),Object.keys(original).sort(),'only native ProjectBrief keys');
 }
 assert.equal(ids.size,8);assert.equal(privateWorkflowTemplates.length,1,'the seven other original workflows are not claimed adopted');
});

test('reference-to-instance provenance fits native project summary without changing the original source',()=>{
 const before=sourceBytes.toString('utf8'),brief=instantiateWorkflowTemplate('01-petit-client',fixedUUID);
 for(const phrase of ['Synthetic','source-declared','occurrence UNKNOWN','PRIVATE_DRAFT',source.project.id,sha(sourceBytes),'workflows/01-petit-client.project-brief.json'])assert(brief.project.summary.includes(phrase));
 assert.equal(brief.project.id,'client-aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa');
 assert.equal(readFileSync('examples/workflows/01-petit-client.project-brief.json','utf8'),before);
 assert.equal(Object.hasOwn(brief,'reference'),false);assert.equal(Object.hasOwn(brief,'observations'),false);
 brief.scope[0].title='Edited local instance';brief.questions.push('Local author question');
 const fresh=instantiateWorkflowTemplate('01-petit-client',fixedUUID);assert.equal(fresh.scope[0].title,source.scope[0].title);assert.deepEqual(fresh.questions,source.questions);
});

test('native compilation creates only private declarations, preserves query/control and never creates observations or runtime receipts',()=>{
 const brief=instantiateWorkflowTemplate('01-petit-client',fixedUUID),before=JSON.stringify(brief),out=compileProjectBrief(brief),doc=validateDocument(out.document);
 assert.equal(out.manifest,null);assert.equal(JSON.stringify(brief),before);assert.equal(doc.id,'brief-'+brief.project.id);
 assert.equal(doc.observations.length,0);assert(doc.nodes.every(n=>n.visibility==='private'));assert(doc.edges.every(e=>e.visibility==='private'));
 assert(doc.blocks.every(b=>b.visibility==='private'));assert(doc.sources.every(s=>s.visibility==='private'));
 assert.deepEqual(doc.edges.map(e=>e.kind),['query','query','control']);
 for(const scope of brief.scope){const node=doc.nodes.find(n=>n.id==='brief-scope-'+scope.id)!;assert(node);assert.equal(node.label,scope.title);assert.equal(node.basis,'planned');}
 const context=doc.blocks.find(b=>b.id==='brief-context');assert(context?.type==='text');for(const question of source.questions)assert(context.text.includes(question));
 assert(doc.experience!.items.every(i=>i.approval==='draft'&&i.visibility==='private'));assert.equal(publicDocument(doc).nodes.length,0);assert.equal(publicDocument(doc).edges.length,0);
});

test('catalogue entry names the supplied problem, inputs/outputs, three unknowns and missing runtime detail',()=>{
 const entry=privateWorkflowTemplates[0];assert(entry.problem);assert(entry.inputs.length);assert(entry.outputs.length);
 assert.deepEqual(entry.unknowns,source.questions);assert.equal(entry.unknowns.length,3);
 for(const label of ['Synthetic','Source-declared','PRIVATE_DRAFT','Occurrence UNKNOWN'])assert(entry.labels.includes(label as typeof entry.labels[number]));
 assert(entry.constraints.some(text=>/Actors, gates, retries, timing/.test(text)));assert.equal(entry.source.entrySha256,sha(sourceBytes));
});

test('unknown template or malformed generated identity fails without echoing data or modifying the supplied definition',()=>{
 const before=readFileSync('examples/workflows/01-petit-client.project-brief.json','utf8');
 assert.throws(()=>instantiateWorkflowTemplate('not-a-template'),/^Error: Unknown private workflow template$/);
 for(const value of ['draft-01-petit-client','password=PRIVATE_ID_SENTINEL','', 'a'.repeat(100)])assert.throws(()=>instantiateWorkflowTemplate('01-petit-client',()=>value),(error:unknown)=>error instanceof Error&&error.message==='Invalid generated local workflow instance identity'&&(!value||!error.message.includes(value)));
 assert.equal(readFileSync('examples/workflows/01-petit-client.project-brief.json','utf8'),before);
});
