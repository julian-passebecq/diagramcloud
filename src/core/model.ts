import { z } from 'zod';
import {packSchema,validatePack} from '../experience/model';
import {isOpenUri,secretFindings} from './secrets';
import {DATE_ONLY,DATE_OR_INSTANT,DURATION,intervalOf,isError,windowOf} from './schedule';
export const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;
const id = z.string().regex(/^[a-z][a-z0-9_.-]{0,79}$/, 'Use a stable lowercase ID');
const text = z.string().max(50000), short = z.string().min(1).max(160);
const visibility = z.enum(['public','private']).default('public');
const refs = z.array(id).max(1000).default([]);
const point = z.object({x:z.number().finite().min(-100000).max(100000),y:z.number().finite().min(-100000).max(100000)}).strict();
const sourceSchema = z.object({id,title:short,location:text.default(''),url:z.string().url().refine(s=>/^https?:\/\//i.test(s),'Only HTTP(S) source links').optional(),visibility}).strict();
const remoteAssetSchema=z.object({provider:z.literal('google-drive'),fileId:z.string().regex(/^[A-Za-z0-9_-]{1,256}$/,'Invalid Google Drive file ID'),fileName:short,mimeType:z.enum(['image/png','image/jpeg','image/webp']),webViewLink:z.string().url().refine(s=>/^https:\/\//i.test(s),'Drive links must use HTTPS').optional(),modifiedTime:z.string().datetime({offset:true}).optional(),size:z.string().regex(/^\d+$/).optional(),savedAt:z.string().datetime({offset:true})}).strict();
export const assetSchema = z.object({id,name:short,data:z.string().max(3*1024*1024).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/,'Embedded PNG, JPEG or WebP only'),rights:z.string().max(1000),visibility,remote:remoteAssetSchema.optional()}).strict();
export const PROVENANCES=['source-derived','synthetic','reference','author'] as const;
const baseBlock = {id,title:short,visibility,sourceIds:refs,provenance:z.enum(PROVENANCES).default('author'),
 /** Optional step when the block is part of an explained transformation (input → logic → output); display only. */
 transform:z.enum(['input','logic','output','mapping','rules']).optional()};
const dateOrInstant=z.string().regex(DATE_OR_INSTANT,'Use a date such as 2026-10-16 or an ISO 8601 timestamp with an offset');
/** A measurement window: two dates (inclusive days) or two timestamps with an offset. */
export const windowSchema=z.object({from:dateOrInstant,to:dateOrInstant}).strict();
/**
 * Optional quantitative reading on a metrics item, for the baseline/current comparison figure. `measured` was supplied as
 * a measurement, `estimate` is declared as an estimate, `derived` is arithmetic over other supplied values. A synthetic
 * block never carries a measured reading. Comparable only with the same metric, unit, scope and window length.
 */
export const MEASURE_BASES=['measured','estimate','derived'] as const;
export const MEASURE_ROLES=['baseline','current'] as const;
export const measureSchema=z.object({metric:short,value:z.number().finite().min(-1e15).max(1e15),unit:z.string().min(1).max(24),scope:short,window:windowSchema,basis:z.enum(MEASURE_BASES),role:z.enum(MEASURE_ROLES)}).strict();
/**
 * One dated item of a schedule evidence block (Gantt figure): a start and an end or an ISO 8601 duration, either
 * supplied or declared as an estimate. `nodeIds` names the components it concerns. Not a run and not observed timing.
 */
export const SCHEDULE_BASES=['supplied','estimate'] as const;
export const scheduleItemSchema=z.object({id,label:short,nodeIds:refs,start:dateOrInstant,end:dateOrInstant.optional(),duration:z.string().regex(DURATION,'Use an ISO 8601 duration such as P5D, P2W or PT6H').optional(),basis:z.enum(SCHEDULE_BASES),note:z.string().max(500).optional()}).strict();
export const blockSchema = z.discriminatedUnion('type',[
 z.object({...baseBlock,type:z.literal('text'),text}).strict(),
 z.object({...baseBlock,type:z.literal('code'),language:z.enum(['sql','python','dax','json','text']).default('text'),code:text}).strict(),
 z.object({...baseBlock,type:z.literal('table'),columns:z.array(short).min(1).max(20),rows:z.array(z.array(z.union([z.string().max(2000),z.number().finite(),z.boolean(),z.null()])).max(20)).max(500)}).strict(),
 z.object({...baseBlock,type:z.literal('image'),assetId:id,caption:text.default('')}).strict(),
 z.object({...baseBlock,type:z.literal('metrics'),items:z.array(z.object({label:short,value:z.string().max(80),note:z.string().max(500).default(''),measure:measureSchema.optional()}).strict()).max(12)}).strict(),
 z.object({...baseBlock,type:z.literal('schedule'),timezone:z.string().regex(/^(?:date-only|UTC|[+-]\d{2}:\d{2}|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)+)$/,'Use date-only, UTC, an offset such as +02:00 or a time zone name such as Europe/Paris'),items:z.array(scheduleItemSchema).min(1).max(100)}).strict()
]);
/**
 * Where a component or connection comes from, when it matters (project atlas). `planned`: declared intent (a project
 * manifest, an author's design); `static-source`: read from source or configuration by a scan; `unknown`: membership is
 * declared but nothing was read. Observed/verified facts are never a basis: they enter only as reviewed observations.
 */
export const BASES=['planned','static-source','unknown'] as const;
const basis=z.enum(BASES).optional();
/** Perspectives a view can belong to; the same stable component ID may appear in several. */
export const PERSPECTIVES=['system','code','data','cloud','git','cicd','agents','decisions','evidence'] as const;
export type Perspective=typeof PERSPECTIVES[number];
/** Optional rationale: goal, options, reasons, tradeoffs, assumptions and when to revisit. No numeric score or saving.
 * A candidate (an AI recommendation included) is never an accepted decision; acceptance records who decided and when. */
export const CHOICE_STATUSES=['candidate','accepted'] as const;
export const CHOICE_ORIGINS=['author','ai','imported'] as const;
const choiceLine=z.string().min(1).max(500),choiceLines=z.array(choiceLine).max(20).default([]);
const fingerprint=z.string().regex(/^[0-9a-f]{16}$/,'A fingerprint is 16 hexadecimal characters');
export const choiceOptionSchema=z.object({id,label:short,summary:z.string().max(1000).default('')}).strict();
export const choiceSchema=z.object({id,title:short,goal:z.string().min(1).max(1000),options:z.array(choiceOptionSchema).min(1).max(12),recommendedOptionId:id.optional(),chosenOptionId:id.optional(),reasons:choiceLines,tradeoffs:choiceLines,assumptions:choiceLines,revisitWhen:z.string().max(500).optional(),status:z.enum(CHOICE_STATUSES).default('candidate'),origin:z.enum(CHOICE_ORIGINS).default('author'),suggestedBy:z.string().min(1).max(160).optional(),decidedBy:z.string().min(1).max(160).optional(),decidedAt:z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/,'Use a date such as 2026-10-16 or an ISO 8601 timestamp with a time zone').optional(),
 /** The project revision and the content fingerprint of the facts the decision was reviewed against; review-needed is derived from it, never stored. */
 reviewBasis:z.object({revision:z.number().int().nonnegative(),fingerprint}).strict().optional(),sourceIds:refs,visibility}).strict();
const choices=z.array(choiceSchema).max(20).optional();
/** Words of a person or agent name, ignoring case, accents, spacing and punctuation. */
export const agentWords=(name:string|undefined)=>(name??'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
/** True when two names designate the same reviewer: equal after normalization, or every word of one appears in the other
 * ("Claude" and "claude-opus 5.5"). Used to refuse the self-review of a suggestion or recommendation. */
export function sameAgent(a:string|undefined,b:string|undefined):boolean{
 const x=agentWords(a),y=agentWords(b);if(!x.length||!y.length)return false;
 const [few,many]=x.length<=y.length?[x,y]:[y,x];return few.every(w=>many.includes(w));
}
export const nodeSchema=z.object({id,label:short,kind:z.enum(['source','process','storage','model','report','app','control','physics','function','table']).default('process'),provider:z.string().max(80).default('Generic'),icon:z.string().max(80).default('generic'),customIconAssetId:id.optional(),summary:z.string().max(500).default(''),role:z.string().max(1000).default(''),status:z.enum(['idle','running','complete','warning','failed']).default('idle'),childViewId:id.optional(),experienceWorkspaceId:id.optional(),blockIds:refs,sourceIds:refs,tags:z.array(z.string().max(80)).max(20).default([]),basis,choices,visibility}).strict();
/** An optional amount carried by a connection (rows/day, GB, events/s…), with its provenance; drawn by the Sankey figure. Never inferred by an importer.
 * `measurementId` is the identity of the supplied measurement: one measurement on two connections of one scope is ambiguous and
 * never counted twice. `scope` and `window` say what population and period it covers; only comparable ones are aggregated. */
export const quantitySchema=z.object({value:z.number().finite().min(0).max(1e15),unit:z.string().min(1).max(24),provenance:z.enum(PROVENANCES),note:z.string().max(200).optional(),measurementId:id.optional(),scope:short.optional(),window:windowSchema.optional()}).strict();
export const edgeSchema=z.object({id,source:id,target:id,label:z.string().max(160).default(''),kind:z.enum(['batch','stream','query','control','dependency']).default('batch'),speed:z.enum(['slow','medium','fast']).default('medium'),basis,quantity:quantitySchema.optional(),visibility}).strict();
/** Diagram Design render hints (visual grammar adapted from diagram-design, MIT): which figure type, which 1-2 focal components, which theme. Presentation only: never facts. */
export const DESIGN_TYPES=['auto','architecture','layers','exploded','tree','swimlane','sequence','timeline','chart','deployment','matrix','treemap','hub','heatmap','line','context','status','lineage','radial','atlas','sankey','waterfall','gantt','comparison'] as const;
export type DesignType=typeof DESIGN_TYPES[number];
export const DESIGN_THEMES=['light','dark','editorial'] as const;
export type DesignTheme=typeof DESIGN_THEMES[number];
export const designSchema=z.object({type:z.enum(DESIGN_TYPES).default('auto'),focal:z.array(id).max(2).default([]),theme:z.enum(DESIGN_THEMES).optional(),caption:z.string().max(300).optional()}).strict();
export const viewSchema=z.object({id,title:short,description:z.string().max(2000).default(''),nodeIds:refs,edgeIds:refs,positions:z.record(id,point).default({}),perspective:z.enum(PERSPECTIVES).optional(),design:designSchema.optional(),choices,visibility}).strict();
const instant=z.string().datetime({offset:true,message:'Use an ISO 8601 timestamp with a time zone, e.g. 2026-09-25T10:00:00Z'});
const openUri=z.string().max(2000).refine(isOpenUri,'Only http(s) or vscode links without embedded credentials');
/**
 * Realization overlay. Every component is Planned/Designed (architecture intent); its `status` is an illustrative
 * design state, never a deployment claim. An observation is a dated external fact about one component, owned by
 * another app (sourceApp/authority) at a source revision. It enters only through a reviewed patch, starts private
 * and unreviewed, and becomes Presented only when an author reviews it and makes it public. `shareable` further
 * lets a presented card appear in the portfolio index.
 */
export const OBSERVATION_CLAIMS=['observed','verified','partial','not-observed'] as const;
/** Independent, source-owned state axes. Values retain the producer's vocabulary: a lifecycle FROZEN may
 * coexist with distribution DEPLOYED. Scope is supplied by that producer, never inferred from a folder or Git.
 * Provenance, claim, review and visibility belong to the enclosing observation; no parallel state store. */
export const STATE_FACETS=['lifecycle','selection','implementation','verification','distribution','runtime'] as const;
export type StateFacet=typeof STATE_FACETS[number];
const stateText=short.refine(s=>s.trim().length>0,'State value and scope must be explicit, nonblank source text');
export const stateFacetSchema=z.object({facet:z.enum(STATE_FACETS),value:stateText,scope:stateText}).strict();
export const observationSchema=z.object({id,nodeId:id,sourceApp:z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/,'Source app is a lowercase Galaxy/app name such as datapass_vscode or datapass-vscode'),authority:short,observedAt:instant,sourceRevision:z.string().min(1).max(120),claim:z.enum(OBSERVATION_CLAIMS),summary:z.string().min(1).max(500),link:openUri.optional(),blockIds:refs,caveat:z.string().max(1000).default(''),visibility:z.enum(['public','private']).default('private'),reviewedAt:instant.optional(),shareable:z.boolean().default(false),stateFacet:stateFacetSchema.optional()}).strict();
/** Reference-to-instance association: a catalogue concept (at a content revision) explained by one exact component or
 * view of this project (at an evidence fingerprint). Stored states only; `stale` is derived on reading, never stored, so a
 * change of lesson content or target evidence can never be silently rebound. A name, alias, tag or icon may rank a
 * candidate; it is never evidence: source-declared and reviewed mappings cite project sources or evidence blocks. */
export const MAPPING_STATES=['suggested','source-declared','reviewed','rejected'] as const;
export const MAPPING_ORIGINS=['author','ai','imported','source'] as const;
export const learningMappingSchema=z.object({id,conceptId:z.string().regex(/^[a-z][a-z0-9-]{0,60}$/,'Use the catalogue concept ID'),contentRevision:z.string().min(1).max(80),
 target:z.object({projectId:id,kind:z.enum(['node','view']),id,projectRevision:z.number().int().nonnegative(),fingerprint:z.string().regex(/^[0-9a-f]{16}$/,'A target fingerprint is 16 hexadecimal characters')}).strict(),
 evidence:z.object({sourceIds:refs,blockIds:refs}).strict().default({sourceIds:[],blockIds:[]}),
 state:z.enum(MAPPING_STATES).default('suggested'),origin:z.enum(MAPPING_ORIGINS).default('author'),suggestedBy:z.string().min(1).max(160).optional(),reviewedBy:z.string().min(1).max(160).optional(),reviewedAt:instant.optional(),note:z.string().max(500).optional(),visibility}).strict();
export type LearningMapping=z.infer<typeof learningMappingSchema>;
/**
 * Baseline-bound variant: a named change set (JSON Patch operations, `@id` addressing) against one view at a recorded
 * baseline (project revision + content fingerprint of the view, its members and every addressed item). It is a candidate,
 * never a fact: selecting it compares only, and Apply goes through the reviewed, revision-guarded patch path as one
 * undoable revision. A changed baseline makes it stale until the author explicitly rebases. Items it adds use IDs in
 * its own namespace (`<variant id>.<local>`), so candidate-local IDs never collide with canonical ones. Authoring only:
 * publicDocument drops every variant. Local/test/prod instances are delivery declarations, never variants.
 */
const variantPath=z.string().max(512).regex(/^\/(?:(?:nodes|edges)\/(?:-|@[a-z][a-z0-9_.-]{0,79})|views\/@[a-z][a-z0-9_.-]{0,79}\/[^/]+)(?:\/[^/]+)*$/,'A variant changes components (/nodes/@id), connections (/edges/@id) or its own view (/views/@id/...); use - (never an index) to add');
export const variantOperationSchema=z.discriminatedUnion('op',[
 z.object({op:z.literal('add'),path:variantPath,value:z.unknown()}).strict(),z.object({op:z.literal('remove'),path:variantPath}).strict(),
 z.object({op:z.literal('replace'),path:variantPath,value:z.unknown()}).strict(),z.object({op:z.literal('test'),path:variantPath,value:z.unknown()}).strict()]);
export const variantSchema=z.object({id,title:short,summary:z.string().max(1000).default(''),viewId:id,base:z.object({revision:z.number().int().nonnegative(),fingerprint}).strict(),
 operations:z.array(variantOperationSchema).min(1).max(200),origin:z.enum(CHOICE_ORIGINS).default('author'),suggestedBy:z.string().min(1).max(160).optional()}).strict();
export type Variant=z.infer<typeof variantSchema>;
/**
 * Tour: a presented sequence of stops, never timing and never a run. Each stop stores its selected view, the stable IDs
 * of its subjects, a content fingerprint of them taken when recorded, and narration; the tour records the project
 * revision it was authored at. Anchors are not checked here: a missing or changed anchor is derived on reading and fails
 * visibly when played. In public output a hidden subject or view is omitted and the stop says so (`omitted`).
 */
export const tourStopSchema=z.object({id:id.optional(),viewId:id.optional(),subjects:z.array(z.object({kind:z.enum(['node','edge']),id}).strict()).max(20).default([]),fingerprint:fingerprint.optional(),narration:z.string().max(2000).default(''),omitted:z.enum(['subjects','stop']).optional()}).strict();
export const tourSchema=z.object({id,title:short,sourceRevision:z.number().int().nonnegative(),stops:z.array(tourStopSchema).min(1).max(50),visibility}).strict();
export type Tour=z.infer<typeof tourSchema>;
export type TourStop=z.infer<typeof tourStopSchema>;
export const portfolioSchema=z.object({projectRef:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/,'Use a stable project reference such as a DATAPASSCONTROL entity_id').optional(),openUri:openUri.optional(),lastReviewedAt:instant.optional(),indexVisibility:z.enum(['private','shareable']).default('private')}).strict();
const stepSchema=z.object({title:short,viewId:id,nodeId:id.optional(),narration:z.string().max(2000),highlightEdgeIds:refs,observationIds:z.array(id).max(20).optional()}).strict();
/**
 * Project atlas: a project made of N repositories. A snapshot is a revision vector captured at one time: each
 * repository keeps its own host, locator and exact revision. There is no single project SHA. Runtime and project
 * context references point at facts owned by other apps (Cloud, Lens, Brain…); DiagramCloud only presents them.
 */
const sha=z.string().regex(/^[0-9a-f]{7,64}$/,'A revision is a hexadecimal commit ID (7 to 64 characters)');
const locator=z.string().min(1).max(500).refine(s=>!/^[a-z][a-z0-9+.-]*:\/\/[^/]*@/i.test(s)&&!/[?&](token|access_token|private_token|sig)=/i.test(s),'A repository locator never carries credentials');
export const REPOSITORY_HOSTS=['github','gitlab','azure-devops','bitbucket','local','other'] as const;
export const SCAN_STATUSES=['scanned','not-scanned','failed','missing'] as const;
export const snapshotRepositorySchema=z.object({id,title:short,host:z.enum(REPOSITORY_HOSTS),locator,revision:sha.optional(),ref:z.string().max(200).optional(),
 scanStatus:z.enum(SCAN_STATUSES),authority:z.enum(['git','manifest','lens','brain','author']),scannedAt:instant.optional(),nodeId:id.optional(),note:z.string().max(500).optional(),visibility:z.enum(['public','private']).optional()}).strict();
export const externalRefSchema=z.object({id,sourceApp:z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),kind:short,ref:z.string().min(1).max(500),observedAt:instant.optional(),basis:z.enum(['planned','static-source','observed']),note:z.string().max(500).optional()}).strict();
export const snapshotSchema=z.object({id,capturedAt:instant,label:z.string().max(160).optional(),repositories:z.array(snapshotRepositorySchema).max(60),runtimeRefs:z.array(externalRefSchema).max(200).default([]),contextRefs:z.array(externalRefSchema).max(200).default([])}).strict();
export const atlasSchema=z.object({snapshots:z.array(snapshotSchema).min(1).max(20),activeSnapshotId:id}).strict();
export type ProjectSnapshot=z.infer<typeof snapshotSchema>;
export type SnapshotRepository=z.infer<typeof snapshotRepositorySchema>;
export type ProjectAtlas=z.infer<typeof atlasSchema>;
/** Deployment declarations are independent of branches/repository identities.
 * Runtime claims remain reviewed observations targeting an instance's node. */
const deliveryBase={id,sourceIds:refs,visibility};
export const deliverySchema=z.object({
 environments:z.array(z.object({...deliveryBase,label:short,description:z.string().max(500).default(''),role:z.string().max(80).optional(),lifecycle:z.enum(['ephemeral','persistent','unknown']).optional(),bindings:z.array(z.object({kind:z.enum(['provider','tenant','scope','region','residency','backup','trust-boundary','owner']),label:short,sourceIds:refs,visibility}).strict()).max(20).optional()}).strict()).max(30),
 artifacts:z.array(z.object({...deliveryBase,label:short,version:short,digest:z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),sourceRevision:z.string().max(200).optional(),sourceRepositoryId:z.string().max(120).optional(),buildId:short.optional()}).strict()).max(100),
 instances:z.array(z.object({...deliveryBase,nodeId:id,componentId:id,environmentId:id,artifactId:id.optional(),releaseId:id.optional(),declaredRevision:z.string().max(120).optional()}).strict()).max(150),
 promotions:z.array(z.object({...deliveryBase,fromEnvironmentId:id,toEnvironmentId:id,artifactId:id.optional(),releaseId:id.optional(),gates:z.array(z.object({id,label:short,observationId:id.optional()}).strict()).max(20).default([])}).strict()).max(100),
 releases:z.array(z.object({...deliveryBase,label:short,artifactIds:refs}).strict()).max(100).optional(),
 applicability:z.array(z.object({...deliveryBase,componentId:id,environmentId:id,state:z.literal('not-applicable'),reason:z.string().min(1).max(500)}).strict()).max(300).optional(),
 configurations:z.array(z.object({...deliveryBase,componentId:id,environmentId:id,kind:z.enum(['flag','configuration']),name:short,valueState:z.enum(['declared-enabled','declared-disabled','configured','unknown'])}).strict()).max(300).optional()
}).strict();
export type ProjectDelivery=z.infer<typeof deliverySchema>;
export const documentSchema=z.object({schemaVersion:z.literal(1),id,revision:z.number().int().nonnegative().default(0),title:short,summary:z.string().max(3000).default(''),author:z.string().max(160).default(''),category:z.enum(['Portfolio','Reference','Blank']).default('Blank'),tags:z.array(z.string().max(80)).max(30).default([]),rootViewId:id,provenance:z.string().max(3000).default(''),privateNotes:z.string().max(10000).optional(),nodes:z.array(nodeSchema).max(500),edges:z.array(edgeSchema).max(1500),views:z.array(viewSchema).min(1).max(80),blocks:z.array(blockSchema).max(1500).default([]),assets:z.array(assetSchema).max(30).default([]),sources:z.array(sourceSchema).max(200).default([]),story:z.array(stepSchema).max(100).default([]),observations:z.array(observationSchema).max(500).default([]),portfolio:portfolioSchema.optional(),experience:packSchema.optional(),atlas:atlasSchema.optional(),delivery:deliverySchema.optional(),learningMappings:z.array(learningMappingSchema).max(500).optional(),variants:z.array(variantSchema).max(50).optional(),tours:z.array(tourSchema).max(30).optional()}).strict();
export type Project=z.infer<typeof documentSchema>;
export type ProjectNode=z.infer<typeof nodeSchema>;
export type ProjectEdge=z.infer<typeof edgeSchema>;
export type ProjectView=z.infer<typeof viewSchema>;
export type Choice=z.infer<typeof choiceSchema>;
export type EvidenceBlock=z.infer<typeof blockSchema>;
export type Asset=z.infer<typeof assetSchema>;
export type Observation=z.infer<typeof observationSchema>;

/** Timing and measurement facts that the schema alone cannot check: real dates, ordered intervals, agreeing end and duration,
 * one time basis per schedule, no measured reading in a synthetic block. Refused visibly, never repaired. */
function timingErrors(b:z.infer<typeof blockSchema>,nodes:Set<string>):string[]{
 const errors:string[]=[];
 if(b.type==='schedule'){const dateOnly=b.timezone==='date-only',seen=new Set<string>();
  for(const i of b.items){const where=`${b.id}/${i.id}`;if(seen.has(i.id))errors.push(`${b.id}: duplicate schedule item ID ${i.id}`);seen.add(i.id);
   i.nodeIds.forEach(r=>{if(!nodes.has(r))errors.push(`${where}: unknown reference ${r}`);});
   if(dateOnly!==DATE_ONLY.test(i.start)||(i.end!==undefined&&dateOnly!==DATE_ONLY.test(i.end)))errors.push(`${where}: this schedule is ${dateOnly?'date-only: use calendar dates such as 2026-10-16':`timed (${b.timezone}): use timestamps with an offset such as 2026-10-16T09:00:00Z`}; one schedule uses one time basis`);
   else{const x=intervalOf(i,dateOnly);if(isError(x))errors.push(`${where}: ${x.error}`);}}}
 if(b.type==='metrics'){const keys=new Set<string>();
  for(const i of b.items){if(!i.measure)continue;const m=i.measure,where=`${b.id}/${i.label}`,w=windowOf(m.window);if(isError(w))errors.push(`${where}: ${w.error}`);
   if(b.provenance==='synthetic'&&m.basis==='measured')errors.push(`${where}: a synthetic block cannot carry a measured value; use basis estimate or derived`);
   const key=m.metric+'\0'+m.scope+'\0'+m.role;if(keys.has(key))errors.push(`${b.id}: two ${m.role} readings of ${m.metric} for ${m.scope}; one block gives one`);keys.add(key);}}
 return errors;
}
/** Every import and edit crosses the same structural and relational boundary. */
export function validateDocument(input:unknown):Project {
 const d=documentSchema.parse(input), errors:string[]=[];
 if(d.experience)validatePack(d.experience);
 for(const node of d.nodes)if(node.experienceWorkspaceId&&!d.experience?.workspaces.some(w=>w.id===node.experienceWorkspaceId))errors.push(`${node.id}: unknown experience workspace ${node.experienceWorkspaceId}`);
 function ids(items:{id:string}[],kind:string){const seen=new Set<string>();for(const i of items){if(seen.has(i.id))errors.push(`Duplicate ${kind} ID: ${i.id}`);seen.add(i.id);}return seen;}
 const nodes=ids(d.nodes,'node'),edges=ids(d.edges,'edge'),views=ids(d.views,'view'),blocks=ids(d.blocks,'block'),assets=ids(d.assets,'asset'),sources=ids(d.sources,'source'),observations=ids(d.observations,'observation');
 function check(ref:string,set:Set<string>,label:string){if(!set.has(ref))errors.push(`${label}: unknown reference ${ref}`);}
 check(d.rootViewId,views,'rootViewId');
 if(d.views.find(v=>v.id===d.rootViewId)?.visibility==='private')errors.push('Root view must be public');
 for(const n of d.nodes){if(n.customIconAssetId){check(n.customIconAssetId,assets,n.id);const asset=d.assets.find(a=>a.id===n.customIconAssetId);if(asset&&!asset.rights.trim())errors.push(n.id+': custom icon requires recorded rights');}n.blockIds.forEach(r=>check(r,blocks,n.id));n.sourceIds.forEach(r=>check(r,sources,n.id));if(n.childViewId)check(n.childViewId,views,n.id);}
 for(const e of d.edges){check(e.source,nodes,e.id);check(e.target,nodes,e.id);if(e.quantity?.window){const w=windowOf(e.quantity.window);if(isError(w))errors.push(`${e.id}: quantity ${w.error}`);}}
 for(const b of d.blocks){b.sourceIds.forEach(r=>check(r,sources,b.id));for(const e of timingErrors(b,nodes))errors.push(e);if(b.type==='image')check(b.assetId,assets,b.id);if(b.type==='table'&&b.rows.some(r=>r.length!==b.columns.length))errors.push(`${b.id}: each row must match the column count`);}
 for(const v of d.views){v.nodeIds.forEach(r=>check(r,nodes,v.id));v.edgeIds.forEach(r=>check(r,edges,v.id));if(new Set(v.nodeIds).size!==v.nodeIds.length||new Set(v.edgeIds).size!==v.edgeIds.length)errors.push(`${v.id}: duplicate view membership`);for(const key of Object.keys(v.positions))if(!v.nodeIds.includes(key))errors.push(`${v.id}: position for non-member ${key}`);for(const f of v.design?.focal??[])if(!v.nodeIds.includes(f))errors.push(`${v.id}: focal component ${f} is not in this view`);for(const e of d.edges.filter(e=>v.edgeIds.includes(e.id)))if(!v.nodeIds.includes(e.source)||!v.nodeIds.includes(e.target))errors.push(`${v.id}: edge ${e.id} has an endpoint outside this view`);}
 // External observations: no credentials or .env text, no synthetic backing, no self-promotion to shareable.
 d.observations.forEach((o,i)=>{check(o.nodeId,nodes,o.id);o.blockIds.forEach(r=>check(r,blocks,o.id));
  for(const f of secretFindings(o,`observations[${i}]`))errors.push(`Refused ${f}. Remove credentials and .env values; reference them by name only.`);
  for(const b of d.blocks.filter(b=>o.blockIds.includes(b.id)&&b.provenance==='synthetic'))errors.push(`${o.id}: synthetic block ${b.id} cannot back an observation; synthetic figures are never measured results`);
  if(o.shareable&&!(o.reviewedAt&&o.visibility==='public'))errors.push(`${o.id}: only a reviewed, public observation can be marked shareable`);});
 if(d.portfolio)for(const f of secretFindings(d.portfolio,'portfolio'))errors.push(`Refused ${f}`);
 if(d.delivery){const envs=ids(d.delivery.environments,'environment'),artifacts=ids(d.delivery.artifacts,'artifact'),releases=ids(d.delivery.releases??[],'release');ids(d.delivery.instances,'deployment instance');ids(d.delivery.promotions,'promotion');ids(d.delivery.applicability??[],'applicability');ids(d.delivery.configurations??[],'configuration');
  for(const row of [...d.delivery.environments,...d.delivery.artifacts,...d.delivery.instances,...d.delivery.promotions,...(d.delivery.releases??[]),...(d.delivery.applicability??[]),...(d.delivery.configurations??[])])row.sourceIds.forEach(r=>check(r,sources,row.id));
  for(const env of d.delivery.environments){const keys=new Set<string>();for(const binding of env.bindings??[]){binding.sourceIds.forEach(r=>check(r,sources,env.id));const key=binding.kind+'\0'+binding.label;if(keys.has(key))errors.push(`${env.id}: duplicate environment binding`);keys.add(key);}}
  for(const release of d.delivery.releases??[])release.artifactIds.forEach(r=>check(r,artifacts,release.id));
  for(const row of [...(d.delivery.applicability??[]),...(d.delivery.configurations??[])]){check(row.componentId,nodes,row.id);check(row.environmentId,envs,row.id);if(d.delivery.instances.some(i=>i.nodeId===row.componentId))errors.push(`${row.id}: environment metadata must reference a logical component`);}
  const applicabilityKeys=new Set<string>();for(const row of d.delivery.applicability??[]){const key=row.componentId+'\0'+row.environmentId;if(applicabilityKeys.has(key))errors.push(`${row.id}: duplicate component/environment applicability`);applicabilityKeys.add(key);}
  for(const row of d.delivery.applicability??[])if(d.delivery.instances.some(i=>i.componentId===row.componentId&&i.environmentId===row.environmentId))errors.push(`${row.id}: not-applicable conflicts with a deployment instance`);
  for(const row of [...d.delivery.instances,...d.delivery.promotions])if(row.releaseId&&row.artifactId&&!d.delivery.releases?.find(r=>r.id===row.releaseId)?.artifactIds.includes(row.artifactId))errors.push(`${row.id}: artifact is outside the declared release`);
  for(const i of d.delivery.instances){check(i.nodeId,nodes,i.id);check(i.componentId,nodes,i.id);check(i.environmentId,envs,i.id);if(i.artifactId)check(i.artifactId,artifacts,i.id);if(i.releaseId)check(i.releaseId,releases,i.id);}
  const instanceNodes=d.delivery.instances.map(i=>i.nodeId);if(new Set(instanceNodes).size!==instanceNodes.length)errors.push('Deployment instance nodes must be distinct');
  if(d.delivery.instances.some(i=>instanceNodes.includes(i.componentId)))errors.push('Logical components must be distinct from deployment instance nodes');
  for(const p of d.delivery.promotions){check(p.fromEnvironmentId,envs,p.id);check(p.toEnvironmentId,envs,p.id);if(p.artifactId)check(p.artifactId,artifacts,p.id);if(p.releaseId)check(p.releaseId,releases,p.id);ids(p.gates,'gate in '+p.id);for(const g of p.gates)if(g.observationId)check(g.observationId,observations,g.id);}
  for(const f of secretFindings(d.delivery,'delivery'))errors.push(`Refused ${f}`);
 }
 if(d.atlas){const snaps=ids(d.atlas.snapshots,'snapshot');check(d.atlas.activeSnapshotId,snaps,'atlas');
  for(const s of d.atlas.snapshots){ids(s.repositories,`repository in ${s.id}`);for(const r of s.repositories){if(r.nodeId)check(r.nodeId,nodes,`${s.id}/${r.id}`);if(r.scanStatus==='scanned'&&!r.scannedAt)errors.push(`${s.id}/${r.id}: a scanned repository records when it was scanned`);}
   for(const f of secretFindings(s,`atlas.${s.id}`))errors.push(`Refused ${f}`);}}
 for(const s of d.story){check(s.viewId,views,'story');for(const r of s.observationIds??[]){const o=d.observations.find(o=>o.id===r);if(!o)check(r,observations,'story');else if(!o.reviewedAt)errors.push(`Story cites observation ${r} before it is reviewed`);else if(!d.views.find(v=>v.id===s.viewId)?.nodeIds.includes(o.nodeId))errors.push(`Story observation ${r} is about a component outside ${s.viewId}`);}if(s.nodeId&&!d.views.find(v=>v.id===s.viewId)?.nodeIds.includes(s.nodeId))errors.push(`Story node ${s.nodeId} not in ${s.viewId}`);s.highlightEdgeIds.forEach(r=>{if(!d.views.find(v=>v.id===s.viewId)?.edgeIds.includes(r))errors.push(`Story edge ${r} not in ${s.viewId}`);});}
 // Choices: stable IDs, options that exist, and a candidate never carries a chosen option.
 const allChoices=[...d.nodes,...d.views].flatMap(owner=>(owner.choices??[]).map(c=>({owner:owner.id,c})));ids(allChoices.map(x=>x.c),'choice');
 for(const {owner,c} of allChoices){const where=`${owner}/${c.id}`,options=ids(c.options,`option in ${where}`);c.sourceIds.forEach(r=>check(r,sources,where));
  for(const ref of [c.recommendedOptionId,c.chosenOptionId])if(ref)check(ref,options,where);
  if(c.status==='candidate'&&c.chosenOptionId)errors.push(`${where}: a candidate has no chosen option; use recommendedOptionId, or accept it with chosenOptionId, decidedBy and decidedAt`);
  if(c.status==='accepted'&&!(c.chosenOptionId&&c.decidedBy&&c.decidedAt))errors.push(`${where}: an accepted decision records chosenOptionId, decidedBy and decidedAt`);
  if(c.status==='accepted'&&sameAgent(c.decidedBy,c.suggestedBy))errors.push(`${where}: a recommendation cannot accept itself; decidedBy must be a person other than suggestedBy (an AI recommendation is not a decision)`);}
 // Concept mappings: an unknown or changed target is stale (derived), not invalid; establishing a mapping needs evidence and a human reviewer.
 ids(d.learningMappings??[],'concept mapping');const mappingPairs=new Set<string>();
 for(const m of d.learningMappings??[]){const pair=m.conceptId+'\0'+m.target.kind+'\0'+m.target.id;if(mappingPairs.has(pair))errors.push(`${m.id}: duplicate mapping of ${m.conceptId} to ${m.target.kind} ${m.target.id}`);mappingPairs.add(pair);
  if((m.state==='reviewed'||m.state==='source-declared')&&!m.evidence.sourceIds.length&&!m.evidence.blockIds.length)errors.push(`${m.id}: a ${m.state} mapping cites at least one project source or evidence block; a shared name, tag or icon is not evidence`);
  if(m.state==='reviewed'&&!(m.reviewedBy&&m.reviewedAt))errors.push(`${m.id}: a reviewed mapping records reviewedBy and reviewedAt`);
  if((m.state==='suggested'||m.state==='source-declared')&&(m.reviewedBy||m.reviewedAt))errors.push(`${m.id}: only a reviewed or rejected mapping records a reviewer`);
  if(m.origin==='ai'&&m.state==='source-declared')errors.push(`${m.id}: an AI suggestion is not a source declaration`);
  if(m.origin==='ai'&&!m.suggestedBy)errors.push(`${m.id}: an AI suggestion records suggestedBy`);
  if(m.origin!=='author'&&m.state==='reviewed'&&sameAgent(m.reviewedBy,m.suggestedBy))errors.push(`${m.id}: an ${m.origin==='ai'?'AI':'imported'} suggestion cannot review itself; a person other than ${m.suggestedBy} reviews it in Edit mode`);}
 // Variants: candidate-local IDs live in the variant's namespace and no canonical ID may enter it. Baselines are checked on reading.
 ids(d.variants??[],'variant');const canonicalIds=[...d.nodes,...d.edges,...d.views,...d.blocks].map(x=>x.id);
 for(const v of d.variants??[]){const local=v.id+'.';for(const c of canonicalIds)if(c.startsWith(local))errors.push(`${c}: this canonical ID is inside variant ${v.id}'s local namespace (${local}…)`);
  v.operations.forEach((o,n)=>{const where=`${v.id} operation ${n+1}`,view=/^\/views\/@([^/]+)/.exec(o.path);if(view&&view[1]!==v.viewId)errors.push(`${where}: a variant changes only its own view ${v.viewId}`);
   const item=/^\/(nodes|edges)\/(-|@[^/]+)$/.exec(o.path),value='value' in o?o.value:undefined,valueId=value&&typeof value==='object'?(value as {id?:unknown}).id:undefined,what=item?.[1]==='nodes'?'component':'connection';
   if(item&&o.op==='add'&&item[2]!=='-')errors.push(`${where}: add a ${what} at /${item[1]}/-`);
   else if(item&&o.op==='add'&&!(typeof valueId==='string'&&valueId.startsWith(local)&&valueId.length>local.length))errors.push(`${where}: an added ${what} takes a candidate-local ID starting with “${local}”, so it never collides with a canonical ID`);
   if(item&&o.op==='replace'&&valueId!==item[2].slice(1))errors.push(`${where}: a replaced ${what} keeps its stable ID ${item[2].slice(1)}`);});}
 // Tours: anchors are derived on reading (a stale or missing one fails visibly when played); only the stop shape is checked here.
 ids(d.tours??[],'tour');
 for(const t of d.tours??[])t.stops.forEach((s,n)=>{const where=`${t.id} stop ${n+1}`;
  if(s.omitted==='stop'){if(s.id||s.viewId||s.subjects.length||s.narration||s.fingerprint)errors.push(`${where}: an omitted stop keeps no view, subjects, fingerprint, narration or ID`);}
  else if(!s.viewId||!s.fingerprint)errors.push(`${where}: a stop records its selected view and a content fingerprint`);
  if(new Set(s.subjects.map(x=>x.kind+'\0'+x.id)).size!==s.subjects.length)errors.push(`${where}: duplicate subject`);});
 for(const t of d.tours??[]){const stopIds=t.stops.flatMap(s=>s.id?[s.id]:[]);if(new Set(stopIds).size!==stopIds.length)errors.push(`${t.id}: duplicate stop ID; a stop ID is unique within its tour`);}
 // Data-flow cycles are legal. Recursive view expansion is not.
 const done=new Set<string>(),visiting=new Set<string>();
 function visit(viewId:string){if(visiting.has(viewId)){errors.push(`Recursive drilldown cycle at ${viewId}`);return;}if(done.has(viewId))return;visiting.add(viewId);const v=d.views.find(v=>v.id===viewId);for(const n of d.nodes.filter(n=>v?.nodeIds.includes(n.id)))if(n.childViewId)visit(n.childViewId);visiting.delete(viewId);done.add(viewId);}
 d.views.forEach(v=>visit(v.id));
 if(errors.length)throw new Error(errors.slice(0,20).join('\n'));
 return d;
}
export function parseDocument(raw:string):Project{if(new TextEncoder().encode(raw).byteLength>MAX_DOCUMENT_BYTES)throw new Error('Document exceeds the 12 MiB import limit');return validateDocument(JSON.parse(raw));}
export function clone<T>(value:T):T{return structuredClone(value);}
export function errorMessage(error:unknown):string{return error instanceof Error?error.message:String(error);}
export const newId=(prefix:string)=>`${prefix}-${crypto.randomUUID().slice(0,12)}`;
