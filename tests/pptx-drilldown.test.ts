import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {samples} from '../src/data/samples';
import {clone} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {addArchitectureSlides} from '../src/export/pptx';

const total=samples.find(s=>s.id==='total-project-controls')!;

async function deck(input:typeof total){
 const d=publicDocument(input),pptx=new PptxGenJS();
 await addArchitectureSlides(pptx,d,{cover:false,evidence:false,sources:false,firstViewSlide:1});
 const zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}) as Buffer);
 /** Slide numbers that slide n jumps to, resolved through its relationships file. */
 const links=async(n:number)=>{const xml=await zip.file(`ppt/slides/slide${n}.xml`)!.async('string'),rels=await zip.file(`ppt/slides/_rels/slide${n}.xml.rels`)!.async('string');
  return [...xml.matchAll(/<a:hlinkClick r:id="(rId\d+)"[^>]*action="ppaction:\/\/hlinksldjump"/g)].map(m=>Number(new RegExp(`Id="${m[1]}"[^>]*Target="slide(\\d+)\\.xml"`).exec(rels)?.[1]));};
 const xml=async(n:number)=>zip.file(`ppt/slides/slide${n}.xml`)!.async('string');
 return {d,links,xml};
}

test('a component with a public child view links to that view\'s slide',async()=>{
 const {d,links}=await deck(total);
 const root=d.views.findIndex(v=>v.id===d.rootViewId),rootNodes=d.nodes.filter(n=>d.views[root].nodeIds.includes(n.id));
 const expected=new Set(rootNodes.filter(n=>n.childViewId).map(n=>d.views.findIndex(v=>v.id===n.childViewId)+1));
 assert.ok(expected.size>0,'the sample root view has drilldowns');
 assert.deepEqual(new Set(await links(root+1)),expected);
});

test('a private child view gets no link and no hint on the parent slide',async()=>{
 const hidden=clone(total),child=hidden.views.find(v=>v.id==='data-model')!;child.visibility='private';child.title='SECRET-CHILD-VIEW';
 const {d,links,xml}=await deck(hidden);
 assert.ok(!d.views.some(v=>v.id==='data-model'));
 const root=d.views.findIndex(v=>v.id===d.rootViewId),targets=await links(root+1);
 assert.ok(targets.every(t=>t>=1&&t<=d.views.length),'every remaining link lands on a slide of this deck');
 assert.equal(d.nodes.find(n=>n.id==='oracle')?.childViewId,undefined);
 const all=(await Promise.all(d.views.map((_,i)=>xml(i+1)))).join('\n');
 assert.doesNotMatch(all,/SECRET-CHILD-VIEW/);
 const full=await deck(total);
 assert.equal(new Set(targets).size,new Set(await full.links(root+1)).size-1,'the oracle card pointed only at the hidden view');
});
