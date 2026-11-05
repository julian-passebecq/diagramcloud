import {useId, useMemo, useState} from 'react';
import type {Project} from '../core/model';
import {ICON_REGISTRY} from '../core/icons';
import {download} from '../export/browser';
import {projectReadiness, purposeBadge, readinessDownload} from '../intelligence/readiness';
import {assetChecklistCsv, planAssets} from '../intelligence/assets';
import {PURPOSES, type Purpose} from '../intelligence/types';

/** Small authoring-only inspector. Does not replace Explore/Edit/Portfolio/Present.
 * Kept inside the existing JSON/AI workspace until the release navigation is wired.
 */
export function ProjectReadiness({project}: {project: Project}) {
  const [purpose, setPurpose] = useState<Purpose>('understand');
  const report = useMemo(() => projectReadiness(project, {purpose}), [project, purpose]);
  const badge = useMemo(() => purposeBadge(report), [report]);
  const assets = useMemo(() => planAssets(project, ICON_REGISTRY), [project]);
  const idBase = useId();
  const gapDomId = (id: string) => `${idBase}-gap-${id}`;
  const goToGap = (id: string) => {
    const target = document.getElementById(gapDomId(id));
    if (!target) return;
    target.scrollIntoView({block: 'nearest'});
    target.focus();
  };
  const save = (value: unknown, suffix: string) => download(JSON.stringify(value, null, 2) + '\n', `${project.id}.${suffix}.json`, 'application/json');
  return <details className="note-card" data-testid="project-readiness">
    <summary><strong>Project readiness and asset checklist</strong></summary>
    <p className="micro">Current project only. No live scan, model call or test execution. Exports below are private authoring context, not public deliverables.</p>
    <label>Purpose <select aria-label="Readiness purpose" value={purpose} onChange={e => setPurpose(e.target.value as Purpose)}>
      {PURPOSES.map(value => <option key={value} value={value}>{value}</option>)}
    </select></label>
    <section className={`readiness-badge ${badge.complete ? 'complete' : 'open'}`} data-testid="readiness-purpose-badge" aria-label="Readiness for selected purpose">
      <p role="status" aria-live="polite"><strong className="readiness-badge-text">{badge.text}</strong></p>
      <p className="micro">{badge.notice} It only means the readiness rules name no required gap for this purpose.</p>
      {badge.requiredGaps.length > 0 && <ul className="readiness-badge-links" aria-label="Required gaps">
        {badge.requiredGaps.map(gap => <li key={gap.id}><button type="button" onClick={() => goToGap(gap.id)}>Go to gap: {gap.title}</button></li>)}
      </ul>}
    </section>
    <p>{report.counts.nodes} components; {report.counts.views} views; {report.counts.sourceDerivedNodes} source-derived; {report.counts.declaredNodes} declared.</p>
    <h4>Minimum output plan</h4>
    <ul>{report.views.filter(view => view.required).map(view => <li key={view.id}><strong>{view.title}</strong> ({view.availability})<span className="micro"> - {view.reason}</span></li>)}</ul>
    <h4>Information needed for this purpose</h4>
    {report.gaps.length ? <ul>{report.gaps.map(gap => <li key={gap.id} id={gapDomId(gap.id)} tabIndex={-1}><strong>{gap.title}</strong> ({gap.state})<p className="micro">{gap.resolution}</p></li>)}</ul> : <p>No contextual gaps detected by these limited rules. This is not a completeness or runtime certificate.</p>}
    <h4>Graphical assets</h4>
    <p>{assets.requirements.filter(r => r.status === 'resolved').length} registry icons; {assets.requirements.filter(r => r.status !== 'resolved').length} generic fallbacks. Missing artwork does not block a diagram.</p>
    <div className="toolbar">
      <button type="button" onClick={() => save(readinessDownload(report), 'readiness')}>Download readiness JSON</button>
      <button type="button" onClick={() => save(assets, 'asset-plan')}>Download asset plan</button>
      <button type="button" onClick={() => download(assetChecklistCsv(assets), `${project.id}.asset-checklist.csv`, 'text/csv;charset=utf-8')}>Download asset checklist CSV</button>
    </div>
  </details>;
}
