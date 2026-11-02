import test from 'node:test';
import assert from 'node:assert/strict';
import {retailOperations} from '../src/data/retailOperations';
import {node,note} from '../src/data/builders';
import {parseDocument,validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {hierarchyRail,isPermittedPath,parentPaths} from '../src/core/hierarchy';
import {viewSpec} from '../src/core/viewspec';
import {portfolioHtml} from '../src/export/html';
import {svgDiagram} from '../src/export/diagram';

test('retail is a complete canonical reference project that round-trips without a separate workspace schema',()=>{
 const d=retailOperations();
 assert.equal(d.id,'retail-operations');assert.equal(d.title,'Retail · opérations & échanges');
 assert.equal(d.category,'Reference');assert.equal(d.schemaVersion,1);
 assert.deepEqual(validateDocument(d),d);
 assert.deepEqual(parseDocument(JSON.stringify(d)),d);
 assert.equal(d.views.length,5);assert.equal(d.story.length,6);
 const fresh=retailOperations();d.nodes[0].label='Edited local instance';
 assert.notEqual(fresh.nodes[0].label,d.nodes[0].label,'loading a template creates independent document data');
});

test('all retail perspectives have a real parent path and navigating down/up retains the overview',()=>{
 const d=retailOperations(),published=publicDocument(d);
 assert.deepEqual(published.views.map(v=>v.id),d.views.map(v=>v.id),'public export retains all authored reachable views');
 for(const v of d.views){
  const found=parentPaths(d,v.id);assert.equal(found.truncated,false);assert.equal(found.paths.length,1);
  const path=found.paths[0];assert(isPermittedPath(d,path.viewIds));
  assert.equal(path.viewIds[0],d.rootViewId);assert.equal(new Set(path.viewIds).size,path.viewIds.length);
  if(v.id===d.rootViewId)continue;
  const via=path.via[0];
  assert.deepEqual(hierarchyRail(d,[d.rootViewId],d.rootViewId,via).down?.path,[d.rootViewId,v.id]);
  const up=hierarchyRail(d,path.viewIds,v.id,null).up;
  assert.deepEqual(up?.path,[d.rootViewId]);assert.equal(up?.selected,via);
 }
 for(const step of d.story)assert(isPermittedPath(d,parentPaths(d,step.viewId).paths[0].viewIds));
});

test('shared components keep one identity and an authored rename reaches every participating view',()=>{
 const d=retailOperations();
 const identity='retail-metadata',subject=d.nodes.find(n=>n.id===identity)!;
 assert.equal(d.nodes.filter(n=>n.id===identity).length,1);
 const views=d.views.filter(v=>v.nodeIds.includes(identity));assert.equal(views.length,5);
 subject.label='Définitions communes';validateDocument(d);
 for(const v of views)assert.equal(viewSpec(d,v.id).nodes.find(n=>n.id===identity)?.label,'Définitions communes');
 const before=JSON.stringify(d);
 for(const v of d.views){viewSpec(d,v.id);hierarchyRail(d,parentPaths(d,v.id).paths[0].viewIds,v.id,identity);}
 assert.equal(JSON.stringify(d),before,'reading perspectives does not duplicate or mutate the shared model');
});

test('retail declarations contain no observed runs, synthetic measurements, schedules or chosen provider integrations',()=>{
 const d=retailOperations();
 assert.equal(d.observations.length,0);assert.equal(d.sources.length,0);assert.equal(d.assets.length,0);
 assert.equal(d.delivery,undefined);assert.equal(d.atlas,undefined);
 assert(d.nodes.every(n=>n.basis==='planned'&&n.status==='idle'));
 assert(d.edges.every(e=>e.basis==='planned'&&e.kind==='dependency'&&!e.quantity));
 assert(d.blocks.every(b=>b.type==='text'&&b.provenance==='synthetic'&&b.sourceIds.length===0));
 assert(d.views.every(v=>/illustrati|questions|proposé|possible|proposition/i.test(v.description)));
 assert.equal(d.nodes.find(n=>n.id==='retail-pos')?.provider,'Generic');
 assert.match(d.nodes.find(n=>n.id==='retail-ftp')!.summary,/protocole exact.*inconnus/);
 assert.match(d.nodes.find(n=>n.id==='retail-api')!.summary,/version.*préciser/);
 assert.match(d.views.find(v=>v.id==='retail-ai-opportunities')!.description,/Aucun modèle ni fournisseur n’est choisi/);
 assert(d.nodes.filter(n=>n.id.endsWith('-role')).every(n=>n.tags.includes('Non attribué')));
});

test('canonical public HTML and SVG include the whole retail journey and redact a subsequently authored private draft',()=>{
 const d=retailOperations(),sentinel='PRIVATE_RETAIL_DRAFT_CANARY';
 d.privateNotes=sentinel;
 node(d,'private-internal-draft',sentinel,'process',{visibility:'private',basis:'planned',summary:sentinel});
 const root=d.views.find(v=>v.id===d.rootViewId)!;
 root.nodeIds.push('private-internal-draft');root.positions['private-internal-draft']={x:1100,y:0};
 note(d,'retail-metadata','private-draft-note','Internal note',sentinel,'author');
 d.blocks.find(b=>b.id==='private-draft-note')!.visibility='private';
 validateDocument(d);
 const published=publicDocument(d),html=portfolioHtml(d);
 assert(!JSON.stringify(published).includes(sentinel));assert(!html.includes(sentinel));
 assert(html.includes("connect-src 'none'"));
 for(const v of published.views){
  assert(html.includes(v.id));
  const svg=svgDiagram(d,v.id);assert(svg.includes('<svg'));assert(!svg.includes(sentinel));
 }
 assert.equal(published.views.length,5);assert.equal(published.story.length,6);
 assert.equal(d.privateNotes,sentinel,'public export must leave the authoring document intact');
});
