import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DELIVERY_VIEW_LIMITS, DELIVERY_VIEW_REFUSAL, REMAINING_NOTICE, deliveryEvidence, parseDeliveryView} from '../src/development/deliveryEvidence';
import {sha256Hex} from '../src/core/proposal';
import {DeliveryEvidencePanel} from '../src/ui/DeliveryEvidencePanel';

// Synthetic fixture: an invented "Example Service" with five blocks.
const RAW = readFileSync(new URL('./fixtures/delivery-evidence/example-service.json', import.meta.url), 'utf8');
const plan = () => JSON.parse(RAW);
const raw = (o: unknown) => JSON.stringify(o);
const refused = (input: string) => assert.throws(() => parseDeliveryView(input), (e: Error) => e.message === DELIVERY_VIEW_REFUSAL);
const binding = {projectId: 'p', audience: 'author' as const, epoch: 1};

test('delivery plan: unknown fields are listed, never interpreted', () => {
  const v = parseDeliveryView(RAW);
  assert.deepEqual(v.ignoredFields, ['blocks[].priority', 'x_extension_note']);
  assert.equal(v.inputSha256, sha256Hex(RAW));
  assert.equal(v.blocks.length, 5);
  assert.ok(!JSON.stringify(v).includes('An unknown top-level field'));
  assert.ok(!JSON.stringify(v).includes('"high"'));
  // block_details are merged by block ID; supplied text stays text.
  const schema = v.blocks.find(b => b.id === 'svc.schema')!;
  assert.equal(schema.ownerId, 'own.alpha'); assert.equal(schema.checkpoint, 'docs/checkpoint.md'); assert.equal(schema.promptRef, 'prompts/schema.md');
  assert.deepEqual(v.sourceVector[0], {repository: 'example/service', ref: 'main', commit: '0000000000000000000000000000000000000001', purpose: 'Synthetic source cut'});
  // A supplied tokens value or calendar is listed, never read.
  const p = plan(); p.handoff.block_details[0].tokens = {estimate: 1000}; p.handoff.calendar = {workdays: 5};
  assert.ok(parseDeliveryView(raw(p)).ignoredFields.includes('handoff.block_details[].tokens'));
  assert.ok(parseDeliveryView(raw(p)).ignoredFields.includes('handoff.calendar'));
});

test('delivery plan: descriptive fields of any bounded JSON shape are accepted and never read', () => {
  // Producers write a product state as a small record and subagent hints as numbers; neither is interpreted.
  const p = plan(); p.products[0].state = {phase: 'synthetic', blocked: false}; p.handoff.owners[0].subagents_hint = [1, 2];
  const v = parseDeliveryView(raw(p));
  assert.equal(v.blocks.length, 5);
  assert.ok(!JSON.stringify(v).includes('"phase":"synthetic"'));
  assert.ok(!JSON.stringify(v).includes('subagents_hint'));
  // Still bounded: too deep or non-finite is refused whole.
  const deep = plan(); deep.products[0].state = {a: {b: {c: {d: {e: 1}}}}}; refused(raw(deep));
  const wide = plan(); wide.handoff.owners[0].subagents_hint = Array.from({length: 201}, (_, i) => i); refused(raw(wide));
});

test('delivery plan: cyclic or oversized input is refused whole', () => {
  refused('{not json');
  refused(raw({...plan(), schema: 'delivery-view/2'}));
  const cyclic = plan(); cyclic.blocks[0].depends_on = ['svc.api']; refused(raw(cyclic));
  const viaTop = plan(); viaTop.dependencies = [{from: 'svc.schema', to: 'svc.ui'}]; refused(raw(viaTop));
  const duplicate = plan(); duplicate.blocks[1].id = 'svc.schema'; refused(raw(duplicate));
  for (const [min, max] of [[10, 5], [-1, 5], [1, 1e400]]) {const p = plan(); p.blocks[1].estimate.min_minutes = min; p.blocks[1].estimate.max_minutes = max; refused(raw(p));}
  const nan = plan(); nan.blocks[1].estimate.min_minutes = 'NaN'; refused(raw(nan));
  for (const bad of ['2026-02-30T10:00:00Z', '2026-09-30', 'yesterday']) {const p = plan(); p.captured_at = bad; refused(raw(p));}
  const badInterval = plan(); badInterval.blocks[0].interval.end = '2026-09-01T08:00:00+02:00'; refused(raw(badInterval));
  const unknownOwner = plan(); unknownOwner.handoff.block_details[0].owner_id = 'own.nobody'; refused(raw(unknownOwner));
  const unknownSource = plan(); unknownSource.blocks[0].source_ids = ['src.missing']; refused(raw(unknownSource));
  const disagree = plan(); disagree.blocks[0].owner_id = 'own.beta'; refused(raw(disagree));
  const tooMany = plan(); tooMany.blocks = Array.from({length: DELIVERY_VIEW_LIMITS.blocks + 1}, (_, i) => ({...plan().blocks[2], id: 'b' + i})); tooMany.handoff.block_details = []; refused(raw(tooMany));
  const big = plan(); big.scope_note = 'x'.repeat(DELIVERY_VIEW_LIMITS.bytes); refused(raw(big));
  // An unknown dependency target is a named gap, not a refusal.
  const unknownDep = plan(); unknownDep.blocks[1].depends_on = ['svc.schema', 'svc.elsewhere'];
  assert.ok(deliveryEvidence(parseDeliveryView(raw(unknownDep)), 'author').gaps.some(g => g.code === 'UNKNOWN_DEPENDENCY' && g.blockId === 'svc.api'));
});

test('owner conflicts: unordered overlap is a conflict, ordered overlap is sequential', () => {
  const e = deliveryEvidence(parseDeliveryView(RAW), 'author');
  assert.deepEqual(e.conflicts, [
    {repository: 'example/service', path: 'src/api', blockIds: ['svc.schema', 'svc.api'], owners: ['own.alpha', 'own.beta'], ordered: true},
    {repository: 'example/service', path: 'docs', blockIds: ['svc.docs', 'svc.ui'], owners: ['own.alpha', 'own.beta'], ordered: false}
  ]);
  // src/apis is not inside src/api; another repository's src/api is not the same path; a read never conflicts.
  assert.ok(!e.conflicts.some(c => c.blockIds.includes('svc.release')));
  // Owners and titles alone never make a conflict.
  const p = plan(); for (const d of p.handoff.block_details) d.filesets = [];
  assert.deepEqual(deliveryEvidence(parseDeliveryView(raw(p)), 'author').conflicts, []);
  const html = renderToStaticMarkup(createElement(DeliveryEvidencePanel, {view: parseDeliveryView(RAW), audience: 'author', binding}));
  assert.match(html, /Sequential \(dependency order\)/); assert.match(html, /Unordered overlap/);
});

test('named gaps: missing estimate, interval and result are named, tokens and calendar stay unknown', () => {
  const e = deliveryEvidence(parseDeliveryView(RAW), 'author');
  const codes = (id: string | null) => e.gaps.filter(g => g.blockId === id).map(g => g.code);
  assert.deepEqual(codes('svc.docs'), ['NO_ESTIMATE', 'NO_ACCEPTANCE', 'NO_INTERVAL', 'NO_RESULT']);
  assert.deepEqual(codes('svc.release'), ['NO_ACCEPTANCE', 'NO_SOURCE', 'NO_INTERVAL', 'NO_RESULT', 'NO_OWNER']);
  assert.deepEqual(codes('svc.schema'), []);
  assert.deepEqual(codes(null), ['TOKENS_UNKNOWN', 'CALENDAR_UNKNOWN']);
  // Gaps are never repaired: the view still has no estimate or owner.
  assert.equal(e.view!.blocks.find(b => b.id === 'svc.docs')!.estimate, null);
  assert.equal(e.view!.blocks.find(b => b.id === 'svc.release')!.ownerId, null);
});

test('remaining effort: uncalibrated range sum and dependency lower bound, no date', () => {
  const e = deliveryEvidence(parseDeliveryView(RAW), 'author');
  // Unfinished: api 60-120, docs (none), ui 90-180, release 15-30. The done schema block is excluded.
  assert.deepEqual(e.remaining.sumMinutes, [165, 330]);
  // Longest chain: api -> ui (schema is done and adds zero).
  assert.deepEqual(e.remaining.dependencyLowerBoundMinutes, [150, 300]);
  assert.deepEqual(e.remaining.unestimated, ['svc.docs']);
  assert.equal(e.remaining.calendar, 'UNKNOWN');
  assert.equal(e.remaining.notice, 'Uncalibrated allowance, not a measurement, schedule or date; ignores queues, access and shared workers.');
  const html = renderToStaticMarkup(createElement(DeliveryEvidencePanel, {view: parseDeliveryView(RAW), audience: 'author', binding}));
  assert.ok(html.includes(REMAINING_NOTICE));
  assert.ok(!/\b2026-1[0-2]-\d\d\b|\b2027-/.test(html), 'no computed finish date');
  const none = plan(); for (const b of none.blocks) delete b.estimate;
  const n = deliveryEvidence(parseDeliveryView(raw(none)), 'author');
  assert.equal(n.remaining.sumMinutes, null); assert.equal(n.remaining.dependencyLowerBoundMinutes, null);
});

test('intervals and results are only those supplied, DECLARED never shown as OBSERVED', () => {
  const e = deliveryEvidence(parseDeliveryView(RAW), 'author');
  assert.deepEqual(e.intervals, [{blockId: 'svc.schema', interval: {start: '2026-09-01T09:00:00+02:00', end: '2026-09-01T10:30:00+02:00', timezone: 'Europe/Paris', basis: 'DECLARED', sourceIds: ['src.board']}}]);
  assert.deepEqual(e.results.map(r => [r.blockId, r.ref.kind, r.ref.basis]), [['svc.schema', 'commit', 'DECLARED'], ['svc.schema', 'check', 'OBSERVED']]);
  const html = renderToStaticMarkup(createElement(DeliveryEvidencePanel, {view: parseDeliveryView(RAW), audience: 'author', binding}));
  // The supplied instants are shown verbatim (never shifted) and each row keeps its own basis.
  assert.ok(html.includes('2026-09-01T09:00:00+02:00'));
  assert.match(html, /abc1234<\/td><td>[^<]*<\/td><td>DECLARED/);
  assert.equal((html.match(/OBSERVED/g) ?? []).length, 2, 'the observed CI source and the observed check only');
  for (const word of ['Dispatch', 'Launch', 'Approve', 'Edit plan']) assert.ok(!html.includes(word));
  assert.ok(html.includes('identity of bytes, not authenticity or authority'));
});

test('public audience withholds a private plan', () => {
  const view = parseDeliveryView(RAW), e = deliveryEvidence(view, 'public');
  assert.equal(e.withheld, true); assert.equal(e.view, null);
  assert.deepEqual([e.conflicts, e.gaps, e.intervals, e.results], [[], [], [], []]);
  const html = renderToStaticMarkup(createElement(DeliveryEvidencePanel, {view, audience: 'public', binding: {...binding, audience: 'public'}}));
  for (const secret of ['Example Service', 'svc.', 'own.alpha', 'example/service', view.inputSha256]) assert.ok(!html.includes(secret), secret);
  const p = plan(); p.visibility = 'public';
  assert.equal(deliveryEvidence(parseDeliveryView(raw(p)), 'public').withheld, false);
});
