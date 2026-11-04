import {validateWorkbenchLayout,type WorkbenchLayout} from './workbenchLayout';
/** Explicit browser preferences, never Project content, camera, route, permission or Undo.
 * A saved layout carries panel sizes, floating placements (Explorer, companion, bottom panel) and density; records written
 * before 1.34 (no density, no floating Explorer) are read as comfortable and docked in memory and never rewritten on read. */
export type ArrangementScope={projectId:string;audience:'author'|'public';hostId:string};
export type ArrangementStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type WorkspaceArrangement={name:string;layout:WorkbenchLayout};
export type ArrangementRead={status:'ready'|'missing'|'corrupt'|'unavailable';entries:WorkspaceArrangement[];basis:string|null};
export const ARRANGEMENT_LIMIT=12,ARRANGEMENT_MAX_BYTES=32768;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const token=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
export function arrangementScopeKey(scope:ArrangementScope):string{
 if(!exact(scope,['projectId','audience','hostId'])||!token(scope.projectId,160)||!token(scope.hostId,300)||!['author','public'].includes(scope.audience))throw Error('Invalid arrangement scope');
 return `diagramcloud.workspace-arrangements.v1:${encodeURIComponent(JSON.stringify([scope.hostId,scope.projectId,scope.audience]))}`;
}
function nameOf(value:unknown){if(!token(value,60)||value!==value.trim())throw Error('Use an arrangement name of 1–60 characters without surrounding whitespace.');return value;}
function decode(raw:string,scope:ArrangementScope):WorkspaceArrangement[]{
 if(new TextEncoder().encode(raw).length>ARRANGEMENT_MAX_BYTES)throw Error('Oversized arrangements');
 const v:unknown=JSON.parse(raw);if(!exact(v,['version','scope','entries'])||v.version!==1||!exact(v.scope,['projectId','audience','hostId'])||arrangementScopeKey(v.scope as ArrangementScope)!==arrangementScopeKey(scope)||!Array.isArray(v.entries)||v.entries.length>ARRANGEMENT_LIMIT)throw Error('Invalid arrangements');
 const names=new Set<string>();return v.entries.map(entry=>{if(!exact(entry,['name','layout']))throw Error('Invalid arrangement');const name=nameOf(entry.name);if(names.has(name))throw Error('Duplicate arrangement');names.add(name);return {name,layout:validateWorkbenchLayout(entry.layout)};});
}
export function readWorkspaceArrangements(storage:ArrangementStorage|null,scope:ArrangementScope):ArrangementRead{
 let basis:string|null=null;
 try{const key=arrangementScopeKey(scope);if(!storage)return {status:'unavailable',entries:[],basis};basis=storage.getItem(key);if(basis===null)return {status:'missing',entries:[],basis};}
 catch{return {status:'unavailable',entries:[],basis:null};}
 try{return {status:'ready',entries:decode(basis,scope),basis};}catch{return {status:'corrupt',entries:[],basis};}
}
export type ArrangementResult={ok:true;read:ArrangementRead}|{ok:false;reason:'unavailable'|'corrupt'|'conflict'|'invalid'|'duplicate'|'limit'|'missing';message:string};
/** Exact observed-string guard catches stale UI/other-tab changes. localStorage is not a cross-tab transaction. */
export function changeWorkspaceArrangements(storage:ArrangementStorage|null,scope:ArrangementScope,basis:string|null,action:{type:'save';name:string;layout:unknown}|{type:'delete';name:string}|{type:'discard-corrupt'}):ArrangementResult{
 const fail=(reason:Extract<ArrangementResult,{ok:false}>['reason'],message:string):ArrangementResult=>({ok:false,reason,message});
 const current=readWorkspaceArrangements(storage,scope);
 if(!storage||current.status==='unavailable')return fail('unavailable','Browser storage is unavailable. Your current layout and project are unchanged.');
 if(current.basis!==basis)return fail('conflict','Saved arrangements changed in another tab. Refresh the list before trying again.');
 if(action.type==='discard-corrupt'){
  if(current.status!=='corrupt')return fail('conflict','Arrangement data changed. Refresh the list before trying again.');
  try{storage.removeItem(arrangementScopeKey(scope));return {ok:true,read:{status:'missing',entries:[],basis:null}};}catch{return fail('unavailable','Invalid arrangement data could not be removed. Your layout and project are unchanged.');}
 }
 if(current.status==='corrupt')return fail('corrupt','Saved arrangement data is invalid and has been left untouched. Discard it explicitly before saving a new arrangement.');
 let entries=current.entries;
 if(action.type==='save'){
  let entry:WorkspaceArrangement;try{entry={name:nameOf(action.name),layout:validateWorkbenchLayout(action.layout)};}catch{return fail('invalid','Use a valid layout and an arrangement name of 1–60 characters.');}
  if(entries.some(e=>e.name===entry.name))return fail('duplicate','That name is already saved. Use another name or delete the existing arrangement first.');
  if(entries.length>=ARRANGEMENT_LIMIT)return fail('limit',`At most ${ARRANGEMENT_LIMIT} arrangements can be saved here. Delete one before saving another.`);
  entries=[...entries,entry];
 }else{if(!entries.some(e=>e.name===action.name))return fail('missing','This arrangement is no longer available. Refresh the list.');entries=entries.filter(e=>e.name!==action.name);}
 const raw=JSON.stringify({version:1,scope,entries});if(new TextEncoder().encode(raw).length>ARRANGEMENT_MAX_BYTES)return fail('limit','The arrangement storage limit was reached. Existing arrangements are unchanged.');
 try{storage.setItem(arrangementScopeKey(scope),raw);return {ok:true,read:{status:'ready',entries,basis:raw}};}catch{return fail('unavailable','Arrangement changes could not be saved. Browser storage may be blocked or full. Existing saved arrangements and your project are unchanged.');}
}
/** Restore re-reads current permitted scope and refuses a stale selected list; never guesses by project/title. */
export function restoreWorkspaceArrangement(storage:ArrangementStorage|null,scope:ArrangementScope,basis:string|null,name:string):{ok:true;layout:WorkbenchLayout}|{ok:false;message:string}{
 const current=readWorkspaceArrangements(storage,scope);if(current.status==='unavailable')return {ok:false,message:'Browser storage is unavailable. The current layout is unchanged.'};
 if(current.status==='corrupt')return {ok:false,message:'Saved arrangement data is invalid. The current layout is unchanged.'};
 if(current.basis!==basis)return {ok:false,message:'Saved arrangements changed. Refresh the list before restoring.'};
 const entry=current.entries.find(e=>e.name===name);return entry?{ok:true,layout:validateWorkbenchLayout(entry.layout)}:{ok:false,message:'This arrangement is unavailable in the current project and audience.'};
}
