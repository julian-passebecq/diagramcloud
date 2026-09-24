import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {examplePack} from '../src/experience/sample';
import {validatePack,type ExperiencePack} from '../src/experience/model';
import {itemBody,modelSvg,workspaceHtml} from '../src/experience/render';
import {modelLayout,type ModelItem} from '../src/experience/semantic';
import {buildWorkspaceDeck} from '../src/experience/pptx';

const model=(p:ExperiencePack)=>p.items.find(i=>i.id==='sm-model') as ModelItem;
const overlaps=(L:ReturnType<typeof modelLayout>)=>L.boxes.some((a,i)=>L.boxes.some((b,j)=>j>i&&a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h));

test('model validation rejects unknown columns, duplicates, self-joins, dotted names and half positions',()=>{
 const bad=(mutate:(m:ModelItem)=>void,re:RegExp)=>{const p=examplePack();mutate(model(p));assert.throws(()=>validatePack(p),re);};
 bad(m=>{m.relationships.push({from:'Fact_Energy.Nope',to:'DimDate.DateKey',cardinality:'*:1',active:true});},/unknown column Fact_Energy\.Nope/);
 bad(m=>{m.relationships.push({from:'Ghost.DateKey',to:'DimDate.DateKey',cardinality:'*:1',active:true});},/unknown column Ghost\.DateKey/);
 bad(m=>{m.tables.push(structuredClone(m.tables[0]));},/duplicate table Fact_Energy/);
 bad(m=>{m.tables[0].columns.push({name:'DateKey',type:''});},/duplicate column Fact_Energy\.DateKey/);
 bad(m=>{m.relationships.push({from:'DimDate.DateKey',to:'DimDate.Date',cardinality:'*:1',active:true});},/stays inside one table/);
 bad(m=>{m.tables[0].name='dbo.Fact';},/cannot contain a dot/);
 bad(m=>{m.tables[0].col=1;},/needs both col and row/);
 bad(m=>{m.measures.push({name:'x',table:'Ghost'});},/unknown table Ghost/);
});

test('automatic layout keeps every table inside the drawing without overlaps, even for a larger model',()=>{
 const m=model(examplePack());
 for(const w of [560,760,1000]){const L=modelLayout(m,w);assert.equal(L.boxes.length,10);assert(!overlaps(L),`overlap at ${w}`);assert(L.boxes.every(b=>b.x>=0&&b.x+b.w<=w+.5),`outside at ${w}`);}
 const facts=(L:ReturnType<typeof modelLayout>)=>L.boxes.filter(b=>b.kind==='fact').map(b=>b.y);const L=modelLayout(m,760);
 assert.equal(new Set(facts(L)).size,1,'facts share the middle band');
 assert(L.boxes.filter(b=>b.kind==='dimension').every(b=>b.y!==facts(L)[0]),'dimensions sit above or below');
 const big:ModelItem={...m,tables:[...Array.from({length:4},(_,k)=>({name:`Fact${k}`,kind:'fact' as const,columns:[{name:'Key',type:'int',key:'fk' as const}]})),...Array.from({length:14},(_,k)=>({name:`Dim${k}`,kind:'dimension' as const,columns:Array.from({length:9},(_,c)=>({name:`c${c}`,type:''}))}))],
  relationships:Array.from({length:14},(_,k)=>({from:`Fact${k%4}.Key`,to:`Dim${k}.c0`,cardinality:'*:1' as const,active:k%5!==0})),measures:[]};
 const B=modelLayout(big,760);assert(!overlaps(B));assert(B.boxes.every(b=>b.x>=0&&b.x+b.w<=760.5));
 assert(B.boxes.every(b=>b.more===4||b.kind==='fact'),'wide tables show five columns and a "more" line');
 assert(modelSvg(big).includes('stroke-dasharray="4 3"'),'inactive relationships are dashed');
});

test('explicit col/row positions override the automatic layout',()=>{
 const m=structuredClone(model(examplePack()));m.tables.forEach((t,k)=>{t.col=k%5;t.row=Math.floor(k/5);});
 const L=modelLayout(m,760),first=L.boxes.find(b=>b.name===m.tables[0].name)!,sixth=L.boxes.find(b=>b.name===m.tables[5].name)!;
 assert.equal(first.x,sixth.x);assert(sixth.y>first.y);assert(!overlaps(L));
});

test('model rendering escapes names and PowerPoint keeps the full model in the notes',async()=>{
 const p=examplePack(),m=model(p),hostile='<img src=x onerror=alert(1)>';
 m.tables[3].columns.push({name:hostile,type:''});m.measures.push({name:hostile});
 const html=itemBody(validatePack(p),m,{cols:12});
 assert.doesNotMatch(html,/<img src=x/);assert.match(html,/&lt;img src=x/);assert.doesNotMatch(html,/NaN/);
 assert.match(workspaceHtml(examplePack(),'model-screen'),/Σ Total Production \(boe\)/);
 const zip=await JSZip.loadAsync(await buildWorkspaceDeck(PptxGenJS,examplePack(),['model-screen']).write({outputType:'nodebuffer'}) as Buffer);
 const names=Object.keys(zip.files),slides=(await Promise.all(names.filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).map(n=>zip.file(n)!.async('string')))).join(''),notes=(await Promise.all(names.filter(n=>/notesSlide\d+\.xml$/.test(n)).map(n=>zip.file(n)!.async('string')))).join('');
 for(const t of ['Fact_Energy','DimCurrency','DimProject'])assert.match(slides,new RegExp(t));
 assert.match(notes,/FactCapex\.CurrencyKey -&gt; DimCurrency\.CurrencyKey/);
});
