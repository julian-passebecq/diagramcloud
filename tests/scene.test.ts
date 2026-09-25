import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {samples} from '../src/data/samples';
import {publicDocument} from '../src/core/operations';
import {measureLines,textWidth} from '../src/export/measure';
import {LANE_GAP,buildScene,channelRoute,crosses,labelBox,routeAround,separateLanes,simplifyRoute,type SceneText} from '../src/export/scene';
import {svgDiagram} from '../src/export/diagram';
import {portfolioHtml} from '../src/export/html';
import {buildDeck,projectPlan} from '../src/export/deck';
import {ICON_REGISTRY} from '../src/core/icons';
import {fileIcons,gitBlobId} from '../scripts/icons';

const docs=samples.map(s=>publicDocument(s)),fabric=samples.find(s=>s.id==='fabric-medallion')!,icons=fileIcons();
const vendorBlobs=['fabric-pipeline','fabric-lakehouse'].map(id=>ICON_REGISTRY.find(e=>e.id===id)!.source!.blob);
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
 const svg=svgDiagram(fabric,fabric.rootViewId,false,icons),ms=[...svg.matchAll(/<image href="data:image\/svg\+xml;base64,([^"]+)" x="[\d.]+" y="[\d.]+" width="([\d.]+)" height="([\d.]+)"/g)];
 assert.equal(ms.length,2,'pipeline and lakehouse icons embedded');for(const m of ms)assert.equal(m[2],m[3],'square, not distorted');
 assert.deepEqual(ms.map(m=>gitBlobId(Buffer.from(m[1],'base64'))),vendorBlobs,'the embedded bytes are the unmodified upstream files');
 assert.match(svg,/Icons: Microsoft Fabric Pipeline \(Microsoft artwork, Microsoft Fabric icons usage terms\); Microsoft Fabric Lakehouse \(Microsoft artwork, Microsoft Fabric icons usage terms\)\. Not covered by the DiagramCloud MIT licence\./);
 assert.doesNotMatch(svgDiagram(fabric,fabric.rootViewId,false),/<image|Icons:/);
 assert.match(portfolioHtml(fabric,icons),/data:image\/svg\+xml;base64,/);
 const {pptx}=await buildDeck(PptxGenJS,projectPlan(fabric),icons),zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}) as Buffer);
 const svgs=await Promise.all(Object.keys(zip.files).filter(f=>/^ppt\/media\/.*\.svg$/.test(f)).map(f=>zip.file(f)!.async('uint8array')));
 assert(svgs.length>0&&svgs.every(b=>vendorBlobs.includes(gitBlobId(b))),'PowerPoint carries only unmodified files');
 assert.deepEqual(new Set(svgs.map(b=>gitBlobId(b))),new Set(vendorBlobs),'both vendor icons reach PowerPoint');
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
 assert(edges>0&&crossing===0,`${crossing} box crossings across ${edges} sample connections (was 136 before detours)`);
});

test('when every candidate crosses a box, the route takes a free channel and stays orthogonal and attached',()=>{
 // A 3×3 grid, joining the two outer boxes of the middle row: straight, row-gap, column-gap and outer-lane candidates all cross a box.
 const grid=[0,180,360].flatMap(y=>[0,300,600].map(x=>({x,y,w:220,h:100}))),source=grid[3],target=grid[5];
 const obstacles=grid.filter(b=>b!==source&&b!==target),r=routeAround(source,target,obstacles,grid);
 assert.deepEqual(r,[{x:110,y:280},{x:110,y:320},{x:710,y:320},{x:710,y:280}],'a U through the gap between the lower two rows');
 assert(!grid.some(b=>r.slice(1).some((z,i)=>crosses(r[i],z,b))),'no box crossed, its own two ends included');
 assert.equal(channelRoute({x:0,y:0},{x:600,y:0},[{x:-100,y:-100,w:1000,h:400}]),undefined,'no route when every channel is covered');
});

test('no sample route passes through a box other than its own two ends',()=>{
 const found:string[]=[];
 for(const d of docs)for(const v of d.views){const scene=buildScene(d,v);
  for(const e of scene.edges){const edge=d.edges.find(x=>x.id===e.id)!;
   for(const b of scene.nodes)if(b.id!==edge.source&&b.id!==edge.target&&e.points.slice(1).some((z,i)=>crosses(e.points[i],z,b)))found.push(`${d.id}/${v.id}/${e.id} crosses ${b.id}`);}}
 assert.deepEqual(found,[]);
});

test('connection labels prefer spots off every line, their own included',()=>{
 let on=0,own=0,total=0;
 for(const d of docs)for(const v of d.views){const edges=buildScene(d,v).edges;
  for(const e of edges)if(e.label){total++;const b=labelBox(e.label),covers=(o:typeof e)=>o.points.slice(1).some((z,i)=>crosses(o.points[i],z,b));
   if(covers(e))own++;if(edges.some(o=>o!==e&&covers(o)))on++;}}
 assert(total>0&&on<=3,`${on} of ${total} labels sit on another connection's line (32 before this preference)`);
 assert.equal(own,0,'no label covers its own line (3 did before)');
});

test('connections that share a stretch get separate lanes; routes stay orthogonal and attached to their boxes',()=>{
 assert.deepEqual(simplifyRoute([{x:0,y:0},{x:5,y:0},{x:5,y:0},{x:9,y:0},{x:9,y:4}]),[{x:0,y:0},{x:9,y:0},{x:9,y:4}]);
 const [a,b]=separateLanes([[{x:0,y:50},{x:100,y:50}],[{x:40,y:50},{x:160,y:50}]]);
 assert.deepEqual([a[0].y,b[0].y],[50-LANE_GAP/2,50+LANE_GAP/2],'two lanes centred on the shared line');
 assert.deepEqual(separateLanes([[{x:0,y:50},{x:100,y:50}],[{x:100,y:50},{x:200,y:50}]])[1][0].y,50,'end-to-end is not sharing');
 type P={x:number;y:number};let shared=0;
 for(const d of docs)for(const v of d.views){const scene=buildScene(d,v);
  const segs=scene.edges.flatMap(e=>e.points.slice(1).map((z,i)=>({e:e.id,a:e.points[i],z})));
  for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++){const p=segs[i],q=segs[j];if(p.e===q.e)continue;
   const ov=(a1:number,a2:number,b1:number,b2:number)=>Math.min(Math.max(a1,a2),Math.max(b1,b2))-Math.max(Math.min(a1,a2),Math.min(b1,b2))>4,h=(g:{a:P;z:P})=>g.a.y===g.z.y;
   if(h(p)&&h(q)&&p.a.y===q.a.y&&ov(p.a.x,p.z.x,q.a.x,q.z.x))shared++;if(!h(p)&&!h(q)&&p.a.x===q.a.x&&ov(p.a.y,p.z.y,q.a.y,q.z.y))shared++;}
  for(const e of scene.edges){const ed=d.edges.find(x=>x.id===e.id)!,src=scene.nodes.find(n=>n.id===ed.source)!,tgt=scene.nodes.find(n=>n.id===ed.target)!;
   assert(e.points.slice(1).every((z,i)=>z.x===e.points[i].x||z.y===e.points[i].y),`${d.id}/${e.id} orthogonal`);
   const onSide=(q:P,b:typeof src)=>((q.x===b.x||q.x===b.x+b.w)&&q.y>=b.y&&q.y<=b.y+b.h)||((q.y===b.y||q.y===b.y+b.h)&&q.x>=b.x&&q.x<=b.x+b.w);
   assert(onSide(e.points[0],src)&&onSide(e.points.at(-1)!,tgt),`${d.id}/${e.id} attached`);}}
 assert.equal(shared,0,'no two connections draw on the same stretch (42 pairs before lane separation)');
 for(const d of docs)for(const v of d.views){const L=buildScene(d,v).edges.flatMap(e=>e.label?[labelBox(e.label)]:[]);
  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],b=L[j];assert(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),`${d.id}/${v.id}: two connection labels overlap`);}
  const nodes=buildScene(d,v).nodes;for(const a of L)assert(!nodes.some(b=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),`${d.id}/${v.id}: a connection label covers a box`);}
});
