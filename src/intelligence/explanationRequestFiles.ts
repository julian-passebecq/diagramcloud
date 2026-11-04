import {validateDocument,type Project} from '../core/model';
import {explanationWalkthroughSchema,type ExplanationWalkthrough} from './explanationWalkthrough';
import {explanationSourceMatches,explanationRequest,type ExplanationBasis,type ExplanationDraft} from './explanationRequestDraft';

/** Same request-v1 input and 4 MiB UTF-8 budget as the offline explanation CLI. No execution or Project write. */
export const EXPLANATION_REQUEST_FILE_LIMIT=4*1024*1024;
export type ImportedExplanationRequest={basis:ExplanationBasis;draft:ExplanationDraft;source:Project;current:boolean};
const unique=(values:string[],what:string)=>{if(new Set(values).size!==values.length)throw Error(`The request contains duplicate ${what}. The current draft is unchanged.`);};
function validateReferences(request:ExplanationWalkthrough,source:Project){
 const sources=new Set(source.sources.map(s=>s.id)),earlier=new Set<string>();unique(request.steps.map(s=>s.id),'step IDs');
 const checkSources=(ids:string[])=>{unique(ids,'source references');if(ids.some(id=>!sources.has(id)))throw Error('A request source reference is unavailable in the current project. The current draft is unchanged.');};checkSources(request.sourceIds);
 for(const step of request.steps){
  checkSources(step.sourceIds);unique(step.nodeIds,'component references');unique(step.edgeIds,'connection references');unique(step.dependsOn,'prerequisites');
  if(step.dependsOn.some(id=>!earlier.has(id)))throw Error('A request prerequisite is missing, forward or cyclic. The current draft is unchanged.');earlier.add(step.id);
  const view=source.views.find(v=>v.id===step.viewId);if(!view||step.nodeIds.some(id=>!view.nodeIds.includes(id))||step.edgeIds.some(id=>!view.edgeIds.includes(id)))throw Error('Request subjects are unavailable in their exact source view. The current draft is unchanged.');
  const subjectIds=new Set([...step.nodeIds,...source.edges.filter(e=>step.edgeIds.includes(e.id)).flatMap(e=>[e.source,e.target])]);
  if(!subjectIds.size||subjectIds.size+step.edgeIds.length+1>20)throw Error('A request step needs 1–19 explicit subjects within the native anchor limit. The current draft is unchanged.');
  if(step.provenance!=='synthetic'&&!request.sourceIds.length&&!step.sourceIds.length)throw Error('A nonsynthetic request step requires an explicit source reference. The current draft is unchanged.');
  for(const phase of ['before','after'] as const)unique(step[phase].map(row=>row.name),`${phase} state fields`);
  if(step.code){const attached=new Set(source.nodes.filter(n=>subjectIds.has(n.id)).flatMap(n=>n.blockIds)),block=source.blocks.find(b=>b.id===step.code!.blockId);
   if(!attached.has(step.code.blockId)||block?.type!=='code'||step.code.fromLine>step.code.toLine||step.code.toLine>block.code.split(/\r?\n/).length)throw Error('The request code range is unavailable on its exact attached source block. The current draft is unchanged.');}
 }
}
export function parseExplanationRequestFile(text:string,input:Project):ImportedExplanationRequest{
 if(typeof text!=='string'||text.length>EXPLANATION_REQUEST_FILE_LIMIT||new TextEncoder().encode(text).length>EXPLANATION_REQUEST_FILE_LIMIT)throw Error('Explanation request files must be at most 4 MiB of UTF-8. The current draft is unchanged.');
 let value:unknown;try{value=JSON.parse(text);}catch{throw Error('The file is not valid request JSON. The current draft is unchanged.');}
 // Bound collection traversal before Zod constructs per-item diagnostics for an oversized file.
 if(value&&typeof value==='object'&&!Array.isArray(value)){const request=value as Record<string,unknown>;if(Array.isArray(request.steps)&&request.steps.length>30)throw Error('A request supports at most 30 steps. The current draft is unchanged.');
  const bounded=(row:Record<string,unknown>,limits:Record<string,number>)=>Object.entries(limits).every(([key,max])=>!Array.isArray(row[key])||(row[key] as unknown[]).length<=max);
  if(!bounded(request,{sourceIds:30})||(Array.isArray(request.steps)&&request.steps.some(step=>step&&typeof step==='object'&&!Array.isArray(step)&&!bounded(step as Record<string,unknown>,{nodeIds:30,edgeIds:30,sourceIds:30,dependsOn:20,before:20,after:20,questions:8}))))throw Error('A request collection exceeds its supported limit. The current draft is unchanged.');}
 const parsed=explanationWalkthroughSchema.safeParse(value);if(!parsed.success)throw Error('The file must be a complete diagramcloud.explanation-walkthrough version 1 request with supported fields. Incomplete drafts and unknown fields are not imported. The current draft is unchanged.');
 const source=validateDocument(input),request=parsed.data;if(request.projectId!==source.id)throw Error('This request belongs to another project. Open its original project before loading it. The current draft is unchanged.');
 validateReferences(request,source);
 const basis=Object.freeze({projectId:request.projectId,revision:request.baseRevision,fingerprint:request.baseFingerprint});
 const draft:ExplanationDraft={id:request.id,title:request.title,question:request.question,sourceIds:request.sourceIds,steps:request.steps};
 return {basis,draft,source,current:explanationSourceMatches(source,basis)};
}
export async function readExplanationRequestFile(file:Pick<Blob,'size'|'arrayBuffer'>,project:Project):Promise<ImportedExplanationRequest>{
 if(!Number.isSafeInteger(file.size)||file.size<1||file.size>EXPLANATION_REQUEST_FILE_LIMIT)throw Error('Choose a nonempty explanation request file of at most 4 MiB. The current draft is unchanged.');
 let buffer:ArrayBuffer;try{buffer=await file.arrayBuffer();}catch{throw Error('The request file could not be read. The current draft is unchanged.');}
 if(buffer.byteLength>EXPLANATION_REQUEST_FILE_LIMIT)throw Error('The request file exceeds 4 MiB. The current draft is unchanged.');
 let text:string;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(buffer);}catch{throw Error('The request file must contain valid UTF-8. The current draft is unchanged.');}
 return parseExplanationRequestFile(text,project);
}
/** Explicit export requires an importable request; stale source binding is preserved, never refreshed. */
export function serializeValidatedExplanationRequest(basis:ExplanationBasis,draft:ExplanationDraft,source:Project):string{
 const text=serializeExplanationRequestDraft(basis,draft);parseExplanationRequestFile(text,source);return text;
}

/** Recovery download preserves incomplete/stale authored fields. It is not guaranteed importable. */
export function serializeExplanationRequestDraft(basis:ExplanationBasis,draft:ExplanationDraft):string{
 const text=JSON.stringify(explanationRequest(basis,draft),null,2);if(new TextEncoder().encode(text).length>EXPLANATION_REQUEST_FILE_LIMIT)throw Error('This request draft exceeds the 4 MiB request-file limit. Nothing was downloaded.');return text;
}
