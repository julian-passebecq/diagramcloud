import {useEffect,useRef,useState} from 'react';
import {errorMessage,validateDocument,type Project} from '../core/model';
import {previewDocumentChange} from '../core/changePreview';
import {describeChanges} from '../core/changeDetail';
import {ChangePreview,Modal} from '../app/ReviewShell';
import {ChangeDetailView} from './ChangeDetail';
import {download} from '../export/browser';
import {ExplanationRequestDialog,type ExplanationDraftSession} from './ExplanationRequestDialog';
import {explanationSourceMatches,prepareExplanationDraft,applyPreparedExplanation,EXPLANATION_SOURCE_CHANGED} from '../intelligence/explanationRequestDraft';
import type {WalkthroughResult} from '../intelligence/explanationWalkthrough';

type Props={doc:Project;edit:boolean;viewId:string;selectedNodeId:string|null;live:()=>Project;onCommit:(next:Project)=>boolean};
/** Reuse the Tours host's guarded commit and the ordinary patch/review components.
 * Preparing or downloading never commits. Apply rechecks the full source cut and patch at the effect boundary. */
export function ExplanationAuthoring({doc,edit,viewId,selectedNodeId,live,onCommit}:Props){
 const [editing,setEditing]=useState(false),[session,setSession]=useState<ExplanationDraftSession>();
 const [review,setReview]=useState<WalkthroughResult|null>(null),[error,setError]=useState('');
 const opener=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!review)return;const guard=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[review]);
 const context=useRef({doc,edit,live,onCommit});context.current={doc,edit,live,onCommit};
 const close=()=>{setEditing(false);setReview(null);setSession(undefined);setError('');requestAnimationFrame(()=>opener.current?.focus());};
 const authorSource=()=>{const current=context.current;if(!current.edit)throw new Error('Explanation authoring is no longer available. Nothing was applied.');return current.live();};
 const apply=()=>{try{if(!review||!session)throw new Error('Prepare an explanation first.');const before=authorSource();
   const next=applyPreparedExplanation(before,session.basis,review.patch);
   if(!context.current.onCommit(next))throw new Error('The project refused this explanation. Nothing was applied.');close();
  }catch(e){setError(errorMessage(e));}};
 if(!edit)return null;
 const changed=!!session&&!explanationSourceMatches(doc,session.basis);
 return <><button ref={opener} type="button" onClick={()=>{setError('');setEditing(true);}}>Author explanation</button>
  {editing&&<ExplanationRequestDialog initial={session} initializationError={error} project={doc} viewId={viewId} selectedNodeId={selectedNodeId} onClose={close}
   onInitialize={()=>{try{const before=authorSource();if(before!==doc)throw new Error(EXPLANATION_SOURCE_CHANGED);if(!Array.isArray(before.tours)&&!context.current.onCommit(validateDocument({...before,tours:[]})))throw new Error('Tours initialization was refused.');}catch(e){setError(errorMessage(e));}}}
   onPrepare={(basis,draft)=>{const before=authorSource(),result=prepareExplanationDraft(before,basis,draft);setSession({basis,source:before,draft:structuredClone(draft)});setReview(result);setEditing(false);setError('');}}/>}
  {review&&session&&<Modal title="Review authored explanation" onClose={close}>
   <p>{review.notice}</p><p>These additions are private. Review changes nothing. Apply is one undoable project edit; a download is not a saved project.</p>
   <ChangePreview preview={previewDocumentChange(session.source,review.preview)}/><ChangeDetailView detail={describeChanges(session.source,review.preview)}/>
   {changed&&<p role="alert">{EXPLANATION_SOURCE_CHANGED}</p>}{error&&<p role="alert">{error}</p>}
   <form onSubmit={e=>{e.preventDefault();apply();}}><div className="modal-actions"><button type="button" onClick={()=>{setReview(null);setEditing(true);setError('');}}>Back to request</button><button type="button" onClick={()=>{try{download(JSON.stringify(review.patch,null,2),`${session.basis.projectId}.explanation.patch.json`,'application/json');}catch(e){setError(errorMessage(e));}}}>Download proposed patch</button><button type="submit" disabled={changed}>Apply explanation</button></div></form>
  </Modal>}
  {error&&!review&&<p role="alert">{error}</p>}
 </>;
}
