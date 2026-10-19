import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {inspectJoin,joinInspectionBlocks,joinInspectionPatch,readJoinEvidence,type JoinInspectionInput} from '../src/intelligence/joinInspection';
import {buildReviewWorkspace} from '../examples/review-workspace/build';
import {applyDocumentPatch} from '../src/core/patch';
import {publicDocument} from '../src/core/operations';
import {clone} from '../src/core/model';
import {JoinInspectionPanel} from '../src/ui/JoinInspectionPanel';
const fixture=():JoinInspectionInput=>({id:'join-review',title:'Order lines and customer history',scope:'Synthetic four-row cohort',provenance:'synthetic',sourceIds:[],kind:'inner',expectedRightMatches:'one',previewLimit:40,
 left:{id:'sales',title:'Sales',grain:'One order line',coverage:'sample',columns:[{id:'customer',type:'string',nullable:true},{id:'amount',type:'number',nullable:true}],rows:[{id:'a',values:['c1',10]},{id:'b',values:['c1',25]},{id:'c',values:['c2',5]},{id:'d',values:[null,2]}]},
 right:{id:'customers',title:'Customer versions',grain:'One customer version',coverage:'sample',columns:[{id:'customer',type:'string',nullable:true},{id:'region',type:'string',nullable:false}],rows:[{id:'v1',values:['c1','North']},{id:'v2',values:['c1','South']},{id:'v3',values:[null,'Unknown']}]},keys:[{left:'customer',right:'customer'}],measure:{leftColumn:'amount',unit:'EUR (synthetic)',meaning:'Illustrative additive amount'}});
test('fanout and dropped rows remain visible at the same time',()=>{const r=inspectJoin(fixture());assert.equal(r.outputRows,4);assert.deepEqual(r.unmatchedLeft,['c','d']);assert.equal(r.fanout.length,2);assert.equal(r.measure?.before,42);assert.equal(r.measure?.after,70);assert.deepEqual(r.unmatchedRight,['v3']);});
test('left join retains unmatched left rows with explicit right-row absence',()=>{const f=fixture();f.kind='left';const r=inspectJoin(f);assert.equal(r.outputRows,6);assert.equal(r.measure?.after,77);assert.equal(r.preview[5].rightRowId,null);assert.deepEqual(r.preview[5].right,[null,null]);});
test('declared many is not mislabelled a grain violation',()=>{const f=fixture();f.expectedRightMatches='many';const r=inspectJoin(f);assert.equal(r.fanout.length,2);assert.deepEqual(r.grainViolations,[]);});
test('null does not match null',()=>{const r=inspectJoin(fixture());assert.equal(r.perLeft.find(x=>x.rowId==='d')?.matches,0);});
test('preview cap does not change exact cohort counts or totals',()=>{const f=fixture();f.previewLimit=1;const r=inspectJoin(f);assert.equal(r.outputRows,4);assert.equal(r.preview.length,1);assert.equal(r.previewOmitted,3);assert.equal(r.measure?.after,70);});
test('input remains unchanged',()=>{const f=fixture(),copy=structuredClone(f);inspectJoin(f);assert.deepEqual(f,copy);});
test('unknown amounts are not invented zero',()=>{const f=fixture();f.left.rows.forEach(x=>x.values[1]=null);const r=inspectJoin(f);assert.equal(r.measure?.before,null);assert.equal(r.measure?.after,null);assert.equal(r.measure?.missingInputs,4);});
test('zero amount remains a known zero',()=>{const f=fixture();f.left.rows.forEach(x=>x.values[1]=0);const r=inspectJoin(f);assert.equal(r.measure?.before,0);assert.equal(r.measure?.after,0);});
test('optional amount remains absent',()=>{const f=fixture();delete f.measure;assert.equal(inspectJoin(f).measure,null);});
test('empty right inner output is known empty, not missing input',()=>{const f=fixture();f.right.rows=[];const r=inspectJoin(f);assert.equal(r.outputRows,0);assert.equal(r.measure?.after,0);});
test('empty left is supported',()=>{const f=fixture();f.left.rows=[];const r=inspectJoin(f);assert.equal(r.outputRows,0);assert.equal(r.measure?.before,0);});
test('sample coverage dominates a declared-complete partner',()=>{const f=fixture();f.left.coverage='declared-complete';assert.equal(inspectJoin(f).coverage,'sample');});
test('declared-complete is preserved as declaration, not verification',()=>{const f=fixture();f.left.coverage=f.right.coverage='declared-complete';const r=inspectJoin(f);assert.equal(r.coverage,'declared-complete');assert.equal(r.basis,'CALCULATED_OVER_SUPPLIED_ROWS');});
test('source-derived rows need actual source references',()=>{const f=fixture();f.provenance='source-derived';assert.throws(()=>inspectJoin(f));f.sourceIds=['source.one'];assert.equal(inspectJoin(f).request.provenance,'source-derived');});
test('composite keys cannot collide through delimiter strings',()=>{const f=fixture();delete f.measure;f.left.columns=f.right.columns=[{id:'a',type:'string',nullable:false},{id:'b',type:'string',nullable:false}];f.keys=[{left:'a',right:'a'},{left:'b',right:'b'}];f.left.rows=[{id:'l',values:['x|y','z']}];f.right.rows=[{id:'r',values:['x','y|z']}];assert.equal(inspectJoin(f).outputRows,0);});
for(const [name,mutate] of Object.entries({
 'unknown input field':f=>f.execute='SELECT 1', 'row width':f=>f.left.rows[0].values.pop(), 'wrong type':f=>f.left.rows[0].values[1]='10', 'nonnullable':f=>f.left.columns[0].nullable=false,
 'duplicate row':f=>f.left.rows.push(structuredClone(f.left.rows[0])), 'duplicate column':f=>f.left.columns[1].id='customer', 'missing key':f=>f.keys[0].left='absent',
 'duplicate key':f=>f.keys.push(f.keys[0]),'mixed key types':f=>{f.right.columns[0].type='number';f.right.rows=[{id:'r',values:[1,'X']}];},
 'NaN':f=>f.left.rows[0].values[1]=NaN,'Infinity':f=>f.left.rows[0].values[1]=Infinity,'value bound':f=>f.left.rows[0].values[1]=1e20,
 'row budget':f=>f.left.rows=Array.from({length:201},(_,i)=>({id:'r'+i,values:['c1',1]})), 'preview bound':f=>f.previewLimit=101,
 'implicit self-join alias':f=>f.right.id='sales','bad measure':f=>f.measure.leftColumn='customer','duplicate source':f=>f.sourceIds=['x','x'], 'invalid kind':f=>f.kind='full'
} as Record<string,(f:any)=>void>))test('reject '+name,()=>{const f=fixture();(mutate as (f:any)=>void)(f);assert.throws(()=>inspectJoin(f));});
test('ordinary transformation blocks retain row identity, grain and synthetic basis',()=>{const blocks=joinInspectionBlocks(inspectJoin(fixture()));assert.equal(blocks.length,6);assert.deepEqual(blocks.map(b=>b.transform),['input','input','logic','output','mapping','rules']);assert.ok(blocks.every(b=>b.provenance==='synthetic'&&b.visibility==='private')); assert.equal(blocks[3].type,'table');});
const binding={projectId:'review-workspace-reference',audience:'author' as const,epoch:0};
// A small synthetic project with one component and no join evidence yet.
const host=()=>{const p=clone(buildReviewWorkspace().project);p.nodes=p.nodes.map(n=>n.id==='join'?{...n,blockIds:[]}:n);p.blocks=p.blocks.filter(b=>!b.id.startsWith('order-join.'));for(const n of p.nodes)n.blockIds=n.blockIds.filter(id=>!id.startsWith('order-join.'));return p;};
test('readJoinEvidence: 42 becomes 70 with fanout and loss from document blocks',()=>{
 const doc=buildReviewWorkspace().project,v=readJoinEvidence(doc,'join');
 assert.ok(v);assert.equal(v.prefix,'order-join');assert.equal(v.provenance,'synthetic');
 assert.deepEqual(v.inputRows,{left:4,right:3});assert.equal(v.outputRows,4);assert.deepEqual(v.measure,{before:42,after:70});
 assert.deepEqual(v.unmatchedLeft,['line.c','line.d']);assert.deepEqual(v.grainViolations,['line.a','line.b','line.c','line.d']);
 assert.deepEqual(v.perLeft.filter(r=>r.matches>1).map(r=>[r.rowId,r.rightMatchIds]),[['line.a',['version.1','version.2']],['line.b',['version.1','version.2']]]);
 assert.equal(v.consistent,true);assert.ok(v.limits.length>=5);
 // A node that carries only some of the blocks is not join evidence.
 assert.equal(readJoinEvidence(doc,'orders'),null);assert.equal(readJoinEvidence(doc,'absent'),null);
 const html=renderToStaticMarkup(createElement(JoinInspectionPanel,{doc,nodeId:'join',binding}));
 const order=['Input rows','Output rows','Measure','Fanout rows','Unmatched left rows','Grain violations','Per-row provenance','Limits','Synthetic'];
 const at=order.map(s=>html.indexOf(s));assert.ok(at.every(i=>i>=0),JSON.stringify(at));assert.deepEqual([...at].sort((a,b)=>a-b),at);
 assert.match(html,/42 → 70/);
 assert.equal(renderToStaticMarkup(createElement(JoinInspectionPanel,{doc,nodeId:'orders',binding})),'');
});
test('readJoinEvidence: inconsistent blocks are flagged not repaired',()=>{
 const doc=clone(buildReviewWorkspace().project),mapping=doc.blocks.find(b=>b.id==='order-join.mapping')!;
 assert.equal(mapping.type,'table');if(mapping.type!=='table')return;mapping.rows[0][3]=5;
 const v=readJoinEvidence(doc,'join')!;
 assert.equal(v.consistent,false);assert.equal(v.outputRows,4);assert.equal(v.perLeft[0].outputRows,5);
 assert.equal((doc.blocks.find(b=>b.id==='order-join.mapping') as {rows:unknown[][]}).rows[0][3],5,'the document is not repaired');
 assert.match(renderToStaticMarkup(createElement(JoinInspectionPanel,{doc,nodeId:'join',binding})),/do not add up/);
 // Mixed provenance is not one piece of join evidence.
 const mixed=clone(buildReviewWorkspace().project);mixed.blocks.find(b=>b.id==='order-join.rules')!.provenance='source-derived';
 assert.equal(readJoinEvidence(mixed,'join'),null);
});
test('joinInspectionPatch: private blocks, one revision, collision refused',()=>{
 const project=host(),result=inspectJoin(fixture()),patch=joinInspectionPatch(project,'join',result);
 assert.equal(patch.format,'diagramcloud.patch');assert.equal(patch.baseRevision,project.revision);assert.equal(patch.targetId,project.id);
 const before=JSON.stringify(project),applied=applyDocumentPatch(project,patch).result;
 assert.equal(JSON.stringify(project),before,'validating the patch never mutates the project');
 assert.equal(applied.revision,project.revision,'the review commits it as one revision');
 const added=applied.blocks.filter(b=>b.id.startsWith('join-review.'));
 assert.equal(added.length,6);assert.ok(added.every(b=>b.visibility==='private'));
 assert.deepEqual(applied.nodes.find(n=>n.id==='join')!.blockIds,added.map(b=>b.id));
 const v=readJoinEvidence(applied,'join')!;assert.deepEqual(v.measure,{before:42,after:70});assert.equal(v.consistent,true);
 assert.throws(()=>joinInspectionPatch(applied,'join',result),/already used/);
 assert.throws(()=>joinInspectionPatch(project,'absent',result),/unknown component/);
 assert.throws(()=>applyDocumentPatch({...applied,revision:applied.revision+1},patch),/Stale patch/);
});
test('public projection hides private join evidence',()=>{
 const project=host(),applied=applyDocumentPatch(project,joinInspectionPatch(project,'join',inspectJoin(fixture()))).result;
 const pub=publicDocument(applied);
 assert.equal(readJoinEvidence(pub,'join'),null);
 assert.ok(!JSON.stringify(pub).includes('join-review.'));
 assert.equal(renderToStaticMarkup(createElement(JoinInspectionPanel,{doc:pub,nodeId:'join',binding:{...binding,audience:'public'}})),'');
});
test('long evidence prefix refuses instead of generating invalid native IDs',()=>{const f=fixture();f.id='a'.repeat(56);assert.throws(()=>joinInspectionBlocks(inspectJoin(f)));});
