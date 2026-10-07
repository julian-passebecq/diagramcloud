import test from 'node:test';
import assert from 'node:assert/strict';
import {sankeySvg,sankeyUnit} from '../src/export/design/sankey';
import {DESIGN_THEMES,type Project} from '../src/core/model';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {viewSpec} from '../src/core/viewspec';
import {parseXml,walk,find} from '../src/core/interchange/xml';

const NOW=new Date('2026-10-07T09:00:00Z');
const els=(svg:string)=>[...walk(parseXml(svg))];
const attr=(svg:string,name:string)=>els(svg).filter(e=>e.attrs[name]!==undefined).map(e=>e.attrs[name]);
const texts=(svg:string)=>els(svg).filter(e=>e.name==='text'||e.name==='title'||e.name==='desc').map(e=>e.text).join(' ');
const bands=(svg:string)=>els(svg).filter(e=>e.attrs['data-dd-edge']!==undefined);
// Synthetic, illustrative amounts on the reference sample's overview; one connection is left without a quantity.
const VALUES=[500,400,400,380,380,2000,1200,300];
function fixture(provenance:(i:number)=>'synthetic'|'author'=()=>'synthetic'):Project{
 const d=structuredClone(contosoForecasting()),v=d.views.find(v=>v.id==='overview')!;
 d.edges.filter(e=>v.edgeIds.includes(e.id)).forEach((e,i)=>{if(i<VALUES.length)e.quantity={value:VALUES[i],unit:'rows/day',provenance:provenance(i)};});
 return d;
}

test('sankey: well-formed, accessible, offline, script-free and deterministic in every theme',()=>{
 for(const make of [fixture,contosoForecasting])for(const theme of DESIGN_THEMES){
  const svg=sankeySvg(make(),'overview',{theme,now:NOW}),root=find(parseXml(svg),'svg')!,label=`${theme} ${make.name}`;
  assert.equal(root.attrs.role,'img',label);assert.equal(root.attrs['data-design-type'],'sankey',label);assert.equal(root.attrs['data-theme'],theme,label);
  const [titleId,descId]=root.attrs['aria-labelledby'].split(' '),ids=attr(svg,'id');
  assert.ok(ids.includes(titleId)&&ids.includes(descId),label);assert.equal(new Set(ids).size,ids.length,`${label}: unique ids`);
  assert.doesNotMatch(svg,/<script|on[a-z]+=|javascript:|@import|@font-face|<foreignObject|<image/i,label);
  assert.deepEqual(svg.match(/https?:\/\/[^"' )]+/g),['http://www.w3.org/2000/svg'],`${label}: no network reference`);
  assert.equal(sankeySvg(make(),'overview',{theme,now:NOW}),svg,`${label}: deterministic`);
 }
});

test('sankey: one band per quantity, thickness ordered like the values; components as tall as max(in, out)',()=>{
 const svg=sankeySvg(fixture(),'overview',{now:NOW}),bs=bands(svg);
 assert.equal(bs.length,VALUES.length);
 const pairs=bs.map(b=>[Number(b.attrs['data-dd-value']),Number(b.attrs['data-dd-thickness'])]).sort((a,b)=>a[0]-b[0]);
 for(let i=1;i<pairs.length;i++){if(pairs[i][0]>pairs[i-1][0])assert.ok(pairs[i][1]>pairs[i-1][1],`thicker for ${pairs[i][0]}`);else assert.equal(pairs[i][1],pairs[i-1][1]);}
 const ratio=pairs.map(([v,h])=>h/v);assert.ok(Math.max(...ratio)-Math.min(...ratio)<0.02,'proportional');
 const total=Object.fromEntries(els(svg).filter(e=>e.attrs['data-dd-node']).map(e=>[e.attrs['data-dd-node'],Number(e.attrs['data-dd-total'])]));
 assert.equal(total['forecast-ui'],500);assert.equal(total.bronze,2000);assert.equal(total.gold,1200);
 assert.ok(texts(svg).includes('2000 rows/day'),'value printed on a thick band');
 assert.ok(texts(svg).includes('1 connection(s) without a quantity, not drawn.'));
 assert.equal(sankeyUnit(viewSpec(fixture(),'overview',{now:NOW}).edges),'rows/day');
});

test('sankey: synthetic stays labelled; mixed provenance is said and synthetic bands are outlined',()=>{
 const svg=sankeySvg(fixture(),'overview',{now:NOW});
 assert.deepEqual(attr(svg,'data-provenance'),['synthetic']);assert.ok(svg.indexOf('SYNTHETIC QUANTITIES')<svg.indexOf('data-dd-edge='));
 const mixed=sankeySvg(fixture(i=>i%2?'author':'synthetic'),'overview',{now:NOW});
 assert.deepEqual(attr(mixed,'data-provenance'),['mixed']);assert.ok(texts(mixed).includes('MIXED PROVENANCE'));
 for(const b of bands(mixed))assert.equal(b.attrs['stroke-dasharray']!==undefined,b.attrs['data-dd-provenance']==='synthetic');
 assert.ok(texts(mixed).includes('SYNTHETIC QUANTITY'),'legend');
});

test('sankey: different units are never summed; the minority unit is listed in a note',()=>{
 const d=fixture(),v=d.views.find(v=>v.id==='overview')!,[e0,e1]=d.edges.filter(e=>v.edgeIds.includes(e.id));
 e0.quantity={value:7,unit:'GB',provenance:'synthetic'};e1.quantity={value:9,unit:'GB',provenance:'synthetic'};
 const svg=sankeySvg(d,'overview',{now:NOW});
 assert.ok(bands(svg).every(b=>b.attrs['data-dd-unit']==='rows/day'));assert.equal(bands(svg).length,VALUES.length-2);
 assert.match(texts(svg),/2 connection\(s\) in other units, not drawn and never summed: .*7 GB.*9 GB/);
});

test('sankey: a private connection and its amount never appear',()=>{
 const d=fixture(),e=d.edges.find(e=>e.quantity?.value===2000)!;e.visibility='private';e.quantity!.value=31337;
 const svg=sankeySvg(d,'overview',{now:NOW});
 assert.doesNotMatch(svg,/31337|31\.3k/);assert.equal(bands(svg).some(b=>b.attrs['data-dd-edge']===e.id),false);
});

test('sankey: no quantities is an empty state that says how to add one',()=>{
 const svg=sankeySvg(contosoForecasting(),'overview',{now:NOW});
 assert.equal(bands(svg).length,0);assert.equal(attr(svg,'data-dd-empty').length,1);
 assert.ok(texts(svg).includes('no connection quantities'));assert.match(texts(svg),/"quantity" field/);
});
