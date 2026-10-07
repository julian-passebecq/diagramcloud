import test from 'node:test';
import assert from 'node:assert/strict';
import {hubSvg,hubCentre,hubNeighbours} from '../src/export/design/hub';
import {designContext} from '../src/export/design/context';
import {validateDocument,DESIGN_THEMES,type Project} from '../src/core/model';
import {samples} from '../src/data/samples';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {parseXml,walk,find} from '../src/core/interchange/xml';

const NOW=new Date('2026-10-07T09:00:00Z');
const els=(svg:string)=>[...walk(parseXml(svg))];
const attr=(svg:string,name:string)=>els(svg).filter(e=>e.attrs[name]!==undefined).map(e=>e.attrs[name]);
const texts=(svg:string)=>els(svg).filter(e=>e.name==='text'||e.name==='title'||e.name==='desc').map(e=>e.text).join(' ');
const centreOf=(d:Project)=>{const c=designContext(d,d.rootViewId,'hub',{now:NOW});return hubCentre(c.spec.nodes,c.spec.edges,c.focal)!;};
/** Contoso with every downstream neighbour of the centre also pointing back (a query), so the top row is drawn. */
function withBothWays():{d:Project;centre:string;both:string[]}{
 const d=structuredClone(contosoForecasting()),centre=centreOf(d).id,root=d.views.find(v=>v.id===d.rootViewId)!;
 const down=d.edges.filter(e=>root.edgeIds.includes(e.id)&&e.source===centre).map(e=>e.target);
 down.forEach((n,i)=>{const id=`back-${i}`;d.edges.push({id,source:n,target:centre,label:'reads back',kind:'query',speed:'medium',visibility:'public'} as Project['edges'][number]);root.edgeIds.push(id);});
 return {d:validateDocument(d),centre,both:down};
}

test('hub: well-formed, accessible, offline, script-free, unique ids and deterministic for every theme',()=>{
 for(const d of [contosoForecasting(),...samples.slice(0,5),withBothWays().d])for(const theme of DESIGN_THEMES){
  const svg=hubSvg(d,d.rootViewId,{theme,now:NOW}),root=find(parseXml(svg),'svg')!,label=`${d.id} ${theme}`;
  assert.equal(root.attrs.role,'img',label);assert.equal(root.attrs['data-design-type'],'hub',label);assert.equal(root.attrs['data-theme'],theme,label);
  const ids=attr(svg,'id');assert.equal(new Set(ids).size,ids.length,`${label}: unique ids`);
  for(const ref of root.attrs['aria-labelledby'].split(' '))assert.ok(ids.includes(ref),label);
  assert.doesNotMatch(svg,/<script|on[a-z]+=|javascript:|<foreignObject|<image/i,label);
  assert.deepEqual(svg.match(/https?:\/\/[^"' )]+/g),['http://www.w3.org/2000/svg'],`${label}: no network reference`);
  assert.equal(hubSvg(d,d.rootViewId,{theme,now:NOW}),svg,`${label}: deterministic`);
 }
});

test('hub: private components never appear',()=>{
 const d=contosoForecasting(),centre=centreOf(d).id,root=d.views.find(v=>v.id===d.rootViewId)!;
 const neighbour=d.edges.find(e=>root.edgeIds.includes(e.id)&&e.source===centre)!.target,secret=d.nodes.find(n=>n.id===neighbour)!;
 secret.visibility='private';secret.label='Secret console <&>';
 const svg=hubSvg(validateDocument(d),d.rootViewId,{now:NOW});
 assert.ok(!svg.includes('Secret console'));assert.ok(!attr(svg,'data-node-id').includes(neighbour));
});

test('hub: centre, upstream left, downstream right, both ways on top; only connections touching the centre are drawn',()=>{
 const {d,centre,both}=withBothWays(),svg=hubSvg(d,d.rootViewId,{now:NOW}),c=designContext(d,d.rootViewId,'hub',{now:NOW});
 const roles=hubNeighbours(centre,c.spec.nodes,c.spec.edges),box=(id:string)=>els(svg).find(e=>e.attrs['data-node-id']===id)!.children.find(r=>r.name==='rect'&&r.attrs.stroke)!.attrs;
 assert.ok(both.length>0);for(const id of both)assert.equal(roles.get(id),'both');
 const cb=box(centre);assert.equal(cb.stroke,'#eb6c36','centre carries the accent');
 for(const [id,r] of roles){const b=box(id);
  if(r==='up')assert.ok(+b.x+ +b.width<= +cb.x,`${id} left`);else if(r==='down')assert.ok(+b.x>= +cb.x+ +cb.width,`${id} right`);else assert.ok(+b.y+ +b.height<= +cb.y,`${id} on top`);}
 assert.deepEqual(attr(svg,'data-node-id').sort(),[centre,...roles.keys()].sort());
 assert.deepEqual(attr(svg,'data-edge-id').sort(),c.spec.edges.filter(e=>e.from===centre||e.to===centre).map(e=>e.id).sort());
 const others=c.spec.nodes.length-1-roles.size;assert.match(texts(svg),new RegExp(`${others} other component\\(s\\) not shown`));
 // Query connections use the link colour; accent stays on the centre only.
 const back=els(svg).filter(e=>e.attrs['data-edge-id']?.startsWith('back-'));assert.ok(back.length&&back.every(e=>e.attrs.stroke==='#2e5aa8'));
 assert.equal(els(svg).filter(e=>e.attrs['data-node-id']&&e.children.some(r=>r.name==='rect'&&r.attrs.stroke==='#eb6c36')).length,1);
});

test('hub: a focal hint picks the centre; a view without connections says so',()=>{
 const d=structuredClone(contosoForecasting()),root=d.views.find(v=>v.id===d.rootViewId)!,pick=root.nodeIds[root.nodeIds.length-1];
 root.design={type:'auto',focal:[pick]};const c=designContext(validateDocument(d),root.id,'hub',{now:NOW});assert.equal(hubCentre(c.spec.nodes,c.spec.edges,c.focal)!.id,pick);
 root.edgeIds=[];root.design=undefined;const svg=hubSvg(validateDocument(d),root.id,{now:NOW});
 assert.match(texts(svg),/no connections/);assert.equal(attr(svg,'data-edge-id').length,0);assert.equal(attr(svg,'data-node-id').length,1);
});
