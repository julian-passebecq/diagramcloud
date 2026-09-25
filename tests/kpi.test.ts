import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {examplePack} from '../src/experience/sample';
import {publicPack,validatePack,type ExperienceItem,type ExperiencePack} from '../src/experience/model';
import {countsOf,kpiDisplay} from '../src/experience/kpi';
import {addTable,removeRelationship,setRelationship} from '../src/experience/modelEdit';
import {itemBody,workspaceHtml} from '../src/experience/render';
import {buildWorkspaceDeck} from '../src/experience/pptx';
import type {ModelItem} from '../src/experience/semantic';

type Kpi=Extract<ExperienceItem,{type:'kpi'}>;
const kpi=(p:ExperiencePack,id:string)=>p.items.find(i=>i.id===id) as Kpi;
const setModel=(p:ExperiencePack,m:ModelItem)=>{p.items[p.items.findIndex(i=>i.id==='sm-model')]=m;return validatePack(p);};

test('model tiles count tables, relationships and measures, with {tokens} in the note',()=>{
 const p=examplePack();
 assert.deepEqual(kpiDisplay(p,kpi(p,'sm-kpi-tables')),{value:'10',note:'3 facts · 7 dimensions',from:'Star schema'});
 assert.deepEqual(kpiDisplay(p,kpi(p,'sm-kpi-rel')),{value:'10',note:'10 active · 0 inactive',from:'Star schema'});
 assert.equal(kpiDisplay(p,kpi(p,'sm-kpi-measures')).value,'6');
 assert.deepEqual(countsOf(p.items.find(i=>i.id==='ql-loads')),{rows:5});
 assert.equal(countsOf(p.items.find(i=>i.id==='ql-kpi-prod')),null,'a KPI cannot be counted');
 assert.deepEqual(kpiDisplay(p,kpi(p,'ql-kpi-prod')),{value:'1,240',note:''},'typed tiles are unchanged');
});

test('editing the model recounts the tiles',()=>{
 let p=examplePack(),m=p.items.find(i=>i.id==='sm-model') as ModelItem;
 m=addTable(m,'DimGeography','dimension').item;m=setRelationship(m,0,{active:false}).item;m=removeRelationship(m,1).item;
 p=setModel(p,m);
 assert.deepEqual(kpiDisplay(p,kpi(p,'sm-kpi-tables')),{value:'11',note:'3 facts · 8 dimensions',from:'Star schema'});
 assert.deepEqual(kpiDisplay(p,kpi(p,'sm-kpi-rel')),{value:'9',note:'8 active · 1 inactive',from:'Star schema'});
});

test('unknown tokens stay visible and a missing source falls back to the typed value',()=>{
 const p=examplePack();kpi(p,'sm-kpi-tables').note='{facts} facts, {nope}';
 assert.equal(kpiDisplay(p,kpi(p,'sm-kpi-tables')).note,'3 facts, {nope}');
 const orphan={...kpi(p,'sm-kpi-tables'),derive:{itemId:'ghost',metric:'tables' as const}};
 assert.deepEqual(kpiDisplay(p,orphan),{value:'10',note:'{facts} facts, {nope}'});
});

test('validation rejects a tile that counts from an unknown item, itself, or the wrong kind of item',()=>{
 const bad=(mutate:(k:Kpi)=>void,re:RegExp)=>{const p=examplePack();mutate(kpi(p,'sm-kpi-tables'));assert.throws(()=>validatePack(p),re);};
 bad(k=>{k.derive={itemId:'ghost',metric:'tables'};},/counts from unknown item ghost/);
 bad(k=>{k.derive={itemId:'sm-kpi-tables',metric:'tables'};},/counts from unknown item sm-kpi-tables/);
 bad(k=>{k.derive={itemId:'ql-loads',metric:'tables'};},/table ql-loads cannot provide tables/);
 bad(k=>{k.derive={itemId:'sm-model',metric:'rows'};},/model sm-model cannot provide rows/);
});

test('a tile counting a private model is dropped from public output, so its size cannot leak',()=>{
 const p=examplePack();(p.items.find(i=>i.id==='sm-model') as ModelItem).visibility='private';
 const pub=publicPack(p);
 assert(!pub.items.some(i=>['sm-model','sm-kpi-tables','sm-kpi-rel','sm-kpi-measures'].includes(i.id)));
 assert(pub.items.some(i=>i.id==='sm-context'),'unrelated panels on the same screen stay');
 const whole=examplePack();whole.workspaces.find(w=>w.id==='model-screen')!.placements=whole.workspaces.find(w=>w.id==='model-screen')!.placements.filter(x=>x.itemId!=='sm-model');
 assert(publicPack(whole).items.some(i=>i.id==='sm-model'),'the counted model is kept for a public tile even when it is not placed');
});

test('HTML and PowerPoint show the counted value and say where it comes from',async()=>{
 const p=setModel(examplePack(),addTable(examplePack().items.find(i=>i.id==='sm-model') as ModelItem,'DimGeography','dimension').item);
 const body=itemBody(p,kpi(p,'sm-kpi-tables'));
 assert.match(body,/xp-kpi-value">11</);assert.match(body,/3 facts · 8 dimensions/);assert.match(body,/↻ counted from “Star schema”/);
 assert.match(workspaceHtml(p,'model-screen'),/xp-kpi-value">11</);
 const zip=await JSZip.loadAsync(await buildWorkspaceDeck(PptxGenJS,p,['model-screen']).write({outputType:'nodebuffer'}) as Buffer);
 const xml=(await Promise.all(Object.keys(zip.files).filter(n=>/^ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(n)).map(n=>zip.file(n)!.async('string')))).join('');
 assert.match(xml,/<a:t>11<\/a:t>/);assert.match(xml,/counted from “Star schema”/);assert.match(xml,/11 · 3 facts · 8 dimensions \(counted from Star schema\)/);
});
