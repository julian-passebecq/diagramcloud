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

/** Label pills and cards on screen (one viewport transform for both). */
const labelProblems=(view:Locator)=>view.evaluate(root=>{
 const cards=[...root.querySelectorAll('.react-flow__node')].map(n=>({id:(n as HTMLElement).dataset.id,r:n.getBoundingClientRect()}));
 const labels=[...root.querySelectorAll('.edge-label')].map(l=>({el:l as HTMLElement,r:l.getBoundingClientRect()}));
 const ov=(a:DOMRect,b:DOMRect)=>Math.min(Math.min(a.right,b.right)-Math.max(a.left,b.left),Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
 const out:string[]=[];
 labels.forEach((l,i)=>{const full=l.el.dataset.full??'';
  if(!full||(l.el.textContent!==full&&l.el.title!==full))out.push(`label ${i} has no full text`);
  if(!l.r.width)return;
  for(const c of cards)if(ov(l.r,c.r)>0)out.push(`"${full}" overlaps card ${c.id}`);
  labels.slice(i+1).forEach(m=>{if(m.r.width&&ov(l.r,m.r)>2)out.push(`"${full}" overlaps "${m.el.dataset.full}"`);});});
 return {out,count:labels.length,visible:labels.filter(l=>l.r.width>0).length};});

for(const sample of ['Contoso Forecasting','TotalEnergies','Datapass | project architecture map'])
 test(`connection labels never sit under a card: ${sample}`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.locator('.project-card').filter({hasText:sample}).first().click();
  const view=page.locator('[data-testid^="view-"]').first();await expect(view).toBeVisible();
  await expect(view.locator('.react-flow__edge-path').first()).toBeAttached();
  await expect.poll(async()=>routeProblems(await edgeInfo(view),await boxes(view))).toEqual([]);
  await expect.poll(async()=>(await labelProblems(view)).out).toEqual([]);
  const r=await labelProblems(view);expect(r.count).toBeGreaterThan(0);expect(r.visible).toBeGreaterThan(0);
  mkdirSync('test-results/routes',{recursive:true});await page.waitForTimeout(300);
  await view.screenshot({path:`test-results/routes/labels-${sample.replace(/[^a-z]+/gi,'-').toLowerCase()}.png`});
  expect(errors).toEqual([]);
 });


import {documentSchema,validateDocument} from '../../src/core/model';
const nativeLabelText='Synthetic parallel relation with complete explanatory text';
function nativeLabelProject(){return validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-native-labels',revision:0,title:'Synthetic native connection label scope',rootViewId:'root',nodes:[{id:'left',label:'Synthetic left',kind:'app',childViewId:'child',basis:'planned'},{id:'right',label:'Synthetic right',kind:'app',basis:'planned'},{id:'code',label:'Synthetic label implementation',kind:'function',basis:'planned'},{id:'private-node',label:'SYNTHETIC_PRIVATE_LABEL_NODE',visibility:'private'}],edges:[{id:'edge-00',source:'left',target:'right',label:nativeLabelText,kind:'dependency',basis:'planned',quantity:{value:0,unit:'events/day',provenance:'synthetic'}},{id:'edge-01',source:'left',target:'right',label:nativeLabelText,kind:'query',basis:'unknown'},{id:'private-edge',source:'right',target:'private-node',label:'SYNTHETIC_PRIVATE_LABEL_RELATION',visibility:'private'}],views:[{id:'root',title:'Synthetic short parallel label view',nodeIds:['left','right','private-node'],edgeIds:['edge-00','edge-01','private-edge'],positions:{left:{x:0,y:0},right:{x:300,y:0},'private-node':{x:600,y:0}}},{id:'child',title:'Synthetic retained label detail',nodeIds:['code'],edgeIds:[],positions:{code:{x:0,y:0}}}]}));}
async function nativeLabelAuthoring(page:Page){await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const text=await page.getByLabel('Project JSON',{exact:true}).inputValue();validateDocument(JSON.parse(text));await page.getByRole('button',{name:'Close dialog',exact:true}).click();return text;}
async function importNativeLabels(page:Page){await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(nativeLabelProject()));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();return nativeLabelAuthoring(page);}
async function centerLabelCanvas(view:Locator){await view.locator('.canvas-frame').evaluate(element=>element.scrollIntoView({block:'center'}));}
async function actualLabelReceiver(button:Locator){await expect.poll(()=>button.evaluate(element=>{const box=element.getBoundingClientRect(),target=document.elementFromPoint(box.x+box.width/2,box.y+box.height/2);return box.width>0&&box.height>0&&(target===element||!!target&&element.contains(target));})).toBe(true);}

test('native placed connection labels select exact short parallel edges by pointer and keyboard without changing canonical facts',async({page},info)=>{
 const before=await importNativeLabels(page);await page.getByRole('tab',{name:'Edit',exact:true}).click();const view=page.getByTestId('view-root');await view.getByRole('button',{name:'Explore Synthetic left',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByTestId('view-child')).toBeVisible();
 await centerLabelCanvas(view);await expect.poll(async()=>routeProblems(await edgeInfo(view),await boxes(view))).toEqual([]);await expect.poll(async()=>(await labelProblems(view)).out).toEqual([]);
 const zero=view.getByRole('button',{name:`Select connection edge-00: ${nativeLabelText}`,exact:true}),one=view.getByRole('button',{name:`Select connection edge-01: ${nativeLabelText}`,exact:true});await expect(zero).toBeVisible();await expect(one).toBeVisible();await expect(zero).toHaveAttribute('title',nativeLabelText);await expect(zero).toHaveAttribute('data-full',nativeLabelText);await expect(zero).toHaveAttribute('type','button');expect(await zero.evaluate(element=>{const style=getComputedStyle(element);return {fontSize:style.fontSize,lineHeight:style.lineHeight,paddingTop:style.paddingTop,paddingRight:style.paddingRight,border:style.borderTopWidth,height:(element as HTMLElement).offsetHeight,boxSizing:style.boxSizing};})).toEqual({fontSize:'9px',lineHeight:'14px',paddingTop:'1px',paddingRight:'5px',border:'0px',height:16,boxSizing:'border-box'});
 const routes=await edgeInfo(view),bounds=await view.locator('button.edge-label').evaluateAll(elements=>elements.map(element=>({id:(element as HTMLElement).dataset.edgeId,width:(element as HTMLElement).offsetWidth,height:(element as HTMLElement).offsetHeight,transform:(element as HTMLElement).style.transform})));
 const parallel=await view.evaluate(root=>['edge-00','edge-01'].map(id=>{const path=root.querySelector(`.react-flow__edge[data-id="${id}"] .react-flow__edge-interaction`) as SVGPathElement;const point=path.getPointAtLength(path.getTotalLength()/2);return {x:point.x,y:point.y,width:Number(path.getAttribute('stroke-width'))};}));expect(Math.abs(parallel[0].y-parallel[1].y)).toBeGreaterThan(0);expect(Math.abs(parallel[0].y-parallel[1].y)).toBeLessThan(20);expect(parallel.map(row=>row.width)).toEqual([20,20]);
 await actualLabelReceiver(zero);await zero.click();await expect(zero).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('combobox',{name:'Flow type',exact:true})).toHaveValue('dependency');await expect(page.getByLabel('Value',{exact:true})).toHaveValue('0');await expect(page.getByTestId('view-child')).toBeVisible();
 await one.focus();await page.keyboard.press('Space');await expect(one).toHaveAttribute('aria-pressed','true');await expect(zero).toHaveAttribute('aria-pressed','false');await expect(page.getByRole('combobox',{name:'Flow type',exact:true})).toHaveValue('query');await zero.focus();await page.keyboard.press('Enter');await expect(zero).toHaveAttribute('aria-pressed','true');expect(await edgeInfo(view)).toEqual(routes);expect(await view.locator('button.edge-label').evaluateAll(elements=>elements.map(element=>({id:(element as HTMLElement).dataset.edgeId,width:(element as HTMLElement).offsetWidth,height:(element as HTMLElement).offsetHeight,transform:(element as HTMLElement).style.transform})))).toEqual(bounds);expect(await nativeLabelAuthoring(page)).toBe(before);
 await page.getByRole('tab',{name:'Explore',exact:true}).click();await centerLabelCanvas(view);await zero.focus();await page.keyboard.press('Enter');await expect(zero).toHaveAttribute('aria-pressed','true');await expect(page.getByText('CONNECTION EDITOR',{exact:true})).toHaveCount(0);await expect(page.getByTestId('view-child')).toBeVisible();expect(await nativeLabelAuthoring(page)).toBe(before);
 await page.setViewportSize({width:390,height:844});await centerLabelCanvas(view);await one.focus();await page.keyboard.press('Enter');await expect(one).toBeFocused();await expect(one).toHaveAttribute('aria-pressed','true');const focus=await one.evaluate(element=>({style:getComputedStyle(element).outlineStyle,width:getComputedStyle(element).outlineWidth}));expect(focus.style).not.toBe('none');expect(parseFloat(focus.width)).toBeGreaterThan(0);await view.screenshot({path:info.outputPath('native-parallel-labels-390.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('tab',{name:'Portfolio',exact:true}).click();await expect(page.locator('body')).not.toContainText('SYNTHETIC_PRIVATE_LABEL');await expect(view.locator('[data-edge-id="private-edge"]')).toHaveCount(0);await expect(view.getByRole('button',{name:/Select connection edge-0[01]:/})).toHaveCount(2);expect(await nativeLabelAuthoring(page)).toBe(before);
});
