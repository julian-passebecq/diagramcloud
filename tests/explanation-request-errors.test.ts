import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {validateDocument} from '../src/core/model';
import {explanationBasis,newExplanationDraft,prepareExplanationDraft} from '../src/intelligence/explanationRequestDraft';
import {EXPLANATION_REVIEW_REFUSED,explanationFieldLabel,explanationRequestMessage} from '../src/intelligence/explanationRequestErrors';
import {CompanionConcepts} from '../src/ui/CompanionPane';

function project(){return validateDocument({schemaVersion:1,id:'compose-demo',revision:7,title:'Synthetic explanation',rootViewId:'root',tours:[],
 nodes:[{id:'caller',label:'Caller'},{id:'api',label:'API'}],edges:[{id:'request',source:'caller',target:'api',label:'Request',kind:'query'}],
 views:[{id:'root',title:'Architecture',nodeIds:['caller','api'],edgeIds:['request']}],sources:[]});}

test('explanation review refusal: one sentence per issue naming the form field; the draft is never filled in',()=>{
 const p=project(),basis=explanationBasis(p),draft=newExplanationDraft(p,'root','caller');
 draft.steps[0].questions=['  '];
 const before=structuredClone(draft);
 let caught:unknown;try{prepareExplanationDraft(p,basis,draft);}catch(e){caught=e;}
 const text=explanationRequestMessage(caught);
 assert.ok(text,'a schema refusal is explained');
 const lines=text!.split('\n');
 assert.equal(lines[0],EXPLANATION_REVIEW_REFUSED);
 for(const line of ['Title is required.','Question to explain is required.','Step 1 title is required.','Step 1 narration is required.','Step 1 question 1 (in Case, prerequisites and questions) is required.'])assert.ok(lines.includes(line),line+' in '+text);
 assert.ok(!/"code"|\[\s*\{/.test(text!),'no raw issue JSON');
 assert.deepEqual(draft,before,'the request is not repaired or trimmed');
});

test('explanation field labels and non-schema errors',()=>{
 assert.equal(explanationFieldLabel(['id']),'Walkthrough ID');
 assert.equal(explanationFieldLabel(['steps',1,'narration']),'Step 2 narration');
 assert.equal(explanationFieldLabel(['steps',0,'before',2,'value']),'Step 1 before state value 3 (in Optional state, code and takeaway)');
 assert.equal(explanationFieldLabel(['steps',0,'code','toLine']),'Step 1 frozen code excerpt last line');
 assert.equal(explanationRequestMessage(new Error('The project changed.')),null,'other refusals are shown as written');
});

test('companion concepts: without onLesson a read-only list, with onLesson each titled concept is a lesson button',()=>{
 const concepts=[{id:'m1',conceptId:'concept-a',title:'Concept A',state:'reviewed',contentRevision:1,staleReasons:[],evidence:[]}] as unknown as Parameters<typeof CompanionConcepts>[0]['concepts'];
 const readOnly=renderToStaticMarkup(createElement(CompanionConcepts,{concepts}));
 assert.ok(!readOnly.includes('<button'),'no lesson button without a host handler');
 assert.match(readOnly,/Read-only list: lessons open from the Learning catalogue\./);
 const linked=renderToStaticMarkup(createElement(CompanionConcepts,{concepts,onLesson:()=>{}}));
 assert.match(linked,/<button type="button" aria-label="Open lesson Concept A">Concept A<\/button>/);
 assert.ok(!linked.includes('Read-only list'));
});
