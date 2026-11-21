import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,mkdirSync,writeFileSync,existsSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {clampSize,DEFAULT_SIZES,LIMITS,RIBBON_BUTTONS,diagramFiles,diagramGroups,cannotShow,missingViewBox,formatSize,byteSize,checkNewName,checkGroupTitle,svgTitle,compareGroups,comparisonText,deckOrder,deckStep,deckKey,deckStatus,deckOutline,rootTitle,type El} from '../src/shell/shellModel';
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
  assert.deepEqual(RIBBON_BUTTONS.map(b => b.label), ['New from template', 'Rename group', 'Save as', 'Zoom to fit', 'Open raw file', 'Compare A vs B', 'Copy comparison', 'Present']);
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

test('R970: the dev server sandboxes every file it serves from diagrams/ or templates/, however it is asked for', () => {
  const {root, routes} = writerHarness();
  for (const f of ['p.svg', 'p.svgz', 'p.html', 'p.htm', 'p.xhtml', 'p.xml', 'p.xht', 'noext', 'wrong.txt', 'x.svg.js'])
    writeFileSync(join(root, 'diagrams', f), '<svg xmlns="http://www.w3.org/2000/svg"><script>document.title="ran"</script></svg>');
  mkdirSync(join(root, 'src')); writeFileSync(join(root, 'src', 'main.ts'), ''); writeFileSync(join(root, 'shell.html'), '');
  mkdirSync(join(root, 'diagrams-other')); writeFileSync(join(root, 'diagrams-other', 'p.svg'), '<svg/>');
  let linked = false; // a symlink outside diagrams/ that points into it is judged by its target
  try { symlinkSync(join(root, 'diagrams', 'p.html'), join(root, 'outside-link.html')); linked = true; } catch { /* no symlink right on this machine */ }
  const headers = (url: string) => {
    const set: Record<string, string> = {}; let passed = false;
    routes['*']({url}, {setHeader: (k: string, v: string) => { set[k] = v; }}, () => { passed = true; });
    assert.equal(passed, true, url);
    return set;
  };
  const fs = '/@fs/' + root.replaceAll('\\', '/').replace(/^\//, '');
  const served = ['/diagrams/p.svg', '/diagrams/P.SVG', '/templates/flowchart.svg', '/%64iagrams/p.svg', '/%74emplates/flowchart.svg',
    '/diagrams/p%2Esvg', '/diagrams/p%2esvg?import', '/diagrams/p.svg?raw', '/diagrams/p.svg#x', fs + '/diagrams/p.svg', fs + '/DIAGRAMS/p.svg',
    '/./diagrams/p.svg', '/src/../diagrams/p.svg', '/src/%2e%2e/diagrams/p.svg', '/diagrams\\p.svg', '/diagrams//p.svg', '/diagrams/%E0%A4%A.svg',
    '/diagrams/p.svgz', '/diagrams/p.html', '/diagrams/p.htm', '/diagrams/p.xhtml', '/diagrams/p.xml', '/diagrams/p.xht', '/diagrams/noext',
    '/diagrams/wrong.txt', '/diagrams/x.svg.js', '/diagrams/', '/diagrams', ...(linked ? ['/outside-link.html'] : [])];
  if (process.platform === 'linux') served.splice(served.indexOf('/diagrams/P.SVG'), 1), served.splice(served.indexOf(fs + '/DIAGRAMS/p.svg'), 1);
  for (const url of served) {
    const set = headers(url);
    assert.equal(set['Content-Security-Policy'], 'sandbox', url);
    assert.equal(set['X-Content-Type-Options'], 'nosniff', url);
  }
  for (const url of ['/shell.html', '/src/main.ts', '/diagrams-other/p.svg', '/diagramsx.svg', '/', '/@fs/' + tmpdir().replaceAll('\\', '/').replace(/^\//, '') + '/elsewhere.svg'])
    assert.equal(headers(url)['Content-Security-Policy'], undefined, url);
});

test('R993: compareGroups marks the union of named groups A only, B only or both, matched by id', () => {
  const g = (id: string, label = id) => ({id, label});
  const rows = compareGroups([g('hall', 'Hall'), g('kitchen', 'Kitchen'), g('', 'Doors')], [g('kitchen', 'Kitchen (new)'), g('study', 'Study'), g('', 'Doors')]);
  assert.deepEqual(rows.map(r => [r.label, r.side, r.a, r.b]), [['Hall', 'A only', 0, null], ['Kitchen', 'both', 1, 0], ['Doors', 'both', 2, 2], ['Study', 'B only', null, 1]]);
  // a title-only group never matches an id that happens to spell the same word
  assert.deepEqual(compareGroups([g('', 'x')], [g('x')]).map(r => r.side), ['A only', 'B only']);
  // a name used twice pairs occurrence by occurrence, never twice with one group
  assert.deepEqual(compareGroups([g('r'), g('r')], [g('r')]).map(r => [r.side, r.a, r.b]), [['both', 0, 0], ['A only', 1, null]]);
  assert.deepEqual(compareGroups([], []), []);
  assert.deepEqual(compareGroups([], [g('b')]).map(r => r.side), ['B only']);
});

test('R993: the comparison text lists only A, only B, both and the two sizes', () => {
  const rows = compareGroups([{id: 'hall', label: 'Hall'}, {id: 'bed', label: 'Bedroom'}], [{id: 'bed', label: 'Bedroom'}, {id: 'study', label: 'Study'}]);
  assert.deepEqual(comparisonText(rows, {name: 'diagrams/a.svg', bytes: 1536}, {name: 'diagrams/b.svg', bytes: 900}), [
    'Compare A = diagrams/a.svg (1.5 KB) with B = diagrams/b.svg (900 B).', 'Only in A (1): Hall.', 'Only in B (1): Study.', 'In both (1): Bedroom.']);
  assert.match(comparisonText([], {name: 'a', bytes: 0}, {name: 'b', bytes: 0})[1], /\(0\): none\./);
});

test('R993: floor-plan-b.svg is the same flat with one room more (Study) and one fewer (Hall), safe like the templates', () => {
  const ids = (n: string) => [...readFileSync(`diagrams/${n}`, 'utf8').matchAll(/<g id="([^"]+)"/g)].map(m => m[1]);
  const a = ids('floor-plan.svg'), b = ids('floor-plan-b.svg');
  assert.deepEqual(a.filter(x => !b.includes(x)), ['hall']);
  assert.deepEqual(b.filter(x => !a.includes(x)), ['study']);
  const text = readFileSync('diagrams/floor-plan-b.svg', 'utf8');
  assert.doesNotMatch(text, /<style|href|<image|<script|<foreignObject|\son\w+=/i);
});

test('R998 (PR 174 review a): compareGroups gives every row its own key, also when an id spells the suffix of another key', () => {
  const g = (id: string) => ({id, label: id});
  const rows = compareGroups([g('r'), g('r'), g('r~1')], [g('r~1')]);
  const keys = rows.map(r => r.key);
  assert.equal(new Set(keys).size, keys.length, keys.join(' | '));
  assert.deepEqual(rows.map(r => [r.label, r.side, r.a, r.b]), [['r', 'A only', 0, null], ['r', 'A only', 1, null], ['r~1', 'both', 2, 0]]);
});

test('R998: deckOrder keeps tree order, picked files only, or every file when none is picked', () => {
  const tree = ['architecture.svg', 'floor-plan-b.svg', 'floor-plan.svg'];
  assert.deepEqual(deckOrder(tree, []), tree);
  assert.deepEqual(deckOrder(tree, ['floor-plan.svg', 'architecture.svg']), ['architecture.svg', 'floor-plan.svg']);
  assert.deepEqual(deckOrder(tree, ['gone.svg']), []); // a pick no longer in the tree is not a slide
  assert.deepEqual(deckOrder([], []), []);
});

test('R998: deckStep stays inside the deck and deckKey maps the Present keys', () => {
  assert.equal(deckStep(0, 3, 1), 1);
  assert.equal(deckStep(2, 3, 1), 2); // no wrap after the last slide
  assert.equal(deckStep(0, 3, -1), 0); // no wrap before the first
  assert.equal(deckStep(1, 3, -1), 0);
  assert.equal(deckStep(0, 0, 1), -1);
  assert.equal(deckStep(9, 3, 0), 2);
  assert.deepEqual(['ArrowRight', ' ', 'ArrowLeft', 'Escape', 'Enter', 'a'].map(deckKey), ['next', 'next', 'prev', 'exit', null, null]);
  assert.equal(deckStatus(0, 3, 'floor-plan.svg'), 'slide 1 of 3: floor-plan.svg');
});

test('R998: rootTitle reads the own title of the SVG, never a group title; the outline is one plain line per slide', () => {
  assert.equal(rootTitle('<svg xmlns="x" viewBox="0 0 1 1">\n  <title> Plan  A </title><g><title>Room</title></g></svg>'), 'Plan A');
  assert.equal(rootTitle('<?xml version="1.0"?>\n<!-- c --><svg><!-- c --><title>T</title></svg>'), 'T');
  assert.equal(rootTitle('<svg><g><title>Room</title></g></svg>'), '');
  assert.equal(rootTitle('<svg><rect/><title>Late</title></svg>'), '');
  assert.equal(rootTitle('not svg'), '');
  assert.equal(deckOutline([{name: 'a.svg', title: 'Plan A'}, {name: 'b.svg', title: ''}]), '1. a.svg, Plan A\n2. b.svg');
  assert.equal(deckOutline([]), '');
  // PR 178 review: consecutive comments never backtrack exponentially (the old pattern froze the tab at about 30).
  const many = '<!-- c -->'.repeat(40);
  for (const text of [`<svg>${many}<title>T</title></svg>`, `<svg>${many}<rect/></svg>`, `${many}<svg>${many}`, `<svg>${many}<!-- open`, `<?xml ${'?'.repeat(40)}`]) {
    const t0 = performance.now();
    rootTitle(text);
    assert.ok(performance.now() - t0 < 50, `${text.slice(0, 30)}... took ${performance.now() - t0} ms`);
  }
  assert.equal(rootTitle(`<svg>${many}<title>T</title></svg>`), 'T');
  assert.equal(rootTitle('<svg><!-- a - b -- c --><title>T</title></svg>'), 'T');
  assert.deepEqual(['architecture.svg', 'floor-plan-b.svg', 'floor-plan.svg'].map(n => rootTitle(readFileSync(`diagrams/${n}`, 'utf8'))),
    ['Sample architecture: six services', 'Sample floor plan B: small flat with a study', 'Sample floor plan: small flat']);
});
