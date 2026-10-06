import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blueprintSvg,editorialSvg} from '../src/export/styled';
import {svgDiagram} from '../src/export/diagram';
import {viewSpec} from '../src/core/viewspec';
import {samples} from '../src/data/samples';
import {parseManifest,documentFromAtlas} from '../src/core/atlas';
import {scanRepository} from '../src/core/scan';
import {parseXml,walk,find} from '../src/core/interchange/xml';
import type {Project} from '../src/core/model';
import {readRepository} from '../scripts/lib/readRepo';

const NOW=new Date('2026-10-07T09:00:00Z'),SHA='e'.repeat(40);
const atlas=()=>{const {manifest}=parseManifest(readFileSync('tests/fixtures/atlas/shop.manifest.json','utf8'));
 return documentFromAtlas(manifest,{shop:{model:scanRepository([...readRepository('tests/fixtures/repo-shop'),{path:'.git/HEAD',text:'ref: refs/heads/main'},{path:'.git/refs/heads/main',text:SHA}],{name:'Shop'})}},{now:NOW}).document;};
const nodeIds=(svg:string)=>[...walk(parseXml(svg))].filter(e=>e.attrs['data-node-id']).map(e=>e.attrs['data-node-id']);

test('one view spec, three renderings: standard, blueprint and editorial draw the same components',()=>{
 for(const s of samples.slice(0,6)){
  const ids=viewSpec(s,s.rootViewId,{now:NOW}).nodes.map(n=>n.id).sort();
  for(const svg of [svgDiagram(s,s.rootViewId,false),blueprintSvg(s,s.rootViewId,NOW),editorialSvg(s,s.rootViewId,NOW)])assert.deepEqual(nodeIds(svg).sort(),ids,s.id);
 }
});

test('blueprint: title block with project, view, perspective, revision vector, date and provenance; legend of what is drawn',()=>{
 const svg=blueprintSvg(atlas(),'shop.containers',NOW),root=find(parseXml(svg),'svg')!;
 assert.equal(root.attrs['data-style'],'blueprint');assert.equal(root.attrs['data-view-id'],'shop.containers');
 const text=[...walk(root)].filter(e=>e.name==='tspan'||e.name==='text').map(e=>e.text).join(' ');
 for(const s of ['PROJECT ID','atlas-shop-platform','VIEW ID','shop.containers','PERSPECTIVE','REVISIONS',`shop @ ${SHA.slice(0,12)}`,'billing @ unknown (not-scanned)','handbook @ 1234567890ab','2026-10-07 09:00 UTC','PROVENANCE','read from source','LEGEND','Dependency','Storage'])assert.ok(text.includes(s),s);
 assert.ok(/D\d|C\d|B\d|A\d/.test(text),'zone references');
 // Typed line patterns: dependency edges are dashed, and every connection is drawn.
 assert.ok(svg.includes('stroke-dasharray="6 5"'));
 assert.equal([...walk(root)].filter(e=>e.attrs['data-edge-id']).length,viewSpec(atlas(),'shop.containers',{now:NOW}).edges.length);
});

test('styled SVG: offline, no script, escaped text, public content only, deterministic',()=>{
 const s=samples[0];
 const tricky:Project={...s,title:'<script>alert(1)</script>',nodes:[...s.nodes.map((n,i)=>i?n:{...n,label:'A & B </text><svg onload=x>'}),{...s.nodes[1],id:'private-x',label:'PRIVATE-LABEL',visibility:'private',childViewId:undefined}],views:s.views.map(v=>v.id===s.rootViewId?{...v,nodeIds:[...v.nodeIds,'private-x']}:v)};
 for(const svg of [blueprintSvg(tricky,s.rootViewId,NOW),editorialSvg(tricky,s.rootViewId,NOW)]){
  const els=[...walk(parseXml(svg))];
  assert.ok(els.every(e=>e.name!=='script'&&e.name!=='foreignObject'&&Object.keys(e.attrs).every(a=>!/^on/i.test(a))),'no executable content');
  assert.ok(els.some(e=>e.text.includes('</text><svg')||e.text.includes('</TEXT><SVG')),'hostile text stays text');
  assert.ok(!svg.includes('PRIVATE-LABEL'));
  assert.equal((svg.match(/https?:\/\//g)??[]).filter(u=>u!=='http://').length,0);
  assert.deepEqual([...svg.matchAll(/https?:\/\/[^"']+/g)].map(m=>m[0]),['http://www.w3.org/2000/svg']);
  assert.doesNotThrow(()=>parseXml(svg));
 }
 assert.match(blueprintSvg(tricky,s.rootViewId,NOW),/1 private or unreachable component\(s\) removed/);
 assert.equal(blueprintSvg(s,s.rootViewId,NOW),blueprintSvg(s,s.rootViewId,NOW));
});
