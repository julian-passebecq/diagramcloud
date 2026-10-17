import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,validateDocument,type Project} from '../src/core/model';
import {commitHistory,undo,type History} from '../src/core/operations';
import {applyVariant,variantState} from '../src/core/variants';
import {draftAddEdge,draftAddNode,draftFromVariant,draftIsEmpty,draftMoveNode,draftOperations,draftRemoveEdge,draftRemoveNode,draftUpdateEdge,draftUpdateNode,rebaseReport,recordDraft,startDraft} from '../src/core/variantDraft';

/** Visual variant editor (P3): form edits become guarded variant operations; nothing changes until recorded and applied. */
const shop=():Project=>validateDocument({schemaVersion:1,id:'shop',revision:3,title:'Shop',rootViewId:'overview',
 nodes:[{id:'api',label:'API'},{id:'db',label:'Orders DB',kind:'storage'},{id:'other',label:'Other view only'}],
 edges:[{id:'api-db',source:'api',target:'db',label:'writes',quantity:{value:10,unit:'rows/s',provenance:'author'}}],
 views:[{id:'overview',title:'Overview',nodeIds:['api','db'],edgeIds:['api-db'],positions:{api:{x:0,y:0},db:{x:300,y:0}}},{id:'side',title:'Side',nodeIds:['other','db']}]});
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v as object))freeze(x);}return v;};

test('variant editor: form edits produce operations with test preconditions, and drafting never mutates the live project',()=>{
 const live=freeze(shop()),before=JSON.stringify(live);
 let d=startDraft(live,{variantId:'cache',title:'Add a cache',viewId:'overview'});
 assert.equal(draftIsEmpty(d),true);
 d=draftUpdateNode(d,{...live.nodes.find(n=>n.id==='db')!,label:'Orders DB (replica)'});
 const added=draftAddNode(d,{label:'Read cache',kind:'storage'});d=added.draft;
 assert.equal(added.id,'cache.read-cache','new IDs live in the variant namespace');
 d=draftAddEdge(d,{source:'api',target:added.id,label:'reads'}).draft;
 d=draftMoveNode(d,'db',{x:300,y:200});
 const ops=draftOperations(d);
 assert.deepEqual(ops.slice(0,2),[{op:'test',path:'/nodes/@db/label',value:'Orders DB'},{op:'replace',path:'/nodes/@db/label',value:'Orders DB (replica)'}]);
 assert.ok(ops.some(o=>o.op==='add'&&o.path==='/nodes/-'));assert.ok(ops.some(o=>o.op==='add'&&o.path==='/edges/-'));
 const i=ops.findIndex(o=>o.op==='replace'&&o.path==='/views/@overview/nodeIds');assert.ok(i>0);assert.deepEqual(ops[i-1],{op:'test',path:'/views/@overview/nodeIds',value:['api','db']});
 assert.ok(ops.some(o=>o.op==='test'&&o.path==='/views/@overview/positions/db'),'a moved component is guarded by its old position');
 assert.equal(JSON.stringify(live),before,'the draft is a temporary candidate, never the live document');
 const recorded=recordDraft(live,d);
 assert.equal(recorded.variants![0].id,'cache');assert.equal(recorded.nodes.find(n=>n.id==='db')!.label,'Orders DB','recording is not applying');
 const applied=applyVariant(recorded,'cache');
 assert.equal(applied.nodes.find(n=>n.id==='db')!.label,'Orders DB (replica)');assert.deepEqual(applied.views[0].positions.db,{x:300,y:200});
 assert.ok(applied.edges.some(e=>e.id.startsWith('cache.')&&e.target==='cache.read-cache'));
});

test('variant editor: removing a canonical component only takes it out of the view; candidate-local ones are deleted',()=>{
 const live=shop();let d=startDraft(live,{variantId:'slim',title:'Slim',viewId:'overview'});
 const a=draftAddNode(d,{label:'Temp'});d=draftAddEdge(a.draft,{source:'api',target:a.id}).draft;d=draftRemoveNode(d,a.id);
 assert.equal(draftIsEmpty(d),true,'adding then removing a local component leaves nothing');
 d=draftRemoveNode(d,'db');
 assert.ok(d.candidate.nodes.some(n=>n.id==='db'),'the canonical component stays (view side still shows it)');
 assert.deepEqual(d.candidate.views[0].edgeIds,[],'its connections leave the view');assert.ok(d.candidate.edges.some(e=>e.id==='api-db'));
 assert.ok(!draftOperations(d).some(o=>o.op==='remove'&&o.path.startsWith('/nodes/')),'no canonical fact is deleted');
 const e=startDraft(live,{variantId:'nolink',title:'No link',viewId:'overview'});
 assert.ok(draftOperations(draftRemoveEdge(e,'api-db')).some(o=>o.path==='/views/@overview/edgeIds'));
 assert.throws(()=>draftAddEdge(e,{source:'api',target:'other'}),/other is not in view overview/);
 assert.throws(()=>startDraft(live,{variantId:'Bad ID',title:'x',viewId:'overview'}),/Variant ID/);
});

test('variant editor: a quantity edit from the connection editor is a guarded change; a concurrent edit of the same field refuses the record',()=>{
 const live=shop();let d=startDraft(live,{variantId:'q',title:'More rows',viewId:'overview'});
 const edge=live.edges[0];d=draftUpdateEdge(d,{...edge,quantity:{value:20,unit:'rows/s',provenance:'source-derived'}});
 assert.deepEqual(draftOperations(d).slice(0,2),[{op:'test',path:'/edges/@api-db/quantity',value:edge.quantity},{op:'replace',path:'/edges/@api-db/quantity',value:{value:20,unit:'rows/s',provenance:'source-derived'}}]);
 const concurrent=clone(live);concurrent.edges[0].quantity={value:12,unit:'rows/s',provenance:'author'};concurrent.revision=4;
 assert.throws(()=>recordDraft(validateDocument(concurrent),d),/Refused: .*test failed.*Nothing was recorded; the draft is kept/);
 const otherProject={...live,id:'elsewhere'};assert.throws(()=>recordDraft(otherProject,d),/belongs to project shop, and elsewhere is open/);
 assert.throws(()=>recordDraft(live,startDraft(live,{variantId:'empty',title:'Empty',viewId:'overview'})),/Nothing to record/);
});

test('variant editor: editing an existing variant revises its operations in one revision; Apply stays one Undo',()=>{
 const live=shop(),first=recordDraft(live,draftUpdateNode(startDraft(live,{variantId:'ren',title:'Rename',viewId:'overview'}),{...live.nodes[0],label:'Gateway'}));
 let d=draftFromVariant(first,'ren');assert.equal(d.candidate.nodes[0].label,'Gateway');
 d=draftUpdateNode(d,{...d.candidate.nodes[0],label:'Edge gateway'});
 const revised=recordDraft(first,d),ops=revised.variants![0].operations;
 assert.deepEqual(ops,[{op:'test',path:'/nodes/@api/label',value:'API'},{op:'replace',path:'/nodes/@api/label',value:'Edge gateway'}],'operations are re-derived from the baseline, not stacked');
 let h:History={past:[],present:revised,future:[]};h=commitHistory(h,applyVariant(h.present,'ren'));
 assert.equal(h.present.nodes[0].label,'Edge gateway');assert.equal(h.present.variants,undefined);
 h=undo(h);assert.equal(h.present.nodes[0].label,'API');assert.equal(variantState(h.present,'ren').status,'current');
});

test('variant editor: an explicit rebase shows conflicts first and never overwrites a concurrent edit',()=>{
 const live=shop(),rec=recordDraft(live,draftUpdateNode(startDraft(live,{variantId:'ren',title:'Rename',viewId:'overview'}),{...live.nodes[1],label:'Orders store'}));
 const unrelated=clone(rec);unrelated.views[0].positions.api={x:40,y:0};
 const u=validateDocument(unrelated);assert.equal(variantState(u,'ren').status,'stale');
 const clean=rebaseReport(u,'ren');assert.equal(clean.status,'clean');assert.equal(clean.conflicts.length,0);assert.match(clean.message,/1 precondition\(s\) still hold/);
 const clash=clone(rec);clash.nodes[1].label='Orders warehouse';
 const r=rebaseReport(validateDocument(clash),'ren');
 assert.equal(r.status,'conflicts');assert.deepEqual(r.conflicts,[{path:'/nodes/@db/label',recorded:'Orders DB',current:'Orders warehouse',missing:false}]);
 assert.match(r.message,/Rebase is refused so their edit is not overwritten/);
});
