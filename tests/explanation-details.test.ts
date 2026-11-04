import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument,type EvidenceBlock} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {companionContent,companionTabs} from '../src/core/companionPane';
import {EXPLANATION_DETAILS_COLUMNS,explanationDetailsRows,readExplanationDetails} from '../src/core/explanationDetails';
import {prepareExplanationWalkthrough,walkthroughFingerprint} from '../src/intelligence/explanationWalkthrough';
const record=():EvidenceBlock=>({id:'details',title:'Authored explanation details',type:'table',columns:EXPLANATION_DETAILS_COLUMNS,
 rows:explanationDetailsRows({focusQuestion:'What happens to the order?',sourceCut:'synthetic revision 0',caseLabel:'Invalid quantity',prerequisites:['validate · Validate fields'],questions:['Who handles the rejected batch?']}),visibility:'private',sourceIds:[],provenance:'synthetic'});

test('structured explanation is authored evidence, and narrative text is never guessed into a contract',()=>{
 const block=record(),read=readExplanationDetails([block]);assert.equal(read?.state,'available');
 if(read?.state!=='available')throw Error('missing');assert.equal(read.details.caseLabel,'Invalid quantity');assert.deepEqual(read.details.questions,['Who handles the rejected batch?']);assert.equal(read.block.provenance,'synthetic');
 assert.equal(readExplanationDetails([{id:'prose',title:'Contract',type:'text',text:'Question to explore: This is prose, not the structured format.',sourceIds:[],provenance:'author',visibility:'public'}]),null);
});

test('unknown versions, duplicate metadata, and malformed fields are refused without choosing or repairing',()=>{
 const edits=[(b:Extract<EvidenceBlock,{type:'table'}>)=>b.rows[0][1]='diagramcloud.explanation-details/2',
  (b:Extract<EvidenceBlock,{type:'table'}>)=>b.rows.push(['execute','true']),
  (b:Extract<EvidenceBlock,{type:'table'}>)=>b.rows.push(['focus-question','Different question']),
  (b:Extract<EvidenceBlock,{type:'table'}>)=>b.columns=['Wrong','Columns']];
 for(const edit of edits){const block=record();if(block.type!=='table')throw Error('fixture');edit(block);const before=JSON.stringify(block);assert.equal(readExplanationDetails([block])?.state,'unavailable');assert.equal(JSON.stringify(block),before);}
 assert.equal(readExplanationDetails([record(),{...record(),id:'duplicate'}])?.state,'unavailable');
});

test('public projection removes private questions before the companion reads content',()=>{
 const doc=validateDocument({schemaVersion:1,id:'p',title:'P',rootViewId:'root',nodes:[{id:'n',label:'N',blockIds:['details']}],edges:[],views:[{id:'root',title:'Root',nodeIds:['n']}],blocks:[record()]});
 const author=companionContent(doc,'n')!,pub=companionContent(publicDocument(doc),'n')!;
 assert.ok(companionTabs(author).includes('questions'));assert.ok(!companionTabs(pub).includes('questions'));
 assert.doesNotMatch(JSON.stringify(pub),/Invalid quantity|Who handles|synthetic revision/);
});

test('walkthrough preserves exact case, prerequisite and questions as private evidence under ordinary patch guards',()=>{
 const doc=validateDocument({schemaVersion:1,id:'p',title:'P',rootViewId:'root',nodes:[{id:'n',label:'N'}],edges:[],views:[{id:'root',title:'Root',nodeIds:['n']}],tours:[]});
 const step={title:'Validate fields',viewId:'root',nodeIds:['n'],edgeIds:[],narration:'Synthetic example.',sourceIds:[],provenance:'synthetic',dependsOn:[],before:[],after:[],takeaway:'',questions:[]};
 const result=prepareExplanationWalkthrough(doc,{format:'diagramcloud.explanation-walkthrough',version:1,projectId:doc.id,baseRevision:doc.revision,baseFingerprint:walkthroughFingerprint(doc),id:'order',title:'Order example',question:'What happens to an invalid order?',sourceIds:[],steps:[{...step,id:'validate'},{...step,id:'reject',title:'Reject batch',dependsOn:['validate'],caseLabel:'Invalid quantity',questions:['Who handles the rejected batch?'],before:[{name:'quantity',value:'0'}],after:[{name:'outcome',value:'quarantine'}]}]});
 const content=companionContent(result.preview,'walk-order.reject.note')!;assert.equal(content.structure?.state,'available');
 if(content.structure?.state!=='available')throw Error('missing');assert.deepEqual(content.structure.details.prerequisites,['validate · Validate fields']);assert.equal(content.contract.length,2);assert.ok(companionTabs(content).includes('contract'));
 assert.deepEqual(publicDocument(result.preview),publicDocument(doc));assert.equal(doc.nodes.length,1);
});
