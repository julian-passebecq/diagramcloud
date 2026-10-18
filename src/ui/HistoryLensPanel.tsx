import * as React from 'react';
import {projectHistory, type HistoryQuery, type HistorySlice, type RevisionRef} from '../development/historyLens';
import {samePerspectiveBinding, type PerspectiveBinding} from '../core/workbenchPerspective';
import './perspectiveBar.css';
export type HistoryLensControls = {binding: PerspectiveBinding; query: HistoryQuery};
/** A bounded read-only lane view and accessible list. Source adapters supply facts, not this component. */
export function HistoryLensPanel(p: {compact?: boolean; slice: HistorySlice; controls: HistoryLensControls; binding: PerspectiveBinding;
  onQuery: (query: HistoryQuery, issuedAt: PerspectiveBinding) => void;
  onSelect: (ref: RevisionRef, issuedAt: PerspectiveBinding) => void}) {
  const query = samePerspectiveBinding(p.controls.binding, p.binding) ? p.controls.query : {};
  let result: ReturnType<typeof projectHistory>;
  try {result = projectHistory(p.slice, query, p.binding.audience);} catch {
    return <section className="dc-history" aria-label="Change history"><p role="alert">This history cannot be shown safely. The project remains unchanged.</p></section>;
  }
  const send = (q: HistoryQuery) => p.onQuery(q, {...p.binding});
  const facet = (name: 'feature' | 'role', value: string) => {
    const facets = {...query.facets};
    if (value) facets[name] = {values:[value]}; else delete facets[name];
    send({...query, facets, offset:0});
  };
  const height = result.rows.length * 52, width = Math.max(62, (result.lanes + 1) * 22);
  const points = new Map(result.rows.map((r,i) => [r.key, {x:22+r.lane*22, y:i*52+26}]));
  const filters = <div className="dc-history-filters" role="group" aria-label="History filters">
      <label>Search<input aria-label="Search change history" value={query.text ?? ''} placeholder="Message, actor or revision" onChange={e => send({...query,text:e.currentTarget.value,offset:0})}/></label>
      {(['feature','role'] as const).map(f => <label key={f}>{f === 'feature' ? 'Feature' : 'Contributor role'}<select aria-label={'Filter '+f} value={query.facets?.[f]?.values[0] ?? ''} onChange={e => facet(f,e.currentTarget.value)}>
        <option value="">All supplied values</option>{result.availableFacets[f].values.map(v => <option key={v} value={v}>{v}</option>)}</select></label>)}
      <button type="button" onClick={() => send({limit:query.limit ?? 100})}>Clear filters</button>
    </div>;
  return <section className="dc-history" aria-label="Change history">
    <div className="dc-history-heading"><div><h2>Change history</h2><p>Native ancestry and source-linked work. Not a productivity score or a live agent monitor.</p></div><span className="dc-badge">{result.coverage}</span></div>
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
