import * as React from 'react';
import type {Project} from '../core/model';
import type {Patch} from '../core/patch';
import {samePerspectiveBinding, type PerspectiveBinding} from '../core/workbenchPerspective';
import {inspectJoin, joinInspectionPatch, readJoinEvidence, type JoinEvidenceView, type JoinInspection} from '../intelligence/joinInspection';

export type JoinInspectionPanelProps = {doc: Project; nodeId: string; binding: PerspectiveBinding; compact?: boolean; onOpenBlock?: (blockId: string) => void};
export type JoinRequestPanelProps = {project: Project; nodeId: string | null; binding: PerspectiveBinding; onStage: (patch: Patch, issuedAt: PerspectiveBinding) => void};

const MAX_REQUEST_BYTES = 1048576;
const value = (v: string | number | null) => v === null ? 'UNKNOWN' : String(v);

/** The shared reading, in a fixed order: inputs, output, measure, fanout, loss, grain, provenance, limits, synthetic label. */
function JoinEvidenceBody({v, compact, onOpenBlock}: {v: Omit<JoinEvidenceView, 'blockIds'> & {blockIds: string[]}; compact?: boolean; onOpenBlock?: (blockId: string) => void}) {
  const fanout = v.perLeft.filter(r => r.matches > 1);
  const perRow = <ul className="dc-evidence-list">{v.perLeft.map(r => <li key={r.rowId}>
    <code>{r.rowId}</code> → {r.rightMatchIds.length ? r.rightMatchIds.join(', ') : 'no match'} ({r.outputRows} output {r.outputRows === 1 ? 'row' : 'rows'})</li>)}</ul>;
  return <>
    <dl className="dc-evidence-identity">
      <dt>Input rows</dt><dd>left {v.inputRows.left}, right {v.inputRows.right}</dd>
      <dt>Output rows</dt><dd>{v.outputRows}{v.previewOmitted ? ` (${v.previewOmitted} not in the stored preview)` : ''}</dd>
      <dt>Measure before → after</dt><dd>{v.measure ? `${value(v.measure.before)} → ${value(v.measure.after)}` : 'No measure supplied'}</dd>
      <dt>Fanout rows</dt><dd>{fanout.length ? fanout.map(r => `${r.rowId} (${r.matches} matches)`).join(', ') : 'None within these supplied rows'}</dd>
      <dt>Unmatched left rows</dt><dd>{v.unmatchedLeft.join(', ') || 'None within these supplied rows'}</dd>
      <dt>Grain violations</dt><dd>{v.grainViolations.join(', ') || 'None within these supplied rows'}</dd>
    </dl>
    {!v.consistent ? <p role="alert" className="dc-evidence-flag">The mapping rows do not add up to the calculated output rows. Shown as stored; nothing was repaired.</p> : null}
    {compact ? <details><summary>Per-row provenance</summary>{perRow}</details> : <><h4>Per-row provenance</h4>{perRow}</>}
    {compact ? <details><summary>Limits</summary><ul className="dc-evidence-list">{v.limits.map((l, i) => <li key={i}>{l}</li>)}</ul></details>
      : <><h4>Limits</h4><ul className="dc-evidence-list">{v.limits.map((l, i) => <li key={i}>{l}</li>)}</ul></>}
    {v.provenance === 'synthetic' ? <p className="dc-evidence-flag">Synthetic rows: illustrative, not a measured or production result.</p>
      : <p className="dc-evidence-note">Source-derived rows, calculated over the supplied rows only.</p>}
    {v.blockIds.length ? <p className="dc-evidence-note">Evidence blocks: {v.blockIds.map((id, i) => <React.Fragment key={id}>{i ? ', ' : ''}
      {onOpenBlock ? <button type="button" className="dc-evidence-link" onClick={() => onOpenBlock(id)}>{id}</button> : <code>{id}</code>}</React.Fragment>)}</p> : null}
  </>;
}

/** Read-only join evidence for the selected component. Renders nothing unless the permitted document holds all six blocks. */
export function JoinInspectionPanel(p: JoinInspectionPanelProps) {
  const v = readJoinEvidence(p.doc, p.nodeId);
  if (!v) return null;
  return <section className="dc-evidence" aria-label="Join evidence">
    <div className="dc-evidence-heading"><div><h2>Join evidence</h2><p>Calculated over the supplied rows; no SQL or database was run.</p></div></div>
    <JoinEvidenceBody v={v} compact={p.compact} onOpenBlock={p.onOpenBlock}/>
  </section>;
}

/** Edit mode only: reads a join request file, shows the calculation, and stages it as a patch for the ordinary review. */
export function JoinRequestPanel(p: JoinRequestPanelProps) {
  const [state, setState] = React.useState<{binding: PerspectiveBinding; result: JoinInspection | null; error: string | null; fileName: string} | null>(null);
  const current = state && samePerspectiveBinding(state.binding, p.binding) ? state : null;
  const load = async (input: HTMLInputElement) => {
    const file = input.files?.[0], issuedAt = {...p.binding}; input.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_REQUEST_BYTES) throw new Error('Join inspection refused: the request file exceeds 1 MiB');
      const result = inspectJoin(JSON.parse(await file.text()));
      setState({binding: issuedAt, result, error: null, fileName: file.name});
    } catch (e) {
      const message = e instanceof Error && e.message.startsWith('Join inspection refused') ? e.message : 'This join request is invalid. Nothing was changed.';
      setState({binding: issuedAt, result: null, error: message, fileName: file.name});
    }
  };
  let stageError: string | null = null, patch: Patch | null = null;
  if (current?.result && p.nodeId) {
    try {patch = joinInspectionPatch(p.project, p.nodeId, current.result);} catch (e) {stageError = e instanceof Error ? e.message : 'This join evidence cannot be staged.';}
  }
  const r = current?.result;
  return <section className="dc-evidence" aria-label="Inspect a join">
    <div className="dc-evidence-heading"><div><h2>Inspect a join</h2><p>Reads a join request file and calculates over its supplied rows. Nothing is executed or applied.</p></div>
      <label className="dc-evidence-load">Load join request<input type="file" accept=".json,application/json" onChange={e => void load(e.currentTarget)}/></label></div>
    {current?.error ? <p role="alert">{current.error}</p> : null}
    {r ? <>
      <p className="dc-evidence-note">{current!.fileName}: {r.request.title} ({r.coverage === 'sample' ? 'sample rows' : 'declared complete, not verified'})</p>
      <JoinEvidenceBody v={{prefix: r.request.id, nodeId: p.nodeId ?? '', provenance: r.request.provenance, blockIds: [], inputRows: r.inputRows,
        outputRows: r.outputRows, previewOmitted: r.previewOmitted, measure: r.measure ? {before: r.measure.before, after: r.measure.after} : null,
        unmatchedLeft: r.unmatchedLeft, grainViolations: r.grainViolations,
        perLeft: r.perLeft.map(x => ({rowId: x.rowId, rightMatchIds: x.rightRowIds, matches: x.matches, outputRows: x.outputRows})), limits: r.limits, consistent: true}}/>
      {!p.nodeId ? <p role="status">Select a component to attach this evidence to.</p> : null}
      {stageError ? <p role="alert">{stageError}</p> : null}
      <button type="button" disabled={!patch} onClick={() => {if (patch) p.onStage(patch, {...p.binding});}}>Stage as evidence</button>
      <p className="dc-evidence-note">Staging opens the ordinary review: six private evidence blocks, one revision, one Undo.</p>
    </> : null}
  </section>;
}
