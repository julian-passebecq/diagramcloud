import {clone,sameAgent,validateDocument,type Choice,type Project} from './model';
import {canonical,fnv64,targetFingerprint} from './learningMapping';
/**
 * Evidence-aware decisions. A choice may record `reviewBasis` (the document revision and a content fingerprint of the facts
 * it was reviewed against). Whether it needs review is derived here, on reading, by comparing that fingerprint with the
 * current facts: it is never stored, never re-bound automatically, and a choice without a basis is UNKNOWN, not current.
 * Reviewing and accepting are explicit human actions offered in Edit mode only.
 */
export type ChoiceOwner={kind:'node'|'view';id:string};
export type ChoiceReviewState='current'|'review-needed'|'not-reviewed';
export const CHOICE_REVIEW_LABELS:Record<ChoiceReviewState,string>={
 current:'Reviewed against the current facts',
 'review-needed':'Review needed · supporting facts changed',
 'not-reviewed':'No review recorded · whether its facts changed is UNKNOWN'
};
/** The choice and its owner (component or view), found by exact stable choice ID. */
export function findChoice(doc:Project,choiceId:string):{owner:ChoiceOwner;choice:Choice}|undefined{
 for(const n of doc.nodes){const c=n.choices?.find(c=>c.id===choiceId);if(c)return {owner:{kind:'node',id:n.id},choice:c};}
 for(const v of doc.views){const c=v.choices?.find(c=>c.id===choiceId);if(c)return {owner:{kind:'view',id:v.id},choice:c};}
 return undefined;
}
/**
 * Fingerprint of what a decision rests on: its owner's evidence (a component's kind, cited sources and evidence blocks, or a
 * view's membership), the decision's own cited sources, and its goal, options, reasons, tradeoffs, assumptions and selected
 * or recommended option. Who decided, when, origin, visibility and the review basis itself are not part of it.
 */
export function choiceFingerprint(doc:Project,owner:ChoiceOwner,choice:Choice):string|undefined{
 const ownerPrint=targetFingerprint(doc,owner);if(!ownerPrint)return undefined;
 const sources=[...choice.sourceIds].sort().map(id=>{const s=doc.sources.find(s=>s.id===id);return s?{id,title:s.title,location:s.location,url:s.url??null}:{id,missing:true};});
 const decision={goal:choice.goal,options:choice.options.map(o=>({id:o.id,label:o.label,summary:o.summary})),reasons:choice.reasons,tradeoffs:choice.tradeoffs,assumptions:choice.assumptions,
  chosenOptionId:choice.chosenOptionId??null,recommendedOptionId:choice.recommendedOptionId??null,revisitWhen:choice.revisitWhen??null};
 return fnv64(canonical({owner:{kind:owner.kind,id:owner.id,fingerprint:ownerPrint},choiceId:choice.id,sources,decision}));
}
export type ChoiceReview={state:ChoiceReviewState;label:string;reasons:string[];reviewedRevision?:number;currentRevision:number};
/** Derived review state with its reasons. Pure: reads the document, writes nothing. */
export function choiceReview(doc:Project,choiceId:string):ChoiceReview{
 const found=findChoice(doc,choiceId);if(!found)throw new Error(`Unknown choice ${choiceId}`);
 const {owner,choice}=found,basis=choice.reviewBasis,state=reviewState(doc,owner,choice);
 const facts=owner.kind==='node'?'the component’s kind, cited sources or evidence blocks':'the view’s components or connections';
 const reasons=state==='current'?[]:state==='not-reviewed'
  ?['No review basis is recorded, so whether its supporting facts changed cannot be checked (UNKNOWN). Review it in Edit mode to record one.']
  :[`Reviewed at document revision ${basis!.revision}; since then ${facts}, the decision’s cited sources, or its goal, options, reasons, tradeoffs or assumptions changed.`,'Nothing is re-bound automatically: review it again in Edit mode.'];
 return {state,label:CHOICE_REVIEW_LABELS[state],reasons,...(basis?{reviewedRevision:basis.revision}:{}),currentRevision:doc.revision};
}
function reviewState(doc:Project,owner:ChoiceOwner,choice:Choice):ChoiceReviewState{
 if(!choice.reviewBasis)return 'not-reviewed';
 return choiceFingerprint(doc,owner,choice)===choice.reviewBasis.fingerprint?'current':'review-needed';
}
const person=(name:string|undefined,what:string)=>{const v=(name??'').trim();if(!v)throw new Error(`${what} records who did it`);if(v.length>160)throw new Error(`${what}: a name has at most 160 characters`);return v;};
/**
 * Explicit review in Edit mode: binds the choice to the current facts (revision + fingerprint). An AI or imported
 * recommendation cannot review itself. The decision, its author and date are left unchanged.
 */
export function reviewChoice(input:Project,choiceId:string,{reviewedBy}:{reviewedBy:string}):Project{
 const reviewer=person(reviewedBy,'A review'),d=clone(input),found=findChoice(d,choiceId);if(!found)throw new Error(`Unknown choice ${choiceId}`);
 const {owner,choice}=found;
 if(choice.origin!=='author'&&sameAgent(reviewer,choice.suggestedBy))throw new Error(`A recommendation cannot review itself; a person other than ${choice.suggestedBy} reviews it in Edit mode`);
 choice.reviewBasis={revision:d.revision,fingerprint:choiceFingerprint(d,owner,choice)!};
 return validateDocument(d);
}
/**
 * Explicit acceptance in Edit mode of one existing option of a candidate. An accepted decision is never rewritten here:
 * changing it is a new decision, recorded on purpose (the JSON drawer and import review both report such a rewrite).
 */
export function acceptChoice(input:Project,choiceId:string,optionId:string,{decidedBy,decidedAt}:{decidedBy:string;decidedAt:string}):Project{
 const who=person(decidedBy,'An acceptance'),d=clone(input),found=findChoice(d,choiceId);if(!found)throw new Error(`Unknown choice ${choiceId}`);
 const {owner,choice}=found;
 if(choice.status==='accepted')throw new Error(`Choice “${choice.title}” is already an accepted decision (by ${choice.decidedBy} on ${choice.decidedAt}); it is not rewritten silently`);
 if(!choice.options.some(o=>o.id===optionId))throw new Error(`Unknown option ${optionId} in choice ${choiceId}`);
 Object.assign(choice,{status:'accepted',chosenOptionId:optionId,decidedBy:who,decidedAt});
 choice.reviewBasis={revision:d.revision,fingerprint:choiceFingerprint(d,owner,choice)!};
 return validateDocument(d);
}
/**
 * Public projection of review bases, called by publicDocument once the public closure is known: a review that is current
 * in authoring is re-fingerprinted against the public facts (so it reads current there too); any other basis is dropped,
 * so a public copy never hints at what private facts changed.
 */
export function publicChoiceReviews(input:Project,out:Project):void{
 for(const owner of [...out.nodes.map(n=>({kind:'node' as const,item:n})),...out.views.map(v=>({kind:'view' as const,item:v}))])for(const c of owner.item.choices??[]){
  if(!c.reviewBasis)continue;
  const source=findChoice(input,c.id),ref={kind:owner.kind,id:owner.item.id};
  const current=source&&source.owner.kind===ref.kind&&source.owner.id===ref.id&&reviewState(input,source.owner,source.choice)==='current';
  const fingerprint=current?choiceFingerprint(out,ref,c):undefined;
  if(fingerprint)c.reviewBasis={revision:c.reviewBasis.revision,fingerprint};else delete c.reviewBasis;
 }
}
/** Import cautions: a review basis that arrives or changes in an incoming document was not recorded by this author here. */
export function reviewBasisCautions(current:Project,incoming:Project):string[]{
 const out:string[]=[];
 for(const owner of [...incoming.nodes,...incoming.views])for(const c of owner.choices??[]){
  if(!c.reviewBasis)continue;const was=findChoice(current,c.id)?.choice.reviewBasis;
  if(!was||was.revision!==c.reviewBasis.revision||was.fingerprint!==c.reviewBasis.fingerprint)out.push(`Choice “${c.title}” ${was?'changes its':'arrives with a'} review basis (revision ${c.reviewBasis.revision}); a review is the author’s. Review it yourself in Edit mode.`);
 }
 return out;
}
