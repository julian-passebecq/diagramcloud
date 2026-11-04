import {z} from 'zod';
import type {ExplanationBasis,ExplanationDraft} from './explanationRequestDraft';
export type DraftScope={host:string;projectId:string;audience:'author'};
export type DraftStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export const DRAFT_STORAGE_LIMIT=4*1024*1024;
const text=(max:number)=>z.string().max(max),refs=z.array(text(80)).max(30);
// Unlike the compiler, recovery preserves blanks, whitespace and unfinished values.
const draftSchema=z.object({id:text(40),title:text(160),question:text(1200),sourceIds:refs,steps:z.array(z.object({id:text(40),title:text(160),viewId:text(80),nodeIds:refs,edgeIds:refs,narration:text(1600),sourceIds:refs,provenance:z.enum(['synthetic','reference','source-derived','author']),dependsOn:z.array(text(40)).max(20),caseLabel:text(200).optional(),before:z.array(z.object({name:text(160),value:text(1500)}).strict()).max(20),after:z.array(z.object({name:text(160),value:text(1500)}).strict()).max(20),code:z.object({blockId:text(80),fromLine:z.number().finite(),toLine:z.number().finite()}).strict().optional(),takeaway:text(1000),questions:z.array(text(300)).max(8)}).strict()).min(1).max(30)}).strict().refine(d=>new Set(d.steps.map(s=>s.id)).size===d.steps.length);
const scopeSchema=z.object({host:z.string().min(1).max(300),projectId:z.string().min(1).max(80),audience:z.literal('author')}).strict();
const recordSchema=z.object({version:z.literal(1),scope:scopeSchema,basis:z.object({projectId:text(80),revision:z.number().int().nonnegative(),fingerprint:z.string().regex(/^[0-9a-f]{16}$/)}).strict(),draft:draftSchema}).strict();
export type DraftRecord={basis:ExplanationBasis;draft:ExplanationDraft};
export type DraftRead={status:'missing'|'ready'|'corrupt'|'unavailable';raw:string|null;record?:DraftRecord};
export function explanationDraftKey(scope:DraftScope){const s=scopeSchema.parse(scope);return `diagramcloud.explanation-draft.v1:${encodeURIComponent(JSON.stringify([s.host,s.projectId,s.audience]))}`;}
export function encodeExplanationDraft(scope:DraftScope,record:DraftRecord){
 const value=recordSchema.parse({version:1,scope,...record});if(value.basis.projectId!==scope.projectId)throw Error('Draft belongs to another project.');
 const raw=JSON.stringify(value);if(new TextEncoder().encode(raw).length>DRAFT_STORAGE_LIMIT)throw Error('Draft exceeds the 4 MiB storage limit.');return raw;
}
export function readExplanationDraft(storage:DraftStorage|null,scope:DraftScope):DraftRead{
 let raw:string|null=null;try{const key=explanationDraftKey(scope);if(!storage)return {status:'unavailable',raw};raw=storage.getItem(key);}catch{return {status:'unavailable',raw:null};}
 if(raw===null)return {status:'missing',raw};
 try{if(raw.length>DRAFT_STORAGE_LIMIT||new TextEncoder().encode(raw).length>DRAFT_STORAGE_LIMIT)throw Error();const v=recordSchema.parse(JSON.parse(raw));if(explanationDraftKey(v.scope)!==explanationDraftKey(scope)||v.basis.projectId!==scope.projectId)throw Error();return {status:'ready',raw,record:{basis:v.basis,draft:v.draft}};}catch{return {status:'corrupt',raw};}
}
export type DraftWrite={ok:true;read:DraftRead}|{ok:false;reason:'conflict'|'unavailable'|'invalid';message:string};
/** Best-effort observed-string guard, not a transactional cross-tab lock. */
export function changeExplanationDraft(storage:DraftStorage|null,scope:DraftScope,observed:string|null,record:DraftRecord|null):DraftWrite{
 try{
  const key=explanationDraftKey(scope);if(!storage)throw Error();
  const current=readExplanationDraft(storage,scope);if(current.status==='unavailable')throw Error();
  if(current.raw!==observed)return {ok:false,reason:'conflict',message:'Draft conflict: another tab changed the saved copy. Autosave stopped. Refresh saved draft, then recover or delete it explicitly.'};
  if(record&&current.status==='corrupt')return {ok:false,reason:'invalid',message:'Saved draft is corrupt or unsupported. Delete it explicitly before saving a replacement.'};
  if(record){let raw:string;try{raw=encodeExplanationDraft(scope,record);}catch{return {ok:false,reason:'invalid',message:'Draft cannot be saved in the supported recovery format. Keep editing or download a draft backup.'};}storage.setItem(key,raw);if(storage.getItem(key)!==raw)return {ok:false,reason:'conflict',message:'Draft conflict: saved copy changed. Autosave stopped; download your current draft.'};return {ok:true,read:{status:'ready',raw,record}};}
  storage.removeItem(key);if(storage.getItem(key)!==null)return {ok:false,reason:'conflict',message:'Draft conflict: deletion could not be confirmed. Refresh saved draft.'};return {ok:true,read:{status:'missing',raw:null}};
 }catch{return {ok:false,reason:'unavailable',message:'Draft is not saved: browser storage is unavailable or full. Download a draft backup; your form is unchanged.'};}
}
export function browserDraftStorage():DraftStorage|null{try{return window.localStorage;}catch{return null;}}
