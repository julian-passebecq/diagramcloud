import {PATCH_FORMAT,type Patch} from './patch';
import type {Observation,Project} from './model';

/**
 * Three meanings kept apart in content and UI (see the observation contract in model.ts):
 * Planned/Designed is architecture intent; Observed/Verified is a dated external snapshot owned by another app;
 * Presented is reviewed material the author selected for the story or portfolio. Presenting an observation never
 * changes its claim or its authority, and a design status colour never means deployed or business-validated.
 */
export const MEANING={
 designed:{label:'Planned / designed',help:'Architecture intent. The status colour is an illustrative design state, not a deployment or business result.'},
 observed:{label:'Observed / verified',help:'A dated snapshot from another app at a named revision. It states what that source saw then, nothing more.'},
 presented:{label:'Presented',help:'Reviewed by the author and selected for the story or public portfolio. Presenting does not change who owns the fact.'}
} as const;
export const CLAIM_LABEL:Record<Observation['claim'],string>={observed:'Observed',verified:'Verified',partial:'Partly observed','not-observed':'Not observed'};
export const STATUS_NOTE='Design status is illustrative: it is not a deployment, test or business-validation claim.';

export const day=(iso:string)=>iso.slice(0,10);
export const isPresented=(o:Observation)=>o.visibility==='public'&&!!o.reviewedAt;

/** A component's observations, newest first. */
export function observationsFor(doc:Pick<Project,'observations'>,nodeId:string):Observation[]{
 return doc.observations.filter(o=>o.nodeId===nodeId).sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt));
}

export type Realization={state:'designed'|Observation['claim'];latest?:Observation;count:number;presented:boolean;text:string;title:string};
export function realizationOf(doc:Pick<Project,'observations'>,nodeId:string):Realization{
 const list=observationsFor(doc,nodeId),latest=list[0],presented=list.some(isPresented);
 if(!latest)return {state:'designed',count:0,presented:false,text:'Designed',title:`${MEANING.designed.label}: ${MEANING.designed.help}`};
 return {state:latest.claim,latest,count:list.length,presented,text:`${CLAIM_LABEL[latest.claim]} · ${day(latest.observedAt)}`,
  title:`${CLAIM_LABEL[latest.claim]} by ${latest.sourceApp} (authority: ${latest.authority}) at revision ${latest.sourceRevision}, ${latest.observedAt}.${latest.reviewedAt?'':' Not reviewed yet.'}${latest.caveat?` Caveat: ${latest.caveat}`:''}`};
}

/** What another app sends: the fact and its provenance. Review, visibility and sharing are the author's decisions. */
export type ObservationInput=Pick<Observation,'id'|'nodeId'|'sourceApp'|'authority'|'observedAt'|'sourceRevision'|'claim'|'summary'>&{link?:string;caveat?:string;blockIds?:string[]};

/**
 * A revision-guarded patch that adds one observation, for DataPass VS Code, an operator script or a test. It goes
 * through the normal JSON / AI review; the observation arrives private, unreviewed and not shareable.
 */
export function observationPatch(doc:Pick<Project,'id'|'revision'>,input:ObservationInput):Patch{
 const value={...input,blockIds:input.blockIds??[],caveat:input.caveat??'',visibility:'private',shareable:false};
 return {format:PATCH_FORMAT,version:1,target:'project',targetId:doc.id,baseRevision:doc.revision,
  summary:`Add a ${input.sourceApp} observation for ${input.nodeId} (${input.claim}, revision ${input.sourceRevision})`,
  operations:[{op:'test',path:`/nodes/@${input.nodeId}/id`,value:input.nodeId},{op:'add',path:'/observations/-',value}]};
}

/**
 * Export grammar for realization. Exports show only Presented observations (reviewed and public): a badge on the
 * component, the full provenance in notes or an appendix. Colours never use green, because a verified claim is
 * the source app's statement, not a DiagramCloud validation.
 */
export const CLAIM_BADGE:Record<Observation['claim'],{text:string;fill:string;stroke:string;ink:string}>={
 observed:{text:'Observed',fill:'E8F0FE',stroke:'2563EB',ink:'1D4ED8'},
 verified:{text:'Verified',fill:'E0E7FF',stroke:'3730A3',ink:'312E81'},
 partial:{text:'Partial',fill:'FEF3C7',stroke:'B45309',ink:'92400E'},
 'not-observed':{text:'Not observed',fill:'F1F5F9',stroke:'64748B',ink:'475569'}
};
export const REALIZATION_EXPORT_NOTE='Badges show reviewed, public observations owned by other apps; unbadged components are planned / designed only. Design status is illustrative.';
/** The newest Presented observation about a component, if any. */
export function presentedObservation(doc:Pick<Project,'observations'>,nodeId:string):Observation|undefined{
 return observationsFor(doc,nodeId).find(isPresented);
}
/** Every Presented observation, newest first: what an appendix or notes may cite. */
export function presentedObservations(doc:Pick<Project,'observations'>):Observation[]{
 return doc.observations.filter(isPresented).sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt));
}
/** One plain-text line with the claim, its owner, the revision and the date. */
export function observationLine(o:Observation,component:string):string{
 return `${component}: ${CLAIM_LABEL[o.claim]} by ${o.sourceApp} (authority: ${o.authority}) at revision ${o.sourceRevision}, observed ${day(o.observedAt)}. ${o.summary}${o.caveat?` Caveat: ${o.caveat}`:''}`;
}
