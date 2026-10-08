import {useMemo, useState} from 'react';
import type {Project} from '../core/model';
import {ICON_REGISTRY} from '../core/icons';
import {download} from '../export/browser';
import {projectReadiness} from '../intelligence/readiness';
import {assetChecklistCsv, planAssets} from '../intelligence/assets';
import {PURPOSES, type Purpose} from '../intelligence/types';

/** Small authoring-only inspector. Does not replace Explore/Edit/Portfolio/Present.
 * Kept inside the existing JSON/AI workspace until the release navigation is wired.
 */
export function ProjectReadiness({project}: {project: Project}) {
  const [purpose, setPurpose] = useState<Purpose>('understand');
  const report = useMemo(() => projectReadiness(project, {purpose}), [project, purpose]);
  const assets = useMemo(() => planAssets(project, ICON_REGISTRY), [project]);
  const save = (value: unknown, suffix: string) => download(JSON.stringify(value, null, 2) + '\n', `${project.id}.${suffix}.json`, 'application/json');
  return <details className="note-card" data-testid="project-readiness">
    <summary><strong>Project readiness and asset checklist</strong></summary>
    <p className="micro">Current project only. No live scan, model call or test execution. Exports below are private authoring context, not public deliverables.</p>
    <label>Purpose <select aria-label="Readiness purpose" value={purpose} onChange={e => setPurpose(e.target.value as Purpose)}>
      {PURPOSES.map(value => <option key={value} value={value}>{value}</option>)}
    </select></label>
    <p>{report.counts.nodes} components; {report.counts.views} views; {report.counts.sourceDerivedNodes} source-derived; {report.counts.declaredNodes} declared.</p>
    <h4>Minimum output plan</h4>
    <ul>{report.views.filter(view => view.required).map(view => <li key={view.id}><strong>{view.title}</strong> ({view.availability})<span className="micro"> - {view.reason}</span></li>)}</ul>
    <h4>Information needed for this purpose</h4>
    {report.gaps.length ? <ul>{report.gaps.map(gap => <li key={gap.id}><strong>{gap.title}</strong> ({gap.state})<p className="micro">{gap.resolution}</p></li>)}</ul> : <p>No contextual gaps detected by these limited rules. This is not a completeness or runtime certificate.</p>}
    <h4>Graphical assets</h4>
    <p>{assets.requirements.filter(r => r.status === 'resolved').length} registry icons; {assets.requirements.filter(r => r.status !== 'resolved').length} generic fallbacks. Missing artwork does not block a diagram.</p>
    <div className="toolbar">
      <button type="button" onClick={() => save(report, 'readiness')}>Download readiness JSON</button>
      <button type="button" onClick={() => save(assets, 'asset-plan')}>Download asset plan</button>
      <button type="button" onClick={() => download(assetChecklistCsv(assets), `${project.id}.asset-checklist.csv`, 'text/csv;charset=utf-8')}>Download asset checklist CSV</button>
    </div>
  </details>;
}
