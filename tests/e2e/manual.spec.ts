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


async function compactQuantityBrowserFixture(){
 const {documentSchema,validateDocument}=await import('../../src/core/model');const edgeId='zero-'+ 'z'.repeat(75),unit='U'.repeat(24),note='Synthetic <b>not executed</b> & "quote" '.padEnd(200,'N');if(edgeId.length!==80)throw new Error('Synthetic fixture must use an 80-character stable ID');
 const project=validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-compact-quantity-browser',title:'Synthetic compact quantity handbook',privateNotes:'PRIVATE_PRINT_QUANTITY_AUTHORING',rootViewId:'root',nodes:[{id:'a',label:'Synthetic input',childViewId:'detail'},{id:'b',label:'Synthetic output'},{id:'c',label:'Other input'},{id:'d',label:'Other output'},{id:'private',label:'PRIVATE_PRINT_QUANTITY_ENDPOINT',visibility:'private'}],edges:[{id:edgeId,source:'a',target:'b',label:'Synthetic supplied amount',basis:'planned',quantity:{value:0,unit,provenance:'synthetic',note}},{id:'missing-edge',source:'a',target:'b',label:'Synthetic supplied amount',basis:'unknown'},{id:'other-edge',source:'c',target:'d',quantity:{value:7,unit:'OTHER_CHAPTER_UNIT',provenance:'reference',note:'OTHER_CHAPTER_NOTE'}},{id:'private-edge',source:'a',target:'private',quantity:{value:9,unit:'PRIVATE_PRINT_UNIT',provenance:'author',note:'PRIVATE_PRINT_QUANTITY_NOTE'}}],views:[{id:'root',title:'Compact supplied flow',nodeIds:['a','b','private'],edgeIds:[edgeId,'missing-edge','private-edge'],positions:{a:{x:0,y:0},b:{x:300,y:0},private:{x:0,y:180}}},{id:'detail',title:'Other supplied chapter',nodeIds:['c','d'],edgeIds:['other-edge'],positions:{c:{x:0,y:0},d:{x:300,y:0}}}]}));return {project,edgeId,unit,note};
}
async function importCompactQuantity(page:import('@playwright/test').Page,project:Awaited<ReturnType<typeof compactQuantityBrowserFixture>>['project']){
 await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(project));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
}
async function compactQuantityAuthoring(page:import('@playwright/test').Page){await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const value=JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue());await page.getByRole('button',{name:'Close dialog',exact:true}).click();return value;}

test('ordinary manual export keeps compact zero and missing quantities offline, escapes notes and keeps print facts without editing the Project',async({page,browser},info)=>{
 const fixture=await compactQuantityBrowserFixture();await importCompactQuantity(page,fixture.project);const before=await compactQuantityAuthoring(page);await page.getByRole('button',{name:'Export & share',exact:true}).click();const downloading=page.waitForEvent('download');await page.getByRole('button',{name:/Technical manual \(HTML \/ PDF\)/}).click();const download=await downloading,path=info.outputPath('compact-quantity.manual.html');await download.saveAs(path);const html=readFileSync(path,'utf8');expect(html).not.toContain('PRIVATE_PRINT_');expect(html).not.toContain('private-edge');expect(html).not.toContain('<b>not executed</b>');await page.getByRole('button',{name:'Close dialog',exact:true}).click();expect(await compactQuantityAuthoring(page)).toEqual(before);
 const offline=await browser.newContext({offline:true,viewport:{width:1280,height:1000}});try{const reader=await offline.newPage(),network:string[]=[];await reader.route('**/*',r=>{network.push(r.request().url());return r.abort();});await reader.setContent(html);const ledger=reader.getByRole('table',{name:'Connections of Compact supplied flow',exact:true}),zero=ledger.getByRole('row').filter({has:reader.getByRole('cell',{name:fixture.edgeId,exact:true})}),missing=ledger.getByRole('row').filter({has:reader.getByRole('cell',{name:'missing-edge',exact:true})});await expect(zero).toContainText('Amount: 0');await expect(zero).toContainText('Unit: '+fixture.unit);await expect(zero).toContainText('Provenance: synthetic');await expect(zero).toContainText('Note: '+fixture.note);await expect(missing).toContainText('Not supplied');await expect(missing).not.toContainText('Amount: 0');expect(await reader.locator('#view-root [data-publication-page]').count()).toBe(0);expect(await reader.locator('script').count()).toBe(0);await ledger.screenshot({path:info.outputPath('compact-quantity-1280.png')});
  await reader.setViewportSize({width:390,height:1000});const quantityCell=zero.getByRole('cell').last();await expect(quantityCell).toHaveAttribute('data-column-label','Quantity / provenance / note');await expect.poll(()=>quantityCell.evaluate(element=>element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(200);expect(await reader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const dimensions=await ledger.evaluate(element=>({clientWidth:element.clientWidth,scrollWidth:element.scrollWidth,rows:[...element.querySelectorAll('tr')].map(row=>{const rect=row.getBoundingClientRect();return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,cells:[...row.querySelectorAll('th,td')].map(cell=>{const box=cell.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(cell);return {left:box.left,right:box.right,top:box.top,bottom:box.bottom,clientWidth:cell.clientWidth,scrollWidth:cell.scrollWidth,nonempty:!!cell.textContent?.trim(),textRects:[...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom}))};})};})}));expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);for(const row of dimensions.rows)for(const cell of row.cells){expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth);if(cell.nonempty)expect(cell.textRects.length).toBeGreaterThan(0);for(const fragment of cell.textRects){expect(fragment.left).toBeGreaterThanOrEqual(cell.left);expect(fragment.right).toBeLessThanOrEqual(cell.right);expect(fragment.top).toBeGreaterThanOrEqual(cell.top);expect(fragment.bottom).toBeLessThanOrEqual(cell.bottom);expect(fragment.left).toBeGreaterThanOrEqual(row.left);expect(fragment.right).toBeLessThanOrEqual(row.right);expect(fragment.top).toBeGreaterThanOrEqual(row.top);expect(fragment.bottom).toBeLessThanOrEqual(row.bottom);}}await expect(zero.getByRole('cell',{name:fixture.edgeId,exact:true})).toHaveText(fixture.edgeId);await ledger.screenshot({path:info.outputPath('compact-quantity-390.png')});await reader.setViewportSize({width:794,height:1100});await reader.emulateMedia({media:'print'});await expect(zero).toContainText(fixture.note);await expect(zero).toContainText('Amount: 0');await expect(zero).toContainText('Provenance: synthetic');expect(await reader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await ledger.screenshot({path:info.outputPath('compact-quantity-a4-print-layout.png')});expect(network).toEqual([]);
 }finally{await offline.close();}
});

test('curated Business handbook retains compact quantity fields and excludes unrelated selected-out chapter in Letter print layout',async({page,browser},info)=>{
 const fixture=await compactQuantityBrowserFixture();await importCompactQuantity(page,fixture.project);const before=await compactQuantityAuthoring(page);await page.getByRole('button',{name:'Business overview',exact:true}).click();const library=page.getByLabel('Project collections and publication library',{exact:true});await library.getByText('Curated public snapshots',{exact:true}).click();await library.getByLabel('Publication title',{exact:true}).fill('Synthetic compact Business handbook');await library.getByText('Publication presentation settings',{exact:true}).click();await library.getByLabel(/^Publication profile/).selectOption('business');await library.getByLabel(/^Publication paper/).selectOption('letter');await library.getByRole('checkbox',{name:'Compact supplied flow',exact:true}).check();await library.getByRole('checkbox',{name:'Other supplied chapter',exact:true}).uncheck();await library.getByRole('button',{name:'Save immutable public snapshot',exact:true}).click();await expect(library.getByRole('status')).toContainText('Immutable public snapshot saved');const article=library.locator('article').filter({has:page.getByRole('heading',{name:'Synthetic compact Business handbook',exact:true})}),downloading=page.waitForEvent('download');await article.getByRole('button',{name:'Export curated handbook',exact:true}).click();const download=await downloading,path=info.outputPath('compact-business.manual.html');await download.saveAs(path);const html=readFileSync(path,'utf8');expect(html).not.toContain('OTHER_CHAPTER_UNIT');expect(html).not.toContain('OTHER_CHAPTER_NOTE');expect(html).not.toContain('PRIVATE_PRINT_');expect(html).toContain('data-publication-profile="business"');expect(await compactQuantityAuthoring(page)).toEqual(before);
 const offline=await browser.newContext({offline:true,viewport:{width:816,height:1056}});try{const reader=await offline.newPage(),requests:string[]=[];await reader.route('**/*',r=>{requests.push(r.request().url());return r.abort();});await reader.setContent(html);const ledger=reader.getByRole('table',{name:'Connections of Compact supplied flow',exact:true});await expect(ledger).toContainText(fixture.edgeId);await expect(ledger).toContainText('Amount: 0');await expect(ledger).toContainText('Provenance: synthetic');await expect(ledger).toContainText(fixture.note);await expect(ledger).toContainText('Not supplied');await expect(reader.locator('[data-publication-page]')).toHaveCount(0);await reader.emulateMedia({media:'print'});await expect(reader.locator('body')).toHaveAttribute('data-publication-paper','letter');await expect(ledger).toContainText('Amount: 0');await expect(ledger).toContainText(fixture.note);expect(await reader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await ledger.screenshot({path:info.outputPath('compact-business-print.png')});expect(requests).toEqual([]);
 }finally{await offline.close();}
});
