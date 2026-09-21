import {test,expect} from '@playwright/test';
import {mkdirSync,readFileSync} from 'node:fs';
import {samples} from '../../src/data/samples';
import {clone} from '../../src/core/model';

test('gallery and three-level drilldown retain the architecture',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.getByRole('heading',{name:'TotalEnergies',exact:true})).toBeVisible();
 await expect(page.getByTestId('view-overview')).toBeVisible();
 await page.screenshot({path:'test-results/showcase-overview.png',fullPage:true});
 await page.getByRole('button',{name:'Explore SQL quality checks',exact:true}).click();
 await expect(page.getByTestId('view-validation')).toBeVisible();await expect(page.getByTestId('view-overview')).toBeVisible();
 await page.getByRole('button',{name:'Explore Required fields',exact:true}).click();
 await expect(page.getByTestId('view-check-detail')).toBeVisible();
 await page.getByRole('button',{name:'Explore Validation query',exact:true}).click();
 await expect(page.getByTestId('block-sql-quality')).toBeVisible();await expect(page.locator('code')).toContainText('forecast_cost_eur');
 await page.screenshot({path:'test-results/showcase-drilldown.png',fullPage:true});expect(errors).toEqual([]);
});
test('edit, undo and persistence survive reload',async({page})=>{
 await page.goto('/');await expect(page.getByRole('tab',{name:'Edit',exact:true})).toBeEnabled();await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.getByRole('button',{name:'Explore SQL quality checks',exact:true}).click();await page.getByLabel('Component label').fill('Reviewed SQL checks');await page.getByRole('button',{name:'Apply component',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explore Reviewed SQL checks',exact:true})).toBeVisible();await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explore SQL quality checks',exact:true})).toBeVisible();await page.getByRole('button',{name:'Redo',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('button',{name:'Explore Reviewed SQL checks',exact:true})).toBeVisible();
});
test('invalid imports cannot mutate the document',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON').fill('{"schemaVersion":9000}');await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.locator('.validation-error')).toBeVisible();await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByRole('heading',{name:'TotalEnergies',exact:true})).toBeVisible();
});
test('JSON, SVG, PNG, HTML and editable PowerPoint downloads',async({page,browser})=>{
 await page.goto('/');await page.getByRole('button',{name:'Export & share',exact:true}).click();mkdirSync('test-results/exports',{recursive:true});
 for(const [name,file] of [['Public JSON','total.public.json'],['SVG diagram','total.svg'],['PNG image','total.png'],['Interactive HTML','total.html'],['Editable PowerPoint','total.pptx']]){
  const downloadPromise=page.waitForEvent('download',{timeout:30000});await page.getByRole('button',{name:new RegExp('^'+name)}).click();const download=await downloadPromise;await download.saveAs(`test-results/exports/${file}`);expect(await download.failure()).toBeNull();
 }
 expect(JSON.parse(readFileSync('test-results/exports/total.public.json','utf8')).schemaVersion).toBe(1);
 expect(readFileSync('test-results/exports/total.png').subarray(1,4).toString()).toBe('PNG');expect(readFileSync('test-results/exports/total.pptx').subarray(0,2).toString()).toBe('PK');
 const context=await browser.newContext();const offline=await context.newPage();const errors:string[]=[];offline.on('pageerror',e=>errors.push(e.message));await offline.route('**/*',route=>route.abort());await offline.setContent(readFileSync('test-results/exports/total.html','utf8'));
 await expect(offline.getByRole('heading',{name:'TotalEnergies',exact:true})).toBeVisible();await offline.getByRole('button',{name:'SQL quality checks',exact:true}).click();await expect(offline.getByRole('heading',{name:'↳ What the validation task does',exact:true})).toBeVisible();await offline.screenshot({path:'test-results/showcase-offline.png',fullPage:true});expect(errors).toEqual([]);await context.close();
});
test('public portfolio omits private payload and escapes user content',async({page})=>{
 const d=clone(samples[0]);d.nodes.find(n=>n.id==='business')!.visibility='private';d.privateNotes='PRIVATE_MARKER_42';d.title='</script><script>window.HACKED=1</script>';
 await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON').fill(JSON.stringify(d));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await page.getByRole('tab',{name:'Portfolio',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explore Business inputs',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>('HACKED' in window))).toBe(false);
 await page.getByRole('button',{name:'Export & share',exact:true}).click();const promise=page.waitForEvent('download');await page.getByRole('button',{name:/^Interactive HTML/}).click();const download=await promise;const path=await download.path();const html=readFileSync(path!,'utf8');expect(html).not.toContain('PRIVATE_MARKER_42');expect(html).not.toContain('</script><script>');
});
test('reduced motion and Fabric icon loading',async({browser})=>{
 const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:1440,height:1000}});const page=await context.newPage();await page.goto('http://127.0.0.1:4173');await expect(page.getByRole('button',{name:'Enable motion',exact:true})).toBeVisible();
 await page.locator('.project-card').filter({hasText:'Microsoft Fabric'}).click();await expect(page.getByRole('heading',{name:'Microsoft Fabric',exact:true})).toBeVisible();await expect(page.locator('.official-icon')).toBeVisible();
 await expect.poll(()=>page.locator('.official-icon').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);await page.screenshot({path:'test-results/showcase-fabric.png',fullPage:true});await context.close();
});
test('mobile layout does not overflow viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByRole('heading',{name:'TotalEnergies',exact:true})).toBeVisible();const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width+2);await page.screenshot({path:'test-results/showcase-mobile.png',fullPage:true});
});


test('JSON AI preview blocks stale same-project revisions',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const editor=page.getByLabel('Project JSON');
 const current=JSON.parse(await editor.inputValue());
 current.title='Reviewed architecture';
 await editor.fill(JSON.stringify(current));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.locator('.change-preview')).toContainText('1 proposed change');
 await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeEnabled();
 current.revision+=1;
 await editor.fill(JSON.stringify(current));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.locator('.revision-warning')).toContainText('Revision mismatch');
 await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeDisabled();
});

test('a corrupt IndexedDB row does not disable healthy projects',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('tab',{name:'Edit',exact:true})).toBeEnabled();
 await page.evaluate(async()=>new Promise<void>((resolve,reject)=>{
  const request=indexedDB.open('diagramcloud-v1',1);
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
   const db=request.result,tx=db.transaction('projects','readwrite');
   tx.objectStore('projects').put({id:'corrupt-row',json:'{broken',writer:'qa',savedAt:Date.now()});
   tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
  };
 }));
 await page.reload();
 await expect(page.getByRole('heading',{name:'TotalEnergies',exact:true})).toBeVisible();
 await expect(page.getByText(/saved project could not be read/)).toBeVisible();
 await expect(page.getByRole('tab',{name:'Edit',exact:true})).toBeEnabled();
});


test('Google Drive asset vault is optional and disabled until configured',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Drive assets',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Google Drive image assets'})).toBeVisible();
 await expect(page.getByText('Optional asset vault.')).toBeVisible();
 await expect(page.getByText('Not connected')).toBeVisible();
 await expect(page.getByRole('button',{name:'Connect Google Drive',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Choose image from Drive',exact:true})).toBeDisabled();
 await expect(page.getByText(/PPTX\/HTML exports do not need a live Google token/)).toBeVisible();
});
