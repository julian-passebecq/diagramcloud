import test from 'node:test';
import assert from 'node:assert/strict';
import {importVisio,visioPages} from '../src/core/interchange/visio';
import {importDrawio,drawioPages} from '../src/core/interchange/drawio';
import {drawioDiagram} from '../src/export/drawio';
import {samples} from '../src/data/samples';
import {publicDocument} from '../src/core/operations';
import {validateDocument} from '../src/core/model';
import {parseXml,walk} from '../src/core/interchange/xml';
import {visioFixture,zip} from './fixtures/interchange/visio';


test('Visio: pages, shape text, master names, containers, grouped icon + caption, glued and dropped connectors, losses',async()=>{
 const {pages,lost}=await visioPages(visioFixture());
 assert.deepEqual(pages.map(p=>p.title),['Overview','Messaging']);
 const [overview,messaging]=pages;
 assert.deepEqual(overview.nodes.map(n=>n.label).sort(),['Azure Key Vault','Database','Web app& API']);
 const byLabel=Object.fromEntries(overview.nodes.map(n=>[n.label,n]));
 assert.equal(byLabel.Database.kind,'storage');
 assert.equal(byLabel['Azure Key Vault'].provider,'Azure');
 assert.equal(byLabel['Web app& API'].group,'Production VNet');
 assert.deepEqual(overview.groups,['Production VNet']);
 // Visio y grows upwards: the web app (PinY 8) is drawn above the Key Vault group (PinY 5).
 assert.ok(byLabel['Web app& API'].y!<byLabel['Azure Key Vault'].y!);
 const edge=(p:typeof overview,a:string,b:string)=>p.edges.find(e=>p.nodes.find(n=>n.key===e.source)?.label===a&&p.nodes.find(n=>n.key===e.target)?.label===b);
 assert.equal(edge(overview,'Web app& API','Database')?.label,'SQL');
 assert.equal(edge(overview,'Web app& API','Azure Key Vault')?.kind,'dependency','a connector dropped on shapes without glue is attached and keeps its dashed line');
 assert.ok(edge(messaging,'Event queue','Orders service'),'an arrow drawn at the begin end points from the end shape');
 const notes=[...lost.keys()].join(' | ');
 for(const k of ['background page','free text annotation','picture','master shape','not glued'])assert.match(notes,new RegExp(k));
 const {document,report}=await importVisio(visioFixture(),'network.vsdx',{idSuffix:'t1',now:new Date('2026-10-06')});
 assert.equal(report.format,'visio');assert.equal(report.pages,2);
 assert.deepEqual(document.tags,['Imported','Visio']);
 assert.equal(document.views.length,3,'a root view of page cards plus one view per page');
 assert.doesNotThrow(()=>validateDocument(document));
});

test('Visio: binary .vsd, Visio 2003 XML, stencils and non-ZIP files are refused with a message',async()=>{
 await assert.rejects(visioPages(new Uint8Array([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]),'old.vsd'),/older binary Visio format/);
 await assert.rejects(visioPages(new TextEncoder().encode('<?xml version="1.0"?><VisioDocument xmlns="x"/>'),'d.vdx'),/Visio 2003 XML/);
 await assert.rejects(visioPages(zip({'visio/masters/masters.xml':'<Masters/>'}),'s.vssx'),/stencil/);
 await assert.rejects(visioPages(new TextEncoder().encode('hello'),'x.vsdx'),/not a Visio drawing/);
});

test('draw.io export: one page per public view, pinned orthogonal routes, page links, escaped text, no private content',async()=>{
 for(const sample of samples){
  const xml=drawioDiagram(sample,new Date('2026-10-06')),doc=parseXml(xml),pub=publicDocument(sample);
  const diagrams=[...walk(doc)].filter(e=>e.name==='diagram');
  assert.equal(diagrams.length,pub.views.length,`${sample.id}: every public view is a page`);
  assert.equal(diagrams[0].attrs.id,pub.rootViewId);
  for(const n of sample.nodes.filter(n=>n.visibility==='private'))assert.ok(!xml.includes(`dcId="${n.id}"`),`${sample.id}: private ${n.id} not exported`);
  if(sample.privateNotes)assert.ok(!xml.includes(sample.privateNotes.slice(0,40)));
  for(const link of xml.matchAll(/link="data:page\/id,([^"]+)"/g))assert.ok(diagrams.some(d=>d.attrs.id===link[1]),`${sample.id}: link to ${link[1]} has a page`);
  for(const e of [...walk(doc)].filter(e=>e.name==='mxCell'&&e.attrs.edge==='1'))assert.match(e.attrs.style,/exitX=[\d.]+;exitY=[\d.]+;.*entryX=[\d.]+;entryY=[\d.]+/);
 }
 const tricky=validateDocument({...samples[0],nodes:samples[0].nodes.map((n,i)=>i?n:{...n,label:'A <b>&"bold"</b>\nline'})});
 const out=drawioDiagram(tricky);
 assert.ok(out.includes('label="A &lt;b&gt;&amp;&quot;bold&quot;&lt;/b&gt;&#10;line"'));
});

test('draw.io round trip: our export imports back with the same IDs, labels, types, connections and drilldowns',async()=>{
 for(const sample of samples){
  const pub=publicDocument(sample),{document,report}=await importDrawio(drawioDiagram(sample),`${sample.id}.drawio`,{idSuffix:'rt'});
  assert.equal(report.lost.filter(l=>!/colours|waypoint/.test(l)).length,0,`${sample.id}: nothing else lost (${report.lost.join('; ')})`);
  const shown=new Set(pub.views.flatMap(v=>v.nodeIds)),nodes=pub.nodes.filter(n=>shown.has(n.id));
  assert.deepEqual(document.nodes.map(n=>n.id).sort(),[...new Set(nodes.map(n=>n.id))].sort(),`${sample.id}: same component IDs`);
  for(const n of document.nodes){const o=pub.nodes.find(x=>x.id===n.id)!;assert.equal(n.label,o.label);assert.equal(n.kind,o.kind);assert.equal(n.provider,o.provider);assert.equal(n.childViewId===undefined,o.childViewId===undefined,`${sample.id}/${n.id}: drilldown kept`);}
  const pairs=(d:typeof pub)=>d.views.flatMap(v=>d.edges.filter(e=>v.edgeIds.includes(e.id)).map(e=>`${e.source}>${e.target}:${e.label}:${e.kind}`)).sort();
  assert.deepEqual(pairs(document),pairs(pub),`${sample.id}: same connections`);
  assert.equal(document.views.length,pub.views.length,`${sample.id}: no extra "Pages" view when page links form a tree`);
 }
 const {pages}=await drawioPages(drawioDiagram(samples[0]));
 assert.ok(pages.every(p=>p.id));
});
