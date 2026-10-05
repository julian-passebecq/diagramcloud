import test from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {clone,newId,validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {MAX_COLUMNS,MAX_ROWS,draftOfTable,emptyTable,parseCell,parseDelimited,tableBlock,tableOps,tableWarning,type TableBlock} from '../src/core/table';
import {TRANSFORM_STEPS,hasTransformation,transformationParts,transformationTemplate} from '../src/core/transform';
import {portfolioHtml} from '../src/export/html';

test('cells: empty is null, plain numbers and true/false are typed, everything else stays text',()=>{
 assert.equal(parseCell(''),null);assert.equal(parseCell('  '),null);
 assert.equal(parseCell('42'),42);assert.equal(parseCell('-3.5'),-3.5);
 assert.equal(parseCell('007'),'007','leading zeros are an identifier, not a number');
 assert.equal(parseCell('1e5'),'1e5');assert.equal(parseCell('true'),true);assert.equal(parseCell('A-1001'),'A-1001');
});

test('a stored table round-trips through the editor draft unchanged',()=>{
 const b=samples.flatMap(s=>s.blocks).find((b):b is TableBlock=>b.type==='table')!;
 assert.deepEqual(tableBlock(draftOfTable(b),{id:b.id}),b);
});

test('row and column edits keep every row as wide as the header and respect the limits',()=>{
 let d={...emptyTable(),title:'Orders'};
 d=tableOps.addColumn(d,'amount');d=tableOps.setCell(d,0,2,'12');d=tableOps.addRow(d);d=tableOps.setCell(d,1,0,'b');
 assert.deepEqual(d.columns,['Column 1','Column 2','amount']);assert(d.rows.every(r=>r.length===3));
 d=tableOps.moveColumn(d,2,-2);assert.deepEqual(d.columns,['amount','Column 1','Column 2']);assert.equal(d.rows[0][0],'12');
 d=tableOps.moveRow(d,1,-1);assert.equal(d.rows[0][1],'b');
 d=tableOps.removeColumn(d,2);assert.deepEqual(d.columns,['amount','Column 1']);
 d=tableOps.renameColumn(d,1,'key');
 const b=tableBlock(d,{id:'tbl-orders'});
 assert.deepEqual(b.columns,['amount','key']);assert.deepEqual(b.rows,[[null,'b'],[12,null]]);
 let one={...emptyTable(),columns:['only'],rows:[['x']]};assert.equal(tableOps.removeColumn(one,0).columns.length,1,'a table keeps one column');
 let wide=emptyTable();for(let i=0;i<30;i++)wide=tableOps.addColumn(wide);assert.equal(wide.columns.length,MAX_COLUMNS);
 let tall=emptyTable();for(let i=0;i<MAX_ROWS+5;i++)tall=tableOps.addRow(tall);assert.equal(tall.rows.length,MAX_ROWS);
});

test('invalid tables are refused with a plain message, and empty rows are dropped',()=>{
 assert.throws(()=>tableBlock({...emptyTable(),title:'T',columns:['a','']},{id:'t1'}),/Column 2: give it a name/);
 assert.throws(()=>tableBlock({...emptyTable(),title:'T',columns:['a','a']},{id:'t1'}),/distinct/);
 assert.throws(()=>tableBlock({...emptyTable(),title:''},{id:'t1'}));
 assert.deepEqual(tableBlock({...emptyTable(),title:'T',rows:[['',''],['x','']]},{id:'t1'}).rows,[['x',null]]);
});

test('pasted spreadsheet and CSV rows become a table; quotes are honoured and nothing is evaluated',()=>{
 assert.deepEqual(parseDelimited('id\tamount\nA\t1\nB\t2',true),{columns:['id','amount'],rows:[['A','1'],['B','2']]});
 assert.deepEqual(parseDelimited('a,"b, c",=SUM(A1)\n',false),{columns:['Column 1','Column 2','Column 3'],rows:[['a','b, c','=SUM(A1)']]});
 assert.throws(()=>parseDelimited('',true),/at least one row/);
});

test('unsourced, non-synthetic rows get a nudge; synthetic or sourced rows do not',()=>{
 assert.equal(tableWarning({provenance:'synthetic',sourceIds:[]}),null);
 assert.equal(tableWarning({provenance:'author',sourceIds:['s']}),null);
 assert.match(tableWarning({provenance:'author',sourceIds:[]})!,/synthetic/);
});

test('the transformation explainer reuses table/code blocks, stays valid, keeps rows synthetic and survives the public export',()=>{
 const blocks=transformationTemplate('Deduplicate orders',newId);
 assert.deepEqual(blocks.map(b=>b.transform),[...TRANSFORM_STEPS]);
 assert(hasTransformation(blocks));
 assert.equal(blocks.find(b=>b.transform==='input')!.provenance,'synthetic');
 assert.equal(blocks.find(b=>b.transform==='output')!.provenance,'synthetic');
 assert.equal(blocks.find(b=>b.transform==='logic')!.type,'code');
 const parts=transformationParts(blocks);assert.equal(parts.mapping?.length,1);
 const doc=clone(samples.find(s=>s.id==='total-project-controls')!),node=doc.nodes.find(n=>n.id==='checks')!;
 doc.blocks.push(...blocks);node.blockIds.push(...blocks.map(b=>b.id));
 const valid=validateDocument(doc),pub=publicDocument(valid);
 assert.equal(pub.blocks.filter(b=>b.transform).length,5,'transform steps survive the public projection');
 const html=portfolioHtml(valid);
 assert(html.includes('explanatory, not executed'));
 // An observation can still never be backed by the synthetic example rows.
 assert.throws(()=>validateDocument({...valid,observations:[{id:'obs-x',nodeId:'checks',sourceApp:'datapass-vscode',authority:'CI',observedAt:'2026-09-20T08:30:00Z',sourceRevision:'abc',claim:'verified',summary:'s',blockIds:[blocks[0].id],caveat:'',visibility:'private',shareable:false}]}),/synthetic block/);
});
