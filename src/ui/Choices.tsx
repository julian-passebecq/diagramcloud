import {useState} from 'react';
import {Button} from '@fluentui/react-components';
import {errorMessage,type Choice,type Project} from '../core/model';
import {acceptChoice,choiceReview,reviewChoice,type ChoiceOwner} from '../core/decisionReview';
import {substitutionCheck} from '../intelligence/learning/substitution';

const ORIGIN:Record<Choice['origin'],string>={author:'Author',ai:'AI recommendation',imported:'Imported record'};
const today=()=>new Date().toISOString().slice(0,10);
type Props={choices?:Choice[];edit?:boolean;doc?:Project;owner?:ChoiceOwner;onCommit?:(next:Project)=>void;onError?:(message:string)=>void};
/**
 * Rationale of the recorded choices: goal, options, reasons, tradeoffs, assumptions and alternatives, with a review state
 * derived from the facts the decision rests on (never stored) and a substitution check per alternative that stays UNKNOWN
 * without compatibility evidence. A candidate is labelled as such and never shows a chosen option; numbers are never
 * scored. Review and acceptance are offered only in Edit mode, as explicit actions.
 */
export function ChoiceList({choices,edit=false,doc,owner,onCommit,onError}:Props){
 if(!choices?.length)return edit?<p className="micro">No recorded choices. Add one through the JSON drawer (component scope).</p>:null;
 return <div className="choice-list" aria-label="Choices and rationale">{choices.map(c=><ChoiceCard key={c.id} c={c} edit={edit} doc={doc} owner={owner} onCommit={onCommit} onError={onError}/>)}</div>;
}
function ChoiceCard({c,edit,doc,owner,onCommit,onError}:{c:Choice}&Omit<Props,'choices'>){
 const option=(id?:string)=>c.options.find(o=>o.id===id)?.label??id;
 const list=(title:string,rows:string[])=>rows.length>0&&<><h4>{title}</h4><ul>{rows.map((r,i)=><li key={i}>{r}</li>)}</ul></>;
 const review=doc?choiceReview(doc,c.id):undefined,selectedId=c.status==='accepted'?c.chosenOptionId:c.recommendedOptionId;
 const alternatives=c.options.filter(o=>o.id!==selectedId);
 const node=owner?.kind==='node'?doc?.nodes.find(n=>n.id===owner.id):undefined;
 const run=(f:()=>Project)=>{try{onCommit?.(f());}catch(e){onError?.(errorMessage(e));}};
 return <section className="choice-card" data-choice-status={c.status} data-review-state={review?.state} aria-label={`Choice ${c.title}`}>
  <h3>{c.title} <span className={`chip ${c.status==='accepted'?'choice-accepted':'choice-candidate'}`}>{c.status==='accepted'?'Accepted decision':'Candidate · not an accepted decision'}</span></h3>
  <p className="micro">{ORIGIN[c.origin]}{c.status==='accepted'&&<> · decided by {c.decidedBy} on {c.decidedAt}</>} · <span className="stable-id">{c.id}</span>{c.visibility==='private'&&' · Private'}</p>
  {review&&<div className={`choice-review ${review.state}`} role="status" aria-label={`Review state of ${c.title}`}><b>{review.label}</b>{review.reviewedRevision!==undefined&&review.state==='current'&&<span className="muted"> · reviewed at revision {review.reviewedRevision}</span>}{review.reasons.map((r,i)=><p key={i} className="micro">{r}</p>)}</div>}
  <p><b>Goal:</b> {c.goal}</p>
  <h4>Options</h4><ul>{c.options.map(o=><li key={o.id}>{o.label}{o.summary&&<span className="muted"> · {o.summary}</span>}{c.status==='accepted'&&o.id===c.chosenOptionId&&<b> · chosen</b>}{o.id===c.recommendedOptionId&&<span className="muted"> · recommended{c.status==='candidate'?', not chosen':''}</span>}</li>)}</ul>
  {list('Reasons',c.reasons)}{list('Tradeoffs',c.tradeoffs)}{list('Assumptions',c.assumptions)}
  {c.revisitWhen&&<p><b>Revisit when:</b> {c.revisitWhen}</p>}
  {c.status==='candidate'&&c.recommendedOptionId&&<p className="micro">“{option(c.recommendedOptionId)}” is recommended, not decided. Acceptance records who decided and when.</p>}
  {doc&&node&&selectedId&&alternatives.length>0&&<section aria-label={`Alternatives to ${option(selectedId)}`}><h4>Alternatives</h4><ul>{alternatives.map(o=>{const s=substitutionCheck(doc,node.id,{label:o.label,choiceId:c.id,optionId:o.id});
   return <li key={o.id}><span>“{o.label}” instead of “{option(selectedId)}”: </span><b data-substitution={s.verdict}>{s.label}</b>
    <details><summary>Substitution check · {s.requirements.length} requirement{s.requirements.length===1?'':'s'}</summary><ul>{s.requirements.map(r=><li key={r.id}>{r.text} <span className="muted">· {r.state}</span></li>)}</ul>{[...s.reasons,...s.notProof].map((r,i)=><p key={i} className="micro">{r}</p>)}</details></li>;})}</ul></section>}
  {edit&&doc&&onCommit&&<ChoiceActions c={c} doc={doc} run={run}/>}
 </section>;
}
/** Edit-mode only: the author's explicit review and acceptance. Nothing here runs on selection or on reading. */
function ChoiceActions({c,doc,run}:{c:Choice;doc:Project;run:(f:()=>Project)=>void}){
 const [who,setWho]=useState(doc.author??''),[option,setOption]=useState(c.recommendedOptionId??c.options[0].id),[date,setDate]=useState(today());
 return <div className="choice-actions" role="group" aria-label={`Review ${c.title}`}>
  <label>Your name<input aria-label={`Reviewer of ${c.title}`} value={who} maxLength={160} onChange={e=>setWho(e.target.value)}/></label>
  <Button size="small" type="button" onClick={()=>run(()=>reviewChoice(doc,c.id,{reviewedBy:who}))}>Mark reviewed against current facts</Button>
  {c.status==='candidate'&&<><label>Option to accept<select aria-label={`Option to accept for ${c.title}`} value={option} onChange={e=>setOption(e.target.value)}>{c.options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
   <label>Decided on<input aria-label={`Decision date for ${c.title}`} value={date} maxLength={40} onChange={e=>setDate(e.target.value)}/></label>
   <Button size="small" type="button" appearance="primary" onClick={()=>run(()=>acceptChoice(doc,c.id,option,{decidedBy:who,decidedAt:date}))}>Accept as my decision</Button></>}
  <p className="micro">Reviewing records the facts it was checked against; it changes neither the decision nor who made it. {c.status==='accepted'?'An accepted decision is not rewritten here.':'Accepting records your name and the date; a recommendation cannot accept itself.'}</p>
 </div>;
}
