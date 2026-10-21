import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseDeliveryView,deliveryEvidence,DELIVERY_VIEW_REFUSAL} from '../src/development/deliveryEvidence';
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/delivery-evidence/example-service.json',import.meta.url),'utf8'));
const inspect=(p:any)=>deliveryEvidence(parseDeliveryView(JSON.stringify(p)),'author');

test('partial estimates are a known subtotal, never the full remaining range',()=>{
 const e=inspect(fixture());assert.equal(e.remaining.sumMinutes,null);assert.deepEqual(e.remaining.knownSubtotalMinutes,[165,330]);
});
test('a completely finished plan has zero remaining work, not missing estimate',()=>{
 const p=fixture();for(const b of p.blocks)b.state='done';const r=inspect(p).remaining;assert.deepEqual(r.sumMinutes,[0,0]);assert.deepEqual(r.dependencyLowerBoundMinutes,[0,0]);
});
test('explicit blockers survive parsing and appear as named gaps',()=>{
 const p=fixture();p.blocks[1].state='blocked';p.blocks[1].blocker='Await a separately authorized test target';const e=inspect(p);
 assert.equal(e.view!.blocks[1].blocker,p.blocks[1].blocker);assert.ok(e.gaps.some(g=>g.code==='SOURCE_BLOCKER'&&g.blockId==='svc.api'));
});
test('repository-root write scope overlaps a child write',()=>{
 const p=fixture();p.handoff.block_details[0].filesets[0].path='.';assert.ok(inspect(p).conflicts.some(c=>c.blockIds[0]==='svc.schema'&&c.blockIds[1]==='svc.ui'));
});
test('case aliases are possible conflicts, not silent proof of no overlap',()=>{
 const p=fixture();p.handoff.block_details[2].filesets[0].path='DOCS/guide.md';assert.ok(inspect(p).conflicts.some(c=>c.blockIds.includes('svc.docs')&&c.blockIds.includes('svc.ui')));
});
test('traversal outside the repository is refused whole',()=>{
 const p=fixture();p.handoff.block_details[0].filesets[0].path='../another-repo';assert.throws(()=>inspect(p),{message:DELIVERY_VIEW_REFUSAL});
});
test('product associations are not accidentally parsed as task dependencies',()=>{
 const p=fixture();p.products.push({...p.products[0],id:'other-service'});p.dependencies=[{source:'example-service',target:'other-service',kind:'consumer',label:'Optional read-only client',source_id:'src.board'}];
 const e=inspect(p);assert.equal(e.view!.productRelations.length,1);assert.deepEqual(e.view!.blocks[1].dependsOn,['svc.schema']);
});
test('shared declared resources are visible even when source files do not overlap',()=>{
 const p=fixture();p.handoff.block_details[2].resources=['test.desktop'];p.handoff.block_details[4].resources=['test.desktop'];const e=inspect(p);
 assert.ok(e.resourceConflicts.some(c=>c.resource==='test.desktop'&&c.blockIds.includes('svc.docs')&&c.blockIds.includes('svc.release')));
});

test('known coverage sums as before when every unfinished block is estimated',()=>{
 const p=fixture();p.blocks[2].estimate={min_minutes:10,max_minutes:20,basis:'Illustrative allowance',estimated_at:null};const r=inspect(p).remaining;
 assert.deepEqual(r.sumMinutes,[175,350]);assert.deepEqual(r.knownSubtotalMinutes,r.sumMinutes);assert.equal(r.partial,false);
});
test('external prerequisite stays missing even if the local work is estimated',()=>{
 const p=fixture();p.blocks[2].estimate={min_minutes:0,max_minutes:0,basis:'Explicit zero',estimated_at:null};p.blocks[2].depends_on=['external'];
 const r=inspect(p);assert.equal(r.remaining.partial,true);assert.ok(r.gaps.some(g=>g.code==='UNKNOWN_DEPENDENCY'));assert.equal(r.remaining.calendar,'UNKNOWN');
});
test('completely missing estimates do not become zero',()=>{
 const p=fixture();for(const b of p.blocks)b.estimate=null;const r=inspect(p).remaining;assert.equal(r.sumMinutes,null);assert.equal(r.knownSubtotalMinutes,null);assert.equal(r.dependencyLowerBoundMinutes,null);
});
test('zero allowance is known and separate from null',()=>{
 const p=fixture();for(const b of p.blocks)b.estimate={min_minutes:0,max_minutes:0,basis:'Explicit synthetic zero'};
 const r=inspect(p).remaining;assert.deepEqual(r.sumMinutes,[0,0]);assert.deepEqual(r.knownSubtotalMinutes,[0,0]);
});
for(const path of ['/src', 'D:\\src', '//host/share', 'src/../../other', 'src/*', 'src/[ab].ts'])test('reject unsafe or unsupported fileset '+path,()=>{
 const p=fixture();p.handoff.block_details[0].filesets[0].path=path;assert.throws(()=>inspect(p),{message:DELIVERY_VIEW_REFUSAL});
});
test('lexical path normalization retains repository scope and does not inspect disk',()=>{
 const p=fixture();p.handoff.block_details[2].filesets[0].path='./docs/tmp/../guide.md';const c=inspect(p).conflicts.find(c=>c.blockIds.includes('svc.docs')&&c.blockIds.includes('svc.ui'));assert.equal(c?.path,'docs');
});
test('read paths never create a write conflict; other repositories stay separate',()=>{
 const p=fixture();for(const d of p.handoff.block_details)d.filesets=d.filesets.map((f:any)=>({...f,access:'read'}));assert.deepEqual(inspect(p).conflicts,[]);
});
test('resource names are scoped declarations, not inferred from roles',()=>{
 const p=fixture();assert.deepEqual(inspect(p).resourceConflicts,[]);p.handoff.block_details[2].resources=['worker'];p.handoff.block_details[4].resources=['worker'];
 assert.equal(inspect(p).resourceConflicts[0].ordered,true);assert.equal(inspect(p).remaining.calendar,'UNKNOWN');
});
test('conflict output is bounded, with an explicit incomplete-coverage flag',()=>{
 const p=fixture();p.blocks=Array.from({length:30},(_,i)=>({...p.blocks[2],id:'b'+i}));p.handoff.block_details=p.blocks.map((b:any)=>({block_id:b.id,filesets:[{repository:'r',path:'.',access:'write'}],resources:['gui']}));
 const e=inspect(p);assert.equal(e.conflicts.length,256);assert.equal(e.resourceConflicts.length,256);assert.equal(e.conflictLimitReached,true);
});
for(const dep of [
 {source:'not-known',target:'example-service',kind:'consumer'},
 {source:'example-service',target:'example-service',kind:'consumer',source_id:'missing'},
 {from:'svc.api',to:'svc.schema',source:'example-service',target:'example-service',kind:'consumer'},
])test('ambiguous or dangling product relation refuses whole '+JSON.stringify(dep),()=>{const p=fixture();p.dependencies=[dep];assert.throws(()=>inspect(p),{message:DELIVERY_VIEW_REFUSAL});});
test('event time and reader check time remain independent',()=>{
 const p=fixture();p.sources[0].event_at='2026-09-01T09:00:00Z';const v=parseDeliveryView(JSON.stringify(p));assert.equal(v.sources[0].eventAt,p.sources[0].event_at);assert.equal(v.sources[0].checkedAt,p.sources[0].checked_at);
});
test('finished token allowances are not charged to remaining work',()=>{
 const p=fixture();for(const d of p.handoff.block_details)d.tokens={input:[10,20],output:[2,4],basis:'Synthetic allowance',estimated_at:'2026-09-01T08:00:00Z'};
 const e=inspect(p);assert.deepEqual(e.tokens.input,[40,80]);assert.deepEqual(e.tokens.output,[8,16]);assert.equal(e.gaps.some(g=>g.code==='TOKENS_UNKNOWN'),false);
});
test('unknown input and output token counts remain independent',()=>{
 const p=fixture();for(const d of p.handoff.block_details)d.tokens={input:[0,0],output:null,basis:'Synthetic no recorded output'};
 const e=inspect(p);assert.deepEqual(e.tokens.input,[0,0]);assert.equal(e.tokens.output,null);assert.equal(e.tokens.unknownOutput.length,4);
});
for(const tokens of [{input:[-1,2],output:[1,2],basis:'bad'}, {input:[3,2],output:[1,2],basis:'bad'}, {input:[1.5,2],output:null,basis:'bad'}, {input:[1,2],output:[1,2],basis:'x',unit:'dollars'}])test('malformed recognized token allowance refuses '+JSON.stringify(tokens),()=>{
 const p=fixture();p.handoff.block_details[1].tokens=tokens;assert.throws(()=>inspect(p),{message:DELIVERY_VIEW_REFUSAL});
});
test('an unrecognized token record remains listed and unknown, not guessed',()=>{
 const p=fixture();p.handoff.block_details[1].tokens={estimate:1000};const e=inspect(p);assert.equal(e.tokens.input,null);assert.ok(e.view!.ignoredFields.includes('handoff.block_details[].tokens'));
});
test('private projection does not leak any new metadata, even conflict limits or token totals',()=>{
 const p=fixture();p.handoff.block_details[1].tokens={input:[1,2],output:[1,2],basis:'secret'};const e=deliveryEvidence(parseDeliveryView(JSON.stringify(p)),'public');
 assert.equal(e.withheld,true);assert.equal(e.view,null);assert.deepEqual(e.resourceConflicts,[]);assert.equal(e.conflictLimitReached,false);assert.deepEqual(e.tokens,{input:null,output:null,unknownInput:[],unknownOutput:[]});assert.equal(e.remaining.knownSubtotalMinutes,null);
});


// Browser decoding must not turn different file bytes into one accepted byte identity.
import {readDeliveryJsonFile} from '../src/development/deliveryEvidence';
test('file byte reader keeps exact valid UTF-8 including non-ASCII content', async()=>{
  const raw='{"title":"\u00e9\u98ce"}'; const blob=new Blob([raw]);
  assert.equal(await readDeliveryJsonFile(blob),raw);
});
test('file byte reader refuses a removed UTF-8 BOM',async()=>{
  const blob=new Blob([new Uint8Array([239,187,191]),'{"title":"test"}']);
  await assert.rejects(readDeliveryJsonFile(blob));
});
test('file byte reader refuses invalid UTF-8 normalized to a replacement character',async()=>{
  const blob=new Blob(['{"title":"',new Uint8Array([255]),'"}']);
  await assert.rejects(readDeliveryJsonFile(blob));
});
test('file byte reader accepts a deliberately encoded replacement character',async()=>{
  const raw='{"title":"\ufffd"}';assert.equal(await readDeliveryJsonFile(new Blob([raw])),raw);
});
test('file byte reader refuses dishonest size or text/bytes mismatch',async()=>{
  const bytes=new TextEncoder().encode('{}').buffer;
  await assert.rejects(readDeliveryJsonFile({size:3,text:async()=>'{}',arrayBuffer:async()=>bytes}));
  await assert.rejects(readDeliveryJsonFile({size:2,text:async()=>'[]',arrayBuffer:async()=>bytes}));
});
test('file byte reader refuses oversize before reading',async()=>{
  let reads=0;await assert.rejects(readDeliveryJsonFile({size:262145,text:async()=>{reads++;return '';},arrayBuffer:async()=>new ArrayBuffer(0)}));assert.equal(reads,0);
});
