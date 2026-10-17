import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import JSZip from 'jszip';
import {documentSchema} from '../../src/core/model';

/* V2 evidence figures: a Gantt from supplied dates and labelled estimates, a baseline/current comparison, and the Studio
 * note that names what is missing with the same words as the withheld figure. Synthetic fixture; nothing private shown. */
const doc=documentSchema.parse({schemaVersion:1,id:'evidence-figures-browser',title:'Evidence figures',rootViewId:'root',
 nodes:[{id:'etl',label:'Transform',kind:'process',blockIds:['plan','latency']},{id:'store',label:'Warehouse',kind:'storage'},{id:'private',label:'PRIVATE_FIGURE_SENTINEL',visibility:'private'}],
 edges:[{id:'load',source:'etl',target:'store',label:'rows'}],
 views:[{id:'root',title:'Pipeline',nodeIds:['etl','store','private'],edgeIds:['load'],positions:{etl:{x:0,y:0},store:{x:300,y:0},private:{x:0,y:200}},design:{type:'gantt'}}],
 blocks:[{id:'plan',title:'Delivery plan',type:'schedule',timezone:'date-only',provenance:'synthetic',items:[
   {id:'extract',label:'Extract history',nodeIds:['etl'],start:'2026-10-01',end:'2026-10-03',basis:'supplied'},
   {id:'model',label:'Model the warehouse',nodeIds:['store'],start:'2026-10-04',duration:'P1W',basis:'estimate'},
   {id:'secret',label:'PRIVATE_ITEM_SENTINEL',nodeIds:['private'],start:'2026-10-05',end:'2026-10-06',basis:'supplied'}]},
  {id:'latency',title:'Latency readings',type:'metrics',provenance:'synthetic',items:[
   {label:'Baseline p95',value:'420 ms',measure:{metric:'p95 latency',value:420,unit:'ms',scope:'load job',window:{from:'2026-09-01',to:'2026-09-07'},basis:'estimate',role:'baseline'}},
   {label:'Current p95',value:'380 ms',measure:{metric:'p95 latency',value:380,unit:'ms',scope:'load job',window:{from:'2026-10-01',to:'2026-10-07'},basis:'estimate',role:'current'}}]}]});
const svgOf=(page:Page)=>page.getByTestId('design-preview').locator('img.design-figure').evaluate(async(i:HTMLImageElement)=>(await fetch(i.src)).text());

test('evidence figures: Gantt and comparison drawn from supplied evidence; a withheld figure names what is missing in Studio',async({page})=>{
 const errors:string[]=[],network:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('request',r=>{if(!/^(?:https?:\/\/(?:localhost|127\.0\.0\.1)|blob:|data:)/.test(r.url()))network.push(r.url());});
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Diagram Design',exact:true}).click();
 const preview=page.getByTestId('design-preview'),figure=preview.locator('img.design-figure');
 await expect(figure).toHaveAttribute('data-design-type','gantt');await expect(preview.getByTestId('design-withheld')).toHaveCount(0);
 let svg=await svgOf(page);expect(svg).toContain('data-dd-item="extract"');expect(svg).toContain('data-dd-basis="estimate"');expect(svg).toContain('SYNTHETIC SCHEDULE');expect(svg).not.toMatch(/PRIVATE_/);
 await expect.poll(()=>figure.evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth)).toBeGreaterThan(600);await preview.screenshot({path:'test-results/evidence-gantt.png'});
 await preview.getByLabel('Figure type').selectOption('comparison');await expect(figure).toHaveAttribute('data-design-type','comparison');
 svg=await svgOf(page);expect(svg).toContain('data-dd-difference="-40"');expect(svg).toContain('A difference is not proof of causation');expect(svg).toContain('estimate-based');
 await preview.screenshot({path:'test-results/evidence-comparison.png'});
 // The connection has no quantity: the Sankey is withheld, and Studio says why with the figure's own words.
 await preview.getByLabel('Figure type').selectOption('sankey');await expect(figure).toHaveAttribute('data-design-type','sankey');
 const note=preview.getByTestId('design-withheld');await expect(note).toHaveAttribute('data-withheld','sankey');await expect(note).toHaveAttribute('role','note');
 await expect(note).toContainText('Sankey flow figure withheld');await expect(note).toContainText('Connection quantities with units');await expect(note).toContainText('Architecture (relationship diagram)');
 svg=await svgOf(page);expect(svg).toContain('data-dd-withheld="sankey"');expect(svg).toContain('Connection quantities with units');
 await preview.getByLabel('Figure type').selectOption('gantt');await expect(note).toHaveCount(0);
 // A narrow phone screen keeps the note readable without horizontal page scroll.
 await page.setViewportSize({width:390,height:844});await preview.getByLabel('Figure type').selectOption('sankey');await expect(note).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 expect(errors).toEqual([]);expect(network).toEqual([]);
});

test('evidence figures: the Diagram Design deck carries the Gantt as a picture with its alt text and nothing private',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Export & share',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:/Diagram Design deck \(PowerPoint\)/}).click();
 const file=await download,path='test-results/evidence-figures.pptx';await file.saveAs(path);
 const zip=await JSZip.loadAsync(readFileSync(path)),slides=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)),xml=(await Promise.all(slides.map(n=>zip.file(n)!.async('string')))).join('\n');
 expect(xml).toContain('Gantt (supplied dates or labelled estimates)');expect(xml).toMatch(/descr="[^"]*Gantt of 2 schedule item\(s\) on the public view root/);expect(xml).not.toContain('PRIVATE_');
 expect(Object.keys(zip.files).some(n=>/^ppt\/media\/.*\.png$/.test(n))).toBe(true);
});
