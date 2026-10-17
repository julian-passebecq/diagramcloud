import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,validateDocument,type Choice,type Project} from '../src/core/model';
import {commitHistory,publicDocument,undo,type History} from '../src/core/operations';
import {choiceReview,recordCompatibility,removeCompatibility,reviewChoice} from '../src/core/decisionReview';
import {substitutionCheck,substitutionRequirements} from '../src/intelligence/learning/substitution';
import {emptySchedule,emptyScheduleItem,measureClashes,measureDraftOf,measureErrors,measureOf,scheduleBlock,scheduleDraftOf,scheduleErrors,type ScheduleBlock,type ScheduleDraft} from '../src/core/evidenceForms';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {designSvg} from '../src/export/design';
import {parseXml,walk} from '../src/core/interchange/xml';

const NODES=['planner','api'];
const schedule=(items:Partial<ScheduleDraft['items'][number]>[],over:Partial<ScheduleDraft>={}):ScheduleDraft=>({...emptySchedule(),title:'Rollout',items:items.map((x,i)=>({...emptyScheduleItem(),id:`item-${i+1}`,label:`Step ${i+1}`,...x})),...over});

test('schedule form: each field error is reported beside its item and nothing is repaired',()=>{
 const errs=(d:ScheduleDraft)=>scheduleErrors(d,NODES);
 assert.deepEqual(errs(schedule([{start:'2026-10-01',end:'2026-10-03'}])),{block:[],items:[[]]});
 assert.match(errs(schedule([{start:'2026-02-30',end:'2026-03-02'}])).items[0][0],/start 2026-02-30 is not a calendar date/i);
 assert.match(errs(schedule([{start:'2026-10-05',end:'2026-10-03'}])).items[0][0],/Ends \(2026-10-03\) before it starts/);
 assert.match(errs(schedule([{start:'2026-10-01',end:'2026-10-03',duration:'P5D'}])).items[0][0],/End 2026-10-03 and duration P5D disagree/);
 assert.match(errs(schedule([{start:'2026-10-01'}])).items[0][0],/Needs an end or a duration; nothing is inferred/);
 assert.match(errs(schedule([{start:'2026-10-01',duration:'5 days'}])).items[0][0],/not an ISO 8601 duration/);
 assert.match(errs(schedule([{start:'2026-10-01T09:00:00Z',duration:'PT6H'}])).items[0][0],/is not a calendar date/,'a timestamp in a date-only schedule is refused, not converted');
 assert.deepEqual(errs(schedule([{start:'2026-10-01T09:00:00Z',duration:'PT6H'}],{timezone:'UTC'})).items[0],[]);
 assert.match(errs(schedule([{start:'2026-10-01',end:'2026-10-02',nodeIds:['ghost']}])).items[0][0],/Component ghost is not in this document/);
 const dup=errs(schedule([{start:'2026-10-01',end:'2026-10-02'},{id:'item-1',start:'2026-10-03',end:'2026-10-04'}]));assert.match(dup.items[1][0],/ID item-1 is used twice/);
 assert.match(errs(schedule([{start:'2026-10-01',end:'2026-10-02'}],{timezone:'Mars time'})).block[0],/Time basis/);
 const bad=schedule([{start:'2026-10-05',end:'2026-10-03'}]),before=JSON.stringify(bad);
 assert.throws(()=>scheduleBlock(bad,{id:'sched'},NODES),/Item 1: Ends \(2026-10-03\) before it starts/);assert.equal(JSON.stringify(bad),before,'the draft is not repaired');
});

test('schedule form: a valid draft becomes one block, round-trips unchanged, and applying is one revision and one Undo',()=>{
 const d=contosoForecasting(),b=scheduleBlock(schedule([{start:'2026-10-01',end:'2026-10-03',nodeIds:['planner'],basis:'estimate',note:'From the plan'},{start:'2026-10-06',duration:'P2W'}],{provenance:'source-derived',sourceIds:['src-readme']}),{id:'rollout'},d.nodes.map(n=>n.id));
 assert.deepEqual(b.items.map(i=>[i.id,i.start,i.end??null,i.duration??null,i.basis]),[['item-1','2026-10-01','2026-10-03',null,'estimate'],['item-2','2026-10-06',null,'P2W','supplied']]);
 assert.deepEqual(scheduleBlock(scheduleDraftOf(b),{id:b.id},d.nodes.map(n=>n.id)),b,'the form keeps every field of a stored schedule');
 const next=clone(d);next.blocks.push(b);next.nodes.find(n=>n.id==='planner')!.blockIds.push(b.id);
 const h:History={past:[],present:d,future:[]},after=commitHistory(h,next);
 assert.equal(after.present.revision,d.revision+1);assert.equal(after.past.length,1);
 const edited=clone(after.present),draft=scheduleDraftOf(edited.blocks.find(x=>x.id==='rollout') as ScheduleBlock);draft.items[1].duration='P3W';
 edited.blocks=edited.blocks.map(x=>x.id==='rollout'?scheduleBlock(draft,{id:'rollout'},d.nodes.map(n=>n.id)):x);
 const twice=commitHistory(after,edited);assert.equal(twice.present.revision,d.revision+2);
 assert.equal((undo(twice).present.blocks.find(x=>x.id==='rollout') as ScheduleBlock).items[1].duration,'P2W','one Undo restores the previous schedule');
});

test('measure form: a reading is checked beside its metric, a synthetic block never carries a measured value, and two readings of one role clash',()=>{
 const m={metric:'p95 latency',value:'420',unit:'ms',scope:'checkout API',from:'2026-09-01',to:'2026-09-07',basis:'measured' as const,role:'baseline' as const};
 assert.deepEqual(measureErrors(m,'source-derived'),[]);
 assert.deepEqual(measureOf(m,'source-derived'),{metric:'p95 latency',value:420,unit:'ms',scope:'checkout API',window:{from:'2026-09-01',to:'2026-09-07'},basis:'measured',role:'baseline'});
 assert.deepEqual(measureDraftOf(measureOf(m,'author')),m,'a stored reading opens in the form unchanged');
 assert.match(measureErrors({...m,value:'420 ms'},'author')[0],/Value: type a number/);
 assert.match(measureErrors({...m,value:'1e999'},'author')[0],/Value: type a number/);
 assert.match(measureErrors({...m,to:'2026-08-30'},'author')[0],/Window ends \(2026-08-30\) before it starts/);
 assert.match(measureErrors({...m,to:'2026-09-07T00:00:00Z'},'author')[0],/mixes a date and a timestamp/);
 assert.match(measureErrors(m,'synthetic').join(' '),/A synthetic block cannot carry a measured value/);
 assert.deepEqual(measureErrors({...m,basis:'estimate'},'synthetic'),[]);
 assert.throws(()=>measureOf({...m,value:'x'},'author'),/Value/);
 assert.match(measureClashes([{measure:m},{},{measure:{...m,value:'430'}}])[0],/Metrics 1 and 3 are both the baseline reading of p95 latency for checkout API/);
 assert.deepEqual(measureClashes([{measure:m},{measure:{...m,role:'current'}}]),[]);
});

const choice=(over:Partial<Choice>={}):Choice=>({id:'store-choice',title:'Where forecasts are stored',goal:'Keep forecasts queryable by the planner',
 options:[{id:'lakehouse',label:'Lakehouse table',summary:''},{id:'warehouse',label:'Warehouse table',summary:''}],recommendedOptionId:'lakehouse',
 reasons:['One copy for both readers'],tradeoffs:[],assumptions:['Under a million rows a day'],status:'candidate',origin:'ai',suggestedBy:'claude',sourceIds:['src-store'],visibility:'public',...over});
function fixture():Project{const d=clone(contosoForecasting());d.nodes.find(n=>n.id==='planner')!.choices=[choice()];
 d.sources.push({id:'src-private',title:'Private vendor benchmark',location:'',visibility:'private'});
 d.blocks.push({id:'syn',title:'Synthetic sketch',type:'text',text:'Illustration',provenance:'synthetic',sourceIds:[],visibility:'public'});return validateDocument(d);}
const reqs=(d:Project)=>substitutionRequirements(d,'planner','store-choice');
const rec=(d:Project,requirementId:string,x:Partial<Parameters<typeof recordCompatibility>[3]>={})=>recordCompatibility(d,'store-choice','warehouse',{requirementId,verdict:'satisfied',sourceIds:['src-store'],blockIds:[],recordedBy:'Julian',recordedAt:'2026-10-17',...x},reqs(d));
const check=(d:Project)=>substitutionCheck(d,'planner',{label:'Warehouse table',choiceId:'store-choice',optionId:'warehouse'});

test('compatibility evidence: recorded in Edit mode by a named person with a citation, read by the substitution check',()=>{
 const d=fixture();assert.deepEqual(reqs(d).map(r=>r.id),['role:planner','out:overview-e0','assumption:store-choice:0']);
 assert.throws(()=>rec(d,'role:planner',{recordedBy:'  '}),/records who did it/);
 assert.throws(()=>rec(d,'role:planner',{sourceIds:[]}),/Cite at least one project source or non-synthetic evidence block/);
 assert.throws(()=>rec(d,'role:planner',{sourceIds:[],blockIds:['syn']}),/Synthetic block “Synthetic sketch” cannot establish compatibility/);
 assert.throws(()=>rec(d,'in:nowhere'),/not a current requirement/);
 assert.throws(()=>rec(d,'role:planner',{recordedBy:'Claude'}),/A recommendation cannot record evidence for itself/);
 let x=rec(d,'role:planner');x=rec(x,'out:overview-e0',{sourceIds:[],blockIds:['latency-report']});
 assert.equal(check(x).verdict,'UNKNOWN','one requirement still has no evidence');
 x=rec(x,'assumption:store-choice:0',{sourceIds:['src-adr']});
 const ok=check(x);assert.equal(ok.verdict,'compatible-per-cited-evidence');assert.match(ok.label,/Compatible per cited evidence · not a verification/);
 assert.deepEqual(ok.requirements.map(r=>[r.state,r.recordedBy,r.recordedAt]),[['satisfied','Julian','2026-10-17'],['satisfied','Julian','2026-10-17'],['satisfied','Julian','2026-10-17']]);
 const stored=x.nodes.find(n=>n.id==='planner')!.choices![0].options[1].compatibility!;assert.equal(stored.length,3);assert.equal(stored[0].requirementText,reqs(d)[0].text);
 assert.equal(check(rec(x,'role:planner',{verdict:'violated'})).verdict,'not-substitutable','a re-record replaces the earlier verdict for that requirement');
 assert.equal(rec(x,'role:planner',{verdict:'violated'}).nodes.find(n=>n.id==='planner')!.choices![0].options[1].compatibility!.length,3);
 const removed=removeCompatibility(x,'store-choice','warehouse','role:planner');assert.equal(check(removed).verdict,'UNKNOWN');
 // A hand-written record without a citation is refused by the document boundary.
 const raw=clone(d);raw.nodes.find(n=>n.id==='planner')!.choices![0].options[1].compatibility=[{requirementId:'role:planner',verdict:'satisfied',sourceIds:[],blockIds:[],recordedBy:'Julian',recordedAt:'2026-10-17'}];
 assert.throws(()=>validateDocument(raw),/cites at least one project source or evidence block; a name, provider or family is not evidence/);
});

test('compatibility evidence: a removed or reworded requirement is shown ignored and never rebound; a block made synthetic stops counting',()=>{
 const d=fixture(),x=rec(rec(rec(d,'role:planner'),'out:overview-e0'),'assumption:store-choice:0');assert.equal(check(x).verdict,'compatible-per-cited-evidence');
 const noEdge=clone(x);noEdge.views.forEach(v=>v.edgeIds=v.edgeIds.filter(id=>id!=='overview-e0'));const r=check(validateDocument(noEdge));
 assert.equal(r.verdict,'compatible-per-cited-evidence','the remaining requirements are satisfied');assert.deepEqual(r.ignored.map(i=>i.requirementId),['out:overview-e0']);
 assert.match(r.ignored[0].reason,/matches no requirement of this component and is ignored; it is never rebound/);
 const reworded=clone(x);reworded.nodes.find(n=>n.id==='planner')!.choices![0].assumptions=['Ten million rows a day'];const w=check(validateDocument(reworded));
 assert.equal(w.verdict,'UNKNOWN','the edited assumption is not covered by evidence recorded for the old wording');
 assert.match(w.ignored[0].reason,/was recorded for “Keeps the assumption: Under a million rows a day”, which now reads “Keeps the assumption: Ten million rows a day”: ignored, never rebound/);
 const synth=rec(rec(rec(d,'role:planner'),'out:overview-e0',{sourceIds:[],blockIds:['latency-report']}),'assumption:store-choice:0');
 const made=clone(synth);made.blocks.find(b=>b.id==='latency-report')!.provenance='synthetic';const s=check(validateDocument(made));
 assert.equal(s.verdict,'UNKNOWN');assert.ok(s.reasons.some(t=>t.includes('A synthetic evidence block cannot establish out:overview-e0')));
});

test('compatibility evidence: recording it makes a reviewed decision review-needed through the fingerprint',()=>{
 const reviewed=reviewChoice(fixture(),'store-choice',{reviewedBy:'Julian'});assert.equal(choiceReview(reviewed,'store-choice').state,'current');
 const x=rec(reviewed,'role:planner');assert.equal(choiceReview(x,'store-choice').state,'review-needed');
 assert.equal(choiceReview(reviewChoice(x,'store-choice',{reviewedBy:'Julian'}),'store-choice').state,'current');
 const y=reviewChoice(x,'store-choice',{reviewedBy:'Julian'});
 const gone=clone(y);gone.nodes.find(n=>n.id==='planner')!.choices![0].options[1].compatibility![0].verdict='violated';
 assert.equal(choiceReview(validateDocument(gone),'store-choice').state,'review-needed','a changed verdict changes the facts');
 assert.equal(choiceReview(reviewChoice(fixture(),'store-choice',{reviewedBy:'Julian'}),'store-choice').state,'current','an option without evidence keeps its earlier fingerprint');
});

test('compatibility evidence: public output keeps only public citations and drops an entry left with none',()=>{
 const d=fixture(),x=rec(rec(d,'role:planner',{sourceIds:['src-private','src-adr']}),'out:overview-e0',{sourceIds:['src-private']});
 const pub=publicDocument(x),json=JSON.stringify(pub),o=pub.nodes.find(n=>n.id==='planner')!.choices![0].options[1];
 assert.doesNotMatch(json,/src-private|Private vendor benchmark/);
 assert.deepEqual(o.compatibility!.map(e=>[e.requirementId,e.sourceIds]),[['role:planner',['src-adr']]]);
 assert.ok(pub.sources.some(s=>s.id==='src-adr'),'a public source cited by public evidence is published with it');
 const reviewed=reviewChoice(x,'store-choice',{reviewedBy:'Julian'}),pr=publicDocument(reviewed);
 assert.equal(choiceReview(pr,'store-choice').state,'current','a current review reads current in the public copy');
});

const W1={from:'2026-09-01',to:'2026-09-07'},W2={from:'2026-10-01',to:'2026-10-07'};
const els=(svg:string)=>[...walk(parseXml(svg))];
const attr=(svg:string,name:string)=>els(svg).filter(e=>e.attrs[name]!==undefined).map(e=>e.attrs[name]);
const text=(svg:string)=>els(svg).filter(e=>e.name==='text').map(e=>e.text).join(' ');
function comparison(over:{basis?:'measured'|'estimate';provenance?:string;sourceIds?:string[]}={}):Project{
 const m=(role:'baseline'|'current',value:number,basis:'measured'|'estimate'|'derived')=>({label:role,value:String(value),measure:{metric:'p95 latency',value,unit:'ms',scope:'checkout API',window:role==='baseline'?W1:W2,basis,role}});
 return validateDocument({schemaVersion:1,id:'cmp',title:'Comparison',rootViewId:'root',nodes:[{id:'api',label:'Checkout API',kind:'app',blockIds:['m']}],edges:[],views:[{id:'root',title:'Checkout',nodeIds:['api'],edgeIds:[]}],
  sources:[{id:'apm',title:'APM export'}],blocks:[{id:'m',title:'Readings',type:'metrics',provenance:over.provenance??'source-derived',sourceIds:over.sourceIds??['apm'],items:[m('baseline',420,over.basis??'measured'),m('current',380,'measured')]}]});
}
test('comparison figure: "measured difference" only for two measured, non-synthetic, cited readings; otherwise "not a measured saving" with the reason',()=>{
 const NOW=new Date('2026-10-07T09:00:00Z'),svg=(d:Project)=>designSvg(d,'root',{type:'comparison',now:NOW});
 const ok=svg(comparison());assert.deepEqual(attr(ok,'data-dd-measured'),['true']);assert.match(text(ok),/measured difference · windows of 7 days/);assert.doesNotMatch(text(ok),/not a measured saving/);
 const est=svg(comparison({basis:'estimate'}));assert.deepEqual(attr(est,'data-dd-measured'),['false']);
 assert.match(text(est),/not a measured saving · windows of 7 days/);assert.match(text(est),/Not a measured saving · p95 latency \(checkout API\): the baseline is an estimate, not measured/);
 const uncited=svg(comparison({provenance:'author',sourceIds:[]}));assert.deepEqual(attr(uncited,'data-dd-measured'),['false']);assert.match(text(uncited),/the baseline \(Readings\) cites no source/);
 assert.doesNotMatch(text(est)+text(uncited),/sav(ed|ing)s? of|\$|€|faster/i);
});
