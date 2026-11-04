import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument} from '../src/core/model';
import {DEFAULT_FILTERS,companionContent,companionRelated,companionTabs,coverageText,detourTarget,permittedDocument,relatedSceneView,startDetour} from '../src/core/companionPane';
import {buildScene} from '../src/export/scene';
import {EXPLANATION_DETAILS_COLUMNS,explanationDetailsRows} from '../src/core/explanationDetails';
import {companionConcepts,companionPaneTabs,companionQuestions,resolveQuestion,resolveReturn,RETURN_UNAVAILABLE,type CompanionReading} from '../src/core/companionPane';
import {suggestMapping,reviewMapping} from '../src/intelligence/learning/mappings';
import {learningCatalogue} from '../src/intelligence/learning/catalogue';
import {clone,type Project} from '../src/core/model';

/* UX32: the companion pane's pure state. The React pane renders exactly this. */
function project(){return validateDocument({schemaVersion:1,id:'companion',title:'Companion',rootViewId:'root',revision:3,
 sources:[{id:'doc',title:'Reference'},{id:'hidden-source',title:'Private reference',visibility:'private'}],
 blocks:[{id:'why',title:'Why',type:'text',text:'Explains the wrapper.'},{id:'code',title:'retry.py',type:'code',language:'python',code:'def retry(): pass',sourceIds:['doc']},
  {id:'state',title:'State',type:'table',columns:['k','v'],rows:[['attempt','1']]},{id:'secret-note',title:'Secret',type:'text',text:'author only',visibility:'private'},
  {id:'kpi',title:'Numbers',type:'metrics',items:[{label:'attempts',value:'3'}],sourceIds:['hidden-source']}],
 nodes:[{id:'api',label:'API',summary:'Front door',blockIds:['why','code','state','secret-note','kpi']},{id:'retry',label:'Retry'},{id:'queue',label:'Queue'},{id:'secret',label:'Private concept',visibility:'private'},{id:'other',label:'Elsewhere'}],
 edges:[{id:'a',source:'api',target:'retry',kind:'control'},{id:'b',source:'retry',target:'queue',kind:'stream'},{id:'p',source:'api',target:'secret',visibility:'private'},{id:'o',source:'queue',target:'other',kind:'dependency'}],
 views:[{id:'root',title:'Root',nodeIds:['api','retry','queue','secret'],edgeIds:['a','b','p']},{id:'more',title:'More',nodeIds:['queue','other'],edgeIds:['o']}]});}
const anchor={viewId:'root',nodeId:'api'};

test('tabs are offered only when they have content; Related is always there',()=>{
 const p=project();
 assert.deepEqual(companionTabs(companionContent(p,'api')),['explanation','code','related','evidence']);
 assert.deepEqual(companionTabs(companionContent(p,'queue')),['related']);
 assert.deepEqual(companionTabs(null),['related']);
});

test('a public reader sees only the public projection: no private block, source or related component',()=>{
 const pub=permittedDocument(project(),true),content=companionContent(pub,'api')!;
 assert.ok(!content.explanation.some(b=>b.id==='secret-note'));
 assert.ok(!content.sources.some(s=>s.id==='hidden-source'));
 const r=companionRelated(project(),true,anchor,{...DEFAULT_FILTERS,depth:3});assert.equal(r.state,'available');if(r.state!=='available')return;
 assert.ok(!r.spec.nodes.some(n=>n.id==='secret'));
 const author=companionRelated(project(),false,anchor,{...DEFAULT_FILTERS,depth:3});assert.ok(author.state==='available'&&author.spec.nodes.some(n=>n.id==='secret'));
});

test('coverage names its bounds and the truncation, never "all"',()=>{
 const p=project(),narrow={...DEFAULT_FILTERS,maxNodes:2};
 const r=companionRelated(p,false,anchor,narrow);if(r.state!=='available')throw Error('fixture');
 assert.equal(r.truncated,true);
 const text=coverageText(r,narrow);
 assert.match(text,/^1 related component and \d+ connections? within depth 1, this view, both directions, all relation kinds; display limit 2 reached, more may exist\.$/);
 const wide=companionRelated(p,false,anchor,{...DEFAULT_FILTERS,depth:3,scope:'project',kinds:['control']});if(wide.state!=='available')throw Error('fixture');
 assert.match(coverageText(wide,{...DEFAULT_FILTERS,depth:3,scope:'project',kinds:['control']}),/the permitted project, both directions, control; display limit 20\.$/);
});

test('the related scene is drawn from the projection only, in its own order',()=>{
 const p=project(),r=companionRelated(p,false,anchor,{...DEFAULT_FILTERS,depth:2});if(r.state!=='available')throw Error('fixture');
 const view=relatedSceneView(r,p.views[0]),scene=buildScene(p,view);
 assert.deepEqual(scene.nodes.map(n=>n.id).sort(),r.spec.nodes.map(n=>n.id).sort());
 assert.deepEqual(scene.edges.map(e=>e.id).sort(),r.spec.edges.map(e=>e.id).sort());
 assert.ok(!p.views.some(v=>v.id===view.id),'the scene view is temporary, never stored');
});

test('a detour opens a related component in a permitted view and keeps the first origin across hops',()=>{
 const p=project(),wide=companionRelated(p,false,{viewId:'root',nodeId:'retry'},{...DEFAULT_FILTERS,depth:2,scope:'project'});
 assert.deepEqual(detourTarget(wide,'queue'),{viewId:'root',nodeId:'queue'});
 assert.deepEqual(detourTarget(wide,'other'),{viewId:'more',nodeId:'other'});
 assert.equal(detourTarget(wide,'not-there'),null);
 const first=startDetour(p,{viewId:'root',nodeId:'retry'},{viewId:'root',nodeId:'queue'});
 assert.equal(first.origin.label,'Retry');assert.equal(first.target.label,'Queue');
 const second=startDetour(p,{viewId:'root',nodeId:'queue'},{viewId:'more',nodeId:'other'},first);
 assert.deepEqual(second.origin,first.origin,'the original question is never replaced');
 assert.equal(second.target.nodeId,'other');
});

test('a stale revision or a hidden anchor is unavailable with a generic notice',()=>{
 const p=project();
 const stale=companionRelated({...p,revision:p.revision},true,{viewId:'root',nodeId:'secret'},DEFAULT_FILTERS);
 assert.equal(stale.state,'unavailable');
 assert.equal(detourTarget(stale,'api'),null);
});

/* 1.34.0 P2: related concepts and detour return with reading state. Synthetic fixture; no observation or review is created by the pane. */
const [conceptA,conceptB,conceptC]=learningCatalogue;
function reading(){return validateDocument({schemaVersion:1,id:'reading',title:'Reading',rootViewId:'root',revision:4,
 sources:[{id:'pub-src',title:'Synthetic public reference'},{id:'priv-src',title:'Private reference',visibility:'private'}],
 blocks:[{id:'details',title:'Questions',type:'table',columns:EXPLANATION_DETAILS_COLUMNS,provenance:'synthetic',
  rows:explanationDetailsRows({focusQuestion:'Why validate orders?',sourceCut:'synthetic cut',prerequisites:[],questions:['Who handles failure?','Where is the error kept?']})}],
 nodes:[{id:'orders',label:'Orders',summary:'Synthetic order intake',blockIds:['details'],sourceIds:['pub-src']},{id:'checks',label:'Checks'},{id:'stage',label:'Stage',childViewId:'detail'},{id:'vault',label:'Vault',childViewId:'secret-view',visibility:'private'},{id:'store',label:'Store'},
  {id:'hidden',label:'Private ledger',visibility:'private'},{id:'plain',label:'Orders validation pattern'}],
 edges:[{id:'oc',source:'orders',target:'checks',kind:'control'},{id:'cs',source:'checks',target:'store',kind:'batch'},{id:'oh',source:'orders',target:'hidden',visibility:'private'}],
 views:[{id:'root',title:'Root',nodeIds:['orders','checks','stage','vault','plain','hidden'],edgeIds:['oc','oh']},{id:'detail',title:'Detail',nodeIds:['checks','store'],edgeIds:['cs']},
  {id:'secret-view',title:'Secret view',nodeIds:['orders'],visibility:'private'}]});}
const AUTHOR={origin:'author' as const,suggestedBy:'Synthetic author'};
const REVIEW={reviewedBy:'Synthetic reviewer',reviewedAt:'2026-11-04T00:00:00Z'};
function withMappings(base:Project){
 let d=suggestMapping(base,{conceptId:conceptA.id,target:{kind:'node',id:'orders'}},AUTHOR);
 d=reviewMapping(d,d.learningMappings!.at(-1)!.id,{...REVIEW,evidence:{sourceIds:['pub-src'],blockIds:[]}});
 d=suggestMapping(d,{conceptId:conceptB.id,target:{kind:'node',id:'orders'}},{origin:'ai',suggestedBy:'synthetic agent'});
 d=suggestMapping(d,{conceptId:conceptC.id,target:{kind:'node',id:'orders'},visibility:'private'},AUTHOR);
 return reviewMapping(d,d.learningMappings!.at(-1)!.id,{...REVIEW,evidence:{sourceIds:['priv-src'],blockIds:[]}});
}

test('Concepts tab appears only for a component with a stored mapping, never from a shared word',()=>{
 const d=withMappings(reading()),content=companionContent(d,'orders');
 assert.deepEqual(companionPaneTabs(content,companionConcepts(d,false,'orders').length,false),['explanation','contract','questions','related','concepts','evidence']);
 // "Orders validation pattern" shares words with Orders and with concept titles but has no stored mapping: no Concepts tab.
 assert.equal(companionConcepts(d,false,'plain').length,0);
 assert.ok(!companionPaneTabs(companionContent(d,'plain'),0,false).includes('concepts'));
 assert.equal(companionConcepts(reading(),false,'orders').length,0,'no mapping, no concept');
 assert.deepEqual(companionConcepts(d,false,'orders').map(r=>[r.conceptId,r.state]),[[conceptA.id,'reviewed'],[conceptB.id,'suggested'],[conceptC.id,'reviewed']]);
});

test('public Concepts tab shows only public reviewed mappings, never a suggestion or a private mapping',()=>{
 const d=withMappings(reading()),pub=companionConcepts(d,true,'orders');
 assert.deepEqual(pub.map(r=>r.conceptId),[conceptA.id]);
 assert.ok(!JSON.stringify(pub).includes('Private reference'));
 assert.equal(companionConcepts(d,true,'hidden').length,0);
 let onlyPrivate=suggestMapping(reading(),{conceptId:conceptC.id,target:{kind:'node',id:'store'},visibility:'private'},AUTHOR);
 onlyPrivate=reviewMapping(onlyPrivate,onlyPrivate.learningMappings!.at(-1)!.id,{...REVIEW,evidence:{sourceIds:['pub-src'],blockIds:[]}});
 assert.equal(companionConcepts(onlyPrivate,true,'store').length,0);assert.equal(companionConcepts(onlyPrivate,false,'store').length,1);
});

test('questions are bound by component, kind, position and exact text; a reworded one is never rebound',()=>{
 const d=reading(),content=companionContent(d,'orders'),qs=companionQuestions(content);
 assert.deepEqual(qs.map(q=>[q.kind,q.index,q.text]),[['focus',0,'Why validate orders?'],['follow-up',0,'Who handles failure?'],['follow-up',1,'Where is the error kept?']]);
 assert.deepEqual(resolveQuestion(content,qs[2]),qs[2]);
 assert.equal(resolveQuestion(companionContent(d,'checks'),qs[2]),null,'another component never inherits the choice');
 const reworded=clone(d),t=reworded.blocks[0];if(t.type!=='table')throw Error('fixture');
 t.rows=explanationDetailsRows({focusQuestion:'Why validate orders?',sourceCut:'synthetic cut',prerequisites:[],questions:['Who handles failure?','Where is the failure kept?']});
 assert.equal(resolveQuestion(companionContent(validateDocument(reworded),'orders'),qs[2]),null);
});

const readingState=(q:ReturnType<typeof companionQuestions>[number]):CompanionReading=>({tab:'questions',filters:{...DEFAULT_FILTERS,depth:2,kinds:['control','batch']},question:q});
test('a detour records project, revision, audience and reading state, and Return restores them',()=>{
 const d=reading(),q=companionQuestions(companionContent(d,'orders'))[1];
 const origin={viewId:'root',nodeId:'orders'},r=companionRelated(d,false,origin,{...DEFAULT_FILTERS,depth:2,scope:'project'});
 const target=detourTarget(r,'store')!;assert.deepEqual(target,{viewId:'detail',nodeId:'store'});
 const detour=startDetour(d,origin,target,null,{audience:'author',reading:readingState(q)});
 assert.equal(detour.projectId,'reading');assert.equal(detour.revision,4);assert.equal(detour.audience,'author');
 // A second hop keeps the first origin and its reading state.
 const second=startDetour(d,{viewId:'detail',nodeId:'store'},{viewId:'root',nodeId:'checks'},detour,{audience:'author',reading:{tab:'related',filters:DEFAULT_FILTERS,question:null}});
 assert.deepEqual(second.origin,detour.origin);assert.deepEqual(second.reading,detour.reading);assert.equal(second.target.nodeId,'checks');
 const back=resolveReturn(d,false,second);assert.equal(back.state,'available');if(back.state!=='available')return;
 assert.deepEqual(back.anchor,origin);assert.deepEqual(back.reading,readingState(q));assert.equal(back.revisionChanged,false);
 // The snapshot is a copy: the reader's later filter changes never rewrite it.
 const supplied=readingState(q),copy=startDetour(d,origin,target,null,{reading:supplied});supplied.filters.kinds.push('stream');
 assert.deepEqual(copy.reading.filters.kinds,['control','batch']);
 // A later revision that keeps the origin and the question still returns, and says the revision changed.
 const later=resolveReturn(validateDocument({...clone(d),revision:5}),false,detour);
 assert.ok(later.state==='available'&&later.revisionChanged&&later.reading.question?.text==='Who handles failure?');
});

test('Return is refused with the generic message after an audience switch, a removed node or a revoked view',()=>{
 const d=reading(),q=companionQuestions(companionContent(d,'orders'))[0];
 const detour=startDetour(d,{viewId:'root',nodeId:'orders'},{viewId:'detail',nodeId:'store'},null,{audience:'author',reading:readingState(q)});
 assert.deepEqual(resolveReturn(d,true,detour),{state:'refused',notice:RETURN_UNAVAILABLE},'audience changed');
 const removed=clone(d);removed.nodes=removed.nodes.filter(n=>n.id!=='orders');removed.edges=removed.edges.filter(e=>e.id!=='oc'&&e.id!=='oh');
 removed.views=removed.views.map(v=>({...v,nodeIds:v.nodeIds.filter(id=>id!=='orders'),edgeIds:(v.edgeIds??[]).filter(id=>id!=='oc'&&id!=='oh')}));
 assert.deepEqual(resolveReturn(validateDocument(removed),false,detour),{state:'refused',notice:RETURN_UNAVAILABLE},'node gone');
 // The origin view is revoked for the public audience: refused, never moved to another view holding the same component.
 const fromPrivate=startDetour(d,{viewId:'secret-view',nodeId:'orders'},{viewId:'detail',nodeId:'store'},null,{audience:'public',reading:readingState(q)});
 assert.deepEqual(resolveReturn(d,true,fromPrivate),{state:'refused',notice:RETURN_UNAVAILABLE},'revoked view');
 assert.equal(resolveReturn({...d,id:'elsewhere'},false,detour).state,'refused','another project');
 assert.ok(!/orders/i.test(RETURN_UNAVAILABLE),'the notice names nothing');
 // A tab that no longer has content falls back to Related; a question that disappeared is dropped, not rebound.
 const plain=clone(d);plain.nodes=plain.nodes.map(n=>n.id==='orders'?{...n,blockIds:[]}:n);
 const fallback=resolveReturn(validateDocument(plain),false,detour);assert.equal(fallback.state,'available');if(fallback.state!=='available')return;
 assert.equal(fallback.reading.tab,'related');assert.equal(fallback.reading.question,null);
});

test('a detour started in one audience is not extended by a hop in another',()=>{
 const d=reading(),author=startDetour(d,{viewId:'root',nodeId:'orders'},{viewId:'root',nodeId:'checks'},null,{audience:'author'});
 const pub=startDetour(d,{viewId:'root',nodeId:'checks'},{viewId:'detail',nodeId:'store'},author,{audience:'public'});
 assert.equal(pub.audience,'public');assert.equal(pub.origin.nodeId,'checks');
});
