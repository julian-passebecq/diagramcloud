import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {clampSize,DEFAULT_SIZES,LIMITS,RIBBON_BUTTONS,diagramFiles,diagramGroups,cannotShow,missingViewBox,formatSize,byteSize,checkNewName,checkGroupTitle,svgTitle,type El} from '../src/shell/shellModel';
import {writeFromTemplate} from '../src/shell/diagramWriter';

test('shell pane sizes stay inside their limits', () => {
  for (const pane of ['left', 'right', 'bottom'] as const) {
    assert.equal(clampSize(pane, -1000), LIMITS[pane][0]);
    assert.equal(clampSize(pane, 10000), LIMITS[pane][1]);
    assert.equal(clampSize(pane, DEFAULT_SIZES[pane]), DEFAULT_SIZES[pane]);
  }
});

test('the ribbon has exactly the working buttons', () => {
  assert.deepEqual(RIBBON_BUTTONS.map(b => b.label), ['New from template', 'Rename group', 'Save as', 'Zoom to fit', 'Open raw file']);
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

test('a new diagram name is refused when it exists or holds anything but letters, digits, dash, underscore', () => {
  const have = ['architecture.svg', 'floor-plan.svg'];
  assert.equal(checkNewName('my-flat_2', have), null);
  assert.match(checkNewName('floor-plan', have)!, /already exists/);
  assert.match(checkNewName('Floor-Plan', have)!, /already exists/);
  for (const bad of ['../evil', 'a/b', 'a\\b', 'x.svg', '.hidden', 'two words', 'C:', 'é', 'a'.repeat(65), '%2e%2e'])
    assert.match(checkNewName(bad, have)!, /refused/, bad);
  assert.match(checkNewName('', have)!, /name/);
  assert.equal(checkGroupTitle('Kitchen'), null);
  assert.match(checkGroupTitle('  ')!, /empty/);
  assert.match(checkGroupTitle('x'.repeat(81))!, /80/);
});

test('writeFromTemplate copies into diagrams/ only, never overwrites, refuses path names and unknown templates', () => {
  const root = mkdtempSync(join(tmpdir(), 'dc-shell-'));
  mkdirSync(join(root, 'diagrams')); mkdirSync(join(root, 'templates'));
  writeFileSync(join(root, 'templates', 'flowchart.svg'), '<svg><title>Flowchart</title></svg>');
  writeFileSync(join(root, 'diagrams', 'taken.svg'), 'keep me');
  assert.equal(writeFromTemplate(root, 'mine', 'flowchart.svg'), 'diagrams/mine.svg');
  assert.equal(readFileSync(join(root, 'diagrams', 'mine.svg'), 'utf8'), '<svg><title>Flowchart</title></svg>');
  assert.throws(() => writeFromTemplate(root, 'taken', 'flowchart.svg'), /already exists/);
  assert.equal(readFileSync(join(root, 'diagrams', 'taken.svg'), 'utf8'), 'keep me');
  assert.throws(() => writeFromTemplate(root, '../outside', 'flowchart.svg'), /refused/);
  assert.throws(() => writeFromTemplate(root, 'x', '../diagrams/taken.svg'), /Unknown template/);
  assert.equal(existsSync(join(root, 'outside.svg')), false);
  assert.deepEqual(readdirSync(join(root, 'diagrams')).sort(), ['mine.svg', 'taken.svg']);
});

test('the six templates are original, safe and list their parts in the navigation', () => {
  assert.deepEqual(readdirSync('templates').sort(), ['architecture.svg', 'floor-plan.svg', 'flowchart.svg', 'org-chart.svg', 'sequence.svg', 'timeline.svg']);
  const want: Record<string, string[]> = {
    'architecture.svg': ['Connections', 'User', 'Front end', 'Service', 'Data store'],
    'floor-plan.svg': ['Room 1', 'Room 2', 'Room 3', 'Corridor', 'Doors', 'Scale'],
    'flowchart.svg': ['Arrows', 'Start', 'Step 1', 'Decision?', 'Step 2', 'Alternative', 'End'],
    'org-chart.svg': ['Links', 'Head', 'Team A', 'Team B', 'Member A1', 'Member A2', 'Member B1', 'Member B2'],
    'sequence.svg': ['Client', 'Server', 'Data store', '1. Request', '2. Query', '3. Rows', '4. Response'],
    'timeline.svg': ['Axis', 'Kick-off', 'Design', 'First version', 'Review', 'Launch'],
  };
  for (const name of Object.keys(want)) {
    const text = readFileSync(`templates/${name}`, 'utf8');
    assert.equal(cannotShow({name, text, url: ''}), null, name);
    assert.doesNotMatch(text, /<script|<style|<image|<foreignObject|\son\w+=|href=/i, name);
    assert.match(svgTitle(text, name), /^(Architecture diagram|Floor plan|Flowchart|Org chart|Sequence diagram|Timeline)$/);
    const groups = [...text.matchAll(/<g id="([^"]+)"><title>([^<]+)<\/title>|<g id="([^"]+)"[^>]*>\s*<title>([^<]+)<\/title>/g)].map(m => m[2] ?? m[4]);
    assert.deepEqual(groups, want[name], name);
  }
});

test('an SVG without a viewBox gets one from its width and height so Zoom to fit scales it', () => {
  assert.equal(missingViewBox(null, '300', '200'), '0 0 300 200');
  assert.equal(missingViewBox('', '300px', '200px'), '0 0 300 200');
  assert.equal(missingViewBox('0 0 10 10', '300', '200'), null);
  assert.equal(missingViewBox(null, '50%', '200'), null);
  assert.equal(missingViewBox(null, null, null), null);
});
