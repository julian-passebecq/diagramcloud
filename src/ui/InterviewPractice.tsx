import {useEffect,useMemo,useRef,useState} from 'react';
import {interviewBank} from '../intelligence/learning/interviewBank';
import {findPracticeRounds,newPracticeSession,practiceCoverage,practiceReduce,validatePracticeBank,type InterviewBank,type PracticeAction} from '../intelligence/learning/interviewPractice';
const KIND_LABEL={concept:'Concept',syntax:'Syntax or semantic trap',exercise:'Small exercise',scenario:'Engineering scenario'} as const;
type Props={bank?:InterviewBank;scopeKey?:string;onLesson?:(id:string)=>void};
/** The host remounts on source/audience changes. Notes never leave this local component automatically. */
export function InterviewPractice({bank=interviewBank,scopeKey='catalogue'}:Props){
 const validated=useMemo(()=>validatePracticeBank(bank),[bank]);
 return <PracticeSession key={scopeKey+'\u0000'+JSON.stringify(validated)} bank={validated}/>;
}
function PracticeSession({bank}:{bank:InterviewBank}){
 const [session,setSession]=useState(()=>newPracticeSession(bank)),[query,setQuery]=useState(''),[domain,setDomain]=useState('all'),[questionIndex,setQuestionIndex]=useState(0),[clearAsked,setClearAsked]=useState(false);
 const heading=useRef<HTMLHeadingElement>(null),[error,setError]=useState('');
 const round=bank.rounds.find(r=>r.id===session.roundId)!,q=round.questions[questionIndex];
 const record=session.records[q.id]??{draft:'',revealed:false,self:'unrated' as const};
 const shown=findPracticeRounds(bank,query,domain),coverage=practiceCoverage(bank,session),context=bank.cases.find(c=>c.id===round.caseId)!;
 const apply=(action:PracticeAction)=>{try{const next=practiceReduce(bank,session,action);setSession(next);setError('');}catch(e){setError(e instanceof Error?e.message:'Practice action refused.');}};
 const choose=(id:string)=>{apply({type:'choose',roundId:id});setQuestionIndex(0);};
 useEffect(()=>{heading.current?.focus();},[session.roundId,questionIndex]);
 return <section className="dc-practice" aria-label="Interview practice">
  <header><h3>Learn, explain, then challenge the design</h3><p>Original self-practice · {bank.rounds.length} rounds of four · no execution, AI grading or hiring score.</p><p className="dc-practice-note">Answers stay in memory for this catalogue context. Switching project, audience, source or closing this page clears the session. Hidden references are a learning aid, not secure exam protection.</p></header>
  <div className="dc-practice-layout">
   <aside aria-label="Practice topics"><label>Find a topic<input aria-label="Find practice topic" value={query} maxLength={200} onChange={e=>setQuery(e.target.value)}/></label>
    <label>Domain<select aria-label="Practice domain" value={domain} onChange={e=>setDomain(e.target.value)}><option value="all">All domains</option>{[...new Set(bank.rounds.map(r=>r.domain))].map(d=><option key={d}>{d}</option>)}</select></label>
    <p role="status">{shown.length} matching rounds</p><div className="dc-practice-topics">{shown.map(r=><button key={r.id} type="button" aria-pressed={r.id===round.id} onClick={()=>choose(r.id)}>{r.title}<small>{r.level}</small></button>)}</div>
    {!shown.length&&<p>No match. <button type="button" onClick={()=>{setQuery('');setDomain('all');}}>Clear topic filters</button></p>}
   </aside>
   <main><p className="dc-practice-note">{round.domain} · {round.level} · content {bank.revision}</p><h4>{round.title}</h4><p>{round.overview}</p>
    {round.prerequisites.length>0&&<p>Useful prerequisites: {round.prerequisites.map(id=><button key={id} type="button" onClick={()=>choose(id)}>{bank.rounds.find(r=>r.id===id)!.title}</button>)}</p>}
    <nav aria-label="Four-question round" className="dc-practice-steps">{round.questions.map((item,i)=><button key={item.id} type="button" aria-current={i===questionIndex?'step':undefined} onClick={()=>setQuestionIndex(i)}>{i+1}. {KIND_LABEL[item.kind]}</button>)}</nav>
    <article><h4 ref={heading} tabIndex={-1}>{KIND_LABEL[q.kind]} · {questionIndex+1} of 4</h4><p>{q.prompt}</p>
     <label htmlFor={'answer-'+q.id}>Your explanation or code<textarea id={'answer-'+q.id} aria-label="Your practice answer" value={record.draft} maxLength={8000} rows={7} onChange={e=>apply({type:'draft',questionId:q.id,value:e.target.value})}/></label>
     <details key={q.id}><summary>Hint</summary><p>{q.hint}</p></details>
     <button type="button" aria-expanded={record.revealed} onClick={()=>apply({type:'reveal',questionId:q.id,value:!record.revealed})}>{record.revealed?'Hide reference':'Reveal reference'}</button>
     {record.revealed&&<section className="dc-practice-reference" aria-label="Reference explanation"><p>{q.answer}</p>{q.code&&<><p>{q.code.language} · displayed only</p><pre><code>{q.code.text}</code></pre></>}<h5>Check your reasoning</h5><ul>{q.checks.map(c=><li key={c}>{c}</li>)}</ul><p><strong>Common mistake:</strong> {q.pitfall}</p>
      <label>Self-review<select aria-label="Practice self review" value={record.self} onChange={e=>apply({type:'self',questionId:q.id,value:e.target.value as 'unrated'|'revisit'|'explained'})}><option value="unrated">Not reviewed</option><option value="revisit">Revisit this</option><option value="explained">I can explain my answer</option></select></label><p className="dc-practice-note">Your declaration only. Editing the answer clears this self-review.</p></section>}
     <nav className="dc-practice-actions" aria-label="Question navigation"><button type="button" disabled={questionIndex===0} onClick={()=>setQuestionIndex(i=>i-1)}>Previous question</button><button type="button" disabled={questionIndex===3} onClick={()=>setQuestionIndex(i=>i+1)}>Next question</button></nav>
    </article>
    <details><summary>Sources and version assumptions</summary><p>References support concepts. Questions and fictional cases are original teaching content, not employer questions or certification material.</p><ul>{q.sourceIds.map(id=>{const s=bank.sources.find(s=>s.id===id)!;return <li key={id}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a><p>{s.versionScope} Retrieved {s.retrievedOn}.</p></li>;})}</ul></details>
   </main>
   <aside aria-label="Business context"><h4>{context.name}</h4><p><strong>Fictional case.</strong> {context.business}</p><p>{context.decision}</p><ul>{context.constraints.map(c=><li key={c}>{c}</li>)}</ul>
    <details><summary>What we still need to ask</summary>{context.unknowns.map(x=><p key={x}>{x}</p>)}</details>
    <h5>Concept map</h5><ol className="dc-practice-map">{round.diagram.nodes.map((n,i)=><li key={i}>{n}</li>)}</ol><ul className="dc-practice-note">{round.diagram.edges.map(([from,to,label],i)=><li key={i}>{round.diagram.nodes[from]} → {round.diagram.nodes[to]}: {label}</li>)}</ul>
    <p className="dc-practice-note">Teaching structure, not runtime trace or source-derived company architecture.</p>
   </aside>
  </div>
  <footer><p role="status" aria-label="Practice coverage">{coverage.attempted}/{coverage.total} answers started · {coverage.reviewed} self-reviewed. This is coverage, not competency or project progress.</p>{error&&<p role="alert">{error}</p>}
   {!clearAsked?<button type="button" onClick={()=>setClearAsked(true)}>Clear local practice</button>:<div role="group" aria-label="Confirm practice clear"><p>Clear all answers in this practice session?</p><button type="button" onClick={()=>{apply({type:'clear'});setQuestionIndex(0);setClearAsked(false);}}>Confirm clear</button><button type="button" onClick={()=>setClearAsked(false)}>Keep answers</button></div>}
  </footer>
 </section>;
}
