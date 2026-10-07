import {test,expect,type Locator,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';

type Box={id:string;x:number;y:number;w:number;h:number};
type Pt={x:number;y:number};
type Seg={kind:'L'|'Q';a:Pt;z:Pt;c?:Pt};
type EdgeInfo={id:string;route:string;d:string};

/** Node boxes in flow coordinates: React Flow's translate() plus the rendered card size. */
const boxes=(view:Locator)=>view.locator('.react-flow__node').evaluateAll(els=>els.map(el=>{const e=el as HTMLElement,m=/translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(e.style.transform);
 return {id:e.dataset.id??'',x:m?Number(m[1]):NaN,y:m?Number(m[2]):NaN,w:e.offsetWidth,h:e.offsetHeight};}));
/** Each connection's drawn path (flow coordinates, inside the same viewport transform as the nodes) and how it was routed. */
const edgeInfo=(view:Locator)=>view.locator('.react-flow__edge').evaluateAll(els=>els.map(el=>({id:el.getAttribute('data-id')??el.getAttribute('data-testid')??'',
 route:el.querySelector('g[data-route]')?.getAttribute('data-route')??'none',d:el.querySelector('path.react-flow__edge-path')?.getAttribute('d')??''})));
/** Handle centres in flow coordinates, read from the DOM and mapped back through the viewport's translate/scale. */
const handles=(view:Locator)=>view.evaluate(root=>{const vp=root.querySelector('.react-flow__viewport') as HTMLElement,flow=root.querySelector('.react-flow') as HTMLElement;
 const m=/translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\(\s*([\d.]+)\)/.exec(vp.style.transform)!,tx=Number(m[1]),ty=Number(m[2]),k=Number(m[3]),o=flow.getBoundingClientRect();
 return [...root.querySelectorAll('.react-flow__handle')].map(h=>{const r=h.getBoundingClientRect();
  return {node:(h.closest('.react-flow__node') as HTMLElement).dataset.id??'',type:h.classList.contains('source')?'source':'target',x:(r.left+r.width/2-o.left-tx)/k,y:(r.top+r.height/2-o.top-ty)/k};});});

function parse(d:string):Seg[]{
 const t=d.match(/[MLQ]|-?\d*\.?\d+(?:e-?\d+)?/g)??[],out:Seg[]=[];let i=0,at:Pt={x:NaN,y:NaN};
 const num=()=>Number(t[i++]);
 while(i<t.length){const c=t[i++];
  if(c==='M')at={x:num(),y:num()};
  else if(c==='L'){const z={x:num(),y:num()};out.push({kind:'L',a:at,z});at=z;}
  else if(c==='Q'){const ctl={x:num(),y:num()},z={x:num(),y:num()};out.push({kind:'Q',a:at,c:ctl,z});at=z;}
  else throw new Error(`unexpected path command ${c} in ${d}`);}
 return out;
}
/** Horizontal/vertical runs only, plus quarter-turn corners no larger than the export's 8 px radius. */
function orthogonalProblems(segs:Seg[]):string[]{
 return segs.flatMap((g,k)=>{const dx=Math.abs(g.z.x-g.a.x),dy=Math.abs(g.z.y-g.a.y);
  if(g.kind==='L')return dx<0.11||dy<0.11?[]:[`segment ${k} is diagonal (${dx.toFixed(1)} x ${dy.toFixed(1)})`];
  return dx<=8.11&&dy<=8.11&&Math.abs(dx-dy)<0.21?[]:[`corner ${k} is not a small quarter turn (${dx.toFixed(1)} x ${dy.toFixed(1)})`];});
}
function sample(segs:Seg[],step=2):Pt[]{
 return segs.flatMap(g=>{const len=Math.hypot(g.z.x-g.a.x,g.z.y-g.a.y),n=Math.max(1,Math.ceil(len/step));
  return Array.from({length:n+1},(_,i)=>{const u=i/n;if(g.kind==='L'||!g.c)return {x:g.a.x+(g.z.x-g.a.x)*u,y:g.a.y+(g.z.y-g.a.y)*u};
   const v=1-u;return {x:v*v*g.a.x+2*v*u*g.c.x+u*u*g.z.x,y:v*v*g.a.y+2*v*u*g.c.y+u*u*g.z.y};});});
}
const inside=(p:Pt,b:Box,m=1.5)=>p.x>b.x+m&&p.x<b.x+b.w-m&&p.y>b.y+m&&p.y<b.y+b.h-m;
const onBorder=(p:Pt,b:Box,m=1.01)=>p.x>=b.x-m&&p.x<=b.x+b.w+m&&p.y>=b.y-m&&p.y<=b.y+b.h+m&&!inside(p,b,m);
/** Every problem with the drawn routes: not scene-routed, not orthogonal, ends off a card side, or passing through a card. */
function routeProblems(edges:EdgeInfo[],nodes:Box[]):string[]{
 return edges.flatMap(e=>{if(e.route!=='scene')return [`${e.id}: drawn as ${e.route}`];const segs=parse(e.d);if(!segs.length)return [`${e.id}: empty path`];
  const start=segs[0].a,end=segs.at(-1)!.z,out=orthogonalProblems(segs).map(m=>`${e.id}: ${m}`);
  if(!nodes.some(b=>onBorder(start,b)))out.push(`${e.id}: starts off every card side at ${start.x},${start.y}`);
  if(!nodes.some(b=>onBorder(end,b)))out.push(`${e.id}: ends off every card side at ${end.x},${end.y}`);
  for(const p of sample(segs)){const hit=nodes.find(b=>inside(p,b));if(hit){out.push(`${e.id}: passes through ${hit.id} at ${p.x.toFixed(1)},${p.y.toFixed(1)}`);break;}}
  return out;});
}
async function openContoso(page:Page){
 await page.goto('/');await page.locator('.project-card').filter({hasText:'Contoso Forecasting'}).click();
 const view=page.locator('[data-testid^="view-"]').first();await expect(view).toBeVisible();
 await expect(view.locator('.react-flow__edge-path').first()).toBeAttached();return view;// a straight path has an empty box, so it never counts as visible
}

test('the canvas draws each connection along the export scene route, clear of every card',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const view=await openContoso(page);
 const count=await view.locator('.react-flow__edge').count();expect(count).toBeGreaterThan(2);
 // Routes settle once every card is measured; then they hold.
 await expect.poll(async()=>routeProblems(await edgeInfo(view),await boxes(view))).toEqual([]);
 const edges=await edgeInfo(view),nodes=await boxes(view),hs=await handles(view);
 expect(edges.some(e=>parse(e.d).some(g=>g.kind==='Q')),'rounded corners as in the export').toBe(true);
 // Coordinates map exactly (offset 0, scale 1): route ends sit on the DOM handle centres, read through the viewport transform.
 const near=(p:Pt,q:Pt)=>Math.abs(p.x-q.x)<1.5&&Math.abs(p.y-q.y)<1.5;
 const starts=edges.map(e=>parse(e.d)[0].a),ends=edges.map(e=>parse(e.d).at(-1)!.z);
 expect(starts.filter(p=>hs.some(h=>h.type==='source'&&near(p,h))).length,'a route leaves from a source handle').toBeGreaterThan(0);
 expect(ends.filter(p=>hs.some(h=>h.type==='target'&&near(p,h))).length,'a route arrives at a target handle').toBeGreaterThan(0);
 mkdirSync('test-results/routes',{recursive:true});await page.waitForTimeout(300);
 await view.screenshot({path:'test-results/routes/contoso-routes.png'});
 expect(errors).toEqual([]);
});

test('dragging a card follows the live handles, then the scene route returns after the drop',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const view=await openContoso(page);
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await expect.poll(async()=>routeProblems(await edgeInfo(view),await boxes(view))).toEqual([]);
 const before=await edgeInfo(view),nodes=await boxes(view);
 // Drag the first card up into the free band above the row, by its header.
 const node=view.locator('.react-flow__node').first(),id=nodes[0].id,box=(await node.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+12);await page.mouse.down();
 await page.mouse.move(box.x+box.width/2+10,box.y-20,{steps:6});await page.mouse.move(box.x+box.width/2+20,box.y-50,{steps:6});
 await expect.poll(async()=>(await edgeInfo(view)).filter(e=>e.route==='live').length,'connections of the dragged card use the smooth step').toBeGreaterThan(0);
 await page.mouse.up();
 await expect.poll(async()=>(await boxes(view)).find(b=>b.id===id)!.x).not.toBe(nodes[0].x);
 await expect.poll(async()=>routeProblems(await edgeInfo(view),await boxes(view))).toEqual([]);
 const after=await edgeInfo(view);
 expect(after.filter(e=>before.find(b=>b.id===e.id)?.d!==e.d).length,'routes recomputed after the drop').toBeGreaterThan(0);
 await page.waitForTimeout(300);await view.screenshot({path:'test-results/routes/contoso-after-drag.png'});
 expect(errors).toEqual([]);
});
