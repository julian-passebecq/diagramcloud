import {test,expect} from '@playwright/test';
import {mkdirSync,readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

/* 1.10: the Technical Manual preset, exported from the app, read offline, narrow and printed to PDF. */
mkdirSync('test-results/manual',{recursive:true});

test('technical manual: exported from the gallery sample, readable offline and on a phone, prints to PDF',async({page,browser})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'Contoso Forecasting'}).click();
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:/Technical manual \(HTML \/ PDF\)/}).click();
 const file=await wait;expect(file.suggestedFilename()).toBe('contoso-forecasting.manual.html');
 const path=resolve('test-results/manual/contoso-forecasting.manual.html');await file.saveAs(path);
 await expect(page.getByText(/Technical manual exported/)).toBeVisible();
 expect(errors).toEqual([]);

 // Offline: a fresh context with every non-file request refused.
 const ctx=await browser.newContext({viewport:{width:1280,height:900}}),reader=await ctx.newPage(),network:string[]=[];
 await ctx.route(/^(?!file:|data:)/,r=>{network.push(r.request().url());return r.abort();});
 await reader.goto(pathToFileURL(path).href);
 await expect(reader.getByRole('heading',{level:1,name:'Contoso Forecasting'})).toBeVisible();
 const record=reader.getByRole('table',{name:'Publication record'});
 for(const text of ['snap-20261007','61353848b4e7','Public: built from the public document','15 read from source · 6 planned'])await expect(record).toContainText(text);
 const contents=reader.getByRole('navigation',{name:'Contents'});
 await expect(contents.getByRole('link')).toHaveCount(6);
 await contents.getByRole('link',{name:'Fabric App target | design'}).click();
 await expect(reader.getByRole('heading',{level:2,name:'Fabric App target | design'})).toBeInViewport();
 await expect(reader.locator('#view-fabric-target figure svg [data-node-id]')).toHaveCount(8);
 await expect(reader.getByRole('table',{name:'Components of Fabric App target | design'})).toContainText('planned');
 await reader.screenshot({path:'test-results/manual/desktop.png'});
 // Narrow screen: no horizontal page scroll (wide tables scroll inside their own box).
 await reader.setViewportSize({width:390,height:844});
 expect(await reader.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await reader.screenshot({path:'test-results/manual/narrow.png'});
 // Print: A4 PDF, one page break per section.
 await reader.emulateMedia({media:'print'});
 await reader.pdf({path:'test-results/manual/contoso-forecasting.pdf',format:'A4'});
 const pdf=readFileSync('test-results/manual/contoso-forecasting.pdf');
 expect(pdf.subarray(0,5).toString()).toBe('%PDF-');expect(statSync('test-results/manual/contoso-forecasting.pdf').size).toBeGreaterThan(20000);
 const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)??[]).length;expect(pages).toBeGreaterThanOrEqual(7);
 expect(network).toEqual([]);
 await ctx.close();
});
