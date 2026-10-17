import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {designSvg} from '../src/export/design';
import {designBookHtml} from '../src/export/design/book';
import {buildDesignDeck} from '../src/export/design/slides';
import {recommendFigures} from '../src/export/design/recommend';
import {availabilityOf,availabilityText} from '../src/export/design/availability';
import {ganttTicks} from '../src/export/design/gantt';
import {technicalManualHtml} from '../src/export/manual';
import {explanationGaps} from '../src/intelligence/learning/gaps';
import {intervalOf,isError,windowOf} from '../src/core/schedule';
import {defects} from './helpers/designGeometry';
import {validateDocument,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {parseXml,walk} from '../src/core/interchange/xml';

const NOW=new Date('2026-10-07T09:00:00Z');
const els=(svg:string)=>[...walk(parseXml(svg))];
const attr=(svg:string,name:string)=>els(svg).filter(e=>e.attrs[name]!==undefined).map(e=>e.attrs[name]);
const texts=(svg:string)=>els(svg).filter(e=>e.name==='text'||e.name==='title'||e.name==='desc').map(e=>e.text).join(' ');
type Item={id:string;label:string;nodeIds?:string[];start:string;end?:string;duration?:string;basis:'supplied'|'estimate';note?:string};
/** Three components on one public view; a fourth, private one; schedule blocks attached as given. */
function project(schedules:{id:string;timezone?:string;items:Item[];on?:string;provenance?:string;visibility?:string}[]=[],extra:Record<string,unknown>={}):Project{
 const nodes=[{id:'ingest',label:'Ingest',kind:'source'},{id:'etl',label:'Transform',kind:'process'},{id:'store',label:'Warehouse',kind:'storage'},{id:'secret',label:'Secret Merger Project',kind:'process',visibility:'private'}]
  .map(n=>({...n,blockIds:schedules.filter(s=>(s.on??'etl')===n.id).map(s=>s.id)}));
 return validateDocument({schemaVersion:1,id:'schedule-fixture',title:'Schedule fixture',rootViewId:'root',nodes,
  edges:[{id:'a',source:'ingest',target:'etl'},{id:'b',source:'etl',target:'store'},{id:'c',source:'etl',target:'secret'}],
  views:[{id:'root',title:'Pipeline',nodeIds:['ingest','etl','store','secret'],edgeIds:['a','b','c'],positions:{ingest:{x:0,y:0},etl:{x:300,y:0},store:{x:600,y:0},secret:{x:300,y:200}}}],
  blocks:schedules.map(s=>({id:s.id,title:`Plan ${s.id}`,type:'schedule',timezone:s.timezone??'date-only',provenance:s.provenance??'author',visibility:s.visibility??'public',items:s.items.map(i=>({nodeIds:[],...i}))})),...extra});
}
const PLAN:Item[]=[
 {id:'extract',label:'Extract history',nodeIds:['ingest'],start:'2026-10-01',end:'2026-10-03',basis:'supplied'},
 {id:'model',label:'Model the warehouse',nodeIds:['etl','store'],start:'2026-10-04',duration:'P1W',basis:'estimate',note:'Team estimate, not committed.'},
 {id:'merge',label:'Merge the secret project',nodeIds:['secret'],start:'2026-10-05',end:'2026-10-06',basis:'supplied'}];

test('schedule contract: real dates, ordered intervals, agreeing end and duration, one time basis; refused visibly',()=>{
 assert.deepEqual(intervalOf({start:'2026-10-01',end:'2026-10-01'},true),{start:Date.UTC(2026,9,1),end:Date.UTC(2026,9,2)},'a date-only end is the last day');
 assert.deepEqual(intervalOf({start:'2026-10-01',duration:'P2D'},true),{start:Date.UTC(2026,9,1),end:Date.UTC(2026,9,3)});
 assert.deepEqual(intervalOf({start:'2026-10-01T22:00:00+02:00',duration:'PT6H'},false),{start:Date.UTC(2026,9,1,20),end:Date.UTC(2026,9,2,2)});
 const refused=(items:Item[],timezone='date-only')=>assert.throws(()=>project([{id:'p',timezone,items}]));
 const one=(x:Partial<Item>)=>[{id:'x',label:'X',start:'2026-10-02',basis:'supplied' as const,...x}];
 refused(one({end:'2026-10-01'}));refused(one({end:'2026-10-04',duration:'P1D'}));refused(one({}));refused(one({start:'2026-02-30',end:'2026-03-01'}));
 refused(one({end:'2026-10-02T10:00:00Z'}));refused(one({duration:'PT6H'}));refused(one({duration:'P0D'}));refused(one({end:'2026-10-03',nodeIds:['ghost']}));
 refused([...one({end:'2026-10-03'}),...one({end:'2026-10-04'})]);refused(one({start:'2026-10-02T10:00:00',end:'2026-10-02T12:00:00Z'}),'UTC');
 assert.throws(()=>project([{id:'p',items:one({end:'2026-10-01'})}]),/p\/x: ends \(2026-10-01\) before it starts \(2026-10-02\)/);
 assert.throws(()=>project([{id:'p',items:one({end:'2026-10-04',duration:'P1D'})}]),/disagree/);
 assert.throws(()=>project([{id:'p',items:one({end:'2026-10-02T10:00:00Z'})}]),/one schedule uses one time basis/);
 assert.ok(project([{id:'p',items:one({end:'2026-10-03',duration:'P2D'})}]),'an end and a duration that agree are accepted');
 assert.ok(project([{id:'p',timezone:'Europe/Paris',items:one({start:'2026-10-02T09:00:00+02:00',duration:'PT90M'})}]));
 assert.ok(isError(windowOf({from:'2026-10-02',to:'2026-10-01'})));assert.ok(isError(windowOf({from:'2026-10-02',to:'2026-10-03T00:00:00Z'})));
 assert.ok(project([]),'a legacy document without schedules stays valid');
});

test('gantt: supplied dates drawn on a calendar axis, estimates dashed and named, provenance printed, geometry clean',()=>{
 const d=project([{id:'p',items:PLAN.slice(0,2)}]);
 for(const theme of ['light','dark','editorial'] as const){
  const svg=designSvg(d,'root',{type:'gantt',theme,now:NOW}),t=texts(svg);
  assert.equal(attr(svg,'data-dd-withheld').length,0,theme);assert.deepEqual(attr(svg,'data-dd-item'),['extract','model'],theme);
  assert.deepEqual(attr(svg,'data-dd-basis'),['supplied','estimate']);assert.deepEqual(attr(svg,'data-dd-end'),['2026-10-03','2026-10-10'],'a duration gives its last day');
  assert.match(t,/AUTHOR-PROVIDED SCHEDULE/);assert.match(t,/EST · 2026-10-04 → 2026-10-10/);assert.match(t,/declared as estimate \(dashed, EST\): not supplied dates/);
  assert.match(t,/not runs, not observed timing and not a scheduler/);assert.match(t,/presentation order, never elapsed time/);assert.match(t,/an end date is the last day/);
  assert.doesNotMatch(svg,/<script|https?:\/\/(?!www\.w3\.org)/);assert.deepEqual(defects(svg,`gantt ${theme}`).failures,[]);}
 assert.equal(designSvg(d,'root',{type:'gantt',now:NOW}),designSvg(d,'root',{type:'gantt',now:NOW}),'deterministic');
 const ticks=ganttTicks(Date.UTC(2026,0,1),Date.UTC(2026,11,31),690,true);assert.ok(ticks.length>=2&&ticks.every(k=>/^\d{4}-\d{2}$/.test(k.label)),'a year reads in months');
 const hours=ganttTicks(Date.UTC(2026,9,1,8),Date.UTC(2026,9,1,18),690,false);assert.ok(hours.every(k=>/^10-01 \d{2}:00Z$/.test(k.label)));
});

test('gantt: no schedule, a conflicting item ID or mixed time bases withhold the figure with the reason and the fallback',()=>{
 const none=designSvg(project([],{story:[{title:'Step one',narration:'First.',viewId:'root',highlightEdgeIds:[]}]}),'root',{type:'gantt',now:NOW}),t=texts(none);
 assert.deepEqual(attr(none,'data-dd-withheld'),['gantt']);assert.deepEqual(attr(none,'data-dd-missing'),['Schedule items with dates']);assert.equal(attr(none,'data-dd-item').length,0);
 assert.match(t,/A story order is presentation order, not elapsed time/);assert.match(t,/without inventing dates or durations/);assert.match(t,/"type": "schedule"/);
 const clash=project([{id:'p',items:[PLAN[0]]},{id:'q',on:'store',items:[{...PLAN[0],end:'2026-10-04'}]}]),cs=designSvg(clash,'root',{type:'gantt',now:NOW});
 assert.deepEqual(attr(cs,'data-dd-missing'),['Consistent schedule items']);assert.match(texts(cs),/Item extract is 2026-10-01 → 2026-10-03 \(supplied\) in Plan p but 2026-10-01 → 2026-10-04 \(supplied\) in Plan q: conflicting inputs are not merged or averaged/);
 const same=designSvg(project([{id:'p',items:[PLAN[0]]},{id:'q',on:'store',items:[PLAN[0]]}]),'root',{type:'gantt',now:NOW});assert.deepEqual(attr(same,'data-dd-item'),['extract'],'one item ID with one interval is one bar');
 const mixed=designSvg(project([{id:'p',items:[PLAN[0]]},{id:'q',on:'store',timezone:'UTC',items:[{id:'load',label:'Load',start:'2026-10-02T08:00:00Z',duration:'PT4H',basis:'supplied'}]}]),'root',{type:'gantt',now:NOW});
 assert.match(texts(mixed),/one axis needs one time basis, and a date is never converted to a time/);
 for(const svg of [none,cs,mixed])assert.deepEqual(defects(svg,'withheld gantt').failures,[]);
});

test('gantt: public output drops a schedule item about private components only, and a private schedule entirely',()=>{
 const d=project([{id:'p',items:PLAN},{id:'hidden',on:'store',visibility:'private',items:[{id:'audit',label:'Private audit window',start:'2026-11-01',end:'2026-11-02',basis:'supplied'}]}]);
 const pub=publicDocument(d),json=JSON.stringify(pub),svg=designSvg(d,'root',{type:'gantt',now:NOW});
 assert.doesNotMatch(json,/Secret Merger|Merge the secret project|Private audit window/);assert.doesNotMatch(svg,/Secret Merger|Merge the secret project|Private audit window|secret/);
 const kept=pub.blocks.find(b=>b.id==='p');assert.ok(kept?.type==='schedule');assert.deepEqual(kept.items.map(i=>i.id),['extract','model']);assert.deepEqual(kept.items[1].nodeIds,['etl','store']);
 const onlyPrivate=project([{id:'p',items:[PLAN[2]]}]);assert.ok(!publicDocument(onlyPrivate).blocks.some(b=>b.id==='p'),'an emptied schedule is not published');
 assert.deepEqual(attr(designSvg(onlyPrivate,'root',{type:'gantt',now:NOW}),'data-dd-withheld'),['gantt']);
 assert.ok(d.blocks.find(b=>b.id==='p')!.type==='schedule','the authoring document keeps every item');
});

test('gantt: gaps, recommendation, story timeline, figure book, manual and deck agree on the schedule',async()=>{
 const d=project([{id:'p',items:PLAN.slice(0,2)}],{story:[{title:'Step one',narration:'First.',viewId:'root',highlightEdgeIds:[]}]}),empty=project();
 assert.equal(explanationGaps(d,'root',{publicMode:true})!.gaps.find(g=>g.key==='timing')!.state,'supplied');
 assert.equal(explanationGaps(empty,'root',{publicMode:true})!.gaps.find(g=>g.key==='timing')!.withheld,'Scheduled timeline (Gantt)');
 const r=recommendFigures(d,'root').find(x=>x.type==='gantt')!;assert.ok(r.available&&r.score>=80);assert.match(r.reason,/2 schedule items with dates, 1 declared as estimates/);
 const off=recommendFigures(empty,'root').find(x=>x.type==='gantt')!;assert.ok(!off.available&&off.score<=5);assert.match(off.reason,/withheld, fallback: Architecture/);
 assert.match(recommendFigures(d,'root').find(x=>x.type==='timeline')!.reason,/the scheduled timeline is the Gantt figure/);
 const tl=designSvg(d,'root',{type:'timeline',now:NOW});assert.deepEqual(attr(tl,'data-dd-schedule'),['supplied']);assert.match(texts(tl),/Gantt\) available as its own figure: 2 schedule items on this view, 1 declared as an estimate\. This order is not elapsed time/);
 const svg=designSvg(d,'root',{type:'gantt',now:NOW});assert.ok(designBookHtml(d,{type:'gantt',now:NOW}).includes(svg),'the book embeds the same figure');
 const withheld=designSvg(empty,'root',{type:'gantt',now:NOW}),a=availabilityOf(empty,'root','gantt');
 const words=texts(withheld).replace(/\s+/g,' ');assert.equal(availabilityText(a).length,a.missing.length);
 for(const [k,m] of a.missing.entries()){assert.ok(availabilityText(a)[k].startsWith(`${m.input}: ${m.reason}`));assert.ok(words.includes(m.input)&&words.includes(m.reason.slice(0,50)),'the Studio note uses the figure words');}
 const manual=technicalManualHtml(d,{now:NOW});assert.match(manual,/Extract history/);assert.match(manual,/Dated evidence \(date-only\), not a run or observed timing/);
 const seen:string[]=[],{pptx}=await buildDesignDeck(PptxGenJS,empty,{type:'gantt',now:NOW,raster:async s=>{seen.push(s);return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';}});
 assert.ok(seen.includes(withheld));const zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}) as Buffer),xml=(await Promise.all(Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).map(n=>zip.file(n)!.async('string')))).join('\n');
 assert.match(xml,/descr="[^"]*Scheduled timeline \(Gantt\) withheld on the public view root: missing schedule items with dates\. Fallback: Architecture \(relationship diagram\)\./);
});
