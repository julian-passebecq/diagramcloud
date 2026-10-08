import test from 'node:test';
import assert from 'node:assert/strict';
import type {Project} from '../src/core/model';
import {projectReadiness} from '../src/intelligence/readiness';
import {planAssets, assetChecklistCsv} from '../src/intelligence/assets';
import {mapDocuments, readCsv, wantedDocument} from '../src/intelligence/documents';

// Minimal already-validated-domain-shaped fixture. This suite tests derived pure functions;
// core document validation and the real compiler are exercised separately.
const sample = (): Project => ({schemaVersion: 1, id: 'fixture', revision: 4, title: 'Synthetic CLI', summary: '',
  author: '', category: 'Blank', tags: [], rootViewId: 'root', provenance: 'synthetic test',
  nodes: [{id: 'tool', label: 'Tool', kind: 'app', provider: 'Generic', icon: 'generic', summary: '', role: '', status: 'idle', blockIds: [], sourceIds: [], tags: [], visibility: 'private', basis: 'static-source'}],
  edges: [], views: [{id: 'root', title: 'Root', description: '', nodeIds: ['tool'], edgeIds: [], positions: {}, visibility: 'public', perspective: 'system'}],
  blocks: [], assets: [], sources: [], story: [], observations: [],
});
const safe = () => true; // Synthetic fixture only; production callers use secretInText.

test('readiness always plans four outputs without inventing a relationship or changing the Project', () => {
  const project = sample(), before = JSON.stringify(project), report = projectReadiness(project);
  assert.equal(report.views.filter(v => v.required).length, 4);
  assert.equal(report.views.find(v => v.id === 'relations')!.availability, 'empty-state');
  assert.equal(report.scope, 'current-project-projection');
  assert.equal(JSON.stringify(project), before);
  assert.ok(!report.gaps.some(g => g.id === 'runtime-qualification'));
});

test('gaps are relative to purpose, and audit never claims that it ran tests', () => {
  const project = sample();
  assert.ok(!projectReadiness(project).gaps.some(g => g.id === 'business-purpose'));
  assert.equal(projectReadiness(project, {purpose: 'portfolio'}).gaps.find(g => g.id === 'contribution')!.state, 'missing-required');
  assert.equal(projectReadiness(project, {purpose: 'audit'}).gaps.find(g => g.id === 'runtime-qualification')!.state, 'unsupported');
  assert.throws(() => projectReadiness(project, {depth: 'autonomous' as 'quick'}));
});

test('named technology alone does not invent capabilities or production status', () => {
  const project = sample(); project.nodes[0].label = 'Production Fabric Databricks';
  assert.equal(projectReadiness(project).capabilities.find(c => c.id === 'cloud')!.state, 'not-established');
  assert.equal(projectReadiness(project).capabilities.find(c => c.id === 'data')!.state, 'not-established');
});

test('asset planning is fallback-only, and checklist values are spreadsheet-safe', () => {
  const project = sample(); project.nodes[0].label = '=HYPERLINK("test")'; project.nodes[0].icon = '../../untrusted.svg';
  project.nodes[0].provider = 'Azure';
  const plan = planAssets(project, [{id: 'generic', origin: 'original'}]);
  assert.equal(plan.requirements[0].resolvedIcon, 'generic');
  assert.equal(plan.requirements[0].blocksRendering, false);
  assert.equal(plan.requirements[0].recommendation, 'official-asset-review');
  assert.ok(assetChecklistCsv(plan).includes('"\'=HYPERLINK(""test"")"'));
  assert.throws(() => planAssets(project, []));
});

test('document mapping resolves exact links, ignores fenced examples and never fetches URLs', () => {
  const map = mapDocuments([
    {path: 'README.md', text: '# Overview\n[Decision](docs/adr.md)\n```md\n[fake](missing.md)\n```\n[web](https://example.com)\n'},
    {path: 'docs/adr.md', text: '# ADR\n[Home](../README.md)\n[Escape](../../outside.md)\n'},
  ], safe);
  assert.equal(map.links.length, 2);
  assert.equal(map.links[0].fromLine, 2);
  assert.equal(map.diagnostics.filter(d => d.code === 'unresolved').length, 1);
  assert.deepEqual(map, mapDocuments([
    {path: 'docs/adr.md', text: '# ADR\n[Home](../README.md)\n[Escape](../../outside.md)\n'},
    {path: 'README.md', text: '# Overview\n[Decision](docs/adr.md)\n```md\n[fake](missing.md)\n```\n[web](https://example.com)\n'},
  ], safe));
});

test('CSV quoted multiline records retain exact source line ranges', () => {
  const rows = readCsv('id,note\r\ns1,"hello,\r\nworld"\r\ns2,"a ""quote"""\r\n');
  assert.deepEqual(rows.map(r => [r.startLine, r.endLine]), [[1, 1], [2, 3], [4, 4]]);
  assert.equal(rows[2].cells[1], 'a "quote"');
  assert.throws(() => readCsv('id,note\n1,"unterminated'));
});

test('source_ids links need a unique selected sources.csv record, not coincident names', () => {
  const input = [{path: 'sources.csv', text: 'id,url\ns1,https://example.com\n'},
    {path: 'work.csv', text: 'id,source_ids\nw1,s1;s2\n'}];
  const map = mapDocuments(input, safe);
  assert.equal(map.links.length, 1);
  assert.equal(map.links[0].kind, 'source-record');
  assert.equal(map.links[0].toLine, 2);
  assert.equal(map.diagnostics[0].code, 'unresolved');
  const ambiguous = mapDocuments([...input, {path: 'old/sources.csv', text: 'id,url\ns1,https://example.org\n'}], safe);
  assert.equal(ambiguous.links.length, 0);
  assert.ok(ambiguous.diagnostics.some(d => d.code === 'ambiguous'));
});

test('unsafe paths and rejected text are not mapped; invalid CSV leaves no partial records', () => {
  for (const path of ['../README.md', '/README.md', 'C:\\private.csv', '.git/x.md', 'node_modules/pkg/README.md', 'credentials.csv']) assert.equal(wantedDocument(path), false, path);
  const map = mapDocuments([{path: 'README.md', text: 'FORBIDDEN'}, {path: '../outside.md', text: 'secret'},
    {path: 'sources.csv', text: 'id,url\ns1,https://example.com\ns2,wrong,extra\n'},
    {path: 'work.csv', text: 'id,source_ids\nw1,s1\n'}], text => !text.includes('FORBIDDEN'));
  assert.equal(map.omitted.documents, 2);
  assert.equal(map.links.length, 0);
  assert.equal(map.documents.find(d => d.path === 'sources.csv')!.records.length, 0);
  assert.ok(map.diagnostics.some(d => d.code === 'invalid'));
  assert.throws(() => mapDocuments([{path: 'same.md', text: 'a'}, {path: 'same.md', text: 'b'}], safe));
});
