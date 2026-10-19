import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {addTour,addTourStop,moveTourStop,recordStop,removeTourStop} from '../src/core/tours';
import {presentAt,presentationDrift,returnToPresentation,TOUR_RESUME_UNAVAILABLE,type Presentation} from '../src/core/tourResume';

/** Interruptible presentation: a source cut, pause and explicit return by stop identity; never moved silently. Synthetic fixture. */
const base=():Project=>validateDocument({schemaVersion:1,id:'meet',revision:5,title:'Synthetic meeting',rootViewId:'root',
 nodes:[{id:'a',label:'Synthetic A',childViewId:'inner'},{id:'b',label:'Synthetic B'},{id:'p',label:'Synthetic private',visibility:'private'},{id:'i',label:'Synthetic inner'}],
 edges:[],views:[{id:'root',title:'Root',nodeIds:['a','b','p']},{id:'inner',title:'Inner',nodeIds:['i']}]});
function meeting(visibility:'public'|'private'='public'){
 const d0=base();let doc=addTour(d0,{id:'walk',title:'Synthetic walk',visibility,stop:recordStop(d0,'root',[{kind:'node',id:'a'}],'Stop one narration.')});
 doc=addTourStop(doc,'walk',recordStop(doc,'root',[{kind:'node',id:'p'}],'Private stop narration.'));
 doc=addTourStop(doc,'walk',recordStop(doc,'root',[{kind:'node',id:'a'},{kind:'node',id:'p'}],'Mixed stop narration.'));
 return addTourStop(doc,'walk',recordStop(doc,'root',[{kind:'node',id:'b'}],'Stop four narration.'));
}
const bump=(d:Project,f:(x:Project)=>void=()=>{}):Project=>{const x=structuredClone(d);f(x);x.revision=d.revision+1;return validateDocument(x);};

test('presentation: the cut records project, revision and audience; reading it changes nothing',()=>{
 const doc=meeting(),before=JSON.stringify(doc),p=presentAt(doc,'walk',3,'author')!;
 assert.deepEqual(p,{tourId:'walk',index:3,stopRef:doc.tours![0].stops[3].id,cut:{projectId:'meet',revision:doc.revision,audience:'author'},paused:false});
 assert.equal(presentAt(doc,'walk',9,'author'),undefined);assert.equal(presentAt(doc,'nope',0,'author'),undefined);
 assert.equal(presentationDrift(doc,p,'author'),undefined);
 assert.deepEqual(returnToPresentation(doc,{...p,paused:true},'author'),{state:'resumed',tourId:'walk',index:3,message:'Resumed Synthetic walk at stop 4 of 4.'});
 assert.equal(JSON.stringify(doc),before,'no revision, run or observation');
});

test('presentation: a source change during the pause never moves it; the presenter chooses',()=>{
 const doc=meeting(),p:Presentation={...presentAt(doc,'walk',3,'author')!,paused:true};
 // Unrelated edit: the stop is still there, but the presenter is told and must choose.
 const edited=bump(doc,x=>{x.nodes.find(n=>n.id==='b')!.summary='Changed during the pause';});
 const drift=presentationDrift(edited,p,'author')!;assert.equal(drift.sourceChanged,true);assert.equal(drift.audienceChanged,false);
 assert.match(drift.message,/revision 5 \(now revision 6\)/);
 const same=returnToPresentation(edited,p,'author');assert.equal(same.state,'choose');
 assert.ok(same.state==='choose'&&same.reason==='source-changed'&&same.candidates.length===1&&same.candidates[0]===3);
 // Moved: offered at its new place, never rebound.
 const moved=bump(moveTourStop(doc,'walk',3,doc.tours![0].stops[3],-1)),m=returnToPresentation(moved,p,'author');
 assert.ok(m.state==='choose'&&m.reason==='reordered'&&m.candidates[0]===2);assert.match(m.message,/^The source changed/);
 // Removed: no candidate, start or stay.
 const removed=bump(removeTourStop(doc,'walk',3,doc.tours![0].stops[3])),r=returnToPresentation(removed,p,'author');
 assert.ok(r.state==='choose'&&r.reason==='removed'&&r.candidates.length===0);
 // Ambiguous: two legacy stops (no ID) with the same recorded content are both offered.
 const legacy=bump(doc,x=>{for(const s of x.tours![0].stops)delete s.id;}),lp:Presentation={...presentAt(legacy,'walk',3,'author')!,paused:true};
 const twice=bump(legacy,x=>{x.tours![0].stops.push(structuredClone(x.tours![0].stops[3]));}),a=returnToPresentation(twice,lp,'author');
 assert.ok(a.state==='choose'&&a.reason==='ambiguous');assert.deepEqual(a.candidates,[3,4]);
 // Another project: unavailable.
 assert.deepEqual(returnToPresentation({...doc,id:'other'},p,'author'),{state:'unavailable',message:TOUR_RESUME_UNAVAILABLE});
});

test('presentation: permissions are revalidated against the audience copy on return',()=>{
 const doc=meeting(),pub=publicDocument(doc);
 // Paused on the private stop in the author view, returned in the public copy: the stop is not found there.
 const onPrivate:Presentation={...presentAt(doc,'walk',1,'author')!,paused:true};
 const out=returnToPresentation(pub,onPrivate,'public');assert.ok(out.state==='choose'&&out.reason==='removed'&&out.candidates.length===0);
 assert.match(out.message,/audience changed from the author view to the public copy/);
 assert.doesNotMatch(JSON.stringify(out),/Private stop narration|Synthetic private/);
 // Paused on a public stop: found by identity, but the audience change is still the presenter's choice.
 const onPublic:Presentation={...presentAt(doc,'walk',3,'author')!,paused:true},again=returnToPresentation(pub,onPublic,'public');
 assert.ok(again.state==='choose'&&again.reason==='source-changed'&&again.candidates[0]===3);
 // The public copy drops the narration of the mixed stop and omits the private one; a presentation on it has no stop identity.
 assert.equal(pub.tours![0].stops[2].narration,'');assert.equal(pub.tours![0].stops[1].omitted,'stop');
 const omitted=presentAt(pub,'walk',1,'public')!;assert.equal(omitted.stopRef,undefined);
 assert.equal(returnToPresentation(pub,{...omitted,paused:true},'public').state,'resumed','no drift: the same omitted position');
 assert.equal(returnToPresentation(bump(pub),{...omitted,paused:true},'public').state,'choose','with drift an omitted stop cannot be found again');
 // A private tour does not exist for the public audience: unavailable, without its title.
 const privateDoc=meeting('private'),hidden=returnToPresentation(publicDocument(privateDoc),{...presentAt(privateDoc,'walk',0,'author')!,paused:true},'public');
 assert.deepEqual(hidden,{state:'unavailable',message:TOUR_RESUME_UNAVAILABLE});
});
