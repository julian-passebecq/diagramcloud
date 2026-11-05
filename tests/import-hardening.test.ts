import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importMermaid} from '../src/core/interchange/mermaid';
import {importDrawio} from '../src/core/interchange/drawio';
import {importVisio,visioPages,MAX_VISIO_PAGES} from '../src/core/interchange/visio';
import {MAX_EDGES,MAX_VIEW_EDGES} from '../src/core/interchange/graph';
import {InflateLimitError,partReader,zipEntries} from '../src/core/interchange/zip';
import {MAX_DOCUMENT_BYTES,validateDocument} from '../src/core/model';
import {MAX_PACKAGE_FILE_BYTES,checkImportFileSize,importFileLimit} from '../src/app/importFileLimit';
import {applyOperations} from '../src/core/patch';
import {zip} from './fixtures/interchange/visio';

const opts={idSuffix:'t1',now:new Date('2026-11-05T00:00:00Z')};
const MiB=1024*1024;
const NS=`xmlns='http://schemas.microsoft.com/office/visio/2012/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships'`;
const rels=(targets:string[])=>`<?xml version='1.0'?><Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'>${targets.map((t,i)=>`<Relationship Id='rId${i+1}' Type='x' Target='${t}'/>`).join('')}</Relationships>`;
const shape=(id:number,x:number,text:string)=>`<Shape ID='${id}' Type='Shape'><Cell N='PinX' V='${x}'/><Cell N='PinY' V='1'/><Cell N='Width' V='1'/><Cell N='Height' V='0.5'/><Section N='Geometry' IX='0'><Row T='RelMoveTo' IX='1'><Cell N='X' V='0'/></Row></Section><Text>${text}</Text></Shape>`;

test('import limits: the per-view connection limit equals the validator, so a wide Mermaid flowchart imports with its own report line',()=>{
 assert.ok(MAX_VIEW_EDGES<MAX_EDGES);
 // The validator refuses a view with MAX_VIEW_EDGES + 1 edge IDs: the importer's limit is that same number.
 const keys=(p:string)=>Array.from({length:200},(_,i)=>p+i).join('&');
 const wide=importMermaid(`flowchart LR\n${keys('n')} --> ${keys('m')}`,'wide.mmd',opts);
 const view=wide.document.views.find(v=>v.id==='overview')!;
 assert.equal(view.edgeIds.length,MAX_VIEW_EDGES);
 assert.equal(wide.report.edges,MAX_VIEW_EDGES);
 assert.ok(wide.report.lost.some(l=>l===`Only the first ${MAX_VIEW_EDGES} connections of “wide” were imported: one view holds at most ${MAX_VIEW_EDGES} connections.`),wide.report.lost.join(' | '));
 assert.ok(!wide.report.lost.some(l=>l.startsWith(`Only the first ${MAX_EDGES} connections`)),'the total limit was not reached');
 assert.doesNotThrow(()=>validateDocument(wide.document));
 const over={...wide.document,views:wide.document.views.map(v=>({...v,edgeIds:[...v.edgeIds,'extra']}))};
 assert.throws(()=>validateDocument(over),/1000/);
});

test('import limits: draw.io pages are capped per view first and by the document total after',async()=>{
 const page=(name:string,boxes:number,links:number)=>{
  const cells=Array.from({length:boxes},(_,i)=>`<mxCell id="${name}v${i}" parent="1" vertex="1" value="${name} box ${i}"><mxGeometry x="${i*200}" y="0" width="80" height="40" as="geometry"/></mxCell>`);
  for(let i=0;i<links;i++)cells.push(`<mxCell id="${name}e${i}" parent="1" edge="1" source="${name}v${i%boxes}" target="${name}v${(i+1+Math.floor(i/boxes))%boxes}"/>`);
  return `<diagram name="${name}" id="${name}"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}</root></mxGraphModel></diagram>`;
 };
 const out=await importDrawio(`<mxfile>${page('first',40,1200)}${page('second',40,800)}</mxfile>`,'two.drawio',opts);
 const [first,second]=['first','second'].map(t=>out.document.views.find(v=>v.title===t)!);
 assert.equal(first.edgeIds.length,MAX_VIEW_EDGES);
 assert.equal(second.edgeIds.length,MAX_EDGES-MAX_VIEW_EDGES);
 assert.equal(out.document.edges.length,MAX_EDGES);
 assert.ok(out.report.lost.some(l=>/connections of “first” were imported: one view holds at most 1000/.test(l)));
 assert.ok(out.report.lost.includes(`Only the first ${MAX_EDGES} connections were imported.`));
});

test('Visio: a part shared by many pages is inflated once and the pages read are capped',async()=>{
 const pages=Array.from({length:MAX_VISIO_PAGES+40},(_,i)=>`<Page ID='${i}' Name='P${i}'><Rel r:id='rId1'/></Page>`).join('');
 const shared=`<PageContents ${NS}><Shapes>${shape(1,1,'Alpha')}${shape(2,4,'Beta')}</Shapes></PageContents>`;
 const bytes=zip({'visio/pages/pages.xml':`<Pages ${NS}>${pages}</Pages>`,'visio/pages/_rels/pages.xml.rels':rels(['page1.xml']),'visio/pages/page1.xml':shared});
 const {pages:read,lost}=await visioPages(bytes,'shared.vsdx');
 assert.equal(read.length,MAX_VISIO_PAGES);
 assert.equal(lost.get(`foreground page(s) beyond the first ${MAX_VISIO_PAGES} not read`),40);
 // The reader counts each part once, however often it is asked for.
 const reader=partReader(bytes,zipEntries(bytes));
 for(let i=0;i<5;i++)await reader.text('visio/pages/page1.xml');
 assert.equal(reader.used,Buffer.byteLength(shared));
});

test('Visio: the parts read by one import share a total budget, refused through the import error path',async()=>{
 const bytes=zip({a:'x'.repeat(600),b:'y'.repeat(600)}),entries=zipEntries(bytes);
 const reader=partReader(bytes,entries,1000,'too much');
 assert.equal(await reader.text('a'),'x'.repeat(600));
 await assert.rejects(reader.text('b'),(e:unknown)=>e instanceof InflateLimitError&&/too much/.test(String(e)));
 assert.equal(await reader.text('a'),'x'.repeat(600),'a part already read stays readable');
 assert.equal(reader.used,600);
 // Three distinct 22 MiB page parts pass the 64 MiB package budget together; the third is refused before it is inflated.
 const body=`<PageContents ${NS}>${' '.repeat(22*MiB)}</PageContents>`;
 const big=zip({'visio/pages/pages.xml':`<Pages ${NS}>${[1,2,3].map(i=>`<Page ID='${i}' Name='P${i}'><Rel r:id='rId${i}'/></Page>`).join('')}</Pages>`,
  'visio/pages/_rels/pages.xml.rels':rels(['page1.xml','page2.xml','page3.xml']),'visio/pages/page1.xml':body,'visio/pages/page2.xml':body,'visio/pages/page3.xml':body});
 const input=new Uint8Array(big);
 await assert.rejects(importVisio(input,'big.vsdx',opts),/big\.vsdx expands to more than 64 MiB of Visio parts\. Nothing was imported\./);
 assert.deepEqual(input,big,'the picked bytes are not changed');
});

test('import dialog: files above their documented limit are refused before reading, with a message naming the limit',()=>{
 assert.equal(importFileLimit('project.json').bytes,MAX_DOCUMENT_BYTES);
 assert.equal(importFileLimit('flow.MMD').bytes,MAX_DOCUMENT_BYTES);
 assert.equal(importFileLimit('arch.drawio').bytes,MAX_DOCUMENT_BYTES);
 assert.equal(importFileLimit('arch.drawio.svg').bytes,MAX_DOCUMENT_BYTES);
 assert.equal(importFileLimit('arch.drawio.png').bytes,MAX_PACKAGE_FILE_BYTES);
 assert.equal(importFileLimit('plan.VSDX').bytes,MAX_PACKAGE_FILE_BYTES);
 assert.doesNotThrow(()=>checkImportFileSize({name:'project.json',size:MAX_DOCUMENT_BYTES}));
 assert.throws(()=>checkImportFileSize({name:'project.json',size:MAX_DOCUMENT_BYTES+1}),/project\.json is 12 MiB: a JSON document is imported up to 12 MiB\. Nothing was read or imported\./);
 assert.throws(()=>checkImportFileSize({name:'flow.mmd',size:13*MiB}),/a Mermaid diagram is imported up to 12 MiB/);
 assert.throws(()=>checkImportFileSize({name:'plan.vsdx',size:17*MiB}),/plan\.vsdx is 17 MiB: a Visio drawing is imported up to 16 MiB/);
 assert.doesNotThrow(()=>checkImportFileSize({name:'plan.vsdx',size:15*MiB}));
 // App.tsx calls the helper once, before any read of the picked file.
 const app=readFileSync('src/App.tsx','utf8'),at=app.indexOf('checkImportFileSize(file)');
 assert.ok(at>0&&app.indexOf('checkImportFileSize(file)',at+1)<0);
 const handler=app.slice(at);
 for(const read of ['file.arrayBuffer()','file.text()'])assert.ok(handler.indexOf(read)>0,`${read} comes after the size check`);
 assert.ok(!app.includes("throw new Error('File exceeds 16 MiB')"));
});

test('AI guide: an add at <member>/- creates an absent optional array instead of replacing a hidden one',()=>{
 const guide=readFileSync('docs/AI_GUIDE.md','utf8');
 assert.match(guide,/`add` at `<member>\/-`/);
 assert.deepEqual(applyOperations({title:'x'},[{op:'add',path:'/learningMappings/-',value:{id:'m1'}}]),{title:'x',learningMappings:[{id:'m1'}]});
 assert.deepEqual(applyOperations({learningMappings:[{id:'hidden'}]},[{op:'add',path:'/learningMappings/-',value:{id:'m1'}}]),{learningMappings:[{id:'hidden'},{id:'m1'}]});
});
