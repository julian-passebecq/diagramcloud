import test from 'node:test';
import assert from 'node:assert/strict';
import {contextSvg,contextRoles} from '../src/export/design/systemContext';
import {designContext} from '../src/export/design/context';
import {validateDocument,DESIGN_THEMES,type Project} from '../src/core/model';
import {samples} from '../src/data/samples';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {parseXml,walk,find} from '../src/core/interchange/xml';

const NOW=new Date('2026-10-07T09:00:00Z');
const els=(svg:string)=>[...walk(parseXml(svg))];
const attr=(svg:string,name:string)=>els(svg).filter(e=>e.attrs[name]!==undefined).map(e=>e.attrs[name]);
const texts=(svg:string)=>els(svg).filter(e=>e.name==='text'||e.name==='title'||e.name==='desc').map(e=>e.text).join(' ');
const specOf=(d:Project)=>designContext(d,d.rootViewId,'context',{now:NOW}).spec;
const rectOf=(svg:string,id:string)=>els(svg).find(e=>e.attrs['data-node-id']===id)!.children.find(r=>r.name==='rect'&&r.attrs.stroke)!.attrs;
const boundary=(svg:string)=>els(svg).find(e=>e.attrs['data-dd-role']==='boundary')!.children.find(r=>r.name==='rect')!.attrs;

test('context: well-formed, accessible, offline, script-free, unique ids and deterministic for every theme',()=>{
 for(const d of [contosoForecasting(),...samples])for(const theme of DESIGN_THEMES){
  const svg=contextSvg(d,d.rootViewId,{theme,now:NOW}),root=find(parseXml(svg),'svg')!,label=`${d.id} ${theme}`;
  assert.equal(root.attrs.role,'img',label);assert.equal(root.attrs['data-design-type'],'context',label);assert.equal(root.attrs['data-theme'],theme,label);
  const ids=attr(svg,'id');assert.equal(new Set(ids).size,ids.length,`${label}: unique ids`);
  for(const ref of root.attrs['aria-labelledby'].split(' '))assert.ok(ids.includes(ref),label);
  assert.doesNotMatch(svg,/<script|on[a-z]+=|javascript:|<foreignObject|<image/i,label);
  assert.deepEqual(svg.match(/https?:\/\/[^"' )]+/g),['http://www.w3.org/2000/svg'],`${label}: no network reference`);
  assert.equal(contextSvg(d,d.rootViewId,{theme,now:NOW}),svg,`${label}: deterministic`);
 }
});

test('context: private components never appear',()=>{
 const d=structuredClone(contosoForecasting()),roles=contextRoles(specOf(d).nodes,specOf(d).edges),id=[...roles].find(([,r])=>r==='entry')![0],secret=d.nodes.find(n=>n.id===id)!;
 secret.visibility='private';secret.label='Secret console <&>';
 const svg=contextSvg(validateDocument(d),d.rootViewId,{now:NOW});
 assert.ok(!svg.includes('Secret console'));assert.ok(!attr(svg,'data-node-id').includes(id));
});

test('context: entry points left of the boundary, sinks right, one summarised connector per outside component',()=>{
 const d=contosoForecasting(),spec=specOf(d),roles=contextRoles(spec.nodes,spec.edges),svg=contextSvg(d,d.rootViewId,{now:NOW}),b=boundary(svg);
 const entries=[...roles].filter(([,r])=>r==='entry').map(([id])=>id),sinks=[...roles].filter(([,r])=>r==='sink').map(([id])=>id);
 assert.ok(entries.length&&sinks.length,'contoso has both entry points and sinks');
 for(const id of entries)assert.ok(+rectOf(svg,id).x+ +rectOf(svg,id).width<= +b.x,`${id} left`);
 for(const id of sinks)assert.ok(+rectOf(svg,id).x>= +b.x+ +b.width,`${id} right`);
 for(const id of entries)for(const e of spec.edges.filter(e=>e.from===id))assert.ok(roles.get(e.to)!=='isolated');
 const from=attr(svg,'data-dd-from'),to=attr(svg,'data-dd-to');
 assert.equal(new Set(from.filter(x=>x!=='boundary')).size,from.filter(x=>x!=='boundary').length,'one connector per entry');
 assert.equal(new Set(to.filter(x=>x!=='boundary')).size,to.filter(x=>x!=='boundary').length,'one connector per sink');
 // Every summarised edge really exists and touches the outside component it is drawn for.
 for(const p of els(svg).filter(e=>e.attrs['data-dd-edges'])){const outside=p.attrs['data-dd-from']==='boundary'?p.attrs['data-dd-to']:p.attrs['data-dd-from'];
  for(const eid of p.attrs['data-dd-edges'].split(' ')){const e=spec.edges.find(x=>x.id===eid)!;assert.ok(e&&(e.from===outside||e.to===outside),eid);}}
});

test('context: a cycle has no clear boundary and is listed; more than 12 inner components collapse into +N',()=>{
 const d=structuredClone(contosoForecasting()),root=d.views.find(v=>v.id===d.rootViewId)!,ns=root.nodeIds;
 root.edgeIds=ns.map((n,i)=>{const id=`ring-${i}`;d.edges.push({id,source:n,target:ns[(i+1)%ns.length],label:'next',kind:'batch',speed:'medium',visibility:'public'} as Project['edges'][number]);return id;});
 const ring=validateDocument(d),svg=contextSvg(ring,root.id,{now:NOW});
 assert.match(texts(svg),/no clear boundary/);assert.equal(attr(svg,'data-dd-edges').length,0);
 const listed=attr(svg,'data-node-id').length;assert.equal(listed+(ns.length>12?1:0),Math.min(ns.length,12));
 if(ns.length>12)assert.match(texts(svg),new RegExp(`\\+${ns.length-11} more`));
});
