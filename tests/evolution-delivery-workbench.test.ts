import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema,validateDocument,type Project} from '../src/core/model';
import {applyDocumentPatch} from '../src/core/patch';
import {observationPatch} from '../src/core/realization';
import {publicDocument,removeNode} from '../src/core/operations';
import {evolutionSnapshot,compareEvolutionSnapshots,retainEvolutionSnapshotPatch,readEvolutionHistory,migrationPlanPatch,evolutionRecipes} from '../src/intelligence/evolution';
import {previewDeliveryBrief,deliveryCoverageMatrix,compareEnvironments,deliveryGates,releaseChain} from '../src/intelligence/delivery';
const at='2026-10-09T00:00:00Z';
const project=()=>documentSchema.parse({schemaVersion:1,id:'synthetic-evolution',title:'Synthetic workbench',rootViewId:'root',nodes:[{id:'api',label:'API',sourceIds:['source'],tags:['confirmed'],basis:'static-source'},{id:'data',label:'Data',sourceIds:['source'],basis:'static-source'}],edges:[{id:'reads',source:'api',target:'data',label:'reads',basis:'static-source'}],views:[{id:'root',title:'System',nodeIds:['api','data'],edgeIds:['reads'],positions:{api:{x:0,y:0},data:{x:300,y:0}}}],sources:[{id:'source',title:'Synthetic source',location:'src/api.ts:8 @ aaaaaaa'}]});
const snapshot=(p:Project,id='before')=>evolutionSnapshot(p,{id,capturedAt:at});
const delivery=(p=project())=>previewDeliveryBrief(p,{format:'diagramcloud.delivery-brief',version:1,projectId:p.id,baseRevision:p.revision,delivery:{environments:[{id:'dev',label:'Development',role:'preview',lifecycle:'ephemeral',bindings:[{kind:'region',label:'Synthetic region',sourceIds:['source']},{kind:'backup',label:'Declared backup intent'}]},{id:'prod',label:'Production'}],artifacts:[{id:'artifact',label:'Build output',version:'candidate',digest:'sha256:'+'a'.repeat(64),sourceRevision:'aaaaaaa',buildId:'build-run-42'}],releases:[{id:'release',label:'Candidate release',artifactIds:['artifact']}],instances:[{id:'api-dev',nodeId:'instance-dev',componentId:'api',environmentId:'dev',artifactId:'artifact',releaseId:'release',declaredRevision:'aaaaaaa'},{id:'api-prod',nodeId:'instance-prod',componentId:'api',environmentId:'prod',artifactId:'artifact',releaseId:'release',declaredRevision:'bbbbbbb'}],promotions:[{id:'promotion',fromEnvironmentId:'dev',toEnvironmentId:'prod',artifactId:'artifact',gates:[{id:'gate',label:'Reviewed external gate evidence'}]}],applicability:[{id:'na',componentId:'data',environmentId:'dev',state:'not-applicable',reason:'Synthetic author planning exclusion'}],configurations:[{id:'flag',componentId:'api',environmentId:'prod',kind:'flag',name:'Synthetic feature',valueState:'declared-disabled'}]}}).document;
function addReviewedFixture(p:Project,nodeId:string,id:string,revision:string,observedAt=at){
 const result=applyDocumentPatch(p,observationPatch(p,{id,nodeId,sourceApp:'external',authority:'Synthetic unit-test authority',observedAt,sourceRevision:revision,claim:'verified',summary:'Synthetic test fixture; no deployed system',caveat:'Unit-test fixture only'})).result;
 // Simulate the human review operation in the test harness, never in a producer.
 result.observations.at(-1)!.reviewedAt=at;return validateDocument(result);
}
test('source-qualified evolution separates meaning, layout, confidence and absence deterministically',()=>{
 const before=project(),after=structuredClone(before);after.nodes[0].label='Renamed API';after.nodes[0].tags=['possible'];after.views[0].positions.api={x:33,y:44};after.nodes=after.nodes.filter(n=>n.id!=='data');after.edges=[];after.views[0].nodeIds=['api'];after.views[0].edgeIds=[];delete after.views[0].positions.data;
 const a=snapshot(before),b=snapshot(after,'after'),delta=compareEvolutionSnapshots(a,b);assert.equal(delta.state,'partial');assert.deepEqual(delta,compareEvolutionSnapshots(a,b));
 for(const kind of ['changed','moved','confidence'])assert.ok(delta.changes.some(c=>c.id==='api'&&c.change===kind));assert.ok(delta.changes.some(c=>c.id==='data'&&c.change==='not-in-scope'));assert.ok(!delta.changes.some(c=>c.change as string==='removed'));assert.equal(delta.changes.find(c=>c.change==='changed')?.sourceRefs[0],'src/api.ts:8 @ aaaaaaa');
 b.scope.profile='other-profile';assert.equal(compareEvolutionSnapshots(a,b).state,'incomparable');assert.equal(compareEvolutionSnapshots(a,b).changes.length,0);
});
test('retained evolution receipts survive authoring reload and cannot overwrite immutable snapshot identity or leak publicly',()=>{
 const p=project(),a=snapshot(p),retained=applyDocumentPatch(p,retainEvolutionSnapshotPatch(p,a)).result;assert.equal(p.blocks.length,0);assert.equal(readEvolutionHistory(validateDocument(JSON.parse(JSON.stringify(retained)))).snapshots.length,1);
 const conflicting=structuredClone(a);conflicting.label='Conflicting identity';assert.throws(()=>retainEvolutionSnapshotPatch(retained,conflicting),/Immutable/);
 const toggled=structuredClone(retained);for(const b of toggled.blocks)b.visibility='public';assert.ok(!JSON.stringify(publicDocument(toggled)).includes('diagramcloud.evolution-snapshot'));assert.equal(retained.observations.length,0);
 const corrupt=structuredClone(retained);if(corrupt.blocks[0].type==='code')corrupt.blocks[0].code='{"invalid":';assert.throws(()=>retainEvolutionSnapshotPatch(corrupt,snapshot(p,'new')),/repair/);assert.equal(corrupt.blocks[0].type==='code'&&corrupt.blocks[0].code,'{"invalid":');
});
test('presentation changes do not masquerade as component moves or source meaning changes',()=>{
 const before=project(),after=structuredClone(before);after.nodes[0].icon='generic-api';after.nodes[0].status='complete';after.edges[0].speed='fast';const delta=compareEvolutionSnapshots(snapshot(before),snapshot(after,'after'));assert.equal(delta.changes.filter(c=>c.change==='presentation').length,2);assert.ok(!delta.changes.some(c=>c.change==='moved'||c.change==='changed'));
});
test('snapshot evidence is deduplicated across shared component references and still detects exact content changes',()=>{
 const p=project();p.blocks.push({id:'shared',title:'Synthetic shared evidence',type:'code',language:'text',code:'synthetic evidence '.repeat(2000),sourceIds:[],visibility:'private',provenance:'synthetic'});for(let i=0;i<80;i++){const id='component-'+i;p.nodes.push({...structuredClone(p.nodes[0]),id,label:'Synthetic '+i,blockIds:['shared']});p.views[0].nodeIds.push(id);}const a=snapshot(p);assert.equal(a.evidence.length,1);assert.ok(JSON.stringify(a).length<200000);const next=structuredClone(p);if(next.blocks[0].type==='code')next.blocks[0].code+='changed';const delta=compareEvolutionSnapshots(a,snapshot(next,'after'));assert.equal(delta.changes.filter(c=>c.change==='changed').length,80);assert.doesNotThrow(()=>retainEvolutionSnapshotPatch(p,a));
});
test('confidence evolution qualifies reviewed claims against independent exact repository revisions',()=>{
 let p=project();p.nodes[0].id='repo.api';p.edges[0].source='repo.api';p.views[0].nodeIds[0]='repo.api';p.views[0].positions['repo.api']=p.views[0].positions.api;delete p.views[0].positions.api;
 p.atlas={activeSnapshotId:'capture',snapshots:[{id:'capture',capturedAt:at,repositories:[{id:'repo',title:'Synthetic repository',host:'local',locator:'synthetic',revision:'aaaaaaa',scanStatus:'scanned',authority:'git',scannedAt:at}],runtimeRefs:[],contextRefs:[]}]};
 p=addReviewedFixture(p,'repo.api','claim','aaaaaaa');const a=snapshot(p);assert.equal(a.nodes[0].claims[0].freshness,'exact-revision');p.atlas!.snapshots[0].repositories[0].revision='bbbbbbb';const b=snapshot(p,'after'),delta=compareEvolutionSnapshots(a,b);assert.equal(b.nodes[0].claims[0].freshness,'stale-revision');assert.ok(delta.changes.some(c=>c.change==='verification'));assert.equal(delta.staleEvidence[0].sourceRevision,'aaaaaaa');assert.equal(delta.after.revisionVector[0].revision,'bbbbbbb');assert.ok(evolutionRecipes(b).find(r=>r.kind==='project')!.entities.length>0);
});
test('migration plans reference existing facts, remain planned and enter only through a guarded private patch',()=>{
 const p=project(),plan={format:'diagramcloud.migration-plan/1',id:'migration',projectId:p.id,label:'Synthetic migration',phases:[{id:'target',label:'Future API',stage:'target',basis:'planned',nodeIds:['api'],sourceIds:['source'],note:'Coexistence then owner-selected cutover'}],coexistence:'Planned coexistence',cutover:'Owner decision pending',rollback:'Retain old design'};
 const patch=migrationPlanPatch(p,plan),next=applyDocumentPatch(p,patch).result;assert.deepEqual(next.nodes.map(n=>({id:n.id,label:n.label,status:n.status})),p.nodes.map(n=>({id:n.id,label:n.label,status:n.status})));assert.equal(next.observations.length,0);assert.equal(readEvolutionHistory(next).plans[0].phases[0].basis,'planned');assert.ok(!JSON.stringify(publicDocument(next)).includes('Owner decision pending'));assert.throws(()=>migrationPlanPatch(p,{...plan,phases:[{...plan.phases[0],basis:'observed'}]}));assert.throws(()=>migrationPlanPatch(p,{...plan,phases:[{...plan.phases[0],nodeIds:['missing']}]}),/Unknown/);assert.throws(()=>applyDocumentPatch({...p,revision:1},patch),/Stale/);
});
test('typed delivery distinguishes unknown/not-applicable cells and preserves separate source/build/digest/release identities',()=>{
 const d=delivery(),matrix=deliveryCoverageMatrix(d,{componentIds:['api','data'],at});assert.equal(matrix.length,4);assert.equal(matrix.find(r=>r.componentId==='data'&&r.environmentId==='dev')?.state,'not-applicable');assert.equal(matrix.find(r=>r.componentId==='data'&&r.environmentId==='prod')?.state,'UNKNOWN');assert.equal(matrix.find(r=>r.componentId==='api')?.state,'declared');
 const chain=releaseChain(d)[0];assert.equal(chain.sourceRevision,'aaaaaaa');assert.equal(chain.buildId,'build-run-42');assert.equal(chain.digest,'sha256:'+'a'.repeat(64));assert.equal(chain.releases[0].id,'release');assert.equal(chain.instances.length,2);assert.equal(d.observations.length,0);assert.equal(compareEnvironments(d,'dev','prod',{at})[0].declaredComparison,'different-declarations');assert.equal(compareEnvironments(d,'dev','prod',{at})[0].observedComparison,'UNKNOWN');
 const clean=removeNode(d,'data');assert.equal(clean.delivery?.applicability?.length,0);assert.doesNotThrow(()=>validateDocument(clean));
});
test('reviewed external comparison and gate evidence carry timestamp policy without assuming source declarations are runtime',()=>{
 let d=delivery();d=addReviewedFixture(d,'instance-dev','dev-claim','aaaaaaa','2026-10-08T23:00:00Z');d=addReviewedFixture(d,'instance-prod','prod-claim','aaaaaaa','2026-10-08T22:00:00Z');d.delivery!.promotions[0].gates[0].observationId='dev-claim';assert.equal(compareEnvironments(d,'dev','prod',{at,maxAgeHours:3})[0].observedComparison,'same-observed-revision');assert.equal(compareEnvironments(d,'dev','prod',{at,maxAgeHours:1.5})[0].observedComparison,'UNKNOWN');const g=deliveryGates(d,{at,maxAgeHours:2})[0].gates[0];assert.equal(g.freshness,'within-selected-age');assert.equal(g.revisionMatch,'exact-source-revision');d.delivery!.artifacts[0].sourceRevision='bbbbbbb';assert.equal(deliveryGates(d,{at,maxAgeHours:2})[0].gates[0].revisionMatch,'different-source-revision');
});
test('typed config and facet metadata retain nested private boundary with public release closure',()=>{
 const d=delivery();for(const n of d.nodes)n.visibility='public';d.views[0].nodeIds.push('instance-dev','instance-prod');for(const e of d.delivery!.environments)e.visibility='public';for(const i of d.delivery!.instances)i.visibility='public';for(const a of d.delivery!.artifacts)a.visibility='public';d.delivery!.environments[0].bindings![0].visibility='public';d.delivery!.environments[0].bindings![1].label='PRIVATE_BACKUP_SENTINEL';d.delivery!.configurations![0].name='PRIVATE_CONFIG_SENTINEL';d.delivery!.releases![0].label='PRIVATE_RELEASE_SENTINEL';
 const safe=publicDocument(d),raw=JSON.stringify(safe);for(const marker of ['PRIVATE_BACKUP_SENTINEL','PRIVATE_CONFIG_SENTINEL','PRIVATE_RELEASE_SENTINEL'])assert.ok(!raw.includes(marker));assert.equal(safe.delivery?.instances[0].releaseId,undefined);assert.equal(safe.delivery?.environments[0].bindings?.length,1);assert.ok(raw.includes('Synthetic region'));assert.doesNotThrow(()=>validateDocument(safe));
 const invalid=structuredClone(d) as unknown as Record<string,unknown>;((invalid.delivery as {configurations:Record<string,unknown>[]}).configurations[0]).value='must-not-be-collected';assert.throws(()=>validateDocument(invalid));
});

// The only deletion authority here is the GraphSnapshot producer's explicit
// predecessor tombstone, separately reviewed by the author. Source absence alone
// remains not-in-scope, even when a scanner reports a complete selection.
test('semantic evolution records reviewed source assertion removals only from compatible explicit predecessor tombstones',async()=>{
 const {readFileSync}=await import('node:fs');
 const {compileGraphSnapshot,previewGraphReimport,graphTombstonePatch}=await import('../src/intelligence/graphSnapshot');
 const g=JSON.parse(readFileSync('tests/fixtures/night4/graph-fixture.json','utf8'));g.complete_scope=true;
 const before=compileGraphSnapshot(g).document,a=snapshot(before,'graph-before'),incoming=structuredClone(g);
 incoming.generation_id='graph-next';incoming.predecessor_generation=g.generation_id;incoming.captured_at='2026-10-09T01:00:00Z';
 const removed=incoming.assertions.shift();incoming.removed_assertion_ids=[removed.id];
 const reimport=previewGraphReimport(before,incoming,before.revision).document;
 assert.ok(!compareEvolutionSnapshots(a,snapshot(reimport,'unreviewed')).changes.some(c=>c.change==='removed'));
 const patch=graphTombstonePatch(reimport)!;assert.ok(patch);
 const reviewed=applyDocumentPatch(reimport,patch).result,delta=compareEvolutionSnapshots(a,snapshot(reviewed,'graph-after'));
 assert.equal(delta.state,'comparable');assert.equal(delta.changes.filter(c=>c.change==='removed').length,1);
 assert.equal(delta.changes.find(c=>c.change==='removed')?.entity,'connection');
 assert.equal(reviewed.nodes.length,reimport.nodes.length);assert.equal(reviewed.blocks.length,reimport.blocks.length);
 const partial=snapshot(reviewed,'partial');partial.graphGeneration!.complete=false;partial.scope.complete=false;
 assert.ok(!compareEvolutionSnapshots(a,partial).changes.some(c=>c.change==='removed'));
 const unrelated=snapshot(reviewed,'unrelated');unrelated.graphGeneration!.predecessor='other-generation';
 assert.ok(!compareEvolutionSnapshots(a,unrelated).changes.some(c=>c.change==='removed'));
 const differentGrant=snapshot(reviewed,'different-grant');differentGrant.graphGeneration!.scope.scope_policy_hash='other-grant';
 assert.equal(compareEvolutionSnapshots(a,differentGrant).state,'incomparable');
 assert.equal(compareEvolutionSnapshots(a,differentGrant).changes.length,0);
});
