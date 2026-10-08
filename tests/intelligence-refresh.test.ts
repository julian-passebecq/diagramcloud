import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {documentFromAtlas, activeSnapshot} from '../src/core/atlas/compose';
import {parseManifest} from '../src/core/atlas/manifest';
import {scanRepository} from '../src/core/scan/scanner';
import {previewRepositoryRescan} from '../src/intelligence/refresh';
import {validateDocument} from '../src/core/model';

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
