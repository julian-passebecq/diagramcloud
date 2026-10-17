import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,validateDocument,type Choice,type Project} from '../src/core/model';
import {commitHistory,publicDocument,undo,type History} from '../src/core/operations';
import {describeChanges} from '../src/core/changeDetail';
import {acceptChoice,choiceFingerprint,choiceReview,reviewChoice,CHOICE_REVIEW_LABELS} from '../src/core/decisionReview';
import {NOT_PROOF,substitutionCheck} from '../src/intelligence/learning/substitution';
import {contosoForecasting} from '../src/data/contosoForecasting';

const choice=(over:Partial<Choice>={}):Choice=>({id:'store-choice',title:'Where forecasts are stored',goal:'Keep forecasts queryable by the planner',
 options:[{id:'lakehouse',label:'Lakehouse table',summary:''},{id:'warehouse',label:'Warehouse table',summary:''}],recommendedOptionId:'lakehouse',
 reasons:['One copy for both readers'],tradeoffs:['Fewer SQL features'],assumptions:['Under a million rows a day'],revisitWhen:'When a second consumer needs SQL writes',
 status:'candidate',origin:'ai',suggestedBy:'claude',sourceIds:['src-store'],visibility:'public',...over});
const withChoices=(choices:Choice[]):Project=>{const d=clone(contosoForecasting());d.nodes.find(n=>n.id==='planner')!.choices=choices;return validateDocument(d);};
const planner=(d:Project)=>d.nodes.find(n=>n.id==='planner')!;
const edit=(d:Project,f:(d:Project)=>void)=>{const x=clone(d);f(x);return validateDocument(x);};

test('decision review: review-needed is derived from the review basis against current facts, never stored',()=>{
 const d=withChoices([choice()]);
 assert.equal(choiceReview(d,'store-choice').state,'not-reviewed','no basis is UNKNOWN, not current');
 assert.match(choiceReview(d,'store-choice').reasons[0],/UNKNOWN/);
 const reviewed=reviewChoice(d,'store-choice',{reviewedBy:'Julian'}),basis=planner(reviewed).choices![0].reviewBasis!;
 assert.equal(basis.revision,d.revision);assert.match(basis.fingerprint,/^[0-9a-f]{16}$/);
 assert.equal(choiceReview(reviewed,'store-choice').state,'current');assert.deepEqual(choiceReview(reviewed,'store-choice').reasons,[]);
 assert.deepEqual(planner(reviewed).choices![0].status,'candidate','reviewing does not accept');
 // Presentation does not invalidate the review: label, summary, positions and design status.
 const cosmetic=edit(reviewed,x=>{Object.assign(planner(x),{label:'Planner (renamed)',summary:'New words',status:'running'});x.views[0].positions={};});
 assert.equal(choiceReview(cosmetic,'store-choice').state,'current');
 // Supporting facts do: a cited source, the component's evidence, its kind, or the decision's own assumptions.
 const changes:[string,(x:Project)=>void][]=[
  ['cited source location',x=>{x.sources.find(s=>s.id==='src-store')!.location='moved/elsewhere.md';}],
  ['component sources',x=>{planner(x).sourceIds=[...planner(x).sourceIds,'src-adr'];}],
  ['component kind',x=>{planner(x).kind='process';}],
  ['assumption',x=>{planner(x).choices![0].assumptions=['Ten million rows a day'];}],
  ['option label',x=>{planner(x).choices![0].options[1].label='Warehouse (SQL)';}]];
 for(const [what,f] of changes){const r=choiceReview(edit(reviewed,f),'store-choice');assert.equal(r.state,'review-needed',what);assert.equal(r.label,CHOICE_REVIEW_LABELS['review-needed']);assert.match(r.reasons[0],new RegExp(`revision ${d.revision}`));assert.match(r.reasons[1],/never|Nothing is re-bound/);}
 // Reading never writes: the stored document is unchanged after deriving the state.
 const stale=edit(reviewed,changes[0][1]),before=JSON.stringify(stale);choiceReview(stale,'store-choice');assert.equal(JSON.stringify(stale),before);
 assert.ok(!JSON.stringify(stale).includes('review-needed'),'the derived state is not stored');
 // Only an explicit review re-binds it.
 assert.equal(choiceReview(reviewChoice(stale,'store-choice',{reviewedBy:'Julian'}),'store-choice').state,'current');
});

test('decision review: review and acceptance are explicit human actions, one revision each, undone in one step',()=>{
 const d=withChoices([choice()]);
 assert.throws(()=>reviewChoice(d,'store-choice',{reviewedBy:'  '}),/records who did it/);
 for(const who of ['claude','Claude',' CLAUDE '])assert.throws(()=>reviewChoice(d,'store-choice',{reviewedBy:who}),/cannot review itself/,who);
 assert.throws(()=>acceptChoice(d,'store-choice','lakehouse',{decidedBy:'claude',decidedAt:'2026-10-17'}),/cannot accept itself/);
 assert.throws(()=>acceptChoice(d,'store-choice','cosmos',{decidedBy:'Julian',decidedAt:'2026-10-17'}),/Unknown option cosmos/);
 assert.throws(()=>acceptChoice(d,'store-choice','lakehouse',{decidedBy:'Julian',decidedAt:'yesterday'}),/Use a date/);
 assert.throws(()=>reviewChoice(d,'nope',{reviewedBy:'Julian'}),/Unknown choice nope/);
 const h:History={past:[],present:d,future:[]};
 const accepted=commitHistory(h,acceptChoice(d,'store-choice','warehouse',{decidedBy:'Julian',decidedAt:'2026-10-17'}));
 const c=planner(accepted.present).choices![0];
 assert.deepEqual([c.status,c.chosenOptionId,c.decidedBy,c.decidedAt,c.suggestedBy],['accepted','warehouse','Julian','2026-10-17','claude']);
 assert.equal(accepted.present.revision,d.revision+1);assert.equal(choiceReview(accepted.present,'store-choice').state,'current','accepting reviews against the facts it was decided on');
 assert.deepEqual(undo(accepted).present,d,'one Undo restores the candidate');
 // An accepted decision is never rewritten by the accept action.
 assert.throws(()=>acceptChoice(accepted.present,'store-choice','lakehouse',{decidedBy:'Someone',decidedAt:'2026-10-18'}),/already an accepted decision.*not rewritten silently/);
 // Re-reviewing an accepted decision keeps who decided and when.
 const rereviewed=planner(reviewChoice(edit(accepted.present,x=>{x.sources.find(s=>s.id==='src-store')!.title='Store ADR v2';}),'store-choice',{reviewedBy:'Ana'})).choices![0];
 assert.deepEqual([rereviewed.decidedBy,rereviewed.decidedAt,rereviewed.chosenOptionId],['Julian','2026-10-17','warehouse']);
});

test('decision review: public copies re-bind a current review to public facts and drop any other basis',()=>{
 const d=edit(withChoices([choice({sourceIds:[]}),choice({id:'second-choice',sourceIds:[]})]),x=>{x.sources.push({id:'src-secret',title:'Secret memo',location:'private/memo.md',visibility:'private'});planner(x).sourceIds.push('src-secret');});
 const reviewed=reviewChoice(reviewChoice(d,'store-choice',{reviewedBy:'Julian'}),'second-choice',{reviewedBy:'Julian'});
 const stale=edit(reviewed,x=>{planner(x).choices![1].assumptions=['Changed after review'];});
 assert.deepEqual(['store-choice','second-choice'].map(id=>choiceReview(stale,id).state),['current','review-needed']);
 const pub=publicDocument(stale);
 assert.equal(choiceReview(pub,'store-choice').state,'current','a current review stays current although private evidence was removed');
 assert.equal(choiceReview(pub,'second-choice').state,'not-reviewed','a stale basis is dropped, not published');
 assert.ok(!JSON.stringify(pub).includes('Secret memo'));
 assert.deepEqual(publicDocument(pub),pub,'projection is idempotent');
 assert.notEqual(choiceFingerprint(pub,{kind:'node',id:'planner'},planner(pub).choices![0]),planner(stale).choices![0].reviewBasis!.fingerprint,'the public basis is bound to public facts');
});

test('decision review: an incoming review basis is the author’s to record, so imports are cautioned',()=>{
 const d=withChoices([choice()]),self=reviewChoice(d,'store-choice',{reviewedBy:'Julian'});
 const cautions=describeChanges(d,self).cautions;
 assert.ok(cautions.some(c=>c.startsWith('Choice “Where forecasts are stored” arrives with a review basis')&&c.includes('Review it yourself in Edit mode')),cautions.join('\n'));
 assert.ok(!describeChanges(self,self).cautions.some(c=>c.includes('review basis')),'an unchanged basis is not cautioned');
});

test('substitution check: UNKNOWN without compatibility evidence; a matching name, provider or family is not proof',()=>{
 const d=withChoices([choice()]);
 const r=substitutionCheck(d,'planner',{label:'Warehouse table',provider:'Generic',family:'storage',choiceId:'store-choice',optionId:'warehouse'});
 assert.equal(r.verdict,'UNKNOWN');assert.match(r.label,/UNKNOWN/);
 assert.deepEqual(r.requirements.map(x=>x.id),['role:planner','out:overview-e0','assumption:store-choice:0']);
 assert.ok(r.requirements.every(x=>x.state==='UNKNOWN'));
 assert.ok(r.notProof.includes(NOT_PROOF)&&r.notProof.some(x=>x.startsWith('Same provider'))&&r.notProof.some(x=>x.startsWith('Same catalogue family')));
 const named=substitutionCheck(d,'planner',{label:planner(d).label});assert.equal(named.verdict,'UNKNOWN','the same name is never proof');assert.ok(named.notProof.some(x=>x.includes('not evidence')));
 // Evidence without a resolvable, non-synthetic citation does not count.
 const synthetic=edit(d,x=>{x.blocks.push({id:'syn',title:'Synthetic',type:'text',text:'Illustration',provenance:'synthetic',sourceIds:[],visibility:'public'});});
 const weak=substitutionCheck(synthetic,'planner',{label:'Warehouse table'},[{requirementId:'role:planner',verdict:'satisfied'},{requirementId:'out:overview-e0',verdict:'satisfied',blockIds:['syn']},{requirementId:'assumption:x',verdict:'satisfied',sourceIds:['src-store']}]);
 assert.equal(weak.verdict,'UNKNOWN');assert.ok(weak.reasons.some(x=>x.includes('cites no project source'))&&weak.reasons.some(x=>x.includes('synthetic evidence block'))&&weak.reasons.some(x=>x.includes('matches no requirement')));
 // Cited evidence can settle it either way, and a violation wins.
 const all=[{requirementId:'role:planner',verdict:'satisfied' as const,sourceIds:['src-store']},{requirementId:'out:overview-e0',verdict:'satisfied' as const,sourceIds:['src-ui']}];
 const ok=substitutionCheck(d,'planner',{label:'Warehouse table'},all);assert.equal(ok.verdict,'compatible-per-cited-evidence');assert.match(ok.label,/not a verification/);
 assert.equal(substitutionCheck(d,'planner',{label:'Warehouse table'},[...all,{requirementId:'role:planner',verdict:'violated',sourceIds:['src-adr']}]).verdict,'not-substitutable','a cited violation wins over a satisfaction');
 assert.equal(substitutionCheck(d,'planner',{label:'Warehouse table'},[{requirementId:'out:overview-e0',verdict:'violated',sourceIds:['src-ui']}]).verdict,'not-substitutable');
 assert.equal(substitutionCheck(d,'missing',{label:'x'}).verdict,'unavailable');
 const before=JSON.stringify(d);substitutionCheck(d,'planner',{label:'Warehouse table'},all);assert.equal(JSON.stringify(d),before,'a check records nothing');
});
