import {validateDocument,type Project} from '../core/model';
import {applyDocumentPatch,type Patch} from '../core/patch';
import {prepareExplanationWalkthrough,walkthroughFingerprint,readExplanationWalkthrough,reviseExplanationWalkthrough,removeExplanationWalkthrough,type ExplanationWalkthrough,type WalkthroughRemoval} from './explanationWalkthrough';

export type ExplanationBasis=Readonly<{projectId:string;revision:number;fingerprint:string}>;
export type ExplanationDraft=Pick<ExplanationWalkthrough,'id'|'title'|'question'|'sourceIds'|'steps'>;
export type ExplanationStep=ExplanationDraft['steps'][number];
export const EXPLANATION_SOURCE_CHANGED='The explanation source changed. Download this draft before closing, then open a new draft against the current project. Nothing was applied.';

/** Capture once when the form opens. Never silently rebind authored text to new source. */
export function explanationBasis(project:Project):ExplanationBasis{
 const doc=validateDocument(project);
 return Object.freeze({projectId:doc.id,revision:doc.revision,fingerprint:walkthroughFingerprint(doc)});
}
export function explanationSourceMatches(project:Project,basis:ExplanationBasis):boolean{
 return project.id===basis.projectId&&project.revision===basis.revision&&walkthroughFingerprint(project)===basis.fingerprint;
}
export function newExplanationStep(existing:readonly ExplanationStep[],viewId:string):ExplanationStep{
 // A deleted prerequisite remains an unresolved identity, never a name for a newly added step.
 const reserved=new Set(existing.flatMap(step=>[step.id,...step.dependsOn]));
 let n=1;while(reserved.has(`step-${n}`))n++;
 return {id:`step-${n}`,title:'',viewId,nodeIds:[],edgeIds:[],narration:'',sourceIds:[],provenance:'synthetic',dependsOn:[],before:[],after:[],takeaway:'',questions:[]};
}
export function newExplanationDraft(project:Project,viewId:string,selectedNodeId:string|null):ExplanationDraft{
 const view=project.views.find(v=>v.id===viewId)??project.views.find(v=>v.id===project.rootViewId)!;
 const step=newExplanationStep([],view.id);
 if(selectedNodeId&&view.nodeIds.includes(selectedNodeId))step.nodeIds=[selectedNodeId];
 let id='explanation',n=2;while(project.nodes.some(node=>node.id===`walk-${id}`))id=`explanation-${n++}`;
 return {id,title:'',question:'',sourceIds:[],steps:[step]};
}
/** Changing a step's view clears view-bound choices, but never invents equivalent subjects. */
export function explanationStepInView(step:ExplanationStep,viewId:string):ExplanationStep{
 const {code:_,...rest}=step;return {...rest,viewId,nodeIds:[],edgeIds:[]};
}
/** Download may preserve an incomplete/stale author draft. It is not a validated Project or a save receipt. */
export function explanationRequest(basis:ExplanationBasis,draft:ExplanationDraft){
 return {...draft,format:'diagramcloud.explanation-walkthrough' as const,version:1 as const,projectId:basis.projectId,baseRevision:basis.revision,baseFingerprint:basis.fingerprint};
}
export function prepareExplanationDraft(project:Project,basis:ExplanationBasis,draft:ExplanationDraft){
 if(!explanationSourceMatches(project,basis))throw new Error(EXPLANATION_SOURCE_CHANGED);
 return prepareExplanationWalkthrough(project,explanationRequest(basis,draft));
}

/** Reopen an applied walkthrough as a form draft bound to the current full source. Refuses rather than guesses (see readExplanationWalkthrough). */
export function startExplanationRevision(project:Project,walkthroughId:string):{basis:ExplanationBasis;draft:ExplanationDraft}{
 const {request}=readExplanationWalkthrough(project,walkthroughId),basis=explanationBasis(project);
 const {id,title,question,sourceIds,steps}=structuredClone(request);
 return {basis,draft:{id,title,question,sourceIds,steps}};
}
/** Review a revised draft: one replace patch over exactly that walkthrough's generated content. The walkthrough ID cannot change here. */
export function prepareExplanationRevision(project:Project,basis:ExplanationBasis,draft:ExplanationDraft,walkthroughId:string){
 if(!explanationSourceMatches(project,basis))throw new Error(EXPLANATION_SOURCE_CHANGED);
 if(draft.id!==walkthroughId)throw new Error(`A revision keeps its walkthrough ID (${walkthroughId}). Author a new explanation for another ID; nothing was applied.`);
 return reviseExplanationWalkthrough(project,explanationRequest(basis,draft));
}
/** Review the removal of one applied walkthrough, bound to the current full source. */
export function prepareExplanationRemoval(project:Project,walkthroughId:string):{basis:ExplanationBasis;result:WalkthroughRemoval}{
 return {basis:explanationBasis(project),result:removeExplanationWalkthrough(project,walkthroughId)};
}

/** The effect boundary repeats the full-source guard, then uses the ordinary patch validator. */
export function applyPreparedExplanation(project:Project,basis:ExplanationBasis,patch:Patch):Project{
 if(!explanationSourceMatches(project,basis))throw new Error(EXPLANATION_SOURCE_CHANGED);
 return applyDocumentPatch(project,patch).result;
}
