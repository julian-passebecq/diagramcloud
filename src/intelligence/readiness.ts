import {readAcquisitionAnalysis} from './materialize';
import type {Project} from '../core/model';
import {DEFAULT_OPTIONS, PURPOSES} from './types';
import type {AnalysisOptions, Capability, Gap, ReadinessReport, ViewRecommendation} from './types';
import {perspectiveOf} from '../core/viewspec';

/** Prefer explicit view perspectives. Never classify a provider by a substring in a title.
 * An absent capability means not established in this Project, not absent from the repo.
 */
export function projectReadiness(project: Project, input: Partial<AnalysisOptions> = {}): ReadinessReport {
  const options = {...DEFAULT_OPTIONS, ...input};
  if (!PURPOSES.includes(options.purpose) || !['quick', 'standard'].includes(options.depth)
    || typeof options.includeInferred !== 'boolean') throw new Error('Unsupported analysis options');
  const matching = (...perspectives: string[]) => project.views.filter(v => perspectives.includes(perspectiveOf(v))).map(v => v.id);
  const capabilities: Capability[] = [
    {id: 'architecture', state: project.nodes.length ? 'present' : 'not-established', reason: 'Components in the current Project; not a new source scan.', viewIds: matching('system')},
    ...([['code', 'code'], ['data', 'data'], ['cloud', 'cloud'], ['delivery', 'cicd']] as const).map(([id, perspective]) => ({
      id, state: matching(perspective).length ? 'present' as const : 'not-established' as const,
      reason: `Explicit ${perspective} view metadata only.`, viewIds: matching(perspective),
    })),
    {id: 'documents', state: project.sources.length ? 'present' : 'not-established', reason: 'Source references exist; their files have not been opened by this report.', viewIds: []},
    {id: 'ownership', state: project.nodes.some(n => n.role.trim()) ? 'present' : 'not-established', reason: 'Authored role text, not inferred people or verified ownership.', viewIds: []},
  ];
  const inScope = (e: Project['edges'][number]) => options.includeInferred || e.basis === 'planned'
    || (e.basis === 'static-source' && !/\b(inferred|possible)\b/i.test(e.label));
  // Legacy edges do not carry typed confidence. This is conservative display filtering,
  // not proof that an unqualified static-source edge is confirmed.
  const edgesById = new Map(project.edges.map(e => [e.id, e]));
  const useful = project.views.filter(v => v.edgeIds.some(id => {
    const edge = edgesById.get(id); return !!edge && inScope(edge);
  }));
  const preferred = options.purpose==='work-review'||options.purpose==='audit'?['evidence','cicd','code','data','system','cloud']:options.purpose==='education'?['system','code','data','cloud','cicd']:['data', 'system', 'code', 'cloud', 'cicd'];
  const best = [...useful].sort((a, b) => {
    const rank = (p?: string) => {const i = preferred.indexOf(p || ''); return i < 0 ? 99 : i;};
    return rank(perspectiveOf(a)) - rank(perspectiveOf(b)) || a.id.localeCompare(b.id, 'en');
  })[0];
  const structure = matching('code');
  const views: ViewRecommendation[] = [
    {id: 'overview', title: 'Project overview', required: true, availability: 'existing', existingViewIds: [project.rootViewId], reason: 'Start from the existing root without inventing a deployment.'},
    {id: 'structure', title: 'Structure', required: true, availability: structure.length ? 'existing' : 'summary', existingViewIds: structure, reason: structure.length ? 'Explicit code views are available.' : 'Use the authored hierarchy or a bounded inventory; no inferred microservices.'},
    {id: 'relations', title: 'Relationships', required: true, availability: best ? 'existing' : 'empty-state', existingViewIds: best ? [best.id] : [], reason: best ? 'Reuse one relation-bearing view. A foreign key is not runtime lineage.' : 'No usable relationship in this projection. Display that limitation instead of drawing arrows.'},
    {id: 'evidence-gaps', title: 'Evidence and gaps', required: true, availability: 'summary', existingViewIds: matching('evidence'), reason: 'Explain origin, unknowns and unavailable outputs.'},
  ];
  if (options.depth === 'standard') {
    for (const c of capabilities) {
      if (!c.viewIds.length || views.some(v => v.existingViewIds.some(id => c.viewIds.includes(id)))) continue;
      if (views.length >= 7) break;
      views.push({id: c.id, title: `${c.id[0].toUpperCase()}${c.id.slice(1)} view`, required: false, availability: 'existing', existingViewIds: c.viewIds, reason: c.reason});
    }
  }
  const gaps: Gap[] = [];
  const add = (gap: Gap) => gaps.push(gap);
  if (!project.nodes.length) add({id: 'empty-project', state: 'missing-required', title: 'No components to explain', reason: 'The current Project contains no components.', resolution: 'Import a source scan or describe the project. The overview can still show an empty state.', affects: ['overview', 'relations']});
  if (!best) add({id: 'no-relations', state: 'missing-optional', title: 'No usable relationships', reason: 'An empty relation view is valid for a tiny or unsupported project.', resolution: 'Supply explicit relationships or scan supported source files; do not invent a flow.', affects: ['relations']});
  if (!project.sources.length) add({id: 'no-sources', state: 'missing-optional', title: 'Source locations not supplied', reason: 'This Project has no source registry entries. Evidence may still exist in its blocks.', resolution: 'Attach exact source paths/revisions or import source-backed evidence.', affects: ['evidence-gaps']});
  if (['project', 'portfolio', 'presentation'].includes(options.purpose) && !project.summary.trim()) add({id: 'business-purpose', state: 'missing-required', title: 'Project purpose is missing', reason: 'A business overview needs an authored purpose; Git cannot supply it reliably.', resolution: 'Describe the objective in ProjectBrief or the project summary.', affects: ['project-overview-sheet']});
  if (options.purpose === 'portfolio' && !project.nodes.some(n => n.role.trim())) add({id: 'contribution', state: 'missing-required', title: 'Contribution is not described', reason: 'Commit authorship does not prove business responsibility or outcomes.', resolution: 'Add the contribution, responsibility and supporting evidence.', affects: ['portfolio']});
  if (options.purpose === 'audit'||options.purpose==='work-review') {
    add({id: 'runtime-qualification', state: 'unsupported', title: 'Runtime not evaluated by this report', reason: 'A source projection or an observation label is not an exact deployment/test receipt.', resolution: 'Use a dated external receipt naming the environment, artifact/revision and check. No tests are run here.', affects: ['runtime-audit']});
    if (!project.nodes.some(n => n.role.trim())) add({id: 'ownership', state: 'missing-optional', title: 'Ownership not established', reason: 'No authored role metadata in this projection.', resolution: 'Supply technical, business or operational ownership when needed.', affects: ['ownership']});
  }
  if (!options.includeInferred) add({id: 'legacy-confidence', state: 'unsupported', title: 'Legacy confidence is not typed on every edge', reason: 'The 1.23 model stores some confidence in labels or evidence tables. Filtering is not verification.', resolution: 'Inspect the cited evidence; a later source-fact adapter must carry explicit relation confidence.', affects: ['relations']});
  for(const [index,diagnostic] of (readAcquisitionAnalysis(project)?.documentMap.diagnostics??[]).entries())if(diagnostic.message.startsWith('Source discrepancy candidate:'))add({id:'source-discrepancy-'+index,state:'conflicting',title:'Potential documentation/source discrepancy',reason:diagnostic.message,resolution:'Review both cited sources and establish their current/target scope. Coexistence is possible; no source is automatically preferred.',affects:['evidence-gaps','relations']});
  const active = project.atlas?.snapshots.find(s => s.id === project.atlas?.activeSnapshotId);
  for (const repository of [...(active?.repositories || [])].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
    if (repository.scanStatus !== 'scanned') add({id: `repo-${repository.id}`, subjectId: repository.id, state: 'missing-optional', title: `${repository.title}: ${repository.scanStatus}`, reason: 'Atlas membership does not mean its source has been read.', resolution: 'Rescan this explicit member, or retain it as declared/unknown.', affects: ['structure', 'relations']});
  }
  return {
    format: 'diagramcloud.readiness', version: 1, projectId: project.id, projectRevision: project.revision,
    scope: 'current-project-projection', options,
    counts: {nodes: project.nodes.length, connections: project.edges.length, views: project.views.length,
      sourceDerivedNodes: project.nodes.filter(n => n.basis === 'static-source').length,
      declaredNodes: project.nodes.filter(n => n.basis === 'planned').length,
      unclassifiedNodes: project.nodes.filter(n => !n.basis || n.basis === 'unknown').length},
    capabilities, views, gaps,
    limitations: ['This report inspects the current Project, not live repositories or processes.',
      'The four minimum outputs are a plan; existing view IDs are reusable, summary/empty-state outputs still need presentation.',
      'No model calls, tests, deployments, data queries, source refreshes or review approvals occur.',
      'No project-wide completeness percentage or calibrated probability is claimed.'],
  };
}
