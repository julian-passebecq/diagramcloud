import {z} from 'zod';

/**
 * Host session for the public React viewer: explicit capability negotiation and guarded return intents.
 *
 * A host offers `diagramcloud.host-session/1` with a session ID, the audience and the capabilities it grants. The
 * viewer is read-only by default: with no grant it still returns the selected context (selection, view navigation,
 * a source request), never anything more. `query` and `render` are the capabilities this viewer implements once a
 * host grants them; `propose`, `validate`, `apply` and `publish` are recognised and always refused here, with the
 * reason, because a read-only viewer never gains authoring authority: proposals go through the Studio import review
 * or the CLI, and only the Studio applies or publishes.
 *
 * Every return is a `diagramcloud.host-return/1` intent that carries the exact project, document revision, audience
 * and session, plus a one-time intent ID. The host checks it with createReturnGuard, which refuses a malformed,
 * foreign-session, stale (other project, revision or audience), unrouted (a kind this host has no route for),
 * ungranted or replayed intent, and everything after the session is disposed. Every refusal hands the original input
 * back unchanged (`retained`), so the person can keep it as a return file (retainedReturnFile) for another host. The same intent as a JSON file (returnFileText / parseReturnFile) is the fallback when no
 * live channel exists. Nothing here transmits, applies or stores anything.
 */
export const HOST_SESSION_FORMAT='diagramcloud.host-session/1' as const;
export const HOST_RETURN_FORMAT='diagramcloud.host-return/1' as const;
export const HOST_CAPABILITIES=['query','propose','validate','render','apply','publish'] as const;
export type HostCapability=typeof HOST_CAPABILITIES[number];
/** Capabilities this read-only viewer implements once a host explicitly grants them. */
export const VIEWER_CAPABILITIES:readonly HostCapability[]=['query','render'];
export const NOT_PROVIDED:Record<Exclude<HostCapability,'query'|'render'>,string>={
 propose:'This read-only viewer does not author proposals. Prepare a diagramcloud.patch in the Studio or the CLI.',
 validate:'This read-only viewer does not validate proposals. Use the Studio import review or the CLI.',
 apply:'This read-only viewer never applies changes. Only a person applies a reviewed patch in the Studio.',
 publish:'This read-only viewer never publishes. Publication is a Studio action reviewed by a person.'};
/** Return kinds and the grant each needs; selection, navigation and source requests are the read-only base. */
export const RETURN_KINDS={selection:undefined,navigate:undefined,source:undefined,query:'query',render:'render'} as const satisfies Record<string,HostCapability|undefined>;
export type HostReturnKind=keyof typeof RETURN_KINDS;
export const MAX_RETURN_BYTES=512*1024;

const id=z.string().regex(/^[a-z][a-z0-9_.-]{0,79}$/);
const sessionId=z.string().regex(/^[A-Za-z0-9_-]{8,80}$/);
const offerSchema=z.object({format:z.literal(HOST_SESSION_FORMAT),sessionId,audience:z.literal('public'),grants:z.array(z.string().max(40)).max(12)}).strict();
export type HostSessionOffer=z.infer<typeof offerSchema>;
export type HostSession={state:'ready';sessionId:string;audience:'public';granted:HostCapability[];refused:{capability:string;reason:string}[]};
export type Negotiation=HostSession|{state:'refused';reason:string};
export const SESSION_REFUSED='Host session refused: format, session ID or audience is not supported. The viewer stays read-only.';

/** Explicit negotiation: granted = offered ∩ implemented. Unknown and unimplemented grants are listed with a reason. */
export function negotiateCapabilities(offer:unknown):Negotiation{
 const parsed=offerSchema.safeParse(offer);if(!parsed.success)return {state:'refused',reason:SESSION_REFUSED};
 const granted:HostCapability[]=[],refused:{capability:string;reason:string}[]=[],seen=new Set<string>();
 for(const grant of parsed.data.grants){
  if(seen.has(grant))continue;seen.add(grant);
  if(!(HOST_CAPABILITIES as readonly string[]).includes(grant))refused.push({capability:grant,reason:'Unknown capability; nothing is granted for it.'});
  else if(VIEWER_CAPABILITIES.includes(grant as HostCapability))granted.push(grant as HostCapability);
  else refused.push({capability:grant,reason:NOT_PROVIDED[grant as keyof typeof NOT_PROVIDED]});
 }
 return {state:'ready',sessionId:parsed.data.sessionId,audience:'public',granted:HOST_CAPABILITIES.filter(c=>granted.includes(c)),refused};
}

const intentSchema=z.object({format:z.literal(HOST_RETURN_FORMAT),intentId:z.string().regex(/^[a-f0-9]{32}$/),sessionId,kind:z.enum(Object.keys(RETURN_KINDS) as [HostReturnKind,...HostReturnKind[]]),
 projectId:id,baseRevision:z.number().int().nonnegative(),audience:z.literal('public'),viewId:id,nodeId:id.optional(),edgeId:id.optional(),sourceId:id.optional(),
 payload:z.string().max(MAX_RETURN_BYTES).optional()}).strict().refine(i=>!(i.nodeId&&i.edgeId)).refine(i=>(i.kind==='source')===!!i.sourceId).refine(i=>(i.kind==='query'||i.kind==='render')===(i.payload!==undefined));
export type HostReturnIntent=z.infer<typeof intentSchema>;
export type ReturnTarget={projectId:string;baseRevision:number;viewId:string;nodeId?:string;edgeId?:string;sourceId?:string};

const randomId=()=>{const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');};
/** A new one-time return intent for a negotiated session, or undefined when its kind is not granted. */
export function createReturnIntent(session:HostSession,kind:HostReturnKind,target:ReturnTarget,payload?:string):HostReturnIntent|undefined{
 const needs=RETURN_KINDS[kind];if(needs&&!session.granted.includes(needs))return undefined;
 const parsed=intentSchema.safeParse({format:HOST_RETURN_FORMAT,intentId:randomId(),sessionId:session.sessionId,kind,projectId:target.projectId,baseRevision:target.baseRevision,audience:session.audience,viewId:target.viewId,
  ...(target.nodeId?{nodeId:target.nodeId}:{}),...(target.edgeId?{edgeId:target.edgeId}:{}),...(target.sourceId?{sourceId:target.sourceId}:{}),...(payload!==undefined?{payload}:{})});
 return parsed.success?parsed.data:undefined;
}

/** `routes`: the return kinds this host can route (default: every kind). An unrouted kind is refused, never dropped. */
export type ReturnBinding={sessionId:string;projectId:string;baseRevision:number;audience:'public';granted:readonly HostCapability[];routes?:readonly HostReturnKind[]};
export type ReturnRefusal='malformed'|'disposed'|'wrong-session'|'stale'|'unsupported-route'|'not-granted'|'replayed';
/** A refusal keeps the exact input it was given (`retained`, the same value, never parsed, stripped or mutated). */
export type ReturnVerdict={ok:true;intent:HostReturnIntent}|{ok:false;reason:ReturnRefusal;retained:unknown};
export const RETURN_REFUSAL_TEXT:Record<ReturnRefusal,string>={malformed:'Refused: not a diagramcloud.host-return/1 intent.',disposed:'Refused: this viewer session was closed.',
 'wrong-session':'Refused: the intent belongs to another viewer session.',stale:'Refused: the intent was made for another project, document revision or audience.',
 'unsupported-route':'Refused: this host has no route for this return kind.','not-granted':'Refused: the session did not grant this capability.',replayed:'Refused: this intent was already received once.'};

/** Host-side guard. Accepts each intent at most once, only for the current binding; rebind on a revision change. */
export function createReturnGuard(initial:ReturnBinding){
 const copy=(b:ReturnBinding):ReturnBinding=>({...b,granted:[...b.granted],...(b.routes?{routes:[...b.routes]}:{})});
 let binding=copy(initial),disposed=false;const seen=new Set<string>();
 return {
  accept(input:unknown):ReturnVerdict{
   const refuse=(reason:ReturnRefusal):ReturnVerdict=>({ok:false,reason,retained:input});
   if(disposed)return refuse('disposed');
   const parsed=intentSchema.safeParse(input);if(!parsed.success)return refuse('malformed');const intent=parsed.data;
   if(intent.sessionId!==binding.sessionId)return refuse('wrong-session');
   if(seen.has(intent.intentId))return refuse('replayed');
   if(intent.projectId!==binding.projectId||intent.baseRevision!==binding.baseRevision||intent.audience!==binding.audience)return refuse('stale');
   if(binding.routes&&!binding.routes.includes(intent.kind))return refuse('unsupported-route');
   const needs=RETURN_KINDS[intent.kind];if(needs&&!binding.granted.includes(needs))return refuse('not-granted');
   seen.add(intent.intentId);return {ok:true,intent};
  },
  /** The document moved on (new revision or project) in the same session: earlier intents become stale. */
  rebind(next:Omit<ReturnBinding,'sessionId'>){if(!disposed)binding=copy({...next,sessionId:binding.sessionId});},
  dispose(){disposed=true;},
  get binding(){return copy(binding);},
  get disposed(){return disposed;}};
}
export type ReturnGuard=ReturnType<typeof createReturnGuard>;

/**
 * A refused input as a return file, unchanged, when it is shaped like a `diagramcloud.host-return/1` intent (whatever
 * the refusal); undefined for a malformed input, which is not a return file. Saving it changes nothing: the host that
 * refused it will refuse the file for the same reason.
 */
export function retainedReturnFile(verdict:ReturnVerdict):string|undefined{
 if(verdict.ok||verdict.reason==='malformed'||!intentSchema.safeParse(verdict.retained).success)return undefined;
 const text=JSON.stringify(verdict.retained,null,2)+'\n';return new TextEncoder().encode(text).byteLength<=MAX_RETURN_BYTES+4096?text:undefined;
}
/** File fallback: the same intent as JSON text, and its bounded parse (the guard still decides). */
export const returnFileText=(intent:HostReturnIntent)=>JSON.stringify(intent,null,2)+'\n';
export function parseReturnFile(text:string):unknown{
 if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>MAX_RETURN_BYTES+4096)return undefined;
 try{return JSON.parse(text) as unknown;}catch{return undefined;}
}
