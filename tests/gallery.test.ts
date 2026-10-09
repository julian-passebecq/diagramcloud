import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudGallery} from '../src/data/cloudGallery';
import {samples} from '../src/data/samples';
import {validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {galleryBucket,galleryCaption,projectMark} from '../src/ui/Gallery';
import {svgDiagram} from '../src/export/diagram';

const gallery=cloudGallery();

test('cloud gallery: AWS, Azure, Google Cloud, Kubernetes and event-driven references, all in the samples',()=>{
 assert.deepEqual(gallery.map(p=>p.tags[0]),['AWS','Azure','Google Cloud','Kubernetes','Event-driven']);
 for(const p of gallery)assert.ok(samples.some(s=>s.id===p.id),p.id);
 assert.equal(new Set(samples.map(s=>s.id)).size,samples.length,'sample IDs are unique');
});

test('cloud gallery: each reference validates, drills down with its parent kept, cites official HTTPS guidance and labels synthetic evidence',()=>{
 for(const p of gallery){
  validateDocument(p);
  assert.equal(p.category,'Reference');assert.match(p.provenance,/Not a vendor-approved architecture/);
  const root=p.views.find(v=>v.id===p.rootViewId)!,drill=p.nodes.filter(n=>root.nodeIds.includes(n.id)&&n.childViewId);
  assert.ok(drill.length>=1,`${p.id} has a drilldown`);
  assert.ok(p.sources.length>=2&&p.sources.every(s=>s.url?.startsWith('https://')),`${p.id} cites official guidance`);
  assert.ok(p.nodes.every(n=>n.icon==='generic'),'no vendor artwork without its terms review');
  assert.ok(p.blocks.filter(b=>b.type==='code'||b.type==='table').every(b=>b.provenance==='synthetic'),`${p.id}: code and rows are synthetic`);
  assert.ok(p.blocks.some(b=>b.provenance==='reference'||b.provenance==='author'),`${p.id} explains a decision`);
  assert.equal(p.story.length,2);
  assert.equal(publicDocument(p).nodes.length,p.nodes.length,'everything in a reference is public');
  assert.match(svgDiagram(p),new RegExp(p.nodes.find(n=>root.nodeIds.includes(n.id))!.label.replace(/[+()]/g,'.')));
 }
});

test('gallery buckets and marks',()=>{
 assert.equal(galleryBucket(samples.find(s=>s.id==='total-project-controls')!),'portfolio');
 assert.equal(galleryBucket(samples.find(s=>s.id==='fabric-medallion')!),'cloud');
 assert.equal(galleryBucket(samples.find(s=>s.id==='blank-project')!),'mine');
 assert.deepEqual(gallery.map(projectMark),['A','Az','G','K8','E']);
 // The DataPass planning maps are the author's own work: portfolio, never presented as vendor cloud references.
 for(const id of ['project-constellation','datapass-platform']){const s=samples.find(s=>s.id===id)!;assert.equal(galleryBucket(s),'portfolio',id);assert.equal(galleryCaption(s),'Portfolio map');}
 assert.deepEqual(samples.filter(s=>galleryBucket(s)==='cloud').map(s=>s.id),['fabric-medallion','databricks-reference',...gallery.map(p=>p.id),'contoso-forecasting']);
 assert.equal(galleryCaption(gallery[0]),'Cloud architecture · AWS');
});


test('generated cookbook is a separate synthetic recipe gallery rather than vendor cloud references',()=>{
 const recipes=samples.filter(p=>galleryBucket(p)==='recipes');assert.equal(recipes.length,5);assert.ok(recipes.every(p=>p.tags.includes('Cookbook')&&p.blocks.every(b=>b.provenance==='synthetic')&&p.observations.length===0));assert.ok(recipes.every(p=>galleryCaption(p)==='Synthetic reference recipe'));assert.ok(recipes.some(p=>p.tags.includes('documents')));
});
