import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,documentSchema,validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {pinContext,resolveContextPin} from '../src/core/contextPin';
import {selectionContext} from '../src/intelligence/navigation';

function fixture(){return validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-context-pin',rootViewId:'root',title:'Synthetic context pin',
 nodes:[{id:'a',label:'Synthetic A',summary:'Initial A',childViewId:'child'},{id:'b',label:'Synthetic B'},{id:'code',label:'Synthetic code'},{id:'private',label:'PRIVATE_PIN_LABEL',summary:'PRIVATE_PIN_FACT',visibility:'private'}],edges:[],
 views:[{id:'root',title:'Synthetic root',nodeIds:['a','b','private']},{id:'child',title:'Synthetic child',nodeIds:['code']}]}));}

test('a context pin contains only canonical IDs and does not mutate authoring or public exports',()=>{
 const project=fixture(),before=JSON.stringify(project),pin=pinContext(project,{nodeId:'a',viewId:'root'});
 assert.deepEqual(pin,{projectId:project.id,viewId:'root',nodeId:'a'});
 assert.deepEqual(resolveContextPin(project,pin),{state:'available',selection:{viewId:'root',nodeId:'a'}});
 assert.equal(JSON.stringify(project),before);assert(!JSON.stringify(publicDocument(project)).includes('contextPin'));
 assert.deepEqual(pinContext(project,{viewId:'child'}),{projectId:project.id,viewId:'child'});
 assert.deepEqual(pinContext(project,{}),{projectId:project.id});
});

test('resolving pinned A does not follow an independently changed active B or collapse its parent reference',()=>{
 const project=fixture(),pin=pinContext(project,{nodeId:'a',viewId:'root'})!,active=selectionContext(project,{nodeId:'b',viewId:'root'});
 const resolved=resolveContextPin(project,pin);assert.equal(resolved.state,'available');if(resolved.state!=='available')return;
 assert.equal(active.node!.id,'b');assert.equal(selectionContext(project,resolved.selection).node!.id,'a');
 assert.equal(resolved.selection.viewId,'root');assert.equal(selectionContext(project,resolved.selection).node!.childViewId,'child');
 assert.deepEqual(resolveContextPin(project,pin),resolved,'an unrelated active pointer has no authority over the pin');
});

test('a pin resolves live facts at the current revision without retaining a stale snapshot',()=>{
 const project=fixture(),pin=pinContext(project,{nodeId:'a',viewId:'root'})!,before=JSON.stringify(pin),changed=clone(project);
 changed.revision++;changed.nodes.find(n=>n.id==='a')!.summary='Current revised A';
 const current=validateDocument(changed),resolved=resolveContextPin(current,pin);assert.equal(resolved.state,'available');if(resolved.state!=='available')return;
 const context=selectionContext(current,resolved.selection);assert.equal(context.node!.summary,'Current revised A');assert.equal(current.revision,project.revision+1);
 assert.equal(JSON.stringify(pin),before);assert(!Object.hasOwn(pin,'revision'));assert(!Object.hasOwn(pin,'summary'));
});

test('wrong project, malformed pointers and unknown identities return a generic unavailable result',()=>{
 const project=fixture(),before=JSON.stringify(project),valid=pinContext(project,{nodeId:'a',viewId:'root'})!;
 const bad:unknown[]=[undefined,null,[],false,'a',{}, {...valid,projectId:'other'}, {...valid,nodeId:'missing'}, {...valid,viewId:'missing'}, {...valid,nodeId:3},
  {...valid,viewId:'../root'}, {...valid,nodeId:'x'.repeat(81)}, {...valid,authority:'PRIVATE_VALUE'}, {...valid,command:'run'}, {...valid,revision:0}];
 for(const pointer of bad){const result=resolveContextPin(project,pointer);assert.deepEqual(result,{state:'unavailable'});assert(!JSON.stringify(result).includes('PRIVATE'));}
 assert.equal(pinContext(project,{nodeId:'missing',viewId:'root'}),undefined,'missing node never falls back silently to its view');
 assert.equal(JSON.stringify(project),before);
});

test('pins respect exact membership and reject unattached or removed selections',()=>{
 const project=fixture();assert.equal(pinContext(project,{viewId:'child',nodeId:'a'}),undefined);
 assert.equal(pinContext(project,{viewId:'root',nodeId:'code'}),undefined);
 const pin=pinContext(project,{viewId:'root',nodeId:'a'})!,removed=clone(project);
 removed.nodes=removed.nodes.filter(n=>n.id!=='a');removed.views.find(v=>v.id==='root')!.nodeIds=['b','private'];
 assert.deepEqual(resolveContextPin(validateDocument(removed),pin),{state:'unavailable'});
 const unattached=clone(project);unattached.views.find(v=>v.id==='root')!.nodeIds=['a','b'];
 assert.equal(pinContext(validateDocument(unattached),{nodeId:'private'}),undefined);
});

test('a private pin is unavailable after public redaction without exposing the old label or evidence',()=>{
 const project=fixture(),pin=pinContext(project,{viewId:'root',nodeId:'private'})!;assert(pin);
 const safe=publicDocument(project),result=resolveContextPin(safe,pin);assert.deepEqual(result,{state:'unavailable'});
 for(const marker of ['PRIVATE_PIN_LABEL','PRIVATE_PIN_FACT','private'])assert(!JSON.stringify(result).includes(marker));
 assert(!JSON.stringify(safe).includes('PRIVATE_PIN_LABEL'));assert.equal(project.nodes.find(n=>n.id==='private')!.summary,'PRIVATE_PIN_FACT');
});

test('identical entity IDs in another project cannot resolve the previous project pin',()=>{
 const project=fixture(),pin=pinContext(project,{nodeId:'a',viewId:'root'})!,other=validateDocument({...clone(project),id:'other-project'});
 assert.deepEqual(resolveContextPin(other,pin),{state:'unavailable'});
 assert.deepEqual(resolveContextPin(other,pinContext(other,{viewId:'root',nodeId:'b'})),{state:'available',selection:{viewId:'root',nodeId:'b'}});
});
