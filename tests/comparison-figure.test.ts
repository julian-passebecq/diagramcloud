import test from 'node:test';
import assert from 'node:assert/strict';
import {designSvg} from '../src/export/design';
import {designBookHtml} from '../src/export/design/book';
import {recommendFigures} from '../src/export/design/recommend';
import {availabilityOf} from '../src/export/design/availability';
import {technicalManualHtml} from '../src/export/manual';
import {metricsBlock,draftOf,type MetricsBlock} from '../src/core/metrics';
import {defects} from './helpers/designGeometry';
import {validateDocument,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {parseXml,walk} from '../src/core/interchange/xml';

const NOW=new Date('2026-10-07T09:00:00Z');
const els=(svg:string)=>[...walk(parseXml(svg))];
const attr=(svg:string,name:string)=>els(svg).filter(e=>e.attrs[name]!==undefined).map(e=>e.attrs[name]);
const texts=(svg:string)=>els(svg).filter(e=>e.name==='text'||e.name==='title'||e.name==='desc').map(e=>e.text).join(' ');
type Measure={metric:string;value:number;unit:string;scope:string;window:{from:string;to:string};basis:'measured'|'estimate'|'derived';role:'baseline'|'current'};
const W1={from:'2026-09-01',to:'2026-09-07'},W2={from:'2026-10-01',to:'2026-10-07'},MONTH={from:'2026-10-01',to:'2026-10-30'};
const m=(role:Measure['role'],value:number,x:Partial<Measure>={}):Measure=>({metric:'p95 latency',value,unit:'ms',scope:'checkout API',window:role==='baseline'?W1:W2,basis:'measured',role,...x});
/** One public view of two components; each list of measures becomes one metrics block on the API component. */
function project(blocks:{measures:Measure[];provenance?:string;visibility?:string}[]):Project{
 return validateDocument({schemaVersion:1,id:'comparison-fixture',title:'Comparison fixture',rootViewId:'root',
  nodes:[{id:'api',label:'Checkout API',kind:'app',blockIds:blocks.map((_,i)=>`m${i}`)},{id:'db',label:'Orders DB',kind:'storage'}],edges:[{id:'q',source:'api',target:'db',kind:'query'}],
  views:[{id:'root',title:'Checkout',nodeIds:['api','db'],edgeIds:['q'],positions:{api:{x:0,y:0},db:{x:300,y:0}}}],sources:[{id:'apm',title:'APM export, September and October'}],
  blocks:blocks.map((b,i)=>({id:`m${i}`,title:`Readings ${i}`,type:'metrics',provenance:b.provenance??'source-derived',sourceIds:['apm'],visibility:b.visibility??'public',items:b.measures.map(x=>({label:`${x.role} ${x.metric}`,value:`${x.value} ${x.unit}`,measure:x}))}))});
}

test('measure contract: windows ordered, one reading per role and scope in a block, a synthetic block never carries a measured value',()=>{
 assert.ok(project([{measures:[m('baseline',420),m('current',380)]}]));
 assert.throws(()=>project([{measures:[m('baseline',420,{window:{from:'2026-09-07',to:'2026-09-01'}})]}]),/window ends \(2026-09-01\) before it starts/);
 assert.throws(()=>project([{measures:[m('baseline',420,{window:{from:'2026-09-01',to:'2026-09-07T00:00:00Z'}})]}]),/mixes a date and a timestamp/);
 assert.throws(()=>project([{measures:[m('baseline',420),m('baseline',430)]}]),/two baseline readings of p95 latency for checkout API/);
 assert.throws(()=>project([{provenance:'synthetic',measures:[m('baseline',420)]}]),/a synthetic block cannot carry a measured value/);
 assert.ok(project([{provenance:'synthetic',measures:[m('baseline',420,{basis:'estimate'}),m('current',380,{basis:'estimate'})]}]));
 const block=project([{measures:[m('baseline',420)]}]).blocks[0] as MetricsBlock,draft=draftOf(block);draft.items[0].note='Edited in the form';
 assert.deepEqual(metricsBlock(draft,{id:block.id}).items[0].measure,block.items[0].measure,'the metrics form keeps the structured reading');
});

test('comparison: a comparable baseline and current draw both values and a derived difference that is not a cause',()=>{
 const d=project([{measures:[m('baseline',420),m('current',380),m('baseline',0,{metric:'errors',unit:'count'}),m('current',3,{metric:'errors',unit:'count'})]}]);
 for(const theme of ['light','dark','editorial'] as const){
  const svg=designSvg(d,'root',{type:'comparison',theme,now:NOW}),t=texts(svg);
  assert.equal(attr(svg,'data-dd-withheld').length,0);assert.deepEqual(attr(svg,'data-dd-comparison'),['p95 latency','errors']);
  assert.deepEqual(attr(svg,'data-dd-difference'),['-40','3']);assert.deepEqual(attr(svg,'data-dd-relative'),[String(-40/420),'unavailable']);
  assert.match(t,/−40 ms/);assert.match(t,/−9\.5% of baseline/);assert.match(t,/relative change unavailable: baseline is zero/);assert.match(t,/A zero baseline has no relative change/);
  assert.match(t,/A difference is not proof of causation/);assert.match(t,/No money, time saving or performance is inferred/);assert.match(t,/SOURCE-DERIVED READINGS/);assert.match(t,/Sources: APM export/);
  assert.match(t,/measured difference · windows of 7 days/);assert.doesNotMatch(t,/sav(ed|ing)s? of|\$|€|faster/i);
  assert.deepEqual(defects(svg,`comparison ${theme}`).failures,[]);}
 const est=designSvg(project([{measures:[m('baseline',420,{basis:'estimate'}),m('current',380)]}]),'root',{type:'comparison',now:NOW});assert.deepEqual(attr(est,'data-dd-basis'),['estimate-based']);
});

test('comparison: missing baseline, incompatible unit, scope or window, and ambiguous readings are unavailable with the reason',()=>{
 const reason=(measures:Measure[][])=>{const d=project(measures.map(x=>({measures:x}))),svg=designSvg(d,'root',{type:'comparison',now:NOW});
  assert.deepEqual(attr(svg,'data-dd-withheld'),['comparison']);assert.equal(attr(svg,'data-dd-comparison').length,0);assert.deepEqual(defects(svg,'withheld comparison').failures,[]);
  assert.match(texts(svg),/without inventing baselines, differences or percentages/);return availabilityOf(d,'root','comparison').missing.map(x=>x.reason).join(' ');};
 assert.match(reason([[m('current',380)]]),/no baseline reading for this scope: a current value alone is not a change/);
 assert.match(reason([[m('baseline',420)]]),/no current reading for this scope/);
 assert.match(reason([[m('baseline',420),m('current',0.38,{unit:'s'})]]),/baseline in ms and current in s: incompatible units, never converted/);
 assert.match(reason([[m('baseline',420),m('current',380,{scope:'search API'})]]),/different scopes are not compared/);
 assert.match(reason([[m('baseline',420),m('current',380,{window:MONTH})]]),/\(7 days\) and current window 2026-10-01 → 2026-10-30 \(30 days\) differ in length/);
 assert.match(reason([[m('baseline',420),m('current',380)],[m('baseline',400)]]),/2 baseline and 1 current readings in Readings 0, Readings 1: ambiguous, none is chosen and nothing is averaged/);
 const none=designSvg(project([]),'root',{type:'comparison',now:NOW});assert.deepEqual(attr(none,'data-dd-missing'),['Baseline and current measures']);assert.match(texts(none),/A graph shape or node count is never a measurement/);
 const partial=designSvg(project([{measures:[m('baseline',420),m('current',380),m('current',9,{metric:'errors',unit:'count'})]}]),'root',{type:'comparison',now:NOW});
 assert.deepEqual(attr(partial,'data-dd-comparison'),['p95 latency']);assert.match(texts(partial),/Not compared · errors \(checkout API\): no baseline reading/);
});

test('comparison: private readings never reach public output; recommend, book and manual agree',()=>{
 const d=project([{measures:[m('baseline',420),m('current',380)]},{visibility:'private',measures:[m('baseline',1,{metric:'secret revenue',unit:'EUR'}),m('current',2,{metric:'secret revenue',unit:'EUR'})]}]);
 const svg=designSvg(d,'root',{type:'comparison',now:NOW});assert.doesNotMatch(svg+JSON.stringify(publicDocument(d)),/secret revenue/);assert.deepEqual(attr(svg,'data-dd-comparison'),['p95 latency']);
 const r=recommendFigures(d,'root').find(x=>x.type==='comparison')!;assert.ok(r.available&&r.score>=80);assert.match(r.reason,/1 metric with a comparable baseline and current reading; the difference is derived, not a cause/);
 const off=recommendFigures(project([]),'root').find(x=>x.type==='comparison')!;assert.ok(!off.available&&off.score<=5);
 assert.ok(designBookHtml(d,{type:'comparison',now:NOW}).includes(svg));
 const manual=technicalManualHtml(d,{now:NOW});assert.match(manual,/baseline p95 latency: 420 ms · checkout API · 2026-09-01 → 2026-09-07 · measured/);assert.doesNotMatch(manual,/secret revenue/);
});
