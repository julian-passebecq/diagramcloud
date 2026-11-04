import {useEffect,useMemo,useRef,useState} from 'react';
import {errorMessage,type Project} from '../core/model';
import {download} from '../export/browser';
import {explanationBasis,explanationSourceMatches,explanationStepInView,newExplanationDraft,newExplanationStep,EXPLANATION_SOURCE_CHANGED,type ExplanationBasis,type ExplanationDraft,type ExplanationStep} from '../intelligence/explanationRequestDraft';
import {readExplanationRequestFile,serializeExplanationRequestDraft,serializeValidatedExplanationRequest} from '../intelligence/explanationRequestFiles';
import {WALKTHROUGH_NOTICE} from '../intelligence/explanationWalkthrough';

export type ExplanationDraftSession={basis:ExplanationBasis;source:Project;draft:ExplanationDraft};
type Props={initial?:ExplanationDraftSession;project:Project;viewId:string;selectedNodeId:string|null;onClose:()=>void;
 initializationError?:string;onInitialize:()=>void;onPrepare:(basis:ExplanationBasis,draft:ExplanationDraft)=>void};
const toggled=(ids:string[],id:string)=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];

/** Author-only, session-local form. The host owns review/Apply, persistence and audience checks. */
export function ExplanationRequestDialog(props:Props){
 const dialog=useRef<HTMLDialogElement>(null);
 // Tours gates initial capture only. Once opened (or restored from review), keep
 // the form and its original source cut even if Undo removes the live collection.
 const initialized=useRef(!!props.initial||Array.isArray(props.project.tours));
 if(props.initial||Array.isArray(props.project.tours))initialized.current=true;
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 // Keep native Escape inside the form's explicit discard flow.
 const close=useRef<()=>void>(props.onClose);close.current=props.onClose;
 return <dialog ref={dialog} className="modal explanation-request" aria-label="Author an explanation" onCancel={event=>{event.preventDefault();close.current();}}>
  {initialized.current?<ExplanationForm {...props} setClose={handler=>{close.current=handler;}}/>:
   <section><h2>Prepare explanation authoring</h2><p>This project has no Tours collection yet. Initialize an empty collection as one explicit, undoable edit before writing a request. Existing content is preserved; this does not create an explanation or prove a save.</p>
    {props.initializationError&&<p role="alert">{props.initializationError}</p>}<div className="toolbar"><button type="button" onClick={props.onInitialize}>Initialize Tours for explanations</button><button type="button" onClick={props.onClose}>Cancel</button></div></section>}
 </dialog>;
}
function ExplanationForm({initial,project,viewId,selectedNodeId,onClose,onPrepare,setClose}:Props&{setClose:(handler:()=>void)=>void}){
 // Freeze choices at the captured cut; an explicit validated file import is the only replacement.
 const [session,setSession]=useState<ExplanationDraftSession>(()=>initial??{basis:explanationBasis(project),source:project,draft:newExplanationDraft(project,viewId,selectedNodeId)});
 const {basis,source,draft}=session;
 const [loading,setLoading]=useState(false),[fileNotice,setFileNotice]=useState('');
 const requestEpoch=useRef(0),draftEpoch=useRef(0),liveProject=useRef(project);liveProject.current=project;
 useEffect(()=>()=>{requestEpoch.current++;},[]);
 const [dirty,setDirty]=useState(!!initial),[discard,setDiscard]=useState(false),[error,setError]=useState('');
 const keep=useRef<HTMLButtonElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 const current=useMemo(()=>explanationSourceMatches(source,basis)&&explanationSourceMatches(project,basis),[source,project,basis]);
 const update=(next:ExplanationDraft)=>{draftEpoch.current++;setSession(value=>({...value,draft:next}));setDirty(true);setError('');setFileNotice('');};
 const attemptClose=()=>dirty?setDiscard(true):onClose();
 useEffect(()=>{setClose(attemptClose);});
 useEffect(()=>{if(discard)keep.current?.focus();},[discard]);
 useEffect(()=>{if(!dirty)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty]);
 const changeStep=(index:number,patch:Partial<ExplanationStep>)=>update({...draft,steps:draft.steps.map((step,i)=>i===index?{...step,...patch}:step)});
 const backup=()=>{try{download(serializeExplanationRequestDraft(basis,draft),`${basis.projectId}.explanation-request.json`,'application/json');}catch(e){setError(errorMessage(e));}};
 const validatedBackup=()=>{try{download(serializeValidatedExplanationRequest(basis,draft,source),`${basis.projectId}.explanation-request.json`,'application/json');}catch(e){setError(errorMessage(e));}};
 const loadFile=async(file:File)=>{
  const epoch=++requestEpoch.current,changedAt=draftEpoch.current,captured=liveProject.current;setLoading(true);setError('');setFileNotice('');
  try{const imported=await readExplanationRequestFile(file,captured);if(epoch!==requestEpoch.current)return;
   if(liveProject.current!==captured||draftEpoch.current!==changedAt)throw Error('The project or draft changed while the file was being read. Select the file again; the current draft is unchanged.');
   setSession({basis:imported.basis,source:imported.source,draft:imported.draft});draftEpoch.current++;setDirty(true);
   setFileNotice(imported.current?'Request loaded into the form. Review applies nothing; the project is unchanged.':'Request loaded with its original stale source binding. Review is disabled. Inspect or download it. To review, load this file again against its exact original project source; the fingerprint was not refreshed.');
  }catch(e){if(epoch===requestEpoch.current)setError(errorMessage(e));}finally{if(epoch===requestEpoch.current)setLoading(false);}
 };
 const move=(index:number,offset:number)=>{const steps=[...draft.steps],target=index+offset;if(target<0||target>=steps.length)return;[steps[index],steps[target]]=[steps[target],steps[index]];update({...draft,steps});};
 return <><div className="modal-heading"><h2>Author an explanation</h2><button ref={closeButton} type="button" onClick={attemptClose} aria-label="Close explanation editor">Close</button></div>
  <p>{WALKTHROUGH_NOTICE}</p><p className="micro">Private additions and private request downloads only. This draft is session-only, not saved to the project. Review applies nothing; use the ordinary Apply action after inspection.</p>
  <section aria-label="Explanation request files"><label>Load request JSON<input type="file" accept=".json,application/json" aria-label="Load explanation request JSON" disabled={discard} aria-busy={loading} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void loadFile(file);}}/></label>
   <p className="micro">Load and validated download use complete version 1 requests, up to 4 MiB of UTF-8. Unsupported fields and invalid references are refused. Download request draft preserves unfinished work; incomplete JSON cannot be imported until completed. A successful import replaces this form draft only; no autosave or execution.</p>
   {(loading||fileNotice)&&<p role="status" aria-live="polite">{loading?'Reading request file…':fileNotice}</p>}
  </section>
  {!current&&<p role="alert">{EXPLANATION_SOURCE_CHANGED}</p>}
  {discard&&<section role="alertdialog" aria-label="Discard explanation draft" className="note-card"><p>Discard this unsaved explanation request? Download the draft first to keep unfinished work. Incomplete draft JSON cannot be imported until completed.</p><div className="toolbar"><button ref={keep} type="button" onClick={()=>{setDiscard(false);closeButton.current?.focus();}}>Keep editing</button><button type="button" onClick={backup}>Download draft before closing</button><button type="button" onClick={onClose}>Discard draft</button></div></section>}
  <form onSubmit={event=>{event.preventDefault();try{onPrepare(basis,draft);}catch(e){setError(errorMessage(e));}}}>
   <fieldset disabled={!current||discard}><legend>Explanation request</legend>
    <label>Walkthrough ID<input aria-label="Walkthrough ID" maxLength={40} value={draft.id} onChange={e=>update({...draft,id:e.target.value})}/></label>
    <label>Title<input aria-label="Explanation title" maxLength={160} value={draft.title} onChange={e=>update({...draft,title:e.target.value})}/></label>
    <label>Question to explain<textarea aria-label="Question to explain" maxLength={1200} rows={3} value={draft.question} onChange={e=>update({...draft,question:e.target.value})}/></label>
    <fieldset><legend>Sources for this explanation</legend>{source.sources.length?source.sources.map(s=><label className="explanation-choice" key={s.id}><input type="checkbox" checked={draft.sourceIds.includes(s.id)} onChange={()=>update({...draft,sourceIds:toggled(draft.sourceIds,s.id)})}/>{s.title} ({s.id})</label>):<p>No sources recorded. Only synthetic steps can be prepared until citations are added to the project.</p>}</fieldset>
    {draft.steps.map((step,index)=>{const view=source.views.find(v=>v.id===step.viewId),prefix=`Step ${index+1}`,subjects=new Set([...step.nodeIds,...source.edges.filter(e=>step.edgeIds.includes(e.id)).flatMap(e=>[e.source,e.target])]);
     const attached=new Set(source.nodes.filter(n=>subjects.has(n.id)).flatMap(n=>n.blockIds)),codes=source.blocks.filter(b=>b.type==='code'&&attached.has(b.id));
     return <fieldset key={step.id}><legend>{prefix} ({step.id})</legend>
      <label>Step title<input aria-label={`${prefix} title`} maxLength={160} value={step.title} onChange={e=>changeStep(index,{title:e.target.value})}/></label>
      <label>Source view<select aria-label={`${prefix} source view`} value={step.viewId} onChange={e=>changeStep(index,{...explanationStepInView(step,e.target.value),code:undefined})}>{source.views.map(v=><option key={v.id} value={v.id}>{v.title} ({v.id})</option>)}</select></label>
      <fieldset><legend>{prefix} subjects</legend><p className="micro">Select exact components or connections; repeated steps reuse their identities.</p>
       {source.nodes.filter(n=>view?.nodeIds.includes(n.id)).map(n=><label className="explanation-choice" key={n.id}><input aria-label={`${prefix} component ${n.label}`} type="checkbox" checked={step.nodeIds.includes(n.id)} onChange={()=>changeStep(index,{nodeIds:toggled(step.nodeIds,n.id),code:undefined})}/>{n.label} ({n.id})</label>)}
       {source.edges.filter(e=>view?.edgeIds.includes(e.id)).map(e=><label className="explanation-choice" key={e.id}><input aria-label={`${prefix} connection ${e.id}`} type="checkbox" checked={step.edgeIds.includes(e.id)} onChange={()=>changeStep(index,{edgeIds:toggled(step.edgeIds,e.id),code:undefined})}/>{e.label||e.id} ({e.id})</label>)}
      </fieldset>
      <label>Narration<textarea aria-label={`${prefix} narration`} maxLength={1600} rows={3} value={step.narration} onChange={e=>changeStep(index,{narration:e.target.value})}/></label>
      <label>Evidence basis<select aria-label={`${prefix} basis`} value={step.provenance} onChange={e=>changeStep(index,{provenance:e.target.value as ExplanationStep['provenance']})}><option value="synthetic">Synthetic example</option><option value="source-derived">Source-derived, citations required</option><option value="reference">Reference, citations required</option><option value="author">Authored interpretation, citations required</option></select></label>
      <fieldset><legend>{prefix} source citations</legend>{source.sources.length?source.sources.map(s=><label className="explanation-choice" key={s.id}><input type="checkbox" aria-label={`${prefix} source ${s.id}`} checked={step.sourceIds.includes(s.id)} onChange={()=>changeStep(index,{sourceIds:toggled(step.sourceIds,s.id)})}/>{s.title} ({s.id})</label>):<p>No source citations are available in this project.</p>}</fieldset>
      <details><summary>Optional state, code and takeaway</summary>
       {(['before','after'] as const).map(phase=><fieldset key={phase}><legend>{prefix} {phase} state</legend>{step[phase].map((row,i)=><div className="explanation-state" key={i}><input aria-label={`${prefix} ${phase} field ${i+1}`} placeholder="State field" maxLength={160} value={row.name} onChange={e=>changeStep(index,{[phase]:step[phase].map((r,j)=>j===i?{...r,name:e.target.value}:r)})}/><input aria-label={`${prefix} ${phase} value ${i+1}`} placeholder="Declared value" maxLength={1500} value={row.value} onChange={e=>changeStep(index,{[phase]:step[phase].map((r,j)=>j===i?{...r,value:e.target.value}:r)})}/><button type="button" aria-label={`Remove ${prefix.toLowerCase()} ${phase} field ${i+1}`} onClick={()=>changeStep(index,{[phase]:step[phase].filter((_,j)=>j!==i)})}>Remove</button></div>)}<button type="button" disabled={step[phase].length>=20} onClick={()=>changeStep(index,{[phase]:[...step[phase],{name:'',value:''}]})}>Add {phase} state</button></fieldset>)}
       <label>Frozen code excerpt<select aria-label={`${prefix} code block`} value={step.code?.blockId??''} onChange={e=>changeStep(index,{code:e.target.value?{blockId:e.target.value,fromLine:1,toLine:1}:undefined})}><option value="">No code excerpt</option>{codes.map(b=><option key={b.id} value={b.id}>{b.title} ({b.id})</option>)}</select></label>
       {step.code&&<div className="explanation-state"><label>First line<input aria-label={`${prefix} first code line`} type="number" min={1} value={step.code.fromLine} onChange={e=>changeStep(index,{code:{...step.code!,fromLine:Number(e.target.value)}})}/></label><label>Last line<input aria-label={`${prefix} last code line`} type="number" min={1} value={step.code.toLine} onChange={e=>changeStep(index,{code:{...step.code!,toLine:Number(e.target.value)}})}/></label></div>}
       <label>Takeaway<textarea aria-label={`${prefix} takeaway`} maxLength={1000} value={step.takeaway} onChange={e=>changeStep(index,{takeaway:e.target.value})}/></label>
      </details>
      <details><summary>Case, prerequisites and questions</summary>
       <label>Selected case<input aria-label={`${prefix} selected case`} maxLength={200} value={step.caseLabel??''} onChange={e=>changeStep(index,{caseLabel:e.target.value||undefined})}/></label>
       <fieldset><legend>{prefix} declared prerequisites</legend><p className="micro">Choose explicit earlier steps. Moving or removing a referenced step does not repair the request; review will report the conflict.</p>
        {draft.steps.filter(s=>s.id!==step.id).map(other=>{const earlier=draft.steps.indexOf(other)<index;return <label className="explanation-choice" key={other.id}><input type="checkbox" aria-label={`${prefix} requires ${other.id}`} checked={step.dependsOn.includes(other.id)} disabled={!earlier&&!step.dependsOn.includes(other.id)} onChange={()=>changeStep(index,{dependsOn:toggled(step.dependsOn,other.id)})}/>{other.title||other.id} ({other.id}){!earlier?' — must precede this step':''}</label>;})}
        {step.dependsOn.filter(id=>!draft.steps.some(s=>s.id===id)).map(id=><label className="explanation-choice" key={id}><input type="checkbox" checked aria-label={`${prefix} missing prerequisite ${id}`} onChange={()=>changeStep(index,{dependsOn:step.dependsOn.filter(x=>x!==id)})}/>Unavailable step ({id}); remove this reference or restore the step.</label>)}
       </fieldset>
       <fieldset><legend>{prefix} questions to explore</legend>{step.questions.map((question,i)=><div className="explanation-state" key={i}><textarea aria-label={`${prefix} question ${i+1}`} maxLength={300} rows={2} value={question} onChange={e=>changeStep(index,{questions:step.questions.map((x,j)=>i===j?e.target.value:x)})}/><button type="button" aria-label={`Remove ${prefix.toLowerCase()} question ${i+1}`} onClick={()=>changeStep(index,{questions:step.questions.filter((_,j)=>i!==j)})}>Remove question</button></div>)}<button type="button" disabled={step.questions.length>=8} onClick={()=>changeStep(index,{questions:[...step.questions,'']})}>Add question to {prefix.toLowerCase()}</button></fieldset>
      </details>
      <div className="toolbar"><button type="button" disabled={index===0} onClick={()=>move(index,-1)} aria-label={`Move ${prefix.toLowerCase()} earlier`}>Earlier</button><button type="button" disabled={index===draft.steps.length-1} onClick={()=>move(index,1)} aria-label={`Move ${prefix.toLowerCase()} later`}>Later</button><button type="button" disabled={draft.steps.length===1} onClick={()=>update({...draft,steps:draft.steps.filter((_,i)=>i!==index)})} aria-label={`Remove ${prefix.toLowerCase()}`}>Remove step</button></div>
     </fieldset>;
    })}
    <button type="button" disabled={draft.steps.length>=30} onClick={()=>update({...draft,steps:[...draft.steps,newExplanationStep(draft.steps,source.rootViewId)]})}>Add explanation step</button>
   </fieldset>
   {error&&<pre role="alert" className="validation-error">{error}</pre>}
   <div className="modal-actions"><button type="button" onClick={backup}>Download request draft</button><button type="button" onClick={validatedBackup}>Download validated request file</button><button type="submit" disabled={!current||discard}>Review explanation</button></div>
  </form></>;
}
