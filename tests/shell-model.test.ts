import test from 'node:test';
import assert from 'node:assert/strict';
import {clampSize,DEFAULT_SIZES,LIMITS,RIBBON_TABS,TREE} from '../src/shell/shellModel';

test('shell pane sizes stay inside their limits', () => {
  for (const pane of ['left', 'right', 'bottom'] as const) {
    assert.equal(clampSize(pane, -1000), LIMITS[pane][0]);
    assert.equal(clampSize(pane, 10000), LIMITS[pane][1]);
    assert.equal(clampSize(pane, DEFAULT_SIZES[pane]), DEFAULT_SIZES[pane]);
  }
});

test('shell placeholders have unique ids and ribbon tabs have buttons', () => {
  const ids: string[] = [];
  const walk = (nodes: typeof TREE) => nodes.forEach(n => { ids.push(n.id); walk(n.children ?? []); });
  walk(TREE);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(RIBBON_TABS.every(t => t.buttons.length > 0));
});
