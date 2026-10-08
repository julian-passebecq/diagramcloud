import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileProjectBrief, parseProjectBrief} from '../src/intelligence/brief';
import {publicDocument} from '../src/core/operations';
const raw = () => readFileSync('examples/project-intelligence/project-brief.json', 'utf8');

test('Guided brief compiles deterministically, without Git or runtime claims', () => {
  const brief = parseProjectBrief(raw()), a = compileProjectBrief(brief), b = compileProjectBrief(brief);
  assert.deepEqual(a, b);
  assert.equal(a.manifest, null);
  assert.equal(a.document.observations.length, 0);
  assert.ok(a.document.nodes.every(n => !n.basis || n.basis === 'planned'));
  assert.ok(a.document.nodes.every(n => n.visibility === 'private'));
  assert.equal(publicDocument(a.document).nodes.length, 0);
});

test('scope cycles, dangling ownership, duplicate relation IDs and secrets are rejected', () => {
  const original = parseProjectBrief(raw());
  const cyclic = structuredClone(original); cyclic.scope[0].parentId = 'ingest';
  assert.throws(() => compileProjectBrief(cyclic), /cycle/);
  const owner = structuredClone(original); owner.ownership[0].teamId = 'missing';
  assert.throws(() => compileProjectBrief(owner), /unknown reference/);
  const duplicates = structuredClone(original); duplicates.relationships[1].id = duplicates.relationships[0].id;
  assert.throws(() => compileProjectBrief(duplicates), /Duplicate relationship/);
  const secret = structuredClone(original); secret.project.summary = 'password=unsafe-placeholder';
  assert.throws(() => compileProjectBrief(secret), /credential/);
});

test('repository membership compiles through the existing manifest, not a second Atlas', () => {
  const brief = parseProjectBrief(raw());
  brief.repositories = [{id: 'api', title: 'API', role: 'service', host: 'local', locator: 'api', path: '/private/local/api', capabilities: [], boundaries: []}];
  brief.scope[0].repositoryIds = ['api'];
  const result = compileProjectBrief(brief);
  assert.equal(result.manifest!.repositories[0].id, 'api');
  assert.ok(!JSON.stringify(result.document).includes('/private/local/api'));
  brief.repositoryRelationships = [{from: 'api', to: 'api', kind: 'dependency', label: 'self'}];
  assert.throws(() => compileProjectBrief(brief), /itself/);
});

test('authored relationship identity survives reordered input', () => {
  const brief = parseProjectBrief(raw());
  const before = compileProjectBrief(brief).document.edges;
  brief.relationships.reverse();
  const after = compileProjectBrief(brief).document.edges;
  assert.deepEqual([...before].sort((a, b) => a.id.localeCompare(b.id)), [...after].sort((a, b) => a.id.localeCompare(b.id)));
});
