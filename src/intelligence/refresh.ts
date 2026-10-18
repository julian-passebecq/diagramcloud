import {validateDocument, type Project} from '../core/model';
import {activeSnapshot, ATLAS_ROOT, repoNodeId, rescanRepository} from '../core/atlas/compose';
import type {ImportResult} from '../core/interchange/graph';
import type {ScanModel} from '../core/scan/scanner';
import type {AcquisitionAnalysis} from './acquisition';
import {attachAcquisitionContext} from './materialize';
import type {DomainResult} from './domainAdapters';

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
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
      retainedNode.tags = union(retainedNode.tags, ['Not established by latest scan']).slice(-20);
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
