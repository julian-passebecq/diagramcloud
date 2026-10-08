import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileProjectBrief, parseProjectBrief} from '../src/intelligence/brief';
import {compileHybridBrief, previewBriefReimport, previewCandidateReimport} from '../src/intelligence/bridge';
import {applyDocumentPatch} from '../src/core/patch';
import {publicDocument} from '../src/core/operations';
import {mapAuthorizedDocuments} from '../src/intelligence/documents';
import {scanRepository} from '../src/core/scan/scanner';

const brief = () => parseProjectBrief(readFileSync('examples/project-intelligence/project-brief.json', 'utf8'));
test('Guided tasks reuse declared private experience entities and inert workspaces', () => {
  const d = compileProjectBrief(brief()).document;
  const task = d.nodes.find(n => n.id === 'brief-scope-ingest')!;
  assert.equal(task.experienceWorkspaceId, 'brief-workspace-ingest');
  assert.ok(d.experience!.workspaces.some(w => w.id === task.experienceWorkspaceId));
  assert.ok(d.experience!.entities.every(e => e.assertion === 'declared' && e.visibility === 'private'));
  assert.ok(d.experience!.items.every(i => i.approval === 'draft'));
  assert.equal(publicDocument(d).experience, undefined);
});

test('three explicit Hybrid members remain navigable and unscanned without automatic joins', () => {
  const b = brief();
  b.repositories = ['api', 'data', 'docs'].map(id => ({id, title: `${id} project`, role: 'service', host: 'local',
    locator: `private-locator-${id}`, path: `C:/private-machine/${id}`, capabilities: [], boundaries: []}));
  b.scope[0].repositoryIds = ['api', 'data'];
  b.repositoryRelationships = [{from: 'api', to: 'data', label: 'Declared data dependency', kind: 'dependency'}];
  const d = compileHybridBrief(b, {}, {now: new Date('2026-10-08T12:00:00Z')}).document;
  assert.equal(d.atlas!.snapshots[0].repositories.length, 3);
  assert.ok(d.atlas!.snapshots[0].repositories.every(r => r.scanStatus === 'not-scanned' && r.visibility === 'private'));
  assert.equal(d.edges.filter(e => e.id.startsWith('brief-binding-')).length, 2);
  assert.equal(d.edges.filter(e => e.id.startsWith('rel-')).length, 1);
  assert.ok(d.nodes.some(n => n.id === 'brief-repositories-navigation' && n.childViewId === 'atlas'));
  assert.ok(!JSON.stringify(d).includes('C:/private-machine'));
  assert.ok(!JSON.stringify(publicDocument(d)).includes('private-locator'));
  assert.throws(() => compileHybridBrief(b, {unlisted: {missing: true}}), /Undeclared/);
  const model = scanRepository([{path: 'package.json', text: '{"name":"api-demo","dependencies":{}}'},
    {path: '.git/HEAD', text: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n'}], {name: 'Synthetic API'});
  const partial = compileHybridBrief(b, {api: {model}, docs: {missing: true}}, {now: new Date('2026-10-08T12:00:00Z')}).document;
  const vector = partial.atlas!.snapshots[0].repositories;
  assert.deepEqual(vector.map(r => r.scanStatus), ['scanned', 'not-scanned', 'missing']);
  assert.equal(vector[0].revision, 'a'.repeat(40));
  assert.equal(vector[1].revision, undefined);
  assert.ok(partial.nodes.some(n => n.id === 'repo-api' && n.childViewId));
  assert.equal(partial.observations.length, 0);
});

test('brief reimport adds stable IDs while preserving authored work and enforcing captured revision', () => {
  const b = brief(), current = compileProjectBrief(b).document;
  current.revision = 7;
  current.nodes[0].label = 'Manual title';
  current.nodes[0].summary = 'Manual summary';
  // Human publication review may detach private references from a public node.
  current.nodes[0].sourceIds = []; current.nodes[0].visibility = 'public';
  current.views[0].positions[current.nodes[0].id] = {x: 913, y: 415};
  assert.equal(current.blocks[0].type, 'text');
  if (current.blocks[0].type === 'text') current.blocks[0].text = 'Manual private evidence';
  current.story = [{title: 'Manual narrative', viewId: current.rootViewId, narration: 'Keep this narrative', highlightEdgeIds: []}];
  b.scope.push({id: 'new-task', title: 'New task', summary: '', kind: 'task', parentId: 'data', repositoryIds: []});
  b.scope[0].title = 'Incoming title';
  const before = JSON.stringify(current), preview = previewBriefReimport(current, b, 7);
  assert.equal(JSON.stringify(current), before);
  assert.equal(preview.document.nodes[0].label, 'Manual title');
  assert.equal(preview.document.nodes[0].summary, 'Manual summary');
  assert.equal(preview.document.nodes[0].visibility, 'public');
  assert.deepEqual(preview.document.nodes[0].sourceIds, []);
  assert.deepEqual(preview.document.views[0].positions[current.nodes[0].id], {x: 913, y: 415});
  assert.deepEqual(preview.document.blocks[0], current.blocks[0]);
  assert.deepEqual(preview.document.story, current.story);
  assert.ok(preview.document.nodes.some(n => n.id === 'brief-scope-new-task'));
  assert.ok(preview.document.experience!.workspaces.some(w => w.id === 'brief-workspace-new-task'));
  assert.throws(() => previewBriefReimport(current, b, 6), /Revision conflict/);
  current.revision++;
  assert.throws(() => applyDocumentPatch(current, preview.patch), /revision/i);
});

test('ambiguous candidate identity and dangling references reject without mutation', () => {
  const current = compileProjectBrief(brief()).document;
  const candidate = structuredClone(current);
  candidate.edges[0].target = candidate.edges[0].source;
  const before = JSON.stringify(current);
  assert.throws(() => previewCandidateReimport(current, candidate, 0), /Conflicting relationship/);
  assert.equal(JSON.stringify(current), before);
  const b = brief(); b.scope[0].repositoryIds = ['missing'];
  assert.throws(() => previewBriefReimport(current, b, 0), /unknown reference/);
  assert.equal(JSON.stringify(current), before);
});

test('authorized document boundary excludes secrets and reports partial references', () => {
  const map = mapAuthorizedDocuments([{path: 'README.md', text: '# Current\n[Missing](not-selected.md)\n[Safe](notes.md)'},
    {path: 'notes.md', text: '# Safe\nSelected prose is inert.'}, {path: 'other.md', text: 'password=unsafe-placeholder'}]);
  assert.equal(map.documents.length, 2);
  assert.equal(map.links.length, 1);
  assert.ok(map.diagnostics.some(d => d.code === 'unsafe'));
  assert.ok(map.diagnostics.some(d => d.code === 'unresolved'));
  assert.ok(!JSON.stringify(map).includes('unsafe-placeholder'));
});
