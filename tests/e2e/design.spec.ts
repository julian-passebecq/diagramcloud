import {test,expect} from '@playwright/test';
import {mkdirSync,readFileSync} from 'node:fs';

/* 1.12: Diagram Design mode: figure types and themes of the current public view, hints stored on the view, a design brief applied after review. */
mkdirSync('test-results/design',{recursive:true});

test('Diagram Design mode: figures, open a level, save a hint, apply a design brief, export, narrow screen',async({page})=>{
 const errors:string[]=[],network:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'Contoso Forecasting'}).click();
 const toggle=page.getByRole('button',{name:'Diagram Design',exact:true});
 await toggle.click();await expect(toggle).toHaveAttribute('aria-pressed','true');
 const preview=page.getByTestId('design-preview'),figure=preview.locator('img.design-figure');
 await expect(figure).toHaveAttribute('data-design-type','architecture');
 await expect.poll(()=>figure.evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth)).toBeGreaterThan(600);
 await page.screenshot({path:'test-results/design/architecture.png'});
 for(const type of ['layers','exploded','tree']){
  await preview.getByLabel('Figure type').selectOption(type);await expect(figure).toHaveAttribute('data-design-type',type);
  await expect.poll(()=>figure.evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth)).toBeGreaterThan(400);
  await page.screenshot({path:`test-results/design/${type}.png`});
 }
 await preview.getByLabel('Figure theme').selectOption('dark');await expect(figure).toHaveAttribute('data-theme','dark');
 await preview.getByLabel('Figure type').selectOption('exploded');
 await page.screenshot({path:'test-results/design/exploded-dark.png'});
 // Open a level: the breadcrumb keeps the parent.
 await preview.getByRole('button',{name:/Who may change a forecast/}).click();
 await expect(page.getByLabel('Diagram path').getByRole('button',{name:/Who may change a forecast/})).toBeVisible();
 await expect(page.getByLabel('Diagram path').getByRole('button',{name:/Sales Forecasting/})).toBeVisible();
 await page.getByLabel('Diagram path').getByRole('button',{name:/Sales Forecasting/}).click();
 // Edit: store the figure on the view; it survives a reload.
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await preview.getByLabel('Figure type').selectOption('layers');await preview.getByLabel('Figure theme').selectOption('editorial');
 await preview.getByRole('button',{name:'Use for this view'}).click();
 await expect(preview.getByRole('button',{name:'Use for this view'})).toBeDisabled();
 await page.reload();await page.locator('.project-card').filter({hasText:'Contoso Forecasting'}).click();
 await expect(page.getByTestId('design-preview').locator('img.design-figure')).toHaveAttribute('data-design-type','layers');
 await expect(page.getByTestId('design-preview').locator('img.design-figure')).toHaveAttribute('data-theme','editorial');
 // A design brief (as an AI agent writes it) is reviewed, then applied: only figure hints change.
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.getByTestId('design-preview').getByLabel('Read design brief').setInputFiles('docs/design-brief.example.json');
 const report=page.getByTestId('import-report');await expect(report).toContainText('Design brief');await expect(report).toContainText('4 view(s) get Diagram Design hints');
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByTestId('design-preview').locator('img.design-figure')).toHaveAttribute('data-design-type','exploded');
 await page.screenshot({path:'test-results/design/after-brief.png'});
 // Export uses the stored hint; the file is public, static and offline.
 page.on('request',r=>{if(!r.url().startsWith(new URL(page.url()).origin)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))network.push(r.url());});
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:/Diagram Design figure \(SVG\)/}).click();
 const file=await wait;expect(file.suggestedFilename()).toBe('contoso-forecasting.overview.design.svg');
 const path='test-results/design/export.svg';await file.saveAs(path);const svg=readFileSync(path,'utf8');
 expect(svg).toContain('data-design-type="exploded"');expect(svg).toContain('One save, three levels');
 expect([...svg.matchAll(/https?:\/\/[^"']+/g)].map(m=>m[0])).toEqual(['http://www.w3.org/2000/svg']);expect(svg).not.toMatch(/<script/i);
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:800});
 await expect(page.getByTestId('design-preview').locator('img.design-figure')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 await page.screenshot({path:'test-results/design/narrow.png'});
 expect(network).toEqual([]);expect(errors).toEqual([]);
});
