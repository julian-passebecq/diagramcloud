import * as React from 'react';
import {HISTORY_QUESTIONS, HISTORY_QUESTION_LABELS, HISTORY_SLICE_LIMITS, answerHistoryQuestion, parseHistorySlice, projectHistory,
  type HistoryAnswer, type HistoryQuery, type HistoryQuestion, type HistorySlice, type RevisionRef} from '../development/historyLens';
import {samePerspectiveBinding, type PerspectiveBinding} from '../core/workbenchPerspective';
// Styles: perspectiveBar.css is loaded by PerspectiveBar in the App bundle; this panel imports no CSS so node tests can render it.
export type HistoryLensControls = {binding: PerspectiveBinding; query: HistoryQuery};
const LOAD_REFUSAL = 'These history records are invalid or exceed the supported reading scope. Nothing was changed.';

/** The answer of one non-ancestry question: lists and groups only, never edges. */
function QuestionAnswer({answer, compact, onSelectComponent}: {answer: HistoryAnswer; compact?: boolean; onSelectComponent?: (componentId: string) => void}) {
  const titles = new Map(answer.rows.map(r => [r.key, `${r.ref.repository} / ${r.ref.id}: ${r.title}`]));
  const name = (key: string) => titles.get(key) ?? key;
  const body = !answer.answerable
    ? <p role="status">Not answerable from the supplied records. Missing: {answer.missing.join(', ')}. Missing data is not proof that nothing happened.</p>
    : <>
      {answer.question === 'attempts' ? <>
        <ol className="dc-history-answer-list">{answer.rows.map(r => <li key={r.key}><span>{r.occurredAt}</span> {r.ref.repository} / {r.ref.id}: {r.title} <small>{r.basis}</small></li>)}</ol>
        {answer.unresolved.length ? <p>Without a recorded time (not placed in the order): {answer.unresolved.map(name).join('; ')}</p> : null}
      </> : null}
      {answer.question === 'impact' ? <>
        {answer.componentMatches.length ? <ul className="dc-history-answer-list">{answer.componentMatches.map(m => <li key={m.componentId}>
          {onSelectComponent ? <button type="button" onClick={() => onSelectComponent(m.componentId)}>{m.componentId}</button> : <code>{m.componentId}</code>}
          {' '}named by {m.recordKeys.map(name).join('; ')}</li>)}</ul> : <p>No supplied value equals a permitted component ID.</p>}
        {answer.unresolved.length ? <p>Unresolved (not a permitted component ID): {answer.unresolved.join(', ')}</p> : null}
      </> : null}
      {answer.question === 'associations' || answer.question === 'lineage' ? <ul className="dc-history-answer-list">{answer.groups.map(g => <li key={g.facet + '\u0000' + g.value}>
        <strong>{g.facet}: {g.value}</strong> {g.recordKeys.map(name).join('; ')}</li>)}</ul> : null}
      {answer.missing.length ? <p>Not supplied: {answer.missing.join(', ')}.</p> : null}
    </>;
  const content = <>{body}<p className="dc-history-notice">{answer.notice}</p></>;
  return compact ? <details className="dc-history-answer" open><summary>{HISTORY_QUESTION_LABELS[answer.question]}</summary>{content}</details>
    : <section className="dc-history-answer" aria-label={HISTORY_QUESTION_LABELS[answer.question]}><h3>{HISTORY_QUESTION_LABELS[answer.question]}</h3>{content}</section>;
}

/** A bounded read-only lane view and accessible list. Source adapters supply facts, not this component. */
export function HistoryLensPanel(p: {compact?: boolean; slice: HistorySlice; controls: HistoryLensControls; binding: PerspectiveBinding;
  onQuery: (query: HistoryQuery, issuedAt: PerspectiveBinding) => void;
  onSelect: (ref: RevisionRef, issuedAt: PerspectiveBinding) => void;
  question?: HistoryQuestion; onQuestion?: (q: HistoryQuestion, issuedAt: PerspectiveBinding) => void;
  componentIds?: readonly string[]; onSelectComponent?: (componentId: string, issuedAt: PerspectiveBinding) => void;
  onLoadSlice?: (raw: string, issuedAt: PerspectiveBinding) => void}) {
  const [loadError, setLoadError] = React.useState<{binding: PerspectiveBinding; message: string} | null>(null);
  const query = samePerspectiveBinding(p.controls.binding, p.binding) ? p.controls.query : {};
  const loader = p.onLoadSlice ? <label className="dc-history-load">Load history records
    <input type="file" accept=".json,application/json" onChange={e => {
      const input = e.currentTarget, file = input.files?.[0], issuedAt = {...p.binding}; input.value = '';
      if (!file) return;
      void (async () => {
        try {
          if (file.size > HISTORY_SLICE_LIMITS.bytes) throw new Error(LOAD_REFUSAL);
          const raw = await file.text(); parseHistorySlice(raw); setLoadError(null); p.onLoadSlice!(raw, issuedAt);
        } catch {setLoadError({binding: issuedAt, message: LOAD_REFUSAL});}
      })();
    }}/></label> : null;
  const loadAlert = loadError && samePerspectiveBinding(loadError.binding, p.binding) ? <p role="alert">{loadError.message}</p> : null;
  let result: ReturnType<typeof projectHistory>;
  try {result = projectHistory(p.slice, query, p.binding.audience);} catch {
    return <section className="dc-history" aria-label="Change history"><p role="alert">This history cannot be shown safely. The project remains unchanged.</p>{loader}{loadAlert}</section>;
  }
  const question = p.question && HISTORY_QUESTIONS.includes(p.question) ? p.question : undefined;
  let answer: HistoryAnswer | null = null;
  if (question && question !== 'ancestry') {
    try {answer = answerHistoryQuestion(p.slice, question, p.binding.audience, p.componentIds);} catch {answer = null;}
  }
  const send = (q: HistoryQuery) => p.onQuery(q, {...p.binding});
  const facet = (name: 'feature' | 'role', value: string) => {
    const facets = {...query.facets};
    if (value) facets[name] = {values:[value]}; else delete facets[name];
    send({...query, facets, offset:0});
  };
  const height = result.rows.length * 52, width = Math.max(62, (result.lanes + 1) * 22);
  const points = new Map(result.rows.map((r,i) => [r.key, {x:22+r.lane*22, y:i*52+26}]));
  const questionSelect = p.onQuestion ? <label>History question<select aria-label="History question" value={question ?? 'ancestry'}
    onChange={e => p.onQuestion!(e.currentTarget.value as HistoryQuestion, {...p.binding})}>
    {HISTORY_QUESTIONS.map(q => <option key={q} value={q}>{HISTORY_QUESTION_LABELS[q]}</option>)}</select></label> : null;
  const filters = <div className="dc-history-filters" role="group" aria-label="History filters">
      <label>Search<input aria-label="Search change history" value={query.text ?? ''} placeholder="Message, actor or revision" onChange={e => send({...query,text:e.currentTarget.value,offset:0})}/></label>
      {(['feature','role'] as const).map(f => <label key={f}>{f === 'feature' ? 'Feature' : 'Contributor role'}<select aria-label={'Filter '+f} value={query.facets?.[f]?.values[0] ?? ''} onChange={e => facet(f,e.currentTarget.value)}>
        <option value="">All supplied values</option>{result.availableFacets[f].values.map(v => <option key={v} value={v}>{v}</option>)}</select></label>)}
      <button type="button" onClick={() => send({limit:query.limit ?? 100})}>Clear filters</button>
    </div>;
  return <section className="dc-history" aria-label="Change history">
    <div className="dc-history-heading"><div><h2>Change history</h2><p>Native ancestry and source-linked work. Not a productivity score or a live agent monitor.</p></div><span className="dc-badge">{result.coverage}</span></div>
    {questionSelect || loader ? <div className="dc-history-filters" role="group" aria-label="History question and records">{questionSelect}{loader}</div> : null}
    {loadAlert}
    {question && question !== 'ancestry' ? (answer
      ? <QuestionAnswer answer={answer} compact={p.compact} onSelectComponent={p.onSelectComponent ? id => p.onSelectComponent!(id, {...p.binding}) : undefined}/>
      : <p role="alert">This question cannot be answered safely from these records. The project remains unchanged.</p>) : null}
    {p.compact ? <details className="dc-compact-filters"><summary>History filters{query.text || Object.keys(query.facets ?? {}).length ? ' (active)' : ''}</summary>{filters}</details> : filters}
    <p className="dc-history-status" role="status">{result.matched} matching records in {result.permitted} permitted supplied records. {result.coverage !== 'complete-in-scope' ? 'Upstream completeness is not established.' : 'Complete only within the supplied source scope.'}</p>
    {result.rows.length ? <div className="dc-history-scroll" tabIndex={0} aria-label="History lanes and records">
      <div className="dc-history-chart" style={{minWidth:width+370}}>
        <svg aria-hidden="true" width={width} height={height} className="dc-history-lanes">
          {result.edges.map((edge,i) => {const a=points.get(edge.child)!,b=points.get(edge.parent)!;return <path key={i} d={`M ${a.x} ${a.y} C ${a.x} ${a.y+26} ${b.x} ${b.y-26} ${b.x} ${b.y}`} fill="none" stroke="currentColor" strokeWidth="1.5"/>;})}
          {result.rows.map(r=>{const point=points.get(r.key)!;return <g key={r.key}><circle cx={point.x} cy={point.y} r={r.kind==='revision'?5:3} fill="var(--dc-surface,white)" stroke="currentColor" strokeWidth="2"/>{r.ancestry==='boundary'&&<path d={`M ${point.x} ${point.y+7} v 13`} stroke="currentColor" strokeDasharray="2 3"/>}</g>;})}
        </svg>
        <ol className="dc-history-rows">{result.rows.map(r=><li key={r.key}>
          <button type="button" onClick={()=>p.onSelect({...r.ref},{...p.binding})} title={r.title}><span>{r.title}</span><small>{r.ref.repository} / {r.ref.id} <b>{r.kind}</b></small></button>
          <span className="dc-ancestry" title="Boundary means one or more direct parents are not shown; it does not name or count them.">{r.ancestry}<small>{r.basis}</small></span>
        </li>)}</ol>
      </div>
    </div> : <p>No matching records in the supplied scope. Missing data is not proof that no work occurred.</p>}
    <div className="dc-history-footer"><span>Captured {result.capturedAt}</span><div>
      <button type="button" disabled={result.offset===0} onClick={()=>send({...query,offset:Math.max(0,result.offset-(query.limit??100))})}>Previous page</button>
      <button type="button" disabled={!result.hasMore} onClick={()=>send({...query,offset:result.offset+(query.limit??100)})}>Next page</button>
    </div></div>
  </section>;
}
