import {useMemo, useState} from 'react';
import type {Project} from '../core/model';
import {ARTIFACT_KINDS, ARTIFACT_KIND_LABEL, artifactEntries, artifactProjection, type ArtifactKind} from '../core/artifactEntry';

/**
 * Artifacts entry (V2 AC03): start from an image, a dataset, a storage/table component or a declared check, then reach
 * the components that cite it and their producers and consumers inside each view this audience may open. Read-only.
 */
export function ArtifactEntry({project, publicMode = false, onView}: {project: Project; publicMode?: boolean; onView?: (view: string, node?: string) => void}) {
  const audience = publicMode ? 'public' : 'author';
  const doc = useMemo(() => artifactProjection(project, audience), [project, audience]);
  const entries = useMemo(() => artifactEntries(project, {audience}), [project, audience]);
  const [kind, setKind] = useState<ArtifactKind | 'all'>('all'), [chosen, setChosen] = useState<string>();
  const label = (id: string) => doc.nodes.find(n => n.id === id)?.label ?? id;
  const shown = entries.filter(e => kind === 'all' || e.kind === kind), current = entries.find(e => e.key === chosen);
  const open = (viewId: string, nodeId: string) => onView ? <button type="button" className="pi-text-button" onClick={() => onView(viewId, nodeId)}>{label(nodeId)}</button> : <span>{label(nodeId)}</span>;
  return <section className="project-overview" aria-label="Artifacts" data-testid="artifact-entry">
    <h2>Artifacts</h2>
    <p>Start from an image, a table or dataset, a storage component or a declared check. Each artifact leads to the components that cite it and to their producers and consumers, traced along the connections of each view you may open here. Checks are declared design elements, not observed results.</p>
    <div className="pi-controls" role="group" aria-label="Artifact kinds">
      <button type="button" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>All ({entries.length})</button>
      {ARTIFACT_KINDS.map(k => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{ARTIFACT_KIND_LABEL[k]} ({entries.filter(e => e.kind === k).length})</button>)}
    </div>
    {shown.length ? <ul aria-label="Artifact list">{shown.map(e => <li key={e.key}><button type="button" aria-pressed={chosen === e.key} onClick={() => setChosen(e.key)}>{e.title}</button> <span className="micro">{ARTIFACT_KIND_LABEL[e.kind]} · {e.detail}</span></li>)}</ul> : <p>No artifact of this kind in this projection.</p>}
    {current && <article aria-label={'Artifact: ' + current.title}>
      <h3>{current.title}</h3>
      <p className="micro">{ARTIFACT_KIND_LABEL[current.kind]} · {current.detail}</p>
      <h4>{current.subject.type === 'block' ? 'Cited by components' : 'Component'}</h4>
      {current.componentIds.length ? <ul aria-label="Citing components">{current.componentIds.map(id => {const t = current.traces.find(t => t.componentId === id); return <li key={id}>{t ? open(t.viewId, id) : label(id)}{!t && <span className="micro"> · not a member of any view here</span>}</li>;})}</ul> : <p>No component cites this artifact in this projection.</p>}
      <h4>Producers and consumers by view</h4>
      {current.traces.length ? current.traces.map(t => <div key={t.viewId + '/' + t.componentId} role="group" aria-label={`Trace in ${t.viewTitle} from ${label(t.componentId)}`}>
        <p><strong>{t.viewTitle}</strong> · from {label(t.componentId)}</p>
        <p>Producers (upstream): {t.producers.length ? t.producers.map((id, i) => <span key={id}>{i ? ', ' : ''}{open(t.viewId, id)}</span>) : 'none in this view'}</p>
        <p>Consumers (downstream): {t.consumers.length ? t.consumers.map((id, i) => <span key={id}>{i ? ', ' : ''}{open(t.viewId, id)}</span>) : 'none in this view'}</p>
      </div>) : <p>No view here contains a component for this artifact.</p>}
      <p className="micro">Traced from declared connections within each view only; no view outside this projection is read.</p>
    </article>}
  </section>;
}
