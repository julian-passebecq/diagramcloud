import {canonical,fnv64} from './learningMapping';
import {tourSchema,tourStopSchema,validateDocument,type Project,type Tour,type TourStop} from './model';

/**
 * Tours: a presented sequence of stops over stable subjects, never timing and never a run. A stop stores its selected
 * view, the stable IDs of its subjects, a content fingerprint taken when it was recorded, and narration. Reading a tour
 * derives each anchor's state against the document it is read from: current, stale (content changed since recording),
 * missing (view or subject gone or not visible here) or omitted (removed from a public copy, and said so). Nothing is
 * repaired silently: a stale or missing anchor fails visibly and the author re-records it.
 */
export type TourSubject={kind:'node'|'edge';id:string};
export type StopStatus='current'|'stale'|'missing'|'omitted';
export type StopState={index:number;status:StopStatus;viewId?:string;subjects:TourSubject[];narration:string;message:string;note?:string;missing:TourSubject[]};
export const TOUR_LABEL='Presented sequence - not a run, not timing';

const present=(doc:Project,viewId:string,s:TourSubject)=>{const view=doc.views.find(v=>v.id===viewId);if(!view)return undefined;
 return s.kind==='node'?(view.nodeIds.includes(s.id)?doc.nodes.find(n=>n.id===s.id):undefined):(view.edgeIds.includes(s.id)?doc.edges.find(e=>e.id===s.id):undefined);};
/** Content fingerprint of a stop: the selected view's title and each subject's full content. Positions are camera, not content. Undefined when an anchor is absent. */
export function stopFingerprint(doc:Project,viewId:string,subjects:TourSubject[]):string|undefined{
 const view=doc.views.find(v=>v.id===viewId);if(!view)return undefined;
 const items=subjects.map(s=>present(doc,viewId,s));if(items.some(x=>!x))return undefined;
 return fnv64(canonical({view:{id:view.id,title:view.title},subjects:subjects.map((s,i)=>({kind:s.kind,item:items[i]}))}));
}
/** Record a stop on the current content. Throws when a subject is not in the selected view. */
export function recordStop(doc:Project,viewId:string,subjects:TourSubject[],narration:string):TourStop{
 if(!doc.views.some(v=>v.id===viewId))throw new Error(`Unknown view ${viewId}.`);
 const absent=subjects.filter(s=>!present(doc,viewId,s));if(absent.length)throw new Error(`Not in view ${viewId}: ${absent.map(s=>s.id).join(', ')}.`);
 return tourStopSchema.parse({viewId,subjects,fingerprint:stopFingerprint(doc,viewId,subjects),narration});
}
/** A new tour recorded at the document's current revision; one validated document, committed by the caller as one revision. */
export function addTour(doc:Project,input:{id:string;title:string;visibility?:'public'|'private';stop:TourStop}):Project{
 if((doc.tours??[]).some(t=>t.id===input.id))throw new Error(`A tour ${input.id} already exists.`);
 const tour=tourSchema.parse({id:input.id,title:input.title,sourceRevision:doc.revision,stops:[input.stop],visibility:input.visibility??'private'});
 return validateDocument({...doc,tours:[...(doc.tours??[]),tour]});
}
export function addTourStop(doc:Project,tourId:string,stop:TourStop):Project{
 if(!(doc.tours??[]).some(t=>t.id===tourId))throw new Error(`No tour ${tourId}.`);
 return validateDocument({...doc,tours:doc.tours!.map(t=>t.id===tourId?{...t,stops:[...t.stops,stop]}:t)});
}
export function removeTour(doc:Project,tourId:string):Project{
 const tours=(doc.tours??[]).filter(t=>t.id!==tourId),next:Project={...doc,tours};if(!tours.length)delete next.tours;return validateDocument(next);
}

/** Each stop's anchor state in this document (authoring, or a public copy). Pure: reading a tour changes nothing. */
export function tourStops(doc:Project,tour:Tour):StopState[]{
 return tour.stops.map((s,index)=>{
  const base={index,viewId:s.viewId,subjects:s.subjects,narration:s.narration,missing:[] as TourSubject[],...(s.omitted==='subjects'?{note:'Some subjects of this stop are not public and are omitted from this copy.'}:{})};
  if(s.omitted==='stop'||!s.viewId)return {...base,status:'omitted' as const,message:'This stop is not public and is omitted from this copy.'};
  if(!doc.views.some(v=>v.id===s.viewId))return {...base,status:'missing' as const,message:`Anchor missing: view ${s.viewId} is not available here. This stop cannot be shown.`};
  const missing=s.subjects.filter(x=>!present(doc,s.viewId!,x));
  if(missing.length)return {...base,missing,status:'missing' as const,message:`Anchor missing: ${missing.map(x=>`${x.kind==='node'?'component':'connection'} ${x.id}`).join(', ')} ${missing.length===1?'is':'are'} no longer in view ${s.viewId}. This stop cannot be shown as recorded.`};
  if(stopFingerprint(doc,s.viewId,s.subjects)!==s.fingerprint)return {...base,status:'stale' as const,message:`Anchor stale: the content changed after this tour was recorded at revision ${tour.sourceRevision} (now revision ${doc.revision}). Check the narration and re-record the stop.`};
  return {...base,status:'current' as const,message:''};
 });
}

/**
 * Public projection, called by publicDocument once the public closure is known. Only public tours. A stop whose view is
 * not public, or whose subjects are all not public, becomes an omitted stop with no view, subjects or narration; a subject that is not public is dropped and the
 * stop says some subjects are omitted, without naming or counting them. A stop current in authoring carries the
 * fingerprint of its public content; a stale one keeps its recorded fingerprint, so it reads stale in the copy too.
 */
export function publicTours(input:Project,pub:Project):Tour[]{
 return (input.tours??[]).filter(t=>t.visibility==='public').map(t=>({...t,stops:t.stops.map((s):TourStop=>{
  const view=s.viewId?pub.views.find(v=>v.id===s.viewId):undefined;
  if(s.omitted==='stop'||!s.viewId||!view)return {subjects:[],narration:'',omitted:'stop'};
  const kept=s.subjects.filter(x=>!!present(pub,s.viewId!,x)),lost=kept.length<s.subjects.length||s.omitted==='subjects';
  // Every subject private: the narration is about hidden content, so the stop is omitted like one on a private view.
  if(!kept.length&&s.subjects.length)return {subjects:[],narration:'',omitted:'stop'};
  const current=stopFingerprint(input,s.viewId,s.subjects)===s.fingerprint;
  return {viewId:s.viewId,subjects:kept,fingerprint:current?stopFingerprint(pub,s.viewId,kept)!:s.fingerprint,narration:s.narration,...(lost?{omitted:'subjects' as const}:{})};
 })}));
}
