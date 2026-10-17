import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,validateDocument,type Project} from '../src/core/model';
import {compareView,deltaSvg} from '../src/export/design/delta';
import {selectVariant} from '../src/core/variants';
import {draftAddNode,draftMoveNode,draftUpdateEdge,recordDraft,startDraft} from '../src/core/variantDraft';

/** Linked comparison (P3): three independent axes, quantities compared canonically, missing observation is UNKNOWN. */
const NOW=new Date('2026-10-17T00:00:00Z');
const base=():Project=>validateDocument({schemaVersion:1,id:'shop',revision:3,title:'Shop',rootViewId:'overview',
 nodes:[{id:'api',label:'API'},{id:'db',label:'Orders DB',kind:'storage'}],
 edges:[{id:'api-db',source:'api',target:'db',label:'writes',quantity:{value:10,unit:'rows/s',provenance:'author'}},{id:'api-db-2',source:'api',target:'db',label:'writes',quantity:{value:10,unit:'rows/s',provenance:'author'}}],
 views:[{id:'overview',title:'Overview',nodeIds:['api','db'],edgeIds:['api-db','api-db-2'],positions:{api:{x:0,y:0},db:{x:300,y:0}}}]});

test('variant compare: layout, architecture and evidence changes are separate axes',()=>{
 const before=base(),after=clone(before);after.views[0].positions.db={x:300,y:300};after.nodes[0].label='Gateway';after.edges[0].quantity={value:20,unit:'rows/s',provenance:'source-derived'};
 const d=compareView(before,validateDocument(after),'overview',NOW,'author');
 const axis=(a:string)=>d.entries.filter(e=>e.axis===a).map(e=>e.change);
 assert.deepEqual(axis('layout'),['MOVED']);assert.deepEqual(axis('architecture'),['CHANGED']);assert.deepEqual(axis('evidence'),['CHANGED QUANTITY']);
 assert.ok(d.ledger.includes('CHANGED QUANTITY · API → Orders DB: 10 rows/s (author) → 20 rows/s (source-derived)'.replace('API','Gateway')),'a quantity change has its own ledger entry');
 assert.equal(d.relationships.get('api-db'),'changed');assert.equal(d.relationships.get('api-db-2'),'unchanged','a parallel flow with equal label and endpoints is its own object');
 assert.equal(d.ledger.length,d.entries.length);
});

test('variant compare: quantity fields compare canonically, so a note-only change is still visible',()=>{
 const before=base(),after=clone(before);after.edges[1].quantity={...after.edges[1].quantity!,note:'peak hour'};
 const d=compareView(before,validateDocument(after),'overview',NOW);
 assert.deepEqual(d.entries.map(e=>[e.axis,e.change,e.id]),[['evidence','CHANGED QUANTITY','api-db-2']]);
 assert.match(d.ledger[0],/quantity details changed/);
});

test('variant compare: a candidate component has no observation, which is UNKNOWN, never implemented or verified',()=>{
 const live=base(),rec=recordDraft(live,draftAddNode(startDraft(live,{variantId:'cache',title:'Cache',viewId:'overview'}),{label:'Read cache'}).draft);
 const sel=selectVariant(rec,'cache');
 assert.equal(sel.delta!.evidence.get('cache.read-cache')!.after,'unknown');assert.equal(sel.delta!.evidence.get('cache.read-cache')!.before,'absent');
 const u=sel.delta!.entries.find(e=>e.axis==='evidence')!;assert.equal(u.change,'UNKNOWN');assert.match(u.text,/no observation\. Drawing a new element does not implement or verify it/);
 assert.ok(!JSON.stringify(rec.observations).includes('cache'),'comparing never records an observation');
});

test('variant compare: a move-only draft is a layout change only, and the delta figure tags each entry with its axis',()=>{
 const live=base(),rec=recordDraft(live,draftMoveNode(startDraft(live,{variantId:'mv',title:'Move',viewId:'overview'}),'db',{x:300,y:400}));
 const sel=selectVariant(rec,'mv');assert.deepEqual(sel.delta!.entries.map(e=>e.axis),['layout']);
 const after=clone(live);after.edges[0].quantity={value:30,unit:'rows/s',provenance:'author'};after.views[0].positions.db={x:300,y:400};
 const svg=deltaSvg(live,validateDocument(after),'overview',{now:NOW});
 assert.match(svg,/data-axis="layout"/);assert.match(svg,/data-axis="evidence"/);assert.match(svg,/CHANGED QUANTITY · EVIDENCE/);
 const {quantity:_drop,...bare}=live.edges[0],q=draftUpdateEdge(startDraft(live,{variantId:'q',title:'Q',viewId:'overview'}),bare);
 const dq=compareView(live,q.candidate,'overview',NOW,'author');
 assert.deepEqual(dq.entries.map(e=>e.change),['CHANGED QUANTITY']);assert.match(dq.ledger[0],/10 rows\/s \(author\) → no quantity/);
});
