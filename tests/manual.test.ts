import test from 'node:test';
import assert from 'node:assert/strict';
import {samples} from '../src/data/samples';
import {technicalManualHtml} from '../src/export/manual';
import {publicDocument} from '../src/core/operations';
import type {Project} from '../src/core/model';

const NOW=new Date('2026-10-07T08:00:00Z');
const contoso=samples.find(s=>s.id==='contoso-forecasting')!;

test('technical manual: cover carries snapshot, revision vector, generated time, audience, provenance and omissions; one section per public view',()=>{
 const html=technicalManualHtml(contoso,{now:NOW});
 for(const text of ['Technical manual','snap-20261007','61353848b4e7','2026-10-07 08:00 UTC','Audience','Public: built from the public document','Provenance','Read from julian-passebecq/contoso-data-studio','Omissions','Basis of components'])assert.ok(html.includes(text),text);
 for(const v of publicDocument(contoso).views)assert.ok(html.includes(`id="view-${v.id}"`),v.id);
 assert.ok(html.includes('15 read from source · 6 planned'),'each component counted once');
 // Figures are editorial SVGs with per-figure marker IDs; the evidence and sources appendices are present.
 const ids=[...html.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'no duplicate IDs in the page');
 assert.ok(html.includes('id="evidence"')&&html.includes('id="sources"'));assert.match(html,/Derived from a source/);
 assert.ok(html.includes('Reported latency (not observed here)'));
});

test('technical manual: offline, no script, escaped, private items removed, deterministic',()=>{
 const s=samples.find(x=>x.nodes.some(n=>n.childViewId))!;
 const priv:Project={...s,nodes:[...s.nodes.map((n,i)=>i?n:{...n,label:'A <script>alert(1)</script> & "q"'}),{...s.nodes[0],id:'secret-node',label:'SECRET-XYZ',visibility:'private',childViewId:undefined}],
  views:s.views.map(v=>v.id===s.rootViewId?{...v,nodeIds:[...v.nodeIds,'secret-node']}:v)};
 const html=technicalManualHtml(priv,{now:NOW});
 assert.ok(!html.includes('SECRET-XYZ'));assert.match(html,/1 private or unreachable component\(s\) removed/);
 assert.ok(!/<script/i.test(html),'no script element');assert.ok(html.includes('A &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;q&quot;'));
 const urls=[...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map(m=>m[1]);assert.deepEqual(urls,[],'nothing loads from the network');
 assert.match(html,/default-src 'none'/);
 assert.equal(technicalManualHtml(priv,{now:NOW}),html);
 // Synthetic evidence stays labelled.
 const total=technicalManualHtml(samples.find(x=>x.id==='total-project-controls')!,{now:NOW});assert.match(total,/Synthetic example/);
});
