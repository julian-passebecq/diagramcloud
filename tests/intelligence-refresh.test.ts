import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {documentFromAtlas, activeSnapshot} from '../src/core/atlas/compose';
import {parseManifest} from '../src/core/atlas/manifest';
import {scanRepository} from '../src/core/scan/scanner';
import {previewRepositoryRescan, refreshSummary, resolveRefreshReturn, NOT_ESTABLISHED} from '../src/intelligence/refresh';
import {VIEW_ROUTE_UNAVAILABLE} from '../src/core/hierarchy';
import {pathTo} from '../src/core/viewspec';
import {validateDocument} from '../src/core/model';
import {repositoryOutputFacts} from '../src/intelligence/recipes';

test('selected repository outputs cannot borrow global or another repository relationships and evidence',()=>{
 const manifest=parseManifest(readFileSync('tests/fixtures/atlas/shop.manifest.json','utf8')).manifest;
 const scan=scanRepository([{path:'package.json',text:'{"name":"synthetic","dependencies":{"react":"18"}}'}],{name:'Synthetic'});
 const d=documentFromAtlas(manifest,{shop:{model:scan}},{}).document,scope=repositoryOutputFacts(d,'shop');
 assert.ok(scope.nodes.length>0);assert.ok(scope.nodes.every(n=>n.id==='repo-shop'||n.id.startsWith('shop.')));assert.ok(scope.views.every(v=>v.id.startsWith('shop.')));
 const ids=new Set(scope.nodes.map(n=>n.id));assert.ok(scope.edges.every(e=>ids.has(e.source)&&ids.has(e.target)));assert.deepEqual(repositoryOutputFacts(d,'unlisted'),{nodes:[],edges:[],views:[]});
 assert.ok(scope.nodes.length<repositoryOutputFacts(d).nodes.length);
});

test('repository refresh preserves authored presentation and references while refreshing private scan evidence/vector', () => {
  const manifest = parseManifest(readFileSync('tests/fixtures/atlas/shop.manifest.json', 'utf8')).manifest;
  const scan = (sha: string, extra: boolean) => scanRepository([
    {path: 'package.json', text: '{"name":"synthetic-shop","dependencies":{"react":"18"}}'},
    {path: '.git/HEAD', text: sha.repeat(40)},
    ...(extra ? [{path: 'src/old.ts', text: 'export const old = 1;'}] : []),
  ], {name: 'Synthetic shop'});
  const current = documentFromAtlas(manifest, {shop: {model: scan('a', true)}}, {now: new Date('2026-10-08T10:00:00Z')}).document;
  current.revision = 9;
  const scanned = current.nodes.find(n => n.id.startsWith('shop.') && n.blockIds.length)!;
  scanned.label = 'My authored title'; scanned.summary = 'My authored explanation';
  current.blocks.push({id: 'author-evidence', title: 'Author contribution', type: 'text', text: 'Do not discard my evidence.',
    visibility: 'private', sourceIds: [], provenance: 'author'});
  scanned.blockIds.push('author-evidence');
  const view = current.views.find(v => v.nodeIds.includes(scanned.id))!;
  view.positions[scanned.id] = {x: 817, y: 932};
  current.story.push({title: 'Authored story', viewId: view.id, nodeId: scanned.id, narration: 'Keep this authored story.', highlightEdgeIds: []});
  current.nodes.push({id: 'author-companion', label: 'Author companion', kind: 'app', summary: '', role: '', provider: 'Generic', icon: 'generic',
    tags: [], status: 'idle', blockIds: [], sourceIds: [], visibility: 'private', basis: 'planned'});
  current.edges.push({id: 'author-link', source: 'author-companion', target: scanned.id, label: 'Declared', kind: 'dependency', speed: 'medium', visibility: 'private', basis: 'planned'});
  view.nodeIds.push('author-companion'); view.edgeIds.push('author-link');
  validateDocument(current);
  const before = JSON.stringify(current), result = previewRepositoryRescan(current, 'shop', scan('b', false), undefined, new Date('2026-10-08T11:00:00Z'));
  assert.equal(JSON.stringify(current), before);
  assert.equal(result.document.revision, 9);
  assert.equal(result.document.nodes.find(n => n.id === scanned.id)!.label, 'My authored title');
  assert.equal(result.document.nodes.find(n => n.id === scanned.id)!.summary, 'My authored explanation');
  assert.deepEqual(result.document.views.find(v => v.id === view.id)!.positions[scanned.id], {x: 817, y: 932});
  assert.deepEqual(result.document.story, current.story);
  assert.ok(result.document.blocks.some(b => b.id === 'author-evidence' && b.provenance === 'author'));
  assert.ok(result.document.edges.some(e => e.id === 'author-link'));
  assert.equal(activeSnapshot(result.document).repositories.find(r => r.id === 'shop')!.revision, 'b'.repeat(40));
  assert.equal(result.document.atlas!.snapshots[0].repositories.find(r => r.id === 'shop')!.revision, 'a'.repeat(40));
  assert.ok(result.document.blocks.filter(b => b.id.startsWith('shop.') && b.provenance === 'source-derived').every(b => b.visibility === 'private'));
  const withoutGit = scanRepository([{path: 'package.json', text: '{"name":"synthetic-shop","dependencies":{}}'}], {name: 'Synthetic shop'});
  const unknown = previewRepositoryRescan(result.document, 'shop', withoutGit, undefined, new Date('2026-10-08T12:00:00Z')).document;
  assert.equal(activeSnapshot(unknown).repositories.find(r => r.id === 'shop')!.revision, undefined);
  const facts = unknown.blocks.find(b => b.id === 'repo-shop.facts')!;
  assert.ok(facts.type === 'table' && facts.rows.some(r => r[0] === 'Revision' && r[1] === 'unknown'));
  assert.doesNotThrow(() => validateDocument(result.document));
});

// Source refresh summary and return context (docs/contracts/source-refresh.md).
const refreshManifest = () => parseManifest(readFileSync('tests/fixtures/atlas/shop.manifest.json', 'utf8')).manifest;
const composeScan = (sha: string, services: string[], git = true) => scanRepository([
  {path: 'package.json', text: '{"name":"synthetic-shop","dependencies":{"react":"18"}}'},
  ...(git ? [{path: '.git/HEAD', text: sha.repeat(40)}] : []),
  {path: 'docker-compose.yml', text: `services:\n${services.map(s => `  ${s}:\n    image: ${s === 'cache' ? 'redis:7' : s === 'queue' ? 'rabbitmq:3' : 'node:20'}\n`).join('')}`},
], {name: 'Synthetic shop'});
function refreshFixture() {
  const current = documentFromAtlas(refreshManifest(), {shop: {model: composeScan('a', ['api', 'cache'])}}, {now: new Date('2026-10-08T10:00:00Z')}).document;
  const api = current.nodes.find(n => n.id === 'shop.svc-api')!;
  current.blocks.push({id: 'author-note', title: 'PRIVATE-AUTHOR-NOTE', type: 'text', text: 'PRIVATE-AUTHOR-TEXT', visibility: 'private', sourceIds: [], provenance: 'author'});
  current.blocks.push({id: 'public-note', title: 'Public author note', type: 'text', text: 'Shown.', visibility: 'public', sourceIds: [], provenance: 'author'});
  api.blockIds.push('author-note', 'public-note');
  current.nodes.push({id: 'shop.secret-plan', label: 'PRIVATE-PLANNED-COMPONENT', kind: 'app', summary: '', role: '', provider: 'Generic', icon: 'generic',
    tags: [], status: 'idle', blockIds: [], sourceIds: [], visibility: 'private', basis: 'planned'});
  return validateDocument(current);
}

test('refresh summary: new, changed, uncertain (never removed), unavailable and retained authored evidence', () => {
  const current = refreshFixture(), before = JSON.stringify(current);
  const proposal = previewRepositoryRescan(current, 'shop', composeScan('b', ['api', 'queue']), undefined, new Date('2026-10-08T11:00:00Z')).document;
  const summary = refreshSummary(current, proposal, {repositoryId: 'shop'});
  assert.equal(JSON.stringify(current), before, 'pure: the current document is untouched');
  assert.deepEqual(summary.revision, [{repositoryId: 'shop', from: 'a'.repeat(40), to: 'b'.repeat(40)}]);
  assert.ok(summary.added.some(i => i.kind === 'component' && i.id === 'shop.svc-queue'));
  assert.ok(summary.changed.some(i => i.id === 'repo-shop'));
  // Absent from the rescan: retained with its stable ID and reported as uncertain, never as removed.
  assert.deepEqual(summary.uncertain.map(i => i.id), ['shop.svc-cache']);
  assert.ok(proposal.nodes.some(n => n.id === 'shop.svc-cache'));
  assert.ok(!JSON.stringify(summary).toLowerCase().includes('removed'));
  // An authored (planned) component in the namespace is not a scanner fact: it is neither uncertain nor changed.
  assert.ok(![...summary.uncertain, ...summary.changed].some(i => i.id === 'shop.secret-plan'));
  assert.deepEqual(summary.retainedEvidence.map(i => i.id).sort(), ['author-note', 'public-note']);
  assert.deepEqual(summary.authoredNotRetained, []);
  assert.deepEqual(summary.unavailable, []);
  // Without a Git revision the source is unavailable as attestation.
  const unattested = previewRepositoryRescan(proposal, 'shop', composeScan('c', ['api', 'queue'], false), undefined, new Date('2026-10-08T12:00:00Z')).document;
  const second = refreshSummary(proposal, unattested, {repositoryId: 'shop'});
  assert.ok(second.unavailable.some(i => i.kind === 'repository' && i.id === 'shop' && /revision unknown/.test(i.note!)));
  assert.ok(second.uncertain.some(i => i.id === 'shop.svc-cache' && /earlier refresh/.test(i.note!)));
  // The scope is inferred from the snapshot when no repository is named.
  assert.deepEqual(refreshSummary(current, proposal).repositoryIds, ['shop']);
});

test('refresh summary: a component established again loses the uncertain mark; an authored change is shown', () => {
  const current = refreshFixture();
  const without = previewRepositoryRescan(current, 'shop', composeScan('b', ['api']), undefined, new Date('2026-10-08T11:00:00Z')).document;
  const cache = without.nodes.find(n => n.id === 'shop.svc-cache')!;
  assert.equal(cache.basis, 'unknown'); assert.ok(cache.tags.includes(NOT_ESTABLISHED));
  const back = previewRepositoryRescan(without, 'shop', composeScan('c', ['api', 'cache']), undefined, new Date('2026-10-08T12:00:00Z')).document;
  const again = back.nodes.find(n => n.id === 'shop.svc-cache')!;
  assert.equal(again.basis, 'static-source'); assert.ok(!again.tags.includes(NOT_ESTABLISHED));
  assert.deepEqual(refreshSummary(without, back, {repositoryId: 'shop'}).uncertain, []);
  // A hand-edited proposal that rewrites authored evidence is reported, not hidden.
  const edited = structuredClone(back); (edited.blocks.find(b => b.id === 'author-note') as {text: string}).text = 'changed';
  assert.deepEqual(refreshSummary(without, validateDocument(edited), {repositoryId: 'shop'}).authoredNotRetained.map(i => i.id), ['author-note']);
});

test('refresh summary: a public audience reads publicDocument only', () => {
  const current = refreshFixture();
  const proposal = previewRepositoryRescan(current, 'shop', composeScan('b', ['api', 'queue']), undefined, new Date('2026-10-08T11:00:00Z')).document;
  const text = JSON.stringify(refreshSummary(current, proposal, {repositoryId: 'shop', audience: 'public'}));
  for (const hidden of ['PRIVATE-AUTHOR-NOTE', 'PRIVATE-AUTHOR-TEXT', 'PRIVATE-PLANNED-COMPONENT', 'shop.secret-plan', 'author-note', 'shop.svc-queue']) assert.ok(!text.includes(hidden), hidden);
  assert.ok(text.includes('public-note'));
});

test('refresh return: the exact permitted path is reopened; a revoked view is refused with the generic message', () => {
  const doc = refreshFixture(), repo = doc.nodes.find(n => n.id === 'repo-shop')!;
  const target = doc.views.find(v => v.nodeIds.includes('shop.svc-api'))!, path = pathTo(doc, target.id).map(x => x.viewId);
  assert.ok(repo.childViewId && path.length >= 2 && path[1] === repo.childViewId);
  const context = {projectId: doc.id, path, viewId: target.id, nodeId: 'shop.svc-api', sheet: 'diagram'};
  const back = resolveRefreshReturn(context, doc, 'author');
  assert.ok(back.state === 'return' && back.nodeId === 'shop.svc-api' && back.path.join('/') === context.path.join('/'));
  // A component no longer in the view is not replaced by another one.
  const gone = resolveRefreshReturn({...context, nodeId: 'shop.nothing'}, doc, 'author');
  assert.ok(gone.state === 'return' && gone.nodeId === null && !gone.nodeKept);
  // An open child level below the active view that is no longer reachable is closed, never replaced.
  const deeper = resolveRefreshReturn({...context, path: [...path, 'no-such-child']}, doc, 'author');
  assert.ok(deeper.state === 'return' && deeper.path.join('/') === path.join('/'));
  assert.equal(resolveRefreshReturn({...context, path: path.slice(0, -1)}, doc, 'author').state, 'refused');
  // Revoked: the drilldown pointer is gone, so the path is no longer permitted; no other parent is chosen.
  const revoked = structuredClone(doc); delete revoked.nodes.find(n => n.id === 'repo-shop')!.childViewId;
  assert.deepEqual(resolveRefreshReturn(context, validateDocument(revoked), 'author'), {state: 'refused', message: VIEW_ROUTE_UNAVAILABLE});
  // Private in the public audience: refused exactly like a nonexistent view.
  const hidden = structuredClone(doc); hidden.views.find(v => v.id === target.id)!.visibility = 'private';
  assert.equal(resolveRefreshReturn(context, validateDocument(hidden), 'author').state, 'return');
  assert.deepEqual(resolveRefreshReturn(context, validateDocument(hidden), 'public'), resolveRefreshReturn({...context, viewId: 'nope', path: [doc.rootViewId, 'nope']}, doc, 'public'));
  assert.equal(resolveRefreshReturn({...context, projectId: 'other'}, doc, 'author').state, 'refused');
});
