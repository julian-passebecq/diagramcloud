import {z} from 'zod';
import type {Project} from './model';
import {publicDocument} from './operations';
import {observationPatch,type ObservationInput} from './realization';
import {PATCH_FORMAT,type Patch} from './patch';
import {isOpenUri,secretFindings} from './secrets';

export const GALAXY_V1G_CONTRACTS=[
 'galaxy.entity/1',
 'galaxy.evidence-ref/1',
 'galaxy.version-handshake/1',
 'galaxy.publication-snapshot/1',
 'galaxy.deep-link/1'
] as const;
export const MAX_PUBLICATION_SNAPSHOT_BYTES=2*1024*1024;

const appId=z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/,'Use a lowercase Galaxy registry app ID');
const entityType=z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/,'Use a stable lowercase entity type');
const entityId=z.string().min(1).max(500);
const localId=z.string().min(1).max(200);
const instant=z.string().datetime({offset:true});
const short=z.string().min(1).max(200);
const text=z.string().min(1).max(2000);
const scalar=z.union([z.string().max(2000),z.number().finite(),z.boolean(),z.null()]);
const locatorValue=z.union([scalar,z.array(z.string().max(500)).max(50)]);
const locator=z.record(z.string().max(80),locatorValue).refine(v=>Object.keys(v).length<=40,'Too many locator fields');

export const galaxyEntitySchema=z.object({
 schema_version:z.literal(1),
 entity_id:entityId,
 owner_app:appId,
 entity_type:entityType,
 local_id:localId,
 revision:z.string().min(1).max(120).optional(),
 display_name:z.string().min(1).max(200).optional(),
 aliases:z.array(entityId).max(20).default([]),
 metadata:z.record(z.string().max(64),scalar).refine(v=>Object.keys(v).length<=40,'Too many metadata fields').default({})
}).strict();
export type GalaxyEntity=z.infer<typeof galaxyEntitySchema>;

export const evidenceRefSchema=z.object({
 schema_version:z.literal(1),
 evidence_id:entityId,
 kind:z.enum(['repo_commit','pipeline','test_run','runtime_receipt','document','file','url','manual_observation','screenshot','dataset_snapshot','other']),
 source_system:z.enum(['github','gitlab','atlas','filesystem','drive','ci','runtime','manual','other']),
 locator,
 captured_at:instant,
 observed_revision:z.string().min(1).max(160).optional(),
 integrity:z.string().min(1).max(300).optional(),
 visibility:z.enum(['public','internal','private']),
 synthetic:z.boolean(),
 review_state:z.enum(['unreviewed','reviewed','qualified']),
 qualification_level:z.enum(['DECLARED','IMPLEMENTED','BUILD_VERIFIED','PACKAGE_VERIFIED','E2E_VERIFIED','MANUAL_QUALIFIED','GALAXY_QUALIFIED']).optional(),
 producer_app:appId.optional(),
 notes:z.string().max(1000).optional()
}).strict();
export type EvidenceRef=z.infer<typeof evidenceRefSchema>;

export const deepLinkRouteSchema=z.object({
 schema_version:z.literal(1),
 route_id:z.string().regex(/^[a-z0-9.-]+\/\d+$/),
 owner_app:appId,
 version:z.literal(1),
 relative_template:z.string().min(1).max(300),
 parameters:z.array(z.object({
  name:z.string().regex(/^[a-z][a-z0-9_]*$/),
  required:z.boolean(),
  meaning:z.string().min(1).max(300),
  entity_type:entityType.optional()
 }).strict()).max(20),
 open_semantics:z.string().min(1).max(1000),
 capability_id:z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/).optional(),
 fallback:z.string().min(1).max(1000).optional()
}).strict();
export type DeepLinkRoute=z.infer<typeof deepLinkRouteSchema>;

export const DIAGRAMCLOUD_DEEP_LINK_ROUTE:DeepLinkRoute=deepLinkRouteSchema.parse({
 schema_version:1,
 route_id:'diagramcloud.project-view-node/1',
 owner_app:'diagramcloud',
 version:1,
 relative_template:'?project={project}&view={view?}&node={node?}',
 parameters:[
  {name:'project',required:true,meaning:'DiagramCloud project stable ID',entity_type:'project'},
  {name:'view',required:false,meaning:'DiagramCloud view stable ID',entity_type:'view'},
  {name:'node',required:false,meaning:'DiagramCloud component/node stable ID',entity_type:'node'}
 ],
 open_semantics:'Open the project, retain its parent drilldown path, focus the requested view and select the requested node when present.',
 capability_id:'publish',
 fallback:'If view/node cannot be resolved, open the project root and report the unresolved deeper target. Never open an unrelated entity.'
});

export const versionHandshakeSchema=z.object({
 schema_version:z.literal(1),
 app_id:appId,
 product_version:z.string().min(1).max(80),
 galaxy_level:z.enum(['G0','V1G','V2G','V3G']),
 standalone:z.boolean(),
 contracts:z.array(z.object({
  contract_id:z.string().regex(/^galaxy\.[a-z0-9-]+\/\d+$/),
  role:z.enum(['produce','consume','both']),
  required:z.boolean()
 }).strict()).max(50),
 capabilities:z.array(z.object({
  capability_id:z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/),
  version:z.string().min(1).max(40).optional(),
  status:z.enum(['available','partial','planned'])
 }).strict()).max(50),
 deep_link_routes:z.array(z.string().max(120)).max(20).optional(),
 generated_at:instant,
 source_revision:z.string().min(1).max(160).optional(),
 degradation:z.array(z.string().min(1).max(500)).max(20).optional()
}).strict();
export type VersionHandshake=z.infer<typeof versionHandshakeSchema>;

export function versionHandshake({productVersion,generatedAt=new Date(),sourceRevision}:{productVersion:string;generatedAt?:Date;sourceRevision?:string}):VersionHandshake{
 return versionHandshakeSchema.parse({
  schema_version:1,app_id:'diagramcloud',product_version:productVersion,
  // Contract support is implemented locally, but no external Galaxy companion is required or qualified.
  galaxy_level:'G0',standalone:true,
  contracts:[
   {contract_id:'galaxy.entity/1',role:'both',required:true},
   {contract_id:'galaxy.evidence-ref/1',role:'both',required:true},
   {contract_id:'galaxy.version-handshake/1',role:'produce',required:true},
   {contract_id:'galaxy.publication-snapshot/1',role:'both',required:true},
   {contract_id:'galaxy.deep-link/1',role:'produce',required:true},
   {contract_id:'galaxy.verification-receipt/1',role:'produce',required:false}
  ],
  capabilities:[
   {capability_id:'graph',status:'available'},
   {capability_id:'publish',status:'available'},
   {capability_id:'workbench',status:'available'},
   {capability_id:'verify',status:'partial'}
  ],
  deep_link_routes:[DIAGRAMCLOUD_DEEP_LINK_ROUTE.route_id],
  generated_at:generatedAt.toISOString(),...(sourceRevision?{source_revision:sourceRevision}:{}),
  degradation:[
   'DiagramCloud remains fully usable when Galaxy, Hub, DataPass, Verify or Mongoku are absent.',
   'Unsupported optional contracts disable only that integration, never the local editor or exports.'
  ]
 });
}

export function entityIdFor(ownerApp:string,type:string,id:string):string{
 return `galaxy:${ownerApp}:${type}:${encodeURIComponent(id)}`;
}

export function galaxyEntity(ownerApp:string,type:string,id:string,options:{revision?:string;displayName?:string;aliases?:string[];metadata?:Record<string,string|number|boolean|null>}={}):GalaxyEntity{
 return galaxyEntitySchema.parse({
  schema_version:1,entity_id:entityIdFor(ownerApp,type,id),owner_app:ownerApp,entity_type:type,local_id:id,
  ...(options.revision?{revision:options.revision}:{}),...(options.displayName?{display_name:options.displayName}:{}),
  aliases:options.aliases??[],metadata:options.metadata??{}
 });
}

const publicationEntitySchema=galaxyEntitySchema.extend({
 label:short,
 summary:z.string().max(1000).optional(),
 kind:z.string().min(1).max(80).optional(),
 visibility:z.enum(['public','internal']).default('public')
}).strict();

const publicationRelationshipSchema=z.object({
 relationship_id:z.string().min(1).max(500).optional(),
 from_entity_id:entityId,
 to_entity_id:entityId,
 type:z.string().min(1).max(100),
 evidence_ref_ids:z.array(entityId).max(100).default([])
}).strict();

const realizationClaimSchema=z.object({
 claim_id:z.string().min(1).max(200),
 subject_entity_id:entityId,
 state:z.enum(['designed','observed','verified','partial','not_observed']),
 observed_at:instant.optional(),
 producer_app:appId.optional(),
 authority:z.string().min(1).max(160).optional(),
 summary:z.string().min(1).max(500),
 caveat:z.string().max(1000).optional(),
 open_uri:z.string().max(2000).refine(isOpenUri,'Only http(s) or vscode links without embedded credentials').optional(),
 evidence_ref_ids:z.array(entityId).max(100).default([]),
 review_state:z.enum(['unreviewed','reviewed','qualified'])
}).strict();

export const publicationSnapshotSchema=z.object({
 schema_version:z.literal(1),
 snapshot_id:z.string().min(1).max(300),
 producer:z.object({app_id:appId,product_version:z.string().min(1).max(80).optional(),source_revision:z.string().min(1).max(160).optional()}).strict(),
 subject:galaxyEntitySchema,
 created_at:instant,
 review:z.object({
  state:z.literal('reviewed'),
  reviewed_at:instant,
  reviewed_by:z.string().min(1).max(160).optional(),
  human_confirmed:z.boolean(),
  intended_visibility:z.enum(['public','internal'])
 }).strict(),
 entities:z.array(publicationEntitySchema).min(1).max(3000),
 relationships:z.array(publicationRelationshipSchema).max(8000),
 evidence_refs:z.array(evidenceRefSchema).max(3000),
 realization_claims:z.array(realizationClaimSchema).max(1000).default([]),
 presentation_hints:z.record(z.string().max(80),scalar).refine(v=>Object.keys(v).length<=40,'Too many presentation hints').optional(),
 contract_versions:z.array(z.string().regex(/^galaxy\.[a-z0-9-]+\/\d+$/)).min(1).max(20),
 extensions:z.record(z.string().max(100),z.unknown()).optional()
}).strict();
export type PublicationSnapshot=z.infer<typeof publicationSnapshotSchema>;

function duplicateIds(items:{id:string}[],label:string,errors:string[]):void{
 const seen=new Set<string>();for(const item of items){if(seen.has(item.id))errors.push(`Duplicate ${label} ID: ${item.id}`);seen.add(item.id);}
}

export function validatePublicationSnapshot(raw:unknown):PublicationSnapshot{
 let bytes=0;
 try{bytes=new TextEncoder().encode(JSON.stringify(raw??null)).byteLength;}catch{throw new Error('PublicationSnapshot must be JSON-serializable');}
 if(bytes>MAX_PUBLICATION_SNAPSHOT_BYTES)throw new Error(`PublicationSnapshot exceeds ${MAX_PUBLICATION_SNAPSHOT_BYTES} bytes`);
 const secrets=secretFindings(raw);if(secrets.length)throw new Error(`PublicationSnapshot refused: ${secrets.slice(0,10).join('; ')}`);
 const snap=publicationSnapshotSchema.parse(raw),errors:string[]=[];
 if(snap.review.intended_visibility==='public'){
  if(!snap.review.human_confirmed)errors.push('Public PublicationSnapshot requires explicit human confirmation');
  for(const e of snap.entities)if(e.visibility!=='public')errors.push(`Public PublicationSnapshot cannot include non-public entity ${e.entity_id}`);
  for(const e of snap.evidence_refs)if(e.visibility!=='public')errors.push(`Public PublicationSnapshot cannot include non-public evidence ${e.evidence_id}`);
  for(const c of snap.realization_claims)if(c.review_state==='unreviewed')errors.push(`Public PublicationSnapshot cannot include unreviewed claim ${c.claim_id}`);
 }
 for(const required of ['galaxy.entity/1','galaxy.evidence-ref/1','galaxy.publication-snapshot/1'])
  if(!snap.contract_versions.includes(required))errors.push(`PublicationSnapshot missing required contract version ${required}`);
 const entities=snap.entities.map(e=>({id:e.entity_id}));duplicateIds(entities,'entity',errors);
 const evidence=snap.evidence_refs.map(e=>({id:e.evidence_id}));duplicateIds(evidence,'evidence',errors);
 const relationships=snap.relationships.filter(r=>r.relationship_id).map(r=>({id:r.relationship_id!}));duplicateIds(relationships,'relationship',errors);
 const claims=snap.realization_claims.map(c=>({id:c.claim_id}));duplicateIds(claims,'claim',errors);
 const entityIds=new Set(snap.entities.map(e=>e.entity_id)),evidenceIds=new Set(snap.evidence_refs.map(e=>e.evidence_id)),evidenceById=new Map(snap.evidence_refs.map(e=>[e.evidence_id,e] as const));
 if(!entityIds.has(snap.subject.entity_id))errors.push('Snapshot subject must also appear in entities');
 for(const r of snap.relationships){
  if(!entityIds.has(r.from_entity_id))errors.push(`${r.type}: unknown from_entity_id ${r.from_entity_id}`);
  if(!entityIds.has(r.to_entity_id))errors.push(`${r.type}: unknown to_entity_id ${r.to_entity_id}`);
  for(const id of r.evidence_ref_ids)if(!evidenceIds.has(id))errors.push(`${r.type}: unknown evidence_ref_id ${id}`);
 }
 for(const c of snap.realization_claims){
  if(!entityIds.has(c.subject_entity_id))errors.push(`${c.claim_id}: unknown subject_entity_id ${c.subject_entity_id}`);
  for(const id of c.evidence_ref_ids){
   if(!evidenceIds.has(id))errors.push(`${c.claim_id}: unknown evidence_ref_id ${id}`);
   else if(c.state==='verified'&&evidenceById.get(id)?.synthetic)errors.push(`${c.claim_id}: synthetic evidence ${id} cannot back a verified claim`);
  }
 }
 if(errors.length)throw new Error(errors.slice(0,20).join('\n'));
 return snap;
}

const evidenceIdFor=(kind:string,id:string)=>entityIdFor('diagramcloud','evidence',`${kind}:${id}`);
const relationshipIdFor=(kind:string,id:string)=>entityIdFor('diagramcloud','relationship',`${kind}:${id}`);
const iso=(value:Date|string)=>value instanceof Date?value.toISOString():new Date(value).toISOString();

export function publicationSnapshot(input:Project,options:{
 productVersion:string;
 sourceRevision?:string;
 reviewedAt:Date|string;
 reviewedBy?:string;
 humanConfirmed:boolean;
 intendedVisibility:'public'|'internal';
 generatedAt?:Date;
 snapshotId?:string;
}):PublicationSnapshot{
 const d=publicDocument(input),generatedAt=options.generatedAt??new Date(),createdAt=generatedAt.toISOString(),revision=String(d.revision);
 const project=galaxyEntity('diagramcloud','project',d.id,{revision,displayName:d.title});
 const entities=[
  {...project,label:d.title,summary:d.summary,kind:'project' as const,visibility:'public' as const},
  ...d.views.map(v=>({...galaxyEntity('diagramcloud','view',v.id,{revision,displayName:v.title}),label:v.title,summary:v.description,kind:'view',visibility:'public' as const})),
  ...d.nodes.map(n=>({...galaxyEntity('diagramcloud','node',n.id,{revision,displayName:n.label}),label:n.label,summary:n.summary,kind:n.kind,visibility:'public' as const}))
 ];
 const relationships:PublicationSnapshot['relationships']=[
  {relationship_id:relationshipIdFor('root-view',d.rootViewId),from_entity_id:project.entity_id,to_entity_id:entityIdFor('diagramcloud','view',d.rootViewId),type:'has_root_view',evidence_ref_ids:[]},
  ...d.views.flatMap(v=>v.nodeIds.map(nodeId=>({relationship_id:relationshipIdFor('view-node',`${v.id}:${nodeId}`),from_entity_id:entityIdFor('diagramcloud','view',v.id),to_entity_id:entityIdFor('diagramcloud','node',nodeId),type:'contains',evidence_ref_ids:[]}))),
  ...d.nodes.filter(n=>n.childViewId).map(n=>({relationship_id:relationshipIdFor('drilldown',n.id),from_entity_id:entityIdFor('diagramcloud','node',n.id),to_entity_id:entityIdFor('diagramcloud','view',n.childViewId!),type:'drills_to',evidence_ref_ids:[]})),
  ...d.edges.map(e=>({relationship_id:relationshipIdFor('edge',e.id),from_entity_id:entityIdFor('diagramcloud','node',e.source),to_entity_id:entityIdFor('diagramcloud','node',e.target),type:`flow:${e.kind}`,evidence_ref_ids:[]}))
 ];
 const blockEvidence:EvidenceRef[]=d.blocks.map(b=>evidenceRefSchema.parse({
  schema_version:1,evidence_id:evidenceIdFor('block',b.id),kind:'document',source_system:'other',
  locator:{project_id:d.id,block_id:b.id,block_type:b.type,title:b.title,source_ids:b.sourceIds},
  captured_at:createdAt,observed_revision:revision,visibility:'public',synthetic:b.provenance==='synthetic',review_state:'reviewed',producer_app:'diagramcloud'
 }));
 const sourceEvidence:EvidenceRef[]=d.sources.map(s=>evidenceRefSchema.parse({
  schema_version:1,evidence_id:evidenceIdFor('source',s.id),kind:s.url?'url':'document',source_system:'other',
  locator:{project_id:d.id,source_id:s.id,title:s.title,...(s.location?{location:s.location}:{}),...(s.url?{url:s.url}:{})},
  captured_at:createdAt,observed_revision:revision,visibility:'public',synthetic:false,review_state:'reviewed',producer_app:'diagramcloud'
 }));
 const realization_claims:PublicationSnapshot['realization_claims']=d.observations.map(o=>({
  claim_id:o.id,subject_entity_id:entityIdFor('diagramcloud','node',o.nodeId),
  state:o.claim==='not-observed'?'not_observed':o.claim,observed_at:o.observedAt,producer_app:o.sourceApp,authority:o.authority,
  summary:o.summary,...(o.caveat?{caveat:o.caveat}:{}),...(o.link?{open_uri:o.link}:{}),
  evidence_ref_ids:o.blockIds.map(id=>evidenceIdFor('block',id)),review_state:'reviewed'
 }));
 const snapshot={
  schema_version:1 as const,
  snapshot_id:options.snapshotId??`diagramcloud:${d.id}:r${d.revision}:${generatedAt.getTime()}`,
  producer:{app_id:'diagramcloud',product_version:options.productVersion,...(options.sourceRevision?{source_revision:options.sourceRevision}:{})},
  subject:project,created_at:createdAt,
  review:{state:'reviewed' as const,reviewed_at:iso(options.reviewedAt),...(options.reviewedBy?{reviewed_by:options.reviewedBy}:{}),human_confirmed:options.humanConfirmed,intended_visibility:options.intendedVisibility},
  entities,relationships,evidence_refs:[...blockEvidence,...sourceEvidence],realization_claims,
  presentation_hints:{root_view_id:d.rootViewId,story_steps:d.story.length},
  contract_versions:[...GALAXY_V1G_CONTRACTS]
 };
 return validatePublicationSnapshot(snapshot);
}

const decodeOwnedEntity=(entity:GalaxyEntity,type:string):string|null=>{
 if(entity.owner_app==='diagramcloud'&&entity.entity_type===type)return entity.local_id;
 const prefix=`galaxy:diagramcloud:${type}:`;
 for(const id of entity.aliases)if(id.startsWith(prefix)){try{return decodeURIComponent(id.slice(prefix.length));}catch{return null;}}
 return null;
};

function hash36(value:string):string{
 let h=2166136261;
 for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}
 return (h>>>0).toString(36);
}
function observationIdForClaim(claimId:string):string{
 const slug=claimId.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,42)||'claim';
 return `obs-galaxy-${slug}-${hash36(claimId)}`.slice(0,80);
}
const diagramClaim=(state:PublicationSnapshot['realization_claims'][number]['state']):ObservationInput['claim']|null=>
 state==='not_observed'?'not-observed':state==='observed'||state==='verified'||state==='partial'?state:null;

export type StagedPublicationSnapshot={
 snapshot:PublicationSnapshot;
 patch:Patch|null;
 candidates:Array<{claim_id:string;node_id:string;observation_id:string;evidence_ref_ids:string[]}>;
 unresolved:Array<{claim_id:string;reason:string}>;
};

export function stagePublicationSnapshot(doc:Project,raw:unknown):StagedPublicationSnapshot{
 const snapshot=validatePublicationSnapshot(raw),byId=new Map(snapshot.entities.map(e=>[e.entity_id,e] as const));
 const candidates:StagedPublicationSnapshot['candidates']=[],unresolved:StagedPublicationSnapshot['unresolved']=[],inputs:ObservationInput[]=[];
 for(const claim of snapshot.realization_claims){
  if(claim.producer_app==='diagramcloud'){unresolved.push({claim_id:claim.claim_id,reason:'self_claim'});continue;}
  const mapped=diagramClaim(claim.state);if(!mapped){unresolved.push({claim_id:claim.claim_id,reason:'designed_is_not_an_external_observation'});continue;}
  const entity=byId.get(claim.subject_entity_id);if(!entity){unresolved.push({claim_id:claim.claim_id,reason:'subject_entity_missing'});continue;}
  const nodeId=decodeOwnedEntity(entity,'node');if(!nodeId||!doc.nodes.some(n=>n.id===nodeId)){unresolved.push({claim_id:claim.claim_id,reason:'no_diagramcloud_node_mapping'});continue;}
  const observationId=observationIdForClaim(claim.claim_id);
  if(doc.observations.some(o=>o.id===observationId)){unresolved.push({claim_id:claim.claim_id,reason:'already_imported'});continue;}
  const sourceRevision=(snapshot.producer.source_revision??snapshot.snapshot_id).slice(0,120);
  const input:ObservationInput={id:observationId,nodeId,sourceApp:claim.producer_app??snapshot.producer.app_id,authority:claim.authority??snapshot.producer.app_id,
   observedAt:claim.observed_at??snapshot.created_at,sourceRevision,claim:mapped,summary:claim.summary,
   ...(claim.open_uri?{link:claim.open_uri}:{}),...(claim.caveat?{caveat:claim.caveat}:{})};
  inputs.push(input);candidates.push({claim_id:claim.claim_id,node_id:nodeId,observation_id:observationId,evidence_ref_ids:claim.evidence_ref_ids});
 }
 if(!inputs.length)return {snapshot,patch:null,candidates,unresolved};
 const operations=inputs.flatMap(input=>observationPatch(doc,input).operations);
 const summary=`Stage ${inputs.length} reviewed Galaxy realization claim${inputs.length===1?'':'s'} from ${snapshot.producer.app_id}`.slice(0,500);
 const patch:Patch={format:PATCH_FORMAT,version:1,target:'project',targetId:doc.id,baseRevision:doc.revision,summary,operations};
 return {snapshot,patch,candidates,unresolved};
}

/** Contracts DiagramCloud speaks: the V1G set plus the release verification receipt it produces. */
export const DIAGRAMCLOUD_GALAXY_CONTRACTS=[...GALAXY_V1G_CONTRACTS,'galaxy.verification-receipt/1'] as const;

/** Galaxy qualification taxonomy, weakest first. A level is never inferred from a lower one. */
export const QUALIFICATION_LEVELS=['DECLARED','IMPLEMENTED','BUILD_VERIFIED','PACKAGE_VERIFIED','E2E_VERIFIED','MANUAL_QUALIFIED','GALAXY_QUALIFIED'] as const;
export type QualificationLevel=typeof QUALIFICATION_LEVELS[number];
/**
 * Checks each level needs, cumulatively. GALAXY_QUALIFIED is deliberately absent: it needs a cross-app
 * qualification that happens outside DiagramCloud, so a DiagramCloud receipt can never claim it.
 */
export const RECEIPT_LEVEL_CHECKS:Partial<Record<QualificationLevel,readonly string[]>>={
 IMPLEMENTED:['typecheck'],
 BUILD_VERIFIED:['typecheck','unit','build'],
 PACKAGE_VERIFIED:['typecheck','unit','build','package'],
 E2E_VERIFIED:['typecheck','unit','build','package','e2e'],
 MANUAL_QUALIFIED:['typecheck','unit','build','package','e2e','manual-visual']
};
export const receiptCheckSchema=z.object({
 check_id:z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
 status:z.enum(['passed','failed','skipped','not_run']),
 command:z.string().min(1).max(300).optional(),
 summary:z.string().max(500).optional(),
 duration_ms:z.number().int().nonnegative().optional(),
 evidence_ref_ids:z.array(entityId).max(20).default([])
}).strict();
export type ReceiptCheck=z.input<typeof receiptCheckSchema>;
export const verificationReceiptSchema=z.object({
 schema_version:z.literal(1),
 receipt_id:z.string().min(1).max(300),
 subject:galaxyEntitySchema,
 app_id:appId,
 product_version:z.string().min(1).max(80),
 document_schema_version:z.number().int().positive(),
 galaxy_level:z.enum(['G0','V1G','V2G','V3G']),
 revision:z.object({
  vcs:z.literal('git'),
  repository:z.string().min(1).max(200),
  commit:z.string().regex(/^[0-9a-f]{40}$/,'Record the full 40-character commit SHA'),
  branch:z.string().max(200).optional(),
  dirty:z.boolean()
 }).strict(),
 verification_level:z.enum(QUALIFICATION_LEVELS),
 status:z.enum(['passed','failed']),
 checks:z.array(receiptCheckSchema).min(1).max(40),
 evidence_refs:z.array(evidenceRefSchema).max(40).default([]),
 created_at:instant,
 caveats:z.array(z.string().min(1).max(500)).max(20).default([])
}).strict();
export type VerificationReceipt=z.infer<typeof verificationReceiptSchema>;

const passed=(checks:ReceiptCheck[],id:string)=>checks.some(c=>c.check_id===id&&c.status==='passed');
/** Highest level whose every required check passed, walking up from the weakest; DECLARED when even typecheck did not pass. */
export function receiptLevel(checks:ReceiptCheck[]):QualificationLevel{
 let level:QualificationLevel='DECLARED';
 for(const l of QUALIFICATION_LEVELS){const need=RECEIPT_LEVEL_CHECKS[l];if(!need)continue;if(need.every(id=>passed(checks,id)))level=l;else break;}
 return level;
}

/**
 * Validates one release receipt: an exact committed revision, a level backed by its checks, real (non-synthetic)
 * evidence, and neither GALAXY_QUALIFIED nor a Galaxy maturity promotion produced by DiagramCloud on its own.
 */
export function validateVerificationReceipt(raw:unknown):VerificationReceipt{
 const secrets=secretFindings(raw);if(secrets.length)throw new Error(`VerificationReceipt refused: ${secrets.slice(0,10).join('; ')}`);
 const r=verificationReceiptSchema.parse(raw),errors:string[]=[];
 if(r.revision.dirty)errors.push('A receipt describes one exact committed revision; the working tree had uncommitted changes');
 if(r.subject.owner_app!==r.app_id)errors.push(`Receipt subject is owned by ${r.subject.owner_app}, not ${r.app_id}`);
 if(r.verification_level==='GALAXY_QUALIFIED'&&r.app_id==='diagramcloud')errors.push('GALAXY_QUALIFIED needs a cross-app qualification outside DiagramCloud; a DiagramCloud receipt cannot claim it');
 if(r.app_id==='diagramcloud'&&r.galaxy_level!=='G0')errors.push(`DiagramCloud reports Galaxy maturity G0 until a cross-app qualification promotes it, not ${r.galaxy_level}`);
 for(const id of RECEIPT_LEVEL_CHECKS[r.verification_level]??[])if(!passed(r.checks,id))errors.push(`${r.verification_level} needs a passed ${id} check`);
 const derived=receiptLevel(r.checks);
 if(QUALIFICATION_LEVELS.indexOf(r.verification_level)>QUALIFICATION_LEVELS.indexOf(derived))errors.push(`Checks support ${derived}, not ${r.verification_level}`);
 if(r.status==='passed'&&r.checks.some(c=>c.status==='failed'))errors.push('A receipt with a failed check cannot have status passed');
 if(r.verification_level==='MANUAL_QUALIFIED'&&!r.checks.find(c=>c.check_id==='manual-visual')?.evidence_ref_ids.length)errors.push('MANUAL_QUALIFIED needs the manual-visual check to cite its human review evidence');
 const ids=new Set<string>();
 for(const e of r.evidence_refs){if(ids.has(e.evidence_id))errors.push(`Duplicate evidence ID: ${e.evidence_id}`);ids.add(e.evidence_id);if(e.synthetic)errors.push(`${e.evidence_id}: synthetic evidence cannot support a verification receipt`);}
 const seen=new Set<string>();
 for(const c of r.checks){if(seen.has(c.check_id))errors.push(`Duplicate check: ${c.check_id}`);seen.add(c.check_id);for(const id of c.evidence_ref_ids)if(!ids.has(id))errors.push(`${c.check_id}: unknown evidence_ref_id ${id}`);}
 if(errors.length)throw new Error(errors.slice(0,20).join('\n'));
 return r;
}

/** Builds the receipt for one revision. The level is derived from the checks, never passed in. */
export function verificationReceipt(input:{productVersion:string;documentSchemaVersion:number;repository:string;commit:string;branch?:string;dirty:boolean;checks:ReceiptCheck[];evidenceRefs?:EvidenceRef[];createdAt?:Date;caveats?:string[]}):VerificationReceipt{
 const createdAt=input.createdAt??new Date();
 const subject=galaxyEntity('diagramcloud','release',`${input.productVersion}@${input.commit}`,{revision:input.commit,displayName:`DiagramCloud ${input.productVersion}`,metadata:{product_version:input.productVersion}});
 return validateVerificationReceipt({
  schema_version:1,receipt_id:`diagramcloud:${input.productVersion}:${input.commit.slice(0,12)}:${createdAt.getTime()}`,subject,app_id:'diagramcloud',
  product_version:input.productVersion,document_schema_version:input.documentSchemaVersion,galaxy_level:'G0',
  revision:{vcs:'git',repository:input.repository,commit:input.commit,...(input.branch?{branch:input.branch}:{}),dirty:input.dirty},
  verification_level:receiptLevel(input.checks),status:input.checks.some(c=>c.status==='failed')?'failed':'passed',
  checks:input.checks,evidence_refs:input.evidenceRefs??[],created_at:createdAt.toISOString(),
  caveats:['No cross-app qualification is part of this receipt, so it never claims GALAXY_QUALIFIED.','Galaxy maturity stays G0: product version, qualification level and Galaxy maturity are separate dimensions.',...(input.caveats??[])]
 });
}

/** True for anything shaped like a Galaxy publication snapshot, so the import dialog stages it instead of reading it as a document. */
export function isPublicationSnapshot(value:unknown):boolean{
 return !!value&&typeof value==='object'&&typeof (value as {snapshot_id?:unknown}).snapshot_id==='string'&&Array.isArray((value as {contract_versions?:unknown}).contract_versions);
}
