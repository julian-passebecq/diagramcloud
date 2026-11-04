import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,validateDocument,type Observation,type Project} from '../src/core/model';
import {applyDocumentPatch} from '../src/core/patch';
import {CLAIM_LABEL,observationPatch} from '../src/core/realization';
import {compareView,deltaSvg} from '../src/export/design/delta';
import {defects} from './helpers/designGeometry';

const NOW=new Date('2026-11-04T00:00:00Z');

/** A synthetic test fixture, not a claim about a client or deployed system. The
 * database is already reachable in a child view before it joins the overview. */
function fixture(claim:Observation['claim']='verified'):Project{
 const base=validateDocument({schemaVersion:1,id:'delta-observation-fixture',revision:1,title:'Synthetic comparison fixture',rootViewId:'overview',
  provenance:'Synthetic regression fixture. No real system inspected or verified.',
  nodes:[{id:'app',label:'Application',kind:'app',childViewId:'data'},{id:'db',label:'Database',kind:'storage'}],edges:[],
  views:[{id:'overview',title:'Overview',nodeIds:['app'],edgeIds:[],positions:{app:{x:0,y:0}}},
   {id:'data',title:'Data',nodeIds:['db'],edgeIds:[],positions:{db:{x:0,y:0}}}]});
 const imported=applyDocumentPatch(base,observationPatch(base,{id:'fixture-observation',nodeId:'db',sourceApp:'fixture-runner',authority:'Synthetic regression source',
  observedAt:'2026-11-02T00:00:00Z',sourceRevision:'fixture-cut-1',claim,summary:'Mock source claim for a regression test; no real system tested.'})).result;
 // Stand in for an author's existing review, as the realization export tests do.
 const reviewed=clone(imported);
 Object.assign(reviewed.observations[0],{reviewedAt:'2026-11-03T00:00:00Z',visibility:'public'} satisfies Partial<Observation>);
 return validateDocument({...reviewed,revision:2});
}

function addToOverview(before:Project):Project{
 const after=clone(before),overview=after.views.find(view=>view.id==='overview')!;
 overview.nodeIds.push('db');overview.positions.db={x:300,y:0};after.revision++;
 return validateDocument(after);
}

test('a newly visible component keeps its supplied observation instead of a contradictory UNKNOWN ledger entry',()=>{
 for(const claim of ['observed','verified','partial','not-observed'] as const){
  const before=fixture(claim),after=addToOverview(before),original=JSON.stringify({before,after});
  for(const audience of ['public','author'] as const){
   const delta=compareView(before,after,'overview',NOW,audience);
   assert.equal(delta.components.get('db'),'added','this is a change of view membership');
   assert.deepEqual(delta.evidence.get('db'),{before:'absent',after:'observed',afterClaim:CLAIM_LABEL[claim]});
   const evidence=delta.entries.filter(entry=>entry.id==='db'&&entry.axis==='evidence');
   assert.equal(evidence.length,1);
   assert.equal(evidence[0].change,'OBSERVATION IN VIEW','the ledger must agree with the supplied evidence state');
   assert.ok(evidence[0].text.includes(CLAIM_LABEL[claim]),'retain the exact source claim, including Partial and Not observed');
   assert.ok(!evidence[0].text.includes('no observation'));
  }
  assert.equal(JSON.stringify({before,after}),original,'comparison must not review, create or mutate observations');
 }
});

test('a delta export includes the permitted claim without counting it as an unobserved new component',()=>{
 const before=fixture(),after=addToOverview(before);
 for(const theme of ['light','dark','editorial'] as const){
  const svg=deltaSvg(before,after,'overview',{theme,now:NOW});
  assert.match(svg,/OBSERVATION IN VIEW/);
  assert.match(svg,/Verified/);
  assert.doesNotMatch(svg,/UNKNOWN|new component\(s\) without an observation/);
  assert.deepEqual(defects(svg,`delta-observation/${theme}`).failures,[],'the extra evidence ledger row must fit');
 }
});

test('missing, private, unreviewed and scoped-only claims keep the new component UNKNOWN in general comparison',()=>{
 for(const state of ['missing','private','unreviewed','scoped-only'] as const){
  const before=fixture();
  if(state==='missing')before.observations=[];
  else if(state==='private')before.observations[0].visibility='private';
  else if(state==='unreviewed')delete before.observations[0].reviewedAt;
  else before.observations[0].stateFacet={facet:'verification',value:'fixture-only',scope:'one test'};
  const valid=validateDocument(before),after=addToOverview(valid);
  for(const audience of ['public','author'] as const){
   const delta=compareView(valid,after,'overview',NOW,audience);
   assert.deepEqual(delta.evidence.get('db'),{before:'absent',after:'unknown'},state);
   const evidence=delta.entries.filter(entry=>entry.id==='db'&&entry.axis==='evidence');
   assert.equal(evidence.length,1);assert.equal(evidence[0].change,'UNKNOWN',state);
   assert.doesNotMatch(JSON.stringify(evidence),/Verified|fixture-observation|fixture-cut-1/);
  }
  const svg=deltaSvg(valid,after,'overview',{now:NOW});
  assert.match(svg,/UNKNOWN/);assert.doesNotMatch(svg,/OBSERVATION IN VIEW|Verified|fixture-observation|fixture-cut-1/);
 }
});
