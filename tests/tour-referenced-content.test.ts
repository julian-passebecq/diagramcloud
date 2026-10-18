import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {addTour,newStopId,recordStop,referencedFingerprint,tourStops,updateTourStop,REFERENCES_NOT_COVERED} from '../src/core/tours';
import {resolveTourResume,stopRef} from '../src/core/tourResume';

/** UX34: a tour stop covers the content its subjects reference (blocks, cited sources, images), not only the subject objects. */
const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
const base=(extra:{blockIds?:string[];sourceIds?:string[];blocks?:unknown[];sources?:unknown[]}={})=>validateDocument({schemaVersion:1,id:'tour-gap',title:'Synthetic code lesson',revision:1,rootViewId:'root',edges:[],
 nodes:[{id:'function',label:'Function',blockIds:extra.blockIds??['code','rows'],sourceIds:extra.sourceIds??['spec']},{id:'other',label:'Other',blockIds:['unrelated']}],
 views:[{id:'root',title:'Code',nodeIds:['function','other']}],
 blocks:[{id:'code',type:'code',title:'demo.py',language:'python',code:'return 1',provenance:'synthetic',sourceIds:['ref']},
  {id:'rows',type:'table',title:'Example rows',columns:['in','out'],rows:[[1,1]],provenance:'synthetic'},
  {id:'unrelated',type:'text',title:'Elsewhere',text:'Not referenced by the stop',provenance:'synthetic'},...(extra.blocks??[])],
 sources:[{id:'spec',title:'Synthetic reference',url:'https://example.invalid/spec-v1'},{id:'ref',title:'Synthetic code reference',location:'section 1'},...(extra.sources??[])]});
const recorded=(doc:Project,id?:string)=>addTour(doc,{id:'tour',title:'Explain function',visibility:'public',stop:{...recordStop(doc,'root',[{kind:'node',id:'function'}],'It returns 1.'),...(id?{id}:{})}});
const next=(doc:Project,f:(d:Project)=>void)=>{const d=clone(doc);d.revision++;f(d);return validateDocument(d);};
const status=(doc:Project)=>tourStops(doc,doc.tours![0])[0];

test('UX34 regression: changing referenced code makes the stop stale, never silently current',()=>{
 const doc=recorded(base());
 assert.equal(status(doc).status,'current');assert.equal(status(doc).coverage,'full');assert.equal(status(doc).coverageNote,undefined);
 const changed=next(doc,d=>{const b=d.blocks[0];if(b.type==='code')b.code='return 2';});
 const s=status(changed);assert.equal(s.status,'stale');
 assert.match(s.message,/content its subjects reference \(evidence, code, tables, sources or images\) changed after this tour was recorded at revision 1 \(now revision 2\)/);
});

test('UX34: an explanatory table, a cited source, a block cited source and a revoked reference all make the stop stale',()=>{
 const doc=recorded(base());
 const cases:[string,(d:Project)=>void][]=[
  ['table row',d=>{const b=d.blocks.find(x=>x.id==='rows')!;if(b.type==='table')b.rows[0][1]=2;}],
  ['source revision',d=>{d.sources.find(s=>s.id==='spec')!.url='https://example.invalid/spec-v2';}],
  ['source cited by a block',d=>{d.sources.find(s=>s.id==='ref')!.location='section 2';}],
  ['block made private',d=>{d.blocks.find(x=>x.id==='code')!.visibility='private';}],
  ['source made private',d=>{d.sources.find(s=>s.id==='spec')!.visibility='private';}]];
 for(const [what,f] of cases)assert.equal(status(next(doc,f)).status,'stale',what);
 // A removed reference resolves to nothing here: still recorded by ID, so the closure changes.
 const r=recordStop(doc,'root',[{kind:'node',id:'function'}],'x').referencedFingerprint;
 const gone=clone(doc);gone.blocks=gone.blocks.filter(b=>b.id!=='rows');
 assert.notEqual(referencedFingerprint(gone,'root',[{kind:'node',id:'function'}]),r,'a reference that no longer resolves changes the referenced fingerprint');
});

test('UX34: unrelated edits keep the stop current (another block, another component, positions, revision)',()=>{
 const doc=recorded(base());
 const changed=next(doc,d=>{const b=d.blocks.find(x=>x.id==='unrelated')!;if(b.type==='text')b.text='Changed';d.nodes[1].label='Other renamed';d.views[0].positions={function:{x:40,y:40}};});
 assert.equal(status(changed).status,'current');
});

test('UX34 compatibility: a legacy stop keeps its old comparison, says referenced content is not covered, and is never re-recorded silently',()=>{
 const fresh=recorded(base()),legacy=clone(fresh);delete legacy.tours![0].stops[0].referencedFingerprint;
 const doc=validateDocument(legacy),stop=doc.tours![0].stops[0];
 assert.equal(stop.referencedFingerprint,undefined,'old documents without the field still validate');
 const s=status(doc);assert.equal(s.status,'current');assert.equal(s.coverage,'subjects-only');assert.equal(s.coverageNote,REFERENCES_NOT_COVERED);
 const changed=next(doc,d=>{const b=d.blocks[0];if(b.type==='code')b.code='return 2';});
 assert.equal(status(changed).status,'current','the old comparison is kept');assert.equal(status(changed).coverageNote,REFERENCES_NOT_COVERED,'and qualified, not silently current');
 assert.equal(status(next(doc,d=>{d.nodes[0].label='Renamed';})).status,'stale','a subject change still reads stale on a legacy stop');
 // A narration edit keeps the legacy record; only an explicit Re-record adds the field, and the stop keeps its ID.
 const edited=updateTourStop(changed,'tour',0,changed.tours![0].stops[0],{narration:'It returns something.'});
 assert.equal(edited.tours![0].stops[0].referencedFingerprint,undefined);assert.equal(edited.tours![0].stops[0].id,stop.id);
 const rerecorded=updateTourStop(changed,'tour',0,changed.tours![0].stops[0],{rerecord:{viewId:'root',subjects:[{kind:'node',id:'function'}]}});
 assert.ok(rerecorded.tours![0].stops[0].referencedFingerprint);assert.equal(rerecorded.tours![0].stops[0].id,stop.id);assert.equal(status(rerecorded).coverage,'full');
 // Resume keys of a legacy stop (with or without an ID) do not depend on the new field.
 const noId=clone(stop);delete noId.id;assert.equal(stopRef(noId),stopRef({...noId,referencedFingerprint:'0123456789abcdef'}));
 assert.equal(resolveTourResume(rerecorded,{tourId:'tour',stopRef:stop.id!,index:0}).state,'resumed');
});

test('UX34 compatibility: stop IDs derive as before; the referenced fingerprint never renames a stop',()=>{
 const doc=base(),stop=recordStop(doc,'root',[{kind:'node',id:'function'}],'It returns 1.');
 assert.match(stop.referencedFingerprint!,/^[0-9a-f]{16}$/);
 const {referencedFingerprint:_,...legacy}=stop;
 assert.equal(newStopId([],stop),newStopId([],legacy));
 assert.equal(recorded(doc).tours![0].stops[0].id,newStopId([],legacy));
 const omitted=clone(recorded(doc));omitted.tours![0].stops=[{subjects:[],narration:'',omitted:'stop',referencedFingerprint:stop.referencedFingerprint}];
 assert.throws(()=>validateDocument(omitted),/an omitted stop keeps no view, subjects, fingerprint, narration or ID/);
});

const privateBlock=(id:string)=>({id,type:'code',title:'internal.py',language:'python',code:`SYNTHETIC_PRIVATE_${id.toUpperCase()}`,provenance:'synthetic',visibility:'private'});
const privateSource=(id:string)=>({id,title:`SYNTHETIC_PRIVATE_SOURCE_${id}`,visibility:'private'});
test('UX34 public projection: no hash over private references; one or two private references give identical public output',()=>{
 // Private blocks referenced by the subject. The stop IDs are given: an auto ID derives from the subject object, whose blockIds differ.
 const one=recorded(base({blockIds:['code','rows','p1'],blocks:[privateBlock('p1')]}),'stop-fixed'),two=recorded(base({blockIds:['code','rows','p1','p2'],blocks:[privateBlock('p1'),privateBlock('p2')]}),'stop-fixed');
 assert.notEqual(one.tours![0].stops[0].referencedFingerprint,two.tours![0].stops[0].referencedFingerprint,'the authoring record covers private references');
 const [p1,p2]=[publicDocument(one),publicDocument(two)];
 assert.equal(JSON.stringify(p1.tours),JSON.stringify(p2.tours));
 for(const [doc,pub] of [[one,p1],[two,p2]] as const){
  assert.ok(!JSON.stringify(pub).includes(doc.tours![0].stops[0].referencedFingerprint!),'the authoring hash is not published');
  assert.ok(!JSON.stringify(pub).includes('SYNTHETIC_PRIVATE'));
  assert.equal(status(pub).status,'current');assert.equal(status(pub).coverage,'full');
  assert.deepEqual(publicDocument(pub),pub,'projecting twice changes nothing');
 }
 // Private sources cited by a public referenced block: automatic stop IDs, identical public tours.
 const citing=(ids:string[])=>{const d=clone(base({sources:ids.map(privateSource)}));d.blocks[0].sourceIds=['ref',...ids];return recorded(validateDocument(d));};
 const ra=citing(['q1']),rb=citing(['q1','q2']);
 assert.equal(ra.tours![0].stops[0].id,rb.tours![0].stops[0].id);
 assert.notEqual(ra.tours![0].stops[0].referencedFingerprint,rb.tours![0].stops[0].referencedFingerprint);
 assert.equal(JSON.stringify(publicDocument(ra).tours),JSON.stringify(publicDocument(rb).tours));
});

test('UX34 public projection: a stop stale on referenced content stays stale in the public copy; a legacy stop stays not covered',()=>{
 const doc=recorded(base()),changed=next(doc,d=>{const b=d.blocks[0];if(b.type==='code')b.code='return 2';});
 const pub=publicDocument(changed);assert.equal(status(pub).status,'stale');assert.deepEqual(publicDocument(pub),pub);
 const legacy=clone(doc);delete legacy.tours![0].stops[0].referencedFingerprint;
 const lp=publicDocument(validateDocument(legacy));assert.equal(lp.tours![0].stops[0].referencedFingerprint,undefined);assert.equal(status(lp).coverage,'subjects-only');
});
