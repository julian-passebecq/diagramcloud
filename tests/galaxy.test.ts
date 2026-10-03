import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
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


test('the exact pinned DataPass producer fixture validates and stages through DiagramCloud review',()=>{
 const fixturePath='tests/contracts/datapass-publication-snapshot.json';
 const lock=JSON.parse(readFileSync('tests/contracts/datapass-galaxy-v1g.lock.json','utf8'));
 const bytes=readFileSync(fixturePath);
 const blob=createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex');
 assert.equal(blob,lock.producer.fixtureBlob,'vendored fixture changed without bumping the DataPass contract lock');
 assert.equal(lock.producer.commit,'cd64d4655e4a0cb8ec21390661632bdf1ed1160a');
 const snapshot=validatePublicationSnapshot(JSON.parse(bytes.toString('utf8')));
 assert.equal(snapshot.producer.app_id,'datapass_vscode');
 assert.equal(snapshot.producer.source_revision,'58f7d2da51647c261c2b000416751ad570f64e32');
 assert.equal(snapshot.realization_claims.length,1);
 const staged=stagePublicationSnapshot(total,snapshot);
 assert.equal(staged.unresolved.length,0);
 assert.equal(staged.candidates.length,1);
 assert(staged.patch);
 const applied=applyDocumentPatch(total,staged.patch!).result;
 const obs=applied.observations.find(o=>o.id===staged.candidates[0].observation_id)!;
 assert.equal(obs.nodeId,'checks');
 assert.equal(obs.sourceApp,'datapass_vscode');
 assert.equal(obs.claim,'observed');
 assert.equal(obs.sourceRevision,'58f7d2da51647c261c2b000416751ad570f64e32');
 assert.equal(obs.visibility,'private');
 assert.equal(obs.reviewedAt,undefined);
 assert.equal(obs.shareable,false);
 assert.match(obs.caveat,/not a runtime or production deployment verification/);
});


test('Galaxy registry app IDs may contain underscores and remain valid observation sourceApp values',()=>{
 const entity=galaxyEntity('datapass_vscode','project','total-project-controls');
 assert.equal(entity.owner_app,'datapass_vscode');
 const snapshot=JSON.parse(readFileSync('tests/contracts/datapass-publication-snapshot.json','utf8'));
 const staged=stagePublicationSnapshot(total,snapshot);
 assert(staged.patch);
 const applied=applyDocumentPatch(total,staged.patch!).result;
 assert.equal(applied.observations.find(o=>o.id===staged.candidates[0].observation_id)!.sourceApp,'datapass_vscode');
});

test('public PublicationSnapshot cannot contain internal evidence, internal entities or unreviewed claims',()=>{
 const snap=publicationSnapshot(total,{
  productVersion:'0.1.0',reviewedAt:'2026-10-03T01:05:00Z',humanConfirmed:true,intendedVisibility:'public',
  generatedAt:new Date('2026-10-03T01:06:00Z')
 });
 const internalEvidence=structuredClone(snap);
 internalEvidence.evidence_refs[0]&&=({...internalEvidence.evidence_refs[0],visibility:'internal'});
 if(internalEvidence.evidence_refs.length)assert.throws(()=>validatePublicationSnapshot(internalEvidence),/cannot include non-public evidence/);

 const internalEntity=structuredClone(snap);
 internalEntity.entities[0].visibility='internal';
 assert.throws(()=>validatePublicationSnapshot(internalEntity),/cannot include non-public entity/);

 const withClaim=structuredClone(snap);
 withClaim.realization_claims=[{
  claim_id:'public-unreviewed',
  subject_entity_id:withClaim.entities.find(e=>e.entity_type==='node')!.entity_id,
  state:'observed',
  observed_at:'2026-10-03T01:00:00Z',
  producer_app:'verify',
  authority:'Verify',
  summary:'Observed state.',
  evidence_ref_ids:[],
  review_state:'unreviewed'
 }];
 assert.throws(()=>validatePublicationSnapshot(withClaim),/cannot include unreviewed claim/);
});

test('verified realization claims cannot be backed by synthetic EvidenceRefs',()=>{
 const projectEntity=galaxyEntity('diagramcloud','project',total.id,{revision:String(total.revision),displayName:total.title});
 const nodeEntity=galaxyEntity('diagramcloud','node','checks',{revision:String(total.revision),displayName:'SQL quality checks'});
 assert.throws(()=>validatePublicationSnapshot({
  schema_version:1,snapshot_id:'synthetic-verified',producer:{app_id:'verify',source_revision:'run-1'},subject:projectEntity,
  created_at:'2026-10-03T01:00:00Z',
  review:{state:'reviewed',reviewed_at:'2026-10-03T01:01:00Z',human_confirmed:true,intended_visibility:'internal'},
  entities:[{...projectEntity,label:total.title,visibility:'internal'},{...nodeEntity,label:'SQL quality checks',visibility:'internal'}],
  relationships:[],
  evidence_refs:[{schema_version:1,evidence_id:'galaxy:verify:evidence:synthetic',kind:'test_run',source_system:'ci',locator:{run_id:'1'},captured_at:'2026-10-03T00:59:00Z',visibility:'internal',synthetic:true,review_state:'reviewed',producer_app:'verify'}],
  realization_claims:[{claim_id:'verified-synthetic',subject_entity_id:nodeEntity.entity_id,state:'verified',observed_at:'2026-10-03T00:59:00Z',producer_app:'verify',authority:'Verify',summary:'Verified claim.',evidence_ref_ids:['galaxy:verify:evidence:synthetic'],review_state:'reviewed'}],
  contract_versions:[...GALAXY_V1G_CONTRACTS]
 }),/synthetic evidence .* cannot back a verified claim/);
});
