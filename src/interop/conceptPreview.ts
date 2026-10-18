import type {Project} from '../core/model';
import {authorConceptPreview,conceptSpec,type AuthorConceptSelection,type ConceptExport} from '../export/concept';

/** A rebuildable presentation envelope, not a second editable architecture or a permission grant. */
export type ConceptPreview={
 format:'diagramcloud.concept-preview';version:1;
 projectId:string;baseRevision:number;viewId:string;audience:'public'|'author';generatedAt:string;
 projectionSha256:string;projection:ConceptExport;
};
export type ConceptPick={
 format:'diagramcloud.concept-pick';version:1;projectionSha256:string;kind:'node'|'flow';targetId:string;
};
export type ConceptPickResult=
 | {ok:true;projectId:string;baseRevision:number;viewId:string;kind:'node'|'flow';sourceIds:string[];ambiguous:boolean}
 | {ok:false;reason:'invalid-message'|'stale-projection'|'unknown-target'|'untrusted-origin'|'untrusted-window'|'ambiguous-target'};

export async function prepareConceptPreview(input:Project,selection:AuthorConceptSelection,
 options:{audience:'public'|'author';now?:Date}):Promise<ConceptPreview>{
 if(selection.projectId!==input.id||selection.baseRevision!==input.revision)throw new Error('Concept selection is stale or belongs to another project.');
 if(options.audience!=='author'&&options.audience!=='public')throw new Error('An explicit supported audience is required.');
 const now=options.now??new Date();
 const generatedAt=now.toISOString();
 const projection=options.audience==='author'?authorConceptPreview(input,selection,{...options,now}):conceptSpec(input,selection.viewId,{...options,now});
 const content={projectId:input.id,baseRevision:input.revision,viewId:selection.viewId,audience:options.audience,generatedAt,projection};
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(content)));
 const projectionSha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 return {format:'diagramcloud.concept-preview',version:1,...content,projectionSha256};
}

/** Interactive navigation must have one canonical source; inspection can still show all merged rows. */
export function resolveUniqueConceptPick(current:ConceptPreview,message:unknown):ConceptPickResult{
 const result=resolveConceptPick(current,message);
 return result.ok&&result.ambiguous?{ok:false,reason:'ambiguous-target'}:result;
}

/** Resolve a pick only against the HOST'S current packet, never a packet supplied by the viewer. */
export function resolveConceptPick(current:ConceptPreview,message:unknown):ConceptPickResult{
 if(!message||typeof message!=='object'||Array.isArray(message))return {ok:false,reason:'invalid-message'};
 const m=message as Record<string,unknown>;
 if(Object.keys(m).sort().join(',')!=='format,kind,projectionSha256,targetId,version'||m.format!=='diagramcloud.concept-pick'||m.version!==1||
    (m.kind!=='node'&&m.kind!=='flow')||typeof m.projectionSha256!=='string'||!/^[a-f0-9]{64}$/.test(m.projectionSha256)||
    typeof m.targetId!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(m.targetId))return {ok:false,reason:'invalid-message'};
 if(m.projectionSha256!==current.projectionSha256)return {ok:false,reason:'stale-projection'};
 const rows=m.kind==='node'?current.projection.report.nodes:current.projection.report.edges;
 const sourceIds=[...new Set(rows.filter(row=>row.targetId===m.targetId&&row.state!=='omitted').map(row=>row.sourceId))];
 if(!sourceIds.length)return {ok:false,reason:'unknown-target'};
 return {ok:true,projectId:current.projectId,baseRevision:current.baseRevision,viewId:current.viewId,kind:m.kind,sourceIds,ambiguous:sourceIds.length>1};
}

/** Optional browser postMessage boundary. This does not authorize files, commands or publications.
 * Opaque/file origins use the explicit file route instead; do not loosen this to '*' to make a preview work.
 */
export function acceptConceptMessage(current:ConceptPreview,event:Pick<MessageEvent,'data'|'origin'|'source'>,
 binding:{origin:string;source:MessageEventSource}):ConceptPickResult{
 let origin:URL;try{origin=new URL(binding.origin);}catch{return {ok:false,reason:'untrusted-origin'};}
 if(!['http:','https:'].includes(origin.protocol)||origin.origin!==binding.origin||origin.username||origin.password||event.origin!==binding.origin)
  return {ok:false,reason:'untrusted-origin'};
 if(!binding.source||event.source!==binding.source)return {ok:false,reason:'untrusted-window'};
 return resolveConceptPick(current,event.data);
}
