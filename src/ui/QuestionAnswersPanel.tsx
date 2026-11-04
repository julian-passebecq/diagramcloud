import {useRef,useState,useLayoutEffect} from 'react';
import type {Project} from '../core/model';
import type {Patch} from '../core/patch';
import {answerRows,questions,proposeAnswer,type QuestionBinding,type AnswerRow} from '../core/questionAnswers';
import {canonical,fnv64} from '../core/learningMapping';
type Props={project:Project;nodeId:string;editMode:boolean;onPropose?:(patch:Patch)=>void};
export function QuestionAnswersPanel(p:Props){
 const panel=useRef<HTMLElement>(null),hadFocus=useRef(false),heading=useRef<HTMLHeadingElement>(null);
 const qs=questions(p.project,p.nodeId),rows=answerRows(p.project,p.nodeId);
 const [initialQuestions]=useState(qs.items);
 const displayed=[...qs.items,...initialQuestions.filter(old=>!qs.items.some(q=>q.kind===old.kind&&q.index===old.index))];
 // Retain original draft bindings; source movement never silently rebases text.
 const scope=fnv64(canonical({id:p.project.id,revision:p.project.revision,nodeId:p.nodeId,questions:qs,rows,sources:p.project.sources,edit:p.editMode}));
 useLayoutEffect(()=>{if(hadFocus.current&&document.activeElement===document.body)heading.current?.focus();},[scope]);
 return <section ref={panel} onFocusCapture={()=>{hadFocus.current=true;}} onBlurCapture={e=>{if(e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget as Node))hadFocus.current=false;}} aria-label="Authored answers"><h4 ref={heading} tabIndex={-1}>Authored answers</h4><p className="micro">Private authored replies and named review records. A recorded review is attribution, not verified truth or an observed result. Proposals require the normal JSON review and Apply.</p>
 {qs.notice&&<p role="status">{qs.notice}</p>}
 {!p.editMode&&<p>Explore is read-only. Enter Edit to propose an answer or record a review.</p>}
 {displayed.map((q,i)=>{const matching=rows.filter(r=>r.record&&canonical(r.record.binding)===canonical(q));return <AnswerForm key={`${p.project.id}:${p.nodeId}:${q.kind}:${q.index}`} {...p} binding={q} row={matching.length===1?matching[0]:undefined} blocked={matching.length>1||rows.some(r=>r.state==='unavailable'||r.state==='ambiguous')}/>;})}
 {rows.filter(r=>r.state!=='current').map(r=><article key={r.block.id}><h5>Retained answer: {r.record?.binding.text??r.block.title}</h5><p role="status">{r.notice}</p>{r.record&&<><p>{r.record.answer}</p><p>Author: {r.record.author} · Review: {r.review}</p></>}<label>Original answer backup<textarea readOnly rows={5} value={r.block.type==='code'?r.block.code:JSON.stringify(r.block)} style={{width:'100%',boxSizing:'border-box'}}/></label></article>)}
 </section>;
}
function AnswerForm({project,binding,row,editMode,onPropose,blocked}:Props&{binding:QuestionBinding;row?:AnswerRow;blocked:boolean}){
 const [basis,setBasis]=useState(project),[originalBinding,setBinding]=useState(binding);
 const stale=canonical(basis)!==canonical(project)||canonical(originalBinding)!==canonical(binding)||!questions(project,binding.nodeId).items.some(q=>canonical(q)===canonical(originalBinding));
 const [answer,setAnswer]=useState(row?.record?.answer??''),[author,setAuthor]=useState(row?.record?.author??''),[citationIds,setCitations]=useState<string[]>(row?.record?.citationIds??[]),[reviewer,setReviewer]=useState(''),[error,setError]=useState(''),[sent,setSent]=useState(false);
 const freshId=()=>{const base=`answer-${fnv64(canonical(binding))}`;let id=base,n=1;while(project.blocks.some(b=>b.id===id))id=`${base}-${n++}`;return id;};
 const blockId=useRef(row?.block.id??freshId());
 const reset=()=>{setBasis(project);setBinding(binding);setAnswer(row?.record?.answer??'');setAuthor(row?.record?.author??'');setCitations(row?.record?.citationIds??[]);setReviewer('');setError('');setSent(false);blockId.current=row?.block.id??freshId();};
 const propose=(review:boolean)=>{try{if(!onPropose)return;if(stale)throw Error('The original draft source changed. Copy the pending text and explicitly start from the current question.');const patch=review?proposeAnswer(basis,{reviewBlockId:blockId.current,reviewer,at:new Date().toISOString()}):proposeAnswer(basis,{binding:originalBinding,blockId:blockId.current,answer,author,citationIds});onPropose(patch);setSent(true);setError('');}catch(e){setError(e instanceof Error?e.message:'Unable to propose this answer.');}};
 const changed=answer!==row?.record?.answer||author!==row?.record?.author||canonical(citationIds)!==canonical(row?.record?.citationIds??[]);
 return <article aria-label={`Answer: ${binding.text}`} style={{minWidth:0}}><h5 tabIndex={-1}>{binding.kind==='focus'?'Focus question':'Follow-up question'}: {binding.text}</h5>
 {row?.record?<><p>{row.record.answer}</p><p>Author: {row.record.author} · {row.review==='reviewed'?`Recorded review by ${row.record.review!.reviewer} at ${row.record.review!.at}`:row.review==='stale'?'Review no longer matches current content':'No current review recorded'}</p>{row.record.citationIds.length>0&&<p>Citations: {row.record.citationIds.map(id=>project.sources.find(s=>s.id===id)?.title??id).join(', ')}</p>}</>:<p>Unanswered.</p>}
 {editMode&&stale&&<><p role="status">The Project or question changed. Original question: {originalBinding.text}. Pending text keeps its original binding and cannot be proposed. Copy it before starting from the current question.</p><label>Retained pending answer<textarea readOnly value={answer} style={{width:'100%'}}/></label>{questions(project,binding.nodeId).items.some(q=>canonical(q)===canonical(binding))&&<button type="button" onClick={e=>{e.currentTarget.closest('article')?.querySelector('h5')?.focus();reset();}}>Start from current question</button>}</>}
 {editMode&&onPropose&&!blocked&&!stale&&<><label>Answer text<textarea rows={4} maxLength={1600} value={answer} onChange={e=>{setAnswer(e.target.value);setSent(false);}} style={{width:'100%',boxSizing:'border-box'}}/></label><label>Answer author<input maxLength={160} value={author} onChange={e=>{setAuthor(e.target.value);setSent(false);}} style={{maxWidth:'100%',boxSizing:'border-box'}}/></label>
 <fieldset><legend>Existing source citations (up to eight)</legend>{project.sources.length?project.sources.map(s=><label key={s.id} style={{display:'block',overflowWrap:'anywhere'}}><input type="checkbox" checked={citationIds.includes(s.id)} onChange={e=>{setCitations(ids=>e.target.checked?[...ids,s.id]:ids.filter(id=>id!==s.id));setSent(false);}}/>{s.title}</label>):<p>No sources supplied.</p>}</fieldset>
 <button type="button" onClick={()=>propose(false)}>Propose answer</button>
 {row?.state==='current'&&<><label>Reviewer name<input maxLength={160} value={reviewer} onChange={e=>setReviewer(e.target.value)} style={{maxWidth:'100%',boxSizing:'border-box'}}/></label><p className="micro">Record only a review actually performed by the named person. This is supplied attribution, not identity verification.</p><button type="button" onClick={()=>propose(true)} disabled={changed}>Propose named review</button>{changed&&<p>Apply the edited answer before recording its review. An answer edit clears its previous review.</p>}</>}
 </>}
 {blocked&&<p role="status">Ambiguous or unsupported records prevent new proposals; original evidence remains available.</p>}
 <p role={error?'alert':'status'}>{error|| (sent?'Proposal opened for review. Nothing is saved until Apply.':'')}</p>
 </article>;
}
