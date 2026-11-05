import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument,type Project} from '../src/core/model';
import {publicDocument,commitHistory,undo} from '../src/core/operations';
import {applyDocumentPatch} from '../src/core/patch';
import {canonical} from '../src/core/learningMapping';
import {tourStops} from '../src/core/tours';
import {answerRows,proposeAnswer,questions} from '../src/core/questionAnswers';
import {teachingCases} from '../examples/pro-expressiveness/cases';
import {expressivenessExampleFiles} from '../scripts/generate-expressiveness-examples';
import {prepareExplanationWalkthrough,readExplanationWalkthrough,reviseExplanationWalkthrough,removeExplanationWalkthrough,listExplanationWalkthroughs,
 walkthroughFingerprint,ExplanationRevisionError,type ExplanationWalkthrough} from '../src/intelligence/explanationWalkthrough';
import {explanationBasis,startExplanationRevision,prepareExplanationRevision,prepareExplanationRemoval,applyPreparedExplanation} from '../src/intelligence/explanationRequestDraft';

/** An applied private walkthrough, committed the way the App commits it (one revision). */
function applied(c=teachingCases()[0]){
 const out=prepareExplanationWalkthrough(c.base,c.request);
 const h=commitHistory({past:[],present:c.base,future:[]},out.preview);
 return {c,doc:h.present,history:h};
}
const rebind=(doc:Project,r:ExplanationWalkthrough):ExplanationWalkthrough=>({...r,baseRevision:doc.revision,baseFingerprint:walkthroughFingerprint(doc)});
const generatedIds=(doc:Project,prefix:string)=>[...doc.nodes,...doc.blocks,...doc.views,...(doc.tours??[])].map(x=>x.id).filter(id=>id===prefix||id.startsWith(prefix+'.')).sort();

const files=expressivenessExampleFiles();
for(const c of teachingCases()){
 test(`example ${c.id}: the committed project file reads back to its committed request`,()=>{
  const project=validateDocument(JSON.parse(files[`${c.id}.project.json`])),request=JSON.parse(files[`${c.id}.walkthrough.json`]);
  assert.deepEqual(readExplanationWalkthrough(project,'lesson').request,request);
 });
 test(`example ${c.id}: an applied private walkthrough revises with stable IDs and removes back to the source`,()=>{
  const {doc}=applied(c),existing=readExplanationWalkthrough(doc,'lesson');
  assert.deepEqual(existing.request,c.request);
  const before=JSON.stringify(doc),revised=reviseExplanationWalkthrough(doc,rebind(doc,existing.request));
  assert.equal(JSON.stringify(doc),before,'preparing never mutates');
  assert.deepEqual(applyDocumentPatch(doc,revised.patch).result,revised.preview);
  assert.deepEqual(generatedIds(revised.preview,'walk-lesson'),generatedIds(doc,'walk-lesson'));
  assert.deepEqual(revised.preview.tours![0].stops.map(s=>s.id),doc.tours![0].stops.map(s=>s.id),'kept steps keep their stop IDs');
  assert.deepEqual(tourStops(revised.preview,revised.preview.tours![0]).map(s=>s.status),c.request.steps.map(()=>'current'));
  assert.equal(revised.preview.observations.length,0);
  assert.deepEqual(revised.effects?.droppedSteps,[]);
  // The revised copy reads back to the same request, now bound to the new cut.
  const committed=commitHistory({past:[],present:doc,future:[]},revised.preview).present;
  assert.deepEqual({...readExplanationWalkthrough(committed,'lesson').request,baseRevision:0,baseFingerprint:'0'},{...c.request,baseRevision:0,baseFingerprint:'0'});
  const removed=removeExplanationWalkthrough(doc,'lesson');
  assert.equal(canonical({...removed.preview,revision:0}),canonical({...c.base,revision:0}),'removal restores the exact source content');
 });
 test(`example ${c.id}: the public example project revises and removes, keeping its explicit visibility`,()=>{
  const project=validateDocument(JSON.parse(files[`${c.id}.project.json`])),existing=readExplanationWalkthrough(project,'lesson');
  const revised=reviseExplanationWalkthrough(project,rebind(project,existing.request));
  assert.ok(revised.effects!.publicItemIds.length>0);
  assert.deepEqual(publicDocument(revised.preview).views.map(v=>v.id),publicDocument(project).views.map(v=>v.id));
  const removed=removeExplanationWalkthrough(project,'lesson');
  assert.equal(generatedIds(removed.preview,'walk-lesson').length,0);
  assert.equal(removed.preview.story.length,0,'story steps pointing into the removed explanation go with it');
  assert.equal(removed.effects.removedStorySteps.length,project.story.length);
 });
}

test('revise is one revision and one Undo restores the applied explanation exactly',()=>{
 const {c,doc,history}=applied(),r=rebind(doc,readExplanationWalkthrough(doc,'lesson').request);
 r.steps[0].narration='A revised authored narration.';r.title='Revised title';
 const out=reviseExplanationWalkthrough(doc,r),h=commitHistory(history,out.preview);
 assert.equal(h.past.length,2);assert.equal(h.present.revision,doc.revision+1);assert.deepEqual(undo(h).present,doc);
 assert.equal(h.present.tours![0].title,'Revised title');assert.equal(h.present.tours![0].stops[0].narration,'A revised authored narration.');
 assert.equal(h.present.nodes.find(n=>n.id==='walk-lesson')!.label,'Revised title');
 assert.ok(c.base.nodes.every(n=>canonical(h.present.nodes.find(x=>x.id===n.id))===canonical(n)),'original components are untouched');
});
test('remove is one revision and one Undo restores it',()=>{
 const {doc,history}=applied(),out=removeExplanationWalkthrough(doc,'lesson'),h=commitHistory(history,out.preview);
 assert.equal(h.past.length,2);assert.deepEqual(undo(h).present,doc);assert.equal(out.preview.tours!.length,0);
});
test('adding, dropping and reordering steps keeps step-derived IDs and gives a new step a new stop',()=>{
 const {doc}=applied(),r=rebind(doc,readExplanationWalkthrough(doc,'lesson').request);
 const last=r.steps.pop()!;r.steps.push({...r.steps[0],id:'extra',title:'Extra step',dependsOn:[],code:undefined,questions:[]});
 const out=reviseExplanationWalkthrough(doc,r);
 assert.deepEqual(out.effects!.droppedSteps,[last.id]);assert.deepEqual(out.effects!.addedSteps,['extra']);
 assert.ok(!out.preview.views.some(v=>v.id===`walk-lesson.${last.id}.view`));assert.ok(out.preview.views.some(v=>v.id==='walk-lesson.extra.view'));
 const oldStops=new Set(doc.tours![0].stops.map(s=>s.id));assert.ok(!oldStops.has(out.steps.find(s=>s.sourceStepId==='extra')!.stopId));
});
test('a stale source binding is refused without mutation',()=>{
 const {doc}=applied(),r=readExplanationWalkthrough(doc,'lesson').request,before=JSON.stringify(doc);
 assert.throws(()=>reviseExplanationWalkthrough(doc,r),/source changed/);
 assert.throws(()=>reviseExplanationWalkthrough(doc,{...rebind(doc,r),baseFingerprint:'0000000000000000'}),/source changed/);
 assert.equal(JSON.stringify(doc),before);
});
const edits:[string,(d:Project)=>void][]=[
 ['a hand-edited generated text block',d=>{const b=d.blocks.find(b=>b.id==='walk-lesson.call.text');if(b?.type==='text')b.text+=' Edited.';}],
 ['a hand-edited before table',d=>{const b=d.blocks.find(b=>b.id==='walk-lesson.call.before');if(b?.type==='table')b.title='Edited';}],
 ['a re-narrated tour stop',d=>{d.tours![0].stops[0].narration='Edited in Tours.';}],
 ['a reordered tour',d=>{const s=d.tours![0].stops;[s[3],s[4]]=[s[4],s[3]];}],
 ['an extra evidence block on a generated note',d=>{d.blocks.push({id:'mine',title:'Mine',type:'text',text:'x',visibility:'private',sourceIds:[],provenance:'author'} as never);d.nodes.find(n=>n.id==='walk-lesson.call.note')!.blockIds.push('mine');}],
 ['an extra card in a frame',d=>{d.views.find(v=>v.id==='walk-lesson.call.view')!.nodeIds.push('weather');}],
 ['a missing details record',d=>{d.nodes.find(n=>n.id==='walk-lesson.call.note')!.blockIds.shift();d.blocks=d.blocks.filter(b=>b.id!=='walk-lesson.call.contract');}],
 ['an entry card without its source cut',d=>{d.nodes.find(n=>n.id==='walk-lesson')!.role='Edited';}],
 ['an edited frozen code excerpt',d=>{const b=d.blocks.find(b=>b.id==='walk-lesson.call.code');if(b?.type==='code')b.code+='\n# edited';}]
];
for(const [name,edit] of edits)test(`revise and remove refuse ${name} without mutation`,()=>{
 const {doc:base}=applied(),doc=structuredClone(base);edit(doc);const valid=validateDocument(doc),before=JSON.stringify(valid);
 assert.throws(()=>readExplanationWalkthrough(valid,'lesson'),ExplanationRevisionError);
 assert.throws(()=>reviseExplanationWalkthrough(valid,rebind(valid,readExplanationWalkthrough(base,'lesson').request)),ExplanationRevisionError);
 assert.throws(()=>removeExplanationWalkthrough(valid,'lesson'),ExplanationRevisionError);
 assert.equal(JSON.stringify(valid),before);
 assert.equal(listExplanationWalkthroughs(valid)[0].state,'unavailable');
});
test('a moved card is a position, not an edit',()=>{
 const {doc}=applied(),d=structuredClone(doc);d.views.find(v=>v.id==='walk-lesson.call.view')!.positions['walk-lesson.call.note']={x:999,y:999};
 const out=reviseExplanationWalkthrough(d,rebind(d,readExplanationWalkthrough(d,'lesson').request));
 assert.deepEqual(out.preview.views.find(v=>v.id==='walk-lesson.call.view')!.positions['walk-lesson.call.note'],{x:999,y:999});
});
test('an ambiguous source view is refused, never chosen',()=>{
 const {doc}=applied(),d=validateDocument({...doc,views:[...doc.views,{...doc.views.find(v=>v.id==='overview')!,id:'copy',title:'Copy'}]});
 assert.throws(()=>readExplanationWalkthrough(d,'lesson'),/source view cannot be determined/);
});
test('a revised step ID that collides with existing authored content is refused',()=>{
 const {doc}=applied(),d=validateDocument({...doc,blocks:[...doc.blocks,{id:'walk-lesson.zz.text',title:'Authored',type:'text',text:'x',provenance:'author'}]});
 assert.throws(()=>readExplanationWalkthrough(d,'lesson'),/unexpected walk-lesson.zz.text/);
});
test('answers on a revised step become stale and are never rebound; answers on a dropped step are listed and removed',()=>{
 const {doc}=applied(),note='walk-lesson.success.note',q=questions(doc,note).items[1];
 const withAnswer=commitHistory({past:[],present:doc,future:[]},applyDocumentPatch(doc,proposeAnswer(doc,{binding:q,blockId:'answer-1',answer:'Recorded later.',author:'Ana',citationIds:[]})).result).present;
 assert.equal(answerRows(withAnswer,note)[0].state,'current');
 const r=rebind(withAnswer,readExplanationWalkthrough(withAnswer,'lesson').request);
 const kept=reviseExplanationWalkthrough(withAnswer,r);
 assert.deepEqual(kept.effects!.staleAnswerIds,['answer-1']);
 const row=answerRows(kept.preview,note)[0];assert.equal(row.state,'stale');assert.deepEqual(row.record!.binding,q,'the saved binding is unchanged');
 assert.deepEqual(kept.preview.blocks.find(b=>b.id==='answer-1'),withAnswer.blocks.find(b=>b.id==='answer-1'));
 const dropped=reviseExplanationWalkthrough(withAnswer,{...r,steps:r.steps.filter(s=>s.id!=='success'&&!s.dependsOn.includes('success'))});
 assert.deepEqual(dropped.effects!.removedAnswerIds,['answer-1']);assert.ok(!dropped.preview.blocks.some(b=>b.id==='answer-1'));
 assert.deepEqual(removeExplanationWalkthrough(withAnswer,'lesson').effects.removedAnswerIds,['answer-1']);
});
test('a private explanation revise or remove leaves the public projection unchanged',()=>{
 const {doc}=applied(),pub=publicDocument(doc);
 const revised=reviseExplanationWalkthrough(doc,rebind(doc,readExplanationWalkthrough(doc,'lesson').request)),removed=removeExplanationWalkthrough(doc,'lesson');
 assert.deepEqual(publicDocument(revised.preview),pub);assert.deepEqual(publicDocument(removed.preview),pub);
 assert.ok(!JSON.stringify(publicDocument(revised.preview)).includes('walk-lesson'));
});
test('draft helpers rebuild a revise session at the current cut and keep the walkthrough ID fixed',()=>{
 const {doc}=applied(),session=startExplanationRevision(doc,'lesson');
 assert.deepEqual(session.basis,explanationBasis(doc));assert.equal(session.draft.id,'lesson');
 const out=prepareExplanationRevision(doc,session.basis,session.draft,'lesson');
 assert.equal(applyPreparedExplanation(doc,session.basis,out.patch).tours!.length,1);
 assert.throws(()=>prepareExplanationRevision(doc,session.basis,{...session.draft,id:'other'},'lesson'),/walkthrough ID/);
 const removal=prepareExplanationRemoval(doc,'lesson');assert.equal(applyPreparedExplanation(doc,removal.basis,removal.result.patch).tours!.length,0);
 const later=commitHistory({past:[],present:doc,future:[]},validateDocument({...doc,title:'Changed'})).present;
 assert.throws(()=>applyPreparedExplanation(later,removal.basis,removal.result.patch),/source changed/);
});
test('the walkthrough list names each explanation and whether it can be revised',()=>{
 const {doc}=applied();assert.deepEqual(listExplanationWalkthroughs(doc).map(x=>[x.id,x.state]),[['lesson','available']]);
 assert.deepEqual(listExplanationWalkthroughs(teachingCases()[0].base),[]);
});
