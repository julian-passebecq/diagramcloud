import * as React from 'react';
import {PM_TASK_IMPORT_LIMITS} from '../development/pmTasks';
import {readDeliveryJsonFile, type DeliveryView} from '../development/deliveryEvidence';
import {readDeliveryTaskSnapshot, resolveDeliveryTaskLinks, TASK_LINK_NOTICE, type DeliveryTaskSnapshot} from '../development/deliveryTaskLinks';

/** Mounted with a source/audience/epoch key by the existing plan panel. No Project edit, network or persistent task store. */
export function DeliveryTaskLinksPanel(p: {plan: DeliveryView; audience: 'author' | 'public'}) {
  const [snapshot, setSnapshot] = React.useState<DeliveryTaskSnapshot | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const request = React.useRef(0);
  React.useEffect(() => () => {request.current++;}, []);
  if (p.audience !== 'author') return <p>PM task details are private and are available in author mode only.</p>;
  const read = async (input: HTMLInputElement) => {
    const file = input.files?.[0], generation = ++request.current; input.value = '';
    if (!file) return;
    try {
      if (file.size > PM_TASK_IMPORT_LIMITS.bytes) throw new Error('size');
      const next = readDeliveryTaskSnapshot(await readDeliveryJsonFile(file));
      if (generation !== request.current) return;
      setSnapshot(next); setError(null);
    } catch {
      if (generation === request.current) setError('This task snapshot is invalid or exceeds the supported reading scope. The previous valid snapshot is retained.');
    }
  };
  const r = resolveDeliveryTaskLinks(p.plan, snapshot, p.audience);
  return <div className="dc-task-links">
    <p>{TASK_LINK_NOTICE}</p>
    <div className="dc-evidence-actions"><label>Load PM task snapshot<input type="file" accept=".json,application/json" onChange={e => void read(e.currentTarget)}/></label>
      {snapshot ? <button type="button" onClick={() => {request.current++; setSnapshot(null); setError(null);}}>Clear task snapshot</button> : null}</div>
    {error ? <p role="alert">{error}</p> : null}
    {snapshot ? <p>Loaded task revision {snapshot.document.revision}. Input SHA-256 <code>{snapshot.inputSha256}</code>. Session only.</p> : <p>No task snapshot loaded. No PM connection is attempted.</p>}
    {r.links.length ? <div className="dc-evidence-scroll" tabIndex={0}><table><caption>Explicit block-to-task correspondence</caption>
      <thead><tr><th>Plan block</th><th>Scoped task</th><th>Binding</th><th>Task declaration</th></tr></thead>
      <tbody>{r.links.map((link, i) => <tr key={i}><td><code>{link.blockId}</code></td><td><code>{link.taskId}</code></td><td>{link.state}</td><td>
        {link.task ? <><strong>{link.task.title}</strong><p>State: {link.task.state}; review: {link.task.reviewStatus} (source-declared)</p><p>Updated: {link.task.updatedAt}</p>
          <p>Acceptance IDs: {link.task.acceptanceIds.join(', ') || 'None supplied'}</p><p>{link.task.description}</p></> : 'No task content bound'}
      </td></tr>)}</tbody></table></div> : <p>No explicit PM task mappings supplied. Equal titles or IDs are not enough.</p>}
    {r.unmappedBlocks.length ? <p>Unmapped blocks: {r.unmappedBlocks.join(', ')}. No task or result has been inferred.</p> : null}
  </div>;
}
