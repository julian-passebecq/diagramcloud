import {canonical,fnv64} from './learningMapping';
import {errorMessage,validateDocument,variantSchema,type Project,type Variant} from './model';
import {applyDocumentPatch,applyOperations,PATCH_FORMAT,type Operation,type Patch} from './patch';
import {previewDocumentChange,type DocumentChangePreview} from './changePreview';
import {compareView,type ViewDelta} from '../export/design/delta';

/**
 * Baseline-bound variants: a named change set against a known baseline of one view, never a drifting duplicate
 * diagram. The baseline is the project revision plus a content fingerprint of the view, its members and every item the
 * operations address. Selecting a variant derives its state and a comparison (the architecture delta) and changes
 * nothing. Apply is refused unless the baseline still matches; it runs the variant through the revision-guarded
 * `diagramcloud.patch` path and removes the variant in the same revision, so one Undo restores both. A changed baseline
 * makes the variant stale: comparison and Apply stay refused until the author explicitly rebases it.
 */
export type VariantStatus='current'|'stale'|'broken';
export type VariantState={variant:Variant;status:VariantStatus;message:string;candidate?:Project};
export type VariantSelection={state:VariantState;delta?:ViewDelta;preview?:DocumentChangePreview;refused?:string};
export const VARIANT_SELECT_NOTE='Selecting a variant compares it with its baseline. Nothing is accepted or applied.';

const addressed=(operations:Operation[],kind:'nodes'|'edges')=>operations.flatMap(o=>{const m=/^\/(nodes|edges)\/@([^/]+)/.exec(o.path);return m&&m[1]===kind?[m[2]]:[];});
/** Content fingerprint of a variant's baseline. Undefined when the view no longer exists. */
export function variantFingerprint(doc:Project,viewId:string,operations:Operation[]):string|undefined{
 const view=doc.views.find(v=>v.id===viewId);if(!view)return undefined;
 const nodeIds=[...new Set([...view.nodeIds,...addressed(operations,'nodes')])].sort(),edgeIds=[...new Set([...view.edgeIds,...addressed(operations,'edges')])].sort();
 return fnv64(canonical({view,nodes:nodeIds.map(id=>doc.nodes.find(n=>n.id===id)??{id,missing:true}),edges:edgeIds.map(id=>doc.edges.find(e=>e.id===id)??{id,missing:true})}));
}
const find=(doc:Project,id:string)=>{const v=doc.variants?.find(v=>v.id===id);if(!v)throw new Error(`No variant ${id} in this project.`);return v;};
const without=(doc:Project,id:string):Project=>{const variants=(doc.variants??[]).filter(v=>v.id!==id),next:Project={...doc,variants};if(!variants.length)delete next.variants;return next;};
/** The document this variant would produce on the current content (without the variant itself). Throws when it cannot apply. */
function candidateOf(doc:Project,v:Variant):Project{return validateDocument(applyOperations(without(doc,v.id),v.operations as Operation[]));}

/** A new variant recorded against the current baseline. Its operations must apply now; the result is one validated document. */
export function addVariant(doc:Project,input:{id:string;title:string;summary?:string;viewId:string;operations:unknown;origin?:Variant['origin'];suggestedBy?:string}):Project{
 if(doc.variants?.some(v=>v.id===input.id))throw new Error(`A variant ${input.id} already exists.`);
 if(!doc.views.some(v=>v.id===input.viewId))throw new Error(`Unknown view ${input.viewId}.`);
 const draft=variantSchema.parse({...input,base:{revision:doc.revision,fingerprint:'0000000000000000'}});
 const variant={...draft,base:{revision:doc.revision,fingerprint:variantFingerprint(doc,draft.viewId,draft.operations as Operation[])!}};
 const next=validateDocument({...doc,variants:[...(doc.variants??[]),variant]});
 try{candidateOf(next,variant);}catch(e){throw new Error(`The variant does not apply to the current baseline: ${errorMessage(e)}`);}
 return next;
}

/** Derived state: current, stale (baseline changed) or broken (operations no longer apply). Pure. */
export function variantState(doc:Project,id:string):VariantState{
 const variant=find(doc,id),fingerprint=variantFingerprint(doc,variant.viewId,variant.operations as Operation[]);
 if(fingerprint!==variant.base.fingerprint)return {variant,status:'stale',message:`Stale baseline: written against revision ${variant.base.revision}, and ${fingerprint?`view ${variant.viewId} or an item it changes is different now`:`view ${variant.viewId} no longer exists`} (revision ${doc.revision}). Comparison and Apply are refused until you rebase it explicitly.`};
 try{return {variant,status:'current',message:`Baseline current: written against revision ${variant.base.revision}; view ${variant.viewId} and the items it changes are unchanged.`,candidate:candidateOf(doc,variant)};}
 catch(e){return {variant,status:'broken',message:`Cannot apply: ${errorMessage(e)}`};}
}

/** Select = compare only. Returns the delta and the change preview of applying; never mutates or accepts anything. */
export function selectVariant(doc:Project,id:string,options:{audience?:'public'|'author';now?:Date}={}):VariantSelection{
 const state=variantState(doc,id);
 if(state.status!=='current'||!state.candidate)return {state,refused:state.message};
 try{return {state,delta:compareView(doc,state.candidate,state.variant.viewId,options.now??new Date(),options.audience??'author'),preview:previewDocumentChange(doc,applyVariant(doc,id))};}
 catch(e){return {state,refused:errorMessage(e)};}
}

/** The revision-guarded patch equivalent to applying a variant: its operations, then the variant's removal. */
export function variantPatch(doc:Project,id:string):Patch{
 const v=find(doc,id),remove:Operation=doc.variants!.length===1?{op:'remove',path:'/variants'}:{op:'remove',path:`/variants/@${id}`};
 return {format:PATCH_FORMAT,version:1,target:'project',targetId:doc.id,baseRevision:doc.revision,summary:`Apply variant ${v.title}`,operations:[...v.operations as Operation[],remove]};
}
/** Apply on the live document: refused unless the baseline is current. The caller commits the result as one undoable revision. */
export function applyVariant(doc:Project,id:string):Project{
 const state=variantState(doc,id);
 if(state.status!=='current')throw new Error(`Refused: ${state.message} Nothing was applied.`);
 return applyDocumentPatch(doc,variantPatch(doc,id)).result;
}
/** Explicit rebase: the author re-records the baseline on the current content after checking the operations still apply. */
export function rebaseVariant(doc:Project,id:string):Project{
 const v=find(doc,id),fingerprint=variantFingerprint(doc,v.viewId,v.operations as Operation[]);
 if(!fingerprint)throw new Error(`Cannot rebase: view ${v.viewId} no longer exists.`);
 try{candidateOf(doc,v);}catch(e){throw new Error(`Cannot rebase: the operations no longer apply (${errorMessage(e)}). Discard the variant or write a new one.`);}
 return validateDocument({...doc,variants:doc.variants!.map(x=>x.id===id?{...x,base:{revision:doc.revision,fingerprint}}:x)});
}
/**
 * Replace a current variant's operations (a visual edit of the variant), as one ordinary revision. Refused on a stale or
 * broken variant, and when the new operations do not apply; the baseline is re-recorded on the current content.
 */
export function reviseVariant(doc:Project,id:string,operations:unknown):Project{
 const state=variantState(doc,id);
 if(state.status!=='current')throw new Error(`Cannot revise: ${state.message}`);
 const parsed=variantSchema.parse({...state.variant,operations}),ops=parsed.operations as Operation[],fingerprint=variantFingerprint(doc,parsed.viewId,ops)!;
 const next=validateDocument({...doc,variants:doc.variants!.map(x=>x.id===id?{...parsed,base:{revision:doc.revision,fingerprint}}:x)});
 try{candidateOf(next,variantState(next,id).variant);}catch(e){throw new Error(`The revised variant does not apply to the current baseline: ${errorMessage(e)}`);}
 return next;
}
export function discardVariant(doc:Project,id:string):Project{find(doc,id);return validateDocument(without(doc,id));}
