import type {Project} from './model';
import {publicDocument, traceNodes} from './operations';

/**
 * Artifact-first entry (V2 AC03). An artifact is something a reader starts from instead of a component: an image
 * evidence block, a table/dataset evidence block, a storage or table component, or a declared verification check
 * (a control component whose label, summary or tags name a check, test, validation, verification or reconciliation).
 * From an artifact the reader reaches the components that cite it and, in every view the audience may open, the
 * producers (upstream) and consumers (downstream) traced along that view's connections only. Read-only: nothing here
 * changes the document, and a check is a declared design element, never an observed result.
 */
export const ARTIFACT_KINDS = ['image', 'dataset', 'storage', 'check'] as const;
export type ArtifactKind = typeof ARTIFACT_KINDS[number];
export const ARTIFACT_KIND_LABEL: Record<ArtifactKind, string> = {image: 'Image', dataset: 'Table / dataset', storage: 'Storage / table component', check: 'Verification check (declared)'};
export type ArtifactViewTrace = {viewId: string; viewTitle: string; componentId: string; producers: string[]; consumers: string[]};
export type ArtifactEntry = {
  key: string;
  kind: ArtifactKind;
  subject: {type: 'block' | 'node'; id: string};
  title: string;
  detail: string;
  /** Components that cite the artifact (block artifacts) or the component itself (node artifacts). */
  componentIds: string[];
  traces: ArtifactViewTrace[];
};
const CHECK = /\b(check|checks|test|tests|testing|validat\w*|verif\w*|quality|assert\w*|reconcil\w*)\b/i;
export function isVerificationCheck(node: Project['nodes'][number]): boolean {
  return node.kind === 'control' && (CHECK.test(node.label) || CHECK.test(node.summary) || node.tags.some(t => CHECK.test(t)));
}
/** The document the audience may read: public projection for a public audience, the authoring document for the author. */
export function artifactProjection(doc: Project, audience: 'public' | 'author'): Project {
  return audience === 'public' ? publicDocument(doc) : doc;
}
function traces(doc: Project, componentIds: string[]): ArtifactViewTrace[] {
  const out: ArtifactViewTrace[] = [];
  for (const view of doc.views) for (const id of componentIds) {
    if (!view.nodeIds.includes(id)) continue;
    const up = [...traceNodes(doc, view.id, id, 'upstream')].filter(x => x !== id), down = [...traceNodes(doc, view.id, id, 'downstream')].filter(x => x !== id);
    out.push({viewId: view.id, viewTitle: view.title, componentId: id, producers: view.nodeIds.filter(n => up.includes(n)), consumers: view.nodeIds.filter(n => down.includes(n))});
  }
  return out;
}
/** Every artifact the audience may see, in document order: blocks first (images, then datasets), then components. */
export function artifactEntries(input: Project, options: {audience?: 'public' | 'author'} = {}): ArtifactEntry[] {
  const doc = artifactProjection(input, options.audience ?? 'public'), out: ArtifactEntry[] = [];
  const citing = (blockId: string) => doc.nodes.filter(n => n.blockIds.includes(blockId)).map(n => n.id);
  for (const kind of ['image', 'dataset'] as const) for (const b of doc.blocks) {
    if ((kind === 'image' && b.type !== 'image') || (kind === 'dataset' && b.type !== 'table')) continue;
    const ids = citing(b.id);
    const detail = b.type === 'table' ? `${b.columns.length} columns · ${b.rows.length} rows · ${b.provenance}` : `${b.type === 'image' && b.caption ? b.caption + ' · ' : ''}${b.provenance}`;
    out.push({key: 'block:' + b.id, kind, subject: {type: 'block', id: b.id}, title: b.title, detail, componentIds: ids, traces: traces(doc, ids)});
  }
  for (const n of doc.nodes) {
    const kind: ArtifactKind | null = n.kind === 'storage' || n.kind === 'table' ? 'storage' : isVerificationCheck(n) ? 'check' : null;
    if (!kind) continue;
    const detail = kind === 'check' ? `Designed status ${n.status}; a declared check, not an observed result` : `${n.provider} · ${n.kind}`;
    out.push({key: 'node:' + n.id, kind, subject: {type: 'node', id: n.id}, title: n.label, detail, componentIds: [n.id], traces: traces(doc, [n.id])});
  }
  return out;
}

/**
 * Shared membership (V2 AC04): one stable component may be a member of several views. Unique components are counted
 * once by stable ID; view memberships count every (view, component) pair. The two numbers are never merged.
 */
export function componentMembership(doc: Project) {
  const byNode = new Map<string, string[]>();
  for (const view of doc.views) for (const id of view.nodeIds) byNode.set(id, [...(byNode.get(id) ?? []), view.id]);
  const label = new Map(doc.nodes.map(n => [n.id, n.label]));
  const shared = [...byNode].filter(([, views]) => views.length > 1).map(([id, views]) => ({id, label: label.get(id) ?? id, viewIds: views}));
  return {uniqueComponents: byNode.size, viewMemberships: [...byNode.values()].reduce((sum, v) => sum + v.length, 0), views: doc.views.length, shared};
}
