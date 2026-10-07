import test from 'node:test';
import assert from 'node:assert/strict';
import {radialSvg,radialSteps} from '../src/export/design/radial';
import {hubCentre} from '../src/export/design/hub';
import {designContext} from '../src/export/design/context';
import {validateDocument,DESIGN_THEMES,type Project} from '../src/core/model';
import {samples} from '../src/data/samples';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {parseXml,walk,find} from '../src/core/interchange/xml';

const NOW=new Date('2026-10-07T09:00:00Z');
const els=(svg:string)=>[...walk(parseXml(svg))];
const attr=(svg:string,name:string)=>els(svg).filter(e=>e.attrs[name]!==undefined).map(e=>e.attrs[name]);
const texts=(svg:string)=>els(svg).filter(e=>e.name==='text'||e.name==='title'||e.name==='desc').map(e=>e.text).join(' ');
const ctx=(d:Project)=>{const c=designContext(d,d.rootViewId,'radial',{now:NOW});return {c,centre:hubCentre(c.spec.nodes,c.spec.edges,c.focal)!};};

test('radial: well-formed, accessible, offline, script-free, unique ids and deterministic for every theme',()=>{
 for(const d of [contosoForecasting(),...samples])for(const theme of DESIGN_THEMES){
  const svg=radialSvg(d,d.rootViewId,{theme,now:NOW}),root=find(parseXml(svg),'svg')!,label=`${d.id} ${theme}`;
  assert.equal(root.attrs.role,'img',label);assert.equal(root.attrs['data-design-type'],'radial',label);assert.equal(root.attrs['data-theme'],theme,label);
  const ids=attr(svg,'id');assert.equal(new Set(ids).size,ids.length,`${label}: unique ids`);
  for(const ref of root.attrs['aria-labelledby'].split(' '))assert.ok(ids.includes(ref),label);
  assert.doesNotMatch(svg,/<script|on[a-z]+=|javascript:|<foreignObject|<image/i,label);
  assert.deepEqual(svg.match(/https?:\/\/[^"' )]+/g),['http://www.w3.org/2000/svg'],`${label}: no network reference`);
  assert.equal(radialSvg(d,d.rootViewId,{theme,now:NOW}),svg,`${label}: deterministic`);
 }
});

test('radial: private components never appear',()=>{
 const d=contosoForecasting(),{centre}=ctx(d),root=d.views.find(v=>v.id===d.rootViewId)!;
 const neighbour=d.edges.find(e=>root.edgeIds.includes(e.id)&&(e.source===centre.id||e.target===centre.id))!,id=neighbour.source===centre.id?neighbour.target:neighbour.source;
 const secret=d.nodes.find(n=>n.id===id)!;secret.visibility='private';secret.label='Secret console <&>';
 const svg=radialSvg(validateDocument(d),d.rootViewId,{now:NOW});
 assert.ok(!svg.includes('Secret console'));assert.ok(!attr(svg,'data-node-id').includes(id));
});

test('radial: each component sits on the ring of its undirected step count; only consecutive-ring connections are drawn',()=>{
 for(const d of [contosoForecasting(),...samples.slice(0,4)]){
  const {c,centre}=ctx(d),steps=radialSteps(centre.id,c.spec.nodes,c.spec.edges),svg=radialSvg(d,d.rootViewId,{now:NOW});
  const g=els(svg).filter(e=>e.attrs['data-node-id']),centreOf=(id:string)=>{const r=g.find(e=>e.attrs['data-node-id']===id)!.children.find(x=>x.name==='rect')!.attrs;return {x:+r.x+ +r.width/2,y:+r.y+ +r.height/2};};
  const o=centreOf(centre.id);assert.equal(g.find(e=>e.attrs['data-node-id']===centre.id)!.attrs['data-dd-step'],'0',d.id);
  const radius=new Map<number,number[]>();
  for(const e of g){const k=+e.attrs['data-dd-step'],p=centreOf(e.attrs['data-node-id']);assert.equal(steps.get(e.attrs['data-node-id']),k,d.id);assert.ok(k<=3,d.id);
   if(k)radius.set(k,[...(radius.get(k)??[]),Math.hypot(p.x-o.x,p.y-o.y)]);}
  // Rings grow outwards; every member of a ring is on it (within the 4px grid snap).
  const rs=[...radius].sort((a,b)=>a[0]-b[0]).map(([,v])=>v);
  for(const v of rs)assert.ok(Math.max(...v)-Math.min(...v)<=6,`${d.id}: one radius per ring`);
  for(let i=1;i<rs.length;i++)assert.ok(Math.min(...rs[i])>Math.max(...rs[i-1]),`${d.id}: rings grow`);
  const step=new Map(g.map(e=>[e.attrs['data-node-id'],+e.attrs['data-dd-step']]));
  for(const id of attr(svg,'data-edge-id')){const e=c.spec.edges.find(x=>x.id===id)!;assert.equal(Math.abs(step.get(e.from)!-step.get(e.to)!),1,`${d.id} ${id}`);}
 }
});

test('radial: a focal hint picks the centre; unreachable components are counted, not drawn',()=>{
 const d=structuredClone(contosoForecasting()),root=d.views.find(v=>v.id===d.rootViewId)!,pick=root.nodeIds[root.nodeIds.length-1];
 root.design={type:'auto',focal:[pick]};const svg=radialSvg(validateDocument(d),root.id,{now:NOW});
 assert.equal(els(svg).find(e=>e.attrs['data-node-id']===pick)!.attrs['data-dd-step'],'0');
 root.edgeIds=[];const empty=radialSvg(validateDocument(d),root.id,{now:NOW});
 assert.equal(attr(empty,'data-node-id').length,1);assert.equal(attr(empty,'data-edge-id').length,0);
 assert.match(texts(empty),new RegExp(`${root.nodeIds.length-1} component\\(s\\) not connected`));assert.match(texts(empty),/nothing is within reach/);
});
