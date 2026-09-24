import test from 'node:test';
import assert from 'node:assert/strict';
import {examplePack} from '../src/experience/sample';
import {publicPack,validatePack,type ExperiencePack} from '../src/experience/model';
import {chartSvg,ganttSvg,itemBody,itemSvg,reportScreenHtml,workspaceHtml} from '../src/experience/render';

const item=(p:ExperiencePack,id:string)=>p.items.find(i=>i.id===id)!;
const hostile='<img src=x onerror=alert(1)>"\'&';

test('report item types validate, and bad references are rejected',()=>{
 const p=examplePack();
 const bad=(mutate:(p:ExperiencePack)=>void,re:RegExp)=>{const q=structuredClone(p);mutate(q);assert.throws(()=>validatePack(q),re);};
 bad(q=>{(item(q,'dax-tabs') as {itemIds:string[]}).itemIds.push('ghost');},/unknown tab item ghost/);
 bad(q=>{q.items.push({...structuredClone(item(q,'dax-tabs')),id:'nested-tabs',itemIds:['dax-tabs','dax-result']} as never);},/tabs cannot contain tabs/);
 bad(q=>{(item(q,'plan-gantt') as {tasks:{dependsOn?:string[]}[]}).tasks[0].dependsOn=['nope'];},/invalid dependency nope/);
 bad(q=>{(item(q,'ql-loads') as {statusColumn?:string}).statusColumn='Nope';},/unknown status column/);
 bad(q=>{(item(q,'ql-by-region') as {valueColumns:string[]}).valueColumns.push('Region');},/donut needs exactly one value column/);
 bad(q=>{const c=item(q,'ql-by-asset') as {chartType:string;valueColumns:string[]};c.chartType='scatter';},/scatter needs x and y/);
});

test('every new chart type renders bounded SVG without NaN',()=>{
 const p=examplePack();
 for(const id of ['ql-by-asset','ql-by-region','ql-trend','capex-chart','capex-curve']){
  const i=item(p,id);assert.equal(i.type,'chart');
  for(const cols of [3,6,12]){const s=chartSvg(p,i as never,{cols});assert.match(s,/^<svg /);assert.doesNotMatch(s,/NaN|undefined|Infinity/,`${id}@${cols}`);}
 }
 const scatter=structuredClone(p);scatter.items.push({...structuredClone(item(p,'ql-assets')),id:'xy',columns:['Setting','x','y'],rows:[['A',1,2],['B',3,5],['A',4,1]]} as never,{...structuredClone(item(p,'ql-by-asset')),id:'xy-chart',chartType:'scatter',dataItemId:'xy',labelColumn:'Setting',valueColumns:['x','y']} as never);
 const s=chartSvg(validatePack(scatter),item(scatter,'xy-chart') as never);assert.equal((s.match(/<circle /g)??[]).length,3);assert.doesNotMatch(s,/NaN/);
 const g=ganttSvg(item(p,'plan-gantt') as never);assert.match(g,/marker-end/);assert.match(g,/Mech\. completion/);assert.doesNotMatch(g,/NaN/);
});

test('report renderer escapes every new text field and emits no script',()=>{
 const p=examplePack();
 (item(p,'ql-filters') as {fields:{label:string;value:string}[]}).fields[0]={label:hostile,value:hostile};
 (item(p,'ql-insights') as {entries:{title:string;text:string}[]}).entries[0].title=hostile;
 (item(p,'dax-steps') as {steps:{title:string}[]}).steps[0].title=hostile;
 (item(p,'dax-measure') as {title:string}).title=hostile;
 (item(p,'ql-kpi-prod') as {delta:string;comparison:string}).delta=hostile;(item(p,'ql-kpi-prod') as {comparison:string}).comparison=hostile;
 (item(p,'ql-loads') as {rows:unknown[][]}).rows[0][2]=hostile;
 const w=p.workspaces.find(w=>w.id==='quicklook-screen')!;w.context[0].lines[0]=hostile;
 const html=reportScreenHtml(validatePack(p),w,[hostile])+reportScreenHtml(p,p.workspaces.find(w=>w.id==='daxsql-screen')!);
 assert.doesNotMatch(html,/<img src=x|<script/i);
 assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;&quot;&#39;&amp;/);
 for(const id of ['ql-filters','ql-insights','dax-steps','dax-tabs','plan-gantt'])assert.match(itemSvg(p,item(p,id)),/^<svg /);
});

test('tabs are CSS-only radios with unique names per placement',()=>{
 const p=examplePack(),tabs=item(p,'dax-tabs');
 const a=itemBody(p,tabs,{uid:'panel-a'}),b=itemBody(p,tabs,{uid:'panel-b'});
 assert.equal((a.match(/type="radio"/g)??[]).length,3);
 assert.match(a,/name="panel-a-dax-tabs"/);assert.match(b,/name="panel-b-dax-tabs"/);
 assert.match(a,/TOTALYTD/);assert.match(a,/FROM dbo\.Fact_Energy/);
});

test('public export drops a private tab child and a tab set that would be left with one tab',()=>{
 const p=examplePack();(item(p,'dax-result') as {visibility:string}).visibility='private';
 const pub=publicPack(p);assert.deepEqual((pub.items.find(i=>i.id==='dax-tabs') as {itemIds:string[]}).itemIds,['dax-measure','dax-sql-source']);
 assert(!pub.items.some(i=>i.id==='dax-result'));
 (item(p,'dax-sql-source') as {approval:string}).approval='draft';
 const pub2=publicPack(p);assert(!pub2.items.some(i=>i.id==='dax-tabs'));
 assert.doesNotMatch(workspaceHtml(p,'daxsql-screen'),/FROM dbo\.Fact_Energy|Crude oil<\/td><td class="xp-num">160,900,000/);
});

test('report screens keep synthetic labelling, sources and the no-live-query statement',()=>{
 const p=examplePack();
 for(const id of ['quicklook-screen','daxsql-screen','planning-screen','quality-screen']){
  const html=workspaceHtml(p,id,['TotalEnergies']);
  assert.match(html,/xp-prov-synthetic/,id);assert.match(html,/nothing on this screen is a live query/,id);
  assert.match(html,/Content-Security-Policy/);assert.doesNotMatch(html,/<script/i);
 }
 assert.match(workspaceHtml(p,'quicklook-screen'),/TotalEnergies-first 18-page portfolio p\.6/);
 assert.match(workspaceHtml(p,'planning-screen'),/xp-status xp-bad">Blocked/);
});
