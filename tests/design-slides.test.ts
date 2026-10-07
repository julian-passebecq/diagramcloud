import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {publicDocument} from '../src/core/operations';
import {validateDocument} from '../src/core/model';
import {applyDesignBrief,parseDesignBrief} from '../src/core/designBrief';
import {readFileSync} from 'node:fs';
import {buildDesignDeck,figureSize} from '../src/export/design/slides';

const NOW=new Date('2026-10-07T09:00:00Z'),PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
async function open(doc:ReturnType<typeof contosoForecasting>,theme?:'dark'){
 const seen:string[]=[],{pptx,slides}=await buildDesignDeck(PptxGenJS,doc,{now:NOW,theme,raster:async svg=>{seen.push(svg);return PNG;}});
 const zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}) as Buffer),names=Object.keys(zip.files);
 const xml=(await Promise.all(names.filter(n=>/^ppt\/(slides|notesSlides)\/.*\.xml$/.test(n)).map(n=>zip.file(n)!.async('string')))).join('\n');
 return {slides,seen,names,xml,count:names.filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).length,media:names.filter(n=>n.startsWith('ppt/media/')).length};
}

test('design deck: a cover and one picture slide per public view, in drilldown order, with alt text from the figure',async()=>{
 const doc=applyDesignBrief(contosoForecasting(),parseDesignBrief(readFileSync('docs/design-brief.example.json','utf8'))).document,views=publicDocument(doc).views;
 const r=await open(doc);
 assert.equal(r.slides,views.length+1);assert.equal(r.count,views.length+1);assert.equal(r.seen.length,views.length);assert.ok(r.media>=1);
 assert.ok(r.seen.some(s=>s.includes('data-design-type="exploded"')),'the view hint picks the figure');
 assert.match(r.xml,/descr="[^"]+"/);assert.match(r.xml,/01 · /);
});

test('design deck: private components never reach a figure, a slide or its alt text',async()=>{
 const d=structuredClone(contosoForecasting()),root=d.views.find(v=>v.id===d.rootViewId)!,secret=d.nodes.find(n=>root.nodeIds.includes(n.id))!;
 secret.label='Hidden ledger zeta';secret.visibility='private';
 const r=await open(validateDocument(d),'dark');
 assert.ok(!r.seen.some(s=>s.includes('Hidden ledger zeta')));assert.doesNotMatch(r.xml,/Hidden ledger zeta/);
});

test('design deck: figure size comes from the viewBox; a view-less export is refused',async()=>{
 assert.deepEqual(figureSize('<svg viewBox="0 0 1200 800">'),{w:1200,h:800});assert.throws(()=>figureSize('<svg>'));
 const d=structuredClone(contosoForecasting());for(const v of d.views)v.visibility='private';
 await assert.rejects(()=>buildDesignDeck(PptxGenJS,d as any,{raster:async()=>PNG}));
});
