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


import {graphAssertionTable} from '../src/intelligence/graphSnapshot';
function assertionTableFixture(count:number){
 const g=fixture(),node=g.nodes[2],a=g.assertions[0];g.graph_id='synthetic-assertion-table';g.generation_id='assertions-1';g.groups=[];
 g.nodes=Array.from({length:Math.max(2,count+1)},(_,i)=>({...node,id:'table-node-'+i,label:i<2?'Synthetic same caption':'Synthetic endpoint '+i,parent_id:null}));
 g.assertions=Array.from({length:count},(_,i)=>({...a,id:'private-assertion-'+i,from:'table-node-'+i,to:'table-node-'+(i+1),family:'lineage',evidence_kind:i%2?'INFERRED':'OBSERVED',predicate:'Source predicate '+i,observed_at:'2026-10-08T00:00:00Z',confidence_basis:'Private source confidence detail'}));
 return g;
}
test('retained assertion table covers0/1/50/51/101 exact current rows once and clamps independently of the80-node chain',()=>{
 for(const count of [0,1,50,51,101]){const g=assertionTableFixture(count),doc=compileGraphSnapshot(g).document,before=JSON.stringify(doc),all=[];for(let p=0;p<Math.max(1,Math.ceil(count/50));p++){const out=graphAssertionTable(doc,{page:p});assert.equal(out.total,count);assert(out.rows.length<=50);assert.equal(out.page.start,count?p*50+1:0);assert.equal(out.page.remaining,Math.max(0,count-(p+1)*50));all.push(...out.rows.map(r=>r.externalId));}assert.deepEqual(all,g.assertions.map((a:{id:string})=>a.id));assert.equal(new Set(all).size,count);assert.equal(graphAssertionTable(doc,{page:999}).page.index,Math.max(0,Math.ceil(count/50)-1));assert.equal(graphAssertionTable(doc,{page:-4}).page.index,0);assert.equal(graphAssertionTable(doc,{page:NaN}).page.index,0);assert.equal(JSON.stringify(doc),before);assert.deepEqual(doc.observations,[]);if(count>80)assert.equal(graphEvidenceChain(doc,readGraphHistory(doc)[0].nodes[0].localId).limited,true);}
});
test('retained assertion sources and identities never use same captions or endpoint citations as direct proof',()=>{
 const g=assertionTableFixture(2);g.assertions[0].source_ref_ids=[];const doc=compileGraphSnapshot(g).document,out=graphAssertionTable(doc);
 assert.equal(out.rows[0].from.label,out.rows[0].to.label);assert.notEqual(out.rows[0].from.id,out.rows[0].to.id);assert.equal(out.rows[0].sources.length,0);assert.equal(out.rows[1].sources.length,1);assert.ok(out.rows[1].sources[0].location?.includes('example/demo@fixture-v1:fixtures/declared.json#$'));assert.equal(out.rows[0].origin,'OBSERVED');assert.equal(out.rows[1].origin,'INFERRED');
 assert(!JSON.stringify(out).includes('Source predicate'));assert(!JSON.stringify(out).includes('Private source confidence detail'));assert.deepEqual(doc.observations,[]);
 out.rows[1].sources[0].location='caller mutation';out.sourceVector[0].revision='caller mutation';out.producerOmissions[0].reason='caller mutation';assert(!JSON.stringify(graphAssertionTable(doc)).includes('caller mutation'));
});
test('retained assertion explicit unknown scope refuses without fallback and current graph filters remain exact',()=>{
 const doc=compileGraphSnapshot(assertionTableFixture(51)).document;
 for(const filter of [{organization:'missing'},{project:'missing'},{family:'missing'},{origin:'missing'},{state:'missing'}]){const out=graphAssertionTable(doc,{filter});assert.equal(out.state,'unavailable');assert.equal(out.total,0);assert.deepEqual(out.rows,[]);}
 assert.equal(graphAssertionTable(doc,{filter:{origin:'INFERRED'}}).total,25);assert.equal(graphAssertionTable(doc,{filter:{search:'No matching caption'}}).total,0);
});
test('public assertion metadata is constant before private document/filter/page getters or corrupt-receipt validation',()=>{
 const poison=new Proxy({},{get(){throw new Error('PRIVATE_GRAPH_SENTINEL');}}) as Parameters<typeof graphAssertionTable>[0];
 const denied=graphAssertionTable(poison,{publicMode:true,get filter():never{throw new Error('PRIVATE_FILTER');},get page():never{throw new Error('PRIVATE_PAGE');}}),doc=compileGraphSnapshot(assertionTableFixture(51)).document;
 assert.deepEqual(graphAssertionTable(doc,{publicMode:true,page:999}),denied);assert.deepEqual(graphAssertionTable(publicDocument(doc),{publicMode:true}),denied);assert.equal(denied.state,'private-unavailable');assert.equal(denied.projectId,null);assert.deepEqual(denied.rows,[]);assert(!JSON.stringify(denied).includes('private-assertion'));
});
test('retained assertion receipt follows the current same-ID generation, preserves no-double-count identity and leaves all authored facts untouched',()=>{
 const first=assertionTableFixture(101),doc=compileGraphSnapshot(first).document,next=assertionTableFixture(1);next.generation_id='assertions-2';next.predecessor_generation=first.generation_id;const refreshed=previewGraphReimport(doc,next,doc.revision).document,before=JSON.stringify(refreshed),out=graphAssertionTable(refreshed,{page:2});
 assert.equal(out.generationId,'assertions-2');assert.equal(out.total,1);assert.equal(out.page.index,0);assert.equal(out.rows[0].externalId,'private-assertion-0');assert.equal(JSON.stringify(refreshed),before);assert.equal(graphAssertionTable(doc,{page:2}).total,101);
 const dup=assertionTableFixture(2);dup.assertions[1].id=dup.assertions[0].id;assert.throws(()=>validateGraphSnapshot(dup),/Duplicate assertion/);const conflict=assertionTableFixture(101);conflict.assertions[0].evidence_kind='ASSERTED';assert.throws(()=>previewGraphReimport(doc,conflict,doc.revision),/Generation identity conflict/);
});
