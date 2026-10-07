import test from 'node:test';
import assert from 'node:assert/strict';
import {matrixSvg,matrixCell} from '../src/export/design/matrix';
import {DESIGN_THEMES} from '../src/core/model';
import {viewSpec} from '../src/core/viewspec';
import {samples} from '../src/data/samples';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {parseXml,walk,find} from '../src/core/interchange/xml';

const NOW=new Date('2026-10-07T09:00:00Z');
const els=(svg:string)=>[...walk(parseXml(svg))];
const attr=(svg:string,name:string)=>els(svg).filter(e=>e.attrs[name]!==undefined).map(e=>e.attrs[name]);
const texts=(svg:string)=>els(svg).filter(e=>e.name==='text'||e.name==='title'||e.name==='desc').map(e=>e.text).join(' ');
/** Contoso with confidence tags and one undeclared basis, so every row and the unknown column occur. */
function mixed(){const d=contosoForecasting();d.nodes.forEach((n,i)=>{n.tags=[...n.tags,['confirmed','inferred','possible','other'][i%4]];if(i===2)n.basis='unknown';});return d;}

test('evidence matrix: well-formed, accessible, offline, script-free and deterministic in every theme',()=>{
 for(const d of [contosoForecasting(),mixed(),...samples.slice(0,4)])for(const theme of DESIGN_THEMES){
  const svg=matrixSvg(d,d.rootViewId,{theme,now:NOW}),root=find(parseXml(svg),'svg')!,label=`${d.id} ${theme}`;
  assert.equal(root.attrs.role,'img',label);assert.equal(root.attrs['data-design-type'],'matrix',label);assert.equal(root.attrs['data-theme'],theme,label);
  const [titleId,descId]=root.attrs['aria-labelledby'].split(' '),ids=attr(svg,'id');
  assert.ok(ids.includes(titleId)&&ids.includes(descId),label);assert.equal(new Set(ids).size,ids.length,`${label}: unique ids`);
  assert.doesNotMatch(svg,/<script|on[a-z]+=|javascript:|@import|@font-face|<foreignObject|<image/i,label);
  assert.deepEqual(svg.match(/https?:\/\/[^"' )]+/g),['http://www.w3.org/2000/svg'],`${label}: no network reference`);
  assert.equal(matrixSvg(d,d.rootViewId,{theme,now:NOW}),svg,`${label}: deterministic`);
 }
});

test('evidence matrix places every public component once, in the cell of its basis and confidence',()=>{
 for(const d of [contosoForecasting(),mixed(),...samples.slice(0,6)]){
  const spec=viewSpec(d,d.rootViewId,{now:NOW}),svg=matrixSvg(d,d.rootViewId,{now:NOW});
  assert.deepEqual(attr(svg,'data-node-id').sort(),spec.nodes.map(n=>n.id).sort(),d.id);
  for(const cell of els(svg).filter(e=>e.attrs['data-cell'])){
   const want=spec.nodes.filter(n=>matrixCell(n)===cell.attrs['data-cell']).map(n=>n.id).sort();
   assert.equal(Number(cell.attrs['data-count']),want.length,`${d.id} ${cell.attrs['data-cell']}`);
   assert.deepEqual([...walk(cell)].filter(e=>e.attrs['data-node-id']).map(e=>e.attrs['data-node-id']).sort(),want,`${d.id} ${cell.attrs['data-cell']}`);
  }
  // Columns: only the bases that occur; rows: all four confidences.
  assert.deepEqual(attr(svg,'data-basis').sort(),[...new Set(spec.nodes.map(n=>n.basis))].sort(),d.id);
  assert.deepEqual(attr(svg,'data-row'),['confirmed','inferred','possible','none'],d.id);
 }
});

test('evidence matrix headline counts what was read from source, and invents no score',()=>{
 const d=mixed(),spec=viewSpec(d,d.rootViewId,{now:NOW}),svg=matrixSvg(d,d.rootViewId,{now:NOW}),read=spec.nodes.filter(n=>n.basis==='static-source').length;
 assert.match(texts(svg),new RegExp(`${read} of ${spec.nodes.length} components read from source`));
 assert.doesNotMatch(texts(svg),/score|%/i);
 assert.ok(els(svg).some(e=>e.attrs['data-basis']==='unknown'),'declared-not-read column drawn');
});

test('evidence matrix accents at most two focal chips, from the view hints',()=>{
 const d=contosoForecasting(),root=d.views.find(v=>v.id===d.rootViewId)!,ids=root.nodeIds.slice(0,2);root.design={type:'architecture',focal:ids};
 const svg=matrixSvg(d,d.rootViewId,{now:NOW});
 assert.deepEqual(els(svg).filter(e=>e.attrs['data-focal']==='true').map(e=>e.attrs['data-node-id']).sort(),[...ids].sort());
});

test('evidence matrix is public: a private component never appears',()=>{
 const d=contosoForecasting(),secret=d.nodes.find(n=>n.id==='bronze')!;secret.visibility='private';secret.label='Secret console <&>';
 for(const theme of DESIGN_THEMES){const svg=matrixSvg(d,d.rootViewId,{theme,now:NOW});
  assert.ok(!attr(svg,'data-node-id').includes('bronze'));assert.doesNotMatch(svg,/Secret console|bronze/);parseXml(svg);}
});
