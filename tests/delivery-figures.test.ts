import test from 'node:test';
import assert from 'node:assert/strict';
import {DELIVERY_PROFILES,deliveryFigure,deliverySvg,deliveryHtml} from '../src/export/design/operations';
import {deliveryPublicationPatch} from '../src/intelligence/delivery';
import {applyDocumentPatch} from '../src/core/patch';
import {publicDocument} from '../src/core/operations';
import {validateDocument} from '../src/core/model';
import {observationPatch} from '../src/core/realization';
import {defects} from './helpers/designGeometry';
import {syntheticDeliveryProject,publicSyntheticDeliveryProject} from './helpers/delivery';
import {readFileSync} from 'node:fs';
import {parseDocument} from '../src/core/model';
import {samples} from '../src/data/samples';
test('promotion figures admit only source-cited public environment endpoints and report uncited omissions without altering declarations',()=>{
 const doc=publicSyntheticDeliveryProject(),before=JSON.stringify(doc);doc.delivery!.environments.find(e=>e.id==='prod')!.sourceIds=[];
 const figure=deliveryFigure(doc,'promotion',{at:'2026-10-09T10:00:00Z'});assert.equal(figure.total,0);assert.equal(figure.shown,0);assert.equal(figure.omission.environments,1);assert.equal(figure.omission.promotions,1);assert.ok(figure.svg.includes('missing public environment source citations'));assert.ok(!figure.svg.includes('Synthetic production'));assert.ok(!figure.svg.includes('data-node-id="promotion-from"'));assert.deepEqual(defects(figure.svg,'promotion-citation-gap').failures,[]);
 assert.ok(deliverySvg(doc,'environment').includes('Synthetic production'));assert.ok(deliverySvg(doc,'release-chain').includes('Synthetic production'));assert.equal(doc.delivery!.promotions.length,1);assert.equal(doc.delivery!.environments.length,2);
 doc.delivery!.environments.find(e=>e.id==='prod')!.sourceIds=['source'];const complete=deliveryFigure(doc,'promotion');assert.equal(complete.total,1);assert.equal(complete.omission.promotions,0);assert.ok(complete.svg.includes('Synthetic production'));assert.equal(JSON.stringify(doc),before);
});
import {previewDocumentChange} from '../src/core/changePreview';
const at='2026-10-09T00:00:00Z';
test('delivery profiles retain geometric checks for every sample and optional real local atlas projection',()=>{
 const extra=(process.env.DIAGRAMCLOUD_QUALITY_DOCS??'').split(',').filter(Boolean).map(path=>parseDocument(readFileSync(path,'utf8')));
 for(const doc of [...samples,...extra])for(const profile of DELIVERY_PROFILES){const first=deliveryFigure(doc,profile,{at});for(let ep=0;ep<first.totalEnvironmentPages;ep++)for(let page=0;page<first.totalPages;page++)assert.deepEqual(defects(deliverySvg(doc,profile,{at,page,environmentPage:ep}),profile).failures,[]);}
});
test('delivery publication requires an explicit patch choice, preserves private facets/configuration and never reviews observations',()=>{
 const original=syntheticDeliveryProject(),single=applyDocumentPatch(original,deliveryPublicationPatch(original,'instances','api-dev','public')).result;assert.equal(publicDocument(single).delivery,undefined);assert.equal(original.delivery!.instances[0].visibility,'private');
 const doc=applyDocumentPatch(original,deliveryPublicationPatch(original,'instances','api-dev','public',true)).result,safe=publicDocument(doc);assert.equal(safe.delivery!.instances.length,1);assert.equal(safe.delivery!.environments.length,1);assert.equal(safe.delivery!.artifacts[0].buildId,'build-run-42');assert.equal(safe.delivery!.releases![0].id,'release');assert.ok(safe.views.some(v=>v.id==='delivery-environment-matrix'));assert.ok(!JSON.stringify(safe).includes('PRIVATE_TENANT_DECLARATION'));assert.ok(!JSON.stringify(safe).includes('PRIVATE_CONFIG_DECLARATION'));assert.deepEqual(doc.observations,original.observations);
 assert.throws(()=>deliveryPublicationPatch(original,'instances','unknown','public',true),/Unknown/);const hidden=applyDocumentPatch(doc,deliveryPublicationPatch(doc,'instances','api-dev','private',true)).result;assert.equal(publicDocument(hidden).delivery!.instances.length,0);assert.equal(hidden.delivery!.environments[0].visibility,'public');
});
test('public artifact source identity omits known private Atlas membership while retaining public-card and standalone declarations',()=>{
 const doc=publicSyntheticDeliveryProject();doc.atlas={activeSnapshotId:'current',snapshots:[{id:'current',capturedAt:at,repositories:[{id:'private-repository-id',title:'PRIVATE_REPOSITORY_TITLE',host:'local',locator:'synthetic-private',scanStatus:'not-scanned',authority:'author',visibility:'private'},{id:'public-repository-id',title:'Synthetic public card repository',host:'local',locator:'synthetic-public',scanStatus:'not-scanned',authority:'author',nodeId:'api'}],runtimeRefs:[],contextRefs:[]}]};
 const artifact=doc.delivery!.artifacts[0];artifact.sourceRepositoryId='private-repository-id';validateDocument(doc);assert.equal(publicDocument(doc).delivery!.artifacts[0].sourceRepositoryId,undefined);assert.ok(!deliverySvg(doc,'release-chain',{at}).includes('private-repository-id'));
 artifact.sourceRepositoryId='public-repository-id';assert.equal(publicDocument(doc).delivery!.artifacts[0].sourceRepositoryId,'public-repository-id');doc.atlas.snapshots.unshift({id:'older',capturedAt:at,repositories:[{id:'public-repository-id',title:'Previously private synthetic repository',host:'local',locator:'synthetic-public',scanStatus:'not-scanned',authority:'author',visibility:'private'}],runtimeRefs:[],contextRefs:[]});assert.equal(publicDocument(doc).delivery!.artifacts[0].sourceRepositoryId,'public-repository-id');artifact.sourceRepositoryId='standalone-source';assert.equal(publicDocument(doc).delivery!.artifacts[0].sourceRepositoryId,'standalone-source');
});
test('metadata-only delivery and Atlas proposals count as human-review changes without rewriting components',()=>{
 const before=publicSyntheticDeliveryProject(),after=structuredClone(before);after.delivery!.promotions[0].visibility='private';let preview=previewDocumentChange(before,after);assert.deepEqual(preview.metadata,['delivery']);assert.equal(preview.totalChanges,1);assert.ok(Object.values(preview.entities).every(group=>!group.changed.length&&!group.added.length&&!group.removed.length));
 const atlas=structuredClone(before);atlas.atlas={activeSnapshotId:'current',snapshots:[{id:'current',capturedAt:at,repositories:[],runtimeRefs:[],contextRefs:[]}]};preview=previewDocumentChange(before,atlas);assert.deepEqual(preview.metadata,['atlas']);assert.equal(preview.totalChanges,1);
});
test('flat delivery profiles are deterministic public-only diagrams with no text/shape defects and independent identities',()=>{
 const doc=publicSyntheticDeliveryProject(),before=JSON.stringify(doc);for(const profile of DELIVERY_PROFILES){const svg=deliverySvg(doc,profile,{at}),result=defects(svg,profile);assert.deepEqual(result.failures,[]);assert.equal(result.unresolved,0);assert.equal(result.unresolvedShapes,0);assert.equal(svg,deliverySvg(doc,profile,{at}));assert.ok(svg.includes('data-delivery-profile="'+profile+'"'));assert.ok(!svg.includes('PRIVATE_TENANT_DECLARATION'));assert.ok(!svg.includes('PRIVATE_CONFIG_DECLARATION'));assert.ok(svg.includes('No')||svg.includes('UNKNOWN'));}
 const chain=deliverySvg(doc,'release-chain',{at});for(const value of ['source-revision-1','build-run-42','artifact-version-7','release-label-9','standalone-source'])assert.ok(chain.includes(value));const matrix=deliverySvg(doc,'environment',{at});assert.ok(matrix.includes('NOT APPLICABLE'));assert.ok(matrix.includes('Explicit synthetic author exclusion'));assert.ok(matrix.includes('Runtime UNKNOWN'));assert.equal(JSON.stringify(doc),before);
});
test('reviewed instance and gate claims retain timestamp, freshness, revision match and author-selected public scope',()=>{
 let doc=publicSyntheticDeliveryProject();doc=applyDocumentPatch(doc,observationPatch(doc,{id:'external',nodeId:'instance-dev',sourceApp:'synthetic-test-authority',authority:'Synthetic authority',sourceRevision:'source-revision-1',observedAt:at,claim:'verified',summary:'Synthetic fixture only',caveat:'No deployed system'})).result;
 // Test harness simulates the human review/publication operation; renderer never makes that choice.
 doc.observations[0].reviewedAt=at;doc.observations[0].visibility='public';doc.delivery!.promotions[0].gates[0].observationId='external';validateDocument(doc);
 for(const profile of DELIVERY_PROFILES){const svg=deliverySvg(doc,profile,{at:'2026-10-12T00:00:00Z',maxAgeHours:24});assert.ok(svg.includes(at));assert.ok(svg.includes('verified'));assert.ok(svg.includes('stale'));assert.deepEqual(defects(svg,profile).failures,[]);}const promotion=deliverySvg(doc,'promotion',{at});assert.ok(promotion.includes('exact-source-revision'));assert.ok(promotion.includes('REVIEWED EXTERNAL CLAIM'));doc.observations[0].visibility='private';assert.ok(!deliverySvg(doc,'promotion',{at}).includes('Synthetic authority'));
});
test('large delivery matrix and release chains paginate readable bounded figures; offline HTML retains all pages',()=>{
 const doc=publicSyntheticDeliveryProject();for(let i=0;i<26;i++){doc.nodes.push({...structuredClone(doc.nodes[0]),id:'component-'+i,label:'Long synthetic logical component '+i+' contribution '.repeat(5)});doc.views[0].nodeIds.push('component-'+i);}for(let i=0;i<7;i++)doc.delivery!.environments.push({id:'environment-'+i,label:'Long synthetic environment '+i+' scope '.repeat(8),description:'Synthetic scope',visibility:'public',sourceIds:[]});validateDocument(doc);
 const first=deliveryFigure(doc,'environment',{at});assert.equal(first.totalPages,5);assert.equal(first.totalEnvironmentPages,3);assert.equal(first.shown,24);for(let ep=0;ep<first.totalEnvironmentPages;ep++)for(let page=0;page<first.totalPages;page++)assert.deepEqual(defects(deliverySvg(doc,'environment',{at,page,environmentPage:ep}),'large').failures,[]);
 const html=deliveryHtml(doc,{at});assert.ok(html.includes('default-src &#39;none&#39;')||html.includes("default-src 'none'"));assert.ok(html.includes('environment-6'));assert.ok(!html.includes('<script'));assert.ok(!html.includes('PRIVATE_CONFIG_DECLARATION'));assert.throws(()=>deliverySvg(doc,'environment',{at:'bad'}),/valid/);
});
