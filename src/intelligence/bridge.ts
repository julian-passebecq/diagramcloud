import {validateDocument, type Project} from '../core/model';
import {appendSnapshot, documentFromAtlas, repoNodeId, type AtlasScan} from '../core/atlas/compose';
import {applyDocumentPatch, type Operation, type Patch} from '../core/patch';
import {validatePack} from '../experience/model';
import {compileProjectBrief, validateProjectBrief} from './brief';

/** The existing Atlas owns physical membership and revision vectors. The brief owns
 * explicit logical bindings only. No names, technologies or providers are joined. */
export function compileHybridBrief(input: unknown, scans: Record<string, AtlasScan> = {}, options: {now?: Date} = {}) {
  const brief = validateProjectBrief(input), candidate = compileProjectBrief(brief);
  if (!candidate.manifest) throw new Error('Hybrid requires an explicit repository list.');
  for (const id of Object.keys(scans)) if (!brief.repositories.some(r => r.id === id)) throw new Error(`Undeclared repository scan: ${id}`);
  const atlas = documentFromAtlas(candidate.manifest, scans, options);
  const document = candidate.document;
  // Atlas metadata/locators are private authoring context until deliberately reviewed.
  document.nodes.push(...atlas.document.nodes.map(n => ({...n, visibility: 'private' as const})));
  document.edges.push(...atlas.document.edges.map(e => ({...e, visibility: 'private' as const})));
  document.blocks.push(...atlas.document.blocks.map(b => ({...b, visibility: 'private' as const})));
  document.views.push(...atlas.document.views.map(v => ({...v, visibility: 'private' as const})));
  document.sources.push(...atlas.document.sources.map(s => ({...s, visibility: 'private' as const})));
  document.atlas = atlas.document.atlas;
  for (const snapshot of document.atlas!.snapshots) for (const repo of snapshot.repositories) repo.visibility = 'private';
  document.nodes.push({id: 'brief-repositories-navigation', label: 'Repositories', kind: 'control', provider: 'Generic', icon: 'generic',
    summary: 'Explicit project membership. Each repository retains its own revision and scan status.', role: '', status: 'idle',
    blockIds: [], sourceIds: ['project-brief-source'], tags: ['Navigation'], basis: 'planned', visibility: 'private', childViewId: atlas.document.rootViewId});
  const root = document.views.find(v => v.id === document.rootViewId)!;
  root.nodeIds.push('brief-repositories-navigation');
  root.positions['brief-repositories-navigation'] = {x: (root.nodeIds.length - 1) % 3 * 300, y: Math.floor((root.nodeIds.length - 1) / 3) * 180};
  const bound = brief.scope.filter(s => s.repositoryIds.length);
  if (bound.length) {
    const nodes = [...new Set(bound.flatMap(s => [`brief-scope-${s.id}`, ...s.repositoryIds.map(repoNodeId)]))];
    const edges = bound.flatMap(s => s.repositoryIds.map(repo => ({id: `brief-binding-${s.id}-${repo}`,
      source: `brief-scope-${s.id}`, target: repoNodeId(repo), label: 'Declared repository binding', kind: 'dependency' as const,
      speed: 'medium' as const, basis: 'planned' as const, visibility: 'private' as const})));
    document.edges.push(...edges);
    document.views.push({id: 'brief-bindings', title: 'Logical repository bindings', description: 'Explicit author declarations; not inferred service calls.',
      perspective: 'system', visibility: 'private', nodeIds: nodes, edgeIds: edges.map(e => e.id),
      positions: Object.fromEntries(nodes.map((id, i) => [id, {x: i % 3 * 300, y: Math.floor(i / 3) * 180}]))});
    document.nodes.push({id: 'brief-bindings-navigation', label: 'Repository bindings', kind: 'control', provider: 'Generic', icon: 'generic',
      summary: 'Logical scopes and their explicitly declared repository bindings.', role: '', status: 'idle', blockIds: [],
      sourceIds: ['project-brief-source'], tags: ['Navigation'], basis: 'planned', visibility: 'private', childViewId: 'brief-bindings'});
    root.nodeIds.push('brief-bindings-navigation');
    root.positions['brief-bindings-navigation'] = {x: (root.nodeIds.length - 1) % 3 * 300, y: Math.floor((root.nodeIds.length - 1) / 3) * 180};
  }
  document.experience!.entities.push(...brief.repositories.map(r => ({id: repoNodeId(r.id), label: r.title, type: 'repository' as const,
    summary: r.purpose ?? '', children: [], workspaceIds: [], sourceIds: ['project-brief-source'], visibility: 'private' as const, assertion: 'declared' as const})));
  document.experience!.entities.find(e => e.id === document.experience!.rootId)!.children.push(...brief.repositories.map(r => repoNodeId(r.id)));
  document.experience!.relations.push(...bound.flatMap(s => s.repositoryIds.map(repo => ({id: `brief-binding-${s.id}-${repo}`,
    source: `brief-scope-${s.id}`, target: repoNodeId(repo), kind: 'uses' as const, assertion: 'declared' as const,
    sourceIds: ['project-brief-source'], visibility: 'private' as const}))));
  return {...candidate, document: validateDocument(document), warnings: [...candidate.warnings, ...atlas.report.lost,
    'Hybrid bindings are declared; scanned findings remain static-source. No cross-repository resolver is implied.']};
}

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
/** A conservative, revision-guarded re-import proposal. No entity is deleted and
 * existing evidence, assets, story, visibility and manual positions are retained.
 * Matching compiler IDs update label/summary only; existing references are unioned.
 * Review/apply remains the caller's explicit boundary. */
export function previewBriefReimport(current: Project, input: unknown, baseRevision: number) {
  const candidate = compileProjectBrief(input);
  const result = previewCandidateReimport(current, candidate.document, baseRevision);
  return {...result, warnings: [...candidate.warnings, ...result.warnings]};
}

export function previewCandidateReimport(current: Project, incoming: Project, baseRevision: number) {
  validateDocument(current);
  validateDocument(incoming);
  if (current.revision !== baseRevision) throw new Error(`Revision conflict: current ${current.revision}, captured ${baseRevision}.`);
  if (current.id !== incoming.id) throw new Error('Project identity differs; import as a new project.');
  const merged = structuredClone(current);
  const merge = <T extends {id: string}>(old: T[], fresh: T[], update: (a: T, b: T) => T): T[] => {
    const byId = new Map(fresh.map(v => [v.id, v]));
    return [...old.map(v => byId.has(v.id) ? update(v, byId.get(v.id)!) : v), ...fresh.filter(v => !old.some(a => a.id === v.id))];
  };
  merged.nodes = merge(merged.nodes, incoming.nodes, (a, b) => {
    const metaId = a.id.startsWith('brief-scope-') ? `brief-meta-${a.id.slice('brief-scope-'.length)}` : undefined;
    const hasBriefEvidence = metaId && a.blockIds.includes(metaId) && current.blocks.some(block => block.id === metaId && block.sourceIds.includes('project-brief-source'));
    const hasBriefEntity = current.experience?.entities.some(entity => entity.id === a.id && entity.sourceIds.includes('project-brief-source'));
    if (b.sourceIds.includes('project-brief-source') && !a.sourceIds.includes('project-brief-source') && !hasBriefEvidence && !hasBriefEntity) throw new Error(`Ambiguous authored node identity: ${a.id}`);
    if (a.childViewId && b.childViewId && a.childViewId !== b.childViewId) throw new Error(`Conflicting child view: ${a.id}`);
    return {...a, blockIds: union(a.blockIds, b.blockIds),
      childViewId: a.childViewId ?? b.childViewId, experienceWorkspaceId: a.experienceWorkspaceId ?? b.experienceWorkspaceId};
  });
  merged.edges = merge(merged.edges, incoming.edges, (a, b) => {
    if (a.source !== b.source || a.target !== b.target) throw new Error(`Conflicting relationship identity: ${a.id}`);
    return a;
  });
  merged.views = merge(merged.views, incoming.views, (a, b) => ({...a, nodeIds: union(a.nodeIds, b.nodeIds), edgeIds: union(a.edgeIds, b.edgeIds), positions: {...b.positions, ...a.positions}}));
  merged.blocks = merge(merged.blocks, incoming.blocks, a => a);
  merged.sources = merge(merged.sources, incoming.sources, a => a);
  if (!merged.experience) merged.experience = incoming.experience;
  else if (incoming.experience) {
    const a = merged.experience, b = incoming.experience!;
    if (a.id !== b.id) throw new Error('Conflicting experience identity; existing workspaces cannot be replaced by this brief.');
    a.entities = merge(a.entities, b.entities, (x, y) => ({...x, children: union(x.children, y.children), workspaceIds: union(x.workspaceIds, y.workspaceIds)}));
    a.items = merge(a.items, b.items, x => x);
    a.workspaces = merge(a.workspaces, b.workspaces, x => x);
    a.sources = merge(a.sources, b.sources, x => x);
    a.relations = merge(a.relations, b.relations, x => x);
    merged.experience = validatePack(a);
  }
  // A repository's existing scan and revision must stay coherent. Re-import only
  // adds new declared members; existing ones use the dedicated rescan workflow.
  if (!merged.atlas) merged.atlas = incoming.atlas;
  else if (incoming.atlas) {
    const active = merged.atlas.snapshots.find(s => s.id === merged.atlas!.activeSnapshotId)!;
    const fresh = incoming.atlas.snapshots.find(s => s.id === incoming.atlas!.activeSnapshotId)!;
    const repositories = merge(active.repositories, fresh.repositories, a => a);
    if (repositories.length !== active.repositories.length) appendSnapshot(merged, repositories, new Date(fresh.capturedAt), merged.atlas);
  }
  validateDocument(merged);
  const keys = ['nodes', 'edges', 'views', 'blocks', 'sources', 'experience', 'atlas'] as const;
  const operations: Operation[] = keys.filter(k => JSON.stringify(current[k]) !== JSON.stringify(merged[k]))
    .map(k => ({op: current[k] === undefined ? 'add' : 'replace', path: `/${k}`, value: merged[k]}));
  if (!operations.length) operations.push({op: 'test', path: '/revision', value: baseRevision});
  const patch: Patch = {format: 'diagramcloud.patch', version: 1, target: 'project', targetId: current.id,
    baseRevision, summary: 'Review ProjectBrief updates by explicit stable IDs; preserve existing authored work.', operations};
  return {document: applyDocumentPatch(current, patch).result, patch, warnings: [
    'Existing labels, summaries, evidence and removed/unmatched entities are retained. Newly declared IDs are added; review stale context and publication separately.',
    'Existing repository revisions/scans are retained. Use the repository rescan workflow to refresh their source findings.']};
}
