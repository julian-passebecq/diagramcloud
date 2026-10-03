import test from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {applyDocumentPatch} from '../src/core/patch';
import {
 DIAGRAMCLOUD_DEEP_LINK_ROUTE,GALAXY_V1G_CONTRACTS,
 entityIdFor,galaxyEntity,publicationSnapshot,stagePublicationSnapshot,
 validatePublicationSnapshot,versionHandshake
} from '../src/core/galaxy';

const total=samples.find(s=>s.id==='total-project-controls')!;

test('Galaxy entity IDs are deterministic and preserve local IDs separately',()=>{
 const entity=galaxyEntity('diagramcloud','node','checks',{revision:String(total.revision),displayName:'SQL quality checks'});
 assert.equal(entity.entity_id,entityIdFor('diagramcloud','node','checks'));
 assert.equal(entity.local_id,'checks');
 assert.equal(entity.owner_app,'diagramcloud');
 assert.equal(entity.entity_type,'node');
 assert.equal(entity.display_name,'SQL quality checks');
});

test('DiagramCloud publishes a G0 handshake with the complete accepted V1G contract set',()=>{
 const hs=versionHandshake({productVersion:'0.1.0',generatedAt:new Date('2026-10-03T01:00:00Z'),sourceRevision:'4829223'});
 assert.equal(hs.app_id,'diagramcloud');
 assert.equal(hs.galaxy_level,'G0','supporting V1G contracts does not self-promote qualification');
 assert.equal(hs.standalone,true);
 assert.deepEqual(hs.contracts.map(c=>c.contract_id),[...GALAXY_V1G_CONTRACTS]);
 assert.deepEqual(hs.deep_link_routes,[DIAGRAMCLOUD_DEEP_LINK_ROUTE.route_id]);
 assert(hs.degradation?.some(x=>/fully usable/.test(x)));
});

test('publication snapshot preserves public semantic identity and never serializes private authoring content',()=>{
 const doc=structuredClone(total);
 doc.privateNotes='DO NOT EXPORT';
 doc.nodes[0].visibility='private';
 const snap=publicationSnapshot(doc,{
  productVersion:'0.1.0',
  sourceRevision:'4829223',
  reviewedAt:'2026-10-03T01:05:00Z',
  reviewedBy:'author',
  humanConfirmed:true,
  intendedVisibility:'public',
  generatedAt:new Date('2026-10-03T01:06:00Z'),
  snapshotId:'snapshot-total-r0'
 });
 assert.equal(snap.snapshot_id,'snapshot-total-r0');
 assert.equal(snap.subject.entity_id,entityIdFor('diagramcloud','project',total.id));
 assert(snap.entities.some(e=>e.entity_type==='view'));
 assert(snap.entities.some(e=>e.entity_type==='node'));
 assert(snap.relationships.some(r=>r.type==='has_root_view'));
 assert(snap.relationships.some(r=>r.type==='contains'));
 assert(!JSON.stringify(snap).includes('DO NOT EXPORT'));
 assert(!snap.entities.some(e=>e.local_id===doc.nodes[0].id),'private component is removed by publicDocument before snapshot creation');
 assert.deepEqual(snap.contract_versions,[...GALAXY_V1G_CONTRACTS]);
});

test('public PublicationSnapshot requires explicit human confirmation',()=>{
 const snap=publicationSnapshot(total,{
  productVersion:'0.1.0',
  reviewedAt:'2026-10-03T01:05:00Z',
  humanConfirmed:true,
  intendedVisibility:'public',
  generatedAt:new Date('2026-10-03T01:06:00Z')
 });
 const bad=structuredClone(snap);
 bad.review.human_confirmed=false;
 assert.throws(()=>validatePublicationSnapshot(bad),/requires explicit human confirmation/);
});

test('external Galaxy realization claims stage into a private revision-guarded DiagramCloud observation patch',()=>{
 const projectEntity=galaxyEntity('diagramcloud','project',total.id,{revision:String(total.revision),displayName:total.title});
 const nodeEntity=galaxyEntity('diagramcloud','node','checks',{revision:String(total.revision),displayName:'SQL quality checks'});
 const snapshot=validatePublicationSnapshot({
  schema_version:1,
  snapshot_id:'verify-total-001',
  producer:{app_id:'verify',product_version:'1.0.0',source_revision:'run-42'},
  subject:projectEntity,
  created_at:'2026-10-03T01:10:00Z',
  review:{state:'reviewed',reviewed_at:'2026-10-03T01:11:00Z',reviewed_by:'reviewer',human_confirmed:true,intended_visibility:'internal'},
  entities:[
   {...projectEntity,label:total.title,kind:'project',visibility:'internal'},
   {...nodeEntity,label:'SQL quality checks',kind:'process',visibility:'internal'}
  ],
  relationships:[],
  evidence_refs:[{
   schema_version:1,evidence_id:'galaxy:verify:evidence:run-42',kind:'test_run',source_system:'ci',
   locator:{run_id:'42',suite:'quality'},captured_at:'2026-10-03T01:09:00Z',observed_revision:'4829223',
   visibility:'internal',synthetic:false,review_state:'qualified',qualification_level:'E2E_VERIFIED',producer_app:'verify'
  }],
  realization_claims:[{
   claim_id:'verify-claim-42',subject_entity_id:nodeEntity.entity_id,state:'verified',observed_at:'2026-10-03T01:09:00Z',
   producer_app:'verify',authority:'DiagramCloud CI',summary:'Browser qualification passed for the selected component.',
   evidence_ref_ids:['galaxy:verify:evidence:run-42'],review_state:'qualified'
  }],
  contract_versions:[...GALAXY_V1G_CONTRACTS]
 });
 const staged=stagePublicationSnapshot(total,snapshot);
 assert.equal(staged.candidates.length,1);
 assert.equal(staged.unresolved.length,0);
 assert(staged.patch);
 const applied=applyDocumentPatch(total,staged.patch!);
 const obs=applied.result.observations.find(o=>o.id===staged.candidates[0].observation_id)!;
 assert.equal(obs.claim,'verified');
 assert.equal(obs.sourceApp,'verify');
 assert.equal(obs.sourceRevision,'run-42');
 assert.equal(obs.visibility,'private');
 assert.equal(obs.reviewedAt,undefined);
 assert.equal(obs.shareable,false);
 assert.equal(obs.blockIds.length,0,'foreign EvidenceRefs stay external references; they are never forged into local evidence blocks');
 assert.throws(()=>applyDocumentPatch({...total,revision:total.revision+1},staged.patch!),/Stale patch/);
});

test('self claims and unmapped entities are not silently imported',()=>{
 const snap=publicationSnapshot(total,{
  productVersion:'0.1.0',reviewedAt:'2026-10-03T01:05:00Z',humanConfirmed:true,intendedVisibility:'internal',
  generatedAt:new Date('2026-10-03T01:06:00Z')
 });
 const self=stagePublicationSnapshot(total,snap);
 assert.equal(self.patch,null);
 assert(self.unresolved.every(x=>x.reason==='self_claim'));
 const external=structuredClone(snap);
 external.producer={app_id:'verify',source_revision:'run-7'};
 external.realization_claims=[{
  claim_id:'unknown-claim',subject_entity_id:'galaxy:other:node:missing',state:'observed',observed_at:'2026-10-03T01:00:00Z',
  producer_app:'verify',authority:'Verify',summary:'Observed external component.',evidence_ref_ids:[],review_state:'reviewed'
 }];
 external.entities.push({
  schema_version:1,entity_id:'galaxy:other:node:missing',owner_app:'other',entity_type:'node',local_id:'missing',
  aliases:[],metadata:{},label:'Missing',kind:'process',visibility:'internal'
 });
 const staged=stagePublicationSnapshot(total,external);
 assert.equal(staged.patch,null);
 assert.equal(staged.unresolved[0].reason,'no_diagramcloud_node_mapping');
});
