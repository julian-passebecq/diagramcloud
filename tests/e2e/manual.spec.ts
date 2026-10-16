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

/* Print legibility of a dense classic manual (paginated figures) at A4 and Letter content widths, print media emulated:
 * every figure line inside its own figure with the real font (a cut footer is a lost fact), every heading kept with what
 * follows it, every publication page and figure short enough to stay whole on one sheet. */
test('dense classic manual prints legibly on A4 and Letter: figure text inside each figure, headings kept with their content',async({browser},info)=>{
 const {technicalManualHtml}=await import('../../src/export/manual');
 const {validatePublicationBrief}=await import('../../src/intelligence/publicationBrief');
 const {denseFixture,DENSE_LONG_ID,DENSE_NOTE}=await import('../helpers/denseFixture');
 const d=denseFixture(),before=JSON.stringify(d),mm=(v:number)=>v*96/25.4;
 for(const [paper,w,h] of [['A4',210,297],['letter',215.9,279.4]] as const){
  const brief=validatePublicationBrief({format:'diagramcloud.publication-brief/1',title:'Synthetic dense print handbook',audience:'Synthetic reviewer',viewIds:['root'],profile:'classic',paper,detail:'full'},d);
  const html=technicalManualHtml(d,{brief,now:new Date('2026-10-16T00:00:00Z')}),contentW=Math.floor(mm(w-28)),contentH=Math.floor(mm(h-32));
  const ctx=await browser.newContext({offline:true,viewport:{width:contentW,height:contentH}});
  try{
   const page=await ctx.newPage();await page.setContent(html);await page.emulateMedia({media:'print'});
   await expect(page.locator('.publication-page')).toHaveCount(2);
   const ledger=page.getByRole('table',{name:'Keyed connection context of Synthetic dense supplied flow',exact:true}).getByRole('row').filter({has:page.getByRole('cell',{name:DENSE_LONG_ID,exact:true})});
   for(const fact of ['0','rows/day','synthetic',DENSE_NOTE])await expect(ledger.getByRole('cell',{name:fact,exact:true})).toHaveCount(1);
   const report=await page.evaluate(({contentH})=>{
    const cut:string[]=[];
    for(const svg of document.querySelectorAll<SVGSVGElement>('figure > svg')){
     const vb=svg.viewBox.baseVal,r=svg.getBoundingClientRect(),s=Math.min(r.width/vb.width,r.height/vb.height),x0=r.left+(r.width-vb.width*s)/2,y0=r.top+(r.height-vb.height*s)/2;
     for(const t of svg.querySelectorAll('text')){const b=t.getBoundingClientRect();if(b.left<x0-1||b.right>x0+vb.width*s+1||b.top<y0-1||b.bottom>y0+vb.height*s+1)cut.push(`${(t.textContent??'').slice(0,60)} [${Math.round(b.left)}..${Math.round(b.right)}] figure [${Math.round(x0)}..${Math.round(x0+vb.width*s)}]`);}
    }
    const loose=[...document.querySelectorAll('h1,h2,h3,h4')].filter(e=>getComputedStyle(e).breakAfter!=='avoid').map(e=>e.textContent);
    const split=[...document.querySelectorAll('.publication-page,figure')].filter(e=>getComputedStyle(e).breakInside!=='avoid').map(e=>e.className||e.tagName);
    const tall=[...document.querySelectorAll('.publication-page,figure')].map(e=>({e:e.className||e.tagName,h:e.getBoundingClientRect().height})).filter(x=>x.h>contentH);
    return {cut,loose,split,tall,figures:document.querySelectorAll('figure > svg').length};
   },{contentH});
   expect(report.figures).toBe(2);
   expect(report.cut,`${paper}: figure text cut by its figure`).toEqual([]);
   expect(report.loose,`${paper}: headings that may sit alone at a page foot`).toEqual([]);
   expect(report.split,`${paper}: figures or publication pages that may split`).toEqual([]);
   expect(report.tall,`${paper}: blocks taller than one ${paper} sheet`).toEqual([]);
   const pdf=info.outputPath(`dense-classic-${paper}.pdf`);await page.pdf({path:pdf,format:paper==='A4'?'A4':'Letter',preferCSSPageSize:true,printBackground:true});
   expect(readFileSync(pdf).subarray(0,5).toString()).toBe('%PDF-');
  }finally{await ctx.close();}
 }
 expect(JSON.stringify(d)).toBe(before);
});
/* Dense connection ledgers at real print widths: the 16mm x 14mm @page margins leave 182mm (A4) and 187.9mm (Letter) of
 * content, i.e. 688 and 710 CSS px. Every word and header stays whole (only opaque ID cells may wrap mid-token), nothing
 * overflows its cell and every cell keeps visible padding, so neighbouring facts such as "planned" and "0" never touch. */
async function denseQuantityManual(paper:'A4'|'letter'){
 const {documentSchema,validateDocument}=await import('../../src/core/model');const {technicalManualHtml}=await import('../../src/export/manual');const {validatePublicationBrief}=await import('../../src/intelligence/publicationBrief');const {publicationPages}=await import('../../src/export/publicationPages');
 const longId='zero-'+'z'.repeat(75),note='Synthetic supplied zero across a publication page; no measured result.',ids=Array.from({length:9},(_,i)=>'n'+i);if(longId.length!==80)throw new Error('Synthetic fixture must use an 80-character stable ID');
 const project=validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-dense-quantity-print',title:'Synthetic dense quantity print',rootViewId:'root',privateNotes:'PRIVATE_DENSE_PRINT_NOTES',nodes:[...ids.map(id=>({id,label:'Synthetic '+id,basis:'planned'})),{id:'secret',label:'PRIVATE_DENSE_PRINT_NODE',visibility:'private'}],edges:[{id:longId,source:'n7',target:'n8',label:'Supplied zero boundary',basis:'planned',quantity:{value:0,unit:'rows/day',provenance:'synthetic',note}},{id:'missing-edge',source:'n0',target:'n1',label:'No supplied amount',basis:'unknown'},{id:'private-edge',source:'n0',target:'secret',quantity:{value:9,unit:'PRIVATE_DENSE_PRINT_UNIT',provenance:'author',note:'PRIVATE_DENSE_PRINT_QUANTITY'}}],views:[{id:'root',title:'Synthetic dense supplied flow',nodeIds:[...ids,'secret'],edgeIds:[longId,'missing-edge','private-edge'],positions:Object.fromEntries([...ids.map((id,i)=>[id,{x:i*300,y:0}]),['secret',{x:0,y:300}]])}]}));
 const brief=validatePublicationBrief({format:'diagramcloud.publication-brief/1',title:'Synthetic dense quantity handbook',audience:'Synthetic reviewer',viewIds:['root'],profile:'classic',paper,detail:'full'},project);
 const plan=publicationPages(project,'root',['root'],{profile:brief.profile,paper:brief.paper});if(!plan.dense||!plan.contextEdges.some(e=>e.id===longId))throw new Error('Synthetic fixture must take the dense paginated path with the long ID in the context table');
 return {html:technicalManualHtml(project,{brief,now:new Date(1792023600*1000)}),longId,note};
}
for(const [paper,width] of [['A4',688],['letter',710]] as const)test(`dense manual connection ledgers stay legible in ${paper} print: whole words and headers, padded cells, every fact`,async({browser},info)=>{
 const {html,longId,note}=await denseQuantityManual(paper);expect(html).not.toContain('PRIVATE_DENSE_PRINT_');expect(html).not.toContain('private-edge');
 const context=await browser.newContext({offline:true,viewport:{width,height:1100}});try{const reader=await context.newPage(),requests:string[]=[];await reader.route('**/*',r=>{requests.push(r.request().url());return r.abort();});await reader.setContent(html);await reader.emulateMedia({media:'print'});
  for(const name of ['Keyed connection context of Synthetic dense supplied flow','Connections of Synthetic dense supplied flow']){const row=reader.getByRole('table',{name,exact:true}).getByRole('row').filter({has:reader.getByRole('cell',{name:longId,exact:true})});const cells=await row.locator('td').allTextContents();expect(cells).toHaveLength(10);for(const fact of [longId,'Supplied zero boundary','planned','0','rows/day','synthetic',note])expect(cells).toContain(fact);}
  await expect(reader.getByRole('table',{name:'Connections of Synthetic dense supplied flow',exact:true}).getByRole('row').filter({has:reader.getByRole('cell',{name:'missing-edge',exact:true})})).toContainText('Not supplied');
  const problems=await reader.evaluate(()=>{const out:string[]=[],page=document.documentElement.clientWidth,tables=[...document.querySelectorAll<HTMLTableElement>('table.connection-facts')];if(tables.length<2)out.push(`expected two dense ledgers, found ${tables.length}`);
   for(const table of tables){const box=table.getBoundingClientRect();if(getComputedStyle(table.tHead!).display!=="table-header-group")out.push(`${table.getAttribute("aria-label")}: header does not repeat on continued print pages`);if(box.right>page+0.5||table.scrollWidth>table.clientWidth)out.push(`${table.getAttribute('aria-label')}: wider than the printable width`);
    for(const cell of table.querySelectorAll<HTMLElement>('th,td')){const where=`${table.getAttribute('aria-label')} / ${cell.tagName} "${cell.textContent?.slice(0,30)}"`,style=getComputedStyle(cell),rect=cell.getBoundingClientRect(),pl=parseFloat(style.paddingLeft),pr=parseFloat(style.paddingRight);
     if(pl<4||pr<4)out.push(`${where}: horizontal padding below 4px`);if(cell.scrollWidth>cell.clientWidth)out.push(`${where}: overflows its cell`);
     const walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);for(let text=walker.nextNode() as Text|null;text;text=walker.nextNode() as Text|null){for(const word of text.data.matchAll(/\S+/g)){const range=document.createRange();range.setStart(text,word.index!);range.setEnd(text,word.index!+word[0].length);const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0);
      if(!cell.classList.contains('opaque-id')&&new Set(rects.map(r=>Math.round(r.top))).size>1)out.push(`${where}: word "${word[0]}" broken across lines`);
      for(const r of rects)if(r.left<rect.left+pl-0.5||r.right>rect.right-pr+0.5)out.push(`${where}: "${word[0]}" touches or crosses the cell padding`);}}}}
   return out;});
  expect(problems).toEqual([]);
  const pdf=await reader.pdf({path:info.outputPath(`dense-classic-${paper}.pdf`),preferCSSPageSize:true,printBackground:true});expect(pdf.subarray(0,5).toString()).toBe('%PDF-');expect(requests).toEqual([]);
 }finally{await context.close();}
});
