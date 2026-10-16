import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema,validateDocument,type Project} from '../src/core/model';
import {prepareViewer,viewerSelectionIntent,viewerSourceIntent,viewerContextText,liveViewerBoundary,VIEWER_UNAVAILABLE,type ViewerInput,type ViewerReady} from '../src/react/viewerBoundary';
import {completionRequestSchema,COMPLETION_LIMITS} from '../src/intelligence/completionKit';

function fixture():Project{return validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-viewer',revision:7,title:'UNRELATED_GLOBAL_TITLE',summary:'UNRELATED_GLOBAL_SUMMARY',rootViewId:'home',
 nodes:[{id:'a',label:'Input',childViewId:'child',sourceIds:['selected-source'],blockIds:['selected-block'],basis:'planned'},{id:'b',label:'Output',childViewId:'hidden',summary:'PRIVATE_CAPTION',sourceIds:['private-source']},{id:'code',label:'Child implementation'},{id:'outside-node',label:'UNRELATED_PUBLIC_LABEL',sourceIds:['outside-source']},{id:'secret',label:'PRIVATE_NODE',visibility:'private'},{id:'root-entry',label:'UNRELATED_ROOT_PARENT',childViewId:'root'},{id:'outside-entry',label:'UNRELATED_OUTSIDE_PARENT',childViewId:'outside'}],
 edges:[{id:'inside-edge',source:'a',target:'b',basis:'planned'},{id:'other-membership-edge',source:'a',target:'b',label:'UNRELATED_EDGE'}],
 views:[{id:'root',title:'Permitted root',nodeIds:['a','b','secret'],edgeIds:['inside-edge']},{id:'child',title:'Permitted child',nodeIds:['code']},{id:'outside',title:'UNRELATED_VIEW',nodeIds:['outside-node','a','b'],edgeIds:['other-membership-edge']},{id:'home',title:'UNRELATED_HOME_VIEW',nodeIds:['root-entry','outside-entry']},{id:'hidden',title:'UNRELATED_HIDDEN_CHILD',nodeIds:['outside-node']}],
 sources:[{id:'selected-source',title:'Selected synthetic source',location:'Selected author locator'},{id:'private-source',title:'PRIVATE_SOURCE',visibility:'private'},{id:'outside-source',title:'UNRELATED_SOURCE'}],
 blocks:[{id:'selected-block',title:'Synthetic example',type:'text',text:'Illustrative local context, no execution.',sourceIds:['selected-source'],provenance:'synthetic'},{id:'analysis-context-0',title:'PRIVATE_RECEIPT',type:'code',language:'json',code:'PRIVATE_RECEIPT_CONTENT',visibility:'private'}]}));}
function input(document:unknown=fixture(),extra:Partial<ViewerInput>={}):ViewerInput{return {document,apiVersion:1,allowedViewIds:['root','child'],selection:{projectId:'synthetic-viewer',baseRevision:7,viewId:'root',nodeId:'a'},...extra};}
function ready(value:ViewerInput):ViewerReady{const result=prepareViewer(value);assert.equal(result.state,'ready');if(result.state!=='ready')throw new Error('Expected ready');return result;}

test('public and explicit view closure precedes rendering/context; ungranted navigation labels and global metadata are removed',()=>{
 const document=fixture(),before=JSON.stringify(document),live=input(document),result=ready(live),projection=JSON.stringify(result.project),context=viewerContextText(result,live)!;
 for(const forbidden of ['PRIVATE_','UNRELATED_','analysis-context-0','outside-node','outside-source','other-membership-edge','experienceWorkspaceId']){assert.ok(!projection.includes(forbidden),forbidden);assert.ok(!context.includes(forbidden),forbidden);}
 assert.equal(result.project.nodes.find(n=>n.id==='b')?.childViewId,undefined);assert.equal(result.project.nodes.find(n=>n.id==='b')?.summary,'');assert.equal(result.project.nodes.find(n=>n.id==='a')?.childViewId,'child');
 const parsed=completionRequestSchema.parse(JSON.parse(context));assert.equal(parsed.format,'diagramcloud.selected-context/1');assert.equal(parsed.completion.audience,'public');assert.deepEqual(parsed.components.map(n=>n.id),['a']);assert.deepEqual(parsed.connections,[]);assert.equal(parsed.completion.omissions.boundaryConnections,1);assert.deepEqual(parsed.sources.map(s=>s.id),['selected-source']);
 for(const field of ['readiness','atlas','project'])assert.ok(!(field in parsed));assert.equal(JSON.stringify(document),before);assert.deepEqual(document.observations,[]);
});

test('scope, project, revision and exact node/edge membership refuse generically instead of broadening to whole project',()=>{
 const document=fixture();
 const invalid=[{...input(document),command:'workbench.action.openSettings'},input(document,{apiVersion:2}),input(document,{allowedViewIds:[]}),input(document,{allowedViewIds:['root','root']}),input(document,{allowedViewIds:['private-view']}),...[
  {projectId:'other'},{baseRevision:6},{viewId:'outside'},{nodeId:'secret'},{nodeId:'code'},{nodeId:undefined,edgeId:'other-membership-edge'},{edgeId:'inside-edge'},{command:'workbench.action.openSettings'},{uri:'file:///PRIVATE_PATH'}
 ].map(change=>input(document,{selection:{projectId:'synthetic-viewer',baseRevision:7,viewId:'root',nodeId:'a',...change} as ViewerInput['selection']}))];
 for(const live of invalid)assert.deepEqual(prepareViewer(live),{state:'unavailable',message:VIEWER_UNAVAILABLE});
 const malformed=fixture();malformed.nodes[0].sourceIds=['PRIVATE_UNKNOWN_REFERENCE'];assert.deepEqual(prepareViewer(input(malformed)),{state:'unavailable',message:VIEWER_UNAVAILABLE});
});

test('permitted parent retention is exact; a child-only grant never reveals an ungranted ancestor',()=>{
 const document=fixture(),selection={projectId:document.id,baseRevision:7,viewId:'child'};
 assert.deepEqual(ready(input(document,{selection})).path,['root','child']);const childInput=input(document,{selection,allowedViewIds:['child']}),narrowed=ready(childInput);assert.deepEqual(narrowed.path,['child']);assert.equal(narrowed.project.rootViewId,'child');assert.deepEqual(narrowed.project.nodes.map(n=>n.id),['code']);assert.ok(!JSON.stringify(narrowed.context).includes('Input'));assert.equal(completionRequestSchema.parse(JSON.parse(viewerContextText(narrowed,childInput)!)).scope,'selected-view');
});

test('a granted authored root stays visible when another permitted ancestor has a longer shared-child path',()=>{
 const document=fixture(),template=document.nodes.find(n=>n.id==='code')!,viewTemplate=document.views.find(v=>v.id==='child')!;
 document.nodes.push({...template,id:'chain-entry',label:'Synthetic alternate branch',childViewId:'middle-one'},{...template,id:'middle-a',label:'Synthetic middle A',childViewId:'middle-two'},{...template,id:'middle-b',label:'Synthetic middle B',childViewId:'middle-three'},{...template,id:'middle-c',label:'Synthetic middle C',childViewId:'child'});
 document.views.find(v=>v.id==='outside')!.nodeIds.push('chain-entry');
 document.views.push({...viewTemplate,id:'middle-one',nodeIds:['middle-a']},{...viewTemplate,id:'middle-two',nodeIds:['middle-b']},{...viewTemplate,id:'middle-three',nodeIds:['middle-c']});validateDocument(document);
 const before=JSON.stringify(document),result=ready(input(document,{allowedViewIds:['home','root','child','outside','middle-one','middle-two','middle-three'],selection:{projectId:document.id,baseRevision:7,viewId:'child'}}));
 assert.deepEqual(result.path,['home','root','child']);assert.equal(result.project.rootViewId,'home');assert.equal(JSON.stringify(document),before);
});

test('a granted descendant separated by an ungranted parent stays independent and its existing request is view-scoped',()=>{
 const document=fixture();document.nodes.find(n=>n.id==='code')!.childViewId='deep';document.nodes.push({...document.nodes.find(n=>n.id==='code')!,id:'leaf',label:'Deep selected leaf',childViewId:undefined});document.views.push({...document.views.find(v=>v.id==='child')!,id:'deep',title:'Deep selected view',nodeIds:['leaf']});validateDocument(document);
 const live=input(document,{allowedViewIds:['root','deep'],selection:{projectId:document.id,baseRevision:7,viewId:'deep'}}),result=ready(live);assert.deepEqual(result.path,['deep']);const request=completionRequestSchema.parse(JSON.parse(viewerContextText(result,live)!));assert.deepEqual(request.components.map(n=>n.id),['leaf']);assert.equal(request.scope,'selected-view');assert.equal(request.selection.viewId,'deep');assert.ok(!JSON.stringify(request).includes('Input'));
});

test('private receipt, caption and atlas differences do not change permitted public rendering or file output',()=>{
 const original=fixture(),variant=structuredClone(original);variant.nodes.find(n=>n.id==='b')!.summary='ANOTHER_PRIVATE_CAPTION';variant.sources.find(s=>s.id==='private-source')!.location='ANOTHER_PRIVATE_SOURCE_LOCATOR';
 variant.blocks.find(b=>b.id==='analysis-context-0'&&b.type==='code')!.title='ANOTHER_PRIVATE_RECEIPT';
 variant.atlas={activeSnapshotId:'private-snapshot',snapshots:[{id:'private-snapshot',capturedAt:'2026-10-15T12:00:00Z',repositories:[{id:'private-repository',title:'PRIVATE_ATLAS_TITLE',host:'local',locator:'PRIVATE_ATLAS_LOCATOR',scanStatus:'not-scanned',authority:'author',visibility:'private',nodeId:'secret'}],runtimeRefs:[],contextRefs:[]}]};
 validateDocument(variant);const a=input(original),b=input(variant),readyA=ready(a),readyB=ready(b);assert.deepEqual(readyA.project,readyB.project);assert.equal(viewerContextText(readyA,a),viewerContextText(readyB,b));assert.deepEqual(viewerSourceIntent(readyA,a,'selected-source'),viewerSourceIntent(readyB,b,'selected-source'));
});

test('selection and source intents contain only bound stable IDs, never locators, commands or sources from other scope',()=>{
 const live=input(),captured=ready(live),before=JSON.stringify(live.document),target={projectId:'synthetic-viewer',baseRevision:7,viewId:'root',nodeId:'b'};
 assert.deepEqual(viewerSelectionIntent(captured,live,target),target);assert.equal(viewerSelectionIntent(captured,live,{...target,url:'https://example.invalid/action'}),undefined);
 assert.equal(viewerSelectionIntent(captured,live,{...target,nodeId:'code'}),undefined);assert.equal(viewerSelectionIntent(captured,live,{...target,viewId:'outside'}),undefined);
 assert.deepEqual(viewerSourceIntent(captured,live,'selected-source'),{...live.selection,sourceId:'selected-source'});
 for(const source of ['outside-source','private-source','file:///PRIVATE_PATH','vscode:workbench.action.openSettings','missing'])assert.equal(viewerSourceIntent(captured,live,source),undefined);
 assert.equal(JSON.stringify(live.document),before);
});

test('stale input identity, revision, selected scope and in-place public changes cannot reuse a captured action',()=>{
 const document=fixture(),live=input(document),captured=ready(live),intent={...live.selection,nodeId:'b'};
 const changedRevision=structuredClone(document);changedRevision.revision++;
 for(const next of [input(structuredClone(document)),input(changedRevision,{selection:{...live.selection,baseRevision:8}}),input(document,{allowedViewIds:['root']}),input(document,{selection:{...live.selection,nodeId:'b'}})]){
  assert.equal(liveViewerBoundary(captured,next),undefined);assert.equal(viewerSelectionIntent(captured,next,intent),undefined);assert.equal(viewerSourceIntent(captured,next,'selected-source'),undefined);assert.equal(viewerContextText(captured,next),undefined);
 }
 // A new clone is valid current input at the same revision; the old binding cannot deliver into it.
 const clone=structuredClone(document),next=input(clone);assert.equal(ready(next).selection.baseRevision,7);assert.equal(viewerSelectionIntent(ready(next),next,intent)?.nodeId,'b');
 document.nodes[0].summary='Changed without revision';assert.equal(viewerSelectionIntent(captured,live,intent),undefined);
});

test('context is selected closure for edges and views, while a returned-object edit cannot mutate canonical facts',()=>{
 const document=fixture(),before=JSON.stringify(document),live=input(document,{selection:{projectId:document.id,baseRevision:7,viewId:'root',edgeId:'inside-edge'}}),result=ready(live),context=result.context;
 assert.equal(context.scope,'selected-connection');assert.deepEqual(context.components.map((n:{id:string})=>n.id),['a','b']);assert.deepEqual(context.connections.map((e:{id:string})=>e.id),['inside-edge']);
 assert.equal(viewerContextText(result,live),undefined);result.project.nodes[0].label='Caller modified projection';result.context.sources[0].location='Caller modified context';assert.equal(JSON.stringify(document),before);assert.ok(!JSON.stringify(ready(live).context).includes('Caller modified'));
});

test('file fallback preserves existing schema, byte limits, exact selected omissions and secret guards',()=>{
 const document=fixture();document.blocks[0].type==='text'&&(document.blocks[0].text='A'.repeat(50000));
 for(let i=0;i<22;i++){const block={...document.blocks[0],id:'large-'+i};document.blocks.push(block);document.nodes[0].blockIds.push(block.id);}
 validateDocument(document);const live=input(document),result=ready(live),text=viewerContextText(result,live)!;assert.ok(new TextEncoder().encode(text).byteLength<=COMPLETION_LIMITS.bytes);const request=completionRequestSchema.parse(JSON.parse(text));assert.equal(request.completion.omissions.evidence,23-request.evidence.length);assert.ok(request.completion.omissions.evidence>0);assert.equal(viewerSourceIntent(result,live,'outside-source'),undefined);
 const unsafe=fixture();unsafe.nodes[0].summary='password: SYNTHETIC_SAFETY_REFUSAL_ONLY';const unsafeInput=input(unsafe);assert.equal(viewerContextText(ready(unsafeInput),unsafeInput),undefined);
});
