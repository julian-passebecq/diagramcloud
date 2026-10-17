import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {samples} from '../src/data/samples';
import {blockSchema, clone, validateDocument, type Project} from '../src/core/model';
import {artifactEntries, componentMembership} from '../src/core/artifactEntry';
import {collectionFacts, publicCollection, validateCollection} from '../src/intelligence/library';
import {galaxyProcess} from '../src/intelligence/learning/journeys';
import {WorkflowPlayback, NO_RUN_DATA} from '../src/ui/WorkflowPlayback';
import {ArtifactEntry} from '../src/ui/ArtifactEntry';
import {PLAYBACK_LABEL} from '../src/intelligence/learning/playback';

const total = samples.find(d => d.id === 'total-project-controls')!;

test('artifacts: images, datasets, storage components and declared checks each lead to citing components and producer/consumer traces within the view', () => {
  const d = clone(total);
  d.assets.push({id: 'shot', name: 'shot.png', data: 'data:image/png;base64,AAAA', visibility: 'public', rights: 'Own screenshot'});
  d.blocks.push(blockSchema.parse({id: 'shot-block', type: 'image', title: 'Report screenshot', assetId: 'shot'}));
  d.nodes.find(n => n.id === 'powerbi')!.blockIds.push('shot-block');
  const all = artifactEntries(validateDocument(d), {audience: 'author'}), kinds = new Set(all.map(a => a.kind));
  assert.deepEqual([...kinds].sort(), ['check', 'dataset', 'image', 'storage']);
  const image = all.find(a => a.key === 'block:shot-block')!;
  assert.deepEqual(image.componentIds, ['powerbi']);
  assert.deepEqual(image.traces.find(t => t.viewId === 'overview')!.producers, ['business', 'excel', 'oracle', 'checks']);
  const oracle = all.find(a => a.key === 'node:oracle')!;
  assert.equal(oracle.kind, 'storage');
  assert.deepEqual(oracle.traces, [{viewId: 'overview', viewTitle: oracle.traces[0].viewTitle, componentId: 'oracle', producers: ['business', 'excel'], consumers: ['checks', 'powerbi']}]);
  const check = all.find(a => a.key === 'node:checks')!;
  assert.equal(check.kind, 'check');assert.match(check.detail, /not an observed result/);
  const dataset = all.find(a => a.key === 'block:schedule-input')!;
  assert.deepEqual(dataset.componentIds, ['sample-rows']);assert.deepEqual(dataset.traces[0].consumers, ['check-function', 'check-output']);
  assert.deepEqual(d, clone(d), 'reading artifacts never mutates');
});

test('artifacts: a public audience never sees a private block, a private view trace or a private component', () => {
  const d = clone(total);
  d.blocks.find(b => b.id === 'cost-table')!.visibility = 'private';
  d.views.find(v => v.id === 'check-detail')!.visibility = 'private';
  d.nodes.find(n => n.id === 'excel')!.visibility = 'private';
  const pub = artifactEntries(d, {audience: 'public'}), author = artifactEntries(d, {audience: 'author'});
  assert.ok(author.some(a => a.key === 'block:cost-table'));
  assert.ok(!pub.some(a => a.key === 'block:cost-table'));
  assert.ok(!pub.some(a => a.traces.some(t => t.viewId === 'check-detail')));
  assert.ok(!JSON.stringify(pub).includes('"excel"'));
  const html = renderToStaticMarkup(createElement(ArtifactEntry, {project: d, publicMode: true}));
  assert.ok(!html.includes('Illustrative quarterly phasing'));
});

test('shared membership: unique components by stable ID are counted separately from view memberships', () => {
  const d = clone(total), view = d.views.find(v => v.id === 'validation')!;
  view.nodeIds.push('oracle');view.positions.oracle = {x: 900, y: 0};
  const m = componentMembership(validateDocument(d)), before = componentMembership(total);
  assert.equal(m.uniqueComponents, before.uniqueComponents);
  assert.equal(m.viewMemberships, before.viewMemberships + 1);
  assert.deepEqual(m.shared.map(s => [s.id, s.viewIds]), [['oracle', ['overview', 'validation']]]);
});

function withRepos(base: Project, id: string, repos: {id: string; title: string; host: 'github' | 'local'; locator: string}[]): Project {
  const p = clone(base);p.id = id;
  p.atlas = {activeSnapshotId: 'snap', snapshots: [{id: 'snap', capturedAt: '2026-10-01T00:00:00Z', repositories: repos.map(r => ({...r, scanStatus: 'not-scanned' as const, authority: 'author' as const, visibility: 'public' as const})), runtimeRefs: [], contextRefs: []}]};
  return validateDocument(p);
}
test('collection facts: unique repositories are identified by host + locator, never by title, and kept apart from memberships', () => {
  const a = withRepos(samples[0], 'member-a', [{id: 'core', title: 'Core', host: 'github', locator: 'https://github.com/example/core'}, {id: 'web', title: 'Web', host: 'github', locator: 'https://github.com/example/web'}]);
  const b = withRepos(samples[1], 'member-b', [{id: 'engine', title: 'A different title', host: 'github', locator: 'https://github.com/example/core.git'}, {id: 'web', title: 'Web', host: 'local', locator: 'https://github.com/example/web'}]);
  const c = validateCollection({format: 'diagramcloud.collection/1', id: 'shared-repos', title: 'Synthetic collection', revision: 0, projectIds: ['member-a', 'member-b'], publicationIds: [], visibility: 'public'});
  const facts = collectionFacts(c, [a, b]);
  assert.equal(facts.repositories.memberships, 4);
  assert.equal(facts.repositories.unique, 3, 'same locator under another host is another repository; same locator and host is one');
  assert.deepEqual(facts.repositories.shared.map(r => r.projectIds), [['member-a', 'member-b']]);
  assert.equal(facts.repositories.identity, 'host + locator');
  const sameTitle = withRepos(samples[1], 'member-b', [{id: 'core', title: 'Core', host: 'github', locator: 'https://github.com/other/core'}]);
  assert.equal(collectionFacts(c, [a, sameTitle]).repositories.unique, 3, 'a shared title never merges repositories');
  assert.equal(publicCollection(c, [a, b]).repositories.unique, 3);
});

test('declared-workflow playback: a project view plays its declared steps as a presented sequence with no run data, and a view without one invents no order', () => {
  const doc = galaxyProcess(), before = JSON.stringify(doc);
  const html = renderToStaticMarkup(createElement(WorkflowPlayback, {project: doc, viewId: 'procedure-steps'}));
  assert.match(html, /Play declared steps/);assert.match(html, /Declared step order/);
  const none = renderToStaticMarkup(createElement(WorkflowPlayback, {project: doc, viewId: 'overview'}));
  assert.ok(!none.includes('Play declared steps'));assert.match(none, /No order is invented/);
  assert.equal(JSON.stringify(doc), before);
  assert.equal(NO_RUN_DATA, 'No run data: times and outcome UNKNOWN');assert.equal(PLAYBACK_LABEL, 'Presented sequence - not a run, not timing');
});
