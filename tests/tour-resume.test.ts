import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,validateDocument,type Project} from '../src/core/model';
import {commitHistory,publicDocument,undo} from '../src/core/operations';
import {addTour,addTourStop,moveTourStop,recordStop,removeTourStop,tourStops,updateTourStop,TOUR_STOP_CHANGED} from '../src/core/tours';
import {clearTourResume,readTourResume,resolveTourResume,stopRef,tourResumeKey,writeTourResume,TOUR_RESUME_UNAVAILABLE} from '../src/core/tourResume';
import {captureSemanticContext,isSemanticContext} from '../src/core/savedContext';

/** Tour Resume by stable stop identity and ordinary stop editing (one revision, one Undo each). */
const shop=():Project=>validateDocument({schemaVersion:1,id:'shop',revision:3,title:'Shop',rootViewId:'overview',
 nodes:[{id:'api',label:'API'},{id:'db',label:'Orders DB',kind:'storage'},{id:'vault',label:'Secret vault',visibility:'private'}],
 edges:[{id:'api-db',source:'api',target:'db',label:'writes'},{id:'api-vault',source:'api',target:'vault'}],
 views:[{id:'overview',title:'Overview',nodeIds:['api','db','vault'],edgeIds:['api-db','api-vault']}]});
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v as object))freeze(x);}return v;};
function walk(){
 const d0=shop();let doc=addTour(d0,{id:'walk',title:'Order walkthrough',visibility:'public',stop:recordStop(d0,'overview',[{kind:'node',id:'api'}],'Requests start here.')});
 doc=addTourStop(doc,'walk',recordStop(doc,'overview',[{kind:'edge',id:'api-db'}],'The API writes orders.'));
 doc=addTourStop(doc,'walk',recordStop(doc,'overview',[{kind:'node',id:'vault'}],'The vault holds keys.'));
 return addTourStop(doc,'walk',recordStop(doc,'overview',[{kind:'node',id:'db'}],'Orders land here.'));
}
const memory=()=>{const m=new Map<string,string>();return {m,getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);},removeItem:(k:string)=>{m.delete(k);}};};

test('tour resume: new stops get stable IDs that survive a move; public copies keep them only on shown stops',()=>{
 const doc=walk();
 const ids=doc.tours![0].stops.map(s=>s.id!);assert.ok(ids.every(id=>/^stop-[0-9a-f]{10}$/.test(id)));assert.equal(new Set(ids).size,4);
 const moved=moveTourStop(doc,'walk',3,doc.tours![0].stops[3],-1);
 assert.deepEqual(moved.tours![0].stops.map(s=>s.id),[ids[0],ids[1],ids[3],ids[2]],'moving never renames a stop');
 const pub=publicDocument(doc),stops=pub.tours![0].stops;
 assert.deepEqual(stops.map(s=>s.id),[ids[0],ids[1],undefined,ids[3]],'the all-private stop is omitted without its ID');
 assert.deepEqual(stops[2],{subjects:[],narration:'',omitted:'stop'});
 assert.deepEqual(publicDocument(pub),pub,'the projection is stable');
 const less=removeTourStop(doc,'walk',3,doc.tours![0].stops[3]),again=addTourStop(less,'walk',recordStop(less,'overview',[{kind:'node',id:'api'}],'Another stop.'));
 assert.ok(!ids.includes(again.tours![0].stops[3].id!),'a removed stop ID never goes to different content');
});

test('tour resume: resolves by stop ID; a moved, removed or ambiguous stop asks for a choice and is never rebound',()=>{
 const doc=freeze(walk()),before=JSON.stringify(doc),ids=doc.tours![0].stops.map(s=>s.id!);
 assert.deepEqual(resolveTourResume(doc,{tourId:'walk',stopRef:ids[1],index:1}),{state:'resumed',tourId:'walk',index:1,message:'Resumed Order walkthrough at stop 2 of 4.'});
 assert.equal(resolveTourResume(doc,{tourId:'walk',stopRef:ids[1]}).state,'resumed','a saved context without a position resumes by ID');
 assert.equal(JSON.stringify(doc),before,'resolving records nothing: no revision, run or observation');
 assert.equal(doc.revision,3);assert.equal(doc.observations.length,0);
 const moved=moveTourStop(doc,'walk',1,doc.tours![0].stops[1],1),r=resolveTourResume(moved,{tourId:'walk',stopRef:ids[1],index:1});
 assert.equal(r.state,'choose');if(r.state!=='choose')return;assert.equal(r.reason,'reordered');assert.deepEqual(r.candidates,[2]);assert.match(r.message,/moved from position 2 to 3 of 4.*nothing is picked for you/);
 const removed=removeTourStop(doc,'walk',1,doc.tours![0].stops[1]),gone=resolveTourResume(removed,{tourId:'walk',stopRef:ids[1],index:1});
 assert.equal(gone.state,'choose');if(gone.state!=='choose')return;assert.equal(gone.reason,'removed');assert.deepEqual(gone.candidates,[],'no similar stop is offered as the same stop');
 assert.deepEqual(resolveTourResume(doc,{tourId:'other',stopRef:ids[0]}),{state:'unavailable',message:TOUR_RESUME_UNAVAILABLE});
 // Legacy stops (no ID) resolve by recorded view, subjects and fingerprint; two identical legacy stops are ambiguous.
 const legacy=clone(doc);for(const s of legacy.tours![0].stops)delete s.id;legacy.tours![0].stops.push(clone(legacy.tours![0].stops[0]));const old=validateDocument(legacy);
 const ref=stopRef(old.tours![0].stops[1])!;assert.match(ref,/^legacy\.[0-9a-f]{16}$/);
 assert.equal(resolveTourResume(old,{tourId:'walk',stopRef:ref,index:1}).state,'resumed');
 const twin=resolveTourResume(old,{tourId:'walk',stopRef:stopRef(old.tours![0].stops[0])!,index:0});
 assert.equal(twin.state,'choose');if(twin.state==='choose'){assert.equal(twin.reason,'ambiguous');assert.deepEqual(twin.candidates,[0,4]);}
 // Public readers resolve against the public copy: the omitted stop has no reference to resume.
 const pub=publicDocument(doc);assert.equal(stopRef(pub.tours![0].stops[2]),undefined);
 assert.equal(resolveTourResume(pub,{tourId:'walk',stopRef:ids[2]}).state,'choose');
});

test('tour editing: narration, re-record with an edge subject, move and remove are one revision each and one Undo',()=>{
 const doc=walk(),h0={past:[],present:doc,future:[]},s1=doc.tours![0].stops[1],ids=doc.tours![0].stops.map(s=>s.id!);
 const h1=commitHistory(h0,updateTourStop(doc,'walk',1,s1,{narration:'Writes go to the orders DB.'}));
 assert.equal(h1.present.revision,doc.revision+1);assert.equal(h1.present.tours![0].stops[1].narration,'Writes go to the orders DB.');assert.equal(h1.present.tours![0].stops[1].id,ids[1]);
 assert.deepEqual(undo(h1).present.tours,doc.tours,'one Undo restores the narration');
 // A stale stop is re-recorded on the current content and reads current again; it keeps its ID and subjects.
 const changed=clone(doc);changed.edges.find(e=>e.id==='api-db')!.label='persists';const live=validateDocument(changed);
 assert.equal(tourStops(live,live.tours![0])[1].status,'stale');
 const fixed=updateTourStop(live,'walk',1,live.tours![0].stops[1],{rerecord:{viewId:'overview',subjects:[{kind:'edge',id:'api-db'}]}});
 assert.equal(tourStops(fixed,fixed.tours![0])[1].status,'current');assert.equal(fixed.tours![0].stops[1].id,ids[1]);assert.equal(fixed.tours![0].stops[1].narration,'The API writes orders.');
 assert.throws(()=>updateTourStop(live,'walk',1,live.tours![0].stops[1],{rerecord:{viewId:'overview',subjects:[{kind:'edge',id:'nope'}]}}),/Not in view overview: nope/);
 // Guarded: a stop that changed since it was shown is never overwritten.
 const snapshot=JSON.stringify(h1.present);
 assert.throws(()=>updateTourStop(h1.present,'walk',1,s1,{narration:'blind overwrite'}),new RegExp(TOUR_STOP_CHANGED.slice(0,30)));
 assert.throws(()=>moveTourStop(h1.present,'walk',0,s1,1),/The tour changed/);
 assert.equal(JSON.stringify(h1.present),snapshot);
 const order=moveTourStop(doc,'walk',0,doc.tours![0].stops[0],1);assert.deepEqual(order.tours![0].stops.map(s=>s.id),[ids[1],ids[0],ids[2],ids[3]]);
 assert.throws(()=>moveTourStop(doc,'walk',0,doc.tours![0].stops[0],-1),/cannot move further/);
 const single=addTour(shop(),{id:'one',title:'One',stop:recordStop(shop(),'overview',[],'')});
 assert.throws(()=>removeTourStop(single,'one',0,single.tours![0].stops[0]),/Remove the tour instead/);
});

test('tour resume storage: scoped by project, audience and host; corrupt values untouched; blocked storage is not fatal',()=>{
 const s=memory();
 assert.equal(readTourResume(s,'shop','author','h').status,'empty');
 assert.ok(writeTourResume(s,'shop','author','h','walk',{stopRef:'stop-a',index:1,savedAt:'2026-10-17T10:00:00.000Z'}));
 assert.deepEqual(readTourResume(s,'shop','author','h'),{status:'ok',positions:{walk:{stopRef:'stop-a',index:1,savedAt:'2026-10-17T10:00:00.000Z'}}});
 assert.equal(readTourResume(s,'shop','public','h').status,'empty','a public reader never reads author positions');
 assert.equal(readTourResume(s,'other','author','h').status,'empty');
 s.m.set(tourResumeKey('shop','public','h'),'{not json');
 assert.equal(readTourResume(s,'shop','public','h').status,'corrupt');
 assert.equal(writeTourResume(s,'shop','public','h','walk',{stopRef:'stop-b',index:0,savedAt:'x'}),false);assert.equal(s.m.get(tourResumeKey('shop','public','h')),'{not json','corrupt value left untouched');
 assert.ok(clearTourResume(s,'shop','public','h'));assert.equal(readTourResume(s,'shop','public','h').status,'empty');
 const blocked={getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');},removeItem:()=>{throw new Error('blocked');}};
 assert.equal(readTourResume(blocked,'shop','author','h').status,'unavailable');assert.equal(writeTourResume(blocked,'shop','author','h','walk',{stopRef:'stop-b',index:0,savedAt:'x'}),false);
 assert.equal(readTourResume(null,'shop','author','h').status,'unavailable');
});

test('tour resume: a saved context carries the tour and variant dimensions by stable ID, legacy stops included',()=>{
 const doc=walk(),legacy=clone(doc);delete legacy.tours![0].stops[0].id;const old=validateDocument(legacy);
 for(const [d,stopId] of [[doc,doc.tours![0].stops[0].id!],[old,stopRef(old.tours![0].stops[0])!]] as const){
  const c=captureSemanticContext(d,{path:['overview'],view:'overview',selected:null,selectedEdge:null,sheet:'diagram',variantId:'cache-plan',tour:{tourId:'walk',stopId}});
  assert.ok(c&&isSemanticContext(c));assert.deepEqual(c!.tour,{tourId:'walk',stopId});assert.equal(c!.variantId,'cache-plan');
 }
});
