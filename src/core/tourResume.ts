import {canonical,fnv64} from './learningMapping';
import type {Project,TourStop} from './model';

/**
 * Tour Resume: where a reader was in a tour, by stable stop identity, never by position alone. A stop with an `id` is
 * found by that ID wherever it now is; a legacy stop without one is found by its recorded view, subjects and
 * fingerprint. A moved stop, several matching stops or a removed stop is never rebound silently: the reader is asked
 * to choose, and staying where they are is always possible. Resolving and resuming are reading only: no revision,
 * no run, no observation.
 */
export type TourPointer={tourId:string;stopRef:string;index?:number};
export type TourResumeResolution=
 |{state:'resumed';tourId:string;index:number;message:string}
 |{state:'choose';tourId:string;reason:'reordered'|'ambiguous'|'removed';candidates:number[];message:string}
 |{state:'unavailable';message:string};
export const TOUR_RESUME_UNAVAILABLE='This tour is not available here. You stay where you are.';

/** The stable reference of a stop: its ID, else a key of its recorded view, subjects and fingerprint. An omitted stop has none. */
export function stopRef(stop:TourStop):string|undefined{
 if(stop.id)return stop.id;
 if(stop.omitted==='stop'||!stop.viewId)return undefined;
 return 'legacy.'+fnv64(canonical({viewId:stop.viewId,subjects:stop.subjects,fingerprint:stop.fingerprint??null}));
}

/** Resolve a saved position against the tours of `doc`, which must already be the reader's permitted document. Pure. */
export function resolveTourResume(doc:Project,pointer:TourPointer):TourResumeResolution{
 const tour=(doc.tours??[]).find(t=>t.id===pointer.tourId);
 if(!tour)return {state:'unavailable',message:TOUR_RESUME_UNAVAILABLE};
 const matches=tour.stops.flatMap((s,i)=>stopRef(s)===pointer.stopRef?[i]:[]);
 if(matches.length===1){
  const at=matches[0];
  if(pointer.index===undefined||pointer.index===at)return {state:'resumed',tourId:tour.id,index:at,message:`Resumed ${tour.title} at stop ${at+1} of ${tour.stops.length}.`};
  return {state:'choose',tourId:tour.id,reason:'reordered',candidates:[at],message:`The stop you were on moved from position ${pointer.index+1} to ${at+1} of ${tour.stops.length}. Choose where to continue; nothing is picked for you.`};
 }
 if(matches.length>1)return {state:'choose',tourId:tour.id,reason:'ambiguous',candidates:matches,message:`${matches.length} stops of ${tour.title} match where you were. Choose one; none is picked for you.`};
 return {state:'choose',tourId:tour.id,reason:'removed',candidates:[],message:`The stop you were on is no longer in ${tour.title}. Start from the first stop, or stay where you are.`};
}

/** Browser-local last positions, one per tour, scoped by project, audience and host (a public reader never reads author positions). */
export const TOUR_RESUME_FORMAT='diagramcloud.tour-resume';
export const TOUR_RESUME_VERSION=1;
export type TourResumeAudience='author'|'public';
export type TourResumePosition={stopRef:string;index:number;savedAt:string};
export type TourResumeStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type TourResumeRead={status:'ok'|'empty'|'corrupt'|'unavailable';positions:Record<string,TourResumePosition>};
const scopeOf=(projectId:string,audience:TourResumeAudience,host:string)=>JSON.stringify([projectId,audience,host]);
export const tourResumeKey=(projectId:string,audience:TourResumeAudience,host:string)=>`${TOUR_RESUME_FORMAT}.v${TOUR_RESUME_VERSION}:${scopeOf(projectId,audience,host)}`;
const stableId=(v:unknown):v is string=>typeof v==='string'&&/^[a-z][a-z0-9_.-]{0,79}$/.test(v);
const isObject=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function isPosition(v:unknown):v is TourResumePosition{
 return isObject(v)&&Object.keys(v).length===3&&stableId(v.stopRef)&&Number.isInteger(v.index)&&(v.index as number)>=0&&(v.index as number)<50&&typeof v.savedAt==='string'&&v.savedAt.length<=40;
}
export function readTourResume(storage:TourResumeStorage|null,projectId:string,audience:TourResumeAudience,host:string):TourResumeRead{
 if(!storage)return {status:'unavailable',positions:{}};
 let text:string|null;try{text=storage.getItem(tourResumeKey(projectId,audience,host));}catch{return {status:'unavailable',positions:{}};}
 if(text===null)return {status:'empty',positions:{}};
 let value:unknown;try{value=JSON.parse(text);}catch{return {status:'corrupt',positions:{}};}
 if(!isObject(value)||Object.keys(value).length!==4||value.format!==TOUR_RESUME_FORMAT||value.version!==TOUR_RESUME_VERSION||value.scope!==scopeOf(projectId,audience,host)||!isObject(value.positions))return {status:'corrupt',positions:{}};
 const entries=Object.entries(value.positions);
 if(entries.length>30||!entries.every(([k,p])=>stableId(k)&&isPosition(p)))return {status:'corrupt',positions:{}};
 return {status:'ok',positions:Object.fromEntries(entries.map(([k,p])=>[k,{...(p as TourResumePosition)}]))};
}
/** Read-modify-write of one tour's position. A corrupt stored value is never overwritten (clear it explicitly). */
export function writeTourResume(storage:TourResumeStorage|null,projectId:string,audience:TourResumeAudience,host:string,tourId:string,position:TourResumePosition):boolean{
 const current=readTourResume(storage,projectId,audience,host);if(current.status==='unavailable'||current.status==='corrupt')return false;
 const positions={...current.positions,[tourId]:position};
 try{storage!.setItem(tourResumeKey(projectId,audience,host),JSON.stringify({format:TOUR_RESUME_FORMAT,version:TOUR_RESUME_VERSION,scope:scopeOf(projectId,audience,host),positions}));return true;}catch{return false;}
}
export function clearTourResume(storage:TourResumeStorage|null,projectId:string,audience:TourResumeAudience,host:string):boolean{
 if(!storage)return false;try{storage.removeItem(tourResumeKey(projectId,audience,host));return true;}catch{return false;}
}
