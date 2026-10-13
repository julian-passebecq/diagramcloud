import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileGraphSnapshot,compareGraphGenerations,graphGeneration,graphRows,graphEvidenceChain,previewGraphReimport,readGraphHistory,validateGraphSnapshot,selectGraphNodes} from '../src/intelligence/graphSnapshot';
import {publicDocument} from '../src/core/operations';
import {portfolioHtml} from '../src/export/html';
const fixture=()=>JSON.parse(readFileSync('tests/fixtures/night4/graph-fixture.json','utf8'));
test('generation reimport retains author text, publication, evidence, positions and revision guard',()=>{
 const g=fixture(),doc=compileGraphSnapshot(g).document,state=readGraphHistory(doc)[0],n=doc.nodes.find(n=>n.id===state.nodes.find(n=>n.externalId==='feature')!.localId)!;
 const view=doc.views.find(v=>v.nodeIds.includes(n.id))!;
 n.label='Authored caption';n.visibility='public';view.positions[n.id]={x:999,y:888};
 const evidence=doc.blocks.find(b=>n.blockIds.includes(b.id));if(evidence?.type==='code')evidence.code='Authored evidence';
 const incoming=structuredClone(g);incoming.generation_id='fixture-2';incoming.predecessor_generation=g.generation_id;incoming.nodes.find((n:{id:string})=>n.id==='feature').label='Changed producer caption';incoming.assertions[1].predicate='changed';
 const result=previewGraphReimport(doc,incoming,0),kept=result.document.nodes.find(x=>x.id===n.id)!;
 assert.equal(kept.label,n.label);assert.equal(kept.visibility,'public');assert.deepEqual(result.document.views.find(v=>v.id===view.id)!.positions[n.id],{x:999,y:888});
 assert.equal(readGraphHistory(result.document).length,2);assert.equal(result.delta.state,'partial');
 if(evidence?.type==='code')assert.equal(result.document.blocks.find(b=>b.id===evidence.id)?.type==='code'&&(result.document.blocks.find(b=>b.id===evidence.id) as typeof evidence).code,'Authored evidence');
 assert.throws(()=>previewGraphReimport({...doc,revision:1},incoming,0),/Revision conflict/);
 assert.equal(readGraphHistory(doc).length,1);
});
test('scope comparisons never convert partial absence to deletion and tombstones require exact predecessor',()=>{
 const a=fixture(),b=fixture();b.generation_id='next';b.predecessor_generation=a.generation_id;b.assertions.shift();b.removed_assertion_ids=['demo-assertion-1'];
 let delta=compareGraphGenerations(graphGeneration(a),graphGeneration(b));assert.equal(delta.state,'partial');assert.ok(delta.changes.some(x=>x.change==='not-in-scope'));
 a.complete_scope=true;b.complete_scope=true;delta=compareGraphGenerations(graphGeneration(a),graphGeneration(b));assert.ok(delta.changes.some(x=>x.change==='tombstone'));
 b.predecessor_generation='unrelated';assert.ok(compareGraphGenerations(graphGeneration(a),graphGeneration(b)).changes.every(x=>x.change!=='tombstone'));
 b.scope.scope_policy_hash='removed-grant';delta=compareGraphGenerations(graphGeneration(a),graphGeneration(b));assert.equal(delta.state,'incomparable');assert.equal(delta.changes.length,0);
});
test('filters and evidence chain use explicit memberships; source-qualified references retain revisions',()=>{
 const g=fixture(),doc=compileGraphSnapshot(g).document;
 assert.equal(graphRows(doc,{organization:'missing'}).nodes.length,0);assert.equal(graphRows(doc,{state:'PLANNED'}).nodes.length,2);
 assert.equal(graphRows(doc,{project:'project'}).nodes.length,11);
 const feature=graphRows(doc,{search:'Selected example feature'}).nodes[0];assert.ok(graphEvidenceChain(doc,feature.localId).missing.length===0);
 const changed=fixture();changed.generation_id='two';changed.source_vector[0].revision='fixture-v2';changed.source_refs[0].revision='fixture-v2';
 const out=previewGraphReimport(doc,changed,0).document;assert.ok(out.sources.some(s=>s.location.includes('fixture-v1')));assert.ok(out.sources.some(s=>s.location.includes('fixture-v2')));
});
test('identity reuse, parent cycles, inconsistent tombstones and malformed state are refused safely',()=>{
 const g=fixture(),doc=compileGraphSnapshot(g).document,changed=fixture();changed.generation_id='two';changed.nodes[0].kind='dataset';
 assert.throws(()=>previewGraphReimport(doc,changed,0),/Conflicting semantic/);
 changed.nodes[0].kind=g.nodes[0].kind;changed.generation_id=g.generation_id;changed.nodes[0].label='changed';assert.throws(()=>previewGraphReimport(doc,changed,0),/Generation identity conflict/);
 g.nodes[0].parent_id=g.nodes[1].id;g.nodes[1].parent_id=g.nodes[0].id;assert.throws(()=>validateGraphSnapshot(g),/Cyclic/);
 const t=fixture();t.removed_assertion_ids=[t.assertions[0].id];assert.throws(()=>validateGraphSnapshot(t),/present assertion/);
 const block=doc.blocks.find(b=>b.id.startsWith('analysis-graph-state-'));if(block?.type==='code')block.code='[{"format":"diagramcloud.graph-generation/1","nodes":[null]}]';assert.deepEqual(readGraphHistory(doc),[]);
});
test('private receipt cannot leak names, counts, scope or generation in public exports even if made public',()=>{
 const doc=compileGraphSnapshot(fixture()).document;doc.blocks.filter(b=>b.id.startsWith('analysis-graph-state-')).forEach(b=>b.visibility='public');
 const pub=publicDocument(doc),out=JSON.stringify(pub)+portfolioHtml(doc);assert.equal(readGraphHistory(pub).length,0);
 for(const value of ['fixture-1','demo-private','demo-org','demo-assertion','Example session'])assert.ok(!out.includes(value));
});

test('large selected-file projection is explicit, partial, source-bounded and never asserts removals',()=>{
 const g=fixture();for(let i=0;i<600;i++)g.nodes.push({...g.nodes[1],id:'large-'+i,label:'Synthetic large '+i,parent_id:null});
 const prior=JSON.stringify(g);assert.throws(()=>compileGraphSnapshot(g),/Project limits/);
 const selected=selectGraphNodes(g,['large-1','large-2']);assert.equal(selected.complete_scope,false);assert.equal(selected.nodes.length,2);
 assert.equal(selected.generation_id,g.generation_id);assert.equal(selected.assertions.length,0);assert.deepEqual(selected.removed_assertion_ids,[]);assert.ok(selected.omitted.some(x=>x.reason.includes('Absence is not deletion')));
 assert.doesNotThrow(()=>compileGraphSnapshot(selected));assert.equal(JSON.stringify(g),prior);assert.throws(()=>selectGraphNodes(g,['missing']),/known/);
});

test('reimport keeps authored evidence metadata even when generated code was not edited',()=>{
 const g=fixture(),doc=compileGraphSnapshot(g).document,b=doc.blocks.find(x=>x.title==='Assertion evidence')!;b.title='Authored explanation title';
 const incoming=fixture();incoming.generation_id='next';incoming.assertions[0].predicate='producer changes';
 assert.equal(previewGraphReimport(doc,incoming,0).document.blocks.find(x=>x.id===b.id)!.title,b.title);
});

test('deep selected-file hierarchy validates iteratively and still rejects a distant cycle',()=>{
 const g=fixture();g.nodes=Array.from({length:9000},(_,i)=>({...g.nodes[1],id:'deep-'+i,label:'Synthetic depth',parent_id:i?'deep-'+(i-1):null}));g.assertions=[];g.groups=[];
 assert.equal(validateGraphSnapshot(g).nodes.length,9000);g.nodes[0].parent_id='deep-8999';assert.throws(()=>validateGraphSnapshot(g),/Cyclic/);
});
