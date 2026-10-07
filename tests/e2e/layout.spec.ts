import {test,expect,type Locator} from '@playwright/test';
import {mkdirSync} from 'node:fs';

type Box={id:string;x:number;y:number;w:number;h:number};
/** Node boxes in flow coordinates: React Flow's translate() plus the rendered card size. */
const boxes=(view:Locator)=>view.locator('.react-flow__node').evaluateAll(els=>els.map(el=>{const e=el as HTMLElement,m=/translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(e.style.transform);
 return {id:e.dataset.id??'',x:m?Number(m[1]):NaN,y:m?Number(m[2]):NaN,w:e.offsetWidth,h:e.offsetHeight};}));
const byId=(b:Box[])=>Object.fromEntries(b.map(x=>[x.id,{x:x.x,y:x.y}]));
const overlapping=(b:Box[])=>b.flatMap((a,i)=>b.slice(i+1).filter(c=>Math.min(a.x+a.w,c.x+c.w)-Math.max(a.x,c.x)>1&&Math.min(a.y+a.h,c.y+c.h)-Math.max(a.y,c.y)>1).map(c=>`${a.id}/${c.id}`));

test('Auto layout places the view in layers without overlap, as one undoable edit',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 const view=page.getByTestId('view-overview');await expect(view).toBeVisible();
 await expect(view.getByRole('button',{name:'Auto layout',exact:true})).toHaveCount(0);// Edit mode only, like Grid layout
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 const before=await boxes(view);expect(before.length).toBeGreaterThan(2);
 await view.getByRole('button',{name:'Auto layout',exact:true}).click();
 await expect(page.getByText(/layered layout from the connections/)).toBeVisible();
 await expect.poll(async()=>JSON.stringify(byId(await boxes(view)))).not.toBe(JSON.stringify(byId(before)));
 const after=await boxes(view);
 expect(after.map(b=>b.id).sort()).toEqual(before.map(b=>b.id).sort());
 expect(after.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y))).toBe(true);
 expect(overlapping(after)).toEqual([]);
 mkdirSync('test-results/layout',{recursive:true});await page.waitForTimeout(300);
 await view.screenshot({path:'test-results/layout/auto-layout.png'});
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect.poll(async()=>JSON.stringify(byId(await boxes(view)))).toBe(JSON.stringify(byId(before)));
 expect(errors).toEqual([]);
});
