import {MAX_DOCUMENT_BYTES,parseDocument,type Project} from '../core/model';
import {applyDocumentPatch,isPatch,type Patch} from '../core/patch';
import {isPublicationSnapshot,stagePublicationSnapshot,type StagedPublicationSnapshot} from '../core/galaxy';
import {importDiagram,interchangeFormat,type ImportReport} from '../core/interchange';
import {compileGraphSnapshot,isGraphSnapshot,previewGraphReimport} from '../intelligence/graphSnapshot';
import {previewDeliveryBrief} from '../intelligence/delivery';
import {previewCompletionPatch,type CompletionRequest} from '../intelligence/completionKit';

export type StagedPatch={patch:Patch;result:Project;snapshot?:StagedPublicationSnapshot};
/** What the JSON / AI review shows next. Nothing here is applied: Apply stays the reviewed, revision-guarded step. */
export type StagedImport={staged:Project;patched:StagedPatch|null;report:ImportReport|null;importName?:string};

/**
 * Pasted or loaded text in the JSON / AI workspace becomes a staged review: a whole document, a guarded
 * diagramcloud.patch, a completion response, a publication snapshot, a GraphSnapshot, a delivery brief or a
 * draw.io / Mermaid diagram. Pure staging: throws with the user-facing reason, never mutates `project` or `library`.
 */
export async function stageImportText(input:{project:Project;library:readonly Project[];raw:string;importName:string;completionRequest:CompletionRequest|null}):Promise<StagedImport>{
 const {project,library,raw,importName,completionRequest}=input;
 if(new TextEncoder().encode(raw).byteLength>MAX_DOCUMENT_BYTES)throw new Error('Document exceeds the 12 MiB import limit');
 if(completionRequest&&!isPatch(JSON.parse(raw)))throw new Error('Completion responses must use the existing diagramcloud.patch format.');
 const format=interchangeFormat(raw);
 if(format){const out=await importDiagram(raw,importName||(format==='mermaid'?'pasted.mmd':'pasted.drawio'));return {staged:out.document,patched:null,report:out.report};}
 const obj:unknown=JSON.parse(raw);
 if(completionRequest){const out=previewCompletionPatch(project,completionRequest,obj);return {staged:out.result,patched:out,report:null};}
 if(isPatch(obj)){const out=applyDocumentPatch(project,obj);return {staged:out.result,patched:out,report:null};}
 if(isPublicationSnapshot(obj)){const snap=stagePublicationSnapshot(project,obj);if(!snap.patch)throw new Error(`Publication snapshot ${snap.snapshot.snapshot_id} from ${snap.snapshot.producer.app_id} has no claim to stage for this project.${snap.unresolved.length?` Unresolved: ${snap.unresolved.map(u=>`${u.claim_id} (${u.reason.replace(/_/g,' ')})`).join('; ')}.`:''}`);const out=applyDocumentPatch(project,snap.patch);return {staged:out.result,patched:{...out,snapshot:snap},report:null};}
 if(isGraphSnapshot(obj)){const compiled=compileGraphSnapshot(obj),existing=library.find(d=>d.id===compiled.document.id),proposal=existing?previewGraphReimport(existing,obj,existing.revision):null;return {staged:proposal?.document??compiled.document,patched:proposal?{patch:proposal.patch,result:proposal.document}:null,report:null,importName:'GraphSnapshot (offline)'};}
 if(obj&&typeof obj==='object'&&(obj as {format?:string}).format==='diagramcloud.delivery-brief'){const out=previewDeliveryBrief(project,obj);return {staged:out.document,patched:{patch:out.patch,result:out.document},report:null};}
 return {staged:parseDocument(raw),patched:null,report:null};
}
