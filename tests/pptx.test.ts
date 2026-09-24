import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {examplePack} from '../src/experience/sample';
import {validatePack,type ExperiencePack} from '../src/experience/model';
import {buildWorkspaceDeck,fitFont,fitProse,rowBands} from '../src/experience/pptx';

async function unzip(p:ExperiencePack,ids:string[]){
 const buf=await buildWorkspaceDeck(PptxGenJS,p,ids,['Test']).write({outputType:'nodebuffer'}) as Buffer;
 assert.equal(buf.subarray(0,2).toString(),'PK');
 const zip=await JSZip.loadAsync(buf),names=Object.keys(zip.files);
 const read=async(re:RegExp)=>Promise.all(names.filter(n=>re.test(n)).sort().map(n=>zip.file(n)!.async('string')));
 return {names,slides:await read(/^ppt\/slides\/slide\d+\.xml$/),notes:await read(/^ppt\/notesSlides\/notesSlide\d+\.xml$/),charts:await read(/^ppt\/charts\/chart\d+\.xml$/)};
}

test('row bands never cut a panel and keep slides at most nine rows when possible',()=>{
 const q=examplePack().workspaces.find(w=>w.id==='quicklook-screen')!;
 assert.deepEqual(rowBands(q.placements),[[0,6],[6,13]]);
 for(const w of examplePack().workspaces)for(const [a,b] of rowBands(w.placements))assert(!w.placements.some(p=>p.y<a&&a<p.y+p.h||p.y<b&&b<p.y+p.h),`${w.id} cut at ${a}/${b}`);
 assert.deepEqual(rowBands([{id:'a',itemId:'x',x:0,y:0,w:12,h:12}]),[[0,12]],'a panel taller than the limit gets its own band');
});

test('text fitting shrinks before truncating and points truncated prose to the notes',()=>{
 assert.equal(fitFont('short',3,1,11,7),11);
 assert(fitFont('word '.repeat(300),3,1,11,7)<11);
 const long='Lorem ipsum dolor sit amet. '.repeat(90),fitted=fitProse(long,4,1.5,7);
 assert(fitted.length<long.length);assert.match(fitted,/continued in the speaker notes/);
 assert.equal(fitProse('fits',4,1.5,9),'fits');
});

test('showcase screens become native slides: real charts, tables, full notes and sources',async()=>{
 const deck=await unzip(examplePack(),['quicklook-screen','daxsql-screen','foil-economics-screen']);
 assert.equal(deck.slides.length,2+4+2,'quicklook 2 bands; DAX 2 bands + 2 extra tabs; economics 2 bands');
 const all=deck.charts.join('\n');
 assert.match(all,/<c:doughnutChart>/);assert.match(all,/<c:lineChart>/);assert.match(all,/<c:barDir val="bar"\/>/);assert.match(all,/<c:grouping val="stacked"\/>/);
 assert(deck.slides.some(x=>x.includes('<a:tbl>')),'native tables');
 assert(deck.slides.some(x=>x.includes('BI quicklook | executive dashboard')));
 const notes=deck.notes.join('\n');
 assert.match(notes,/TOTALYTD/);assert.match(notes,/FROM dbo\.Fact_Energy f/);assert.match(notes,/TotalEnergies-first 18-page portfolio p\.6/);
 assert.match(deck.slides.join('\n'),/nothing here is a live query or proof of deployment/);
});

test('stacked charts never carry outEnd data labels (PowerPoint rejects the whole file)',async()=>{
 const deck=await unzip(examplePack(),['foil-economics-screen','quicklook-screen']);
 for(const c of deck.charts)if(c.includes('<c:grouping val="stacked"/>'))assert.doesNotMatch(c,/<c:dLblPos val="outEnd"\/>/);
});

test('only public, approved content reaches the deck, and user text is XML-escaped',async()=>{
 const p=examplePack(),hostile='<img src=x onerror=alert(1)> & "q"';
 const secret=p.items.find(i=>i.id==='ql-top5')!;secret.visibility='private';secret.title='SECRET-TOP5-TITLE';
 const draft=p.items.find(i=>i.id==='ql-insights')!;draft.approval='draft';
 p.items.find(i=>i.id==='ql-kpi-prod')!.title=hostile;
 const deck=await unzip(validatePack(p),['quicklook-screen']),xml=deck.slides.join('\n')+deck.notes.join('\n');
 assert.doesNotMatch(xml,/SECRET-TOP5-TITLE|Production stable/);
 assert.doesNotMatch(xml,/<img src=x/);assert.match(xml,/&lt;img src=x onerror=alert\(1\)&gt; &amp;/);
 const hidden=examplePack();hidden.workspaces.find(w=>w.id==='quicklook-screen')!.visibility='private';
 await assert.rejects(unzip(hidden,['quicklook-screen']),/not approved for public export/);
});

test('scatter, long tables and long code export with truncation markers',async()=>{
 const p=examplePack(),shared={visibility:'public',approval:'approved',provenance:'synthetic',sourceIds:[],entityId:'foil-physics'} as const;
 p.items.push(
  {...shared,id:'st-xy',title:'XY',type:'table',columns:['Kind','x','y'],rows:[['A',1,2],['B',3,4],['A',5,1]]} as never,
  {...shared,id:'st-scatter',title:'Scatter',type:'chart',chartType:'scatter',dataItemId:'st-xy',labelColumn:'Kind',valueColumns:['x','y']} as never,
  {...shared,id:'st-long',title:'Long',type:'table',columns:['ID','Status'],statusColumn:'Status',rows:Array.from({length:40},(_,k)=>[k,k%2?'Success':'Failed'])} as never,
  {...shared,id:'st-code',title:'Code',type:'code',language:'text',code:Array.from({length:90},(_,k)=>`line ${k}`).join('\n')} as never);
 p.workspaces.push({id:'stress',title:'Stress',entityId:'foil-physics',visibility:'public',accent:'blue',description:'',context:[],placements:[{id:'a',itemId:'st-scatter',x:0,y:0,w:4,h:4},{id:'b',itemId:'st-long',x:4,y:0,w:4,h:4},{id:'c',itemId:'st-code',x:8,y:0,w:4,h:4}]} as never);
 p.entities.find(e=>e.id==='foil-physics')!.workspaceIds.push('stress');
 const deck=await unzip(validatePack(p),['stress']),slide=deck.slides[0];
 assert.match(deck.charts.join(''),/<c:scatterChart>/);
 assert.match(slide,/more rows \(full table in the speaker notes\)/);assert.match(slide,/more lines \(full content in the speaker notes/);
 assert.match(deck.notes[0],/line 89/);
});
