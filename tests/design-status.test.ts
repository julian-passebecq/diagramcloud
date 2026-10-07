import test from 'node:test';
import assert from 'node:assert/strict';
import {statusSvg,statusColumns,STATUS_ORDER,NOT_STATED} from '../src/export/design/status';
import {designContext} from '../src/export/design/context';
import {validateDocument,DESIGN_THEMES,type Project} from '../src/core/model';
import {samples} from '../src/data/samples';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {parseXml,walk,find} from '../src/core/interchange/xml';

const NOW=new Date('2026-10-07T09:00:00Z');
const els=(svg:string)=>[...walk(parseXml(svg))];
const attr=(svg:string,name:string)=>els(svg).filter(e=>e.attrs[name]!==undefined).map(e=>e.attrs[name]);
const texts=(svg:string)=>els(svg).filter(e=>e.name==='text'||e.name==='title'||e.name==='desc').map(e=>e.text).join(' ');
/** Contoso with the root view's components spread over three designed statuses, in reverse model order. */
function mixed():Project{
 const d=structuredClone(contosoForecasting()),root=d.views.find(v=>v.id===d.rootViewId)!,pick=['failed','running','idle'] as const;
 root.nodeIds.forEach((id,i)=>{d.nodes.find(n=>n.id===id)!.status=pick[i%3];});return validateDocument(d);
}

test('status: well-formed, accessible, offline, script-free, unique ids and deterministic for every theme',()=>{
 for(const d of [contosoForecasting(),...samples.slice(0,5),mixed()])for(const theme of DESIGN_THEMES){
  const svg=statusSvg(d,d.rootViewId,{theme,now:NOW}),root=find(parseXml(svg),'svg')!,label=`${d.id} ${theme}`;
  assert.equal(root.attrs.role,'img',label);assert.equal(root.attrs['data-design-type'],'status',label);assert.equal(root.attrs['data-theme'],theme,label);
  const ids=attr(svg,'id');assert.equal(new Set(ids).size,ids.length,`${label}: unique ids`);
  for(const ref of root.attrs['aria-labelledby'].split(' '))assert.ok(ids.includes(ref),label);
  assert.doesNotMatch(svg,/<script|on[a-z]+=|javascript:|<foreignObject|<image/i,label);
  assert.deepEqual(svg.match(/https?:\/\/[^"' )]+/g),['http://www.w3.org/2000/svg'],`${label}: no network reference`);
  assert.equal(statusSvg(d,d.rootViewId,{theme,now:NOW}),svg,`${label}: deterministic`);
 }
});

test('status: private components never appear',()=>{
 const d=contosoForecasting(),root=d.views.find(v=>v.id===d.rootViewId)!,secret=d.nodes.find(n=>n.id===root.nodeIds[0])!;
 secret.visibility='private';secret.label='Secret console <&>';
 const svg=statusSvg(validateDocument(d),d.rootViewId,{now:NOW});
 assert.ok(!svg.includes('Secret console'));assert.ok(!attr(svg,'data-node-id').includes(secret.id));
});

test('status: one column per designed status that occurs, in model order, with counts; every public component once',()=>{
 const d=mixed(),svg=statusSvg(d,d.rootViewId,{now:NOW}),c=designContext(d,d.rootViewId,'status',{now:NOW});
 const cols=els(svg).filter(e=>e.attrs['data-dd-status']);
 assert.deepEqual(cols.map(e=>e.attrs['data-dd-status']),['idle','running','failed']);
 assert.deepEqual(cols.map(e=>e.attrs['data-dd-status']),STATUS_ORDER.filter(s=>['idle','running','failed'].includes(s)));
 for(const col of cols){const s=col.attrs['data-dd-status'],members=c.spec.nodes.filter(n=>n.designStatus===s).map(n=>n.id).sort();
  assert.equal(+col.attrs['data-dd-count'],members.length);
  assert.deepEqual([...walk(col)].filter(e=>e.attrs['data-node-id']).map(e=>e.attrs['data-node-id']).sort(),members);}
 assert.deepEqual(attr(svg,'data-node-id').sort(),c.spec.nodes.map(n=>n.id).sort());
 assert.match(texts(svg),/IDLE · \d+/);assert.equal(attr(svg,'data-edge-id').length,0,'connections are counted, not drawn');
});

test('status: the caption says designed status, not an observation or verification; a missing status goes to Not stated',()=>{
 const svg=statusSvg(contosoForecasting(),contosoForecasting().rootViewId,{now:NOW});
 assert.match(texts(svg),/Designed status/);assert.match(texts(svg),/not an observation, a verification/);assert.ok(attr(svg,'data-dd-caption').length>0);
 const c=designContext(contosoForecasting(),contosoForecasting().rootViewId,'status',{now:NOW}),nodes=c.spec.nodes.map((n,i)=>i?n:{...n,designStatus:undefined as never});
 const cols=statusColumns(nodes);assert.equal(cols[cols.length-1].id,NOT_STATED);assert.equal(cols[cols.length-1].label,'Not stated');assert.equal(cols[cols.length-1].nodes.length,1);
});

test('status: focal cards (at most two) carry the accent, others do not',()=>{
 const d=structuredClone(contosoForecasting()),root=d.views.find(v=>v.id===d.rootViewId)!,focal=root.nodeIds.slice(0,2);root.design={type:'auto',focal};
 const svg=statusSvg(validateDocument(d),root.id,{now:NOW});
 const accented=els(svg).filter(e=>e.attrs['data-node-id']&&e.children.some(r=>r.name==='rect'&&r.attrs.stroke==='#eb6c36')).map(e=>e.attrs['data-node-id']);
 assert.deepEqual(accented.sort(),[...focal].sort());
});
