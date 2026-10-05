import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateDocument,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {importDiagram,interchangeFormat,diagramTextFromPng} from '../src/core/interchange';
import {importMermaid} from '../src/core/interchange/mermaid';
import {parseXml,find} from '../src/core/interchange/xml';
import {samples} from '../src/data/samples';
import {mermaidDiagram,svgDiagram} from '../src/export/diagram';
import {buildScene} from '../src/export/scene';

const fixture=readFileSync('tests/fixtures/interchange/aws-serverless.drawio','utf8');
const opts={idSuffix:'t1',now:new Date('2026-10-05T12:00:00Z')};
const byLabel=(d:Project,label:string)=>d.nodes.find(n=>n.label===label);

test('format detection: draw.io XML, editable draw.io SVG and Mermaid are recognised; JSON is left to the document importer',()=>{
 assert.equal(interchangeFormat(fixture),'drawio');
 assert.equal(interchangeFormat('<mxGraphModel><root/></mxGraphModel>'),'drawio');
 assert.equal(interchangeFormat('flowchart LR\n A-->B'),'mermaid');
 assert.equal(interchangeFormat('%% note\ngraph TD\n A-->B'),'mermaid');
 assert.equal(interchangeFormat('---\ntitle: X\n---\narchitecture-beta\n service a(server)[A]'),'mermaid');
 assert.equal(interchangeFormat('# Doc\n```mermaid\nflowchart LR\nA-->B\n```'),'mermaid');
 assert.equal(interchangeFormat('{"schemaVersion":1}'),null);
 assert.equal(interchangeFormat('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),null);
});

test('draw.io: pages, boxes, labels, stencil names, containers, frames, edge labels and losses',async()=>{
 const {document:d,report}=await importDiagram(fixture,'aws-serverless.drawio',opts);
 validateDocument(d);
 assert.match(d.id,/^import-aws-serverless-t1$/);assert.deepEqual(d.tags,['Imported','draw.io']);
 // Two pages: a root "Pages" view whose cards drill into each page.
 assert.equal(report.pages,2);assert.equal(d.views.length,3);
 const root=d.views.find(v=>v.id===d.rootViewId)!;assert.equal(root.nodeIds.length,2);
 const pageCards=root.nodeIds.map(id=>d.nodes.find(n=>n.id===id)!);
 assert.deepEqual(pageCards.map(n=>n.label),['Serverless web app','Monitoring']);
 const web=d.views.find(v=>v.id===pageCards[0].childViewId)!,mon=d.views.find(v=>v.id===pageCards[1].childViewId)!;
 // HTML labels become plain text; an unlabelled stencil is named after it; tooltips become the summary.
 assert.ok(byLabel(d,'API Gateway REST'));assert.ok(byLabel(d,'Lambda function'));assert.equal(byLabel(d,'Orders table')?.summary,'DynamoDB, on-demand capacity');
 assert.equal(byLabel(d,'Users')?.kind,'source');assert.equal(byLabel(d,'Orders table')?.kind,'storage');assert.equal(byLabel(d,'Lambda function')?.kind,'function');assert.equal(byLabel(d,'Alarm')?.kind,'control');
 assert.equal(byLabel(d,'Amazon CloudFront')?.provider,'AWS');assert.equal(byLabel(d,'Lambda function')?.provider,'AWS');
 // Vendor shapes are never redrawn as vendor artwork.
 assert.ok(d.nodes.every(n=>n.icon==='generic'));
 // The container and the drawn frame are groups (tags), not components; the free text title is not a component.
 assert.equal(byLabel(d,'Region eu-west-1'),undefined);assert.equal(byLabel(d,'Observability account'),undefined);assert.equal(byLabel(d,'Reference: serverless web application'),undefined);
 assert.deepEqual(byLabel(d,'Lambda function')?.tags,['Region eu-west-1']);assert.deepEqual(byLabel(d,'Alarm')?.tags,['Observability account']);
 assert.equal(web.nodeIds.length,5);assert.equal(mon.nodeIds.length,3);
 const labels=d.edges.map(e=>e.label).sort();assert.deepEqual(labels,['','','HTTPS','invoke','metric filter','read / write'].sort());
 assert.equal(d.edges.find(e=>e.label==='read / write')?.kind,'dependency');
 // Coordinates inside the container are absolute, the original left-to-right order survives, and no cards overlap.
 const x=(label:string)=>web.positions[byLabel(d,label)!.id].x;
 assert.ok(x('Users')<x('Amazon CloudFront')&&x('Amazon CloudFront')<x('API Gateway REST')&&x('API Gateway REST')<x('Lambda function')&&x('Lambda function')<x('Orders table'));
 for(const v of [web,mon]){const ps=Object.values(v.positions);for(const [i,a] of ps.entries())for(const b of ps.slice(i+1))assert.ok(Math.abs(a.x-b.x)>=220||Math.abs(a.y-b.y)>=100,'cards overlap');}
 const lost=report.lost.join('\n');
 assert.match(lost,/1 connection\(s\) without a box at both ends were dropped/);
 assert.match(lost,/1 free text annotation/);assert.match(lost,/vendor stencil/);assert.match(lost,/waypoint/);assert.match(lost,/colours/);
 assert.match(report.kept.join('\n'),/2 group\(s\)/);
 // The result is an ordinary document: it projects publicly and draws through the shared export scene.
 const pub=publicDocument(d);assert.equal(pub.nodes.length,d.nodes.length);
 assert.ok(buildScene(d,web).nodes.length===5);assert.match(svgDiagram(d,web.id),/Lambda function/);
});

async function deflateRaw(text:string){const s=new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));return new Uint8Array(await new Response(s).arrayBuffer());}
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));

test('draw.io: compressed pages, editable .drawio.svg and .drawio.png carry the same diagram',async()=>{
 const model=find(parseXml(fixture),'mxGraphModel')!;
 const modelXml=fixture.slice(fixture.indexOf('<mxGraphModel'),fixture.indexOf('</mxGraphModel>')+'</mxGraphModel>'.length);
 assert.ok(model);
 const compressed=`<mxfile><diagram name="Packed">${b64(await deflateRaw(encodeURIComponent(modelXml)))}</diagram></mxfile>`;
 const packed=await importDiagram(compressed,'packed.drawio',opts);
 assert.equal(packed.report.pages,1);assert.equal(packed.document.views[0].nodeIds.length,5);assert.equal(packed.document.title,'Packed');
 const esc=compressed.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const svg=`<?xml version="1.0"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x">\n<svg xmlns="http://www.w3.org/2000/svg" content="${esc}"><g/></svg>`;
 assert.equal(interchangeFormat(svg),'drawio');
 assert.equal((await importDiagram(svg,'packed.drawio.svg',opts)).document.views[0].nodeIds.length,5);
 // PNG: signature, then a tEXt chunk "mxfile\0<URI-encoded XML>" (CRC is not checked by the reader).
 const text=new TextEncoder().encode(`mxfile\0${encodeURIComponent(compressed)}`);
 const chunk=new Uint8Array(12+text.length);new DataView(chunk.buffer).setUint32(0,text.length);chunk.set(new TextEncoder().encode('tEXt'),4);chunk.set(text,8);
 const png=new Uint8Array([137,80,78,71,13,10,26,10,...chunk]);
 assert.equal((await importDiagram(await diagramTextFromPng(png),'packed.drawio.png',opts)).document.views[0].nodeIds.length,5);
 await assert.rejects(diagramTextFromPng(new Uint8Array([137,80,78,71,13,10,26,10])),/no embedded draw.io diagram/);
 await assert.rejects(importDiagram('<svg xmlns="http://www.w3.org/2000/svg" content="&lt;mxfile/&gt;"></svg>','x.svg',opts),/No boxes/);
});

test('draw.io: malformed and empty input is refused with a message, never a half-built project',async()=>{
 await assert.rejects(importDiagram('<mxfile><diagram name="A">!!!notbase64</diagram></mxfile>','bad.drawio',opts),/compressed in a form DiagramCloud cannot read/);
 await assert.rejects(importDiagram('<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>','empty.drawio',opts),/No boxes found/);
});

const flow=`---
title: Order pipeline
---
flowchart LR
  %% sources
  web([Web shop]) -->|orders| api[/REST API/]
  api --> q{{Order queue}} & audit[(Audit log)]
  subgraph proc [Processing]
    q -.->|async| worker[[Worker]]
    worker == enriched ==> dw[(Warehouse)]
  end
  dw -- nightly --> bi["Power BI report"]:::hot
  dw --> dw
  my-node-->bi
  classDef hot fill:#f00
  click bi "https://example.com"
`;

test('Mermaid flowchart: shapes, link forms, chains, & lists, subgraphs, title and losses',()=>{
 const {document:d,report}=importMermaid(flow,'pipeline.mmd',opts);
 validateDocument(d);
 assert.equal(d.title,'Order pipeline');assert.deepEqual(d.tags,['Imported','Mermaid']);
 // Mermaid IDs become stable component IDs, so a re-import keeps identities.
 assert.deepEqual(d.nodes.map(n=>n.id).sort(),['api','audit','bi','dw','my-node','q','web','worker'].sort());
 const n=(id:string)=>d.nodes.find(x=>x.id===id)!;
 assert.equal(n('api').label,'REST API');assert.equal(n('audit').kind,'storage');assert.equal(n('worker').kind,'function');assert.equal(n('bi').label,'Power BI report');assert.equal(n('bi').kind,'report');
 assert.deepEqual(n('worker').tags,['Processing']);assert.deepEqual(n('dw').tags,['Processing']);
 const edge=(s:string,t:string)=>d.edges.find(e=>e.source===s&&e.target===t);
 assert.equal(edge('web','api')?.label,'orders');assert.ok(edge('api','q'));assert.ok(edge('api','audit'));
 assert.equal(edge('q','worker')?.kind,'dependency');assert.equal(edge('q','worker')?.label,'async');
 assert.equal(edge('worker','dw')?.label,'enriched');assert.equal(edge('dw','bi')?.label,'nightly');assert.ok(edge('my-node','bi'));
 // Layered left to right: every forward edge goes rightwards.
 const v=d.views[0];for(const e of d.edges)assert.ok(v.positions[e.target].x>v.positions[e.source].x,`${e.source}→${e.target}`);
 const lost=report.lost.join('\n');
 assert.match(lost,/1 self-connection/);assert.match(lost,/classDef statements not imported/);assert.match(lost,/click statements not imported/);assert.match(lost,/class assignments not imported/);
});

test('Mermaid architecture-beta: services, groups, icons and edges',()=>{
 const src=`architecture-beta
    group api(cloud)[API]
    service db(database)[Database] in api
    service disk1(disk)[Storage] in api
    service server(server)[Server] in api
    service gateway(internet)[Gateway]
    service fn(logos:aws-lambda)[Handler]
    db:L -- R:server
    disk1:T -- B:server
    gateway:R --> L:server
    server:R --> L:fn
`;
 const {document:d,report}=importMermaid(src,'arch.mmd',opts);
 const n=(id:string)=>d.nodes.find(x=>x.id===id)!;
 assert.equal(d.nodes.length,5);assert.equal(d.edges.length,4);
 assert.equal(n('db').kind,'storage');assert.equal(n('gateway').kind,'source');assert.equal(n('fn').provider,'AWS');assert.deepEqual(n('server').tags,['API']);
 assert.match(report.lost.join('\n'),/edge side hints/);
});

test('Mermaid: our own export imports back with the same components and connections',()=>{
 for(const s of samples.filter(s=>s.category!=='Blank')){
  const out=importMermaid(mermaidDiagram(s),`${s.id}.mmd`,opts).document,view=publicDocument(s).views.find(v=>v.id===s.rootViewId)!;
  const src=publicDocument(s);
  assert.deepEqual(out.nodes.map(n=>n.label).sort(),src.nodes.filter(n=>view.nodeIds.includes(n.id)).map(n=>n.label).sort(),s.id);
  assert.equal(out.edges.length,view.edgeIds.length,s.id);
  assert.deepEqual(out.edges.map(e=>e.label).sort(),src.edges.filter(e=>view.edgeIds.includes(e.id)).map(e=>e.label).sort(),s.id);
 }
});

test('Mermaid: non-architecture diagram types are refused, not half-imported',()=>{
 assert.throws(()=>importMermaid('sequenceDiagram\n A->>B: hi','seq.mmd',opts),/“sequenceDiagram” diagrams are not imported/);
 assert.throws(()=>importMermaid('flowchart LR\n','empty.mmd',opts),/No boxes found/);
 const md=importMermaid('# Notes\n\n```mermaid\ngraph TD\n  A[Start] --> B[End]\n```\n','notes.md',opts).document;
 assert.equal(md.nodes.length,2);const v=md.views[0];assert.ok(v.positions.b.y>v.positions.a.y,'TD lays out top to bottom');
});

test('imports never collide with an existing project and never carry markup into labels',async()=>{
 const a=importMermaid('flowchart LR\n A["<b>bold</b> &amp; <i>x</i>"] --> B','same.mmd').document,b=importMermaid('flowchart LR\n A --> B','same.mmd').document;
 assert.notEqual(a.id,b.id);assert.ok(!samples.some(s=>s.id===a.id));
 assert.equal(a.nodes[0].label,'bold & x');
});

test('Mermaid: real-world forms (Kubernetes docs style, edge IDs, shape data after labels)',()=>{
 const k8s=importMermaid(`graph LR;
 client([client])-. Ingress-managed <br> load balancer .->ingress[Ingress];
 ingress-->|routing rule|service[Service];
 subgraph cluster
 ingress;
 service-->pod1[Pod];
 end`,'k8s.mmd',opts).document;
 const e=(s:string,t:string)=>k8s.edges.find(x=>x.source===s&&x.target===t);
 assert.equal(e('client','ingress')?.label,'Ingress-managed load balancer');assert.equal(e('client','ingress')?.kind,'dependency');
 assert.equal(e('ingress','service')?.label,'routing rule');assert.deepEqual(k8s.nodes.find(n=>n.id==='pod1')?.tags,['cluster']);
 const modern=importMermaid('flowchart TD\n  A@{ shape: cyl, label: "Orders DB" } --> B\n  B --> C[Topic]@{ shape: das }\n  B e1@--> D[Done]','m.mmd',opts).document;
 assert.equal(modern.nodes.find(n=>n.id==='a')?.label,'Orders DB');assert.equal(modern.nodes.find(n=>n.id==='c')?.kind,'storage');assert.equal(modern.edges.length,3);
});
