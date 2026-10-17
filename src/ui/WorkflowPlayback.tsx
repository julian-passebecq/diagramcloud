import {useMemo, useState} from 'react';
import type {Project} from '../core/model';
import {PLAYBACK_LABEL, playbackFrame, procedurePlayback} from '../intelligence/learning/playback';

export const NO_RUN_DATA = 'No run data: times and outcome UNKNOWN';
/**
 * "Play declared steps" on a project view (V2 AC08): walks the view's declared procedure (one unbranched chain of
 * control connections) with the same playback module as lessons. A presented sequence: it only moves the selection,
 * never changes status, observations or the document revision, and never records a run, attempt or timing.
 */
export function WorkflowPlayback({project, viewId, publicMode = false, onStep}: {project: Project; viewId: string; publicMode?: boolean; onStep?: (nodeId: string) => void}) {
  const source = useMemo(() => {try {return procedurePlayback(project, viewId, {audience: publicMode ? 'public' : 'author'});} catch {return null;}}, [project, viewId, publicMode]);
  const [index, setIndex] = useState<number | null>(null);
  const go = (i: number) => {if (!source) return; const frame = playbackFrame(source, i); setIndex(frame.index); if (frame.step.nodeId) onStep?.(frame.step.nodeId);};
  const frame = source && index !== null ? playbackFrame(source, index) : null;
  return <section className="workflow-playback" aria-label="Declared workflow playback" style={{minWidth: 0, margin: '12px 0', overflowWrap: 'anywhere'}}>
    <h3>Declared steps</h3>
    {!source ? <p className="micro">This view does not declare one unbranched sequence of control connections through all of its components, so there are no declared steps to play. No order is invented.</p> : <>
      <p className="micro">{source.origin}</p>
      {!frame ? <button type="button" onClick={() => go(0)}>Play declared steps</button> : <>
        <p role="status" aria-label="Playback state"><strong>{PLAYBACK_LABEL}</strong> · {frame.position} · {frame.step.label}</p>
        <p>{NO_RUN_DATA}</p>
        <div className="pi-controls">
          <button type="button" disabled={frame.atStart} onClick={() => go(frame.index - 1)}>Previous step</button>
          <button type="button" disabled={frame.atEnd} onClick={() => go(frame.index + 1)}>Next step</button>
          <button type="button" onClick={() => setIndex(null)}>Stop playback</button>
        </div>
      </>}
      <ol aria-label="Declared step order">{source.steps.map((s, i) => <li key={s.id} aria-current={frame?.index === i ? 'step' : undefined}>{frame?.index === i ? <strong>{s.label}</strong> : s.label}</li>)}</ol>
    </>}
  </section>;
}
