import {isPmTaskDocument,compilePmTasks} from '../development/pmTasks';
import {MAX_DOCUMENT_BYTES,validateDocument,type Project} from '../core/model';
import {withoutUnknownModules} from '../core/moduleCompat';
import {digestErrors} from '../core/assetIdentity';
import {applyDocumentPatch,isPatch,type Patch} from '../core/patch';
import {isPublicationSnapshot,stagePublicationSnapshot,type StagedPublicationSnapshot} from '../core/galaxy';
import {importDiagram,interchangeFormat,type ImportReport} from '../core/interchange';
import {compileGraphSnapshot,isGraphSnapshot,previewGraphReimport} from '../intelligence/graphSnapshot';
import {previewDeliveryBrief} from '../intelligence/delivery';
import {previewCompletionPatch,type CompletionRequest} from '../intelligence/completionKit';
import {isProviderRequest,parseAppliedLedger,proposalDigests,proposalRefusal,PROVIDER_LAUNCH_MESSAGE,validateProposal,type AppliedProposal,type ProposalContext,type ProposalValidation} from '../core/proposal';

export type StagedPatch={patch:Patch;result:Project;snapshot?:StagedPublicationSnapshot;validation?:ProposalValidation};
/** What the JSON / AI review shows next. Nothing here is applied: Apply stays the reviewed, revision-guarded step. */
export type StagedImport={staged:Project;patched:StagedPatch|null;report:ImportReport|null;importName?:string;
 /** Unknown top-level modules the author confirmed dropping; they are not in `staged` and grant nothing. */
 droppedModules?:string[]};

/** The JSON / AI dialog is an import path: what is pasted there is a proposal from elsewhere, never the author's own review. */
export const MANUAL_PROPOSAL_ORIGIN:ProposalContext={origin:'imported',by:'JSON / AI dialog'};

/**
 * Ledger of proposals applied in this browser, so a replay cannot apply twice (for example after Undo). It keeps
 * digests and revisions only, never proposal content. Storage is best effort: when it is blocked or corrupt the
 * ledger still holds for this session in memory.
 */
export const PROPOSAL_LEDGER_KEY='diagramcloud.applied-proposals.v1';
const LEDGER_LIMIT=500;
export type ProposalLedger={read():AppliedProposal[];record(row:AppliedProposal):void};
export function createProposalLedger(storage:()=>Pick<Storage,'getItem'|'setItem'>|undefined):ProposalLedger{
 let memory:AppliedProposal[]=[];
 const stored=()=>{try{const raw=storage()?.getItem(PROPOSAL_LEDGER_KEY);return raw?parseAppliedLedger(JSON.parse(raw)):[];}catch{return [];}};
 const merged=()=>{const rows=[...stored()];for(const r of memory)if(!rows.some(x=>x.digest===r.digest))rows.push(r);return rows.slice(-LEDGER_LIMIT);};
 return {read:merged,record(row){memory=[...memory.filter(r=>r.digest!==row.digest),row].slice(-LEDGER_LIMIT);const rows=[...merged().filter(r=>r.digest!==row.digest),row].slice(-LEDGER_LIMIT);try{storage()?.setItem(PROPOSAL_LEDGER_KEY,JSON.stringify(rows));}catch{/* blocked storage: the in-memory ledger still refuses a replay in this session */}}};
}
export const browserProposalLedger=createProposalLedger(()=>{try{return globalThis.localStorage;}catch{return undefined;}});
/** Called once an imported proposal has been applied, with the revision it produced. */
export function recordAppliedProposal(patch:Patch,appliedRevision:number,ledger:ProposalLedger=browserProposalLedger){
 ledger.record({...proposalDigests(patch),projectId:patch.targetId,baseRevision:patch.baseRevision,appliedRevision});
}

/** Run the shared proposal validator; a refusal throws the same sentence the CLI and MCP report. */
function validated(project:Project,obj:unknown,applied:readonly AppliedProposal[]):ProposalValidation{
 const v=validateProposal(project,obj,MANUAL_PROPOSAL_ORIGIN,applied);if(!v.valid)throw new Error(proposalRefusal(v));return v;
}

/**
 * Pasted or loaded text in the JSON / AI workspace becomes a staged review: a whole document, a guarded
 * diagramcloud.patch, a completion response, a publication snapshot, a private read-only PM task snapshot
 * (datapass.owner-tasks/1, a new project), a GraphSnapshot, a delivery brief or a draw.io / Mermaid diagram. Pure staging: throws with the user-facing reason, never mutates `project` or `library`.
 */
export async function stageImportText(input:{project:Project;library:readonly Project[];raw:string;importName:string;completionRequest:CompletionRequest|null;applied?:readonly AppliedProposal[];
 /** Exactly the unknown modules the author agreed to drop; any other set throws UnknownModulesError again. */
 acceptUnknownModules?:readonly string[]}):Promise<StagedImport>{
 const {project,library,raw,importName,completionRequest}=input,applied=input.applied??browserProposalLedger.read();
 if(new TextEncoder().encode(raw).byteLength>MAX_DOCUMENT_BYTES)throw new Error('Document exceeds the 12 MiB import limit');
 if(completionRequest&&!isPatch(JSON.parse(raw)))throw new Error('Completion responses must use the existing diagramcloud.patch format.');
 const format=interchangeFormat(raw);
 if(format){const out=await importDiagram(raw,importName||(format==='mermaid'?'pasted.mmd':'pasted.drawio'));return {staged:out.document,patched:null,report:out.report};}
 const obj:unknown=JSON.parse(raw);
 if(completionRequest){const validation=validated(project,obj,applied),out=previewCompletionPatch(project,completionRequest,obj);return {staged:out.result,patched:{...out,validation},report:null};}
 if(isPatch(obj)){const validation=validated(project,obj,applied),out=applyDocumentPatch(project,obj);return {staged:out.result,patched:{...out,validation},report:null};}
 if(isPublicationSnapshot(obj)){const snap=stagePublicationSnapshot(project,obj);if(!snap.patch)throw new Error(`Publication snapshot ${snap.snapshot.snapshot_id} from ${snap.snapshot.producer.app_id} has no claim to stage for this project.${snap.unresolved.length?` Unresolved: ${snap.unresolved.map(u=>`${u.claim_id} (${u.reason.replace(/_/g,' ')})`).join('; ')}.`:''}`);const out=applyDocumentPatch(project,snap.patch);return {staged:out.result,patched:{...out,snapshot:snap},report:null};}
 if(isPmTaskDocument(obj)){
  const out=compilePmTasks(raw,'pm-plan-'+crypto.randomUUID());
  // A projection is a new snapshot, not task adoption or a live synchronized document.
  // Never overwrite an edited presentation of the same input, including cross-project imports.
  if([project,...library].some(d=>d.provenance==='PM task projection; source authenticity and authority are unverified.'&&d.sources.some(s=>s.id==='pm-task-source'&&s.location==='sha256:'+out.inputDigest)))throw new Error('This PM task snapshot is already loaded. Open the existing projection; no presentation edits were replaced.');
  return {staged:out.document,patched:null,report:null,importName:'PM task snapshot (private, not adopted)'};
 }
 if(isGraphSnapshot(obj)){const compiled=compileGraphSnapshot(obj),existing=library.find(d=>d.id===compiled.document.id),proposal=existing?previewGraphReimport(existing,obj,existing.revision):null;return {staged:proposal?.document??compiled.document,patched:proposal?{patch:proposal.patch,result:proposal.document}:null,report:null,importName:'GraphSnapshot (offline)'};}
 if(obj&&typeof obj==='object'&&(obj as {format?:string}).format==='diagramcloud.delivery-brief'){const out=previewDeliveryBrief(project,obj);return {staged:out.document,patched:{patch:out.patch,result:out.document},report:null};}
 if(isProviderRequest(obj))throw new Error(PROVIDER_LAUNCH_MESSAGE);
 const {document,dropped}=withoutUnknownModules(obj,input.acceptUnknownModules),staged=validateDocument(document),digests=await digestErrors(staged);
 if(digests.length)throw new Error(digests.join('\n'));
 return {staged,patched:null,report:null,...(dropped.length?{droppedModules:dropped}:{})};
}
