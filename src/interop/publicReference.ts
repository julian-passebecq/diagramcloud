import type {Project} from '../core/model';
import {publicDocument} from '../core/operations';
import type {ReturnGuard} from '../react/hostSession';

/**
 * Public reference check for public targets (stdio MCP, public viewer, host return).
 *
 * A reference to a private component, connection, view, evidence block, source, asset or Google Drive file ID is
 * refused with exactly the same generic reason as an ID that never existed: a public caller cannot tell "hidden" from
 * "absent". Only the public projection of the authoring document is consulted (publicDocument), and nothing is
 * mutated. Catalogue and explanation paths do not take references and are unaffected.
 */
export const PUBLIC_REFERENCE_KINDS=['node','edge','view','block','source','asset','drive-file'] as const;
export type PublicReferenceKind=typeof PUBLIC_REFERENCE_KINDS[number];
export type PublicReference={kind:PublicReferenceKind;id:string;viewId?:string};
export const PUBLIC_REFERENCE_UNAVAILABLE='Reference unavailable in the public projection.';
export type PublicReferenceVerdict={ok:true;kind:PublicReferenceKind;id:string}|{ok:false;reason:typeof PUBLIC_REFERENCE_UNAVAILABLE};

const refused=():PublicReferenceVerdict=>({ok:false,reason:PUBLIC_REFERENCE_UNAVAILABLE});
const isReference=(value:unknown):value is PublicReference=>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const r=value as Record<string,unknown>;
 return Object.keys(r).every(k=>['kind','id','viewId'].includes(k))&&(PUBLIC_REFERENCE_KINDS as readonly string[]).includes(r.kind as string)&&typeof r.id==='string'&&r.id.length>0&&r.id.length<=256&&(r.viewId===undefined||typeof r.viewId==='string');
};

/** True only when `ref` names a fact of the public projection `pub` (already projected: call publicDocument first). */
export function inPublicProjection(pub:Project,ref:PublicReference):boolean{
 const view=ref.viewId===undefined?undefined:pub.views.find(v=>v.id===ref.viewId);
 if(ref.viewId!==undefined&&!view)return false;
 switch(ref.kind){
  case 'view':return pub.views.some(v=>v.id===ref.id);
  case 'node':return pub.nodes.some(n=>n.id===ref.id)&&(!view||view.nodeIds.includes(ref.id));
  case 'edge':return pub.edges.some(e=>e.id===ref.id)&&(!view||view.edgeIds.includes(ref.id));
  case 'block':return pub.blocks.some(b=>b.id===ref.id);
  case 'source':return pub.sources.some(s=>s.id===ref.id);
  case 'asset':return pub.assets.some(a=>a.id===ref.id);
  case 'drive-file':return pub.assets.some(a=>a.remote?.provider==='google-drive'&&a.remote.fileId===ref.id);
 }
}

/** Resolve one reference against the authoring document's public projection. Private and unknown look identical. */
export function resolvePublicReference(input:Project,ref:unknown):PublicReferenceVerdict{
 if(!isReference(ref))return refused();
 try{const pub=publicDocument(input);return inPublicProjection(pub,ref)?{ok:true,kind:ref.kind,id:ref.id}:refused();}catch{return refused();}
}

/** The references a diagramcloud.host-return/1 intent names: its view and, when present, its component, connection or source. */
export function returnReferences(intent:{viewId:string;nodeId?:string;edgeId?:string;sourceId?:string}):PublicReference[]{
 return [{kind:'view',id:intent.viewId},...(intent.nodeId?[{kind:'node' as const,id:intent.nodeId,viewId:intent.viewId}]:[]),
  ...(intent.edgeId?[{kind:'edge' as const,id:intent.edgeId,viewId:intent.viewId}]:[]),...(intent.sourceId?[{kind:'source' as const,id:intent.sourceId}]:[])];
}

export type PublicReturnVerdict=ReturnType<ReturnGuard['accept']>|{ok:false;reason:'unavailable';message:typeof PUBLIC_REFERENCE_UNAVAILABLE;retained:unknown};
/**
 * Host-side acceptance of a return intent against the current authoring document. The guard decides session, revision,
 * route, grant and replay first; an accepted intent that names a private or unknown view, component, connection or
 * source is then refused as `unavailable`, with the same text for both, and its input retained unchanged.
 * The guard has already recorded the intent ID, so resending the same intent is refused as a replay.
 */
export function acceptPublicReturn(guard:ReturnGuard,input:Project,intent:unknown):PublicReturnVerdict{
 const verdict=guard.accept(intent);
 if(!verdict.ok)return verdict;
 let pub:Project;try{pub=publicDocument(input);}catch{return {ok:false,reason:'unavailable',message:PUBLIC_REFERENCE_UNAVAILABLE,retained:intent};}
 return returnReferences(verdict.intent).every(ref=>inPublicProjection(pub,ref))?verdict:{ok:false,reason:'unavailable',message:PUBLIC_REFERENCE_UNAVAILABLE,retained:intent};
}
