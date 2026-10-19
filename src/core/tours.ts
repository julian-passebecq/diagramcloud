import {canonical,fnv64} from './learningMapping';
import {tourSchema,tourStopSchema,validateDocument,type Project,type Tour,type TourStop} from './model';

/**
 * Tours: a presented sequence of stops over stable subjects, never timing and never a run. A stop stores its selected
 * view, the stable IDs of its subjects, a content fingerprint taken when it was recorded, and narration. Reading a tour
 * derives each anchor's state against the document it is read from: current, stale (content changed since recording),
 * missing (view or subject gone or not visible here) or omitted (removed from a public copy, and said so). Nothing is
 * repaired silently: a stale or missing anchor fails visibly and the author re-records it.
 *
 * Two fingerprints. `fingerprint` covers the selected view's id and title and each subject's own object (unchanged since
 * stops existed; stop IDs and legacy Resume keys derive from it, so it never changes meaning). `referencedFingerprint`
 * covers the reference closure of the subjects, the content a narration explains without it being on the card:
 *  - every evidence block named in a subject component's `blockIds`, with its full content (code, table rows, text,
 *    metrics, schedule, caption, provenance, visibility);
 *  - every source named in a subject component's `sourceIds` or in one of those blocks' `sourceIds` (title, location, URL, visibility);
 *  - every image asset of an image block in the closure and a subject component's `customIconAssetId`.
 * Each reference is recorded by ID, with null when it does not resolve in the document read, so a removed or revoked
 * reference changes it. Connections carry no block or source references (their quantity is part of the connection).
 * Not covered: choice citations and compatibility evidence, observations, concept mappings and child views.
 * A stop recorded before `referencedFingerprint` existed keeps its old comparison and reads `coverage: 'subjects-only'`
 * with a note that its referenced content is not covered; it is never re-recorded automatically (only an explicit
 * Re-record adds the field). A narration edit keeps the stop's record as it is.
 */
export type TourSubject={kind:'node'|'edge';id:string};
export type StopStatus='current'|'stale'|'missing'|'omitted';
/** Whether the stop's record covers the content its subjects reference (`full`) or only the subjects themselves (a legacy stop). */
export type StopCoverage='full'|'subjects-only';
export type StopState={index:number;status:StopStatus;viewId?:string;subjects:TourSubject[];narration:string;message:string;note?:string;missing:TourSubject[];coverage?:StopCoverage;coverageNote?:string};
export const REFERENCES_NOT_COVERED='Referenced content not covered by this stop\'s record: evidence, code, tables, sources or images its subjects cite may have changed since it was recorded. Re-record the stop to cover them.';
export const TOUR_LABEL='Presented sequence - not a run, not timing';

const present=(doc:Project,viewId:string,s:TourSubject)=>{const view=doc.views.find(v=>v.id===viewId);if(!view)return undefined;
 return s.kind==='node'?(view.nodeIds.includes(s.id)?doc.nodes.find(n=>n.id===s.id):undefined):(view.edgeIds.includes(s.id)?doc.edges.find(e=>e.id===s.id):undefined);};
/** Content fingerprint of a stop: the selected view's title and each subject's full content. Positions are camera, not content. Undefined when an anchor is absent. */
export function stopFingerprint(doc:Project,viewId:string,subjects:TourSubject[]):string|undefined{
 const view=doc.views.find(v=>v.id===viewId);if(!view)return undefined;
 const items=subjects.map(s=>present(doc,viewId,s));if(items.some(x=>!x))return undefined;
 return fnv64(canonical({view:{id:view.id,title:view.title},subjects:subjects.map((s,i)=>({kind:s.kind,item:items[i]}))}));
}
/** Fingerprint of the reference closure of a stop's subjects (header comment). Undefined when an anchor is absent. */
export function referencedFingerprint(doc:Project,viewId:string,subjects:TourSubject[]):string|undefined{
 if(!doc.views.some(v=>v.id===viewId))return undefined;
 if(subjects.some(s=>!present(doc,viewId,s)))return undefined;
 const nodes=subjects.flatMap(s=>s.kind==='node'?[doc.nodes.find(n=>n.id===s.id)!]:[]);
 const blockIds=[...new Set(nodes.flatMap(n=>n.blockIds))].sort(),blocks=blockIds.map(id=>doc.blocks.find(b=>b.id===id)??null);
 const sourceIds=[...new Set([...nodes.flatMap(n=>n.sourceIds),...blocks.flatMap(b=>b?.sourceIds??[])])].sort();
 const assetIds=[...new Set([...nodes.flatMap(n=>n.customIconAssetId?[n.customIconAssetId]:[]),...blocks.flatMap(b=>b?.type==='image'?[b.assetId]:[])])].sort();
 return fnv64(canonical({
  blocks:blockIds.map((id,i)=>({id,item:blocks[i]})),
  sources:sourceIds.map(id=>({id,item:doc.sources.find(s=>s.id===id)??null})),
  assets:assetIds.map(id=>({id,item:doc.assets.find(a=>a.id===id)??null}))}));
}
/** Record a stop on the current content: both fingerprints. Throws when a subject is not in the selected view. */
export function recordStop(doc:Project,viewId:string,subjects:TourSubject[],narration:string):TourStop{
 if(!doc.views.some(v=>v.id===viewId))throw new Error(`Unknown view ${viewId}.`);
 const absent=subjects.filter(s=>!present(doc,viewId,s));if(absent.length)throw new Error(`Not in view ${viewId}: ${absent.map(s=>s.id).join(', ')}.`);
 return tourStopSchema.parse({viewId,subjects,fingerprint:stopFingerprint(doc,viewId,subjects),referencedFingerprint:referencedFingerprint(doc,viewId,subjects),narration});
}
/**
 * A stop ID unused in `stops`, derived from the stop's recorded content (view, subjects, fingerprint, narration), and
 * stable once assigned: moving or editing a stop never renames it. A position counter is not used, so removing a stop
 * and adding another never hands the removed stop's ID to different content.
 */
export function newStopId(stops:readonly TourStop[],stop:TourStop):string{
 const used=new Set(stops.flatMap(s=>s.id?[s.id]:[])),base='stop-'+fnv64(canonical({viewId:stop.viewId??null,subjects:stop.subjects,fingerprint:stop.fingerprint??null,narration:stop.narration})).slice(0,10);
 let id=base;for(let n=2;used.has(id);n++)id=`${base}-${n}`;return id;
}
const withId=(stops:readonly TourStop[],stop:TourStop):TourStop=>stop.id||stop.omitted==='stop'?stop:{id:newStopId(stops,stop),...stop};
/** A new tour recorded at the document's current revision; one validated document, committed by the caller as one revision. */
export function addTour(doc:Project,input:{id:string;title:string;visibility?:'public'|'private';stop:TourStop}):Project{
 if((doc.tours??[]).some(t=>t.id===input.id))throw new Error(`A tour ${input.id} already exists.`);
 const tour=tourSchema.parse({id:input.id,title:input.title,sourceRevision:doc.revision,stops:[withId([],input.stop)],visibility:input.visibility??'private'});
 return validateDocument({...doc,tours:[...(doc.tours??[]),tour]});
}
export function addTourStop(doc:Project,tourId:string,stop:TourStop):Project{
 if(!(doc.tours??[]).some(t=>t.id===tourId))throw new Error(`No tour ${tourId}.`);
 return validateDocument({...doc,tours:doc.tours!.map(t=>t.id===tourId?{...t,stops:[...t.stops,withId(t.stops,stop)]}:t)});
}
export function removeTour(doc:Project,tourId:string):Project{
 const tours=(doc.tours??[]).filter(t=>t.id!==tourId),next:Project={...doc,tours};if(!tours.length)delete next.tours;return validateDocument(next);
}

/**
 * Ordinary stop edits. Each returns one validated document the caller commits as one revision (one Undo). The caller
 * names the stop by its position and the exact stop it saw (`expected`); when the live tour no longer has that stop at
 * that position (another edit, another tab, an Undo) the edit is refused and nothing changes. A stop keeps its ID.
 */
export const TOUR_STOP_CHANGED='The tour changed since this stop was shown. Nothing was changed; reopen the stop and try again.';
function editStops(doc:Project,tourId:string,index:number,expected:TourStop,f:(stops:TourStop[])=>TourStop[]):Project{
 const tour=(doc.tours??[]).find(t=>t.id===tourId);if(!tour)throw new Error(`No tour ${tourId}.`);
 if(!tour.stops[index]||canonical(tour.stops[index])!==canonical(expected))throw new Error(TOUR_STOP_CHANGED);
 return validateDocument({...doc,tours:doc.tours!.map(t=>t.id===tourId?{...t,stops:f([...t.stops])}:t)});
}
/** Change a stop's narration, and optionally re-record its view and subjects on the current content (a new fingerprint). */
export function updateTourStop(doc:Project,tourId:string,index:number,expected:TourStop,change:{narration?:string;rerecord?:{viewId:string;subjects:TourSubject[]}}):Project{
 if(expected.omitted)throw new Error('An omitted stop cannot be edited.');
 return editStops(doc,tourId,index,expected,stops=>{const s=stops[index],narration=change.narration??s.narration;
  const next=change.rerecord?recordStop(doc,change.rerecord.viewId,change.rerecord.subjects,narration):tourStopSchema.parse({...s,narration});
  stops[index]={...next,...(s.id?{id:s.id}:{})};return stops;});
}
/** Move a stop one place earlier (-1) or later (+1). */
export function moveTourStop(doc:Project,tourId:string,index:number,expected:TourStop,delta:-1|1):Project{
 return editStops(doc,tourId,index,expected,stops=>{const to=index+delta;if(to<0||to>=stops.length)throw new Error('This stop cannot move further.');[stops[index],stops[to]]=[stops[to],stops[index]];return stops;});
}
/** Remove one stop. A tour keeps at least one stop: remove the tour instead. */
export function removeTourStop(doc:Project,tourId:string,index:number,expected:TourStop):Project{
 return editStops(doc,tourId,index,expected,stops=>{if(stops.length<=1)throw new Error('A tour keeps at least one stop. Remove the tour instead.');stops.splice(index,1);return stops;});
}

/** Each stop's anchor state in this document (authoring, or a public copy). Pure: reading a tour changes nothing. */
export function tourStops(doc:Project,tour:Tour):StopState[]{
 return tour.stops.map((s,index)=>{
  const base:Omit<StopState,'status'|'message'>={index,viewId:s.viewId,subjects:s.subjects,narration:s.narration,missing:[],...(s.omitted==='subjects'?{note:'Some subjects of this stop are not public and are omitted from this copy.'}:{})};
  if(s.omitted==='stop'||!s.viewId)return {...base,status:'omitted' as const,message:'This stop is not public and is omitted from this copy.'};
  Object.assign(base,s.referencedFingerprint?{coverage:'full'}:{coverage:'subjects-only',coverageNote:REFERENCES_NOT_COVERED});
  if(!doc.views.some(v=>v.id===s.viewId))return {...base,status:'missing' as const,message:`Anchor missing: view ${s.viewId} is not available here. This stop cannot be shown.`};
  const missing=s.subjects.filter(x=>!present(doc,s.viewId!,x));
  if(missing.length)return {...base,missing,status:'missing' as const,message:`Anchor missing: ${missing.map(x=>`${x.kind==='node'?'component':'connection'} ${x.id}`).join(', ')} ${missing.length===1?'is':'are'} no longer in view ${s.viewId}. This stop cannot be shown as recorded.`};
  if(stopFingerprint(doc,s.viewId,s.subjects)!==s.fingerprint)return {...base,status:'stale' as const,message:`Anchor stale: the content changed after this tour was recorded at revision ${tour.sourceRevision} (now revision ${doc.revision}). Check the narration and re-record the stop.`};
  if(s.referencedFingerprint&&referencedFingerprint(doc,s.viewId,s.subjects)!==s.referencedFingerprint)return {...base,status:'stale' as const,message:`Anchor stale: content its subjects reference (evidence, code, tables, sources or images) changed after this tour was recorded at revision ${tour.sourceRevision} (now revision ${doc.revision}). Check the narration and re-record the stop.`};
  return {...base,status:'current' as const,message:''};
 });
}

/** The public copy's referenced fingerprint: recomputed on the public document, never the recorded (possibly private) hash. */
function publicReferenced(input:Project,pub:Project,s:TourStop,kept:TourSubject[]):{referencedFingerprint?:string}{
 if(!s.referencedFingerprint||!s.viewId)return {};
 const shown=referencedFingerprint(pub,s.viewId,kept)!;
 if(referencedFingerprint(input,s.viewId,s.subjects)===s.referencedFingerprint)return {referencedFingerprint:shown};
 // Stale in authoring: a value derived from the public content only that cannot equal it, so the copy reads stale too.
 return {referencedFingerprint:fnv64(canonical({superseded:shown}))};
}
/**
 * Public projection, called by publicDocument once the public closure is known. Only public tours. A stop whose view is
 * not public, or whose subjects are all not public, becomes an omitted stop with no view, subjects or narration; a subject that is not public is dropped and the
 * stop says some subjects are omitted, without naming or counting them. Its narration is omitted too, because
 * free text cannot be separated safely into public and private parts. A stop current in authoring carries the
 * fingerprint of its public content; a stale one keeps its recorded fingerprint, so it reads stale in the copy too.
 * A shown stop keeps its stable ID, so a reader can resume it; an omitted stop keeps none.
 * The referenced fingerprint is never copied: it may cover private blocks, sources or images. It is recomputed on the
 * public document (`publicReferenced`), so the public copy carries a hash of public content only, and the number of
 * private references makes no difference. A legacy stop stays without one (not covered) in the copy too.
 */
export function publicTours(input:Project,pub:Project):Tour[]{
 return (input.tours??[]).filter(t=>t.visibility==='public').map(t=>({...t,stops:t.stops.map((s):TourStop=>{
  const view=s.viewId?pub.views.find(v=>v.id===s.viewId):undefined;
  if(s.omitted==='stop'||!s.viewId||!view)return {subjects:[],narration:'',omitted:'stop'};
  const kept=s.subjects.filter(x=>!!present(pub,s.viewId!,x)),lost=kept.length<s.subjects.length||s.omitted==='subjects';
  // Every subject private: the narration is about hidden content, so the stop is omitted like one on a private view.
  if(!kept.length&&s.subjects.length)return {subjects:[],narration:'',omitted:'stop'};
  const current=stopFingerprint(input,s.viewId,s.subjects)===s.fingerprint;
  return {...(s.id?{id:s.id}:{}),viewId:s.viewId,subjects:kept,fingerprint:current?stopFingerprint(pub,s.viewId,kept)!:s.fingerprint,...publicReferenced(input,pub,s,kept),narration:lost?'':s.narration,...(lost?{omitted:'subjects' as const}:{})};
 })}));
}
