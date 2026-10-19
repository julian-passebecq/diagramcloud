import type {Perspective,Project} from './model';
import {PERSPECTIVES} from './model';
import {pathTo,perspectiveOf} from './viewspec';

/**
 * Durable semantic context (browser-local bookmarks of where the reader was). A saved context holds stable-ID
 * pointers only: never copied facts, labels, permissions, camera or panel preferences. It is scoped by project,
 * audience and host, so a public or embedded reader never reads an author context. Every dimension is resolved
 * independently against the caller's currently permitted document; a lost dimension gets a generic explanation
 * and a safe fallback while the valid ones are kept. Restoring navigates only: it never commits a revision and
 * never touches authoring Undo.
 */
export const SAVED_CONTEXT_FORMAT='diagramcloud.saved-contexts';
export const SAVED_CONTEXT_VERSION=1;
export const SAVED_CONTEXT_LIMIT=20;
export const SAVED_CONTEXT_UNAVAILABLE='This part of the saved context is unavailable in the current permitted document.';
export type SavedContextAudience='author'|'public';
export type NavigationSheet='diagram'|'overview'|'structure'|'relationships'|'evidence';
const SHEETS:NavigationSheet[]=['diagram','overview','structure','relationships','evidence'];
const DEPTHS=['overview','architecture','detail'] as const;
export type LessonDepth=typeof DEPTHS[number];

const PLACEMENTS=['below-both','below-right'] as const;
export type LinkedDetailPlacement=typeof PLACEMENTS[number];
/** The linked-views pair of the V3 workspace: two view IDs, the business-question anchor and the detail slot. Pointers only. */
export type LinkedContext={leftViewId:string;rightViewId:string;anchorNodeId:string|null;detailPlacement:LinkedDetailPlacement};
/**
 * The semantic dimensions. `variantId` and `tour` are reserved slots in this module (the App restores them).
 * `linked` is optional and absent when the context was saved outside linked mode, so a version-1 file written
 * before it existed parses and resolves exactly as before (no migration, same storage version).
 */
export type SemanticContext={
 path:string[];view:string;selected:string|null;selectedEdge:string|null;sheet:NavigationSheet;
 perspective:Perspective|null;environmentId:string|null;snapshotId:string|null;lesson:{lessonId:string;depth:LessonDepth}|null;
 variantId:string|null;tour:{tourId:string;stopId:string}|null;linked?:LinkedContext;
};
export type SavedContext={id:string;label:string;savedAt:string;projectRevision:number;context:SemanticContext};
export type SavedContextFile={format:typeof SAVED_CONTEXT_FORMAT;version:typeof SAVED_CONTEXT_VERSION;scope:string;entries:SavedContext[]};

export type DimensionName='path'|'view'|'selection'|'sheet'|'perspective'|'environment'|'snapshot'|'lesson'|'variant'|'tour'|'linked'|'anchor';
/** kept: restored as saved. fallback: unavailable, a safe default is used. changed: still valid but no longer as saved (shown, not forced). reserved: recorded, not restored by this version. */
export type DimensionState='kept'|'fallback'|'changed'|'reserved';
export type DimensionResult={dimension:DimensionName;state:DimensionState;explanation?:string};
export type RestoredNavigation={path:string[];view:string;selected:string|null;selectedEdge:string|null;sheet:NavigationSheet;lesson:{lessonId:string;depth:LessonDepth}|null};
/** `linked` is present only when the context recorded a linked pair: the pair to reopen, or null when it is lost. */
export type SavedContextResolution={state:'restored'|'partial'|'unavailable';navigation:RestoredNavigation;dimensions:DimensionResult[];linked?:LinkedContext|null};

const stableId=(value:unknown):value is string=>typeof value==='string'&&/^[a-z][a-z0-9_.-]{0,79}$/.test(value);
const optionalId=(value:unknown)=>value===null||stableId(value);
const isObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const exactKeys=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));

export function savedContextScope(projectId:string,audience:SavedContextAudience,host:string){return JSON.stringify([projectId,audience,host]);}
export function savedContextKey(projectId:string,audience:SavedContextAudience,host:string){return `diagramcloud.saved-contexts.v${SAVED_CONTEXT_VERSION}:${savedContextScope(projectId,audience,host)}`;}

const CONTEXT_KEYS=['path','view','selected','selectedEdge','sheet','perspective','environmentId','snapshotId','lesson','variantId','tour'];
/** Shape check only (no document): rejects anything that is not exactly a SemanticContext of stable IDs. */
export function isSemanticContext(input:unknown):input is SemanticContext{
 if(!isObject(input)||!(exactKeys(input,CONTEXT_KEYS)||exactKeys(input,[...CONTEXT_KEYS,'linked'])))return false;
 const c=input;
 if(!Array.isArray(c.path)||!c.path.length||c.path.length>100||!c.path.every(stableId)||new Set(c.path).size!==c.path.length||!stableId(c.view))return false;
 if(!optionalId(c.selected)||!optionalId(c.selectedEdge)||(c.selected!==null&&c.selectedEdge!==null)||!SHEETS.includes(c.sheet as NavigationSheet))return false;
 if(c.perspective!==null&&!PERSPECTIVES.includes(c.perspective as Perspective))return false;
 if(!optionalId(c.environmentId)||!optionalId(c.snapshotId)||!optionalId(c.variantId))return false;
 if(c.lesson!==null&&(!isObject(c.lesson)||!exactKeys(c.lesson,['lessonId','depth'])||!stableId(c.lesson.lessonId)||!DEPTHS.includes(c.lesson.depth as LessonDepth)))return false;
 if(c.tour!==null&&(!isObject(c.tour)||!exactKeys(c.tour,['tourId','stopId'])||!stableId(c.tour.tourId)||!stableId(c.tour.stopId)))return false;
 if(Object.hasOwn(c,'linked')){const l=c.linked;if(!isObject(l)||!exactKeys(l,['leftViewId','rightViewId','anchorNodeId','detailPlacement'])||!stableId(l.leftViewId)||!stableId(l.rightViewId)||!optionalId(l.anchorNodeId)||!PLACEMENTS.includes(l.detailPlacement as LinkedDetailPlacement))return false;}
 return true;
}
function isSavedContext(input:unknown):input is SavedContext{
 if(!isObject(input)||!exactKeys(input,['id','label','savedAt','projectRevision','context']))return false;
 return stableId(input.id)&&typeof input.label==='string'&&input.label.length<=120&&typeof input.savedAt==='string'&&input.savedAt.length<=40&&
  Number.isInteger(input.projectRevision)&&(input.projectRevision as number)>=0&&isSemanticContext(input.context);
}
/** Parses a stored file for exactly this scope. Anything else (other scope, version, shape) is `corrupt`, never reinterpreted. */
export function parseSavedContextFile(text:string,scope:string):{state:'ok';entries:SavedContext[]}|{state:'corrupt'}{
 let value:unknown;try{value=JSON.parse(text);}catch{return {state:'corrupt'};}
 if(!isObject(value)||!exactKeys(value,['format','version','scope','entries'])||value.format!==SAVED_CONTEXT_FORMAT||value.version!==SAVED_CONTEXT_VERSION||value.scope!==scope||!Array.isArray(value.entries)||value.entries.length>SAVED_CONTEXT_LIMIT)return {state:'corrupt'};
 if(!value.entries.every(isSavedContext)||new Set(value.entries.map(e=>(e as SavedContext).id)).size!==value.entries.length)return {state:'corrupt'};
 return {state:'ok',entries:value.entries.map(e=>structuredClone(e as SavedContext))};
}
export const serializeSavedContextFile=(scope:string,entries:SavedContext[])=>JSON.stringify({format:SAVED_CONTEXT_FORMAT,version:SAVED_CONTEXT_VERSION,scope,entries} satisfies SavedContextFile);

/** Capture from the current permitted document. Returns undefined when the live navigation itself is not valid there. */
export function captureSemanticContext(doc:Project,input:{path:string[];view:string;selected:string|null;selectedEdge:string|null;sheet:NavigationSheet;environmentId?:string|null;lesson?:{lessonId:string;depth:LessonDepth}|null;variantId?:string|null;tour?:{tourId:string;stopId:string}|null;linked?:LinkedContext|null}):SemanticContext|undefined{
 const view=doc.views.find(v=>v.id===input.view);if(!view)return;
 const context:SemanticContext={path:[...input.path],view:input.view,selected:input.selected,selectedEdge:input.selected!==null?null:input.selectedEdge,sheet:input.sheet,
  perspective:perspectiveOf(view),environmentId:input.environmentId??null,snapshotId:doc.atlas?.activeSnapshotId??null,lesson:input.lesson?{lessonId:input.lesson.lessonId,depth:input.lesson.depth}:null,
  variantId:input.variantId??null,tour:input.tour?{tourId:input.tour.tourId,stopId:input.tour.stopId}:null};
 if(input.linked)context.linked={leftViewId:input.linked.leftViewId,rightViewId:input.linked.rightViewId,anchorNodeId:input.linked.anchorNodeId,detailPlacement:input.linked.detailPlacement};
 if(!isSemanticContext(context))return;
 const resolved=resolveSemanticContext(doc,context,()=>true);
 return resolved.state==='restored'?context:undefined;
}

/**
 * Resolve each dimension independently against `doc`, which must already be the permitted projection for the reader
 * (publicDocument for public audiences). `lessonExists` answers only whether a lesson ID is in the current catalogue.
 * Never substitutes an object with a similar label or another route: only the exact stable IDs count.
 */
export function resolveSemanticContext(doc:Project,input:unknown,lessonExists:(lessonId:string)=>boolean):SavedContextResolution{
 const root=doc.rootViewId,fallbackNav:RestoredNavigation={path:[root],view:root,selected:null,selectedEdge:null,sheet:'diagram',lesson:null};
 if(!isSemanticContext(input))return {state:'unavailable',navigation:fallbackNav,dimensions:[{dimension:'path',state:'fallback',explanation:SAVED_CONTEXT_UNAVAILABLE}]};
 const c=input,dims:DimensionResult[]=[],lost=(dimension:DimensionName):DimensionResult=>({dimension,state:'fallback',explanation:SAVED_CONTEXT_UNAVAILABLE});
 const views=new Map(doc.views.map(v=>[v.id,v])),nodes=new Map(doc.nodes.map(n=>[n.id,n]));
 // Path: the longest exact prefix of the recorded drilldown chain that still exists from the root.
 const path:string[]=[];
 if(c.path[0]===root&&views.has(root)){path.push(root);for(let i=1;i<c.path.length;i++){const parent=views.get(path[i-1])!,next=c.path[i];if(!views.has(next)||!parent.nodeIds.some(id=>nodes.get(id)?.childViewId===next))break;path.push(next);}}
 if(!path.length)path.push(root);
 dims.push(path.length===c.path.length&&path[0]===c.path[0]?{dimension:'path',state:'kept'}:lost('path'));
 // View: must be on the surviving path; otherwise the deepest surviving view is shown.
 const viewKept=path.includes(c.view),view=viewKept?c.view:path[path.length-1];
 dims.push(viewKept?{dimension:'view',state:'kept'}:lost('view'));
 const active=views.get(view)!;
 // Selection: only within the restored view, by exact ID.
 let selected:string|null=null,selectedEdge:string|null=null;
 if(c.selected!==null){if(viewKept&&nodes.has(c.selected)&&active.nodeIds.includes(c.selected)){selected=c.selected;dims.push({dimension:'selection',state:'kept'});}else dims.push(lost('selection'));}
 else if(c.selectedEdge!==null){const e=doc.edges.find(e=>e.id===c.selectedEdge);if(viewKept&&e&&active.edgeIds.includes(e.id)&&active.nodeIds.includes(e.source)&&active.nodeIds.includes(e.target)){selectedEdge=e.id;dims.push({dimension:'selection',state:'kept'});}else dims.push(lost('selection'));}
 else dims.push({dimension:'selection',state:'kept'});
 dims.push({dimension:'sheet',state:'kept'});
 // Perspective is a property of the view: reported when it changed, never forced onto the view.
 if(c.perspective!==null){if(!viewKept)dims.push(lost('perspective'));else if(perspectiveOf(active)!==c.perspective)dims.push({dimension:'perspective',state:'changed',explanation:'The view now has another perspective; the current one is shown.'});else dims.push({dimension:'perspective',state:'kept'});}
 if(c.environmentId!==null)dims.push(doc.delivery?.environments.some(e=>e.id===c.environmentId)?{dimension:'environment',state:'kept'}:lost('environment'));
 // Snapshot: never restores old architecture facts. A different active snapshot is shown as changed.
 if(c.snapshotId!==null){const snapshots=doc.atlas?.snapshots??[];if(!snapshots.some(s=>s.id===c.snapshotId))dims.push(lost('snapshot'));else if(doc.atlas!.activeSnapshotId!==c.snapshotId)dims.push({dimension:'snapshot',state:'changed',explanation:'Another snapshot is active now; the current facts are shown, not the saved ones.'});else dims.push({dimension:'snapshot',state:'kept'});}
 let lesson:RestoredNavigation['lesson']=null;
 if(c.lesson!==null){if(lessonExists(c.lesson.lessonId)){lesson={...c.lesson};dims.push({dimension:'lesson',state:'kept'});}else dims.push(lost('lesson'));}
 if(c.variantId!==null)dims.push({dimension:'variant',state:'reserved',explanation:'Variant selection is recorded but not restored by this version.'});
 if(c.tour!==null)dims.push({dimension:'tour',state:'reserved',explanation:'Tour position is recorded but not restored by this version.'});
 // Linked pair: both views must be reachable by explicit drilldown in this permitted document, by exact ID. A lost side
 // closes the pair (no substitute view is suggested); the anchor resolves on its own and is cleared when it is gone.
 let linked:LinkedContext|null|undefined;
 if(c.linked){const l=c.linked,pairKept=pathTo(doc,l.leftViewId).length>0&&pathTo(doc,l.rightViewId).length>0;
  const anchorKept=l.anchorNodeId!==null&&nodes.has(l.anchorNodeId);
  dims.push(pairKept?{dimension:'linked',state:'kept'}:lost('linked'));
  if(l.anchorNodeId!==null)dims.push(pairKept&&anchorKept?{dimension:'anchor',state:'kept'}:lost('anchor'));
  linked=pairKept?{leftViewId:l.leftViewId,rightViewId:l.rightViewId,anchorNodeId:anchorKept?l.anchorNodeId:null,detailPlacement:l.detailPlacement}:null;}
 const lostAny=dims.some(d=>d.state==='fallback'),core=dims.find(d=>d.dimension==='path')!.state==='kept'&&viewKept;
 const out:SavedContextResolution={state:!lostAny?'restored':core||path.length>1?'partial':'unavailable',navigation:{path,view,selected,selectedEdge,sheet:c.sheet,lesson},dimensions:dims};
 if(linked!==undefined)out.linked=linked;
 return out;
}

/** Minimal Storage surface (window.localStorage or a test double). */
export type SavedContextStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type SavedContextRead={status:'ok'|'empty'|'corrupt'|'unavailable';entries:SavedContext[]};
export function readSavedContexts(storage:SavedContextStorage|null,projectId:string,audience:SavedContextAudience,host:string):SavedContextRead{
 if(!storage)return {status:'unavailable',entries:[]};
 let text:string|null;try{text=storage.getItem(savedContextKey(projectId,audience,host));}catch{return {status:'unavailable',entries:[]};}
 if(text===null)return {status:'empty',entries:[]};
 const parsed=parseSavedContextFile(text,savedContextScope(projectId,audience,host));
 return parsed.state==='ok'?{status:'ok',entries:parsed.entries}:{status:'corrupt',entries:[]};
}
function write(storage:SavedContextStorage|null,projectId:string,audience:SavedContextAudience,host:string,entries:SavedContext[]):boolean{
 if(!storage)return false;
 try{storage.setItem(savedContextKey(projectId,audience,host),serializeSavedContextFile(savedContextScope(projectId,audience,host),entries));return true;}catch{return false;}
}
export type SavedContextWrite={ok:true;entries:SavedContext[]}|{ok:false;reason:'unavailable'|'corrupt'|'full';entries:SavedContext[]};
/**
 * Read-modify-write against the freshest stored value, so another tab's saved contexts are never overwritten.
 * A corrupt stored value is left untouched (the reader must clear it explicitly).
 */
export function addSavedContext(storage:SavedContextStorage|null,projectId:string,audience:SavedContextAudience,host:string,entry:SavedContext):SavedContextWrite{
 const current=readSavedContexts(storage,projectId,audience,host);
 if(current.status==='unavailable')return {ok:false,reason:'unavailable',entries:[]};
 if(current.status==='corrupt')return {ok:false,reason:'corrupt',entries:[]};
 if(current.entries.length>=SAVED_CONTEXT_LIMIT)return {ok:false,reason:'full',entries:current.entries};
 const entries=[...current.entries.filter(e=>e.id!==entry.id),entry];
 return write(storage,projectId,audience,host,entries)?{ok:true,entries}:{ok:false,reason:'unavailable',entries:current.entries};
}
export function removeSavedContext(storage:SavedContextStorage|null,projectId:string,audience:SavedContextAudience,host:string,id:string):SavedContextWrite{
 const current=readSavedContexts(storage,projectId,audience,host);
 if(current.status==='unavailable')return {ok:false,reason:'unavailable',entries:[]};
 if(current.status==='corrupt')return {ok:false,reason:'corrupt',entries:[]};
 const entries=current.entries.filter(e=>e.id!==id);
 return write(storage,projectId,audience,host,entries)?{ok:true,entries}:{ok:false,reason:'unavailable',entries:current.entries};
}
/** Explicit recovery from a corrupt or unwanted value; only this scope's key is removed. */
export function clearSavedContexts(storage:SavedContextStorage|null,projectId:string,audience:SavedContextAudience,host:string):boolean{
 if(!storage)return false;try{storage.removeItem(savedContextKey(projectId,audience,host));return true;}catch{return false;}
}
/** Subscribe to other-tab changes of exactly this scope. Returns the unsubscribe function. */
export function watchSavedContexts(target:Pick<Window,'addEventListener'|'removeEventListener'>,projectId:string,audience:SavedContextAudience,host:string,onChange:()=>void){
 const key=savedContextKey(projectId,audience,host),listener=(event:StorageEvent)=>{if(event.key===key||event.key===null)onChange();};
 target.addEventListener('storage',listener);return()=>target.removeEventListener('storage',listener);
}
