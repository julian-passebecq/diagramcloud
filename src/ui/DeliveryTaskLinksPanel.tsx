import * as React from 'react';
import {PM_TASK_IMPORT_LIMITS} from '../development/pmTasks';
import {readDeliveryJsonFile, type DeliveryView} from '../development/deliveryEvidence';
import {loadDeliveryTaskInventory, resolveDeliveryTaskInventoryLinks, TASK_LINK_NOTICE, TASK_INVENTORY_LIMITS, type DeliveryTaskSnapshot} from '../development/deliveryTaskLinks';

/** Mounted with a source/audience/epoch key by the existing plan panel. No Project edit, network or persistent task store. */
export function DeliveryTaskLinksPanel(p: {plan: DeliveryView; audience: 'author' | 'public'}) {
  const [snapshots, setSnapshots] = React.useState<DeliveryTaskSnapshot[]>([]);
  const inventory = React.useRef(snapshots); inventory.current = snapshots;
  const loadInput = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const request = React.useRef(0);
  React.useEffect(() => () => {request.current++;}, []);
  if (p.audience !== 'author') return <p>PM task details are private and are available in author mode only.</p>;
  const read = async (input: HTMLInputElement, mode: 'replace' | 'append') => {
    const file = input.files?.[0], generation = ++request.current; input.value = '';
    if (!file) return;
    try {
      if (file.size > PM_TASK_IMPORT_LIMITS.bytes) throw new Error('size');
      const raw = await readDeliveryJsonFile(file);
      if (generation !== request.current) return;
      const next = loadDeliveryTaskInventory(inventory.current, raw, mode);
      inventory.current = next; setSnapshots(next); setError(null);
    } catch (e) {
      if (generation === request.current) setError(e instanceof Error && /^(These exact task bytes|The task inventory)/.test(e.message) ? e.message : 'This task snapshot is invalid or exceeds the supported reading scope. The previous valid snapshot is retained.');
    }
  };
  const remove = (digest?: string) => {request.current++; const next = digest ? inventory.current.filter(s => s.inputSha256 !== digest) : []; inventory.current = next; setSnapshots(next); setError(null); loadInput.current?.focus();};
  const r = resolveDeliveryTaskInventoryLinks(p.plan, snapshots, p.audience);
  return <div className="dc-task-links">
    <p>{TASK_LINK_NOTICE}</p>
    <p>Load replaces the current inventory. Add retains other snapshots. Each task reference resolves only against its exact supplied bytes, scope and revision. Up to {TASK_INVENTORY_LIMITS.snapshots} snapshots / 1 MiB, session only.</p>
    <div className="dc-evidence-actions"><label>Load PM task snapshot<input ref={loadInput} type="file" accept=".json,application/json" onChange={e => void read(e.currentTarget, 'replace')}/></label>
      <label>Add PM task snapshot<input type="file" accept=".json,application/json" onChange={e => void read(e.currentTarget, 'append')}/></label>
      {snapshots.length ? <button type="button" onClick={() => remove()}>Clear task snapshot</button> : null}</div>
    {error ? <p role="alert">{error}</p> : null}
    {snapshots.length ? <section aria-label="Loaded PM task snapshots"><h4>Loaded task snapshots</h4><p>{snapshots.length} snapshots · {snapshots.reduce((n,s)=>n+s.inputBytes,0)} supplied UTF-8 bytes. Removing one does not select a newer or similar source.</p>
      <ul>{snapshots.map(s => <li key={s.inputSha256}><details><summary>{s.document.scope.projectId} / {s.document.scope.repoId} · revision {s.document.revision} · {s.inputSha256.slice(0,12)}</summary>
        <p>Organization: {s.document.scope.organizationId} · privacy domain: {s.document.scope.privacyDomainId}</p><p>Input SHA-256 <code style={{overflowWrap:'anywhere'}}>{s.inputSha256}</code> · {s.document.tasks.length} supplied tasks · {s.inputBytes} bytes.</p></details>
        <button type="button" aria-label={`Remove task snapshot ${s.inputSha256}`} onClick={() => remove(s.inputSha256)}>Remove snapshot</button></li>)}</ul></section> : <p>No task snapshot loaded. No PM connection is attempted.</p>}
    {r.links.length ? <div className="dc-evidence-scroll" tabIndex={0}><table><caption>Explicit block-to-task correspondence</caption>
      <thead><tr><th>Plan block</th><th>Scoped task</th><th>Binding</th><th>Task declaration</th></tr></thead>
      <tbody>{r.links.map((link, i) => <tr key={i}><td><code>{link.blockId}</code></td><td><code>{link.taskId}</code><p>{link.expected.scope.projectId} / {link.expected.scope.repoId} · revision {link.expected.revision}</p><code style={{overflowWrap:'anywhere'}}>{link.expected.inputSha256}</code></td><td>{link.state}</td><td>
        {link.task ? <><strong>{link.task.title}</strong><p>State: {link.task.state}; review: {link.task.reviewStatus} (source-declared)</p><p>Updated: {link.task.updatedAt}</p>
          <p>Acceptance IDs: {link.task.acceptanceIds.join(', ') || 'None supplied'}</p><p>{link.task.description}</p></> : 'No task content bound'}
      </td></tr>)}</tbody></table></div> : <p>No explicit PM task mappings supplied. Equal titles or IDs are not enough.</p>}
    {r.unmappedBlocks.length ? <p>Unmapped blocks: {r.unmappedBlocks.join(', ')}. No task or result has been inferred.</p> : null}
  </div>;
}
