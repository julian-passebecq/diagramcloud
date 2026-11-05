import {validateDocument, type Project} from '../core/model';
import {publicDocument} from '../core/operations';
import {isPermittedPath, VIEW_ROUTE_UNAVAILABLE} from '../core/hierarchy';
import {activeSnapshot, ATLAS_ROOT, repoNodeId, rescanRepository} from '../core/atlas/compose';
import type {ImportResult} from '../core/interchange/graph';
import type {ScanModel} from '../core/scan/scanner';
import type {AcquisitionAnalysis} from './acquisition';
import {attachAcquisitionContext} from './materialize';
import type {DomainResult} from './domainAdapters';

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
/** Tag on a previously scanned component that the latest selected source refresh did not establish (uncertain, never removed). */
export const NOT_ESTABLISHED = 'Not established by latest scan';
/** Repository refresh proposal, never an in-place edit. Refresh the scanner's
 * source evidence and revision vector while retaining authored presentation and
 * attachments. Absent old IDs remain uncertainty, never an assertion of removal. */
export function previewRepositoryRescan(current: Project, repositoryId: string, model: ScanModel,
  analysis?: AcquisitionAnalysis, now = new Date(),domain?:DomainResult): ImportResult {
  validateDocument(current);
  const snapshot = activeSnapshot(current);
  if (!snapshot.repositories.some(r => r.id === repositoryId)) throw new Error(`Repository ${repositoryId} is not part of this atlas.`);
  const owned = (id: string) => id.startsWith(`${repositoryId}.`);
  const cardIds = new Set(snapshot.repositories.map(r => repoNodeId(r.id)));
  // The normal rescan validates after replacing its namespace. Isolate the
  // scanner input so author edges, observations and evidence pointing into that
  // namespace are preserved in the final merge instead of becoming dangling.
  const seed = structuredClone(current);
  seed.nodes = seed.nodes.filter(n => cardIds.has(n.id)).map(n => {
    const card = {...n, blockIds: n.blockIds.filter(id => id === `${n.id}.facts`)};
    delete card.childViewId; delete card.experienceWorkspaceId;
    return card;
  });
  const factsIds = new Set(seed.nodes.flatMap(n => n.blockIds));
  seed.blocks = seed.blocks.filter(b => factsIds.has(b.id));
  seed.edges = seed.edges.filter(e => cardIds.has(e.source) && cardIds.has(e.target));
  seed.rootViewId = ATLAS_ROOT;
  seed.views = [{id: ATLAS_ROOT, title: 'Repository refresh context', description: 'Temporary scanner input.',
    visibility: 'public', perspective: 'system', nodeIds: seed.nodes.map(n => n.id), edgeIds: seed.edges.map(e => e.id), positions: {}}];
  seed.story = []; seed.observations = []; delete seed.experience;
  const scanned = rescanRepository(validateDocument(seed), repositoryId, model, now,domain);
  const fresh = scanned.document, merged = structuredClone(current);
  const freshIds = new Set(fresh.nodes.map(n => n.id));
  const retained = current.nodes.filter(n => owned(n.id) && !freshIds.has(n.id));
  for (const node of fresh.nodes.filter(n => owned(n.id) || n.id === repoNodeId(repositoryId))) {
    const old = merged.nodes.find(n => n.id === node.id);
    if (!old) merged.nodes.push({...node, visibility: 'private'});
    else {
      // Established again by this scan: an earlier "not established" mark no longer holds.
      if (old.tags.includes(NOT_ESTABLISHED)) {old.tags = old.tags.filter(t => t !== NOT_ESTABLISHED); if (old.basis === 'unknown') old.basis = 'static-source';}
      old.blockIds = union(old.blockIds, node.blockIds);
      old.sourceIds = union(old.sourceIds, node.sourceIds);
      if (!old.childViewId && node.childViewId) old.childViewId = node.childViewId;
      if (node.id === repoNodeId(repositoryId)) {old.basis = 'static-source'; old.tags = union(['scanned'], old.tags.filter(t => t !== 'not scanned' && t !== 'scan failed' && t !== 'source missing'));}
    }
  }
  for (const edge of fresh.edges.filter(e => owned(e.id))) {
    const old = merged.edges.find(e => e.id === edge.id);
    if (!old) merged.edges.push({...edge, visibility: 'private'});
    else if (old.source !== edge.source || old.target !== edge.target) throw new Error(`Conflicting relationship identity: ${edge.id}`);
  }
  for (const block of fresh.blocks.filter(b => owned(b.id) || b.id === `repo-${repositoryId}.facts`)) {
    const at = merged.blocks.findIndex(b => b.id === block.id), old = merged.blocks[at];
    if (at < 0) merged.blocks.push({...block, visibility: 'private'});
    else if (old.provenance === 'source-derived' || (block.id === `repo-${repositoryId}.facts` && old.provenance === 'reference' && old.title === 'Repository facts')) merged.blocks[at] = {...block, visibility: 'private'};
    else if (block.id === `repo-${repositoryId}.facts`) {
      const id = `analysis-repo-${repositoryId}-fresh-facts`, replacement = {...block, id, visibility: 'private' as const};
      const existing = merged.blocks.findIndex(b => b.id === id);
      if (existing < 0) merged.blocks.push(replacement); else merged.blocks[existing] = replacement;
      const card = merged.nodes.find(n => n.id === repoNodeId(repositoryId))!;
      card.blockIds = union(card.blockIds, [id]);
    }
    // Author/synthetic attachments are preserved even if someone reused a scan ID.
  }
  for (const view of fresh.views.filter(v => owned(v.id))) {
    const old = merged.views.find(v => v.id === view.id);
    if (!old) merged.views.push({...view, visibility: 'private'});
    else {old.nodeIds = union(old.nodeIds, view.nodeIds); old.edgeIds = union(old.edgeIds, view.edgeIds); old.positions = {...view.positions, ...old.positions};}
  }
  for (const source of fresh.sources) if (!merged.sources.some(s => s.id === source.id)) merged.sources.push({...source, visibility: 'private'});
  merged.atlas = fresh.atlas;
  const refreshed = activeSnapshot(merged).repositories.find(r => r.id === repositoryId)!;
  if (!model.commit) {delete refreshed.revision; refreshed.authority = 'author'; refreshed.note = 'Selected source has no readable Git revision; content is not attested by the previous revision.';}
  if (!model.branch) delete refreshed.ref;
  refreshed.visibility = 'private';
  for (const block of merged.blocks) if ((block.id === `repo-${repositoryId}.facts` || block.id === `analysis-repo-${repositoryId}-fresh-facts`) && block.type === 'table' && block.title === 'Repository facts') {
    block.rows = block.rows.map(row => !model.commit && row[0] === 'Revision' ? ['Revision', 'unknown', 'selected source'] :
      !model.branch && row[0] === 'Branch / ref' ? ['Branch / ref', 'unknown', 'selected source'] : row);
  }
  // Context records retained scan facts without changing status/observations.
  if (retained.length) {
    for (const node of retained) if (node.basis === 'static-source') {
      const retainedNode = merged.nodes.find(n => n.id === node.id)!;
      retainedNode.basis = 'unknown';
      retainedNode.tags = union(retainedNode.tags, [NOT_ESTABLISHED]).slice(-20);
    }
    const id = `analysis-repo-${repositoryId}-retained`;
    const block = {id, title: 'Retained source scope uncertainty', type: 'text' as const, visibility: 'private' as const,
      sourceIds: [], provenance: 'source-derived' as const,
      text: `${retained.length} previously mapped component(s) were not established by this selected source refresh. Their stable IDs and authored references remain retained. This does not prove removal or current implementation.`};
    const at = merged.blocks.findIndex(b => b.id === id);
    if (at < 0) merged.blocks.push(block); else merged.blocks[at] = block;
    const card = merged.nodes.find(n => n.id === repoNodeId(repositoryId))!;
    card.blockIds = union(card.blockIds, [id]);
  }
  const document = analysis ? attachAcquisitionContext(validateDocument(merged), analysis, repositoryId) : validateDocument(merged);
  return {document, report: {...scanned.report, kept: [...scanned.report.kept,
    'Author labels, layout positions, story, assets, workspace links and attached author evidence retained. New scanner facts remain private.'],
    lost: [...scanned.report.lost, ...(retained.length ? [`${retained.length} previous scan components retained as uncertain; absence in this selected scope does not establish removal.`] : [])]}};
}

// ---------------------------------------------------------------------------------------------
// Source refresh summary and return context (contract: docs/contracts/source-refresh.md)

export type RefreshItemKind = 'component' | 'connection' | 'view' | 'source' | 'evidence' | 'repository';
export type RefreshItem = {kind: RefreshItemKind; id: string; label: string; note?: string};
/** What a source refresh proposal would change, read from the two documents only. Nothing is applied or stored. */
export type RefreshSummary = {
  audience: 'author' | 'public';
  repositoryIds: string[];
  revision: {repositoryId: string; from?: string; to?: string}[];
  /** IDs in the proposal that the current document does not hold. */
  added: RefreshItem[];
  /** Same stable ID, different scanner content (sources, evidence, basis, connection label or kind). */
  changed: RefreshItem[];
  /** Previously scanned, kept with its ID, not established by the latest scan: uncertain, never removed. */
  uncertain: RefreshItem[];
  /** Sources the refresh could not read or attest (no scan, failed, missing, unknown revision, unresolved citation). */
  unavailable: RefreshItem[];
  /** Authored (non scanner) evidence attached to the refreshed scope, kept byte for byte. */
  retainedEvidence: RefreshItem[];
  /** Authored evidence attached to the refreshed scope that the proposal changes or drops: shown, never hidden. */
  authoredNotRetained: RefreshItem[];
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x));
const activeRepos = (d: Project) => d.atlas ? activeSnapshot(d).repositories : [];

/** Repositories whose snapshot record differs between the two documents (the refreshed scope when none is named). */
function refreshedRepositories(current: Project, proposal: Project): string[] {
  const before = new Map(activeRepos(current).map(r => [r.id, r]));
  return activeRepos(proposal).filter(r => !same(before.get(r.id), r)).map(r => r.id);
}

/**
 * Pure summary of a source refresh proposal against the current document. For a public audience both documents
 * are read through publicDocument first, so no private label, ID or count enters the summary. A component missing
 * from the latest scan is reported as uncertain (retained with its ID), never as removed; identities are compared
 * by exact stable ID only and never rebound.
 */
export function refreshSummary(current: Project, proposal: Project, options: {repositoryId?: string; audience?: 'author' | 'public'} = {}): RefreshSummary {
  const audience = options.audience ?? 'author';
  const a = audience === 'public' ? publicDocument(validateDocument(current)) : validateDocument(current);
  const b = audience === 'public' ? publicDocument(validateDocument(proposal)) : validateDocument(proposal);
  const repositoryIds = options.repositoryId ? [options.repositoryId] : refreshedRepositories(a, b);
  const inScope = (id: string) => repositoryIds.length === 0 || repositoryIds.some(r => id.startsWith(`${r}.`) || id === repoNodeId(r) || id === `repo-${r}.facts` || id.startsWith(`analysis-repo-${r}-`));
  const out: RefreshSummary = {audience, repositoryIds, revision: [], added: [], changed: [], uncertain: [], unavailable: [], retainedEvidence: [], authoredNotRetained: []};
  const beforeRepos = new Map(activeRepos(a).map(r => [r.id, r]));
  for (const r of activeRepos(b).filter(r => repositoryIds.includes(r.id))) {
    const from = beforeRepos.get(r.id)?.revision;
    out.revision.push({repositoryId: r.id, ...(from ? {from} : {}), ...(r.revision ? {to: r.revision} : {})});
    if (r.scanStatus !== 'scanned') out.unavailable.push({kind: 'repository', id: r.id, label: r.title, note: `scan ${r.scanStatus}`});
    else if (!r.revision) out.unavailable.push({kind: 'repository', id: r.id, label: r.title, note: 'revision unknown: content is not attested by a Git revision'});
  }
  const nodesA = new Map(a.nodes.map(n => [n.id, n])), edgesA = new Map(a.edges.map(e => [e.id, e]));
  const viewsA = new Map(a.views.map(v => [v.id, v])), blocksA = new Map(a.blocks.map(x => [x.id, x])), sourcesA = new Map(a.sources.map(s => [s.id, s]));
  const blocksB = new Map(b.blocks.map(x => [x.id, x])), sourcesB = new Set(b.sources.map(s => s.id));
  for (const n of b.nodes.filter(n => inScope(n.id))) {
    const old = nodesA.get(n.id);
    if (!old) {out.added.push({kind: 'component', id: n.id, label: n.label}); continue;}
    if (n.tags.includes(NOT_ESTABLISHED)) {out.uncertain.push({kind: 'component', id: n.id, label: n.label, note: old.tags.includes(NOT_ESTABLISHED) ? 'not established by an earlier refresh either' : 'not established by this refresh'}); continue;}
    const reasons = [!sameSet(old.sourceIds, n.sourceIds) && 'sources', !sameSet(old.blockIds, n.blockIds) && 'evidence', old.basis !== n.basis && 'basis'].filter(Boolean);
    if (reasons.length) out.changed.push({kind: 'component', id: n.id, label: n.label, note: reasons.join(', ')});
  }
  for (const e of b.edges.filter(e => inScope(e.id))) {
    const old = edgesA.get(e.id);
    if (!old) out.added.push({kind: 'connection', id: e.id, label: e.label || e.id});
    else if (old.label !== e.label || old.kind !== e.kind) out.changed.push({kind: 'connection', id: e.id, label: e.label || e.id});
  }
  for (const v of b.views.filter(v => inScope(v.id))) if (!viewsA.has(v.id)) out.added.push({kind: 'view', id: v.id, label: v.title});
  const scopeSources = new Set(b.nodes.filter(n => inScope(n.id)).flatMap(n => n.sourceIds));
  for (const s of b.sources) if (!sourcesA.has(s.id) && (inScope(s.id) || scopeSources.has(s.id))) out.added.push({kind: 'source', id: s.id, label: s.title});
  for (const id of scopeSources) if (!sourcesB.has(id)) out.unavailable.push({kind: 'source', id, label: id, note: 'cited but not resolved'});
  for (const x of b.blocks.filter(x => inScope(x.id) && (x.provenance === 'source-derived' || x.provenance === 'reference'))) {
    const old = blocksA.get(x.id);
    if (!old) out.added.push({kind: 'evidence', id: x.id, label: x.title});
    else if (!same(old, x)) out.changed.push({kind: 'evidence', id: x.id, label: x.title});
  }
  // Authored evidence: every block attached to a refreshed component before the refresh that the scanner does not
  // manage (author or synthetic content, or a reference outside the scanner's ID namespace).
  const managed = (x: {id: string; provenance: string}) => x.provenance === 'source-derived' || (x.provenance === 'reference' && inScope(x.id));
  const attached = new Set(a.nodes.filter(n => inScope(n.id)).flatMap(n => n.blockIds));
  for (const id of attached) {
    const old = blocksA.get(id);
    if (!old || managed(old)) continue;
    const now = blocksB.get(id);
    if (now && same(old, now)) out.retainedEvidence.push({kind: 'evidence', id, label: old.title, note: old.provenance});
    else out.authoredNotRetained.push({kind: 'evidence', id, label: old.title, note: now ? 'changed by the proposal' : 'not in the proposal'});
  }
  return out;
}

/** Where the reader was when a source refresh started: stable pointers only, never a copy of content. */
export type RefreshReturnContext = {projectId: string; path: string[]; viewId: string; nodeId: string | null; sheet: string};
export type RefreshReturn =
  | {state: 'return'; path: string[]; viewId: string; nodeId: string | null; sheet: string; nodeKept: boolean}
  | {state: 'refused'; message: typeof VIEW_ROUTE_UNAVAILABLE};

/**
 * After Apply or Cancel, go back to the captured view only when its exact drilldown path is still permitted in the
 * current audience (publicDocument for a public audience). A revoked or moved view is refused with the generic
 * message; no other parent, view or component is chosen in its place. The component is reselected only when the
 * view still holds that exact ID.
 */
export function resolveRefreshReturn(context: RefreshReturnContext, live: Project, audience: 'author' | 'public'): RefreshReturn {
  const refused = {state: 'refused', message: VIEW_ROUTE_UNAVAILABLE} as const;
  if (context.projectId !== live.id) return refused;
  const doc = audience === 'public' ? publicDocument(live) : live;
  // The path may continue below the active view (the selected card's open child level). The active view's own
  // prefix must be permitted exactly; deeper open levels are kept only when they are permitted too, else closed.
  const at = context.path.indexOf(context.viewId);
  if (at < 0 || !isPermittedPath(doc, context.path.slice(0, at + 1))) return refused;
  const path = isPermittedPath(doc, context.path) ? [...context.path] : context.path.slice(0, at + 1);
  const view = doc.views.find(v => v.id === context.viewId)!;
  const nodeKept = !!context.nodeId && view.nodeIds.includes(context.nodeId);
  return {state: 'return', path, viewId: context.viewId, nodeId: nodeKept ? context.nodeId : null, sheet: context.sheet, nodeKept};
}
