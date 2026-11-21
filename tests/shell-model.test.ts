import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {clampSize,DEFAULT_SIZES,LIMITS,RIBBON_BUTTONS,diagramFiles,diagramGroups,cannotShow,missingViewBox,formatSize,byteSize,type El} from '../src/shell/shellModel';

test('shell pane sizes stay inside their limits', () => {
  for (const pane of ['left', 'right', 'bottom'] as const) {
    assert.equal(clampSize(pane, -1000), LIMITS[pane][0]);
    assert.equal(clampSize(pane, 10000), LIMITS[pane][1]);
    assert.equal(clampSize(pane, DEFAULT_SIZES[pane]), DEFAULT_SIZES[pane]);
  }
});

test('the ribbon has exactly the two working buttons', () => {
  assert.deepEqual(RIBBON_BUTTONS.map(b => b.label), ['Zoom to fit', 'Open raw file']);
});

test('diagram files are listed by name, sorted, with their raw URL', () => {
  const files = diagramFiles({'/diagrams/b.svg': '<svg/>', '/diagrams/a.svg': '<svg/>'}, {'/diagrams/a.svg': '/assets/a.svg'});
  assert.deepEqual(files.map(f => [f.name, f.url]), [['a.svg', '/assets/a.svg'], ['b.svg', '/diagrams/b.svg']]);
});

test('a file that cannot be shown gets a plain reason', () => {
  const f = (name: string, text: string) => cannotShow({name, text, url: ''});
  assert.equal(f('a.svg', '<svg viewBox="0 0 1 1"></svg>'), null);
  assert.match(f('notes.txt', 'hello')!, /only \.svg/);
  assert.match(f('empty.svg', '  ')!, /empty/);
  assert.match(f('bad.svg', '<html></html>')!, /no <svg>/);
  assert.equal(formatSize(byteSize('é'.repeat(600))), '1.2 KB');
  assert.equal(formatSize(12), '12 B');
});

// Tiny element tree, the same shape as a DOM element.
const el = (tagName: string, attrs: Record<string, string> = {}, children: El[] = [], text = ''): El =>
  ({tagName, getAttribute: n => attrs[n] ?? null, children, textContent: text});

test('navigation lists top-level named groups and looks through unnamed wrappers', () => {
  const root = el('svg', {}, [
    el('title', {}, [], 'Whole diagram'),
    el('g', {id: 'a'}, [el('title', {}, [], 'Box A'), el('g', {id: 'inner'})]),
    el('g', {}, [el('g', {id: 'b'}), el('rect')]),
    el('g', {}, [el('title', {}, [], 'Only a title')]),
    el('g'),
  ]);
  assert.deepEqual(diagramGroups(root).map(g => [g.id, g.label]), [['a', 'Box A'], ['b', 'b'], ['', 'Only a title']]);
  assert.deepEqual(diagramGroups(el('svg', {}, [el('rect')])), []);
});

test('every sample in diagrams/ can be shown and its groups have unique ids', () => {
  const names = readdirSync('diagrams').filter(n => n.endsWith('.svg'));
  assert.ok(names.length >= 2);
  for (const name of names) {
    const text = readFileSync(`diagrams/${name}`, 'utf8');
    assert.equal(cannotShow({name, text, url: ''}), null, name);
    assert.doesNotMatch(text, /<script|\son\w+=/i, name);
    const ids = [...text.matchAll(/<g id="([^"]+)"/g)].map(m => m[1]);
    assert.ok(ids.length >= 5, name);
    assert.equal(new Set(ids).size, ids.length, name);
  }
});

test('an SVG without a viewBox gets one from its width and height so Zoom to fit scales it', () => {
  assert.equal(missingViewBox(null, '300', '200'), '0 0 300 200');
  assert.equal(missingViewBox('', '300px', '200px'), '0 0 300 200');
  assert.equal(missingViewBox('0 0 10 10', '300', '200'), null);
  assert.equal(missingViewBox(null, '50%', '200'), null);
  assert.equal(missingViewBox(null, null, null), null);
});
