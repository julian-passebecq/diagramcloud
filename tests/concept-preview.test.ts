import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema,validateDocument,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {samples} from '../src/data/samples';
import {conceptSpec,authorConceptPreview} from '../src/export/concept';
import {prepareConceptPreview,resolveConceptPick,acceptConceptMessage} from '../src/interop/conceptPreview';
import {checkConceptSpec} from './contracts/mosaicstudio/schema';
const now=new Date('2026-10-14T12:00:00Z');
function project(ids=['app','store'],edges:ReturnType<typeof edge>[]=[]):Project{
 return validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-concept',title:'Synthetic architecture fixture',rootViewId:'root',
  nodes:ids.map(id=>({id,label:id,kind:id==='store'?'storage':'app',basis:'static-source',sourceIds:['source']})),
  edges,views:[{id:'root',title:'Selected view',nodeIds:ids,edgeIds:edges.map(e=>e.id),positions:{}}],
  sources:[{id:'source',title:'Synthetic source fixture',location:'fixture.ts:1',visibility:'public'}]}));
}
const edge=(id:string,source='app',target='store',label=id,kind='query',basis='static-source')=>({id,source,target,label,kind,basis});
const selector=(p:Project)=>({projectId:p.id,baseRevision:p.revision,viewId:p.rootViewId});
function valid(out:ReturnType<typeof conceptSpec>){const result=checkConceptSpec(out.spec);assert.ok(result.ok,JSON.stringify(result));assert.deepEqual(result.warnings,[]);}

test('all public sample views remain accepted by the unmodified owner validator before a build',()=>{
 let checked=0;
 for(const sample of samples){
  const p=publicDocument(sample);
  for(const v of p.views){if(!v.nodeIds.length){assert.throws(()=>conceptSpec(p,v.id,{now}),/No components are available/);continue;}valid(conceptSpec(p,v.id,{now}));checked++;}
 }
 assert.ok(checked>=40,`actual sample views checked: ${checked}`);console.log('Sample view count:',checked);
});
test('reserved Object property is a valid canonical node ID',()=>{
 const out=conceptSpec(project(['constructor','store'],[edge('call','constructor')]),'root',{now});valid(out);assert.equal(out.spec.flows[0].from,'constructor');
});
test('identity allocation is stable when colliding source arrays are reordered',()=>{
 const p=project(['a.b','a-b','a_b','stores','store'],[edge('e','a.b','a-b')]);const one=conceptSpec(p,'root',{now});
 const two=conceptSpec({...p,nodes:[...p.nodes].reverse(),edges:[...p.edges].reverse()},'root',{now});valid(one);valid(two);
 assert.deepEqual(one.report.idMap,two.report.idMap);assert.equal(one.spec.nodes.find(n=>n.id==='a-b')?.label,'a-b');
});
test('dependency is rendered as control and explicitly retains source kind',()=>{
 const out=conceptSpec(project(undefined,[edge('build','app','store','needs','dependency')]),'root',{now});valid(out);
 assert.equal(out.spec.flows[0].kind,'control');assert.match(out.spec.flows[0].label,/dependency/);assert.equal(out.report.edges[0].sourceKind,'dependency');
});
test('long labels retain uncertainty rather than dropping it',()=>{
 const out=conceptSpec(project(undefined,[edge('e','app','store','a'.repeat(90)+' (inferred)')]),'root',{now});valid(out);
 assert.match(out.spec.flows[0].label,/^inferred:/);assert.equal(out.report.edges[0].confidence,'inferred');
});
test('incompatible parallel relations are reported, not re-labelled as one data path',()=>{
 const out=conceptSpec(project(undefined,[edge('q'),edge('d','app','store','needs','dependency')]),'root',{now});valid(out);
 assert.equal(out.spec.flows.length,1);assert.equal(out.report.edges.find(e=>e.sourceId==='d')?.reason,'incompatible-parallel-flow');
});
test('parallel relations of different confidence are not silently combined',()=>{
 const out=conceptSpec(project(undefined,[edge('a','app','store','reads'),edge('b','app','store','reads (possible)')]),'root',{now});
 assert.equal(out.report.edges[1].state,'omitted');valid(out);
});
test('compatible parallel relations keep all source identities and bounded evidence',()=>{
 const out=conceptSpec(project(undefined,[edge('a'),edge('b')]),'root',{now});valid(out);
 assert.equal(out.spec.flows.length,1);assert.equal(out.spec.flows[0].evidence!.length,2);assert.equal(out.report.edges[1].targetId,out.spec.flows[0].id);
});
test('reverse relations are combined only when meanings also match',()=>{
 const p=project(undefined,[edge('a','app','store','x','query'),edge('b','store','app','x','control')]);const out=conceptSpec(p,'root',{now});valid(out);assert.equal(out.spec.flows.length,2);assert.ok(out.spec.flows.every(f=>!f.direction));
});
test('compatible reverse relationships retain their individual source identities',()=>{
 const out=conceptSpec(project(undefined,[edge('a','app','store','reads'),edge('b','store','app','reads')]),'root',{now});valid(out);assert.equal(out.spec.flows[0].direction,'both');assert.equal(out.report.edges.length,2);
});
test('a later parallel label does not invent that label in the reverse direction',()=>{
 const out=conceptSpec(project(undefined,[edge('a','app','store','reads'),edge('b','store','app','reads'),edge('c','app','store','writes')]),'root',{now});valid(out);
 assert.equal(out.spec.flows[0].direction,'both');assert.equal(out.spec.flows[0].label,'reads');assert.equal(out.report.edges[2].state,'omitted');
});
test('merged relations report quantity loss and do not repeat existing labels',()=>{
 const p=project(undefined,[edge('a','app','store','reads'),edge('b','app','store','writes'),edge('c','app','store','reads')]);
 p.edges[1].quantity={value:2,unit:'rows',provenance:'synthetic'};
 const out=conceptSpec(p,'root',{now});valid(out);assert.equal(out.spec.flows[0].label,'reads · writes');assert.match(out.report.lost.join(' '),/b: quantitative width/);
});
test('component uncertainty survives a long summary',()=>{
 const p=project();p.nodes[0].tags=['possible'];p.nodes[0].summary='s'.repeat(500);
 const out=conceptSpec(p,'root',{now});valid(out);assert.match(out.spec.nodes[0].description!,/Confidence: possible\./);
});
test('crowded domains report omitted nodes and every affected edge',()=>{
 const ids=Array.from({length:30},(_,i)=>'node-'+i);const p=project(ids,ids.slice(1).map((id,i)=>edge('edge-'+i,ids[0],id)));
 const out=conceptSpec(p,'root',{now});valid(out);assert.equal(out.report.nodes.length,30);assert.equal(out.report.edges.length,29);assert.ok(out.report.edges.some(e=>e.reason==='endpoint-omitted'));
});
test('the 40-node budget never silently loses source identities',()=>{
 const p=project(Array.from({length:48},(_,i)=>'node-'+i));p.nodes.forEach((n,i)=>n.kind=i%2?'storage':'app');
 const out=conceptSpec(p,'root',{now});valid(out);assert.equal(out.report.nodes.length,48);assert.equal(out.report.nodes.filter(n=>n.reason==='node-limit').length,8);
});
test('self loops are a visible target limitation rather than an invalid concept file',()=>{
 const out=conceptSpec(project(undefined,[edge('loop','app','app')]),'root',{now});valid(out);assert.equal(out.spec.flows.length,0);assert.equal(out.report.edges[0].reason,'self-flow-unsupported');
});
test('public output never includes private component or source metadata',()=>{
 const p=project(['app','store','secret']);p.nodes[2].visibility='private';p.nodes[2].label='PRIVATE_SENTINEL';
 p.sources.push({id:'secret-source',title:'SECRET_SOURCE',location:'private.ts',visibility:'private'});p.nodes[0].sourceIds.push('secret-source');
 const out=conceptSpec(p,'root',{now});valid(out);assert.doesNotMatch(JSON.stringify(out),/PRIVATE_SENTINEL|SECRET_SOURCE|secret-source/);
});
test('a completely private public view has an actionable empty state, not invalid output',()=>{
 const p=project();p.nodes.forEach(n=>n.visibility='private');assert.throws(()=>conceptSpec(p,'root',{now}),/No components/);
});
test('the explicitly selected author preview renders private nodes without changing their visibility',()=>{
 const p=project();p.nodes[0].visibility='private';p.nodes[0].label='PRIVATE_FIXTURE';const before=JSON.stringify(p);
 const out=authorConceptPreview(p,selector(p),{now});valid(out);assert.equal(out.report.audience,'author');assert.match(JSON.stringify(out.spec),/PRIVATE_FIXTURE/);assert.equal(JSON.stringify(p),before);
 assert.doesNotMatch(JSON.stringify(conceptSpec(p,'root',{now})),/PRIVATE_FIXTURE/);
});
test('a private preview never includes unattached private notes or an unrelated private source',()=>{
 const p=project();p.privateNotes='PRIVATE_NOTES_NEVER_SENT';p.sources.push({id:'outside',title:'OUTSIDE_SOURCE',visibility:'private',location:'outside.md'});
 const out=authorConceptPreview(p,selector(p),{now});assert.doesNotMatch(JSON.stringify(out),/PRIVATE_NOTES_NEVER_SENT|OUTSIDE_SOURCE/);
});
test('stale and mismatched author selections are rejected before projection',()=>{
 const p=project();assert.throws(()=>authorConceptPreview(p,{...selector(p),baseRevision:123}),/stale/);assert.throws(()=>authorConceptPreview(p,{...selector(p),projectId:'other'}),/another project/);
});
test('source URIs are omitted with a reason instead of becoming truncated locators',()=>{
 const p=project();p.sources[0].url='https://example.test/'+('x'.repeat(600));const out=conceptSpec(p,'root',{now});valid(out);assert.ok(!out.spec.nodes[0].evidence?.some(e=>e.kind==='url'));assert.match(out.report.lost.join(' '),/omitted rather than truncated/);
});
test('unknown basis stays explicit and is not described as healthy runtime',()=>{
 const p=project();p.nodes[0].basis='unknown';const out=conceptSpec(p,'root',{now});valid(out);assert.match(out.spec.nodes[0].description!,/not runtime health/);assert.match(out.spec.note,/active means present, not healthy/);
});
test('quantitative flow loss is reported',()=>{
 const p=project(undefined,[edge('q')]);p.edges[0].quantity={value:4,unit:'rows',provenance:'synthetic',note:'fixture'};
 const out=conceptSpec(p,'root',{now});valid(out);assert.match(out.report.lost.join(' '),/quantitative width/);
});
test('preview hashes bind content and stay deterministic with an explicit timestamp',async()=>{
 const p=project();const a=await prepareConceptPreview(p,selector(p),{audience:'author',now});const b=await prepareConceptPreview(p,selector(p),{audience:'author',now});assert.equal(a.projectionSha256,b.projectionSha256);
 p.nodes[0].label='changed without version bump';const c=await prepareConceptPreview(p,selector(p),{audience:'author',now});assert.notEqual(a.projectionSha256,c.projectionSha256);
});
test('selection returns canonical IDs and exposes merged-flow ambiguity',async()=>{
 const p=project(undefined,[edge('a'),edge('b')]);const packet=await prepareConceptPreview(p,selector(p),{audience:'author',now});
 const result=resolveConceptPick(packet,{format:'diagramcloud.concept-pick',version:1,projectionSha256:packet.projectionSha256,kind:'flow',targetId:packet.projection.spec.flows[0].id});
 assert.ok(result.ok);assert.deepEqual(result.sourceIds,['a','b']);assert.equal(result.ambiguous,true);
});
test('stale selection, arbitrary commands and unknown IDs are refused',async()=>{
 const p=project();const packet=await prepareConceptPreview(p,selector(p),{audience:'public',now});
 const msg={format:'diagramcloud.concept-pick',version:1,projectionSha256:packet.projectionSha256,kind:'node',targetId:'app'};
 assert.deepEqual(resolveConceptPick(packet,{...msg,projectionSha256:'0'.repeat(64)}),{ok:false,reason:'stale-projection'});
 assert.deepEqual(resolveConceptPick(packet,{...msg,command:'delete'}),{ok:false,reason:'invalid-message'});
 assert.deepEqual(resolveConceptPick(packet,{...msg,targetId:'missing'}),{ok:false,reason:'unknown-target'});
});
test('browser messages require the exact bound origin AND source window',async()=>{
 const p=project();const packet=await prepareConceptPreview(p,selector(p),{audience:'public',now});const source={} as Window;
 const data={format:'diagramcloud.concept-pick',version:1,projectionSha256:packet.projectionSha256,kind:'node',targetId:'app'};
 const event={data,origin:'http://localhost:8900',source};const binding={origin:event.origin,source};
 assert.ok(acceptConceptMessage(packet,event,binding).ok);
 assert.deepEqual(acceptConceptMessage(packet,{...event,origin:'https://example.test'},binding),{ok:false,reason:'untrusted-origin'});
 assert.deepEqual(acceptConceptMessage(packet,{...event,source:{} as Window},binding),{ok:false,reason:'untrusted-window'});
 for(const origin of ['*','null','file://','http://localhost:8900/path'])assert.deepEqual(acceptConceptMessage(packet,event,{source,origin}),{ok:false,reason:'untrusted-origin'});
});
test('unknown audience is not a downgrade to a permissive route',async()=>{
 const p=project();await assert.rejects(()=>prepareConceptPreview(p,selector(p),{audience:'unexpected' as 'public',now}),/explicit supported/);
});


test('node and edge IDs have independent source namespaces but unique target identities',()=>{
 const p=project(undefined,[edge('app')]);const out=conceptSpec(p,'root',{now});valid(out);
 assert.equal(out.spec.nodes.find(n=>n.label==='app')?.id,'app');assert.notEqual(out.spec.flows[0].id,'app');
 assert.equal(out.report.edges[0].sourceId,'app');assert.equal(out.report.nodes[0].sourceId,'app');
});
test('different long reverse labels are not merged just because their clipped labels match',()=>{
 const long='x'.repeat(100),p=project(undefined,[edge('a','app','store',long+'A'),edge('b','store','app',long+'B')]);
 const out=conceptSpec(p,'root',{now});valid(out);assert.equal(out.spec.flows.length,2);assert.ok(out.spec.flows.every(f=>!f.direction));
});
test('long node summary does not cut off unknown-basis caution',()=>{
 const p=project();p.nodes[0].summary='s'.repeat(500);p.nodes[0].basis='unknown';const out=conceptSpec(p,'root',{now});valid(out);
 assert.match(out.spec.nodes[0].description!,/^Basis not established/);
});
test('private warning starts the bounded note before optional source detail',()=>{
 const p=project();const out=authorConceptPreview(p,selector(p),{now});valid(out);
 assert.match(out.spec.note,/^PRIVATE author preview; not for public publication\. Not live telemetry/);
});

test('public exporter does not accept an author audience through an extra option',()=>{
 const p=project();p.nodes[0].visibility='private';const options={now,audience:'author'};
 const out=conceptSpec(p,'root',options);assert.equal(out.report.audience,'public');assert.ok(!out.report.nodes.some(n=>n.sourceId==='app'));
});
test('private selected-view preview omits unrelated snapshot repository metadata',()=>{
 const p=project();p.atlas={activeSnapshotId:'snap',snapshots:[{id:'snap',capturedAt:now.toISOString(),runtimeRefs:[],contextRefs:[],repositories:[
  {id:'in-scope',title:'Selected repo',host:'local',locator:'selected',nodeId:'app',revision:'a'.repeat(40),scanStatus:'scanned',scannedAt:now.toISOString(),authority:'author'},
  {id:'out-of-scope-sentinel',title:'Unrelated private repository',host:'local',locator:'outside',revision:'b'.repeat(40),scanStatus:'not-scanned',authority:'author'}]}]};
 const out=authorConceptPreview(p,selector(p),{now});valid(out);assert.match(out.spec.note,/in-scope/);assert.doesNotMatch(JSON.stringify(out),/out-of-scope-sentinel|Unrelated private repository/);
});
