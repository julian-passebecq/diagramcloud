import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {designSvg} from '../src/export/design';
import {designBookHtml} from '../src/export/design/book';
import {buildDesignDeck} from '../src/export/design/slides';
import {recommendFigures} from '../src/export/design/recommend';
import {availabilityOf,FALLBACK_FIGURE,type MeasuredFigure} from '../src/export/design/availability';
import {defects} from './helpers/designGeometry';
import {validateDocument,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {samples} from '../src/data/samples';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {parseXml,walk} from '../src/core/interchange/xml';

const NOW=new Date('2026-10-07T09:00:00Z'),MEASURED:MeasuredFigure[]=['sankey','timeline','sequence'];
const els=(svg:string)=>[...walk(parseXml(svg))];
const attr=(svg:string,name:string)=>els(svg).filter(e=>e.attrs[name]!==undefined).map(e=>e.attrs[name]);
const texts=(svg:string)=>els(svg).filter(e=>e.name==='text'||e.name==='title'||e.name==='desc').map(e=>e.text).join(' ');
const all=()=>[contosoForecasting(),...samples] as Project[];
/** A one-view project: two components, optionally connected, optionally with a public story step. */
function tiny({edge=true,story=false}:{edge?:boolean;story?:boolean}={}):Project{
 return validateDocument({schemaVersion:1,id:'withhold-fixture',title:'Withhold fixture',rootViewId:'root',nodes:[{id:'a',label:'Reader',kind:'source'},{id:'b',label:'Store',kind:'storage'}],
  edges:edge?[{id:'a-b',source:'a',target:'b',label:'rows'}]:[],views:[{id:'root',title:'Root',nodeIds:['a','b'],edgeIds:edge?['a-b']:[],positions:{a:{x:0,y:0},b:{x:300,y:0}}}],
  story:story?[{title:'Read the rows',narration:'The reader reads, the store keeps.',viewId:'root',highlightEdgeIds:[]}]:[]});
}

test('figure withhold: a Sankey without connection quantities names the missing input and the fallback instead of drawing bands',()=>{
 const svg=designSvg(contosoForecasting(),'overview',{type:'sankey',now:NOW}),t=texts(svg);
 assert.deepEqual(attr(svg,'data-dd-withheld'),['sankey']);assert.deepEqual(attr(svg,'data-dd-missing'),['Connection quantities with units']);
 assert.equal(attr(svg,'data-dd-edge').length,0,'no band');assert.equal(attr(svg,'data-dd-fallback')[0],'architecture');
 assert.match(t,/WITHHELD · NOT DRAWN/);assert.match(t,/What is missing to draw this sankey flow figure/);assert.match(t,/0 of \d+ connections carry a quantity with a unit/);
 assert.ok(t.includes(FALLBACK_FIGURE));assert.match(t,/without inventing amounts/);assert.match(t,/synthetic amounts stay labelled synthetic/);
 assert.deepEqual(defects(svg,'withheld sankey').failures,[]);
 const one=structuredClone(contosoForecasting()),e=one.edges.find(e=>one.views.find(v=>v.id==='overview')!.edgeIds.includes(e.id))!;e.quantity={value:5,unit:'GB',provenance:'author'};
 assert.equal(attr(designSvg(validateDocument(one),'overview',{type:'sankey',now:NOW}),'data-dd-withheld').length,0,'one supplied quantity is drawn');
});

test('figure withhold: mixed units stay unsummed and a self-loop alone is not a drawable flow',()=>{
 const d=structuredClone(contosoForecasting()),v=d.views.find(v=>v.id==='overview')!,edges=d.edges.filter(e=>v.edgeIds.includes(e.id));
 edges[0].quantity={value:3,unit:'GB',provenance:'synthetic'};edges[1].quantity={value:4,unit:'rows',provenance:'synthetic'};
 const svg=designSvg(validateDocument(d),'overview',{type:'sankey',now:NOW}),units=els(svg).filter(e=>e.attrs['data-dd-value']!==undefined).map(e=>e.attrs['data-dd-unit']);
 assert.equal(new Set(units).size,1,'one unit drawn');assert.match(texts(svg),/1 connection\(s\) in other units, not drawn and never summed/);
 const loop=tiny();loop.edges[0].target='a';loop.edges[0].quantity={value:9,unit:'rows',provenance:'author'};
 const ls=designSvg(validateDocument(loop),'root',{type:'sankey',now:NOW});assert.deepEqual(attr(ls,'data-dd-withheld'),['sankey']);assert.equal(attr(ls,'data-dd-edge').length,0);
});

test('figure withhold: a story timeline needs public story steps and never draws a schedule without dates or labelled estimates',()=>{
 const none=designSvg(tiny(),'root',{type:'timeline',now:NOW}),t=texts(none);
 assert.deepEqual(attr(none,'data-dd-withheld').sort(),['schedule','timeline']);assert.deepEqual(attr(none,'data-dd-missing'),['Public story steps']);assert.equal(attr(none,'data-step').length,0);
 assert.match(t,/story order is a presentation sequence, not timing|presentation sequence, not timing/);assert.match(t,/Scheduled timeline \(Gantt\) withheld: No dates, durations or declared estimates/);assert.ok(t.includes(FALLBACK_FIGURE));
 const drawn=designSvg(tiny({story:true}),'root',{type:'timeline',now:NOW}),dt=texts(drawn);
 assert.equal(attr(drawn,'data-step').length,1);assert.deepEqual(attr(drawn,'data-dd-withheld'),['schedule']);assert.equal(attr(drawn,'data-dd-missing').length,0);
 assert.match(dt,/presentation order, not timing/);assert.match(dt,/Scheduled timeline \(Gantt\) withheld: .*Needs: Supplied dates or durations per step, or estimates labelled as estimates/);
 for(const svg of [none,drawn])assert.deepEqual(defects(svg,'timeline').failures,[]);
});

test('figure withhold: a sequence without a connection is withheld and its order is never timing',()=>{
 const svg=designSvg(tiny({edge:false}),'root',{type:'sequence',now:NOW}),t=texts(svg);
 assert.deepEqual(attr(svg,'data-dd-withheld'),['sequence']);assert.deepEqual(attr(svg,'data-dd-missing'),['Connections between components']);assert.equal(attr(svg,'data-edge-id').length,0);
 assert.match(t,/Message order would be derived from the connections, not timing/);assert.ok(t.includes(FALLBACK_FIGURE));assert.deepEqual(defects(svg,'withheld sequence').failures,[]);
 const drawn=designSvg(tiny(),'root',{type:'sequence',now:NOW});assert.equal(attr(drawn,'data-dd-withheld').length,0);assert.match(texts(drawn),/not from timing/);
});

test('figure withhold: recommend never ranks a withheld figure as available and gives the reason and fallback',()=>{
 let withheld=0;
 for(const d of [...all(),tiny({edge:false})])for(const v of publicDocument(d).views){const r=recommendFigures(d,v.id),label=`${d.id} ${v.id}`;
  assert.ok(r[0].available,`${label}: first is available`);const firstOff=r.findIndex(x=>!x.available);if(firstOff>=0)assert.ok(r.slice(firstOff).every(x=>!x.available),`${label}: withheld after available`);
  for(const type of MEASURED){const a=availabilityOf(d,v.id,type),x=r.find(x=>x.type===type)!;
   assert.equal(x.available,a.available,`${label} ${type}`);const svg=designSvg(d,v.id,{type,now:NOW});
   assert.equal(attr(svg,'data-dd-withheld').includes(type),!a.available,`${label} ${type}: figure agrees with the recommendation`);
   if(!a.available){withheld++;assert.ok(x.score<=5);assert.match(x.reason,new RegExp(`withheld, fallback: ${FALLBACK_FIGURE.replace(/[()]/g,'\\$&')}`));}}
  const tl=r.find(x=>x.type==='timeline')!;if(tl.available)assert.match(tl.reason,/presentation order; a scheduled timeline \(Gantt\) is withheld/);}
 assert.ok(withheld>3,`${withheld} withheld measured figures seen`);
 assert.equal(recommendFigures(tiny({edge:false}),'root').find(x=>x.type==='sequence')!.available,false);
});

test('figure withhold: SVG, HTML book and PPTX deck carry the same withheld state',async()=>{
 const d=contosoForecasting(),svg=designSvg(d,'overview',{type:'sankey',now:NOW}),html=designBookHtml(d,{type:'sankey',now:NOW});
 assert.ok(html.includes(svg),'the book embeds the same withheld figure');assert.match(html,/data-dd-withheld="sankey"/);
 const seen:string[]=[],{pptx}=await buildDesignDeck(PptxGenJS,d,{type:'sankey',now:NOW,raster:async s=>{seen.push(s);return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';}});
 assert.ok(seen.includes(svg));assert.ok(seen.every(s=>/data-dd-withheld="sankey"|data-dd-edge=/.test(s)));
 const zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}) as Buffer),xml=(await Promise.all(Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).map(n=>zip.file(n)!.async('string')))).join('\n');
 assert.match(xml,/descr="[^"]*Sankey flow figure withheld on the public view overview: missing connection quantities with units\. Fallback: Architecture \(relationship diagram\)\./);
});
