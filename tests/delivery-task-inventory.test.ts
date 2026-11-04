import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadDeliveryTaskInventory, readDeliveryTaskSnapshot, resolveDeliveryTaskInventoryLinks, TASK_INVENTORY_LIMITS, type DeliveryTaskSnapshot} from '../src/development/deliveryTaskLinks';
import {parseDeliveryView} from '../src/development/deliveryEvidence';
const original = readFileSync(new URL('./fixtures/delivery-evidence/linked-tasks.json', import.meta.url), 'utf8');
const inputPlan = () => JSON.parse(readFileSync(new URL('./fixtures/delivery-evidence/linked-plan.json', import.meta.url), 'utf8'));
function other(repo = 'example.worker', revision = 4) {const d = JSON.parse(original); d.scope.repoId = repo; d.revision = revision; d.tasks[0].title = 'Another source with the same local task ID'; return JSON.stringify(d);}
function linkedPlan(snapshots: DeliveryTaskSnapshot[]) {
  const p = inputPlan(), detail = p.handoff.block_details.find((d: any) => d.pm_task_refs?.length);
  detail.pm_task_refs = snapshots.map(s => ({task_id:s.document.tasks[0].id, input_sha256:s.inputSha256, revision:s.document.revision, scope:s.document.scope}));
  return parseDeliveryView(JSON.stringify(p));
}
test('inventory resolves same task IDs in distinct scopes by exact bytes independently of order', () => {
  const a = readDeliveryTaskSnapshot(original), b = readDeliveryTaskSnapshot(other()), plan = linkedPlan([a,b]);
  for (const cuts of [[a,b],[b,a]]) {
    const r = resolveDeliveryTaskInventoryLinks(plan,cuts,'author');
    assert.deepEqual(r.links.map(l=>l.state),['MATCHED','MATCHED']);
    assert.deepEqual(r.links.map(l=>l.task?.title),[a.document.tasks[0].title,b.document.tasks[0].title]);
  }
  assert.equal(resolveDeliveryTaskInventoryLinks(plan,[b],'author').links[0].state,'SNAPSHOT_MISMATCH');
});
test('two revisions of one scope coexist without newest-cut fallback; removal leaves the exact reference unmatched', () => {
  const a=readDeliveryTaskSnapshot(original), b=readDeliveryTaskSnapshot(other(a.document.scope.repoId,5)), plan=linkedPlan([a,b]);
  assert.deepEqual(resolveDeliveryTaskInventoryLinks(plan,[b,a],'author').links.map(l=>l.state),['MATCHED','MATCHED']);
  const r=resolveDeliveryTaskInventoryLinks(plan,[b],'author'); assert.equal(r.links[0].state,'SNAPSHOT_MISMATCH'); assert.equal(r.links[0].task,null);
});
test('append, replace, duplicate and invalid-input operations leave prior inventory immutable', () => {
  const a=loadDeliveryTaskInventory([],original,'replace'), before=JSON.stringify(a), both=loadDeliveryTaskInventory(a,other(),'append');
  assert.equal(both.length,2);assert.equal(JSON.stringify(a),before);
  assert.throws(()=>loadDeliveryTaskInventory(a,original,'append'),/already loaded/);
  assert.throws(()=>loadDeliveryTaskInventory(a,'{broken','replace'));
  assert.equal(JSON.stringify(a),before);assert.equal(loadDeliveryTaskInventory(both,original,'replace').length,1);
});
test('snapshot count is bounded without evicting the oldest source', () => {
  let cuts: DeliveryTaskSnapshot[]=[];
  for(let i=0;i<TASK_INVENTORY_LIMITS.snapshots;i++)cuts=loadDeliveryTaskInventory(cuts,other('repo.'+i),'append');
  const before=JSON.stringify(cuts);assert.throws(()=>loadDeliveryTaskInventory(cuts,other('repo.excess'),'append'),/at most 8/);assert.equal(JSON.stringify(cuts),before);
});
test('aggregate original UTF-8 bytes are bounded before the count limit', () => {
  let cuts: DeliveryTaskSnapshot[]=[]; const d=JSON.parse(original);
  d.tasks=Array.from({length:24},(_,i)=>({...d.tasks[0],id:'task.'+i,description:'é'.repeat(3500)}));
  for(let i=0;i<6;i++) {d.scope.repoId='repo.'+i;const raw=JSON.stringify(d);if(i<6 && cuts.reduce((n,s)=>n+s.inputBytes,0)+Buffer.byteLength(raw)<=TASK_INVENTORY_LIMITS.bytes)cuts=loadDeliveryTaskInventory(cuts,raw,'append');else {assert.throws(()=>loadDeliveryTaskInventory(cuts,raw,'append'),/1 MiB/);assert.ok(cuts.length<8);return;}}
  d.scope.repoId='repo.excess';assert.throws(()=>loadDeliveryTaskInventory(cuts,JSON.stringify(d),'append'),/1 MiB/);assert.ok(cuts.length<8);
});
test('ambiguous supplied inventory refuses task details and public mode withholds all metadata', () => {
  const a=readDeliveryTaskSnapshot(original),plan=linkedPlan([a]);
  const r=resolveDeliveryTaskInventoryLinks(plan,[a,a],'author');assert.equal(r.links[0].state,'AMBIGUOUS_SNAPSHOT');assert.equal(r.links[0].task,null);
  assert.deepEqual(resolveDeliveryTaskInventoryLinks(plan,[a,a],'public'),{withheld:true,links:[],unmappedBlocks:[]});
});
test('resolved task mutations do not alter any retained source', () => {
  const cuts=[readDeliveryTaskSnapshot(original),readDeliveryTaskSnapshot(other())],before=JSON.stringify(cuts);
  const r=resolveDeliveryTaskInventoryLinks(linkedPlan(cuts),cuts,'author');r.links[1].task!.title='edited';assert.equal(JSON.stringify(cuts),before);
});
