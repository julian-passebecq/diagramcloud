import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendFigures,recommendedType} from '../src/export/design/recommend';
import {DESIGN_TYPES,validateDocument,type Project} from '../src/core/model';
import {samples} from '../src/data/samples';
import {contosoForecasting} from '../src/data/contosoForecasting';

const TABLE_FIGURES=['chart','line','heatmap'];
const platform=()=>structuredClone(samples.find(d=>d.id==='datapass-platform')!);
const all=()=>[contosoForecasting(),...samples];

test('recommend: every figure type exactly once, deterministic, scores sorted and reasons non-empty',()=>{
 const types=DESIGN_TYPES.filter(t=>t!=='auto');
 for(const d of all())for(const v of d.views){const r=recommendFigures(d,v.id),label=`${d.id} ${v.id}`;
  assert.equal(r.length,types.length,label);assert.deepEqual([...r.map(x=>x.type)].sort(),[...types].sort(),label);
  assert.deepEqual(recommendFigures(d,v.id),r,`${label}: deterministic`);
  for(let i=1;i<r.length;i++)assert.ok(r[i-1].score>=r[i].score,`${label}: sorted`);
  for(const x of r){assert.ok(x.reason.trim().length>0,`${label} ${x.type}`);assert.ok(x.score>=0&&x.score<=100);}
  assert.equal(recommendedType(d,v.id),r[0].type,label);}
});

test('recommend: a numeric-table view ranks a table figure above architecture and names the table owner',()=>{
 const d=platform(),r=recommendFigures(d,'bq-telemetry-table'),pos=(t:string)=>r.findIndex(x=>x.type===t);
 assert.ok(Math.min(...TABLE_FIGURES.map(pos))<pos('architecture'));
 assert.match(r.find(x=>x.type==='chart')!.reason,/numeric table on /);
});

test('recommend: a view without a numeric table never ranks chart, line or heatmap in the top 3',()=>{
 for(const d of all())for(const v of d.views){const r=recommendFigures(d,v.id);if(r.find(x=>x.type==='chart')!.reason!=='no numeric table evidence on this view')continue;
  for(const x of r.slice(0,3))assert.ok(!TABLE_FIGURES.includes(x.type),`${d.id} ${v.id}: ${x.type}`);}
 assert.match(recommendFigures(contosoForecasting(),'overview').find(x=>x.type==='line')!.reason,/no numeric table/);
});

test('recommend: a private component and its table do not influence the result',()=>{
 const d=platform(),before=recommendFigures(d,'bq-telemetry-table');assert.ok(TABLE_FIGURES.includes(before[0].type));
 const owners=d.nodes.filter(n=>d.views.find(v=>v.id==='bq-telemetry-table')!.nodeIds.includes(n.id)&&n.blockIds.includes('bq-telemetry-rows'));
 assert.ok(owners.length);for(const n of owners){n.visibility='private';n.label='Secret owner <&>';}
 const after=recommendFigures(validateDocument(d) as Project,'bq-telemetry-table');
 for(const x of after){assert.ok(!x.reason.includes('Secret owner'));if(TABLE_FIGURES.includes(x.type))assert.ok(x.score<10,`${x.type} drops`);}
 for(const x of after.slice(0,3))assert.ok(!TABLE_FIGURES.includes(x.type));
});

test('recommend: drilldowns, providers and story steps are named as facts',()=>{
 const d=contosoForecasting(),r=recommendFigures(d,'overview'),by=(t:string)=>r.find(x=>x.type===t)!;
 assert.match(by('tree').reason,/child views? below this one/);assert.match(by('deployment').reason,/^\d+ providers, mostly one component each$/);assert.ok(by('deployment').score<by('tree').score);
 assert.match(by('timeline').reason,/public story step/);assert.ok(by('tree').score>by('chart').score);
});
