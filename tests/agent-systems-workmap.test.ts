import test from 'node:test';
import assert from 'node:assert/strict';
import {agentSystemsWorkmap} from '../src/data/agentSystemsWorkmap';
import {samples} from '../src/data/samples';
import {node,note} from '../src/data/builders';
import {parseDocument,validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {hierarchyRail,isPermittedPath,parentPaths} from '../src/core/hierarchy';
import {viewSpec} from '../src/core/viewspec';
import {galleryBucket,galleryCaption} from '../src/ui/Gallery';
import {portfolioHtml} from '../src/export/html';
import {svgDiagram} from '../src/export/diagram';

test('agent work map validates, round-trips and joins the ordinary work catalogue',()=>{
 const d=agentSystemsWorkmap();
 assert.deepEqual(validateDocument(d),d);assert.deepEqual(parseDocument(JSON.stringify(d)),d);
 assert.equal(d.category,'Reference');assert(d.tags.includes('Work map'));
 assert.equal(galleryBucket(d),'work');assert.equal(galleryCaption(d),'Illustrative work map');
 assert.equal(samples.filter(p=>p.id===d.id).length,1);
 assert.equal(d.views.length,8);assert.equal(d.story.length,7);
 d.nodes[0].label='Local draft';assert.notEqual(agentSystemsWorkmap().nodes[0].label,'Local draft');
});

test('every view and story has one acyclic parent-retaining path in both audiences',()=>{
 for(const d of [agentSystemsWorkmap(),publicDocument(agentSystemsWorkmap())]){
  for(const v of d.views){
   const found=parentPaths(d,v.id);assert.equal(found.truncated,false);assert.equal(found.paths.length,1);
   const path=found.paths[0];assert(isPermittedPath(d,path.viewIds));
   assert.equal(path.viewIds[0],'overview');assert.equal(new Set(path.viewIds).size,path.viewIds.length);
   assert(v.nodeIds.length<=9);assert.equal(Object.keys(v.positions).length,v.nodeIds.length);
   if(v.id==='overview')continue;
   assert.deepEqual(path.viewIds,['overview',v.id]);
   assert.deepEqual(hierarchyRail(d,['overview'],'overview',path.via[0]).down?.path,path.viewIds);
   const up=hierarchyRail(d,path.viewIds,v.id,null).up;
   assert.deepEqual(up?.path,['overview']);assert.equal(up?.selected,path.via[0]);
  }
  for(const s of d.story){
   assert(d.views.find(v=>v.id===s.viewId)!.nodeIds.includes(s.nodeId!));
   assert.match(s.narration,/Presentation order, not timing or a run/);
  }
 }
 const cyclic=agentSystemsWorkmap();cyclic.nodes.find(n=>n.id==='archive')!.childViewId='overview';
 assert.throws(()=>validateDocument(cyclic));
});

test('profiles and memory reuse canonical identities without navigation mutations',()=>{
 const d=agentSystemsWorkmap();
 for(const id of ['project','archive','notes','context','artifacts','criteria','receipts']){
  assert.equal(d.nodes.filter(n=>n.id===id).length,1);
  const views=d.views.filter(v=>v.nodeIds.includes(id));assert(views.length>=2);
  d.nodes.find(n=>n.id===id)!.label=`Shared ${id}`;
  for(const v of views)assert.equal(viewSpec(d,v.id).nodes.find(n=>n.id===id)?.label,`Shared ${id}`);
 }
 const profiles=d.views.find(v=>v.id==='profile-design')!;
 for(const id of ['direct-profile','host-profile','project','notes','context'])assert(profiles.nodeIds.includes(id));
 for(const profile of ['direct-profile','host-profile']){
  assert(d.edges.some(e=>e.source===profile&&e.target==='project'));
  assert(d.edges.some(e=>e.source==='context'&&e.target===profile));
 }
 const before=JSON.stringify(d);
 for(const v of d.views){viewSpec(d,v.id);parentPaths(d,v.id);}
 assert.equal(JSON.stringify(d),before);
});

test('unknown baseline stays separate from planned target with no results or numeric telemetry',()=>{
 const d=agentSystemsWorkmap(),baseline=d.views.find(v=>v.id==='baseline')!;
 assert.equal(d.observations.length,0);assert.equal(d.assets.length,0);
 assert.equal(d.delivery,undefined);assert.equal(d.atlas,undefined);
 for(const n of d.nodes){
  assert.equal(n.status,'idle');assert.equal(n.provider,'Generic');
  assert.equal(n.basis,baseline.nodeIds.includes(n.id)?'unknown':'planned');
  if(n.basis==='unknown')assert.match(n.summary,/UNKNOWN \/ to verify/);
 }
 assert(d.views.find(v=>v.id==='target-design')!.nodeIds.every(id=>!baseline.nodeIds.includes(id)));
 assert(d.edges.every(e=>e.basis==='planned'&&e.kind==='dependency'&&e.quantity===undefined));
 assert(d.blocks.every(b=>b.type==='text'||b.type==='table'));
 for(const b of d.blocks){
  if(b.type==='table')for(const row of b.rows)for(const cell of row){
   assert.equal(typeof cell,'string');assert(!/\d/.test(String(cell)),'no numeric results in synthetic tables');
  }
 }
 const telemetry=d.blocks.find(b=>b.id==='factory-unknowns')!;assert.equal(telemetry.type,'table');
 if(telemetry.type==='table')assert(telemetry.rows.every(row=>row[1]==='UNKNOWN'));
 assert.match(d.nodes.find(n=>n.id==='host-profile')!.summary,/No T3 integration/);
});

test('literature motivation is isolated from bounded synthetic verification artifacts',()=>{
 const d=agentSystemsWorkmap(),derived=d.blocks.filter(b=>b.provenance==='source-derived');
 assert.equal(derived.length,1);assert.deepEqual(derived[0].sourceIds,['memory-layering-reference']);
 assert.equal(d.sources.length,1);assert.match(d.sources[0].url!,/anthropic.com\/research\/components-of-agent-memory$/);
 for(const b of d.blocks.filter(b=>b!==derived[0])){
  assert.equal(b.provenance,'synthetic');assert.deepEqual(b.sourceIds,[]);
  if(b.type==='table'){assert(b.rows.length<=(b.id==='work-contract'?6:5));assert(b.rows.length>=4);}
 }
 const work=d.blocks.find(b=>b.id==='work-contract')!;assert.equal(work.type,'table');
 if(work.type==='table')assert.deepEqual(work.rows.map(r=>r[0]),['Architecture','Implementation','Review','Test','Debug','Tech-lead']);
 for(const b of d.blocks)assert(d.nodes.some(n=>n.blockIds.includes(b.id)),`${b.id} is navigable evidence`);
});

test('public JSON, HTML and every SVG redact a synthetic canary without mutating authoring data',()=>{
 const d=agentSystemsWorkmap(),canary='SYNTHETIC_PRIVATE_WORKMAP_CANARY';
 d.privateNotes=canary;
 node(d,'private-draft',canary,'process',{basis:'planned',visibility:'private',summary:canary});
 const root=d.views.find(v=>v.id==='overview')!;root.nodeIds.push('private-draft');root.positions['private-draft']={x:1200,y:0};
 note(d,'project','private-note','Private draft',canary,'synthetic');d.blocks.find(b=>b.id==='private-note')!.visibility='private';
 validateDocument(d);const before=JSON.stringify(d),published=publicDocument(d),html=portfolioHtml(d);
 assert(!JSON.stringify(published).includes(canary));assert(!html.includes(canary));
 assert(html.includes("connect-src 'none'"));assert(html.includes('Presentation order, not timing or a run'));
 assert.equal(published.views.length,8);
 for(const v of d.views){const svg=svgDiagram(d,v.id);assert(svg.includes('<svg'));assert(!svg.includes(canary));assert(html.includes(v.id));}
 assert.equal(JSON.stringify(d),before);
});
