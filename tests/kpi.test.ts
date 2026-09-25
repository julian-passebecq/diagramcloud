import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {examplePack} from '../src/experience/sample';
import {publicPack,validatePack,type ExperienceItem,type ExperiencePack} from '../src/experience/model';
import {countableSources,countsOf,kpiDisplay,publicWarning,withSource} from '../src/experience/kpi';
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

test('the source form points a tile at a model or table, and the result validates and recounts',()=>{
 const p=examplePack(),k=kpi(p,'sm-kpi-measures');
 assert(countableSources(p).some(s=>s.item.id==='sm-model'&&s.counts.columns===42));
 assert(!countableSources(p).some(s=>s.item.type==='kpi'),'only models and tables are offered');
 const e=withSource(p,k,{itemId:'sm-model',metric:'columns'},'{columns} columns in {tables} tables');
 assert.equal(e.label,'Count source: “Measures” counts columns of “Star schema”');
 assert.equal(e.item.value,'42','the stored fallback matches the count');
 p.items[p.items.indexOf(k)]=e.item;const v=validatePack(p);
 assert.deepEqual(kpiDisplay(v,kpi(v,'sm-kpi-measures')),{value:'42',note:'42 columns in 10 tables',from:'Star schema'});
 const rows=withSource(v,kpi(v,'ql-kpi-prod'),{itemId:'ql-loads',metric:'rows'},'');
 assert.equal(kpiDisplay(v,rows.item).value,'5');assert.equal(rows.item.unit,kpi(v,'ql-kpi-prod').unit,'unit and styling are kept');
 assert.equal(withSource(v,kpi(v,'sm-kpi-measures'),{itemId:'sm-model',metric:'columns'},'{columns} columns in {tables} tables').label,'','no change, no undo step');
});

test('going back to a typed value freezes what the tile showed; impossible sources are refused',()=>{
 const p=examplePack(),k=kpi(p,'sm-kpi-tables');
 const typed=withSource(p,k,null,k.note);
 assert.equal(typed.label,'Typed value: “Tables”');assert.equal(typed.item.derive,undefined);
 assert.deepEqual([typed.item.value,typed.item.note],['10','3 facts · 7 dimensions'],'tokens are filled from the old source');
 p.items[p.items.indexOf(k)]=typed.item;validatePack(p);
 assert.throws(()=>withSource(p,k,{itemId:'ql-loads',metric:'tables'},''),/cannot provide tables/);
 assert.throws(()=>withSource(p,k,{itemId:'ghost',metric:'rows'},''),/Choose a model or table/);
});

test('the form warns when counting a source that public exports would drop',()=>{
 const p=examplePack(),k=kpi(p,'sm-kpi-tables');
 assert.equal(publicWarning(p,k,'sm-model'),null);
 (p.items.find(i=>i.id==='sm-model') as ModelItem).visibility='private';
 assert.match(publicWarning(p,k,'sm-model')!,/“Star schema” is private, so this tile will be left out of public exports/);
 (p.items.find(i=>i.id==='sm-model') as ModelItem).visibility='public';(p.items.find(i=>i.id==='sm-model') as ModelItem).approval='draft';
 assert.match(publicWarning(p,k,'sm-model')!,/is draft, not approved/);
 k.visibility='private';assert.equal(publicWarning(p,k,'sm-model'),null,'a private tile is not published anyway');
});
