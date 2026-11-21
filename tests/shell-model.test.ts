import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {clampSize,DEFAULT_SIZES,LIMITS,RIBBON_BUTTONS,diagramFiles,diagramGroups,cannotShow,missingViewBox,formatSize,byteSize,checkNewName,checkGroupTitle,svgTitle,type El} from '../src/shell/shellModel';
import {writeFromTemplate,diagramWriter} from '../src/shell/diagramWriter';
import {keepHref,safeCss} from '../src/shell/sanitize';

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
  for (const device of ['con', 'NUL', 'Aux', 'prn', 'com1', 'LPT9']) assert.match(checkNewName(device, have)!, /refused/, device);
  assert.equal(checkNewName('console', have), null);
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

test('R970: only in-diagram and inline-image hrefs stay; CSS is kept whole or refused whole, never rewritten', () => {
  for (const ok of ['#a', ' #x', 'data:image/png;base64,AA', 'DATA:image/svg+xml,<svg/>']) assert.equal(keepHref(ok), true, ok);
  for (const bad of ['https://x/y.png', '//x/y', 'javascript:alert(1)', 'data:text/html,<b>', 'foo.svg#a', '']) assert.equal(keepHref(bad), false, bad);
  for (const ok of ['.a{fill:url(#grad)} .b{background:url( "data:image/png;base64,AA==" )}', 'fill:red;stroke:#333', 'Kitchen · 12 m²', 'body{background:red}',
    '/* an ordinary comment */ .room{fill:#eef}'])
    assert.equal(safeCss(ok), ok, ok);
  for (const bad of [
    'svg{background:url(https://x/a.png)}',
    '/* url(# */url(https://x/a.png)',                 // comment
    '--x:"url(#";svg{background:url(https://x/a)}',    // string
    'svg{background:url(https://x/a.png',              // unclosed at end of input
    'svg{background:ur\\l(https://x/a)}', '@im\\port "https://x/c.css";', // escapes
    'svg{background:url(data:image/png;base64,%3Cx%3E)}', 'svg{background:url(data:image/png;base64,AA"https://x")}', // body not base64
    '@scope{:scope{outline:5px solid red}}', '@SCOPE (svg){:scope{background:red}}', // reaches the host without :host
    '@im@import x;port "https://x/c.css";',           // reassembly after a removal
    'svg{background:image-seimage(t("https://x/a.png" 1x)}', 'background:image-set("https://x/a.png" 1x)',
    'background:-webkit-image-set("https://x/a.png" 1x)', '@font-face{src:src("https://x/f.woff")}',
    '@import "https://x/c.css";', ':host{position:fixed}', 'svg{background:url(data:image/png,AA)}', 'url(data:text/html;base64,AA)',
  ]) assert.equal(safeCss(bad), null, bad);
});

// Drives the writer plugin's middlewares with fake requests (no server, no port).
function writerHarness() {
  const root = mkdtempSync(join(tmpdir(), 'dc-shell-host-'));
  mkdirSync(join(root, 'diagrams')); mkdirSync(join(root, 'templates'));
  writeFileSync(join(root, 'templates', 'flowchart.svg'), '<svg/>');
  const routes: Record<string, any> = {};
  (diagramWriter(root) as any).configureServer({middlewares: {use: (p: any, h?: any) => { if (typeof p === 'function') routes['*'] = p; else routes[p] = h; }}});
  const post = (name: string, {host = 'localhost:5173', peer = '127.0.0.1', origin, type = 'application/json'}: {host?: string; peer?: string; origin?: string; type?: string} = {}) =>
    new Promise<number>(done => {
      const listeners: Record<string, (c?: string) => void> = {};
      const headers: Record<string, string> = {host, 'content-type': type}; if (origin !== undefined) headers.origin = origin;
      const req = {method: 'POST', headers, socket: {remoteAddress: peer}, on: (e: string, f: any) => { listeners[e] = f; }, destroy() {}};
      const res = {statusCode: 0, setHeader() {}, end() { done(res.statusCode); }};
      routes['/__shell/new'](req, res);
      listeners.data?.(JSON.stringify({name, template: 'flowchart.svg'})); listeners.end?.();
    });
  return {root, routes, post};
}

test('R970: POST /__shell/new answers only a page opened on localhost, never another Host', async () => {
  const {root, post} = writerHarness();
  for (const host of ['evil.example', 'evil.example:5173', '192.168.1.20:5173', 'localhost.evil.example', ''])
    assert.equal(await post('x', {host}), 403, host);
  assert.equal(existsSync(join(root, 'diagrams', 'x.svg')), false);
  for (const [host, name] of [['localhost:5173', 'a'], ['127.0.0.1:5173', 'b'], ['[::1]:5173', 'c']])
    assert.equal(await post(name, {host, origin: `http://${host}`}), 200, host);
  assert.deepEqual(readdirSync(join(root, 'diagrams')).sort(), ['a.svg', 'b.svg', 'c.svg']);
});

test('R970: POST /__shell/new refuses a peer that is not this machine', async () => {
  const {root, post} = writerHarness();
  for (const peer of ['192.168.1.20', '::ffff:10.0.0.2', '', '128.0.0.1']) assert.equal(await post('x', {peer}), 403, peer);
  assert.equal(await post('ok6', {peer: '::1'}), 200);
  assert.equal(await post('ok4', {peer: '::ffff:127.0.0.1'}), 200);
  assert.deepEqual(readdirSync(join(root, 'diagrams')).sort(), ['ok4.svg', 'ok6.svg']);
});

test('R970: POST /__shell/new refuses an Origin that is not http://<Host>, and any type but exact application/json', async () => {
  const {root, post} = writerHarness();
  for (const origin of ['https://evil.example', 'http://localhost:9999', 'null', 'https://localhost:5173']) assert.equal(await post('x', {origin}), 403, origin);
  for (const type of ['application/json-patch', 'application/jsonx', 'text/plain']) assert.equal(await post('x', {type}), 405, type);
  assert.equal(existsSync(join(root, 'diagrams', 'x.svg')), false);
});

test('R970: the dev server answers every SVG as a sandboxed document, whatever the path spelling', () => {
  const {routes} = writerHarness();
  const csp = (url: string) => {
    const set: Record<string, string> = {}; let passed = false;
    routes['*']({url}, {setHeader: (k: string, v: string) => { set[k] = v; }}, () => { passed = true; });
    assert.equal(passed, true, url);
    return set['Content-Security-Policy'];
  };
  for (const url of ['/diagrams/x.svg', '/templates/flowchart.svg', '/%64iagrams/x.svg', '/%74emplates/x.svg', '/@fs/C:/repo/diagrams/x.svg',
    '/./diagrams/x.svg', '/src/../diagrams/x.svg', '/diagrams/x.SVG?t=1', '/diagrams/x%2esvg', '/diagrams/%E0%A4%A.svg'])
    assert.equal(csp(url), 'sandbox', url);
  for (const url of ['/shell.html', '/src/shell/main.tsx', '/diagrams/x.svg.js']) assert.equal(csp(url), undefined, url);
});
