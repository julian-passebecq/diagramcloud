import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema,validateDocument,type Project} from '../src/core/model';
import {observationPatch} from '../src/core/realization';
import {applyDocumentPatch,type Operation} from '../src/core/patch';
import {COMPLETION_LIMITS,completionRequestSchema,createCompletionRequest,completionPatchTemplate,previewCompletionPatch,type CompletionRequest, type CompletionRequestOptions} from '../src/intelligence/completionKit';

function seed():Project{return validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-completion',revision:7,title:'Synthetic completion fixture',rootViewId:'root',
 nodes:[{id:'selected',label:'Selected component',summary:'Original caption',role:'Original contribution',basis:'unknown',sourceIds:['source-a'],blockIds:['author-text','source-code']},{id:'other',label:'Unrelated component',summary:'UNRELATED_CAPTION',sourceIds:['source-other']}],
 edges:[{id:'boundary',source:'selected',target:'other',label:'Declared dependency',basis:'planned'}],views:[{id:'root',title:'Synthetic view',nodeIds:['selected','other'],edgeIds:['boundary'],positions:{selected:{x:80,y:100},other:{x:400,y:100}}},{id:'other-view',title:'Other view',nodeIds:['other']}],
 sources:[{id:'source-a',title:'Supplied source',location:'supplied.md:2 @ source-reference-1'},{id:'source-other',title:'UNRELATED_SOURCE',location:'unrelated.md:99'}],
 blocks:[{id:'author-text',type:'text',title:'Authored explanation',text:'Original authored explanation',provenance:'author',sourceIds:['source-a']},{id:'source-code',type:'code',language:'text',title:'Selected source example',code:'inert example only',provenance:'source-derived',sourceIds:['source-a']}]}));}
const options=(over:Partial<CompletionRequestOptions>={}):CompletionRequestOptions=>({requestId:'qa-completion-1',question:'Clarify supplied captions; do not infer new facts.',audience:'author',selection:{nodeId:'selected',viewId:'root'},...over});
const candidate=(request:CompletionRequest,operations:Operation[])=>({...completionPatchTemplate(request),summary:'Provenance: author candidate; Sources: source-a; Limits: Wording suggestion only; runtime remains unknown.',operations});

test('selected request closes supplied references and omits unrelated and boundary context',()=>{
 const p=seed(),before=JSON.stringify(p),r=createCompletionRequest(p,options());
 assert.equal(r.format,'diagramcloud.selected-context/1');assert.equal(r.scope,'selected-component');assert.deepEqual(r.selection,{nodeId:'selected',viewId:'root'});
 assert.deepEqual(r.components.map(n=>n.id),['selected']);assert.deepEqual(r.sources.map(s=>s.id),['source-a']);assert.deepEqual(r.completion.sourceRefs,[{sourceId:'source-a',location:'supplied.md:2 @ source-reference-1'}]);
 assert.deepEqual(r.connections,[]);assert.equal(r.completion.omissions.boundaryConnections,1);
 assert(!JSON.stringify(r).includes('UNRELATED_'));assert(!Object.hasOwn(r,'readiness'));assert(!Object.hasOwn(r,'assets'));
 assert(r.completion.allowedPaths.includes('/nodes/@selected/summary'));assert(r.completion.allowedPaths.includes('/blocks/@author-text/text'));assert(!r.completion.allowedPaths.some(path=>path.includes('source-code')));
 assert.equal(JSON.stringify(p),before);assert.deepEqual(completionRequestSchema.parse(JSON.parse(JSON.stringify(r))),r);
});

test('explicit unknown or inconsistent selection never broadens to the whole Project',()=>{
 const p=seed(),before=JSON.stringify(p);
 for(const selection of [{},{nodeId:'missing'},{viewId:'missing'},{nodeId:'selected',viewId:'other-view'}])assert.throws(()=>createCompletionRequest(p,options({selection})));
 assert.throws(()=>createCompletionRequest(p,options({question:'  '})));
 assert.throws(()=>createCompletionRequest(p,{...options(),audience:'grant-all'} as unknown as CompletionRequestOptions));
 assert.equal(JSON.stringify(p),before);
});

test('explicit view membership bounds connections and boundary omission counts',()=>{
 const p=seed();p.views.push({id:'same-nodes',title:'Same nodes, no supplied links',description:'No link in this selected view',nodeIds:['selected','other'],edgeIds:[],positions:{},visibility:'public'});
 const viewRequest=createCompletionRequest(p,options({selection:{viewId:'same-nodes'}}));assert.deepEqual(viewRequest.connections,[]);assert.equal(viewRequest.completion.omissions.connections,0);assert.equal(viewRequest.completion.omissions.boundaryConnections,0);
 const nodeRequest=createCompletionRequest(p,options({selection:{nodeId:'selected',viewId:'same-nodes'}}));assert.equal(nodeRequest.completion.omissions.boundaryConnections,0);
 const rootRequest=createCompletionRequest(p,options({selection:{viewId:'root'}}));assert.deepEqual(rootRequest.connections.map(e=>e.id),['boundary']);
 const roundTrip=JSON.parse(JSON.stringify(rootRequest)) as CompletionRequest;
 assert.deepEqual(previewCompletionPatch(p,roundTrip,completionPatchTemplate(roundTrip)).result,p,'optional absent fields survive context file serialization');
});

test('candidate captions and eligible author text stage on a copy with stable annotations and source facts',()=>{
 const p=seed(),before=structuredClone(p),r=createCompletionRequest(p,options()),patch=candidate(r,[{op:'test',path:'/nodes/@selected/summary',value:'Original caption'},{op:'replace',path:'/nodes/@selected/summary',value:'Candidate clarification of supplied caption'},{op:'replace',path:'/blocks/@author-text/text',value:'Candidate explanation; runtime remains unknown.'}]);
 const out=previewCompletionPatch(p,r,JSON.stringify(patch));
 assert.equal(out.result.nodes[0].summary,'Candidate clarification of supplied caption');assert.equal(out.result.blocks[0].type==='text'&&out.result.blocks[0].text,'Candidate explanation; runtime remains unknown.');
 assert.deepEqual(out.result.nodes[1],before.nodes[1]);assert.equal(out.result.nodes[0].role,before.nodes[0].role);assert.deepEqual(out.result.views,before.views);assert.deepEqual(out.result.edges,before.edges);assert.deepEqual(out.result.sources,before.sources);assert.deepEqual(out.result.observations,before.observations);assert.equal(out.result.revision,7);assert.deepEqual(p,before);
 assert.deepEqual(previewCompletionPatch(p,r,patch),out,'repeated preview has no effect');
 const committed=validateDocument({...out.result,revision:p.revision+1});assert.throws(()=>previewCompletionPatch(committed,r,patch),/Stale/);assert.deepEqual(p,before);
});

test('test-only template abstains without a revision, canonical mutation or review decision',()=>{
 const p=seed(),r=createCompletionRequest(p,options()),template=completionPatchTemplate(r),before=JSON.stringify(p);
 assert.deepEqual(template.operations,[{op:'test',path:'/revision',value:7}]);assert.equal(template.format,'diagramcloud.patch');
 assert.deepEqual(previewCompletionPatch(p,r,template).result,p);assert.equal(JSON.stringify(p),before);assert(!Object.hasOwn(template,'approved'));assert(!Object.hasOwn(template,'grant'));
});

test('captured request refuses stale sources, source closure changes, spoofed allowlists and wrong project',()=>{
 const p=seed(),r=createCompletionRequest(p,options()),patch=candidate(r,[{op:'replace',path:'/nodes/@selected/role',value:'Candidate role wording'}]),before=JSON.stringify(p);
 const changed=structuredClone(p);changed.sources[0].location='supplied.md:2 @ changed-source';assert.throws(()=>previewCompletionPatch(changed,r,patch),/sources or context changed/);
 const detached=structuredClone(p);detached.nodes[0].sourceIds=[];detached.blocks[0].sourceIds=[];detached.blocks[1].sourceIds=[];assert.throws(()=>previewCompletionPatch(detached,r,patch),/sources or context changed/);
 const forged=structuredClone(r);forged.completion.allowedPaths.push('/nodes/@other/summary');assert.throws(()=>previewCompletionPatch(p,forged,patch),/scope, sources or context changed/);
 assert.throws(()=>previewCompletionPatch({...p,id:'different'},r,patch),/different project/);
 assert.throws(()=>previewCompletionPatch(p,r,{...patch,targetId:'different'}),/patch is for/);
 assert.throws(()=>previewCompletionPatch(p,r,{...patch,baseRevision:6}),/Stale patch/);
 assert.equal(JSON.stringify(p),before);
});

test('strict patch policy rejects structure, review, source, status, aliases, unknown values and false provenance',()=>{
 const p=seed(),before=JSON.stringify(p),r=createCompletionRequest(p,options());
 const bad:Operation[]=[
  {op:'replace',path:'/nodes/@other/summary',value:'escape'}, {op:'replace',path:'/nodes/0/summary',value:'alias'},
  {op:'replace',path:'/nodes/@selected/status',value:'complete'}, {op:'replace',path:'/nodes/@selected/sourceIds',value:['source-other']},
  {op:'replace',path:'/nodes/@selected/visibility',value:'public'}, {op:'replace',path:'/observations',value:[]},
  {op:'replace',path:'/nodes',value:[]}, {op:'add',path:'/blocks/-',value:{}}, {op:'remove',path:'/nodes/@selected/role'},
  {op:'copy',from:'/nodes/@other/summary',path:'/nodes/@selected/summary'}, {op:'move',from:'/nodes/@other/summary',path:'/nodes/@selected/summary'},
  {op:'replace',path:'/nodes/@selected/summary~1role',value:'alias'}, {op:'replace',path:'/__proto__/polluted',value:'bad'},
  {op:'replace',path:'/nodes/@selected/summary',value:{approved:true}}, {op:'replace',path:'/blocks/@source-code/code',value:'changed source'}
 ];
 for(const operation of bad)assert.throws(()=>previewCompletionPatch(p,r,candidate(r,[operation])),JSON.stringify(operation));
 const normal=candidate(r,[{op:'replace',path:'/nodes/@selected/summary',value:'Candidate wording'}]);
 for(const summary of ['A candidate','Provenance: verified; Sources: source-a; Limits: none','Provenance: author candidate; Sources: source-other; Limits: source not supplied','Provenance: author candidate; Sources: missing-source; Limits: missing source','Provenance: author candidate; Sources: source-a; Limits:   '])assert.throws(()=>previewCompletionPatch(p,r,{...normal,summary}));
 assert.throws(()=>previewCompletionPatch(p,r,{...normal,grant:'edit'}));assert.throws(()=>previewCompletionPatch(p,r,{...normal,operations:[{op:'replace',path:'/nodes/@selected/summary',value:'Text',approved:true}]}));
 assert.throws(()=>previewCompletionPatch(p,r,candidate(r,[{op:'replace',path:'/nodes/@selected/summary',value:'password=PRIVATE_REFUSED_VALUE'}])),/credential/);
 assert.equal(JSON.stringify(p),before);
});

test('shared or externally cited author blocks are read-only; public completion permits captions only',()=>{
 const p=seed();p.nodes[1].blockIds.push('author-text');const r=createCompletionRequest(p,options());assert(!r.completion.allowedPaths.includes('/blocks/@author-text/text'));
 const patch=candidate(r,[{op:'replace',path:'/blocks/@author-text/text',value:'Would affect unrelated component'}]);assert.throws(()=>previewCompletionPatch(p,r,patch));
 const plain=seed(),pub=createCompletionRequest(plain,options({audience:'public'}));assert(!pub.completion.allowedPaths.some(path=>path.startsWith('/blocks/')));
 const backed=applyDocumentPatch(plain,observationPatch(plain,{id:'external',nodeId:'selected',sourceApp:'qa-owner',authority:'Synthetic QA source',observedAt:'2026-10-15T09:00:00Z',sourceRevision:'qa-source',claim:'partial',summary:'Synthetic fixture; no runtime result',blockIds:['author-text']})).result;
 assert(!createCompletionRequest(backed,options()).completion.allowedPaths.includes('/blocks/@author-text/text'));
});

test('public payload has no private sentinels, counts or eligibility side channel',()=>{
 const p=seed(),publicOptions=options({audience:'public'}),baseline=createCompletionRequest(p,publicOptions),privateVersion=structuredClone(p);
 privateVersion.nodes.push({...privateVersion.nodes[1],id:'hidden',label:'PRIVATE_NODE_SENTINEL',visibility:'private',blockIds:['author-text'],sourceIds:['private-source']});privateVersion.views[0].nodeIds.push('hidden');
 privateVersion.sources.push({id:'private-source',title:'PRIVATE_SOURCE_SENTINEL',location:'PRIVATE_LOCATION_SENTINEL',visibility:'private'});
 privateVersion.privateNotes='PRIVATE_NOTES_SENTINEL';
 const next=applyDocumentPatch(validateDocument(privateVersion),observationPatch(privateVersion,{id:'private-claim',nodeId:'selected',sourceApp:'qa-private',authority:'PRIVATE_AUTHORITY_SENTINEL',observedAt:'2026-10-15T09:00:00Z',sourceRevision:'PRIVATE_REVISION_SENTINEL',claim:'partial',summary:'PRIVATE_OBSERVATION_SENTINEL',blockIds:['author-text'],stateFacet:{facet:'runtime',value:'PRIVATE_FACET_SENTINEL',scope:'PRIVATE_SCOPE_SENTINEL'}})).result;
 const publicRequest=createCompletionRequest(next,publicOptions);assert.deepEqual(publicRequest,baseline,'private source/claim/sharing topology cannot alter a public request');assert(!JSON.stringify(publicRequest).includes('PRIVATE_'));
 assert.throws(()=>createCompletionRequest(next,options({audience:'public',selection:{nodeId:'hidden'}})),/unavailable/);
 const authorRequest=createCompletionRequest(next,options());assert(JSON.stringify(authorRequest).includes('PRIVATE_OBSERVATION_SENTINEL'));
});

test('public source-backed private captions stay redacted before selection',()=>{
 const p=seed();p.sources[0].visibility='private';p.nodes[0].summary='PRIVATE_CAPTION_SENTINEL';p.nodes[0].role='PRIVATE_ROLE_SENTINEL';if(p.blocks[0].type==='text')p.blocks[0].text='PRIVATE_EVIDENCE_SENTINEL';
 const r=createCompletionRequest(validateDocument(p),options({audience:'public'}));assert(!JSON.stringify(r).includes('PRIVATE_'));assert.equal(r.components[0].summary,'');assert.deepEqual(r.sources,[]);assert.deepEqual(r.evidence,[]);assert(r.completion.blockingNeeds.length>0);
 assert(!r.completion.allowedPaths.some(path=>path.endsWith('/summary')||path.endsWith('/role')));
 const before=JSON.stringify(p);
 for(const value of ['','PRIVATE_CAPTION_SENTINEL','wrong guess']){
  const patch={...completionPatchTemplate(r),operations:[{op:'test' as const,path:'/nodes/@selected/summary',value}]};
  assert.throws(()=>previewCompletionPatch(p,r,patch),error=>error instanceof Error&&!error.message.includes('PRIVATE_')&&error.message.includes('outside the selected'));
 }
 assert.throws(()=>previewCompletionPatch(p,r,{...completionPatchTemplate(r),operations:[{op:'replace',path:'/nodes/@selected/summary',value:'Would overwrite hidden source text'}]}));
 const empty=seed();empty.nodes[0].summary='';empty.nodes[0].role='';const genuinelyEmpty=createCompletionRequest(empty,options({audience:'public'}));assert.deepEqual(genuinelyEmpty.completion.allowedPaths,r.completion.allowedPaths,'blank field eligibility does not reveal why it is blank');
 assert.equal(JSON.stringify(p),before);
});

test('public failed tests cannot expose current values through patch diagnostics',()=>{
 const p=seed(),r=createCompletionRequest(p,options({audience:'public'})),before=JSON.stringify(p);
 const badTest=candidate(r,[{op:'test',path:'/nodes/@selected/summary',value:'wrong expected value'}]);
 assert.throws(()=>previewCompletionPatch(p,r,badTest),error=>error instanceof Error&&error.message.includes('permitted public context')&&!error.message.includes('Original caption')&&!error.message.includes('wrong expected value'));
 assert.equal(JSON.stringify(p),before);
});

test('byte and item budgets omit complete rows with exact counts and no dangling reference',()=>{
 const p=seed();p.nodes=[];p.blocks=[];p.sources=[];p.edges=[];p.views=[{...p.views[0],nodeIds:[],edgeIds:[],positions:{}}];
 for(let i=0;i<30;i++){const n='node-'+i,b='block-'+i,s='source-'+i;p.nodes.push({...seed().nodes[0],id:n,blockIds:[b],sourceIds:[s]});p.views[0].nodeIds.push(n);p.blocks.push({id:b,title:'Large author explanation',type:'text',text:'文'.repeat(17000),provenance:'author',sourceIds:[s],visibility:'public'});p.sources.push({id:s,title:'Source '+i,location:i===0?'文'.repeat(17000):'selected-'+i+'.md:1',visibility:'public'});}
 const before=JSON.stringify(p),r=createCompletionRequest(validateDocument(p),options({selection:{viewId:'root'}}));
 assert(new TextEncoder().encode(JSON.stringify(r)).byteLength<=COMPLETION_LIMITS.bytes);assert.equal(r.completion.omissions.components+r.components.length,30);assert.equal(r.completion.omissions.evidence+r.evidence.length,30);assert.equal(r.completion.omissions.sources+r.sources.length,30);
 const sources=new Set(r.sources.map(s=>s.id)),blocks=new Set(r.evidence.map(b=>b.id));for(const n of r.components){assert(n.sourceIds.every(id=>sources.has(id)));assert(n.blockIds.every(id=>blocks.has(id)));}for(const b of r.evidence)assert(b.sourceIds.every(id=>sources.has(id)));
 assert(r.completion.omissions.evidence>0);assert(r.completion.omissions.sourceReferences>0);assert.deepEqual(createCompletionRequest(p,options({selection:{viewId:'root'}})),r);assert.equal(JSON.stringify(p),before);
 const patch=completionPatchTemplate(r);assert.throws(()=>previewCompletionPatch(p,r,{...patch,summary:'x'.repeat(COMPLETION_LIMITS.bytes)}),/byte budget/);
 assert.throws(()=>previewCompletionPatch(p,r,{...patch,operations:Array.from({length:COMPLETION_LIMITS.operations+1},()=>({op:'test',path:'/revision',value:7}))}),/operation budget/);
});
