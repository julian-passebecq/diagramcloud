import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema,validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {documentFromAtlas,parseManifest} from '../src/core/atlas';
import {analyzePickedFolder} from '../src/intelligence/acquisition';
import {mapAuthorizedDocuments} from '../src/intelligence/documents';
import {mapStructuredDocuments} from '../src/intelligence/structuredDocuments';
import {attachAcquisitionContext,readAcquisitionAnalysis} from '../src/intelligence/materialize';
import {projectReadiness} from '../src/intelligence/readiness';
import {sourceConflictCandidates} from '../src/intelligence/sourceConflicts';
import {actionForGapCause,GAP_CAUSES,gapActionSchema,gapCauseSchema} from '../src/intelligence/gapDetails';

const project=()=>validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-gap-project',title:'Synthetic declaration example',rootViewId:'root',
  nodes:[{id:'app',label:'Example app',kind:'app'}],edges:[],views:[{id:'root',title:'Architecture',nodeIds:['app'],positions:{}}]}));

test('advice descriptors support the eight causes without granting actions or accepting executable fields',()=>{
  assert.deepEqual(GAP_CAUSES,['missing-declaration','missing-source','access-denied','unsupported-analyzer','dynamic-unresolved','stale-revision','conflicting-evidence','consumer-error']);
  for(const cause of GAP_CAUSES){assert.equal(gapCauseSchema.parse(cause),cause);assert.doesNotThrow(()=>gapActionSchema.parse(actionForGapCause(cause)));}
  assert.equal(gapCauseSchema.safeParse('unknown').success,false);
  assert.equal(gapActionSchema.safeParse({kind:'declare',label:'Review',command:'execute'}).success,false);
  assert.equal(gapActionSchema.safeParse({kind:'declare',label:'x'.repeat(241)}).success,false);
  const first=actionForGapCause('missing-source');first.label='Changed by caller';assert.notEqual(actionForGapCause('missing-source').label,first.label);
});

test('actual readiness rules classify missing authored declarations without guessing why relationships are absent',()=>{
  const doc=project(),before=JSON.stringify(doc),report=projectReadiness(doc,{purpose:'portfolio'});
  for(const id of ['business-purpose','contribution','no-sources']){
    const gap=report.gaps.find(g=>g.id===id)!;assert.equal(gap.cause,'missing-declaration');assert.equal(gap.action?.kind,'declare');
  }
  assert.equal(report.gaps.find(g=>g.id==='no-relations')?.cause,undefined);
  assert.equal(projectReadiness(doc,{purpose:'audit'}).gaps.find(g=>g.id==='runtime-qualification')?.cause,undefined);
  assert.equal(JSON.stringify(doc),before);assert.equal(doc.observations.length,0);
});

test('only an explicit missing repository classifies missing-source; failed and unscanned members retain unknown causes',()=>{
  const {manifest}=parseManifest(JSON.stringify({format:'diagramcloud.project-manifest',version:1,project:{id:'synthetic-gaps',title:'Synthetic source gaps'},
    repositories:['missing','failed','unscanned'].map(id=>({id,title:id,host:'local',locator:id,role:'service'})),relationships:[]}));
  const doc=documentFromAtlas(manifest,{missing:{missing:true},failed:{error:'Synthetic read failed'}},{now:new Date('2026-10-14T12:00:00Z')}).document;
  const gaps=projectReadiness(doc).gaps;
  assert.equal(gaps.find(g=>g.id==='repo-missing')?.cause,'missing-source');
  assert.equal(gaps.find(g=>g.id==='repo-missing')?.action?.kind,'select-source');
  for(const id of ['failed','unscanned'])assert.equal(gaps.find(g=>g.id==='repo-'+id)?.cause,undefined);
  assert.equal(doc.observations.length,0);
});

test('document producers identify unsupported fragment resolution but leave unavailable, unsafe and ambiguous references unclassified',()=>{
  const map=mapAuthorizedDocuments([{path:'README.md',text:'# Example\n[Section](docs/example.md#section)\n[Unknown](docs/missing.md)\n[Outside](../outside.md)\n'},
    {path:'docs/example.md',text:'# Section'},
    {path:'sources.csv',text:'id,url\ns1,https://example.invalid/a\n'},
    {path:'old/sources.csv',text:'id,url\ns1,https://example.invalid/b\n'},
    {path:'work.csv',text:'id,source_ids\nw1,s1;s2\n'}]);
  const unsupported=map.diagnostics.find(d=>d.code==='unsupported')!;
  assert.equal(unsupported.cause,'unsupported-analyzer');assert.equal(unsupported.action?.kind,'use-specialist');assert.equal(unsupported.line,2);
  const unavailable=map.diagnostics.find(d=>d.path==='README.md'&&d.line===3)!;
  assert.equal(unavailable.cause,undefined);assert.equal(unavailable.action?.kind,'select-source');
  const unsafe=map.diagnostics.find(d=>d.path==='README.md'&&d.line===4)!;assert.equal(unsafe.cause,undefined);assert.equal(unsafe.action,undefined);
  const ambiguous=map.diagnostics.find(d=>d.code==='ambiguous')!;assert.equal(ambiguous.cause,undefined);assert.equal(ambiguous.action?.kind,'review-evidence');
  assert.ok(!map.diagnostics.some(d=>d.cause==='access-denied'||d.cause==='consumer-error'||d.cause==='dynamic-unresolved'));
});

test('structured document producer preserves unsupported capability facts and does not diagnose invalid input as a consumer failure',()=>{
  const map=mapStructuredDocuments([{path:'docs/plan.json',text:'{"document_ref":"./target.json#/part"}'},{path:'docs/target.json',text:'{"part":{}}'},
    {path:'docs/shape.json',text:'{"document_refs":[{"path":"./target.json"}]}'},
    {path:'docs/bad.json',text:'{"broken":'}],()=>true);
  for(const d of map.diagnostics.filter(d=>d.code==='unsupported')){assert.equal(d.cause,'unsupported-analyzer');assert.equal(d.action?.kind,'use-specialist');}
  assert.equal(map.diagnostics.filter(d=>d.cause==='unsupported-analyzer').length,2);
  assert.equal(map.diagnostics.find(d=>d.code==='invalid')?.cause,undefined);
});

test('documentation versus driver discrepancy remains a review candidate rather than an asserted conflict',()=>{
  const diagnostics=sourceConflictCandidates([{path:'README.md',text:'Database: PostgreSQL'}],[{path:'package.json',text:'{"dependencies":{"better-sqlite3":"1"}}'}]);
  assert.equal(diagnostics.length,1);assert.equal(diagnostics[0].cause,undefined);assert.equal(diagnostics[0].action?.kind,'review-evidence');
  assert.match(diagnostics[0].message,/review before deciding whether this is a conflict/);
});

test('actual acquisition advice survives authoring JSON serialization and its private context stays out of public documents',async()=>{
  const path='docs/SYNTHETIC_GAP_PRIVATE_PATH.md';
  const files=[['package.json','{}'],['README.md',`# Synthetic\n[Section](${path}#section)\n[Unavailable](docs/unselected.md)\n`],[path,'# Section']].map(([name,text])=>Object.assign(new File([text],name),{webkitRelativePath:'synthetic-gap-fixture/'+name}));
  const acquired=await analyzePickedFolder(files,{depth:'quick'}),before=JSON.stringify(acquired.document);
  const reopened=validateDocument(JSON.parse(before)),analysis=readAcquisitionAnalysis(reopened)!;
  assert.deepEqual(analysis.documentMap.diagnostics,acquired.analysis.documentMap.diagnostics);
  assert.equal(analysis.documentMap.diagnostics.find(d=>d.code==='unsupported')?.cause,'unsupported-analyzer');
  const publicDoc=publicDocument(reopened);
  assert.equal(readAcquisitionAnalysis(publicDoc),undefined);
  const publicText=JSON.stringify(publicDoc);assert.ok(!publicText.includes('SYNTHETIC_GAP_PRIVATE_PATH')&&!publicText.includes('unsupported-analyzer'));
  assert.equal(JSON.stringify(acquired.document),before);assert.equal(reopened.observations.length,0);
});

test('legacy serialized diagnostics remain readable and message keywords do not acquire a fabricated cause',async()=>{
  const files=[['package.json','{}'],['README.md','# Legacy\n[Missing](docs/unknown.md)']].map(([name,text])=>Object.assign(new File([text],name),{webkitRelativePath:'synthetic-legacy/'+name}));
  const acquired=await analyzePickedFolder(files,{depth:'quick'}),legacy=structuredClone(acquired.analysis);
  for(const diagnostic of legacy.documentMap.diagnostics){delete diagnostic.cause;delete diagnostic.action;diagnostic.message='access-denied dynamic-unresolved stale-revision consumer-error: legacy unstructured message';}
  const doc=attachAcquisitionContext(acquired.document,legacy),restored=readAcquisitionAnalysis(validateDocument(JSON.parse(JSON.stringify(doc))))!;
  assert.deepEqual(restored.documentMap.diagnostics,legacy.documentMap.diagnostics);
  assert.ok(restored.documentMap.diagnostics.every(d=>d.cause===undefined&&d.action===undefined));
  const invalid=structuredClone(legacy);Object.assign(invalid.documentMap.diagnostics[0],{cause:'approved-runtime',action:{kind:'shell',label:'Execute'}});
  const rejected=attachAcquisitionContext(acquired.document,invalid),before=JSON.stringify(rejected);
  assert.equal(readAcquisitionAnalysis(rejected),undefined);assert.equal(JSON.stringify(rejected),before);
});
