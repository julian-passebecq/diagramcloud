import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync,deflateSync} from 'node:zlib';
import {importVisio} from '../src/core/interchange/visio';
import {importDrawio,drawioPages} from '../src/core/interchange/drawio';
import {importMermaid} from '../src/core/interchange/mermaid';
import {diagramTextFromPng} from '../src/core/interchange';
import {zip} from './fixtures/interchange/visio';

const opts={idSuffix:'t1',now:new Date('2026-11-04T00:00:00Z')};
const MiB=1024*1024;

/** Rewrite the uncompressed size that the central directory declares for one part. */
function declareSize(bytes:Uint8Array,name:string,size:number):Uint8Array{
 const out=new Uint8Array(bytes),view=new DataView(out.buffer),n=new TextEncoder().encode(name);
 for(let p=0;p+46<=out.length;p++){
  if(view.getUint32(p,true)!==0x02014b50||view.getUint16(p+28,true)!==n.length)continue;
  if(out.subarray(p+46,p+46+n.length).every((b,i)=>b===n[i])){view.setUint32(p+24,size,true);return out;}
 }
 throw new Error(`no central entry for ${name}`);
}

test('Visio: a part that inflates past its declared size is refused before it is inflated whole',async()=>{
 const bomb=declareSize(zip({'visio/pages/pages.xml':'A'.repeat(8*MiB)}),'visio/pages/pages.xml',1);
 await assert.rejects(importVisio(bomb,'bomb.vsdx',opts),/visio\/pages\/pages\.xml is too large/);
 // An honest part whose real size differs from the declared size is damaged, not read.
 const xml=`<Pages xmlns='http://schemas.microsoft.com/office/visio/2012/main'/>`;
 const short=declareSize(zip({'visio/pages/pages.xml':xml}),'visio/pages/pages.xml',xml.length+5);
 await assert.rejects(importVisio(short,'short.vsdx',opts),/pages\.xml is damaged/);
});

test('draw.io: a compressed page or PNG zTXt that inflates past 12 MiB is refused with a size error',async()=>{
 const packed=deflateRawSync(Buffer.from('A'.repeat(20*MiB)));
 const raw=`<mxfile><diagram name="p">${packed.toString('base64')}</diagram></mxfile>`;
 await assert.rejects(drawioPages(raw),/larger than the 12 MiB import limit once decompressed/);
 // Several pages share one budget: two pages of 7 MiB each pass 12 MiB together.
 const half=deflateRawSync(Buffer.from('B'.repeat(7*MiB))).toString('base64');
 await assert.rejects(drawioPages(`<mxfile><diagram name="a">${half}</diagram><diagram name="b">${half}</diagram></mxfile>`),/12 MiB/);
 // PNG: a zTXt chunk "mxfile\0<method 0><zlib stream>" (CRC is not checked by the reader).
 const z=deflateSync(Buffer.from('A'.repeat(20*MiB))),key=Buffer.from('mxfile\0\0','latin1');
 const chunk=Buffer.alloc(12+key.length+z.length);chunk.writeUInt32BE(key.length+z.length,0);chunk.write('zTXt',4,'latin1');key.copy(chunk,8);z.copy(chunk,8+key.length);
 const png=new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk]));
 await assert.rejects(diagramTextFromPng(png),/12 MiB/);
 // A normal compressed page still imports.
 const model='<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" parent="1" vertex="1" value="Alpha"><mxGeometry x="0" y="0" width="80" height="40" as="geometry"/></mxCell></root></mxGraphModel>';
 const ok=await importDrawio(`<mxfile><diagram name="Ok">${deflateRawSync(Buffer.from(encodeURIComponent(model))).toString('base64')}</diagram></mxfile>`,'ok.drawio',opts);
 assert.deepEqual(ok.document.nodes.map(n=>n.label),['Alpha']);
});

test('draw.io: a cell that is its own parent, or a two-cell parent cycle, imports without hanging',async()=>{
 const self=await importDrawio('<mxGraphModel><root><object id="A" label="%x% box" x="Self"><mxCell parent="A" vertex="1"/></object><mxCell id="Z" parent="1" vertex="1" value="Other"/></root></mxGraphModel>','self.drawio',opts);
 assert.ok(self.document.nodes.some(n=>n.label==='Other'));
 assert.ok(self.report.lost.some(l=>/cyclic parent/.test(l)),self.report.lost.join(' | '));
 const pair=await importDrawio('<mxGraphModel><root><mxCell id="A" parent="B" vertex="1" value="%x%"/><mxCell id="B" parent="A" vertex="1" value="%x%"/><mxCell id="C" parent="1" vertex="1" value="Third"><mxGeometry x="400" y="0" width="80" height="40" as="geometry"/></mxCell></root></mxGraphModel>','pair.drawio',opts);
 assert.ok(pair.document.nodes.some(n=>n.label==='Third'));
 assert.ok(pair.report.lost.some(l=>/cyclic parent/.test(l)));
 // The reported case: a lone self-parented cell whose %placeholder% never resolves.
 const lone=await importDrawio('<mxGraphModel><root><mxCell id="A" parent="A" vertex="1" value="%x%"/></root></mxGraphModel>','lone.drawio',opts);
 assert.equal(lone.document.nodes.length,1);
});

test('Mermaid: & lists never build the whole source x target cross product',()=>{
 const start=Date.now();
 const repeated=importMermaid('flowchart LR\n'+'a&'.repeat(10000)+'a --> '+'b&'.repeat(10000)+'b','x.mmd',opts);
 assert.equal(repeated.document.edges.length,1,'a repeated key is one endpoint');
 const keys=(p:string)=>Array.from({length:200},(_,i)=>p+i).join('&');
 // 40,000 distinct pairs: the parse stops at its cap. One view holds at most 1000 connections, so today this
 // large import is refused by the document validator (a separate limit); it must refuse or resolve, never hang.
 try{const wide=importMermaid(`flowchart LR\n${keys('n')} --> ${keys('m')}`,'wide.mmd',opts);assert.ok(wide.document.edges.length<=1500);}
 catch(e){assert.match(String(e),/at most 1000/);}
 assert.ok(Date.now()-start<5000,'bounded parse');
});
