import {test,expect} from '@playwright/test';
import {mkdirSync,readFileSync} from 'node:fs';

/* 1.7: Blueprint and Editorial renderings of the same view; a blueprint canvas toggle that survives a reload. */
mkdirSync('test-results/blueprint',{recursive:true});

test('blueprint: canvas toggle persists, blueprint and editorial SVG exports carry the same components and a title block',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'AWS serverless web application'}).click();
 const toggle=page.getByRole('button',{name:'Blueprint',exact:true});
 await toggle.click();await expect(toggle).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('main.blueprint-mode')).toBeVisible();
 await page.screenshot({path:'test-results/blueprint/canvas-light.png'});
 await page.getByRole('button',{name:'Toggle theme'}).click();
 await page.screenshot({path:'test-results/blueprint/canvas-dark.png'});
 await page.reload();await expect(page.locator('main.blueprint-mode')).toBeVisible();
 await page.locator('.project-card').filter({hasText:'AWS serverless web application'}).click();
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 for(const [name,style] of [[/Blueprint drawing \(SVG\)/,'blueprint'],[/Editorial figure \(SVG\)/,'editorial']] as const){
  const wait=page.waitForEvent('download');await page.getByRole('button',{name}).click();
  const file=await wait;expect(file.suggestedFilename()).toBe(`aws-serverless-web.overview.${style}.svg`);
  const path=`test-results/blueprint/${style}.svg`;await file.saveAs(path);const svg=readFileSync(path,'utf8');
  expect(svg).toContain(`data-style="${style}"`);expect((svg.match(/data-node-id=/g)??[]).length).toBe(8);
  expect([...svg.matchAll(/https?:\/\/[^"']+/g)].map(m=>m[0])).toEqual(['http://www.w3.org/2000/svg']);
  if(style==='blueprint'){expect(svg).toContain('VIEW ID');expect(svg).toContain('REVISIONS');expect(svg).toContain('LEGEND');}
 }
 // Narrow screens: the toggle stays usable and the page does not scroll sideways.
 await page.keyboard.press('Escape');await page.setViewportSize({width:390,height:800});
 await expect(page.getByRole('button',{name:'Blueprint',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 await page.screenshot({path:'test-results/blueprint/narrow.png'});
 expect(errors).toEqual([]);
});
