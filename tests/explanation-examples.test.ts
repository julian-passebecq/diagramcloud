import test from 'node:test';import assert from 'node:assert/strict';
import {teachingCases,teachingProject,dataModelPack} from '../examples/pro-expressiveness/cases';
import {publicDocument} from '../src/core/operations';import {tourStops} from '../src/core/tours';
import {relatedContext} from '../src/core/relatedContext';import {validatePack,publicPack} from '../src/experience/model';
for(const c of teachingCases())test('native teaching fixture '+c.id+' retains valid steps, sources and explicit synthetic basis',()=>{
 const p=teachingProject(c);assert.ok(p.story.length>=3);assert.equal(p.observations.length,0);assert.ok(p.blocks.every(b=>b.provenance==='synthetic'||b.provenance==='author'));
 assert.deepEqual(tourStops(p,p.tours![0]).map(s=>s.status),p.story.map(()=>'current'));
 assert.equal(publicDocument(p).views.length,p.views.length);assert.equal(publicDocument(p).story.length,p.story.length);
 const r=relatedContext(p,{projectId:p.id,baseRevision:p.revision,viewId:'overview',nodeId:c.base.nodes[0].id,audience:'public'});assert.equal(r.state,'available');
});
test('native experience schema supports the declared star model and formula without adding a model engine',()=>{const p=dataModelPack();assert.deepEqual(validatePack(p),p);const pub=publicPack(p);assert.equal(pub.items.length,3);assert.equal(pub.items.find(i=>i.type==='model')?.type,'model');});
test('native model still rejects nonexistent relationship columns',()=>{const p=dataModelPack();const m=p.items.find(i=>i.type==='model');if(m?.type==='model')m.relationships[0].to='Customer.Missing';assert.throws(()=>validatePack(p),/unknown column/);});
test('join-grain fixture values are internally consistent, not a measurement',()=>{const totals=[20,15];assert.equal(totals.reduce((a,b)=>a+b,0),35);assert.equal(totals.flatMap(x=>[x,x]).reduce((a,b)=>a+b,0),70);});
