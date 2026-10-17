import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,documentSchema,validateDocument,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {SAVED_CONTEXT_LIMIT,SAVED_CONTEXT_UNAVAILABLE,addSavedContext,captureSemanticContext,clearSavedContexts,isSemanticContext,parseSavedContextFile,readSavedContexts,
 removeSavedContext,resolveSemanticContext,savedContextKey,savedContextScope,serializeSavedContextFile,watchSavedContexts,type SavedContext,type SemanticContext} from '../src/core/savedContext';

const PRIVATE='SYNTHETIC_PRIVATE_SAVED_CONTEXT';
function fixture():Project{return validateDocument(documentSchema.parse({schemaVersion:1,id:'saved-context-fixture',title:'Synthetic saved context',rootViewId:'root',summary:'Synthetic pointers only.',
 nodes:[{id:'parent',label:'Synthetic parent',childViewId:'child'},{id:'other',label:'Synthetic other'},{id:'code',label:'Synthetic code'},{id:'store',label:'Synthetic store'},
  {id:'secret',label:PRIVATE,visibility:'private',childViewId:'secret-view'},{id:'inner',label:'Synthetic inner'}],
 edges:[{id:'flow',source:'code',target:'store',label:'Synthetic flow'}],
 views:[{id:'root',title:'Synthetic root',nodeIds:['parent','other','secret'],positions:{parent:{x:0,y:0},other:{x:300,y:0},secret:{x:600,y:0}}},
  {id:'child',title:'Synthetic child',perspective:'code',nodeIds:['code','store'],edgeIds:['flow'],positions:{code:{x:0,y:0},store:{x:300,y:0}}},
  {id:'secret-view',title:PRIVATE,visibility:'private',nodeIds:['inner'],positions:{inner:{x:0,y:0}}}]}));}
const none={environmentId:null,lesson:null,variantId:null,tour:null};
const context=(over:Partial<SemanticContext>={}):SemanticContext=>({path:['root','child'],view:'child',selected:'code',selectedEdge:null,sheet:'diagram',perspective:'code',snapshotId:null,...none,...over});
const always=()=>true;
class Memory{values=new Map<string,string>();getItem(k:string){return this.values.get(k)??null;}setItem(k:string,v:string){this.values.set(k,v);}removeItem(k:string){this.values.delete(k);}}
const entry=(id:string,c:SemanticContext=context()):SavedContext=>({id,label:id,savedAt:'2026-10-17T00:00:00.000Z',projectRevision:1,context:c});

test('capture keeps stable-ID pointers only and refuses a navigation that is not valid in the permitted document',()=>{
 const doc=fixture(),c=captureSemanticContext(doc,{path:['root','child'],view:'child',selected:'code',selectedEdge:null,sheet:'evidence'});
 assert.deepEqual(c,{path:['root','child'],view:'child',selected:'code',selectedEdge:null,sheet:'evidence',perspective:'code',environmentId:null,snapshotId:null,lesson:null,variantId:null,tour:null});
 assert.ok(!JSON.stringify(c).includes('Synthetic'),'no labels or facts are copied');
 assert.equal(captureSemanticContext(publicDocument(doc),{path:['root','secret-view'],view:'secret-view',selected:'inner',selectedEdge:null,sheet:'diagram'}),undefined);
 assert.equal(captureSemanticContext(doc,{path:['root'],view:'child',selected:null,selectedEdge:null,sheet:'diagram'}),undefined,'a view outside the recorded path is not a context');
});

test('every dimension resolves independently: a removed selection falls back while path, view and sheet are kept',()=>{
 const doc=fixture(),full=resolveSemanticContext(doc,context({selected:null,selectedEdge:'flow'}),always);
 assert.equal(full.state,'restored');assert.deepEqual(full.navigation,{path:['root','child'],view:'child',selected:null,selectedEdge:'flow',sheet:'diagram',lesson:null});
 const changed=clone(doc);changed.views.find(v=>v.id==='child')!.nodeIds=['store'];changed.views.find(v=>v.id==='child')!.edgeIds=[];changed.edges=[];delete changed.views.find(v=>v.id==='child')!.positions.code;
 const out=resolveSemanticContext(validateDocument(changed),context(),always);
 assert.equal(out.state,'partial');assert.deepEqual(out.navigation,{path:['root','child'],view:'child',selected:null,selectedEdge:null,sheet:'diagram',lesson:null});
 assert.deepEqual(out.dimensions.map(d=>[d.dimension,d.state]),[['path','kept'],['view','kept'],['selection','fallback'],['sheet','kept'],['perspective','kept']]);
 assert.equal(out.dimensions.find(d=>d.dimension==='selection')!.explanation,SAVED_CONTEXT_UNAVAILABLE);
});

test('a broken drilldown keeps the longest exact prefix and never rebinds the selection to a view that merely contains it or a similar label',()=>{
 const doc=fixture(),changed=clone(doc);delete changed.nodes.find(n=>n.id==='parent')!.childViewId;changed.views.find(v=>v.id==='root')!.nodeIds.push('code');changed.views.find(v=>v.id==='root')!.positions.code={x:900,y:0};
 const out=resolveSemanticContext(validateDocument(changed),context(),always);
 assert.equal(out.state,'unavailable');assert.deepEqual(out.navigation.path,['root']);assert.equal(out.navigation.view,'root');assert.equal(out.navigation.selected,null);
 assert.deepEqual(out.dimensions.filter(d=>d.state==='fallback').map(d=>d.dimension),['path','view','selection','perspective']);
 const relabelled=clone(doc);relabelled.nodes.find(n=>n.id==='store')!.label='Synthetic code';relabelled.views.find(v=>v.id==='child')!.nodeIds=['store'];relabelled.views.find(v=>v.id==='child')!.edgeIds=[];relabelled.edges=[];delete relabelled.views.find(v=>v.id==='child')!.positions.code;
 assert.equal(resolveSemanticContext(validateDocument(relabelled),context(),always).navigation.selected,null,'same label is not the same object');
});

test('a public reader resolves against publicDocument: private targets fall back generically and are never named',()=>{
 const doc=fixture(),pub=publicDocument(doc),out=resolveSemanticContext(pub,context({path:['root','secret-view'],view:'secret-view',selected:'inner',perspective:null}),always);
 assert.equal(out.state,'unavailable');assert.deepEqual(out.navigation,{path:['root'],view:'root',selected:null,selectedEdge:null,sheet:'diagram',lesson:null});
 assert.ok(!JSON.stringify(out).includes(PRIVATE));assert.ok(out.dimensions.every(d=>d.state!=='fallback'||d.explanation===SAVED_CONTEXT_UNAVAILABLE));
});

test('perspective and snapshot changes are shown, never forced; a missing environment or lesson falls back; variant and tour slots are reserved',()=>{
 const doc=fixture(),changed=clone(doc);changed.views.find(v=>v.id==='child')!.perspective='data';
 const out=resolveSemanticContext(validateDocument(changed),context({environmentId:'prod',lesson:{lessonId:'missing-lesson',depth:'detail'},variantId:'variant-a',tour:{tourId:'tour-a',stopId:'stop-1'},snapshotId:'snap-old'}),id=>id==='known');
 assert.deepEqual(Object.fromEntries(out.dimensions.map(d=>[d.dimension,d.state])),{path:'kept',view:'kept',selection:'kept',sheet:'kept',perspective:'changed',environment:'fallback',snapshot:'fallback',lesson:'fallback',variant:'reserved',tour:'reserved'});
 assert.equal(out.navigation.view,'child');assert.equal(out.navigation.selected,'code');assert.equal(out.navigation.lesson,null);
 const lesson=resolveSemanticContext(doc,context({lesson:{lessonId:'known',depth:'architecture'}}),id=>id==='known');
 assert.deepEqual(lesson.navigation.lesson,{lessonId:'known',depth:'architecture'});assert.equal(lesson.state,'restored');
});

test('malformed contexts are refused whole: extra keys, both selections, unknown sheet or perspective',()=>{
 for(const bad of [{...context(),extra:1},context({selectedEdge:'flow'}),{...context(),sheet:'camera'},{...context(),perspective:'zoom'},context({path:[]}),context({path:['root','root']}),{...context(),tour:{tourId:'t'}}])
  assert.equal(isSemanticContext(bad),false,JSON.stringify(bad));
 const out=resolveSemanticContext(fixture(),{...context(),camera:{x:1}},always);
 assert.equal(out.state,'unavailable');assert.deepEqual(out.navigation.path,['root']);
});

test('storage is versioned and scoped by project, audience and host; corrupt or foreign files are never reinterpreted',()=>{
 const storage=new Memory(),scope=savedContextScope('p','author','127.0.0.1:4173');
 assert.notEqual(savedContextKey('p','author','h'),savedContextKey('p','public','h'));assert.notEqual(savedContextKey('p','author','h'),savedContextKey('p','author','other'));
 assert.deepEqual(readSavedContexts(storage,'p','author','127.0.0.1:4173'),{status:'empty',entries:[]});
 assert.equal(addSavedContext(storage,'p','author','127.0.0.1:4173',entry('context-a')).ok,true);
 assert.equal(readSavedContexts(storage,'p','public','127.0.0.1:4173').status,'empty','a public reader never reads author contexts');
 const text=storage.getItem(savedContextKey('p','author','127.0.0.1:4173'))!;
 assert.equal(parseSavedContextFile(text,savedContextScope('p','public','127.0.0.1:4173')).state,'corrupt','a file copied into another scope is refused');
 assert.equal(parseSavedContextFile(text.replace('"version":1','"version":2'),scope).state,'corrupt');
 storage.setItem(savedContextKey('p','author','127.0.0.1:4173'),'{not json');
 assert.equal(readSavedContexts(storage,'p','author','127.0.0.1:4173').status,'corrupt');
 const refused=addSavedContext(storage,'p','author','127.0.0.1:4173',entry('context-b'));
 assert.deepEqual(refused,{ok:false,reason:'corrupt',entries:[]});assert.equal(storage.getItem(savedContextKey('p','author','127.0.0.1:4173')),'{not json','corrupt value left untouched');
 assert.equal(clearSavedContexts(storage,'p','author','127.0.0.1:4173'),true);assert.equal(addSavedContext(storage,'p','author','127.0.0.1:4173',entry('context-b')).ok,true);
});

test('writes re-read the freshest value, so another tab is not overwritten; limit, removal and blocked storage are explicit',()=>{
 const storage=new Memory(),key=savedContextKey('p','author','h');
 addSavedContext(storage,'p','author','h',entry('context-a'));
 storage.setItem(key,serializeSavedContextFile(savedContextScope('p','author','h'),[entry('context-a'),entry('context-other-tab')]));
 const out=addSavedContext(storage,'p','author','h',entry('context-b'));assert.ok(out.ok);assert.deepEqual(out.entries.map(e=>e.id),['context-a','context-other-tab','context-b']);
 assert.deepEqual(removeSavedContext(storage,'p','author','h','context-a').entries.map(e=>e.id),['context-other-tab','context-b']);
 const full=new Memory();for(let i=0;i<SAVED_CONTEXT_LIMIT;i++)addSavedContext(full,'p','author','h',entry(`context-${i}`));
 assert.equal((addSavedContext(full,'p','author','h',entry('context-extra')) as {reason:string}).reason,'full');
 const blocked={getItem(){throw new Error('SecurityError');},setItem(){throw new Error('SecurityError');},removeItem(){throw new Error('SecurityError');}};
 assert.deepEqual(readSavedContexts(blocked,'p','author','h'),{status:'unavailable',entries:[]});
 assert.deepEqual(addSavedContext(blocked,'p','author','h',entry('context-a')),{ok:false,reason:'unavailable',entries:[]});
 assert.equal(readSavedContexts(null,'p','author','h').status,'unavailable');assert.equal(clearSavedContexts(blocked,'p','author','h'),false);
 const quota=new Memory();quota.setItem=()=>{throw new Error('QuotaExceededError');};
 assert.deepEqual(addSavedContext(quota,'p','author','h',entry('context-a')),{ok:false,reason:'unavailable',entries:[]});
});

test('the storage listener fires only for this scope (or a full clear)',()=>{
 const listeners:((e:StorageEvent)=>void)[]=[],target={addEventListener:(_:string,l:(e:StorageEvent)=>void)=>{listeners.push(l);},removeEventListener:(_:string,l:(e:StorageEvent)=>void)=>{listeners.splice(listeners.indexOf(l),1);}} as unknown as Window;
 let calls=0;const stop=watchSavedContexts(target,'p','author','h',()=>calls++);
 listeners.forEach(l=>l({key:savedContextKey('p','public','h')} as StorageEvent));assert.equal(calls,0);
 listeners.forEach(l=>l({key:savedContextKey('p','author','h')} as StorageEvent));listeners.forEach(l=>l({key:null} as StorageEvent));assert.equal(calls,2);
 stop();assert.equal(listeners.length,0);
});
