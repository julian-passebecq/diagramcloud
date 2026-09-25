import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {samples} from '../src/data/samples';
import {publicDocument} from '../src/core/operations';
import {measureLines,textWidth} from '../src/export/measure';
import {buildScene,crosses,routeAround,type SceneText} from '../src/export/scene';
import {svgDiagram} from '../src/export/diagram';
import {portfolioHtml} from '../src/export/html';
import {buildDeck,projectPlan} from '../src/export/deck';
import {ICON_REGISTRY} from '../src/core/icons';
import {fileIcons,gitBlobId} from '../scripts/icons';

const docs=samples.map(s=>publicDocument(s)),fabric=samples.find(s=>s.id==='fabric-medallion')!,icons=fileIcons();
const lakehouse=ICON_REGISTRY.find(e=>e.id==='fabric-lakehouse')!;
const xmlText=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

test('Arial metrics: every printable ASCII character has a width, and known strings measure correctly',()=>{
 for(let c=32;c<=126;c++){const ch=String.fromCharCode(c);assert(Number.isFinite(textWidth(ch,10))&&textWidth(ch,10)>0,ch);assert(textWidth(ch,10,true)>0,ch);}
 assert.equal(textWidth('Hello',10).toFixed(2),'22.78');
 assert(textWidth('SQL quality checks',14,true)>textWidth('SQL quality checks',14));
});

test('line breaking: at spaces, then slashes or hyphens, then characters; overflow ends with a fitting ellipsis',()=>{
 const w=textWidth('alpha beta',10);
 assert.deepEqual(measureLines('alpha beta gamma',w,{size:10}).lines,['alpha beta','gamma']);
 assert.deepEqual(measureLines('scene/document model',60,{size:10}).lines,['scene/','document','model']);
 const long=measureLines('a'.repeat(40),50,{size:10});assert(long.lines.every(l=>textWidth(l,10)<=50));
 const cut=measureLines('one two three four five six seven',40,{size:10},2);
 assert.equal(cut.truncated,true);assert.equal(cut.lines.length,2);assert(cut.lines[1].endsWith('…'));assert(textWidth(cut.lines[1],10)<=40);
});

test('every scene in every sample fits: lines within their width, text inside its box, icon slot square',()=>{
 const within=(t:SceneText)=>t.lines.every(l=>textWidth(l,t.size,t.bold)<=t.width+.01);
 for(const d of docs)for(const v of d.views){
  const scene=buildScene(d,v);
  for(const n of scene.nodes){
   for(const t of [n.provider,n.label,n.summary,n.footer]){assert(within(t),`${d.id}/${v.id}/${n.id}`);
    const last=t.y+(t.lines.length-1)*t.lineHeight;assert(t.y-t.size>=n.y&&last<=n.y+n.h,`${d.id}/${n.id} text leaves its box`);}
   assert(n.label.lines.length<=2);assert(n.summary.lines.length<=(n.label.lines.length>1?1:2));
   if(n.icon){assert.equal(n.icon.entry.origin,'vendor');assert(n.icon.x+n.icon.size<=n.x+n.w&&n.icon.y+n.icon.size<=n.y+n.h);}
  }
  for(const e of scene.edges)if(e.label){assert(within(e.label),`${d.id}/${e.id}`);
   const inBox=scene.nodes.some(n=>e.label!.x>n.x+1&&e.label!.x<n.x+n.w-1&&e.label!.y>n.y&&e.label!.y<n.y+n.h);assert(!inBox,`${d.id}/${e.id} label placed under a box`);}
 }
});

test('SVG draws exactly the scene lines, one tspan per line',()=>{
 for(const d of docs)for(const v of d.views){
  const svg=svgDiagram(d,v.id,false),scene=buildScene(d,v);
  for(const n of scene.nodes){const g=svg.slice(svg.indexOf(`data-node-id="${n.id}"`));
   for(const t of [n.provider,n.label,n.summary,n.footer])for(const l of t.lines)assert(g.includes(`>${xmlText(l)}</tspan>`),`${d.id}/${n.id}: ${l}`);}
 }
});

test('PowerPoint draws the same lines in Arial with wrapping off',async()=>{
 const plan=projectPlan(fabric),{pptx}=await buildDeck(PptxGenJS,plan,icons),zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}) as Buffer);
 const view=plan.architecture!.views[0],scene=buildScene(plan.architecture!,view),xml=await zip.file('ppt/slides/slide4.xml')!.async('string');
 for(const n of scene.nodes)for(const t of [n.provider,n.label,n.summary,n.footer])for(const l of t.lines)assert(xml.includes(`<a:t>${xmlText(l)}</a:t>`),`${n.id}: ${l}`);
 assert.match(xml,/typeface="Arial"/);assert.match(xml,/wrap="none"/);
});

test('vendor icons are embedded byte-identical, square, and credited; without icon bytes the slot stays empty',async()=>{
 const svg=svgDiagram(fabric,fabric.rootViewId,false,icons),m=svg.match(/<image href="data:image\/svg\+xml;base64,([^"]+)" x="[\d.]+" y="[\d.]+" width="([\d.]+)" height="([\d.]+)"/);
 assert(m,'icon embedded');assert.equal(m[2],m[3],'square, not distorted');
 assert.equal(gitBlobId(Buffer.from(m[1],'base64')),lakehouse.source!.blob,'the embedded bytes are the unmodified upstream file');
 assert.match(svg,/Icons: Microsoft Fabric Lakehouse \(Microsoft artwork, Microsoft Fabric icons usage terms\)\. Not covered by the DiagramCloud MIT licence\./);
 assert.doesNotMatch(svgDiagram(fabric,fabric.rootViewId,false),/<image|Icons:/);
 assert.match(portfolioHtml(fabric,icons),/data:image\/svg\+xml;base64,/);
 const {pptx}=await buildDeck(PptxGenJS,projectPlan(fabric),icons),zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}) as Buffer);
 const svgs=await Promise.all(Object.keys(zip.files).filter(f=>/^ppt\/media\/.*\.svg$/.test(f)).map(f=>zip.file(f)!.async('uint8array')));
 assert(svgs.length>0&&svgs.every(b=>gitBlobId(b)===lakehouse.source!.blob),'PowerPoint carries the unmodified file');
 assert.match(await zip.file('ppt/slides/slide4.xml')!.async('string'),/Not covered by the DiagramCloud MIT licence/);
});

test('routes detour around a box in the way instead of passing behind it',()=>{
 const box=(x:number,y:number)=>({x,y,w:220,h:100}),row=[box(0,0),box(300,0),box(600,0)];
 const r=routeAround({x:0,y:0},{x:600,y:0},[row[1]],row);
 assert(r.slice(1).every((z,i)=>z.x===r[i].x||z.y===r[i].y),'still orthogonal');
 assert(!r.slice(1).some((z,i)=>crosses(r[i],z,row[1])),'does not cross the middle box');
 assert.deepEqual(routeAround({x:0,y:0},{x:300,y:0},[row[2]],row),[{x:220,y:50},{x:260,y:50},{x:260,y:50},{x:300,y:50}],'unobstructed routes are unchanged');
 let crossing=0,edges=0;
 for(const d of docs)for(const v of d.views){const scene=buildScene(d,v);for(const e of scene.edges){edges++;const edge=d.edges.find(x=>x.id===e.id)!;
  const others=scene.nodes.filter(n=>n.id!==edge.source&&n.id!==edge.target);crossing+=e.points.slice(1).reduce((k,z,i)=>k+others.filter(b=>crosses(e.points[i],z,b)).length,0);
  assert(e.points.every(q=>q.x>=scene.bounds.x&&q.y>=scene.bounds.y&&q.x<=scene.bounds.x+scene.bounds.width&&q.y<=scene.bounds.y+scene.bounds.height),`${d.id}/${e.id} route leaves the page`);}}
 assert(crossing<=2,`${crossing} box crossings across ${edges} sample connections (was 136 before detours)`);
});
