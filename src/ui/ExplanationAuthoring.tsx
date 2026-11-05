import {useEffect,useMemo,useRef,useState} from 'react';
import {errorMessage,validateDocument,type Project} from '../core/model';
import type {Patch} from '../core/patch';
import {previewDocumentChange} from '../core/changePreview';
import {describeChanges} from '../core/changeDetail';
import {ChangePreview,Modal} from '../app/ReviewShell';
import {ChangeDetailView} from './ChangeDetail';
import {download} from '../export/browser';
import {ExplanationRequestDialog,type ExplanationDraftSession} from './ExplanationRequestDialog';
import {explanationSourceMatches,prepareExplanationDraft,prepareExplanationRevision,prepareExplanationRemoval,startExplanationRevision,applyPreparedExplanation,EXPLANATION_SOURCE_CHANGED,type ExplanationBasis} from '../intelligence/explanationRequestDraft';
import {listExplanationWalkthroughs,type RevisionEffects} from '../intelligence/explanationWalkthrough';

type Props={doc:Project;edit:boolean;viewId:string;selectedNodeId:string|null;live:()=>Project;onCommit:(next:Project)=>boolean};
type Kind='author'|'revise'|'remove';
type Review={kind:Kind;basis:ExplanationBasis;source:Project;result:{patch:Patch;preview:Project;notice:string;effects?:RevisionEffects}};
const TITLES:Record<Kind,string>={author:'Review authored explanation',revise:'Review revised explanation',remove:'Review explanation removal'};
const APPLY:Record<Kind,string>={author:'Apply explanation',revise:'Apply revised explanation',remove:'Apply removal'};
const list=(ids:string[])=>ids.join(', ');

/** What a revision or removal does beyond its own generated content, stated before Apply. */
function Effects({effects}:{effects:RevisionEffects}){
 return <ul className="explanation-effects" aria-label="Effects of this change">
  {effects.kind==='revise'&&<li>Replaces exactly this walkthrough's generated cards, evidence, frames and tour. Kept steps: {list(effects.keptSteps)||'none'}.{effects.addedSteps.length?` Added: ${list(effects.addedSteps)}.`:''}{effects.droppedSteps.length?` Removed: ${list(effects.droppedSteps)}.`:''}</li>}
  {effects.kind==='remove'&&<li>Removes exactly this walkthrough's generated cards, evidence, frames, tour and entry card. Original components, connections and evidence are unchanged.</li>}
  {effects.staleAnswerIds.length>0&&<li>{effects.staleAnswerIds.length} saved answer{effects.staleAnswerIds.length===1?'':'s'} stay attached and will read stale: their question source changes and nothing is rebound.</li>}
  {effects.removedAnswerIds.length>0&&<li>{effects.removedAnswerIds.length} saved answer{effects.removedAnswerIds.length===1?'':'s'} on removed steps go with them ({list(effects.removedAnswerIds)}). One Undo restores them.</li>}
  {effects.removedStorySteps.length>0&&<li>{effects.removedStorySteps.length} story step{effects.removedStorySteps.length===1?'':'s'} pointing into removed explanation content go with it.</li>}
  {effects.publicItemIds.length>0&&<li>{effects.kind==='revise'?`${effects.publicItemIds.length} generated item${effects.publicItemIds.length===1?' keeps its':'s keep their'} public visibility; new items are private.`:`${effects.publicItemIds.length} public generated item${effects.publicItemIds.length===1?' leaves':'s leave'} the public view.`}</li>}
 </ul>;
}

/** Reuse the Tours host's guarded commit and the ordinary patch/review components.
 * Preparing or downloading never commits. Apply rechecks the full source cut and patch at the effect boundary. */
export function ExplanationAuthoring({doc,edit,viewId,selectedNodeId,live,onCommit}:Props){
 const [editing,setEditing]=useState(false),[session,setSession]=useState<ExplanationDraftSession>(),[pristine,setPristine]=useState(false);
 const [revising,setRevising]=useState<string|null>(null),[chosen,setChosen]=useState('');
 const [review,setReview]=useState<Review|null>(null),[error,setError]=useState('');
 const opener=useRef<HTMLButtonElement>(null),existingRef=useRef<HTMLSelectElement>(null),returnFocus=useRef<'author'|'existing'>('author');
 useEffect(()=>{if(!review)return;const guard=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[review]);
 const context=useRef({doc,edit,live,onCommit});context.current={doc,edit,live,onCommit};
 const existing=useMemo(()=>edit?listExplanationWalkthroughs(doc):[],[doc,edit]);
 const selected=existing.find(x=>x.id===chosen)??existing[0];
 const close=()=>{setEditing(false);setReview(null);setSession(undefined);setRevising(null);setPristine(false);setError('');
  requestAnimationFrame(()=>(returnFocus.current==='existing'&&existingRef.current?existingRef.current:opener.current)?.focus());};
 const back=()=>{if(review?.kind==='remove'){close();return;}setReview(null);setEditing(true);setError('');};
 const authorSource=()=>{const current=context.current;if(!current.edit)throw new Error('Explanation authoring is no longer available. Nothing was applied.');return current.live();};
 const apply=()=>{try{if(!review)throw new Error('Prepare an explanation first.');const before=authorSource();
   const next=applyPreparedExplanation(before,review.basis,review.result.patch);
   if(!context.current.onCommit(next))throw new Error('The project refused this explanation. Nothing was applied.');close();
  }catch(e){setError(errorMessage(e));}};
 const revise=()=>{if(!selected)return;returnFocus.current='existing';
  try{const source=authorSource(),started=startExplanationRevision(source,selected.id);
   setSession({basis:started.basis,source,draft:started.draft});setRevising(selected.id);setPristine(true);setEditing(true);setError('');
  }catch(e){setError(errorMessage(e));}};
 const remove=()=>{if(!selected)return;returnFocus.current='existing';
  try{const source=authorSource(),{basis,result}=prepareExplanationRemoval(source,selected.id);
   setReview({kind:'remove',basis,source,result});setError('');
  }catch(e){setError(errorMessage(e));}};
 if(!edit)return null;
 const changed=!!review&&!explanationSourceMatches(doc,review.basis);
 const kind:Kind=review?.kind??'author';
 return <><button ref={opener} type="button" onClick={()=>{returnFocus.current='author';setSession(undefined);setRevising(null);setPristine(false);setError('');setEditing(true);}}>Author explanation</button>
  {existing.length>0&&!editing&&!review&&<section className="explanation-existing" aria-label="Applied explanations">
   <label>Existing explanation<select ref={existingRef} aria-label="Existing explanation" value={selected?.id??''} onChange={e=>{setChosen(e.target.value);setError('');}}>{existing.map(x=><option key={x.id} value={x.id}>{x.title} ({x.id}){x.state==='unavailable'?' - cannot be revised':''}</option>)}</select></label>
   {selected?.state==='unavailable'&&<p className="micro" role="status">{selected.notice}</p>}
   <div className="toolbar"><button type="button" aria-disabled={selected?.state!=='available'} onClick={()=>selected?.state==='available'?revise():setError(selected?.notice??'')}>Revise explanation</button>
    <button type="button" aria-disabled={selected?.state!=='available'} onClick={()=>selected?.state==='available'?remove():setError(selected?.notice??'')}>Remove explanation</button></div>
   <p className="micro">Revise reopens the request rebuilt from the applied explanation and binds it to the current source. Remove prepares a reviewed removal. Neither changes anything until Apply.</p>
  </section>}
  {editing&&<ExplanationRequestDialog initial={session} pristine={pristine} revise={revising??undefined} initializationError={error} project={doc} viewId={viewId} selectedNodeId={selectedNodeId} onClose={close}
   onInitialize={()=>{try{const before=authorSource();if(before!==doc)throw new Error(EXPLANATION_SOURCE_CHANGED);if(!Array.isArray(before.tours)&&!context.current.onCommit(validateDocument({...before,tours:[]})))throw new Error('Tours initialization was refused.');}catch(e){setError(errorMessage(e));}}}
   onPrepare={(basis,draft)=>{const before=authorSource(),result=revising?prepareExplanationRevision(before,basis,draft,revising):prepareExplanationDraft(before,basis,draft);
    setSession({basis,source:before,draft:structuredClone(draft)});setPristine(false);setReview({kind:revising?'revise':'author',basis,source:before,result});setEditing(false);setError('');}}/>}
  {review&&<Modal title={TITLES[kind]} onClose={back}>
   <p>{review.result.notice}</p><p>{kind==='author'?'These additions are private. ':''}Review changes nothing. Apply is one undoable project edit; a download is not a saved project.</p>
   {review.result.effects&&<Effects effects={review.result.effects}/>}
   <ChangePreview preview={previewDocumentChange(review.source,review.result.preview)}/><ChangeDetailView detail={describeChanges(review.source,review.result.preview)}/>
   {changed&&<p role="alert">{EXPLANATION_SOURCE_CHANGED}</p>}{error&&<p role="alert">{error}</p>}
   <form onSubmit={e=>{e.preventDefault();apply();}}><div className="modal-actions"><button type="button" onClick={back}>{kind==='remove'?'Cancel removal':'Back to request'}</button><button type="button" onClick={()=>{try{download(JSON.stringify(review.result.patch,null,2),`${review.basis.projectId}.explanation${kind==='author'?'':`-${kind}`}.patch.json`,'application/json');}catch(e){setError(errorMessage(e));}}}>Download proposed patch</button><button type="submit" disabled={changed}>{APPLY[kind]}</button></div></form>
  </Modal>}
  {error&&!review&&<p role="alert">{error}</p>}
 </>;
}
