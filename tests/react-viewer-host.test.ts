import test from 'node:test';
import assert from 'node:assert/strict';
import {negotiateCapabilities,createReturnIntent,createReturnGuard,returnFileText,parseReturnFile,retainedReturnFile,HOST_SESSION_FORMAT,SESSION_REFUSED,NOT_PROVIDED,RETURN_REFUSAL_TEXT,type HostSession,type ReturnVerdict} from '../src/react/hostSession';
import {openMessage,handleReturn,handleReturnFile,createRetainedStore,HOST_ROUTES} from '../hosts/vscode/src/hostCore';

const offer=(grants:string[],extra:Record<string,unknown>={})=>({format:HOST_SESSION_FORMAT,sessionId:'session-0001',audience:'public',grants,...extra});
const ready=(grants:string[]):HostSession=>{const n=negotiateCapabilities(offer(grants));assert.equal(n.state,'ready');return n as HostSession;};
const target={projectId:'synthetic-viewer-a',baseRevision:7,viewId:'root',nodeId:'a'};
/** A refusal without its retained input, for comparing reasons. */
const why=(v:ReturnVerdict)=>v.ok?v:{ok:false,reason:v.reason};
/** The same guard, with refusals compared by reason only (the retained input is checked in its own test). */
const reasons=(g:ReturnType<typeof createReturnGuard>)=>({accept:(i:unknown)=>why(g.accept(i)),rebind:g.rebind,dispose:g.dispose,get binding(){return g.binding;},get disposed(){return g.disposed;}});
const binding=(session:HostSession,baseRevision=7)=>({sessionId:session.sessionId,projectId:'synthetic-viewer-a',baseRevision,audience:'public' as const,granted:session.granted});

test('negotiation is read-only by default and grants only what is both offered and implemented',()=>{
 assert.deepEqual(ready([]).granted,[]);
 const all=ready(['publish','render','apply','query','validate','propose','render','shell']);
 assert.deepEqual(all.granted,['query','render']);
 assert.deepEqual(all.refused.map(r=>r.capability),['publish','apply','validate','propose','shell']);
 for(const name of ['publish','apply','validate','propose'] as const)assert.equal(all.refused.find(r=>r.capability===name)!.reason,NOT_PROVIDED[name]);
 assert.match(all.refused.find(r=>r.capability==='shell')!.reason,/Unknown capability/);
 for(const bad of [undefined,{},offer([],{audience:'author'}),offer([],{sessionId:'x'}),offer([],{format:'diagramcloud.host-session/2'}),offer([],{extra:true}),offer(['query'],{grants:'query'})])assert.deepEqual(negotiateCapabilities(bad),{state:'refused',reason:SESSION_REFUSED});
});

test('return intents carry exact identity and need the grant of their kind',()=>{
 const none=ready([]),both=ready(['query','render']);
 const selection=createReturnIntent(none,'selection',target)!;
 assert.equal(selection.format,'diagramcloud.host-return/1');assert.equal(selection.sessionId,'session-0001');assert.equal(selection.audience,'public');assert.equal(selection.baseRevision,7);assert.match(selection.intentId,/^[a-f0-9]{32}$/);
 assert.equal(createReturnIntent(none,'query',target,'{}'),undefined);assert.equal(createReturnIntent(none,'render',target,'<svg/>'),undefined);
 assert.ok(createReturnIntent(both,'render',target,'<svg/>'));assert.equal(createReturnIntent(both,'render',target),undefined,'query/render need a payload');
 assert.equal(createReturnIntent(none,'selection',{...target,edgeId:'flow'}),undefined,'node and edge are exclusive');
 assert.notEqual(createReturnIntent(none,'selection',target)!.intentId,selection.intentId);
});

test('the host guard refuses stale, replayed, foreign, ungranted and disposed returns, live or from a file',()=>{
 const session=ready(['query']),guard=reasons(createReturnGuard(binding(session))),intent=createReturnIntent(session,'selection',target)!;
 assert.deepEqual(guard.accept(intent),{ok:true,intent});
 assert.deepEqual(guard.accept(intent),{ok:false,reason:'replayed'});
 assert.deepEqual(guard.accept(parseReturnFile(returnFileText(intent))),{ok:false,reason:'replayed'},'a file copy of an accepted intent is a replay');
 const fromFile=createReturnIntent(session,'selection',{...target,nodeId:'b'})!;assert.equal(guard.accept(parseReturnFile(returnFileText(fromFile))).ok,true);
 assert.deepEqual(guard.accept({...createReturnIntent(session,'selection',target)!,baseRevision:6}),{ok:false,reason:'stale'});
 assert.deepEqual(guard.accept({...createReturnIntent(session,'selection',target)!,projectId:'synthetic-viewer-b'}),{ok:false,reason:'stale'});
 assert.deepEqual(guard.accept({...createReturnIntent(session,'selection',target)!,sessionId:'session-0002'}),{ok:false,reason:'wrong-session'});
 assert.deepEqual(guard.accept({...createReturnIntent(session,'selection',target)!,audience:'author'}),{ok:false,reason:'malformed'});
 assert.deepEqual(guard.accept(parseReturnFile('not json')),{ok:false,reason:'malformed'});
 const render=createReturnIntent(ready(['render']),'render',target,'<svg/>')!;assert.deepEqual(guard.accept(render),{ok:false,reason:'not-granted'},'a forged render intent is refused by the host grant');
 const pending=createReturnIntent(session,'query',target,'{}')!;guard.rebind({projectId:'synthetic-viewer-a',baseRevision:8,audience:'public',granted:session.granted});
 assert.deepEqual(guard.accept(pending),{ok:false,reason:'stale'},'an intent made before the revision advanced is stale');
 assert.equal(guard.accept({...createReturnIntent(session,'query',target,'{}')!,baseRevision:8}).ok,true);
 const late=createReturnIntent(session,'selection',{...target,baseRevision:8})!;guard.dispose();
 assert.deepEqual(guard.accept(late),{ok:false,reason:'disposed'});guard.rebind({projectId:'x',baseRevision:0,audience:'public',granted:[]});assert.equal(guard.binding.projectId,'synthetic-viewer-a');
 const reopened=reasons(createReturnGuard({...binding(ready(['query'])),sessionId:'session-0002'}));assert.deepEqual(reopened.accept(late),{ok:false,reason:'wrong-session'},'reopening starts a new session');
 assert.equal(parseReturnFile('x'.repeat(600*1024)),undefined);
});

test('every refusal hands the original input back unchanged, and only an intent-shaped one becomes a return file',()=>{
 const session=ready(['query']),guard=createReturnGuard({...binding(session),routes:['selection','navigate','query','render']});
 const accepted=createReturnIntent(session,'selection',target)!;guard.accept(accepted);
 const inputs:[unknown,string][]=[[accepted,'replayed'],[{...createReturnIntent(session,'selection',target)!,baseRevision:6},'stale'],[{...createReturnIntent(session,'selection',target)!,sessionId:'session-0002'},'wrong-session'],
  [createReturnIntent(session,'source',{...target,sourceId:'s'}),'unsupported-route'],[createReturnIntent(ready(['render']),'render',target,'<svg/>'),'not-granted'],[{format:'diagramcloud.host-return/1',kind:'apply'},'malformed'],['not an intent','malformed']];
 for(const [input,reason] of inputs){
  const before=JSON.stringify(input),verdict=guard.accept(input);
  assert.equal(verdict.ok,false);if(verdict.ok)continue;
  assert.equal(verdict.reason,reason);assert.equal(verdict.retained,input,'the same value is handed back');assert.equal(JSON.stringify(input),before,'the input is never mutated');
  const file=retainedReturnFile(verdict);
  if(reason==='malformed')assert.equal(file,undefined,'a malformed input is not a return file');
  else{assert.deepEqual(JSON.parse(file!),input,'the return file is the refused intent, unchanged');assert.equal(guard.accept(parseReturnFile(file!)).ok,false,'the host refuses the saved file again');}
 }
 const late=createReturnIntent(session,'selection',{...target,nodeId:'b'})!;guard.dispose();const disposed=guard.accept(late);
 assert.equal(disposed.ok,false);if(!disposed.ok){assert.equal(disposed.reason,'disposed');assert.equal(disposed.retained,late);assert.deepEqual(JSON.parse(retainedReturnFile(disposed)!),late);}
 assert.equal(retainedReturnFile({ok:true,intent:late}),undefined);
});

test('a kind the host has no route for is refused as unsupported-route before the grant is checked',()=>{
 const session=ready(['query','render']),guard=createReturnGuard({...binding(session),routes:['selection']});
 for(const kind of ['navigate','query','render'] as const){const intent=createReturnIntent(session,kind,target,kind==='navigate'?undefined:'{}')!;assert.deepEqual(why(guard.accept(intent)),{ok:false,reason:'unsupported-route'},kind);}
 assert.equal(guard.accept(createReturnIntent(session,'selection',target)).ok,true);
 assert.equal(RETURN_REFUSAL_TEXT['unsupported-route'],'Refused: this host has no route for this return kind.');
 const open=createReturnGuard(binding(session));assert.equal(open.accept(createReturnIntent(session,'source',{...target,sourceId:'s'})).ok,true,'without routes every kind is routed (default)');
 const ungranted=createReturnGuard({...binding(ready([])),routes:['selection','render']});assert.deepEqual(why(ungranted.accept(createReturnIntent(session,'render',target,'<svg/>'))),{ok:false,reason:'not-granted'});
 guard.rebind({projectId:'synthetic-viewer-a',baseRevision:8,audience:'public',granted:session.granted,routes:['selection','render']});assert.deepEqual(guard.binding.routes,['selection','render']);
});

test('VS Code host: a refused return reaches the webview with its reason and a saveId; the retained file is the intent unchanged',()=>{
 const doc={schemaVersion:1,id:'synthetic-vsix',revision:3,title:'Synthetic',rootViewId:'root',nodes:[{id:'a',label:'A',sourceIds:['s']}],edges:[],views:[{id:'root',title:'Root',nodeIds:['a']}],sources:[{id:'s',title:'Public citation'}]};
 const opened=openMessage(JSON.stringify(doc),[],'vscode-session-9');assert.ok(opened.ok);if(!opened.ok)return;
 assert.deepEqual(opened.binding.routes,HOST_ROUTES);assert.ok(!HOST_ROUTES.includes('source'));
 const guard=createReturnGuard(opened.binding),session=negotiateCapabilities(opened.message.session) as HostSession,at={projectId:'synthetic-vsix',baseRevision:3,viewId:'root',nodeId:'a'};
 const stale={...createReturnIntent(session,'selection',at)!,baseRevision:2},action=handleReturn(guard,stale,'live');
 assert.deepEqual(action.reply,{type:'refused',refusal:'stale',reason:RETURN_REFUSAL_TEXT.stale,via:'live',saveId:stale.intentId});
 assert.equal(action.retain?.saveId,stale.intentId);assert.deepEqual(JSON.parse(action.retain!.text),stale);
 const source=handleReturnFile(guard,returnFileText(createReturnIntent(session,'source',{...at,sourceId:'s'})!));
 assert.equal(source.warn,RETURN_REFUSAL_TEXT['unsupported-route']);assert.equal(source.reply?.type,'refused');
 const malformed=handleReturnFile(guard,'not json');assert.deepEqual(malformed.reply,{type:'refused',refusal:'malformed',reason:RETURN_REFUSAL_TEXT.malformed,via:'file'});assert.equal(malformed.retain,undefined);
 assert.equal(handleReturn(guard,createReturnIntent(session,'selection',at),'live').reply?.type,'select','an accepted return is unaffected');
 const store=createRetainedStore(2);store.keep('a','A');store.keep('b','B');store.keep('c','C');assert.equal(store.size,2);assert.equal(store.take('a'),undefined,'oldest dropped');
 assert.equal(store.take('b'),'B');assert.equal(store.take('b'),undefined,'taken once');assert.equal(store.take(7),undefined);store.clear();assert.equal(store.take('c'),undefined);
});
