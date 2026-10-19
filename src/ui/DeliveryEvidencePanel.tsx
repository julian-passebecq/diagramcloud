import * as React from 'react';
import {DELIVERY_VIEW_LIMITS, IDENTITY_NOTICE, deliveryEvidence, parseDeliveryView, type DeliveryBlock, type DeliveryView} from '../development/deliveryEvidence';
import {samePerspectiveBinding, type PerspectiveBinding} from '../core/workbenchPerspective';

export type DeliveryEvidencePanelProps = {
  view: DeliveryView | null; audience: 'author' | 'public'; binding: PerspectiveBinding; compact?: boolean; fileName?: string;
  onLoad?: (raw: string, fileName: string, issuedAt: PerspectiveBinding) => void;
  onClear?: () => void;
  onSelectBlock?: (blockId: string, issuedAt: PerspectiveBinding) => void;
};

const LOAD_REFUSAL = 'This delivery plan is invalid or exceeds the supported reading scope. Nothing was changed.';
const minutes = (r: [number, number] | null) => r ? `${r[0]}–${r[1]} min` : 'UNKNOWN (no estimate supplied)';

/**
 * Read-only reading of a supplied delivery plan. It has no dispatch, launch, approve or edit control and never writes the
 * Project. A loaded plan is session state kept by the host; the panel only validates the file before handing it over.
 */
export function DeliveryEvidencePanel(p: DeliveryEvidencePanelProps) {
  const [error, setError] = React.useState<{binding: PerspectiveBinding; message: string} | null>(null);
  const shownError = error && samePerspectiveBinding(error.binding, p.binding) ? error.message : null;
  const issued = (): PerspectiveBinding => ({...p.binding});
  const load = async (input: HTMLInputElement) => {
    const file = input.files?.[0], issuedAt = issued(); input.value = '';
    if (!file || !p.onLoad) return;
    try {
      if (file.size > DELIVERY_VIEW_LIMITS.bytes) throw new Error(LOAD_REFUSAL);
      const raw = await file.text();
      parseDeliveryView(raw);
      setError(null);
      p.onLoad(raw, file.name, issuedAt);
    } catch {setError({binding: issuedAt, message: LOAD_REFUSAL});}
  };
  const loader = p.onLoad ? <label className="dc-evidence-load">Load delivery plan
    <input type="file" accept=".json,application/json" onChange={e => void load(e.currentTarget)}/></label> : null;
  const header = <div className="dc-evidence-heading">
    <div><h2>Delivery evidence</h2><p>Read-only reading of a supplied plan. States are source-declared; nothing here is a run, review, approval or release.</p></div>
    <div className="dc-evidence-actions">{loader}{p.view && p.onClear ? <button type="button" onClick={() => p.onClear!()}>Clear plan</button> : null}</div>
  </div>;
  const alert = shownError ? <p role="alert">{shownError}</p> : null;
  if (!p.view) return <section className="dc-evidence" aria-label="Delivery evidence">{header}{alert}<p>No delivery plan loaded. Load a <code>delivery-view/1</code> JSON file to read it here.</p></section>;

  const e = deliveryEvidence(p.view, p.audience);
  if (e.withheld || !e.view) return <section className="dc-evidence" aria-label="Delivery evidence">{header}{alert}
    <p role="status">This delivery plan is private and is not shown to this audience.</p></section>;
  const v = e.view, owners = new Map(v.owners.map(o => [o.id, o.title]));
  const owner = (id: string | null) => id ? owners.get(id) ?? id : 'No owner supplied';
  const blockButton = (b: Pick<DeliveryBlock, 'id'>) => p.onSelectBlock
    ? <button type="button" className="dc-evidence-link" onClick={() => p.onSelectBlock!(b.id, issued())}>{b.id}</button> : <code>{b.id}</code>;
  const section = (title: string, body: React.ReactNode, open = true) => p.compact
    ? <details className="dc-evidence-section" open={open}><summary>{title}</summary>{body}</details>
    : <section className="dc-evidence-section" aria-label={title}><h3>{title}</h3>{body}</section>;
  const checkpoints = v.blocks.filter(b => b.checkpoint || b.promptRef);

  return <section className="dc-evidence" aria-label="Delivery evidence">
    {header}{alert}
    {section('Source identity', <>
      <dl className="dc-evidence-identity">
        <dt>Title</dt><dd>{v.title}</dd>
        <dt>Captured</dt><dd>{v.capturedAt}</dd>
        {p.fileName ? <><dt>File</dt><dd>{p.fileName}</dd></> : null}
        <dt>Input SHA-256</dt><dd><code>{v.inputSha256}</code></dd>
      </dl>
      <p className="dc-evidence-note">SHA-256 is an {IDENTITY_NOTICE}.</p>
      {v.sourceVector.length ? <table><caption>Source vector</caption><thead><tr><th>Repository</th><th>Ref</th><th>Commit</th><th>Purpose</th></tr></thead>
        <tbody>{v.sourceVector.map((s, i) => <tr key={i}><td>{s.repository}</td><td>{s.ref}</td><td><code>{s.commit}</code></td><td>{s.purpose}</td></tr>)}</tbody></table>
        : <p>No source vector supplied.</p>}
      {v.sources.length ? <table><caption>Cited sources</caption><thead><tr><th>Source</th><th>Basis</th><th>Checked</th></tr></thead>
        <tbody>{v.sources.map(s => <tr key={s.id}><td>{s.title} <code>{s.id}</code></td><td>{s.basis}</td><td>{s.checkedAt ?? 'UNKNOWN'}</td></tr>)}</tbody></table> : null}
      {checkpoints.length ? <table><caption>Checkpoint and prompt references (supplied text)</caption><thead><tr><th>Block</th><th>Checkpoint</th><th>Prompt</th></tr></thead>
        <tbody>{checkpoints.map(b => <tr key={b.id}><td>{blockButton(b)}</td><td>{b.checkpoint ?? '—'}</td><td>{b.promptRef ?? '—'}</td></tr>)}</tbody></table> : null}
      {v.ignoredFields.length ? <p className="dc-evidence-note">Fields not read: {v.ignoredFields.join(', ')}.</p> : null}
    </>)}
    {section('Blocks', <div className="dc-evidence-scroll" tabIndex={0} aria-label="Plan blocks">
      <table><thead><tr><th>Block</th><th>Title</th><th>State (source-declared)</th><th>Owner</th><th>Depends on</th><th>Acceptance IDs</th></tr></thead>
        <tbody>{v.blocks.map(b => <tr key={b.id}><td>{blockButton(b)}</td><td>{b.title}</td><td>{b.state}</td><td>{owner(b.ownerId)}</td>
          <td>{b.dependsOn.join(', ') || 'None supplied'}</td><td>{b.acceptanceIds.join(', ') || 'None supplied'}</td></tr>)}</tbody></table>
    </div>)}
    {section('Owner conflicts', e.conflicts.length ? <ul className="dc-evidence-list">{e.conflicts.map((c, i) => <li key={i}>
      <strong>{c.ordered ? 'Sequential (dependency order)' : 'Unordered overlap'}</strong>{' '}
      <code>{c.repository}:{c.path}</code> written by {blockButton({id: c.blockIds[0]})} ({owner(c.owners[0])}) and {blockButton({id: c.blockIds[1]})} ({owner(c.owners[1])}).
      {c.ordered ? ' One block depends on the other; this is an order, not proof that the writes are compatible.' : ' No dependency orders these writes.'}
    </li>)}</ul> : <p>No overlapping write filesets in the supplied plan. Titles and owners alone are never read as a conflict.</p>)}
    {section('Named gaps', <ul className="dc-evidence-list">{e.gaps.map((g, i) => <li key={i}><code>{g.code}</code> {g.blockId ? blockButton({id: g.blockId}) : null} {g.message}</li>)}</ul>, !p.compact)}
    {section('Remaining effort', <>
      <dl className="dc-evidence-identity">
        <dt>Sum of unfinished blocks</dt><dd>{minutes(e.remaining.sumMinutes)}</dd>
        <dt>Dependency lower bound</dt><dd>{minutes(e.remaining.dependencyLowerBoundMinutes)}</dd>
        <dt>Without estimate</dt><dd>{e.remaining.unestimated.join(', ') || 'None'}</dd>
        <dt>Calendar</dt><dd>{e.remaining.calendar}</dd>
      </dl>
      <p className="dc-evidence-note" role="note">{e.remaining.notice}</p>
    </>)}
    {section('Dated intervals', e.intervals.length ? <table><thead><tr><th>Block</th><th>Start</th><th>End</th><th>Time zone</th><th>Basis</th><th>Sources</th></tr></thead>
      <tbody>{e.intervals.map(({blockId, interval: x}) => <tr key={blockId}><td>{blockButton({id: blockId})}</td><td>{x.start}</td><td>{x.end}</td><td>{x.timezone ?? 'Not supplied'}</td><td>{x.basis}</td><td>{x.sourceIds.join(', ') || 'None'}</td></tr>)}</tbody></table>
      : <p>No dated interval supplied. When the work happened is unknown.</p>)}
    {section('Result and artifact references', e.results.length ? <table><thead><tr><th>Block</th><th>Kind</th><th>Reference</th><th>Link</th><th>Basis</th><th>Sources</th></tr></thead>
      <tbody>{e.results.map(({blockId, ref}, i) => <tr key={i}><td>{blockButton({id: blockId})}</td><td>{ref.kind}</td><td>{ref.ref}</td><td>{ref.url ?? ''}</td><td>{ref.basis}</td><td>{ref.sourceIds.join(', ') || 'None'}</td></tr>)}</tbody></table>
      : <p>No result or artifact reference supplied.</p>)}
  </section>;
}
