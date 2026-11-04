import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {samples} from '../src/data/samples';
import {canonicalJson,sha256,projectProjection,projectionFromSnapshot,ancestorCorrespondence,scenarioRequest,currentFreshness,parseReviewBundle,readEvolutionSemantic} from '../src/interop/comparisonBridge';
import {evolutionSnapshot,retainEvolutionSnapshotPatch,readEvolutionHistory} from '../src/intelligence/evolution';
import {applyDocumentPatch} from '../src/core/patch';
const sample=()=>structuredClone(samples.find(s=>s.id==='retail-operations')!);
test('active Project retains semantic edge contract, stable IDs and deterministic layout-independent identity',async()=>{
 const a=sample(),before=await projectProjection(a,{audience:'author'});a.views[0].positions[a.views[0].nodeIds[0]]={x:999,y:888};a.revision++;
 const moved=await projectProjection(a,{audience:'author'});assert.equal(before.binding.digest,moved.binding.digest);assert.notEqual(before.binding.revision,moved.binding.revision);
 a.edges[0].label+=' changed contract';a.edges[0].basis='unknown';const changed=await projectProjection(a,{audience:'author'});assert.notEqual(changed.binding.digest,moved.binding.digest);assert.equal(changed.relationships.find(e=>e.id===a.edges[0].id)?.label,a.edges[0].label);
});
test('private-only facts, counters and retention cannot influence public request bytes',async()=>{
 const a=sample();const before=scenarioRequest([{id:'a',title:'A',origin:'authored',assumptions:[],projection:await projectProjection(a,{audience:'public'})},{id:'b',title:'B',origin:'authored',assumptions:[],projection:await projectProjection(a,{audience:'public'})}],'alternatives',true);
 a.privateNotes='PRIVATE_CANARY';a.revision+=45;a.nodes.push({...structuredClone(a.nodes[0]),id:'private-canary',label:'PRIVATE_CANARY',visibility:'private'});a.views[0].nodeIds.push('private-canary');a.views[0].positions['private-canary']={x:-999,y:-999};
 const next=applyDocumentPatch(a,retainEvolutionSnapshotPatch(a,evolutionSnapshot(a,{id:'retained-test'}))).result;
 const after=scenarioRequest([{id:'a',title:'A',origin:'authored',assumptions:[],projection:await projectProjection(next,{audience:'public'})},{id:'b',title:'B',origin:'authored',assumptions:[],projection:await projectProjection(next,{audience:'public'})}],'alternatives',true);
 assert.equal(canonicalJson(after),canonicalJson(before));assert.ok(!JSON.stringify(after).includes('PRIVATE_CANARY'));assert.equal(after.scenarios[0].projection.binding.revision,null);
});
test('retained receipts project without reconstructing an editable document; optional legacy tokens decode safely',async()=>{
 const a=sample(),snapshot=evolutionSnapshot(a,{id:'retained-test'}),doc=applyDocumentPatch(a,retainEvolutionSnapshotPatch(a,snapshot)).result;
 const kept=readEvolutionHistory(doc).snapshots[0];
 const malformed=structuredClone(snapshot);malformed.edges[0].semantic='{"source":"missing-node","target":"missing-too"}';await assert.rejects(projectionFromSnapshot(malformed,{audience:'author'}),/endpoints/);assert.equal((await projectionFromSnapshot(kept,{audience:'author'})).binding.digest,(await projectProjection(a,{audience:'author'})).binding.digest);
 assert.deepEqual({...readEvolutionSemantic('{"x":undefined,"y":"undefined","z":"__diagramcloud_absent_20261104__"}')},{y:'undefined',z:'__diagramcloud_absent_20261104__'});
 assert.deepEqual({...readEvolutionSemantic('{"x":"\\u005f_diagramcloud_absent_20261104__"}')},{x:'__diagramcloud_absent_20261104__'});
 for(const malformed of ['{"x":(()=>1)()}','{"x":undefinedfoo}','{"x":1,"x":2}','{"x":undefined};alert(1)','{"x":[undefined]}'])assert.throws(()=>readEvolutionSemantic(malformed));
});
test('selected view uses exact current edge membership and reports partial coverage',async()=>{
 const a=sample(),view=a.views[0],p=await projectProjection(a,{audience:'author',viewIds:[view.id]});assert.deepEqual(p.relationships.map(e=>e.id).sort(),view.edgeIds.slice().sort());assert.equal(p.scope.coverage,'partial');assert.throws(()=>ancestorCorrespondence(p,{...p,source:{...p.source,projectId:'independent'}},'claim'));
});
test('both live source sides detect same-revision drift and absent sources are unknown',async()=>{
 const a=sample(),b=sample(),pa=await projectProjection(a,{audience:'author'}),pb=await projectProjection(b,{audience:'author'});
 assert.equal(await currentFreshness(pa,a),'current');a.nodes[0].label+=' changed';assert.equal(await currentFreshness(pa,a),'stale');assert.equal(await currentFreshness(pb,b),'current');b.edges[0].label+=' changed';assert.equal(await currentFreshness(pb,b),'stale');assert.equal(await currentFreshness(pa,undefined),'unknown');
});
test('review bundles reject audience mismatch, unsupported versions and supplied trust reports',async()=>{
 const p=await projectProjection(sample(),{audience:'author'}),request=scenarioRequest([{id:'a',title:'A',origin:'authored',assumptions:[],projection:p},{id:'b',title:'B',origin:'authored',assumptions:[],projection:p}],'alternatives',true),bundle={schema:'datapass.scenario-review/0.1',request,narrative:'Question'};
 assert.deepEqual(parseReviewBundle(JSON.stringify(bundle),'author'),bundle);assert.throws(()=>parseReviewBundle(JSON.stringify(bundle),'public'));assert.throws(()=>parseReviewBundle(JSON.stringify({...bundle,report:{verified:true}}),'author'));assert.throws(()=>parseReviewBundle(JSON.stringify({...bundle,schema:'future'}),'author'));
});
test('UTF-8 canonical golden and shared engine corpus digest parity',async()=>{
 // Vendored unchanged from the frozen Rust contract corpus by the integration owner.
 const golden=JSON.parse(readFileSync(new URL('./contracts/scenario/canonical-golden.json',import.meta.url),'utf8'));
 assert.equal(canonicalJson(golden.materialization),golden.canonical);assert.equal(await sha256(golden.canonical),golden.digest);
 const corpus=JSON.parse(readFileSync(new URL('./contracts/scenario/comparison-corpus.json',import.meta.url),'utf8'));
 for(const row of corpus.cases??corpus){const request=row.request;for(const p of [request?.before,request?.after].filter(Boolean)){if(row.expect?.error)continue;const digest=await sha256(canonicalJson({entities:p.entities,relationships:p.relationships,scope:p.scope}));assert.equal(digest,p.binding.digest,row.id);}}
});
