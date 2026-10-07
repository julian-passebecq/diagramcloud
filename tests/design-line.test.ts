import test from 'node:test';
import assert from 'node:assert/strict';
import {lineSvg,spreadLabels} from '../src/export/design/line';
import {DESIGN_THEMES} from '../src/core/model';
import {samples} from '../src/data/samples';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {parseXml,walk,find} from '../src/core/interchange/xml';

const NOW=new Date('2026-10-07T09:00:00Z');
const els=(svg:string)=>[...walk(parseXml(svg))];
const attr=(svg:string,name:string)=>els(svg).filter(e=>e.attrs[name]!==undefined).map(e=>e.attrs[name]);
const texts=(svg:string)=>els(svg).filter(e=>e.name==='text'||e.name==='title'||e.name==='desc').map(e=>e.text).join(' ');
const sample=(id:string)=>structuredClone(samples.find(s=>s.id===id)!);
const CASES:[()=>ReturnType<typeof contosoForecasting>,string][]=[[contosoForecasting,'overview'],[()=>sample('total-project-controls'),'reporting'],[()=>sample('foilo-databricks'),'spark-detail'],[()=>sample('datapass-platform'),'bq-telemetry-table'],[()=>sample('gcp-streaming-analytics'),'pipeline-detail']];

test('line: every theme is well-formed, accessible, offline, script-free, with unique ids and deterministic',()=>{
 for(const [make,view] of CASES)for(const theme of DESIGN_THEMES){
  const d=make(),svg=lineSvg(d,view,{theme,now:NOW}),root=find(parseXml(svg),'svg')!,label=`${d.id} ${view} ${theme}`;
  assert.equal(root.attrs.role,'img',label);assert.equal(root.attrs['data-design-type'],'line',label);assert.equal(root.attrs['data-theme'],theme,label);
  const ids=attr(svg,'id'),[titleId,descId]=root.attrs['aria-labelledby'].split(' ');
  assert.ok(ids.includes(titleId)&&ids.includes(descId),label);assert.equal(new Set(ids).size,ids.length,`${label}: unique ids`);
  assert.doesNotMatch(svg,/<script|on[a-z]+=|javascript:|@import|@font-face|<foreignObject|<image/i,label);
  assert.deepEqual(svg.match(/https?:\/\/[^"' )]+/g),['http://www.w3.org/2000/svg'],`${label}: no network reference`);
  assert.equal(lineSvg(make(),view,{theme,now:NOW}),svg,`${label}: deterministic`);
 }
});

test('line: one point per numeric value, x in row order, one direct end label per series, provenance first',()=>{
 const total=sample('total-project-controls'),block=total.blocks.find(b=>b.id==='cost-table')!;
 assert.equal(block.type,'table');if(block.type!=='table')return;
 const svg=lineSvg(total,'reporting',{now:NOW}),series=attr(svg,'data-series');
 assert.deepEqual(series,['CAPEX EUR m','Cumulative EUR m']);assert.deepEqual(attr(svg,'data-end-label'),series);
 const numeric=block.rows.flatMap(r=>[1,2].map(k=>r[k]).filter(v=>typeof v==='number')).map(String);
 assert.deepEqual(attr(svg,'data-value').sort(),numeric.sort());
 for(const g of els(svg).filter(e=>e.attrs['data-series'])){
  const xs=g.children.filter(c=>c.name==='circle').map(c=>Number(c.attrs.cx));assert.deepEqual(xs,[...xs].sort((a,b)=>a-b),'x follows row order');
  assert.ok(g.children.some(c=>c.name==='polyline'&&c.attrs['stroke-linejoin']==='round'));
 }
 assert.ok(svg.indexOf('data-provenance="synthetic"')<svg.indexOf('data-series='),'provenance tag before the lines');
 assert.ok(texts(svg).includes('SYNTHETIC DATA'));
});

test('line: without a numeric table it says so; end labels never overlap',()=>{
 const none=lineSvg(contosoForecasting(),'overview',{now:NOW});
 assert.ok(texts(none).includes('No table evidence with numbers'));assert.equal(attr(none,'data-value').length,0);
 const ys=spreadLabels([100,101,102,400],90,300);ys.slice().sort((a,b)=>a-b).reduce((a,b)=>{assert.ok(b-a>=12);return b;});assert.ok(Math.max(...ys)<=300);
});

test('line: private components and their evidence never appear',()=>{
 const d=sample('total-project-controls'),owner=d.nodes.find(n=>n.blockIds.includes('cost-table'))!;
 owner.visibility='private';owner.label='Secret ledger <&>';
 const svg=lineSvg(d,'reporting',{now:NOW});
 assert.doesNotMatch(svg,/Secret ledger/);assert.ok(!attr(svg,'data-series').includes('CAPEX EUR m'));
});
