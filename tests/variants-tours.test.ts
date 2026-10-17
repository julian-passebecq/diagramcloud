import test from 'node:test';
import assert from 'node:assert/strict';
import {zodToJsonSchema} from 'zod-to-json-schema';
import {clone,documentSchema,validateDocument,type Project} from '../src/core/model';
import {commitHistory,publicDocument,undo,type History} from '../src/core/operations';
import {addVariant,applyVariant,discardVariant,rebaseVariant,selectVariant,variantPatch,variantState} from '../src/core/variants';
import {addTour,addTourStop,recordStop,tourStops} from '../src/core/tours';
import {PATCH_FORMAT} from '../src/core/patch';
import {samples} from '../src/data/samples';
import {portfolioHtml} from '../src/export/html';

/** R3-02 baseline-bound variants and R3-15 tours (inherited R3-AC-04..06 and R3-AC-33). */
const shop=():Project=>validateDocument({schemaVersion:1,id:'shop',revision:3,title:'Shop',rootViewId:'overview',
 nodes:[{id:'api',label:'API'},{id:'db',label:'Orders DB',kind:'storage'},{id:'vault',label:'Secret vault',visibility:'private'},{id:'ops-box',label:'Ops runner'}],
 edges:[{id:'api-db',source:'api',target:'db',label:'writes'},{id:'api-vault',source:'api',target:'vault'}],
 views:[{id:'overview',title:'Overview',nodeIds:['api','db','vault'],edgeIds:['api-db','api-vault']},{id:'ops',title:'Operations',nodeIds:['ops-box'],visibility:'private'}]});
const cachePlan=[
 {op:'test',path:'/nodes/@db/label',value:'Orders DB'},{op:'replace',path:'/nodes/@db/label',value:'Orders DB (read replica)'},
 {op:'add',path:'/nodes/-',value:{id:'cache-plan.cache',label:'Cache',kind:'storage'}},{op:'add',path:'/views/@overview/nodeIds/-',value:'cache-plan.cache'},
 {op:'add',path:'/edges/-',value:{id:'cache-plan.api-cache',source:'api',target:'cache-plan.cache',label:'reads'}},{op:'add',path:'/views/@overview/edgeIds/-',value:'cache-plan.api-cache'}];
const withVariant=()=>addVariant(shop(),{id:'cache-plan',title:'Read cache in front of the orders DB',viewId:'overview',operations:cachePlan,origin:'ai',suggestedBy:'claude'});
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v as object))freeze(x);}return v;};
const edit=(h:History,f:(d:Project)=>void)=>{const d=clone(h.present);f(d);return commitHistory(h,d);};

test('variants: selecting a variant compares it with its baseline and mutates no canonical fact',()=>{
 const doc=freeze(withVariant()),before=JSON.stringify(doc);
 const sel=selectVariant(doc,'cache-plan');
 assert.equal(JSON.stringify(doc),before,'the selected document is byte-identical');
 assert.equal(sel.state.status,'current');assert.equal(sel.refused,undefined);
 assert.equal(sel.delta!.components.get('cache-plan.cache'),'added');assert.equal(sel.delta!.components.get('db'),'changed');assert.equal(sel.delta!.relationships.get('cache-plan.api-cache'),'added');
 assert.ok(sel.delta!.ledger.some(l=>l.startsWith('CHANGED · Orders DB (read replica)')));
 assert.deepEqual(sel.preview!.entities.nodes,{added:['cache-plan.cache'],removed:[],changed:['db']},'the review shows what Apply would change');
 assert.equal(doc.nodes.find(n=>n.id==='db')!.label,'Orders DB');assert.equal(doc.revision,3);assert.equal(doc.variants!.length,1,'still a candidate, not accepted');
 assert.ok(!doc.nodes.some(n=>n.id.startsWith('cache-plan.')),'no candidate item enters the canonical model by selection');
});

test('variants: a changed baseline makes the variant stale; comparison and Apply are refused until an explicit rebase',()=>{
 let h:History={past:[],present:withVariant(),future:[]};
 h=edit(h,d=>{d.views.find(v=>v.id==='ops')!.title='Ops (renamed)';});
 assert.equal(variantState(h.present,'cache-plan').status,'current','an edit outside the baseline keeps it current');
 h=edit(h,d=>{d.nodes.find(n=>n.id==='db')!.summary='Now partitioned by month';});
 const state=variantState(h.present,'cache-plan');
 assert.equal(state.status,'stale');assert.match(state.message,/Stale baseline: written against revision 3.*revision 5.*rebase it explicitly/);
 const sel=selectVariant(h.present,'cache-plan');assert.equal(sel.delta,undefined);assert.equal(sel.preview,undefined);assert.match(sel.refused!,/Stale baseline/);
 assert.throws(()=>applyVariant(h.present,'cache-plan'),/Refused: Stale baseline.*Nothing was applied/);
 const rebased=rebaseVariant(h.present,'cache-plan');
 assert.deepEqual(rebased.variants![0].base.revision,5);assert.equal(variantState(rebased,'cache-plan').status,'current');
 assert.equal(rebased.nodes.find(n=>n.id==='db')!.summary,'Now partitioned by month','a rebase changes the baseline record only');
 const gone=edit(h,d=>{d.nodes.find(n=>n.id==='db')!.label='Orders store';}).present;
 assert.equal(variantState(gone,'cache-plan').status,'stale');assert.throws(()=>rebaseVariant(gone,'cache-plan'),/Cannot rebase: the operations no longer apply.*test failed/);
});

test('variants: candidate-local IDs live in the variant namespace and never collide with canonical IDs',()=>{
 const add=(operations:unknown[],id='cache-plan')=>addVariant(shop(),{id,title:'Plan',viewId:'overview',operations});
 assert.throws(()=>add([{op:'add',path:'/nodes/-',value:{id:'db',label:'Second DB'}}]),/candidate-local ID starting with “cache-plan\.”/);
 assert.throws(()=>add([{op:'add',path:'/nodes/-',value:{id:'cache',label:'Cache'}}]),/candidate-local ID/);
 assert.throws(()=>add([{op:'add',path:'/edges/-',value:{id:'api-db',source:'api',target:'db'}}]),/candidate-local ID/);
 assert.throws(()=>add([{op:'replace',path:'/nodes/@db',value:{id:'db2',label:'Renamed'}}]),/keeps its stable ID db/);
 assert.throws(()=>add([{op:'replace',path:'/nodes/1/label',value:'By index'}]),/use - \(never an index\)/);
 assert.throws(()=>add([{op:'replace',path:'/views/@ops/title',value:'Other view'}]),/changes only its own view overview/);
 assert.throws(()=>add([{op:'replace',path:'/delivery',value:{}}]),/A variant changes components/,'local/test/prod instances are never a variant');
 const doc=withVariant(),clash=clone(doc);clash.nodes.push({...clash.nodes[0],id:'cache-plan.cache'});
 assert.throws(()=>validateDocument(clash),/cache-plan\.cache: this canonical ID is inside variant cache-plan's local namespace/);
 const applied=applyVariant(doc,'cache-plan');
 assert.ok(applied.nodes.some(n=>n.id==='cache-plan.cache')&&!applied.variants,'once applied, the candidate IDs are canonical and the namespace is released');
 assert.equal(new Set(applied.nodes.map(n=>n.id)).size,applied.nodes.length);
});

test('variants: Apply is one revision-guarded revision that removes the variant; one Undo restores baseline and variant',()=>{
 const doc=withVariant(),patch=variantPatch(doc,'cache-plan');
 assert.equal(patch.format,PATCH_FORMAT);assert.equal(patch.baseRevision,3);assert.deepEqual(patch.operations.at(-1),{op:'remove',path:'/variants'});
 let h:History={past:[],present:doc,future:[]};
 h=commitHistory(h,applyVariant(h.present,'cache-plan'));
 assert.equal(h.present.revision,4);assert.equal(h.present.nodes.find(n=>n.id==='db')!.label,'Orders DB (read replica)');assert.equal(h.present.variants,undefined);
 assert.ok(h.present.views[0].edgeIds.includes('cache-plan.api-cache'));
 h=undo(h);assert.deepEqual(h.present,doc,'one Undo restores the baseline and the candidate');
 assert.equal(variantState(h.present,'cache-plan').status,'current');
 const two=addVariant(doc,{id:'no-vault',title:'Drop the vault link',viewId:'overview',operations:[{op:'remove',path:'/edges/@api-vault'},{op:'remove',path:'/views/@overview/edgeIds/1'}]});
 const kept=applyVariant(two,'no-vault');assert.deepEqual(kept.variants!.map(v=>v.id),['cache-plan'],'applying one variant keeps the others as candidates');
 assert.equal(discardVariant(two,'no-vault').variants!.length,1);
});

test('variants: publicDocument never publishes a variant, its candidate IDs or its operations',()=>{
 const pub=publicDocument(withVariant());
 assert.equal(pub.variants,undefined);assert.ok(!JSON.stringify(pub).includes('cache-plan'));
});

test('tours: a stale or missing anchor fails visibly when played; reading a tour changes nothing',()=>{
 const doc0=shop(),stop=recordStop(doc0,'overview',[{kind:'node',id:'db'},{kind:'edge',id:'api-db'}],'Orders land here.');
 let doc=addTour(doc0,{id:'walk',title:'Order walkthrough',visibility:'public',stop});
 doc=addTourStop(doc,'walk',recordStop(doc,'overview',[{kind:'node',id:'api'}],'Requests start at the API.'));
 assert.throws(()=>recordStop(doc,'overview',[{kind:'node',id:'ops-box'}],''),/Not in view overview: ops-box/);
 assert.deepEqual(tourStops(doc,doc.tours![0]).map(s=>s.status),['current','current']);
 const frozen=freeze(edit({past:[],present:doc,future:[]},d=>{d.nodes.find(n=>n.id==='db')!.label='Orders store';}).present),snapshot=JSON.stringify(frozen);
 const played=tourStops(frozen,frozen.tours![0]);
 assert.equal(played[0].status,'stale');assert.match(played[0].message,/Anchor stale: the content changed after this tour was recorded at revision 3 \(now revision 4\)/);
 assert.equal(JSON.stringify(frozen),snapshot,'playing never repairs or rewrites an anchor');
 const removed=clone(doc);removed.edges=removed.edges.filter(e=>e.id!=='api-db');removed.views[0].edgeIds=removed.views[0].edgeIds.filter(id=>id!=='api-db');
 const missing=tourStops(validateDocument(removed),doc.tours![0])[0];
 assert.equal(missing.status,'missing');assert.match(missing.message,/Anchor missing: connection api-db is no longer in view overview/);assert.deepEqual(missing.missing,[{kind:'edge',id:'api-db'}]);
 const noView=clone(doc);noView.tours![0].stops[0].viewId='gone';
 assert.match(tourStops(validateDocument(noView),noView.tours![0])[0].message,/Anchor missing: view gone is not available here/);
 assert.equal(tourStops(doc,doc.tours![0])[1].status,'current','the other stops still play');
});

test('tours: public copies keep safe identity and say what was omitted, without naming hidden subjects',()=>{
 const doc0=shop(),stops=[recordStop(doc0,'overview',[{kind:'node',id:'api'},{kind:'node',id:'vault'},{kind:'edge',id:'api-vault'}],'The API reads a key.'),recordStop(doc0,'ops',[{kind:'node',id:'ops-box'}],'The runner deploys nightly.'),recordStop(doc0,'overview',[{kind:'node',id:'db'}],'Orders land here.'),recordStop(doc0,'overview',[{kind:'node',id:'vault'}],'The vault holds the master key.')];
 let doc=addTour(doc0,{id:'walk',title:'Order walkthrough',visibility:'public',stop:stops[0]});doc=addTourStop(addTourStop(addTourStop(doc,'walk',stops[1]),'walk',stops[2]),'walk',stops[3]);
 doc=addTour(doc,{id:'internal',title:'Internal runbook',stop:stops[2]});
 const pub=publicDocument(doc),text=JSON.stringify(pub.tours);
 assert.deepEqual(pub.tours!.map(t=>t.id),['walk'],'a private tour stays in the authoring document');
 const [a,b,c,d]=pub.tours![0].stops;
 assert.deepEqual(a.subjects,[{kind:'node',id:'api'}]);assert.equal(a.omitted,'subjects');assert.equal(a.narration,'The API reads a key.');
 assert.deepEqual(b,{subjects:[],narration:'',omitted:'stop'},'a stop on a private view keeps no view, subject, fingerprint or narration');
 assert.equal(c.omitted,undefined);
 assert.deepEqual(d,{subjects:[],narration:'',omitted:'stop'},'a stop whose subjects are all private is omitted with its narration');
 for(const hidden of ['vault','api-vault','ops-box','"viewId":"ops"','runner deploys','master key','Internal runbook'])assert.ok(!text.includes(hidden),`${hidden} is not in the public tours`);
 const html=portfolioHtml(doc);
 assert.ok(html.includes('Orders land here'),'the public tour reaches the HTML export');
 for(const hidden of ['master key','runner deploys','Internal runbook'])assert.ok(!html.includes(hidden),`${hidden} is not in the public HTML export`);
 const read=tourStops(pub,pub.tours![0]);
 assert.deepEqual(read.map(s=>s.status),['current','omitted','current','omitted'],'a current stop reads current in the public copy');
 assert.equal(read[0].note,'Some subjects of this stop are not public and are omitted from this copy.');assert.match(read[1].message,/not public and is omitted/);
 const stale=clone(doc);stale.nodes.find(n=>n.id==='db')!.label='Orders store';
 assert.equal(tourStops(publicDocument(validateDocument(stale)),publicDocument(validateDocument(stale)).tours![0])[2].status,'stale','a stale stop stays stale in the public copy');
 assert.deepEqual(publicDocument(pub),pub,'the projection is stable');
});

test('variants and tours: optional fields; legacy documents stay valid and the generated JSON Schema publishes both',()=>{
 for(const s of samples){const d=validateDocument(JSON.parse(JSON.stringify(s)));assert.equal(d.variants,undefined);assert.equal(d.tours,undefined);}
 const t=clone(shop());t.tours=[{id:'bad',title:'Bad',sourceRevision:0,visibility:'public',stops:[{subjects:[],narration:'x',omitted:'stop'}]}];
 assert.throws(()=>validateDocument(t),/bad stop 1: an omitted stop keeps no view/);
 t.tours[0].stops=[{viewId:'overview',subjects:[],narration:''}];assert.throws(()=>validateDocument(t),/records its selected view and a content fingerprint/);
 const schema=JSON.stringify(zodToJsonSchema(documentSchema,{name:'DiagramCloudDocument',target:'jsonSchema7'}));assert.match(schema,/"variants"/);assert.match(schema,/"tours"/);
});
