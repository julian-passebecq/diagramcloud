import {useState} from 'react';
import {Button} from '@fluentui/react-components';
import type {Project} from '../core/model';
import {CLAIM_LABEL,day} from '../core/realization';
import {NARRATION_MAX,TITLE_MAX,citableObservations,draftStep,draftStory,insertStep,moveStep,removeStep,replaceStep,retarget,stepNotes,type StoryStep} from '../core/story';

type Props={doc:Project;activeViewId:string;selectedNodeId:string|null;current:number;
 onCommit:(story:StoryStep[],show:number)=>void;onPreview:(index:number)=>void;onPlay:(index:number)=>void};

/** Guided-story composer for the Edit sidebar. Every button or Save is one undo step; selecting a step previews it on the canvas. */
export function StoryComposer(p:Props){
 const story=p.doc.story,[picked,setPicked]=useState(()=>Math.max(0,Math.min(p.current,story.length-1)));
 const index=Math.min(picked,story.length-1),step=story[index];
 const viewTitle=(id:string)=>p.doc.views.find(v=>v.id===id)?.title??id;
 const pick=(k:number)=>{setPicked(k);p.onPreview(k);};
 const commit=(next:StoryStep[],show:number)=>{setPicked(show);p.onCommit(next,show);};
 const addFromCanvas=()=>commit(insertStep(story,index+1,draftStep(p.doc,p.activeViewId,p.selectedNodeId)),story.length?index+1:0);
 return <section className="story-composer" aria-label="Story composer">
  <div className="eyebrow">GUIDED STORY · {story.length} STEP{story.length===1?'':'S'}</div>
  <p className="micro">Steps play in Present mode. Select a step to preview it on the canvas.</p>
  <div className="story-actions">
   <Button size="small" appearance="primary" onClick={addFromCanvas}>+ Step from current view</Button>
   {!story.length&&<Button size="small" onClick={()=>commit(draftStory(p.doc),0)}>Draft from views</Button>}
  </div>
  {story.length>0&&<ol className="story-list">{story.map((s,k)=><li key={k} className={k===index?'active':''}>
   <button type="button" className="story-pick" aria-pressed={k===index} onClick={()=>pick(k)}><b>{k+1}. {s.title}</b><small>{viewTitle(s.viewId)}{s.nodeId?` · ${p.doc.nodes.find(n=>n.id===s.nodeId)?.label??s.nodeId}`:''}</small></button>
   <span className="story-move"><button type="button" aria-label={`Move step ${k+1} up`} disabled={k===0} onClick={()=>commit(moveStep(story,k,k-1),k-1)}>↑</button><button type="button" aria-label={`Move step ${k+1} down`} disabled={k===story.length-1} onClick={()=>commit(moveStep(story,k,k+1),k+1)}>↓</button></span>
  </li>)}</ol>}
  {step&&<StepForm key={`${index}:${JSON.stringify(step)}`} doc={p.doc} step={step} index={index}
   onSave={s=>commit(replaceStep(story,index,s),index)}
   onDuplicate={()=>commit(insertStep(story,index+1,structuredClone(step)),index+1)}
   onDelete={()=>commit(removeStep(story,index),Math.max(0,index-1))}
   onPlay={()=>p.onPlay(index)}/>}
 </section>;
}

function StepForm(p:{doc:Project;step:StoryStep;index:number;onSave:(s:StoryStep)=>void;onDuplicate:()=>void;onDelete:()=>void;onPlay:()=>void}){
 const [draft,setDraft]=useState<StoryStep>(p.step);
 const view=p.doc.views.find(v=>v.id===draft.viewId),nodes=p.doc.nodes.filter(n=>view?.nodeIds.includes(n.id)),edges=p.doc.edges.filter(e=>view?.edgeIds.includes(e.id));
 const label=(id:string)=>p.doc.nodes.find(n=>n.id===id)?.label??id;
 const changed=JSON.stringify(draft)!==JSON.stringify(p.step),notes=stepNotes(p.doc,draft);
 const setFocus=(nodeId:string)=>setDraft(({nodeId:_,...rest})=>nodeId?{...rest,nodeId}:rest);
 const citable=citableObservations(p.doc,draft.viewId);
 const toggleObservation=(id:string)=>setDraft(({observationIds=[],...rest})=>{const next=observationIds.includes(id)?observationIds.filter(x=>x!==id):[...observationIds,id];return next.length?{...rest,observationIds:next}:rest;});
 const toggleEdge=(id:string)=>setDraft(d=>({...d,highlightEdgeIds:d.highlightEdgeIds.includes(id)?d.highlightEdgeIds.filter(x=>x!==id):[...d.highlightEdgeIds,id]}));
 return <form className="story-form" aria-label={`Edit step ${p.index+1}`} onSubmit={e=>{e.preventDefault();if(changed&&draft.title.trim())p.onSave({...draft,title:draft.title.trim()});}}>
  <label>Title<input aria-label="Step title" value={draft.title} maxLength={TITLE_MAX} required onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
  <label>View<select aria-label="Step view" value={draft.viewId} onChange={e=>setDraft(retarget(p.doc,draft,e.target.value))}>{p.doc.views.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>
  <label>Focus component<select aria-label="Focus component" value={draft.nodeId??''} onChange={e=>setFocus(e.target.value)}><option value="">None: whole view</option>{nodes.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label>
  {edges.length>0&&<fieldset><legend>Highlighted connections</legend>{edges.map(e=><label key={e.id} className="story-edge"><input type="checkbox" checked={draft.highlightEdgeIds.includes(e.id)} onChange={()=>toggleEdge(e.id)}/>{label(e.source)} → {label(e.target)}{e.label?` (${e.label})`:''}</label>)}</fieldset>}
  {citable.length>0&&<fieldset><legend>Reviewed evidence to show</legend>{citable.map(o=><label key={o.id} className="story-edge"><input type="checkbox" checked={!!draft.observationIds?.includes(o.id)} onChange={()=>toggleObservation(o.id)}/>{label(o.nodeId)}: {CLAIM_LABEL[o.claim]} · {o.sourceApp} · {day(o.observedAt)}</label>)}<small className="micro">Shown as cited evidence. The claim and its authority stay the source app’s.</small></fieldset>}
  <label>Narration<textarea aria-label="Narration" rows={5} value={draft.narration} maxLength={NARRATION_MAX} onChange={e=>setDraft({...draft,narration:e.target.value})}/><small className="micro">{draft.narration.length} / {NARRATION_MAX}</small></label>
  {notes.length>0&&<ul className="story-notes" aria-label="Step notes">{notes.map(n=><li key={n}>{n}</li>)}</ul>}
  <div className="story-actions">
   <Button size="small" appearance="primary" type="submit" disabled={!changed||!draft.title.trim()}>Save step</Button>
   <Button size="small" disabled={!changed} onClick={()=>setDraft(p.step)}>Revert</Button>
   <Button size="small" onClick={p.onPlay}>Play from here</Button>
   <Button size="small" onClick={p.onDuplicate}>Duplicate</Button>
   <Button size="small" onClick={p.onDelete}>Delete step</Button>
  </div>
 </form>;
}
