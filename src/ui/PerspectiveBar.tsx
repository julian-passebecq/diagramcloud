import * as React from 'react';
import {DESTINATIONS, DESTINATION_TOPICS, TASKS, BUILDER_LEVELS, samePerspectiveBinding,
  type PerspectiveBinding, type PerspectiveChange, type PerspectiveSupport, type WorkbenchPerspective} from '../core/workbenchPerspective';
import './perspectiveBar.css';
const label = (s: string) => s.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
/** Controlled, two-level navigation. Events request a change; the native App owns routes and permissions. */
export function PerspectiveBar(p: {compact?: boolean; state: WorkbenchPerspective; support: PerspectiveSupport;
  onChange: (change: PerspectiveChange, issuedAt: PerspectiveBinding) => void}) {
  const {state: s, support} = p;
  if (!samePerspectiveBinding(s.binding, support.binding)) return <nav className="dc-perspective" aria-label="Workspace navigation"><p role="status">Workspace context changed. Reading controls are being reconciled.</p></nav>;
  const send = (change: PerspectiveChange) => p.onChange(change, {...s.binding});
  const catalogue = s.destination === 'catalogue';
  const controls = <div className="dc-reading-controls" role="group" aria-label="Reading perspective">
        <label>Task<select aria-label="Reading task" value={s.task} onChange={e => send({type:'task',value:e.currentTarget.value as typeof s.task})}>{TASKS.map(t => <option key={t} value={t} disabled={!support.tasks.includes(t)}>{label(t)}</option>)}</select></label>
        <label>Viewpoint<select aria-label="Viewpoint" value={s.lens} onChange={e => send({type:'lens',value:e.currentTarget.value})}>
          {!s.lens && <option value="">Choose an available view</option>}{support.lenses.map(c => <option key={c.id} value={c.id} disabled={c.state !== 'available'}>{c.label}{c.state !== 'available' ? ' - '+c.state : ''}</option>)}</select></label>
        <label>Detail<select aria-label="Semantic detail" value={s.detail} onChange={e => send({type:'detail',value:e.currentTarget.value})}>
          {!s.detail && <option value="">No detail selected</option>}{support.details.map(c => <option key={c.id} value={c.id} disabled={c.state !== 'available'}>{c.label}{c.state !== 'available' ? ' - '+c.state : ''}</option>)}</select></label>
        <label>Build contributors<select aria-label="Build contributor detail" value={s.builders} onChange={e => send({type:'builders',value:e.currentTarget.value as typeof s.builders})}>
          {BUILDER_LEVELS.map(l => <option key={l} value={l} disabled={l !== 'off' && !support.builderLevels.includes(l)}>{label(l)}</option>)}</select></label>
      </div>;
  return <header className="dc-perspective">
    <nav className="dc-destinations" aria-label="Workspace destinations">
      <strong>DiagramCloud</strong>
      <div className="dc-links">{DESTINATIONS.map(d => <button key={d} type="button" aria-current={s.destination === d ? 'page' : undefined}
        onClick={() => send({type:'destination',value:d})}>{label(d)}</button>)}</div>
      <span className="dc-scope">{catalogue ? 'Knowledge library' : s.binding.projectId} <small>{s.binding.audience === 'author' ? 'Author context' : 'Permitted public copy'}</small></span>
    </nav>
    <div className="dc-contextbar">
      <nav className="dc-topic-links" aria-label={label(s.destination) + ' sections'}>{DESTINATION_TOPICS[s.destination].map(t => <button type="button" key={t}
        aria-current={s.topic === t ? 'page' : undefined} onClick={() => send({type:'topic',value:t})}>{label(t)}</button>)}</nav>
      {!catalogue && (p.compact ? <details className="dc-compact-controls"><summary>Reading controls: {label(s.task)} / {support.lenses.find(c=>c.id===s.lens)?.label ?? 'unavailable'}</summary>{controls}</details> : controls)}
    </div>
    {!catalogue && <p className="dc-perspective-note">Viewpoint, semantic detail and contributors are independent. These controls do not edit the architecture or grant execution.</p>}
  </header>;
}
