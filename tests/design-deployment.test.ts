import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentSvg,deploymentZones,routeBetween} from '../src/export/design/deployment';
import {validateDocument,DESIGN_THEMES} from '../src/core/model';
import {viewSpec} from '../src/core/viewspec';
import {samples} from '../src/data/samples';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {parseXml,walk,find} from '../src/core/interchange/xml';

const NOW=new Date('2026-10-07T09:00:00Z');
const els=(svg:string)=>[...walk(parseXml(svg))];
const attr=(svg:string,name:string)=>els(svg).filter(e=>e.attrs[name]!==undefined).map(e=>e.attrs[name]);

test('deployment: well-formed, accessible, offline, script-free and deterministic in every theme',()=>{
 for(const d of [contosoForecasting(),...samples.slice(0,7)])for(const theme of DESIGN_THEMES){
  const svg=deploymentSvg(d,d.rootViewId,{theme,now:NOW}),root=find(parseXml(svg),'svg')!,label=`${d.id} ${theme}`;
  assert.equal(root.attrs.role,'img',label);assert.equal(root.attrs['data-design-type'],'deployment',label);assert.equal(root.attrs['data-theme'],theme,label);
  const [titleId,descId]=root.attrs['aria-labelledby'].split(' '),ids=attr(svg,'id');
  assert.ok(ids.includes(titleId)&&ids.includes(descId),label);assert.equal(new Set(ids).size,ids.length,`${label}: unique ids`);
  assert.doesNotMatch(svg,/<script|on[a-z]+=|javascript:|@import|@font-face|<foreignObject|<image/i,label);
  assert.deepEqual(svg.match(/https?:\/\/[^"' )]+/g),['http://www.w3.org/2000/svg'],`${label}: no network reference`);
  assert.equal(deploymentSvg(d,d.rootViewId,{theme,now:NOW}),svg,`${label}: deterministic`);
 }
});

test('deployment: one zone per declared provider, Generic or empty go to Unassigned, every public component and connection drawn once',()=>{
 for(const d of [contosoForecasting(),...samples.slice(0,7)]){
  const spec=viewSpec(d,d.rootViewId,{now:NOW}),svg=deploymentSvg(d,d.rootViewId,{now:NOW});
  const providers=new Set(spec.nodes.map(n=>n.provider&&n.provider.trim()&&n.provider!=='Generic'?n.provider.trim():'Unassigned'));
  assert.deepEqual(attr(svg,'data-provider').sort(),[...providers].sort(),d.id);
  assert.deepEqual(attr(svg,'data-node-id').sort(),spec.nodes.map(n=>n.id).sort(),d.id);
  assert.deepEqual(attr(svg,'data-edge-id').sort(),spec.edges.filter(e=>e.from!==e.to).map(e=>e.id).sort(),d.id);
 }
 const zones=deploymentZones([{provider:'Generic'},{provider:''},{provider:'Azure'}].map((p,i)=>({id:`n${i}`,label:`N${i}`,kind:'process',summary:'',basis:'planned',designStatus:'planned',evidenceRefs:[],sourceRefs:[],position:{x:i,y:0},...p}) as never));
 assert.deepEqual(zones.map(z=>[z.provider,z.nodes.length]),[['Azure',1],['Unassigned',2]]);
});

test('deployment: connectors are rounded right angles and go round a box in their way',()=>{
 const a={x:0,y:0,w:100,h:60},mid={x:0,y:100,w:100,h:60},b={x:0,y:200,w:100,h:60},r=routeBetween(a,b,[a,mid,b]);
 assert.ok(r.every(p=>p.x>=100||p.x<=0),'detours beside the blocking box');
 for(const d of [contosoForecasting(),samples[6]]){const svg=deploymentSvg(d,d.rootViewId,{now:NOW});
  for(const e of els(svg).filter(e=>e.attrs['data-edge-id'])){const cmds=e.attrs.d.match(/[MLQ][^MLQ]*/g)!;let at={x:0,y:0};
   for(const c of cmds){const n=c.slice(1).trim().split(/\s+/).map(Number);if(c[0]==='L')assert.ok(Math.abs(n[0]-at.x)<0.11||Math.abs(n[1]-at.y)<0.11,`${d.id}: diagonal ${c}`);at={x:n[n.length-2],y:n[n.length-1]};}}}
});

test('deployment is public: a private component, its label and its provider never appear',()=>{
 const d=contosoForecasting(),secret=d.nodes.find(n=>n.id==='bronze')!;secret.visibility='private';secret.label='Secret console <&>';secret.provider='Hidden Host';
 const doc=validateDocument(d);
 for(const theme of DESIGN_THEMES){const svg=deploymentSvg(doc,doc.rootViewId,{theme,now:NOW});
  assert.ok(!svg.includes('Secret console')&&!svg.includes('Hidden Host')&&!svg.includes('"bronze"'),theme);assert.ok(!attr(svg,'data-node-id').includes('bronze'),theme);}
});
