import test from 'node:test';
import assert from 'node:assert/strict';
import {designSvg} from '../src/export/design';
import {DESIGN_TYPES,validateDocument,type DesignType,type Project,type ProjectNode} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {parseXml,walk} from '../src/core/interchange/xml';
import {defects} from './helpers/designGeometry';

/**
 * Synthetic stress documents for the geometric quality check: each view reproduces a defect class first seen on a large
 * scanned atlas (crowded isometric planes with duplicate long names, a matrix with no public component, a 60-character
 * table category, a labelled cycle connector leaving the last lineage column). All names and values are made up.
 */
const NOW=new Date('2026-10-07T09:00:00Z');
type N=ProjectNode;type V=Project['views'][number];type E=Project['edges'][number];
const KINDS:N['kind'][]=['app','process','storage','source','function','table','model','report','control'];
const LONG=['Customer order reconciliation service worker','Customer order reconciliation service worker (replica)'];
const CATEGORY='A'.repeat(20)+' synthetic category label of sixty chars';
const node=(id:string,label:string,kind:N['kind'],extra:Partial<N>={}):N=>({id,label,kind,provider:'Generic',icon:'generic',summary:`Synthetic ${kind}`,role:'',status:'idle',blockIds:[],sourceIds:[],tags:[],basis:'planned',visibility:'public',...extra} as N);
const edge=(id:string,source:string,target:string,label='',extra:Partial<E>={}):E=>({id,source,target,label,kind:'batch',speed:'slow',basis:'planned',visibility:'public',...extra} as E);
const view=(id:string,title:string,ns:N[],es:E[],pos:(n:N,i:number)=>{x:number;y:number}):V=>
 ({id,title,description:`Synthetic stress view: ${title}.`,nodeIds:ns.map(n=>n.id),edgeIds:es.map(e=>e.id),positions:Object.fromEntries(ns.map((n,i)=>[n.id,pos(n,i)])),perspective:'system',visibility:'public'} as V);

function stressDocument():Project{
 const d=structuredClone(contosoForecasting()),add=(ns:N[],es:E[],v:V)=>{d.nodes.push(...ns);d.edges.push(...es);d.views.push(v);};
 // 1. Crowd: 36 components of nine kinds, most sharing one of two long names; four to eight components per layer.
 const crowd=Array.from({length:36},(_,i)=>node(`crowd-${i}`,i%5===4?`Unit ${i}`:LONG[i%2],KINDS[i%KINDS.length],i%7===0?{tags:['confirmed']}:{}));
 const crowdE=crowd.slice(1).map((n,i)=>edge(`crowd-e${i}`,crowd[i].id,n.id,i%3?'':'sync'));
 add(crowd,crowdE,view('stress-crowd','Thirty-six components',crowd,crowdE,(_,i)=>({x:(i%6)*180,y:Math.floor(i/6)*120})));
 // 2. Drilldown with a dense child: twelve components with the same long name; one far outlier squeezes the other eleven together on the isometric plane.
 const child=Array.from({length:12},(_,i)=>node(`dense-${i}`,LONG[0],KINDS[i%3]));
 add(child,[],view('stress-dense','Dense child level',child,[],(_,i)=>i===11?{x:2600,y:1400}:{x:(i%4)*220,y:Math.floor(i/4)*140}));
 const parent=[node('dense-root','Opens the dense level','process',{childViewId:'stress-dense'}),node('dense-peer','Peer','storage')],parentE=[edge('dense-pe','dense-root','dense-peer')];
 add(parent,parentE,view('stress-parent','Parent of a dense level',parent,parentE,(_,i)=>({x:i*240,y:0})));
 // 3. No confidence anywhere, and a public view whose components are all private (every matrix row empty).
 const unsure=Array.from({length:9},(_,i)=>node(`unsure-${i}`,`Unrated component ${i}`,KINDS[i]));
 add(unsure,[],view('stress-unsure','No stated confidence',unsure,[],(_,i)=>({x:(i%3)*200,y:Math.floor(i/3)*120})));
 const hidden=[node('hidden-a','Private A','process',{visibility:'private'}),node('hidden-b','Private B','storage',{visibility:'private'})];
 add(hidden,[],view('stress-hidden','Only private components',hidden,[],(_,i)=>({x:i*200,y:0})));
 // 4. A synthetic table whose first category label is 60 characters long.
 d.blocks.push({id:'stress-table',title:'Synthetic long categories',visibility:'public',sourceIds:[],provenance:'synthetic',type:'table',columns:['Category','Value'],rows:[[CATEGORY,3],['Short',5]]} as Project['blocks'][number]);
 const tab=[node('table-owner','Table owner','process',{blockIds:['stress-table']})];
 add(tab,[],view('stress-table','Long category',tab,[],()=>({x:0,y:0})));
 // 5. Lineage: a source fans out to thirteen steps; each step feeds its own output and all feed a sink drawn last in the third column.
 // The sink loops back to the first step with a labelled connection, so that connector's longest run is the vertical one in the gap
 // right of the last column, where its label chip used to leave the canvas.
 const fan=[node('fan-src','Source','source'),...Array.from({length:13},(_,i)=>node(`fan-${i}`,`Step ${i}`,'process')),...Array.from({length:12},(_,i)=>node(`aux-${i}`,`Output ${i}`,'storage')),node('fan-sink','Sink','storage')];
 const fanE=[...Array.from({length:13},(_,i)=>edge(`fan-in${i}`,'fan-src',`fan-${i}`)),...Array.from({length:12},(_,i)=>edge(`fan-aux${i}`,`fan-${i}`,`aux-${i}`)),
  ...Array.from({length:13},(_,i)=>edge(`fan-out${i}`,`fan-${i}`,'fan-sink')),edge('fan-back','fan-sink','fan-0','imports ×2')];
 add(fan,fanE,view('stress-cycle','Labelled cycle from the last column',fan,fanE,n=>n.id==='fan-src'?{x:0,y:0}:n.id==='fan-sink'?{x:600,y:1300}:{x:n.id.startsWith('aux')?600:300,y:+n.id.slice(4)*100}));
 // Publication keeps only the views reachable from the root: one opener per stress view joins the root view.
 const root=d.views.find(v=>v.id===d.rootViewId)!;
 for(const [i,id] of ['stress-crowd','stress-parent','stress-unsure','stress-hidden','stress-table','stress-cycle'].entries()){
  d.nodes.push(node(`open-${id}`,`Open ${id}`,'process',{childViewId:id}));root.nodeIds.push(`open-${id}`);root.positions[`open-${id}`]={x:i*200,y:2000};}
 return validateDocument(d);
}

const STRESS_VIEWS=['stress-crowd','stress-dense','stress-parent','stress-unsure','stress-hidden','stress-table','stress-cycle'];
const textsOf=(svg:string)=>[...walk(parseXml(svg))].filter(e=>e.name==='text').map(e=>e.text);
const titlesOf=(svg:string)=>[...walk(parseXml(svg))].filter(e=>e.name==='title').map(e=>e.text);

test('design stress: the synthetic views survive validation and publication',()=>{
 const pub=publicDocument(stressDocument());
 assert.equal(CATEGORY.length,60);
 for(const id of STRESS_VIEWS)assert.ok(pub.views.some(v=>v.id===id),id);
});

test('design stress: every figure of every stress view has no overlapping text, no text outside the viewBox and is never empty',()=>{
 const d=stressDocument(),failures:string[]=[];
 for(const id of STRESS_VIEWS)for(const type of DESIGN_TYPES.filter(t=>t!=='auto') as DesignType[])for(const theme of ['light','dark'] as const)
  failures.push(...defects(designSvg(d,id,{type,theme,now:NOW}),`${type}/${id}/${theme}`).failures);
 assert.equal(failures.length,0,`${failures.length} geometric defect(s):\n${failures.slice(0,200).join('\n')}`);
});

test('design stress: thinned isometric labels are counted and every name stays in a tooltip',()=>{
 const d=stressDocument();
 for(const id of ['stress-crowd','stress-dense']){const svg=designSvg(d,id,{type:'exploded',now:NOW});
  assert.ok(textsOf(svg).some(s=>/^\d+ of \d+ labelled · \d+ names? in tooltips$/.test(s)),`${id}: count note`);
  const v=d.views.find(v=>v.id===id)!;for(const n of d.nodes.filter(n=>v.nodeIds.includes(n.id)))assert.ok(titlesOf(svg).some(s=>s.startsWith(n.label)),`${id}: ${n.id} in a title`);}
});

test('design stress: the empty matrix keeps every row and count, the clipped category keeps its text in titles, the cycle label stays',()=>{
 const d=stressDocument(),m=textsOf(designSvg(d,'stress-hidden',{type:'matrix',now:NOW}));
 for(const r of ['CONFIRMED','INFERRED','POSSIBLE','NO CONFIDENCE'])assert.ok(m.includes(r),r);
 assert.equal(m.filter(s=>s==='0 components').length,4);
 const line=designSvg(d,'stress-table',{type:'line',now:NOW});
 assert.ok(titlesOf(line).some(s=>s.startsWith(CATEGORY)),'full category in a point title');
 assert.ok(textsOf(line).includes('SYNTHETIC DATA'),'provenance kept');
 assert.ok(textsOf(designSvg(d,'stress-cycle',{type:'lineage',now:NOW})).some(s=>/IMPORTS/.test(s)),'cycle label kept on the canvas');
});
