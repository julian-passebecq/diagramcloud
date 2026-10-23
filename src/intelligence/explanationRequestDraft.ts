import {validateDocument,type Project} from '../core/model';
import {applyDocumentPatch,type Patch} from '../core/patch';
import {prepareExplanationWalkthrough,walkthroughFingerprint,type ExplanationWalkthrough} from './explanationWalkthrough';

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
 let n=1;while(existing.some(step=>step.id===`step-${n}`))n++;
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

/** The effect boundary repeats the full-source guard, then uses the ordinary patch validator. */
export function applyPreparedExplanation(project:Project,basis:ExplanationBasis,patch:Patch):Project{
 if(!explanationSourceMatches(project,basis))throw new Error(EXPLANATION_SOURCE_CHANGED);
 return applyDocumentPatch(project,patch).result;
}
