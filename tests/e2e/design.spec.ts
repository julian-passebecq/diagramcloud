import {test,expect} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {deltaPair} from '../fixtures/deltaPair';

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
 // Suggestions: three figures ranked from the view's public facts, each with its reason; one click shows it.
 const suggest=page.getByLabel('Suggested figures');await expect(suggest.getByRole('button')).toHaveCount(3);
 await suggest.getByRole('button').first().click();await expect(figure).not.toHaveAttribute('data-design-type','architecture');
 await page.getByLabel('Figure type').selectOption('auto');await expect(figure).toHaveAttribute('data-design-type','architecture');
 await expect.poll(()=>figure.evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth)).toBeGreaterThan(600);
 await page.screenshot({path:'test-results/design/architecture.png'});
 for(const type of ['layers','exploded','tree','swimlane','sequence','timeline','chart','deployment','matrix','treemap','hub','heatmap','line','context','status','lineage','radial']){
  await preview.getByLabel('Figure type').selectOption(type);await expect(figure).toHaveAttribute('data-design-type',type);
  await expect.poll(()=>figure.evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth)).toBeGreaterThan(400);
  await page.screenshot({path:`test-results/design/${type}.png`});
 }
 await preview.getByLabel('Figure theme').selectOption('dark');await expect(figure).toHaveAttribute('data-theme','dark');
 await preview.getByLabel('Figure type').selectOption('exploded');
 await page.screenshot({path:'test-results/design/exploded-dark.png'});
 // Architecture delta: compare with another version of the same project file (nothing is imported).
 writeFileSync('test-results/design/other-version.json',JSON.stringify(deltaPair().after));
 await preview.getByLabel('Compare with another version').setInputFiles('test-results/design/other-version.json');
 await expect(figure).toHaveAttribute('data-design-type','delta');
 await expect.poll(()=>figure.evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth)).toBeGreaterThan(1000);
 await page.screenshot({path:'test-results/design/delta.png'});
 await preview.getByRole('button',{name:'Close comparison'}).click();await expect(figure).not.toHaveAttribute('data-design-type','delta');
 writeFileSync('test-results/design/other-project.json',JSON.stringify({...deltaPair().after,id:'someone-else'}));
 await preview.getByLabel('Compare with another version').setInputFiles('test-results/design/other-project.json');
 await expect(preview.getByRole('alert')).toContainText('not contoso-forecasting');
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
 // Figure book: every public view as its chosen figure on one offline page; it opens without any network request.
 const waitBook=page.waitForEvent('download');await page.getByRole('button',{name:/Diagram Design figure book \(HTML\)/}).click();
 const book=await waitBook;expect(book.suggestedFilename()).toBe('contoso-forecasting.figures.html');
 const bookPath='test-results/design/figures.html';await book.saveAs(bookPath);const html=readFileSync(bookPath,'utf8');
 expect((html.match(/<svg /g)??[]).length).toBe(4);expect(html).toContain('data-design-type="exploded"');expect(html).not.toMatch(/<script/i);
 const reader=await page.context().newPage();const blocked:string[]=[];await reader.route('**/*',r=>{if(!r.request().url().startsWith('file:')){blocked.push(r.request().url());return r.abort();}return r.continue();});
 await reader.goto('file:///'+process.cwd().replace(/\\/g,'/')+'/'+bookPath);await expect(reader.locator('section svg')).toHaveCount(4);
 await reader.screenshot({path:'test-results/design/figures.png',fullPage:false});expect(blocked).toEqual([]);await reader.close();
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:800});
 await expect(page.getByTestId('design-preview').locator('img.design-figure')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 await page.screenshot({path:'test-results/design/narrow.png'});
 expect(network).toEqual([]);expect(errors).toEqual([]);
});
