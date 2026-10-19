import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,validateDocument,type Project} from '../src/core/model';
import {addVariant,applyVariant} from '../src/core/variants';
import {previewDeliveryBrief} from '../src/intelligence/delivery';
import {alignByCorrespondence,comparisonChoices,comparisonStale,environmentPairs,openCorrespondenceComparison,openLinkedComparison,type Correspondence} from '../src/core/variantDraft';

/** V3 W3 linked comparison: exact stable IDs or a recorded correspondence, absent counterparts, frozen until compared again. Synthetic fixtures. */
const NOW=new Date('2026-10-19T00:00:00Z');
const base=():Project=>validateDocument({schemaVersion:1,id:'shop',revision:3,title:'Synthetic shop',rootViewId:'overview',
 nodes:[{id:'api',label:'API'},{id:'db',label:'Orders DB',kind:'storage'}],edges:[{id:'api-db',source:'api',target:'db',label:'writes'}],
 views:[{id:'overview',title:'Overview',nodeIds:['api','db'],edgeIds:['api-db'],positions:{api:{x:0,y:0},db:{x:300,y:0}}}]});
const withVariant=()=>addVariant(base(),{id:'cache',title:'Cache',viewId:'overview',operations:[
 {op:'add',path:'/nodes/-',value:{id:'cache.read',label:'Orders DB'}},{op:'add',path:'/views/@overview/nodeIds/-',value:'cache.read'},{op:'add',path:'/views/@overview/positions/cache.read',value:{x:0,y:200}},
 {op:'test',path:'/nodes/@api/label',value:'API'},{op:'replace',path:'/nodes/@api/label',value:'Gateway'}]});

test('variant comparison pairs by stable ID only: a candidate with the same label as an existing component is added, never matched',()=>{
 const doc=withVariant(),c=openLinkedComparison(doc,{kind:'variant',variantId:'cache'},{viewId:'overview',now:NOW});
 assert.equal(c.pairing,'stable-id');assert.equal(c.revision,doc.revision);
 const d=c.view!.delta;
 assert.equal(d.components.get('cache.read'),'added','same label "Orders DB" as db, still its own object');
 assert.equal(d.components.get('db'),'unchanged');assert.equal(d.components.get('api'),'changed');
 assert.deepEqual([...new Set(d.entries.map(e=>e.axis))].sort(),['architecture','evidence']);
 assert.equal(doc.revision,withVariant().revision,'opening a comparison changes nothing');
 assert.deepEqual(doc.variants!.map(v=>v.id),['cache']);
});

test('a stale or broken variant does not open; its reason is given and nothing changes',()=>{
 const doc=withVariant(),changed=clone(doc);changed.nodes[0].summary='edited elsewhere';changed.revision++;
 const live=validateDocument(changed);
 assert.throws(()=>openLinkedComparison(live,{kind:'variant',variantId:'cache'},{viewId:'overview'}),/Cannot compare Cache: Stale baseline/);
 assert.equal(comparisonChoices(live).variants[0].status,'stale');
});

test('two revisions of the session compare by stable ID; a revision no longer held is refused',()=>{
 // The App commits each change as a new revision; the fixture numbers them the same way.
 const before=validateDocument({...withVariant(),revision:4}),after=validateDocument({...applyVariant(before,'cache'),revision:5});
 const choices=comparisonChoices(after,[base(),before]);
 assert.deepEqual(choices.versions.map(v=>v.revision),[before.revision,3]);
 const c=openLinkedComparison(after,{kind:'version',revision:before.revision},{viewId:'overview',versions:[before],now:NOW});
 assert.equal(c.leftLabel,`Revision ${before.revision}`);assert.equal(c.view!.delta.components.get('cache.read'),'added');
 assert.throws(()=>openLinkedComparison(after,{kind:'version',revision:99},{viewId:'overview',versions:[before]}),/not held in this session/);
});

test('a source change marks the comparison stale and keeps the frozen pairs; another project is stale too',()=>{
 const doc=withVariant(),c=openLinkedComparison(doc,{kind:'variant',variantId:'cache'},{viewId:'overview',now:NOW});
 assert.equal(comparisonStale(c,doc),null);
 const edited=clone(doc);edited.revision++;
 assert.match(comparisonStale(c,edited)!,new RegExp(`revision ${doc.revision}, now ${doc.revision+1}.*nothing was re-paired`));
 assert.equal(c.view!.delta.components.get('cache.read'),'added','the frozen delta is untouched');
 const other=clone(doc);other.id='other';
 assert.match(comparisonStale(c,other)!,/Another project is open/);
});

test('environments pair by componentId; an absent counterpart is absent and a claim in one environment says nothing about the other',()=>{
 const start=base(),doc=previewDeliveryBrief(start,{format:'diagramcloud.delivery-brief',version:1,projectId:start.id,baseRevision:start.revision,delivery:{
  environments:[{id:'dev',label:'DEV'},{id:'test',label:'TEST'}],artifacts:[],promotions:[],
  instances:[{id:'api-dev',nodeId:'api-dev-node',componentId:'api',environmentId:'dev'},{id:'api-test',nodeId:'api-test-node',componentId:'api',environmentId:'test'},{id:'db-dev',nodeId:'db-dev-node',componentId:'db',environmentId:'dev'}]}}).document;
 const pairs=environmentPairs(doc,'dev','test'),db=pairs.find(p=>p.componentId==='db')!,api=pairs.find(p=>p.componentId==='api')!;
 assert.equal(db.right.state,'absent');assert.match(db.right.text,/absent, not matched/);
 assert.deepEqual(db.axes.map(a=>a.change),['DECLARED IN DEV ONLY']);
 assert.deepEqual(api.axes,[]);assert.equal(api.equivalence,'UNKNOWN');
 assert.throws(()=>environmentPairs(doc,'dev','dev'),/two different environments/);
});

test('across projects only a recorded correspondence pairs: equal IDs and labels it does not name stay unpaired',()=>{
 const left=base(),right=validateDocument({...clone(base()),id:'shop-v2',title:'Synthetic shop v2',nodes:[{id:'gateway',label:'API'},{id:'db',label:'Orders DB',kind:'storage'}],
  edges:[{id:'gw-db',source:'gateway',target:'db',label:'writes'}],views:[{id:'main',title:'Main',nodeIds:['gateway','db'],edgeIds:['gw-db'],positions:{gateway:{x:0,y:0},db:{x:300,y:0}}}],rootViewId:'main'});
 const c:Correspondence={format:'diagramcloud.correspondence',version:1,leftProjectId:'shop',rightProjectId:'shop-v2',recordedBy:'Synthetic author',recordedAt:'2026-10-19T00:00:00Z',
  views:[{left:'overview',right:'main'}],components:[{left:'api',right:'gateway'}],connections:[{left:'api-db',right:'gw-db'}]};
 const cmp=openCorrespondenceComparison(left,right,c,'overview',NOW);
 assert.equal(cmp.pairing,'correspondence');
 const d=cmp.view!.delta;
 assert.equal(d.components.get('api'),'unchanged','gateway pairs with api because the record names it');
 assert.equal(d.components.get('db'),'removed','db exists in both projects with the same ID and label, but no record pairs it');
 assert.equal(d.components.get('unpaired~db'),'added');
 assert.throws(()=>alignByCorrespondence(left,right,{...c,components:[{left:'api',right:'gateway'},{left:'db',right:'gateway'}]}),/ambiguous/);
 assert.throws(()=>alignByCorrespondence(left,right,{...c,components:[{left:'api',right:'missing'}]}),/does not exist/);
 assert.throws(()=>alignByCorrespondence(left,right,{...c,recordedBy:' '}),/who recorded it/);
 assert.throws(()=>openCorrespondenceComparison(left,right,{...c,views:[]},'overview'),/no recorded counterpart/);
 assert.equal(right.id,'shop-v2','the other project is never rewritten');
});
