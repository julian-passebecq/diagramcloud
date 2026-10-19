import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectJoin,joinInspectionBlocks,type JoinInspectionInput} from '../src/intelligence/joinInspection';
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
test('long evidence prefix refuses instead of generating invalid native IDs',()=>{const f=fixture();f.id='a'.repeat(56);assert.throws(()=>joinInspectionBlocks(inspectJoin(f)));});
