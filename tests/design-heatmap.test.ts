import test from 'node:test';
import assert from 'node:assert/strict';
import {heatmapSvg,heatmapColumns,normalise} from '../src/export/design/heatmap';
import {DESIGN_THEMES,type EvidenceBlock} from '../src/core/model';
import {samples} from '../src/data/samples';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {parseXml,walk,find} from '../src/core/interchange/xml';

const NOW=new Date('2026-10-07T09:00:00Z');
const els=(svg:string)=>[...walk(parseXml(svg))];
const attr=(svg:string,name:string)=>els(svg).filter(e=>e.attrs[name]!==undefined).map(e=>e.attrs[name]);
const texts=(svg:string)=>els(svg).filter(e=>e.name==='text'||e.name==='title'||e.name==='desc').map(e=>e.text).join(' ');
const sample=(id:string)=>structuredClone(samples.find(s=>s.id===id)!);
const CASES:[()=>ReturnType<typeof contosoForecasting>,string][]=[[contosoForecasting,'overview'],[()=>sample('total-project-controls'),'reporting'],[()=>sample('datapass-platform'),'bq-telemetry-table'],[()=>sample('gcp-streaming-analytics'),'pipeline-detail']];

test('heatmap: well-formed, accessible, offline, script-free and deterministic in every theme',()=>{
 for(const [make,view] of CASES)for(const theme of DESIGN_THEMES){
  const d=make(),svg=heatmapSvg(d,view,{theme,now:NOW}),root=find(parseXml(svg),'svg')!,label=`${d.id} ${view} ${theme}`;
  assert.equal(root.attrs.role,'img',label);assert.equal(root.attrs['data-design-type'],'heatmap',label);assert.equal(root.attrs['data-theme'],theme,label);
  const [titleId,descId]=root.attrs['aria-labelledby'].split(' '),ids=attr(svg,'id');
  assert.ok(ids.includes(titleId)&&ids.includes(descId),label);assert.equal(new Set(ids).size,ids.length,`${label}: unique ids`);
  assert.doesNotMatch(svg,/<script|on[a-z]+=|javascript:|@import|@font-face|<foreignObject|<image/i,label);
  assert.deepEqual(svg.match(/https?:\/\/[^"' )]+/g),['http://www.w3.org/2000/svg'],`${label}: no network reference`);
  assert.equal(heatmapSvg(make(),view,{theme,now:NOW}),svg,`${label}: deterministic`);
 }
});

test('heatmap: one cell per row and numeric column, shaded per column from its minimum (0) to its maximum (1)',()=>{
 const d=sample('total-project-controls'),svg=heatmapSvg(d,'reporting',{now:NOW});
 const block=d.blocks.find(b=>b.title==='Illustrative quarterly phasing') as Extract<EvidenceBlock,{type:'table'}>,cols=heatmapColumns(block);
 const cells=els(svg).filter(e=>e.attrs['data-value']!==undefined);
 assert.equal(cells.length,block.rows.length*cols.length);
 for(const k of cols){const col=cells.filter(e=>e.attrs['data-column']===block.columns[k]),norms=col.map(e=>Number(e.attrs['data-norm']));
  assert.equal(Math.min(...norms),0);assert.equal(Math.max(...norms),1);
  const max=Math.max(...block.rows.map(r=>r[k] as number));assert.equal(Number(col.find(e=>e.attrs['data-norm']==='1')!.attrs['data-value']),max);}
 for(const k of cols)assert.ok(texts(svg).includes(block.columns[k].toUpperCase()),'mono uppercase column header');
 assert.deepEqual(normalise([5,null,5]),[0.5,null,0.5]);assert.deepEqual(normalise([0,5,10]),[0,0.5,1]);
});

test('heatmap: provenance is printed before the cells and synthetic stays labelled; no table is said, not invented',()=>{
 const svg=heatmapSvg(sample('datapass-platform'),'bq-telemetry-table',{now:NOW});
 assert.deepEqual(attr(svg,'data-provenance'),['synthetic']);assert.ok(svg.indexOf('SYNTHETIC DATA')<svg.indexOf('data-value='));
 const none=heatmapSvg(contosoForecasting(),'overview',{now:NOW});
 assert.ok(texts(none).includes('No table evidence with numbers'));assert.equal(attr(none,'data-value').length,0);
});

test('heatmap: private components and their tables never appear',()=>{
 const d=sample('total-project-controls'),view=d.views.find(v=>v.id==='reporting')!;
 const owners=d.nodes.filter(n=>view.nodeIds.includes(n.id)&&n.blockIds.some(id=>d.blocks.find(b=>b.id===id)?.title==='Illustrative quarterly phasing'));
 assert.ok(owners.length);for(const n of owners){n.visibility='private';n.label='Secret owner <&>';}
 const svg=heatmapSvg(d,'reporting',{now:NOW});
 assert.doesNotMatch(svg,/Secret owner/);assert.ok(!texts(svg).includes('Illustrative quarterly phasing'));
});
