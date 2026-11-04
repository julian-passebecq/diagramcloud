import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument} from '../src/core/model';
import {publicDocument,commitHistory,undo} from '../src/core/operations';
import {applyDocumentPatch} from '../src/core/patch';
import {tourStops,recordStop} from '../src/core/tours';
import {prepareExplanationWalkthrough,walkthroughFingerprint,type ExplanationWalkthrough} from '../src/intelligence/explanationWalkthrough';

function project(){return validateDocument({schemaVersion:1,tours:[],id:'demo',revision:4,title:'Teaching API',rootViewId:'root',
 nodes:[{id:'caller',label:'Caller',blockIds:['code']},{id:'api',label:'API'},{id:'hidden',label:'Private diagnostic',visibility:'private'}],
 edges:[{id:'get',source:'caller',target:'api',label:'GET /forecast',kind:'query'},{id:'reply',source:'api',target:'caller',label:'reply',kind:'query'}],
 views:[{id:'root',title:'System',nodeIds:['caller','api','hidden'],edgeIds:['get','reply']}],
 blocks:[{id:'code',title:'retry.py',type:'code',language:'python',code:'for attempt in range(3):\n    response = get_forecast()\n    if response.ok:\n        return response',provenance:'synthetic'}],
 sources:[{id:'python',title:'Python documentation',url:'https://docs.python.org/3/library/functools.html'}]});}
function request():ExplanationWalkthrough{const p=project();return {format:'diagramcloud.explanation-walkthrough',version:1,projectId:p.id,baseRevision:p.revision,baseFingerprint:walkthroughFingerprint(p),id:'retry',title:'Retry is a policy',question:'What happens after a transient response?',sourceIds:['python'],steps:[
 {id:'first',title:'First request',viewId:'root',nodeIds:['caller','api'],edgeIds:['get'],narration:'Illustrative first request.',sourceIds:[],provenance:'synthetic',dependsOn:[],before:[{name:'attempt',value:'1'}],after:[{name:'response',value:'503 in this illustrative case'}],takeaway:'A returned error is not automatically retried.',questions:[],code:{blockId:'code',fromLine:1,toLine:2}},
 {id:'second',title:'Retry request',viewId:'root',nodeIds:['caller','api'],edgeIds:['get'],narration:'A later authored step uses the same request relation.',sourceIds:[],provenance:'synthetic',dependsOn:['first'],before:[{name:'attempt',value:'2'}],after:[],takeaway:'Repeated action, same participants.',questions:['What if the retry budget is exhausted?'],caseLabel:'retry permitted'}]};}

test('walkthrough produces a genuine applicable additive patch with stable actors and repeated edges',()=>{
 const p=project(),before=JSON.stringify(p),r=request(),out=prepareExplanationWalkthrough(p,r);
 assert.equal(JSON.stringify(p),before);assert.equal(out.preview.revision,p.revision);assert.equal(out.preview.observations.length,0);
 for(const n of p.nodes)assert.deepEqual(out.preview.nodes.find(x=>x.id===n.id),n);
 for(const e of p.edges)assert.deepEqual(out.preview.edges.find(x=>x.id===e.id),e);
 assert.deepEqual(out.preview.story,p.story);assert.equal(out.steps.length,2);
 assert.notEqual(out.steps[0].viewId,out.steps[1].viewId);assert.notEqual(out.steps[0].stopId,out.steps[1].stopId);
 for(const step of out.steps){const v=out.preview.views.find(v=>v.id===step.viewId)!;assert.deepEqual(v.edgeIds,['get']);assert.ok(v.nodeIds.includes('caller'));}
 assert.deepEqual(tourStops(out.preview,out.preview.tours![0]).map(s=>s.status),['current','current']);
 assert.deepEqual(applyDocumentPatch(p,out.patch).result,out.preview);
});
test('native history keeps the new explanation as one Undo',()=>{
 const p=project(),out=prepareExplanationWalkthrough(p,request());
 const h=commitHistory({past:[],present:p,future:[]},out.preview);
 assert.equal(h.past.length,1);assert.deepEqual(undo(h).present,p);
});
test('generated content remains private and makes no publication or execution claim',()=>{
 const p=project(),out=prepareExplanationWalkthrough(p,request()),a=publicDocument(p),b=publicDocument(out.preview);
 assert.deepEqual({...b,revision:a.revision},a);
 assert.ok(out.preview.nodes.filter(n=>!p.nodes.some(x=>x.id===n.id)).every(n=>n.visibility==='private'));
 assert.ok(out.preview.tours!.every(t=>t.visibility==='private'));assert.match(out.notice,/not causal order/);
});
test('code selection preserves exact lines, synthetic provenance and explicit frozen-source locator',()=>{
 const out=prepareExplanationWalkthrough(project(),request());
 const excerpt=out.preview.blocks.find(b=>b.id==='walk-retry.first.code');assert.equal(excerpt?.type,'code');
 if(excerpt?.type==='code')assert.equal(excerpt.code,'for attempt in range(3):\n    response = get_forecast()');
 assert.equal(excerpt?.provenance,'synthetic');assert.ok(out.preview.blocks.some(b=>b.type==='text'&&b.text.includes('Frozen excerpt, not live code')));
});
test('edge-only selection includes endpoints explicitly without cloning participants',()=>{
 const r=request();r.steps[0].nodeIds=[];delete r.steps[0].code;
 const out=prepareExplanationWalkthrough(project(),r),view=out.preview.views.find(v=>v.id===out.steps[0].viewId)!;
 assert.ok(view.nodeIds.includes('caller')&&view.nodeIds.includes('api'));
});
test('empty causal prerequisites stay unknown and never become a timing claim',()=>{
 const out=prepareExplanationWalkthrough(project(),request());
 assert.ok(out.preview.blocks.some(b=>b.type==='text'&&b.text.includes('Causal prerequisites not supplied')));
 assert.equal(out.preview.blocks.filter(b=>b.type==='schedule').length,0);
});
test('original authored code, blocks and prior tour survive',()=>{
 const p=project();p.tours=[{id:'prior',title:'Prior',sourceRevision:4,visibility:'private',stops:[recordStop(p,'root',[{kind:'node',id:'api'}],'Prior')]}];
 const r=request();r.baseFingerprint=walkthroughFingerprint(p);
 const out=prepareExplanationWalkthrough(p,r);assert.deepEqual(out.preview.tours![0],p.tours[0]);assert.deepEqual(out.preview.blocks.find(b=>b.id==='code'),p.blocks[0]);
});
const invalids:[string,(r:ExplanationWalkthrough)=>void][]=[
 ['other project',r=>r.projectId='other'],['stale revision',r=>r.baseRevision--],['changed fingerprint',r=>r.baseFingerprint='0000000000000000'],
 ['duplicate step',r=>r.steps[1].id='first'],['forward dependency',r=>r.steps[0].dependsOn=['second']],['missing dependency',r=>r.steps[1].dependsOn=['gone']],
 ['self dependency',r=>r.steps[0].dependsOn=['first']],['duplicate dependency',r=>r.steps[1].dependsOn=['first','first']],
 ['missing view',r=>r.steps[0].viewId='missing'],['missing node',r=>r.steps[0].nodeIds=['missing']],['missing edge',r=>r.steps[0].edgeIds=['missing']],
 ['duplicate node',r=>r.steps[0].nodeIds=['caller','caller']],['duplicate edge',r=>r.steps[0].edgeIds=['get','get']],
 ['empty subject',r=>{r.steps[0].nodeIds=[];r.steps[0].edgeIds=[];}],['unknown source',r=>r.sourceIds=['missing']],['duplicate source',r=>r.sourceIds=['python','python']],
 ['no cited nonfiction',r=>{r.sourceIds=[];r.steps[0].provenance='source-derived';}],['code outside source lines',r=>r.steps[0].code!.toLine=100],
 ['backward source lines',r=>r.steps[0].code!.fromLine=3],['unknown code',r=>r.steps[0].code!.blockId='missing'],
 ['duplicate state field',r=>r.steps[0].before=[{name:'x',value:'1'},{name:'x',value:'2'}]],
 ['unsupported trace claim',r=>(r.steps[0] as any).provenance='observed'],['extra executable field',r=>(r as any).execute='rm -rf /'],
 ['too many steps',r=>r.steps=Array.from({length:31},(_,i)=>({...r.steps[0],id:'step'+i}))]
];
for(const [name,edit] of invalids)test('walkthrough refuses '+name+' without mutation',()=>{
 const p=project(),before=JSON.stringify(p),r=request();edit(r);assert.throws(()=>prepareExplanationWalkthrough(p,r));assert.equal(JSON.stringify(p),before);
});
test('patch itself refuses same-revision code drift after preparation',()=>{
 const p=project(),out=prepareExplanationWalkthrough(p,request()),changed=project();(changed.blocks[0] as any).code='changed';
 assert.throws(()=>applyDocumentPatch(changed,out.patch));
});
test('prepared source fingerprint refuses same-revision changed code',()=>{
 const p=project();(p.blocks[0] as any).code='changed';assert.throws(()=>prepareExplanationWalkthrough(p,request()),/source changed/);
});
test('reimport cannot replace the walkthrough under a reused ID',()=>{
 const first=prepareExplanationWalkthrough(project(),request()),r=request();r.baseRevision=first.preview.revision;r.baseFingerprint=walkthroughFingerprint(first.preview);
 assert.throws(()=>prepareExplanationWalkthrough(first.preview,r),/already exists/);
});
test('inert labels and code never become executable objects',()=>{
 const r=request();r.steps[0].narration='<script>globalThis.pwned=true</script>';const out=prepareExplanationWalkthrough(project(),r);
 assert.equal((globalThis as any).pwned,undefined);assert.ok(out.preview.blocks.some(b=>b.type==='text'&&b.text.includes('<script>')));
});

test('original participant content is anchored as well as note and selected edges',()=>{
 const r=prepareExplanationWalkthrough(project(),request()),p=structuredClone(r.preview);p.nodes.find(n=>n.id==='api')!.label='Different API';
 assert.deepEqual(tourStops(p,p.tours![0]).map(s=>s.status),['stale','stale']);
});
test('oversized anchor sets are refused rather than silently dropping subjects',()=>{
 const p=project();for(let i=0;i<20;i++){p.nodes.push({...p.nodes[0],id:'n'+i});p.views[0].nodeIds.push('n'+i);}
 const r=request();r.baseFingerprint=walkthroughFingerprint(p);r.steps[0].nodeIds=p.views[0].nodeIds;
 assert.throws(()=>prepareExplanationWalkthrough(p,r),/20-subject/);
});
test('an absent optional tour collection refuses preparation instead of risking same-revision overwrite',()=>{
 const p=project();delete p.tours;const r=request();r.baseFingerprint=walkthroughFingerprint(p);
 assert.throws(()=>prepareExplanationWalkthrough(p,r),/Tours collection/);
});
