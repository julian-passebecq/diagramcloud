import test from 'node:test';
import assert from 'node:assert/strict';
import {negotiateCapabilities,createReturnIntent,createReturnGuard,returnFileText,parseReturnFile,HOST_SESSION_FORMAT,SESSION_REFUSED,NOT_PROVIDED,type HostSession} from '../src/react/hostSession';

const offer=(grants:string[],extra:Record<string,unknown>={})=>({format:HOST_SESSION_FORMAT,sessionId:'session-0001',audience:'public',grants,...extra});
const ready=(grants:string[]):HostSession=>{const n=negotiateCapabilities(offer(grants));assert.equal(n.state,'ready');return n as HostSession;};
const target={projectId:'synthetic-viewer-a',baseRevision:7,viewId:'root',nodeId:'a'};
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
 const session=ready(['query']),guard=createReturnGuard(binding(session)),intent=createReturnIntent(session,'selection',target)!;
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
 const reopened=createReturnGuard({...binding(ready(['query'])),sessionId:'session-0002'});assert.deepEqual(reopened.accept(late),{ok:false,reason:'wrong-session'},'reopening starts a new session');
 assert.equal(parseReturnFile('x'.repeat(600*1024)),undefined);
});
