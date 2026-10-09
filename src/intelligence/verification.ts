import {z} from 'zod';
import {validateDocument,type Project} from '../core/model';
import {validateVerificationReceipt,type VerificationReceipt} from '../core/galaxy';
import {applyDocumentPatch,type Patch,type Operation} from '../core/patch';
import {observationPatch} from '../core/realization';
import {isOpenUri,secretFindings} from '../core/secrets';
import {impactFacts} from './recipes';

const id=z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/),sha=z.string().regex(/^[a-f0-9]{40}$/);
export const verificationSpecSchema=z.object({format:z.literal('diagramcloud.verification-spec'),version:z.literal(1),id,
 projectId:z.string().max(80),projectRevision:z.number().int().nonnegative(),state:z.literal('PROPOSED'),
 repositories:z.array(z.object({id,repository:z.string().min(1).max(200),commit:sha}).strict()).min(1).max(60),
 checks:z.array(z.object({id,nodeId:z.string().max(80),edgeId:z.string().max(80).optional(),repositoryId:id,
  question:z.string().min(1).max(300),expected:z.string().min(1).max(500),kind:z.enum(['source','test','build','deployment','manual']),result:z.literal('NOT_RUN')}).strict()).min(1).max(100),
 note:z.literal('This spec defines requested checks; it is not a result, permission or execution instruction.')}).strict();
export type VerificationSpec=z.infer<typeof verificationSpecSchema>;
export function validateVerificationSpec(input:unknown,project:Project){const doc=validateDocument(project),s=verificationSpecSchema.parse(input);
 if(s.projectId!==doc.id||s.projectRevision!==doc.revision)throw new Error('Verification spec project/revision differs from selected authoring document');
 if(secretFindings(s).length)throw new Error('Verification spec contains secret values');
 if(new Set(s.repositories.map(r=>r.id)).size!==s.repositories.length||new Set(s.checks.map(c=>c.id)).size!==s.checks.length)throw new Error('Duplicate verification identity');
 for(const c of s.checks){if(!s.repositories.some(r=>r.id===c.repositoryId)||!doc.nodes.some(n=>n.id===c.nodeId))throw new Error('Verification subject unavailable');if(c.edgeId&&!doc.edges.some(e=>e.id===c.edgeId&&(e.source===c.nodeId||e.target===c.nodeId)))throw new Error('Verification relationship does not touch component');}
 return s;}
export function proposeVerificationSpec(project:Project,input:unknown){const raw=z.object({id,repositories:verificationSpecSchema.shape.repositories,checks:z.array(verificationSpecSchema.shape.checks.element.omit({result:true})).min(1).max(100)}).strict().parse(input);
 return validateVerificationSpec({...raw,format:'diagramcloud.verification-spec',version:1,projectId:project.id,projectRevision:project.revision,state:'PROPOSED',checks:raw.checks.map(c=>({...c,result:'NOT_RUN'})),note:'This spec defines requested checks; it is not a result, permission or execution instruction.'},project);}
const runnerSchema=z.object({name:z.string().min(1).max(160),runId:z.string().min(1).max(200),url:z.string().max(2000).refine(isOpenUri).optional()}).strict();
const opaqueId=(text:string)=>{let a=2166136261,b=5381;for(const ch of text){a=Math.imul(a^ch.charCodeAt(0),16777619);b=Math.imul(b,33)^ch.charCodeAt(0);}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');};
/** Galaxy is the existing external receipt contract. Extra mapping is supplied explicitly,
 * never guessed from matching labels or a nearby repository. No producer schema is edited. */
export function stageVerificationReceipt(project:Project,specInput:unknown,receiptInput:unknown,runnerInput:unknown){
 const doc=validateDocument(project),spec=validateVerificationSpec(specInput,doc),receipt=validateVerificationReceipt(receiptInput),runner=runnerSchema.parse(runnerInput);
 if(secretFindings(runner).length)throw new Error('Runner contains secret values');
 const repo=spec.repositories.find(r=>r.repository===receipt.revision.repository&&r.commit===receipt.revision.commit);
 if(!repo)throw new Error('Receipt repository/full commit differs from requested revision vector');
 const checks=receipt.checks.filter(c=>spec.checks.some(s=>s.repositoryId===repo.id&&s.id===c.check_id));if(!checks.length)throw new Error('No explicitly mapped receipt checks');
 const prefix='receipt-'+opaqueId(spec.id+'\n'+receipt.receipt_id+'\n'+runner.runId),operations:Operation[]=[];
 for(const check of checks){const requirement=spec.checks.find(s=>s.repositoryId===repo.id&&s.id===check.check_id)!,refs=check.evidence_ref_ids.map(id=>receipt.evidence_refs.find(e=>e.evidence_id===id)!);
  if(check.status==='passed'&&!refs.length)throw new Error('Passed check has no external evidence references');
  for(const ref of refs)if(ref.observed_revision!==receipt.revision.commit)throw new Error('Check evidence must name the exact receipt commit');
  const observationId=prefix+'-'+opaqueId(check.check_id),blockId=observationId+'-e';
  if(observationId.length>77||doc.observations.some(o=>o.id===observationId)||doc.blocks.some(b=>b.id===blockId))throw new Error('Receipt already staged or ambiguous receipt identity');
  const payload={receipt_id:receipt.receipt_id,app_id:receipt.app_id,revision:receipt.revision,created_at:receipt.created_at,runner,check,evidence_refs:refs};
  const block={id:blockId,title:('External check: '+check.check_id).slice(0,160),type:'code',language:'json',code:JSON.stringify(payload,null,2),sourceIds:[],visibility:'private',provenance:'source-derived'};
  operations.push({op:'add',path:'/blocks/-',value:block});
  operations.push({op:'add',path:'/nodes/@'+requirement.nodeId+'/blockIds/-',value:blockId});
  const patch=observationPatch(doc,{id:observationId,nodeId:requirement.nodeId,sourceApp:receipt.app_id,authority:runner.name,observedAt:receipt.created_at,sourceRevision:receipt.revision.commit,
   claim:check.status==='passed'?'verified':check.status==='failed'?'partial':'not-observed',summary:('External '+check.check_id+': '+check.status+' by '+runner.name+' ('+runner.runId+')').slice(0,500),blockIds:[blockId],...(runner.url?{link:runner.url}:{}),
   caveat:'External runner statement. '+(requirement.edgeId?'Requested relationship '+requirement.edgeId+'. ':'')+'No review, sharing or execution is performed by this import.'});
  operations.push(...patch.operations);
 }
 const patch:Patch={format:'diagramcloud.patch',version:1,target:'project',targetId:doc.id,baseRevision:doc.revision,summary:'Review external receipt '+receipt.receipt_id.slice(0,150)+' at exact source commit; private and unreviewed.',operations};
 applyDocumentPatch(doc,patch);return {patch,receipt,runner,unmappedCheckIds:receipt.checks.filter(c=>!checks.includes(c)).map(c=>c.check_id),state:'REQUIRES_AUTHOR_REVIEW' as const};
}
export function verificationGaps(project:Project,specInput:unknown){const spec=validateVerificationSpec(specInput,project);return spec.checks.map(c=>{const revision=spec.repositories.find(r=>r.id===c.repositoryId)!.commit;
 const claims=project.observations.filter(o=>o.nodeId===c.nodeId&&o.sourceRevision===revision&&o.reviewedAt&&o.blockIds.some(id=>{const b=project.blocks.find(b=>b.id===id);if(b?.type!=='code'||b.provenance!=='source-derived')return false;try{const p=JSON.parse(b.code);return p.check?.check_id===c.id&&p.revision?.commit===revision;}catch{return false;}}));
 return {checkId:c.id,nodeId:c.nodeId,edgeId:c.edgeId,revision,state:claims.length?'reviewed-external-evidence':'UNKNOWN',observationIds:claims.map(o=>o.id),reason:claims.length?'Dated external claims at the requested exact revision; review is not a new run.':'No reviewed matching external check at this revision.'};});}
export function testCoverageGaps(project:Project,specInput:unknown){const spec=validateVerificationSpec(specInput,project),checks=verificationGaps(project,spec),mappedNodes=new Set(spec.checks.map(c=>c.nodeId)),mappedEdges=new Set(spec.checks.flatMap(c=>c.edgeId?[c.edgeId]:[]));
 return {checks,components:project.nodes.filter(n=>!mappedNodes.has(n.id)).map(n=>({nodeId:n.id,state:'UNKNOWN',reason:'No explicit check maps to this component in the selected spec; tests may exist outside the supplied scope.'})),connections:project.edges.filter(e=>!mappedEdges.has(e.id)).map(e=>({edgeId:e.id,state:'UNKNOWN',reason:'No explicit check maps to this connection in the selected spec; endpoint checks do not prove relation coverage.'})),note:'Mapping gaps and external evidence only. No tests executed, exhaustive coverage or percentage inferred.'};}
export function workVerificationBrief(project:Project,specInput?:unknown,changeInput?:unknown){const change=changeInput?z.object({summary:z.string().max(500),nodeIds:z.array(z.string().max(80)).max(20)}).strict().parse(changeInput):{summary:'No proposed change supplied.',nodeIds:[]};
 const reach=change.nodeIds.map(id=>impactFacts(project,id,{direction:'downstream',includeInferred:false,limit:100}));
 const affectedNodes=new Set(reach.flatMap(r=>r.nodes.map(n=>n.id))),affectedEdges=new Set(reach.flatMap(r=>r.edges.map(e=>e.id))),spec=specInput?validateVerificationSpec(specInput,project):undefined;
 return {format:'diagramcloud.work-verification-brief/1',projectId:project.id,projectRevision:project.revision,change,
 impact:{nodeIds:[...new Set(reach.flatMap(r=>r.nodes.map(n=>n.id)))].slice(0,100),edgeIds:[...new Set(reach.flatMap(r=>r.edges.map(e=>e.id)))].slice(0,200),viewIds:[...new Set(reach.flatMap(r=>r.views.map(v=>v.id)))],limited:reach.some(r=>r.limited),note:'Source/planned reachability, not causal impact.'},
 checks:spec?verificationGaps(project,spec):[],affectedCheckIds:spec?.checks.filter(c=>affectedNodes.has(c.nodeId)||(!!c.edgeId&&affectedEdges.has(c.edgeId))).map(c=>c.id)??[],coverage:spec?testCoverageGaps(project,spec):undefined,unknown:spec?[]:['No explicit verification spec selected.'],nextGate:'Author reviews the proposed spec, external owner runs checks, and exact-revision receipt is reviewed as a patch.',state:'NOT_RUN',note:'Design state and source scans never establish PASS.'};}

export const cockpitSnapshotSchema=z.object({format:z.literal('diagramcloud.cockpit-snapshot'),version:z.literal(1),id,
 sourceApp:z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),authority:z.string().min(1).max(160),capturedAt:z.string().datetime({offset:true}),expiresAt:z.string().datetime({offset:true}),
 permission:z.object({selectedProjectId:z.string().max(80),dataAccessGranted:z.literal(true),scope:z.literal('selected-project')}).strict(),
 observations:z.array(z.object({id,nodeId:z.string().max(80),sourceRevision:z.string().min(1).max(120),summary:z.string().min(1).max(500),claim:z.enum(['observed','partial','not-observed']),link:z.string().max(2000).refine(isOpenUri).optional()}).strict()).min(1).max(100)}).strict();
/** Host-fed snapshot only: no live collector, credential access or always-live assumption. */
export function stageCockpitSnapshot(project:Project,input:unknown,now=new Date()){
 const doc=validateDocument(project),s=cockpitSnapshotSchema.parse(input);if(secretFindings(s).length)throw new Error('Cockpit snapshot contains secret values');
 const captured=Date.parse(s.capturedAt),expires=Date.parse(s.expiresAt);if(s.permission.selectedProjectId!==doc.id)throw new Error('Snapshot permission project differs');
 if(captured>now.getTime()+60000||expires<=now.getTime()||expires<=captured||expires-captured>86400000)throw new Error('Snapshot is expired, future-dated or exceeds 24-hour scope');
 if(new Set(s.observations.map(o=>o.id)).size!==s.observations.length)throw new Error('Duplicate cockpit observation');
 const operations=s.observations.flatMap(o=>{if(!doc.nodes.some(n=>n.id===o.nodeId)||doc.observations.some(existing=>existing.id===o.id))throw new Error('Snapshot subject missing or observation already exists');return observationPatch(doc,{...o,sourceApp:s.sourceApp,authority:s.authority,observedAt:s.capturedAt,caveat:'Host-fed scoped snapshot '+s.id+'; expires '+s.expiresAt+'. No live collection or health inference.'}).operations;});
 const patch:Patch={format:'diagramcloud.patch',version:1,target:'project',targetId:doc.id,baseRevision:doc.revision,summary:'Review scoped host-fed observations; private, unreviewed and not shareable.',operations};applyDocumentPatch(doc,patch);return {patch,state:'REQUIRES_AUTHOR_REVIEW' as const};
}
export function operationalSourceLinks(project:Project){return project.nodes.flatMap(n=>n.sourceIds.map(id=>project.sources.find(s=>s.id===id)).filter(s=>s&&/logs?|metrics?|traces?|runbook/i.test(s.title+' '+s.location)).map(s=>({nodeId:n.id,sourceId:s!.id,title:s!.title,url:s!.url,scope:n.basis??'unknown',health:'UNKNOWN' as const,note:'An author/source link; no endpoint is fetched.'})));}
export function trustBoundaryHooks(project:Project){return project.nodes.filter(n=>n.tags.some(t=>/^(iam|trust|policy|security)$/i.test(t))).map(n=>({nodeId:n.id,sourceIds:n.sourceIds,basis:n.basis??'unknown',state:n.sourceIds.length?'source-cited-concept':'UNKNOWN',note:'A declared policy/trust concept, not a security certification.'}));}
export type ExternalVerificationReceipt=VerificationReceipt;
