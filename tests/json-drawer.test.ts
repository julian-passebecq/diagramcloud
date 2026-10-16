import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,validateDocument,type Choice,type Project} from '../src/core/model';
import {commitHistory,publicDocument,undo,type History} from '../src/core/operations';
import {applyDraft,checkDraft,createLatestValidator,draftText,DRAFT_NO_COMPONENT,type DraftBase} from '../src/core/jsonDraft';
import {contosoForecasting} from '../src/data/contosoForecasting';

const choice=(over:Partial<Choice>={}):Choice=>({id:'store-choice',title:'Where forecasts are stored',goal:'Keep forecasts queryable by the planner',
 options:[{id:'lakehouse',label:'Lakehouse table',summary:''},{id:'warehouse',label:'Warehouse table',summary:''}],recommendedOptionId:'lakehouse',
 reasons:['One copy for both readers'],tradeoffs:['Fewer SQL features'],assumptions:['Under a million rows a day'],revisitWhen:'When a second consumer needs SQL writes',
 status:'candidate',origin:'ai',sourceIds:[],visibility:'public',...over});
const withChoices=(choices:Choice[],nodeId='planner'):Project=>{const d=clone(contosoForecasting());d.nodes.find(n=>n.id===nodeId)!.choices=choices;return validateDocument(d);};
const project=(d:Project):DraftBase=>({projectId:d.id,revision:d.revision,scope:{kind:'project'}});

test('choices: a legacy document without choices stays valid and unchanged',()=>{
 const legacy=contosoForecasting(),parsed=validateDocument(JSON.parse(JSON.stringify(legacy)));
 assert.ok(parsed.nodes.every(n=>!('choices' in n))&&parsed.views.every(v=>!('choices' in v)),'no empty choices slot is invented');
 assert.deepEqual(parsed,validateDocument(legacy));
});

test('choices: validateDocument checks options, status and sources; no numeric score field exists',()=>{
 assert.equal(withChoices([choice()]).nodes.find(n=>n.id==='planner')!.choices![0].status,'candidate');
 assert.throws(()=>withChoices([choice({chosenOptionId:'lakehouse'})]),/a candidate has no chosen option/);
 assert.throws(()=>withChoices([choice({status:'accepted',chosenOptionId:'lakehouse'})]),/accepted decision records chosenOptionId, decidedBy and decidedAt/);
 assert.equal(withChoices([choice({status:'accepted',origin:'imported',chosenOptionId:'lakehouse',decidedBy:'Architecture board',decidedAt:'2026-03-02'})]).nodes.find(n=>n.id==='planner')!.choices![0].decidedBy,'Architecture board');
 assert.throws(()=>withChoices([choice({recommendedOptionId:'cosmos'})]),/unknown reference cosmos/);
 assert.throws(()=>withChoices([choice({sourceIds:['src-missing']})]),/unknown reference src-missing/);
 assert.throws(()=>withChoices([choice(),choice()]),/Duplicate choice ID/);
 assert.throws(()=>withChoices([{...choice(),score:9} as Choice]),/Unrecognized key/);
 const view=clone(contosoForecasting());view.views[0].choices=[choice({id:'view-choice'})];assert.equal(validateDocument(view).views[0].choices!.length,1);
});

test('choices: publicDocument keeps public choices only and never publishes a private citation',()=>{
 const d=clone(contosoForecasting());d.sources.push({id:'src-private',title:'Private memo',location:'internal',visibility:'private'});
 d.nodes.find(n=>n.id==='planner')!.choices=[choice(),choice({id:'secret-choice',visibility:'private'}),choice({id:'cited-choice',sourceIds:['src-private']})];
 const pub=publicDocument(validateDocument(d)),planner=pub.nodes.find(n=>n.id==='planner')!;
 assert.deepEqual(planner.choices!.map(c=>c.id),['store-choice']);
 assert.ok(!JSON.stringify(pub).includes('secret-choice')&&!JSON.stringify(pub).includes('Private memo'));
 const none=publicDocument(withChoices([choice({visibility:'private'})]));assert.ok(!('choices' in none.nodes.find(n=>n.id==='planner')!),'an emptied list is dropped');
 const hidden=clone(withChoices([choice()]));hidden.nodes.find(n=>n.id==='planner')!.visibility='private';
 assert.ok(!JSON.stringify(publicDocument(validateDocument(hidden))).includes('store-choice'),'choices of a private component never leave');
});

test('draft: invalid JSON or an invalid document is a result, and the applied project is never mutated',()=>{
 const d=contosoForecasting(),before=JSON.stringify(d),base=project(d);
 const bad=checkDraft(base,d,'{"id":');assert.equal(bad.ok,false);assert.match(!bad.ok?bad.error:'',/Not valid JSON/);
 const dangling=JSON.parse(draftText(d,base.scope));dangling.views[0].nodeIds.push('ghost');
 const invalid=checkDraft(base,d,JSON.stringify(dangling));assert.equal(invalid.ok,false);assert.match(!invalid.ok?invalid.error:'',/unknown reference ghost/);
 const renamed=JSON.parse(draftText(d,base.scope));renamed.id='other-project';assert.match((checkDraft(base,d,JSON.stringify(renamed)) as {error:string}).error,/Keep the stable project ID/);
 assert.equal(JSON.stringify(d),before);
});

test('draft: apply is one revision and one Undo restores the applied model',()=>{
 const d=contosoForecasting(),base=project(d),edited=JSON.parse(draftText(d,base.scope));edited.title='Edited in the drawer';
 const checked=checkDraft(base,d,JSON.stringify(edited));assert.ok(checked.ok);assert.deepEqual(checked.ok&&checked.preview.metadata,['title']);
 const h0:History={past:[],present:d,future:[]},h1=commitHistory(h0,applyDraft(base,d,JSON.stringify(edited),d));
 assert.equal(h1.present.revision,d.revision+1);assert.equal(h1.present.title,'Edited in the drawer');assert.equal(h1.past.length,1);
 assert.deepEqual(undo(h1).present,d);
});

test('draft: a stale revision or a changed live project is refused without mutation',()=>{
 const d=contosoForecasting(),base=project(d),edited=JSON.parse(draftText(d,base.scope));edited.summary='Draft text';
 const visual=commitHistory({past:[],present:d,future:[]},{...clone(d),title:'Visual edit'}).present,snapshot=JSON.stringify(visual);
 assert.throws(()=>applyDraft(base,visual,JSON.stringify(edited),d),/Refused: the project is now at revision 1, and this draft was written against revision 0\. Nothing was applied/);
 assert.equal(JSON.stringify(visual),snapshot);
 // Same revision number after Undo + another edit: the content guard still refuses.
 const other={...clone(d),title:'Another edit at the same revision'};
 assert.throws(()=>applyDraft(base,other,JSON.stringify(edited),d),/project changed after this draft started/);
 assert.throws(()=>applyDraft(base,{...clone(d),id:'another-project'},JSON.stringify(edited)),/belongs to project “contoso-forecasting”/);
});

test('draft: a component draft maps by exact stable ID, reports absence, and cannot replace hidden facts',()=>{
 const d=contosoForecasting(),scope={kind:'node' as const,id:'planner'},base={projectId:d.id,revision:d.revision,scope};
 assert.throws(()=>draftText(d,{kind:'node',id:'plann'}),new RegExp(DRAFT_NO_COMPONENT('plann').slice(0,30)));
 const node=JSON.parse(draftText(d,scope));assert.equal(node.id,'planner');
 node.choices=[choice()];node.label='Planner (drawer)';
 const next=applyDraft(base,d,JSON.stringify(node),d);
 assert.equal(next.nodes.find(n=>n.id==='planner')!.choices![0].id,'store-choice');
 const strip=(p:Project)=>({...p,nodes:p.nodes.filter(n=>n.id!=='planner')});
 assert.deepEqual(strip(next),strip(d),'nothing outside the component changes');
 assert.match((checkDraft(base,d,JSON.stringify({...node,id:'forecast-ui'})) as {error:string}).error,/Keep the stable component ID “planner”/);
 const decided=withChoices([choice({status:'accepted',origin:'imported',chosenOptionId:'warehouse',decidedBy:'Board',decidedAt:'2025-11-02'})]);
 const rewritten=JSON.parse(draftText(decided,scope));rewritten.choices[0].decidedBy='Someone else';
 const check=checkDraft({...base,revision:decided.revision},decided,JSON.stringify(rewritten));assert.ok(check.ok);assert.deepEqual(check.ok&&check.decisions,['store-choice'],'a rewritten historical decision is reported before Apply');
});

test('validation: debounced, cancelable, and a late result for an older draft never wins',async()=>{
 const resolvers=new Map<string,(v:string)=>void>(),seen:string[]=[];
 const v=createLatestValidator((text:string)=>new Promise<string>(r=>resolvers.set(text,r)),(_t,r)=>seen.push(r),5);
 const tick=(ms:number)=>new Promise(r=>setTimeout(r,ms));
 v.submit('a');await tick(15);assert.ok(resolvers.has('a'),'the older draft started validating');
 v.submit('ab');await tick(15);
 resolvers.get('ab')!('result ab');await tick(1);resolvers.get('a')!('result a (late)');await tick(5);
 assert.deepEqual(seen,['result ab']);
 v.submit('abc');v.submit('abcd');await tick(15);assert.ok(!resolvers.has('abc'),'a superseded draft inside the debounce window is never validated');
 v.cancel();resolvers.get('abcd')!('cancelled');await tick(5);assert.deepEqual(seen,['result ab']);assert.equal(v.pending(),false);
});
