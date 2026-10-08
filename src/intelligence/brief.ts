import {z} from 'zod';
import {documentSchema, validateDocument, type Project} from '../core/model';
import {manifestRepositorySchema, validateManifest, type ProjectManifest} from '../core/atlas/manifest';
import {secretFindings} from '../core/secrets';

const id = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
const title = z.string().min(1).max(160);
const relationKind = z.enum(['batch', 'stream', 'query', 'control', 'dependency']);
export const projectBriefSchema = z.object({
  format: z.literal('diagramcloud.project-brief'), version: z.literal(1),
  project: z.object({id, title, summary: z.string().max(3000).default('')}).strict(),
  scope: z.array(z.object({id, title, kind: z.enum(['workstream', 'system', 'task', 'component']).default('component'),
    summary: z.string().max(500).default(''), parentId: id.optional(),
    repositoryIds: z.array(z.string().max(24)).max(40).default([]),
  }).strict()).max(60).default([]),
  repositories: z.array(manifestRepositorySchema).max(40).default([]),
  relationships: z.array(z.object({id, from: id, to: id, label: z.string().max(160).default(''), kind: relationKind.default('dependency')}).strict()).max(150).default([]),
  repositoryRelationships: z.array(z.object({from: z.string().max(24), to: z.string().max(24), label: z.string().max(160).default(''), kind: relationKind.default('dependency')}).strict()).max(150).default([]),
  teams: z.array(z.object({id, title}).strict()).max(30).default([]),
  ownership: z.array(z.object({scopeId: id, teamId: id, role: z.enum(['business', 'technical', 'operational'])}).strict()).max(100).default([]),
  environments: z.array(z.object({id, title, kind: z.enum(['development', 'test', 'staging', 'production', 'preview', 'other'])}).strict()).max(20).default([]),
  questions: z.array(z.string().min(1).max(300)).max(12).default([]),
}).strict();
export type ProjectBrief = z.infer<typeof projectBriefSchema>;

export function parseProjectBrief(raw: string): ProjectBrief {
  if (new TextEncoder().encode(raw).byteLength > 512 * 1024) throw new Error('ProjectBrief exceeds 512 KiB');
  return validateProjectBrief(JSON.parse(raw));
}
export function validateProjectBrief(input: unknown): ProjectBrief {
  const brief = projectBriefSchema.parse(input);
  const problems = secretFindings(brief);
  const unique = (values: {id: string}[], kind: string) => {
    const set = new Set<string>();
    for (const value of values) {if (set.has(value.id)) problems.push(`Duplicate ${kind} ID: ${value.id}`); set.add(value.id);}
    return set;
  };
  const scopes = unique(brief.scope, 'scope'), repos = unique(brief.repositories, 'repository'), teams = unique(brief.teams, 'team');
  unique(brief.environments, 'environment');
  unique(brief.relationships, 'relationship');
  const check = (ref: string, set: Set<string>, context: string) => {if (!set.has(ref)) problems.push(`${context}: unknown reference ${ref}`);};
  const parent = new Map(brief.scope.map(s => [s.id, s.parentId]));
  for (const scope of brief.scope) {
    if (scope.parentId) check(scope.parentId, scopes, scope.id);
    scope.repositoryIds.forEach(ref => check(ref, repos, scope.id));
    const visited = new Set<string>(); let at: string | undefined = scope.id;
    while (at) {if (visited.has(at)) {problems.push(`Scope cycle at ${scope.id}`); break;} visited.add(at); at = parent.get(at);}
  }
  for (const relation of brief.relationships) {check(relation.from, scopes, 'Relationship'); check(relation.to, scopes, 'Relationship');}
  for (const relation of brief.repositoryRelationships) {check(relation.from, repos, 'Repository relationship'); check(relation.to, repos, 'Repository relationship');}
  for (const owner of brief.ownership) {check(owner.scopeId, scopes, 'Ownership'); check(owner.teamId, teams, 'Ownership');}
  // Reuse the real manifest validator, including locator credential checks and membership.
  if (brief.repositories.length) briefManifest(brief);
  for (const repository of brief.repositories) {
    try {const url = new URL(repository.locator); if (url.username || url.password || [...url.searchParams.keys()].some(k => /token|key|secret|sig/i.test(k))) problems.push(`${repository.id}: credential-bearing locator`);} catch {
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(repository.locator)) problems.push(`${repository.id}: invalid locator`);
    }
  }
  if (problems.length) throw new Error(problems.slice(0, 20).join('\n'));
  return brief;
}

/** Null is normal for a Guided project with no Git. Local paths never enter Project. */
export function briefManifest(brief: ProjectBrief): ProjectManifest | null {
  if (!brief.repositories.length) return null;
  return validateManifest({format: 'diagramcloud.project-manifest', version: 1,
    project: brief.project, repositories: brief.repositories,
    relationships: brief.repositoryRelationships.map(r => ({...r, basis: 'planned'})),
  });
}

/** Creates a NEW candidate. Call the application's normal preview/apply before persistence.
 * This is intentionally not a rescan/merge API: don't replace an edited Project with this output.
 * User scope, teams and environments are declarations, never verified infrastructure.
 */
export function compileProjectBrief(input: unknown): {document: Project; manifest: ProjectManifest | null; warnings: string[]} {
  const b = validateProjectBrief(input);
  const document: Project = documentSchema.parse({schemaVersion: 1, id: `brief-${b.project.id}`, title: b.project.title,
    summary: b.project.summary, category: 'Blank', rootViewId: 'brief-overview', nodes: [], edges: [],
    views: [{id: 'brief-overview', title: 'Project overview', perspective: 'system', visibility: 'public'}],
    sources: [{id: 'project-brief-source', title: 'Author-supplied ProjectBrief', location: 'Declared project context; repositories and runtime have not been inspected.', visibility: 'private'}],
    provenance: 'Compiled from an author-supplied ProjectBrief. Declarations only; not a repository scan or observed runtime.',
  });
  const nodeId = (id: string) => `brief-scope-${id}`;
  const sourceIds = ['project-brief-source'];
  for (const s of b.scope) {
    const owners = b.ownership.filter(o => o.scopeId === s.id).map(o => `${o.role}: ${b.teams.find(t => t.id === o.teamId)!.title}`);
    const blockId = `brief-meta-${s.id}`;
    document.blocks.push({id: blockId, title: 'Declared project context', type: 'text', visibility: 'private', sourceIds, provenance: 'author',
      text: [s.summary, ...owners, s.repositoryIds.length ? `Declared repository bindings: ${s.repositoryIds.join(', ')}` : 'No repository binding supplied.'].filter(Boolean).join('\n')});
    document.nodes.push({id: nodeId(s.id), label: s.title, kind: s.kind === 'system' ? 'app' : s.kind === 'workstream' ? 'control' : 'process',
      provider: 'Generic', icon: 'generic', summary: s.summary, role: owners.join('; ').slice(0, 1000), status: 'idle',
      blockIds: [blockId], sourceIds, tags: ['Declared', s.kind], basis: 'planned', visibility: 'private',
      ...(b.scope.some(child => child.parentId === s.id) ? {childViewId: `brief-children-${s.id}`} : {}),
    });
  }
  const makeView = (id: string, title: string, ids: string[]) => ({id, title, description: 'Author-declared structure. Not inferred from folder names.',
    perspective: 'system' as const, visibility: 'private' as const, nodeIds: ids, edgeIds: [] as string[],
    positions: Object.fromEntries(ids.map((node, i) => [node, {x: (i % 3) * 300, y: Math.floor(i / 3) * 180}])),
  });
  Object.assign(document.views[0], makeView('brief-overview', 'Project overview', b.scope.filter(s => !s.parentId).map(s => nodeId(s.id))), {visibility: 'public'});
  for (const s of b.scope) {
    const children = b.scope.filter(child => child.parentId === s.id);
    if (children.length) document.views.push(makeView(`brief-children-${s.id}`, `Inside ${s.title}`.slice(0, 160), children.map(child => nodeId(child.id))));
  }
  // A relation may cross hierarchy branches. Keep a separate reachable relation view,
  // instead of assigning a fake parent or pulling foreign nodes into each tree level.
  if (b.relationships.length) {
    const ids = [...new Set(b.relationships.flatMap(r => [nodeId(r.from), nodeId(r.to)]))];
    const view = makeView('brief-relations', 'Declared relationships', ids);
    b.relationships.forEach(r => {
      const id = `brief-relation-${r.id}`;
      document.edges.push({id, source: nodeId(r.from), target: nodeId(r.to), label: r.label, kind: r.kind, speed: 'medium', basis: 'planned', visibility: 'private'});
      view.edgeIds.push(id);
    });
    document.views.push(view);
    document.nodes.push({id: 'brief-relations-navigation', label: 'Declared relationships', kind: 'control', provider: 'Generic', icon: 'generic',
      summary: 'Navigation to a relationship view, not an infrastructure component.', role: '', status: 'idle', tags: ['Navigation'],
      blockIds: [], sourceIds, childViewId: view.id, visibility: 'private'});
    document.views[0].nodeIds.push('brief-relations-navigation');
  }
  // Reuse the existing, bounded evidence/portfolio grammar for environment declarations.
  if (b.environments.length || b.questions.length || b.repositories.length) {
    document.blocks.push({id: 'brief-context', title: 'Context and declared environments', type: 'text', visibility: 'private', sourceIds, provenance: 'author',
      text: [...b.environments.map(e => `Environment declared: ${e.title} (${e.kind}). Deployment not established.`),
        ...b.questions.map(q => `Question: ${q}`),
        ...b.repositories.map(r => `Repository declared: ${r.id} (${r.title}). Source not scanned.`)].join('\n')});
    document.nodes.push({id: 'brief-context-card', label: 'Project context', kind: 'control', provider: 'Generic', icon: 'generic',
      summary: 'Declared repositories, environments and questions. No deployment status is implied.', role: '', status: 'idle',
      blockIds: ['brief-context'], sourceIds, tags: ['Declared'], basis: 'planned', visibility: 'private'});
    document.views[0].nodeIds.push('brief-context-card');
  }
  if (!document.nodes.length) {
    document.nodes.push({id: 'brief-project-card', label: b.project.title, kind: 'app', provider: 'Generic', icon: 'generic', summary: b.project.summary.slice(0, 500),
      role: '', status: 'idle', blockIds: [], sourceIds, tags: ['Declared'], basis: 'planned', visibility: 'private'});
    document.views[0].nodeIds.push('brief-project-card');
  }
  document.views[0].positions = Object.fromEntries(document.views[0].nodeIds.map((id, i) => [id, {x: (i % 3) * 300, y: Math.floor(i / 3) * 180}]));
  return {document: validateDocument(document), manifest: briefManifest(b), warnings: [
    'Candidate only. Apply through the existing review flow; do not overwrite an edited project.',
    'Generated nodes, evidence and child views are private. Publication requires an explicit visibility/source review.',
    'Environments and repository bindings are declarations, not deployment or test evidence.',
    'The project manifest is separate input to the existing Atlas; this compiler does not scan or merge repositories.',
  ]};
}
