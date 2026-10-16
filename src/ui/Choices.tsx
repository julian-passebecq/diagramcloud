import type {Choice} from '../core/model';

const ORIGIN:Record<Choice['origin'],string>={author:'Author',ai:'AI recommendation',imported:'Imported record'};
/** Read-only rationale. A candidate is labelled as such and never shows a chosen option; numbers are never scored. */
export function ChoiceList({choices,edit=false}:{choices?:Choice[];edit?:boolean}){
 if(!choices?.length)return edit?<p className="micro">No recorded choices. Add one through the JSON drawer (component scope).</p>:null;
 return <div className="choice-list" aria-label="Choices and rationale">{choices.map(c=>{const option=(id?:string)=>c.options.find(o=>o.id===id)?.label??id;const list=(title:string,rows:string[])=>rows.length>0&&<><h4>{title}</h4><ul>{rows.map((r,i)=><li key={i}>{r}</li>)}</ul></>;
  return <section key={c.id} className="choice-card" data-choice-status={c.status} aria-label={`Choice ${c.title}`}>
   <h3>{c.title} <span className={`chip ${c.status==='accepted'?'choice-accepted':'choice-candidate'}`}>{c.status==='accepted'?'Accepted decision':'Candidate · not an accepted decision'}</span></h3>
   <p className="micro">{ORIGIN[c.origin]}{c.status==='accepted'&&<> · decided by {c.decidedBy} on {c.decidedAt}</>} · <span className="stable-id">{c.id}</span>{c.visibility==='private'&&' · Private'}</p>
   <p><b>Goal:</b> {c.goal}</p>
   <h4>Options</h4><ul>{c.options.map(o=><li key={o.id}>{o.label}{o.summary&&<span className="muted"> · {o.summary}</span>}{c.status==='accepted'&&o.id===c.chosenOptionId&&<b> · chosen</b>}{o.id===c.recommendedOptionId&&<span className="muted"> · recommended{c.status==='candidate'?', not chosen':''}</span>}</li>)}</ul>
   {list('Reasons',c.reasons)}{list('Tradeoffs',c.tradeoffs)}{list('Assumptions',c.assumptions)}
   {c.revisitWhen&&<p><b>Revisit when:</b> {c.revisitWhen}</p>}
   {c.status==='candidate'&&c.recommendedOptionId&&<p className="micro">“{option(c.recommendedOptionId)}” is recommended, not decided. Acceptance records who decided and when.</p>}
  </section>;})}</div>;
}
