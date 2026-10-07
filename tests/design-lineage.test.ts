import test from 'node:test';
import assert from 'node:assert/strict';
import {lineageSvg,lineageRoles} from '../src/export/design/lineage';
import {hubCentre} from '../src/export/design/hub';
import {flowRanks} from '../src/export/design/flow';
import {designContext} from '../src/export/design/context';
import {validateDocument,DESIGN_THEMES,type Project} from '../src/core/model';
import {samples} from '../src/data/samples';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {parseXml,walk,find} from '../src/core/interchange/xml';

const NOW=new Date('2026-10-07T09:00:00Z');
const els=(svg:string)=>[...walk(parseXml(svg))];
const attr=(svg:string,name:string)=>els(svg).filter(e=>e.attrs[name]!==undefined).map(e=>e.attrs[name]);
const texts=(svg:string)=>els(svg).filter(e=>e.name==='text'||e.name==='title'||e.name==='desc').map(e=>e.text).join(' ');
const ctx=(d:Project)=>designContext(d,d.rootViewId,'lineage',{now:NOW});
const subjectOf=(d:Project)=>{const c=ctx(d);return hubCentre(c.spec.nodes,c.spec.edges,c.focal)!.id;};
const roleOf=(svg:string,id:string)=>els(svg).find(e=>e.attrs['data-dd-lineage']&&e.children.some(k=>k.attrs['data-node-id']===id))?.attrs['data-dd-lineage'];
/** Contoso with a connection from a downstream component back to an upstream one: a cycle through the subject. */
function withCycle():{d:Project;up:string;down:string}{
 const d=structuredClone(contosoForecasting()),c=ctx(d),s=subjectOf(d),roles=lineageRoles(s,c.spec.nodes,c.spec.edges),root=d.views.find(v=>v.id===d.rootViewId)!;
 const up=[...roles].find(([,r])=>r==='upstream')![0],down=[...roles].filter(([,r])=>r==='downstream').map(([id])=>id).pop()!;
 d.edges.push({id:'loop-back',source:down,target:up,label:'feedback',kind:'batch',speed:'slow',visibility:'public'} as Project['edges'][number]);root.edgeIds.push('loop-back');
 return {d:validateDocument(d),up,down};
}

test('lineage: well-formed, accessible, offline, script-free, unique ids and deterministic for every theme',()=>{
 for(const d of [contosoForecasting(),...samples.slice(0,6),withCycle().d])for(const theme of DESIGN_THEMES){
  const svg=lineageSvg(d,d.rootViewId,{theme,now:NOW}),root=find(parseXml(svg),'svg')!,label=`${d.id} ${theme}`;
  assert.equal(root.attrs.role,'img',label);assert.equal(root.attrs['data-design-type'],'lineage',label);assert.equal(root.attrs['data-theme'],theme,label);
  const ids=attr(svg,'id');assert.equal(new Set(ids).size,ids.length,`${label}: unique ids`);
  for(const ref of root.attrs['aria-labelledby'].split(' '))assert.ok(ids.includes(ref),label);
  assert.doesNotMatch(svg,/<script|on[a-z]+=|javascript:|<foreignObject|<image/i,label);
  assert.deepEqual(svg.match(/https?:\/\/[^"' )]+/g),['http://www.w3.org/2000/svg'],`${label}: no network reference`);
  assert.equal(lineageSvg(d,d.rootViewId,{theme,now:NOW}),svg,`${label}: deterministic`);
 }
});

test('lineage: private components never appear',()=>{
 const d=contosoForecasting(),s=subjectOf(d),root=d.views.find(v=>v.id===d.rootViewId)!;
 const other=root.nodeIds.find(id=>id!==s)!,secret=d.nodes.find(n=>n.id===other)!;secret.visibility='private';secret.label='Secret console <&>';
 const svg=lineageSvg(validateDocument(d),d.rootViewId,{now:NOW});
 assert.ok(!svg.includes('Secret console'));assert.ok(!attr(svg,'data-node-id').includes(other));
});

test('lineage: subject in accent, transitive upstream left of it and downstream right, unrelated muted and counted',()=>{
 for(const d of [contosoForecasting(),...samples.slice(0,6)]){
  const c=ctx(d),s=subjectOf(d),roles=lineageRoles(s,c.spec.nodes,c.spec.edges),ranks=flowRanks(c.spec.nodes,c.spec.edges),svg=lineageSvg(d,d.rootViewId,{now:NOW});
  assert.deepEqual(attr(svg,'data-node-id').sort(),c.spec.nodes.map(n=>n.id).sort(),d.id);
  const accented=els(svg).filter(e=>e.attrs['data-node-id']&&e.children.some(r=>r.name==='rect'&&r.attrs.stroke==='#eb6c36')).map(e=>e.attrs['data-node-id']);
  assert.deepEqual(accented,[s],`${d.id}: accent on the subject only`);
  for(const [id,r] of roles){assert.equal(roleOf(svg,id),r,`${d.id} ${id}`);
   if(r==='upstream')assert.ok(ranks.get(id)!<ranks.get(s)!,`${d.id} ${id} left of the subject`);if(r==='downstream')assert.ok(ranks.get(id)!>ranks.get(s)!,`${d.id} ${id} right of the subject`);}
  const unrelated=[...roles.values()].filter(r=>r==='unrelated').length;
  if(unrelated)assert.match(texts(svg),new RegExp(`${unrelated} unrelated component\\(s\\) muted`),d.id);
  for(const g of els(svg).filter(e=>e.attrs['data-dd-lineage']==='unrelated'&&e.name==='g'))assert.equal(g.attrs.opacity,'0.45');
 }
 // The upstream chain is transitive: a two-step path still counts.
 const r=lineageRoles('c',[{id:'a'},{id:'b'},{id:'c'},{id:'d'},{id:'e'}] as never,[{id:'1',from:'a',to:'b'},{id:'2',from:'b',to:'c'},{id:'3',from:'c',to:'d'},{id:'4',from:'e',to:'d'}] as never);
 assert.deepEqual([...r],[['a','upstream'],['b','upstream'],['c','subject'],['d','downstream'],['e','unrelated']]);
});

test('lineage: a focal hint picks the subject; a cycle is broken by the reading order and noted',()=>{
 const d=structuredClone(contosoForecasting()),root=d.views.find(v=>v.id===d.rootViewId)!,pick=root.nodeIds[root.nodeIds.length-1];
 root.design={type:'auto',focal:[pick]};const svg0=lineageSvg(validateDocument(d),root.id,{now:NOW});assert.equal(roleOf(svg0,pick),'subject');assert.match(texts(svg0),/Subject · focal/i);
 const {d:cyc,up,down}=withCycle(),svg=lineageSvg(cyc,cyc.rootViewId,{now:NOW});
 assert.equal(roleOf(svg,up),'both');assert.equal(roleOf(svg,down),'both');
 assert.ok(els(svg).some(e=>e.attrs['data-dd-cycle']==='true'),'the back connection is marked');
 assert.match(texts(svg),/go back in the reading order \(a cycle\)/);assert.match(texts(svg),/both upstream and downstream/);
});
