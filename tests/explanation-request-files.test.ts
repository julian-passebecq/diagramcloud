import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument} from '../src/core/model';
import {walkthroughFingerprint,prepareExplanationWalkthrough} from '../src/intelligence/explanationWalkthrough';
import {parseExplanationRequestFile,readExplanationRequestFile,serializeValidatedExplanationRequest,serializeExplanationRequestDraft,EXPLANATION_REQUEST_FILE_LIMIT} from '../src/intelligence/explanationRequestFiles';
function fixture(){const project=validateDocument({schemaVersion:1,id:'file-request',title:'Synthetic request files',rootViewId:'root',nodes:[{id:'a',label:'Worker',blockIds:['code']},{id:'b',label:'Queue'}],edges:[{id:'edge',source:'a',target:'b'}],views:[{id:'root',title:'Root',nodeIds:['a','b'],edgeIds:['edge']}],blocks:[{id:'code',title:'Code',type:'code',language:'python',code:'validate(record)\nwrite(record)'}],sources:[{id:'doc',title:'Specification'},{id:'step-doc',title:'Step specification'}],tours:[]});
 const step={id:'first',title:'Validate',viewId:'root',nodeIds:['a'],edgeIds:['edge'],narration:'Authored processing.',sourceIds:['step-doc'],provenance:'reference',dependsOn:[],caseLabel:'Invalid record',before:[{name:'record',value:'raw'}],after:[{name:'record',value:'accepted'}],code:{blockId:'code',fromLine:1,toLine:2},takeaway:'Check the schema.',questions:['Which fields are required?']};
 return {project,request:{format:'diagramcloud.explanation-walkthrough',version:1,projectId:project.id,baseRevision:project.revision,baseFingerprint:walkthroughFingerprint(project),id:'file-example',title:'File explanation',question:'What happens?',sourceIds:['doc'],steps:[step,{...step,id:'second',title:'Continue',dependsOn:['first']}]}};
}
test('every request-v1 field roundtrips into existing draft and normal compiler without changing Project',()=>{
 const {project,request}=fixture(),before=JSON.stringify(project);const loaded=parseExplanationRequestFile(JSON.stringify(request),project);assert.equal(loaded.current,true);assert.deepEqual(JSON.parse(serializeValidatedExplanationRequest(loaded.basis,loaded.draft,loaded.source)),request);
 assert.deepEqual(prepareExplanationWalkthrough(project,JSON.parse(serializeValidatedExplanationRequest(loaded.basis,loaded.draft,loaded.source))),prepareExplanationWalkthrough(project,request));assert.equal(JSON.stringify(project),before);assert(Object.isFrozen(loaded.basis));
});
test('stale same-project source bindings remain inspectable and exportable without refresh',()=>{
 const {project,request}=fixture();project.title='New source title';project.revision++;const loaded=parseExplanationRequestFile(JSON.stringify(request),project);assert.equal(loaded.current,false);assert.equal(loaded.basis.fingerprint,request.baseFingerprint);assert.equal(loaded.basis.revision,request.baseRevision);assert.deepEqual(JSON.parse(serializeValidatedExplanationRequest(loaded.basis,loaded.draft,loaded.source)),request);assert.throws(()=>prepareExplanationWalkthrough(project,request),/source changed/);
});
test('unknown fields, versions, wrong projects and incomplete input are refused without accepting a partial draft',()=>{
 const {project,request}=fixture();for(const invalid of [{...request,version:2},{...request,extra:'discard me'},{...request,projectId:'foreign'},{...request,title:''},{...request,steps:[{...request.steps[0],execute:true}]}])assert.throws(()=>parseExplanationRequestFile(JSON.stringify(invalid),project));assert.throws(()=>parseExplanationRequestFile('{',project),/valid request JSON/);assert.throws(()=>parseExplanationRequestFile(JSON.stringify({...request,steps:Array(31).fill(request.steps[0])}),project),/at most 30/);assert.throws(()=>parseExplanationRequestFile(JSON.stringify({...request,steps:[{...request.steps[0],questions:Array(9).fill('Question?')}]}),project),/collection exceeds/);
 const loaded=parseExplanationRequestFile(JSON.stringify(request),project);loaded.draft.title='';assert.equal(JSON.parse(serializeExplanationRequestDraft(loaded.basis,loaded.draft)).title,'');assert.throws(()=>serializeValidatedExplanationRequest(loaded.basis,loaded.draft,loaded.source),/complete/);
});
test('exact references, attachments and prerequisite ordering are validated even for stale requests',()=>{
 const {project,request}=fixture();const changes=[{viewId:'missing'},{nodeIds:['missing']},{edgeIds:['missing']},{sourceIds:['missing']},{dependsOn:['second']},{code:{blockId:'missing',fromLine:1,toLine:2}},{code:{blockId:'code',fromLine:1,toLine:99}},{nodeIds:['b'],edgeIds:[]},{nodeIds:[],edgeIds:[]},{nodeIds:['a','a']}];
 for(const change of changes){const invalid={...request,baseRevision:99,steps:[{...request.steps[0],...change}]};assert.throws(()=>parseExplanationRequestFile(JSON.stringify(invalid),project));}
 assert.throws(()=>parseExplanationRequestFile(JSON.stringify({...request,steps:[request.steps[0],request.steps[0]]}),project),/duplicate step IDs/);
});
test('file budget applies before read and after read, UTF-8 is exact, and read failures are explicit',async()=>{
 const {project,request}=fixture();let reads=0;await assert.rejects(()=>readExplanationRequestFile({size:EXPLANATION_REQUEST_FILE_LIMIT+1,arrayBuffer:async()=>{reads++;return new ArrayBuffer(0);}},project),/4 MiB/);assert.equal(reads,0);
 await assert.rejects(()=>readExplanationRequestFile({size:10,arrayBuffer:async()=>new ArrayBuffer(EXPLANATION_REQUEST_FILE_LIMIT+1)},project),/4 MiB/);
 await assert.rejects(()=>readExplanationRequestFile({size:2,arrayBuffer:async()=>new Uint8Array([0xc3,0x28]).buffer},project),/valid UTF-8/);
 await assert.rejects(()=>readExplanationRequestFile({size:2,arrayBuffer:async()=>{throw Error('read failed');}},project),/could not be read/);
 assert.throws(()=>parseExplanationRequestFile('é'.repeat(EXPLANATION_REQUEST_FILE_LIMIT/2+1),project),/4 MiB/);
 assert.equal((await readExplanationRequestFile(new Blob([JSON.stringify(request)]),project)).current,true);
});
