import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {atlasnoteCheatsheet,atlasnoteCheatsheetJson,ATLASNOTE_LIMITS} from '../src/export/atlasnote';
import {samples} from '../src/data/samples';
import {publicDocument} from '../src/core/operations';
import {scanToDocument} from '../src/core/scan';
import type {Project} from '../src/core/model';
import {validateCheatsheet} from './contracts/atlasnote/validation.mjs';

const NOW=new Date('2026-10-06T12:00:00Z');
type Graph={id:string;type:'diagram';nodes:{id:string;label:string}[];nodeFrames:Record<string,{x:number;y:number;width:number;height:number}>;edges:{from:string;to:string;dashed?:boolean}[];caption:string};
const diagrams=(c:ReturnType<typeof atlasnoteCheatsheet>)=>c.pages.flatMap(p=>p.blocks.filter(b=>b.type==='diagram') as unknown as Graph[]);

test('AtlasNote: every sample exports a cheatsheet that passes the AtlasNote validator, one page per public view in drilldown order',()=>{
 for(const sample of samples){
  const sheet=atlasnoteCheatsheet(sample,NOW),pub=publicDocument(sample);
  assert.doesNotThrow(()=>validateCheatsheet(JSON.parse(atlasnoteCheatsheetJson(sample,NOW))),sample.id);
  assert.equal(sheet.pages[0].id,`v.${pub.rootViewId}`,sample.id);
  assert.equal(sheet.pages.filter(p=>p.id.startsWith('v.')).length,Math.min(pub.views.length,ATLASNOTE_LIMITS.pages),sample.id);
  assert.equal(sheet.pages.some(p=>p.id==='s.story'),pub.story.length>0,sample.id);
  assert.equal(sheet.meta.preset,'architecture');assert.match(sheet.meta.provenance,/Public content only/);
 }
});

test('AtlasNote: boxes keep their IDs and canvas arrangement, drilldowns are marked, private content never leaves',()=>{
 const sample=samples.find(s=>s.nodes.some(n=>n.childViewId))!;
 const pub=publicDocument(sample),root=pub.views.find(v=>v.id===pub.rootViewId)!;
 const g=diagrams(atlasnoteCheatsheet(sample,NOW))[0];
 assert.deepEqual(new Set(g.nodes.map(n=>n.id)),new Set(root.nodeIds.filter(id=>pub.nodes.some(n=>n.id===id))));
 const drill=pub.nodes.find(n=>root.nodeIds.includes(n.id)&&n.childViewId)!;
 assert.match(g.nodes.find(n=>n.id===drill.id)!.label,/ ›$/);
 // Left-to-right and top-to-bottom order of the canvas survives the scaling.
 const [a,b]=root.nodeIds.filter(id=>g.nodeFrames[id]).slice(0,2),pa=root.positions[a],pb=root.positions[b];
 if(pa&&pb&&pa.x!==pb.x)assert.equal(Math.sign(g.nodeFrames[a].x-g.nodeFrames[b].x),Math.sign(pa.x-pb.x));
 // A private node and private notes are not exported.
 const secret:Project={...sample,privateNotes:'PRIVATE-NOTE-XYZ',nodes:[...sample.nodes,{...sample.nodes[0],id:'hidden-node',label:'HIDDEN-LABEL-XYZ',visibility:'private'}],views:sample.views.map(v=>v.id===sample.rootViewId?{...v,nodeIds:[...v.nodeIds,'hidden-node']}:v)};
 const json=atlasnoteCheatsheetJson(secret,NOW);
 for(const s of ['PRIVATE-NOTE-XYZ','HIDDEN-LABEL-XYZ','hidden-node'])assert.ok(!json.includes(s),s);
});

test('AtlasNote: a scanned repository stays inside AtlasNote limits; possible links are dashed and overflow is reported, not silent',()=>{
 const ROOT='tests/fixtures/repo-shop',read=(dir:string,out:{path:string;text:string}[]=[])=>{for(const n of readdirSync(dir)){const f=join(dir,n);if(statSync(f).isDirectory())read(f,out);else out.push({path:relative(ROOT,f).replace(/\\/g,'/'),text:readFileSync(f,'utf8')});}return out;};
 const {document}=scanToDocument(read(ROOT),{now:NOW,fileName:'repo-shop'});
 const sheet=validateCheatsheet(atlasnoteCheatsheet(document,NOW));
 assert.ok(diagrams(sheet).some(g=>g.edges.some(e=>e.dashed)),'possible / dependency links are dashed');
 // A synthetic view wider than AtlasNote's 80-node diagram limit is cut to 80 with the remainder named in the caption.
 const base=samples[0],extra=Array.from({length:110},(_,i)=>({...base.nodes[0],id:`wide-${i}`,label:`Wide ${i}`,childViewId:undefined,visibility:'public' as const}));
 const big:Project={...base,nodes:[...base.nodes,...extra],views:base.views.map(v=>v.id===base.rootViewId?{...v,nodeIds:[...v.nodeIds,...extra.map(n=>n.id)],positions:{...v.positions,...Object.fromEntries(extra.map((n,i)=>[n.id,{x:(i%11)*260,y:600+Math.floor(i/11)*140}]))}}:v)};
 const wide=validateCheatsheet(atlasnoteCheatsheet(big,NOW)),over=diagrams(wide).find(g=>/more components in DiagramCloud/.test(g.caption));
 assert.ok(over,'the cut is reported');assert.equal(over!.nodes.length,ATLASNOTE_LIMITS.nodes);
 for(const g of diagrams(wide)){assert.ok(g.edges.length<=ATLASNOTE_LIMITS.edges);for(const e of g.edges)assert.ok(g.nodeFrames[e.from]&&g.nodeFrames[e.to]);}
});

test('AtlasNote: hostile labels stay plain text and the export is deterministic',()=>{
 const s=samples[0],tricky:Project={...s,title:'<script>alert(1)</script>\u0007',nodes:s.nodes.map((n,i)=>i?n:{...n,label:'A & B </text><svg onload=x>',summary:'x'.repeat(400)})};
 const sheet=validateCheatsheet(atlasnoteCheatsheet(tricky,NOW));
 assert.ok(!JSON.stringify(sheet).includes('\u0007'));
 assert.ok(diagrams(sheet)[0].nodes.some(n=>n.label.startsWith('A & B </text><svg onload=x>')),'labels are data; AtlasNote escapes them when it renders');
 assert.equal(atlasnoteCheatsheetJson(tricky,NOW),atlasnoteCheatsheetJson(tricky,NOW));
});
