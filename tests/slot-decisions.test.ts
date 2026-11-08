import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,documentSchema,validateDocument,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {choiceFingerprint,choiceReview,citedObservations,optionSlotState,reviewChoice} from '../src/core/decisionReview';
import {designSvg} from '../src/export/design';
import {availabilityOf} from '../src/export/design/availability';
import {recommendFigures} from '../src/export/design/recommend';
import {designBookHtml} from '../src/export/design/book';
import {defects} from './helpers/designGeometry';
import {agentSystemsWorkmap} from '../src/data/agentSystemsWorkmap';

// Synthetic fixture: a memory slot with an adopted, a rejected and an under-test candidate, citing three experiment observations.
const NOW=new Date('2026-11-08T09:00:00Z');
const obs=(id:string,over:Record<string,unknown>={})=>({id,nodeId:'memory',sourceApp:'synthetic-lab',authority:'Synthetic lab',observedAt:'2026-11-03T10:00:00Z',sourceRevision:'r1',claim:'observed',summary:`Synthetic result ${id}`,visibility:'public',reviewedAt:'2026-11-04T10:00:00Z',...over});
const doc=(over:(d:Record<string,any>)=>void=()=>{}):Project=>{const raw:Record<string,any>={schemaVersion:1,id:'synthetic-slots',title:'Synthetic slots',revision:3,rootViewId:'root',
 nodes:[{id:'memory',label:'Memory layer',choices:[{id:'memory-slot',title:'Memory layer slot',goal:'Pick the memory layer',status:'accepted',chosenOptionId:'notes',decidedBy:'Synthetic Person',decidedAt:'2026-11-05',
  observationIds:['exp-public','exp-private','exp-unreviewed'],
  options:[{id:'notes',label:'Small notes',summary:'Claims with pointers'},
   {id:'transcripts',label:'Full transcripts',rejection:{reason:'Synthetic: crowds out the task context, a long reason that has to wrap inside its cell without overlapping its neighbours or leaving the canvas.',decidedAt:'2026-11-02',decidedBy:'Synthetic Person'}},
   {id:'index',label:'Derived index',testPlan:'Synthetic: compare retrieval with and without the index on the same questions.'}]}]},{id:'agent',label:'Agent',childViewId:'empty'},{id:'store',label:'Store'}],
 edges:[{id:'e1',source:'agent',target:'memory'}],views:[{id:'root',title:'Root',nodeIds:['memory','agent'],edgeIds:['e1']},{id:'empty',title:'No slot',nodeIds:['store'],edgeIds:[]}],
 observations:[obs('exp-public'),obs('exp-private',{visibility:'private',summary:'SECRET_PRIVATE_RESULT'}),obs('exp-unreviewed',{reviewedAt:undefined,summary:'Unreviewed result'})]};
 over(raw);return validateDocument(documentSchema.parse(raw));};
const slot=(d:Project)=>d.nodes.find(n=>n.id==='memory')!.choices![0];
const refuses=(f:(d:Record<string,any>)=>void,pattern:RegExp)=>assert.throws(()=>doc(f),pattern);

test('slot decisions: old documents load unchanged; refusals for unknown observations, a rejected chosen option and a rejected recommendation',()=>{
 const legacy=agentSystemsWorkmap();assert.deepEqual(validateDocument(clone(legacy)),legacy);
 const d=doc();assert.deepEqual(d.nodes[0].choices![0].options.map(o=>optionSlotState(slot(d),o)),['adopted','rejected','under-test']);
 refuses(r=>{r.nodes[0].choices[0].observationIds.push('nope');},/Unknown.*nope|nope/);
 refuses(r=>{r.nodes[0].choices[0].options[0].rejection={reason:'x',decidedAt:'2026-11-01'};},/chosen option cannot carry a rejection/);
 refuses(r=>{Object.assign(r.nodes[0].choices[0],{status:'candidate',chosenOptionId:undefined,decidedBy:undefined,decidedAt:undefined,recommendedOptionId:'transcripts'});},/rejected option cannot be the recommended option/);
 refuses(r=>{r.nodes[0].choices[0].options[1].rejection.decidedAt='yesterday';},/Use a date/);
 refuses(r=>{r.nodes[0].choices[0].options[2].testPlan='';},/testPlan|least 1|too_small|>=1/i);
 // A candidate is never adopted, even when recommended.
 const candidate=doc(r=>{Object.assign(r.nodes[0].choices[0],{status:'candidate',chosenOptionId:undefined,decidedBy:undefined,decidedAt:undefined,recommendedOptionId:'notes'});});
 assert.equal(optionSlotState(slot(candidate),slot(candidate).options[0]),'candidate');
});

test('slot decisions: cited observations read reviewed or awaiting review; public export keeps only presented ones and leaks no count',()=>{
 const d=doc();assert.deepEqual(citedObservations(d,slot(d)).map(x=>x.state),['reviewed','reviewed','awaiting-review']);
 const p=publicDocument(d);assert.deepEqual(slot(p).observationIds,['exp-public']);assert.equal(slot(p).options[1].rejection!.decidedBy,'Synthetic Person');
 assert.doesNotMatch(JSON.stringify(p),/SECRET_PRIVATE_RESULT|exp-private|exp-unreviewed/);
 // One or five private observations give the same public bytes.
 const five=doc(r=>{for(let i=0;i<4;i++){r.observations.push(obs(`exp-p${i}`,{visibility:'private'}));r.nodes[0].choices[0].observationIds.push(`exp-p${i}`);}});
 assert.equal(JSON.stringify(publicDocument(five)),JSON.stringify(p));
 assert.equal(designSvg(five,'root',{type:'decisions',now:NOW}),designSvg(d,'root',{type:'decisions',now:NOW}));
 // With none presented the list disappears.
 const none=doc(r=>{r.nodes[0].choices[0].observationIds=['exp-private'];});assert.equal('observationIds' in slot(publicDocument(none)),false);
});

test('slot decisions: test plans, rejections and cited observations are in the decision fingerprint',()=>{
 const d=reviewChoice(doc(),'memory-slot',{reviewedBy:'Synthetic Person'});assert.equal(choiceReview(d,'memory-slot').state,'current');
 const changes:((x:Project)=>void)[]=[x=>{slot(x).options[2].testPlan='Another plan';},x=>{slot(x).options[1].rejection!.reason='Another reason';},
  x=>{slot(x).observationIds=['exp-public'];},x=>{x.observations.find(o=>o.id==='exp-unreviewed')!.reviewedAt='2026-11-06T10:00:00Z';},x=>{x.observations[0].summary='Edited result';}];
 for(const change of changes){const x=clone(d);change(x);assert.equal(choiceReview(validateDocument(x),'memory-slot').state,'review-needed');}
 const who=clone(d);slot(who).options[1].rejection!.decidedBy='Someone else';assert.equal(choiceReview(validateDocument(who),'memory-slot').state,'current','who rejected is not a supporting fact');
 // A choice without the new fields keeps its earlier print.
 const plain=doc(r=>{const c=r.nodes[0].choices[0];delete c.observationIds;delete c.options[1].rejection;delete c.options[2].testPlan;});
 const withEmpty=clone(plain);slot(withEmpty).observationIds=[];
 assert.equal(choiceFingerprint(withEmpty,{kind:'node',id:'memory'},slot(withEmpty)),choiceFingerprint(plain,{kind:'node',id:'memory'},slot(plain)));
});

test('slot decisions figure: drawn from public choices, withheld without one, ranked only when available',()=>{
 const d=doc();
 for(const theme of ['light','dark','editorial'] as const){const svg=designSvg(d,'root',{type:'decisions',theme,now:NOW});assert.deepEqual(defects(svg,`decisions/${theme}`).failures,[]);
  assert.match(svg,/data-design-type="decisions"|data-dd-slot="memory-slot"/);}
 const svg=designSvg(d,'root',{type:'decisions',now:NOW});
 assert.deepEqual([...svg.matchAll(/data-dd-option-state="([a-z-]+)"/g)].map(m=>m[1]),['adopted','rejected','under-test']);
 assert.match(svg,/ADOPTED · 2026-11-05/);assert.match(svg,/REJECTED · 2026-11-02/);assert.match(svg,/Test plan: Synthetic/);
 assert.match(svg,/Observed 2026-11-03 · Synthetic result exp-public/);assert.doesNotMatch(svg,/Unreviewed result|SECRET_PRIVATE_RESULT/);
 assert.match(svg,/Decision recorded by Synthetic Person on 2026-11-05; a presentation, not a verification\./);
 const candidate=doc(r=>{Object.assign(r.nodes[0].choices[0],{status:'candidate',chosenOptionId:undefined,decidedBy:undefined,decidedAt:undefined,recommendedOptionId:'notes'});});
 const csvg=designSvg(candidate,'root',{type:'decisions',now:NOW});assert.doesNotMatch(csvg,/data-dd-option-state="adopted"|ADOPTED · 20/);assert.match(csvg,/Recommended, not decided/);assert.match(csvg,/No decision recorded/);
 // Withheld: no public choice on the view or its components.
 const empty=designSvg(d,'empty',{type:'decisions',now:NOW});assert.match(empty,/data-dd-withheld="decisions"/);assert.deepEqual(defects(empty,'decisions withheld').failures,[]);
 assert.deepEqual(availabilityOf(d,'empty','decisions').missing.map(m=>m.input),['Public choices']);
 const priv=doc(r=>{r.nodes[0].choices[0].visibility='private';});assert.match(designSvg(priv,'root',{type:'decisions',now:NOW}),/data-dd-withheld="decisions"/);
 const on=recommendFigures(d,'root').find(x=>x.type==='decisions')!;assert.ok(on.available&&on.score>=50);assert.match(on.reason,/1 public slot with candidates, 1 with a recorded decision/);
 const off=recommendFigures(d,'empty').find(x=>x.type==='decisions')!;assert.ok(!off.available&&off.score<=5);
 assert.ok(designBookHtml(d,{type:'decisions',now:NOW}).includes(svg));
});

test('agent work map: illustrative slots with test plans and one rejection, zero observations, drawn without defects',()=>{
 const d=agentSystemsWorkmap(),slots=d.nodes.flatMap(n=>n.choices??[]);
 assert.equal(d.observations.length,0);assert.deepEqual(slots.map(c=>c.id),['memory-layer-slot','model-per-role-slot']);
 assert.equal(slots.flatMap(c=>c.options).filter(o=>o.rejection).length,1);assert.ok(slots.flatMap(c=>c.options).filter(o=>o.testPlan).length>=3);
 for(const c of slots){assert.equal(c.origin,'author');if(c.status==='accepted')assert.equal(c.decidedBy,'Illustrative author');}
 for(const view of ['memory-design','factory-design']){const svg=designSvg(d,view,{type:'decisions',now:NOW});assert.doesNotMatch(svg,/data-dd-withheld/);assert.deepEqual(defects(svg,view).failures,[]);}
});
