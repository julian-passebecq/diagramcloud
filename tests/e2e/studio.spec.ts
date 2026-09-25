import {test,expect} from '@playwright/test';
import {mkdirSync,readFileSync} from 'node:fs';
import {samples} from '../../src/data/samples';
import {clone} from '../../src/core/model';
const total=samples.find(d=>d.id==='total-project-controls')!;

test('gallery and three-level drilldown retain the architecture',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.getByRole('heading',{name:'Data Projects | constellation',exact:true})).toBeVisible();
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
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

test('Datapass map drills from overall architecture to BigQuery task rows',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Data Projects | constellation',exact:true})).toBeVisible();
 await page.locator('.project-card').filter({hasText:'Datapass | project architecture map'}).click();
 await expect(page.getByRole('heading',{name:'Datapass | project architecture map',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Explore Foil data platform',exact:true}).click();
 await expect(page.getByTestId('view-foil-platform')).toBeVisible();
 await page.getByRole('button',{name:'Explore BigQuery historical analytics',exact:true}).click();
 await expect(page.getByTestId('view-bigquery-detail')).toBeVisible();
 await page.getByRole('button',{name:'Explore foil.telemetry_history',exact:true}).click();
 await expect(page.getByTestId('view-bq-telemetry-table')).toBeVisible();
 await page.getByRole('button',{name:'Explore Historical SQL task',exact:true}).click();
 await expect(page.getByTestId('block-bq-history-sql')).toContainText('AVG(power_kw)');
});


test('project constellation drills into implemented Contoso and Atlas architectures',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Data Projects | constellation',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Explore Core learning products',exact:true}).click();
 await expect(page.getByTestId('view-core-products')).toBeVisible();
 await page.getByRole('button',{name:'Explore Contoso Data Studio',exact:true}).click();
 await expect(page.getByTestId('view-contoso-product')).toBeVisible();
 await page.getByRole('button',{name:'Explore DuckLake Bronze',exact:true}).click();
 await expect(page.getByTestId('view-contoso-models')).toBeVisible();
 await page.getByRole('button',{name:'Explore gold.monthly_sales',exact:true}).click();
 await expect(page.getByText('contoso.gold.monthly_sales',{exact:true}).first()).toBeVisible();
});

test('edit, undo and persistence survive reload',async({page})=>{
 await page.goto('/');await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();await expect(page.getByRole('tab',{name:'Edit',exact:true})).toBeEnabled();await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.getByRole('button',{name:'Explore SQL quality checks',exact:true}).click();await page.getByLabel('Component label').fill('Reviewed SQL checks');await page.getByRole('button',{name:'Apply component',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explore Reviewed SQL checks',exact:true})).toBeVisible();await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explore SQL quality checks',exact:true})).toBeVisible();await page.getByRole('button',{name:'Redo',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();await page.reload();await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();await expect(page.getByRole('button',{name:'Explore Reviewed SQL checks',exact:true})).toBeVisible();
});
test('invalid imports cannot mutate the document',async({page})=>{
 await page.goto('/');await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON').fill('{"schemaVersion":9000}');await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.locator('.validation-error')).toBeVisible();await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByRole('heading',{name:'TotalEnergies',exact:true})).toBeVisible();
});
test('JSON, SVG, PNG, HTML and editable PowerPoint downloads',async({page,browser})=>{
 await page.goto('/');await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();await page.getByRole('button',{name:'Export & share',exact:true}).click();mkdirSync('test-results/exports',{recursive:true});
 for(const [name,file] of [['Public JSON','total.public.json'],['SVG diagram','total.svg'],['PNG image','total.png'],['Interactive HTML','total.html'],['Editable PowerPoint','total.pptx']]){
  const downloadPromise=page.waitForEvent('download',{timeout:30000});await page.getByRole('button',{name:new RegExp('^'+name)}).click();const download=await downloadPromise;await download.saveAs(`test-results/exports/${file}`);expect(await download.failure()).toBeNull();
 }
 expect(JSON.parse(readFileSync('test-results/exports/total.public.json','utf8')).schemaVersion).toBe(1);
 expect(readFileSync('test-results/exports/total.png').subarray(1,4).toString()).toBe('PNG');expect(readFileSync('test-results/exports/total.pptx').subarray(0,2).toString()).toBe('PK');
 const context=await browser.newContext();const offline=await context.newPage();const errors:string[]=[];offline.on('pageerror',e=>errors.push(e.message));await offline.route('**/*',route=>route.abort());await offline.setContent(readFileSync('test-results/exports/total.html','utf8'));
 await expect(offline.getByRole('heading',{name:'TotalEnergies',exact:true})).toBeVisible();await offline.getByRole('button',{name:'SQL quality checks',exact:true}).click();await expect(offline.getByRole('heading',{name:'↳ What the validation task does',exact:true})).toBeVisible();await offline.screenshot({path:'test-results/showcase-offline.png',fullPage:true});expect(errors).toEqual([]);await context.close();
});
test('public portfolio omits private payload and escapes user content',async({page})=>{
 const d=clone(total);d.nodes.find(n=>n.id==='business')!.visibility='private';d.privateNotes='PRIVATE_MARKER_42';d.title='</script><script>window.HACKED=1</script>';
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
 await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByRole('heading',{name:'Data Projects | constellation',exact:true})).toBeVisible();const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width+2);await page.screenshot({path:'test-results/showcase-mobile.png',fullPage:true});
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
 await expect(page.getByRole('heading',{name:'Data Projects | constellation',exact:true})).toBeVisible();
 await expect(page.getByText(/saved project could not be read/)).toBeVisible();
 await expect(page.getByRole('tab',{name:'Edit',exact:true})).toBeEnabled();
});


test('Google Drive asset vault is optional and disabled until configured',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Project files',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Google Drive project files'})).toBeVisible();
 await expect(page.getByText('Optional Google file vault.')).toBeVisible();
 await expect(page.getByText('Not connected')).toBeVisible();
 await expect(page.getByRole('button',{name:'Connect Google Drive',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Choose image from Drive',exact:true})).toBeDisabled();
 await expect(page.getByText(/PNG, PDF and PPTX files can also be archived in Drive/)).toBeVisible();
});

test('AI change preview lists each change by name, flags risky edits, and renders imported text as text',async({page})=>{
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByRole('button',{name:'Load current JSON',exact:true}).click();
 const editor=page.getByLabel('Project JSON'),doc=JSON.parse(await editor.inputValue());
 doc.nodes.find((n:{id:string})=>n.id==='checks').label='Reviewed SQL checks';
 doc.nodes.find((n:{id:string})=>n.id==='excel').summary='<img src=x onerror="window.HACKED=1">';
 const block=doc.blocks.find((b:{provenance:string})=>b.provenance==='synthetic');block.provenance='source-derived';
 await editor.fill(JSON.stringify(doc));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 const changes=page.getByRole('region',{name:'Proposed changes'});
 await expect(changes.locator('.change-item').filter({hasText:'checks'})).toContainText('SQL quality checks → Reviewed SQL checks');
 await expect(changes.locator('.change-item').filter({hasText:'checks'}).locator('ins')).toHaveText('“Reviewed SQL checks”');
 await expect(changes.locator('.change-item').filter({hasText:'excel'}).locator('ins')).toContainText('<img src=x onerror=');
 expect(await page.evaluate(()=>(window as unknown as {HACKED?:number}).HACKED)).toBeUndefined();
 await expect(page.getByRole('note',{name:'Check before applying'})).toContainText(`Relabels evidence block “${block.title}” from synthetic to source-derived`);
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explore Reviewed SQL checks',exact:true})).toBeVisible();
});

test('workspace import preview shows panel changes and cautions before applying',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Evidence workspaces',exact:true}).click();
 const d=page.getByRole('dialog',{name:'Evidence workspace pilot'});
 await d.getByRole('button',{name:'Workspace JSON / AI',exact:true}).click();
 const input=d.getByLabel('Experience JSON'),p=JSON.parse(await input.inputValue());
 const item=p.items.find((i:{provenance:string})=>i.provenance==='synthetic');item.provenance='source-derived';item.title='Renamed by AI';
 await input.fill(JSON.stringify(p));
 await d.getByRole('button',{name:'Validate workspace import',exact:true}).click();
 const changes=d.getByRole('region',{name:'Proposed changes'});
 await expect(changes.locator('.change-group').filter({hasText:'Panels'})).toContainText('Renamed by AI');
 await expect(d.getByRole('note',{name:'Check before applying'})).toContainText('Relabels panel “Renamed by AI” from synthetic to source-derived');
 await expect(d.getByRole('button',{name:'Apply reviewed workspace import',exact:true})).toBeEnabled();
});

test('JSON Patch: applied through the review, then refused once stale; ID changes refused',async({page})=>{
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByRole('button',{name:'New JSON Patch',exact:true}).click();
 const editor=page.getByLabel('Project JSON'),patch=JSON.parse(await editor.inputValue());
 expect([patch.format,patch.target,patch.targetId]).toEqual(['diagramcloud.patch','project','total-project-controls']);
 patch.summary='Rename the SQL checks after review';
 patch.operations=[{op:'test',path:'/nodes/@checks/label',value:'SQL quality checks'},{op:'replace',path:'/nodes/@checks/label',value:'Patched SQL checks'}];
 await editor.fill(JSON.stringify(patch));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.locator('.patch-note')).toHaveText(`JSON Patch · 2 operations on revision ${patch.baseRevision} · Rename the SQL checks after review`);
 await expect(page.getByRole('region',{name:'Proposed changes'})).toContainText('SQL quality checks → Patched SQL checks');
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explore Patched SQL checks',exact:true})).toBeVisible();

 // The same patch is now stale: the project moved to the next revision.
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await editor.fill(JSON.stringify(patch));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText(`Stale patch: it was written against revision ${patch.baseRevision}, and the open project is at revision ${patch.baseRevision+1}`);
 await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeDisabled();
 await editor.fill(JSON.stringify({...patch,baseRevision:patch.baseRevision+1,operations:[{op:'replace',path:'/nodes/@checks/id',value:'checks-renamed'}]}));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('IDs are stable');
 await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeDisabled();
});

test('workspace JSON Patch edits one panel by id and is reviewed before applying',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Evidence workspaces',exact:true}).click();
 const d=page.getByRole('dialog',{name:'Evidence workspace pilot'});
 await d.getByRole('button',{name:'Workspace JSON / AI',exact:true}).click();
 await d.getByRole('button',{name:'New JSON Patch',exact:true}).click();
 const input=d.getByLabel('Experience JSON'),patch=JSON.parse(await input.inputValue());
 expect(patch.target).toBe('experience');
 patch.operations[1].value='Patched panel title';
 await input.fill(JSON.stringify(patch));
 await d.getByRole('button',{name:'Validate workspace import',exact:true}).click();
 await expect(d.getByText(/JSON Patch · 2 operations on revision/)).toBeVisible();
 await expect(d.getByRole('region',{name:'Proposed changes'})).toContainText('Patched panel title');
 await d.getByRole('button',{name:'Apply reviewed workspace import',exact:true}).click();
 await expect(d.getByRole('region',{name:'Workspace import review'})).toHaveCount(0);
});

test('story composer: edit, reorder, add from the canvas, undo, play, and persist',async({page})=>{
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await expect(page.getByRole('tab',{name:'Edit',exact:true})).toBeEnabled();await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.getByRole('button',{name:'Story',exact:true}).click();
 const composer=page.getByRole('region',{name:'Story composer'}),steps=composer.locator('.story-list .story-pick b');
 const count=await steps.count();expect(count).toBeGreaterThan(2);
 const second=(await steps.nth(1).textContent())!.replace(/^2\. /,'');
 await steps.nth(1).click();
 await expect(page.locator('.story-bar h3')).toHaveText(second);

 const form=composer.getByRole('form',{name:'Edit step 2'});
 await form.getByLabel('Step title').fill('Why the checks matter');
 await form.getByLabel('Narration').fill('Show one failing row, then the rule that caught it.');
 await form.getByRole('button',{name:'Save step',exact:true}).click();
 await expect(steps.nth(1)).toHaveText('2. Why the checks matter');
 await expect(page.locator('.story-bar p')).toHaveText('Show one failing row, then the rule that caught it.');

 await composer.getByRole('button',{name:'Move step 2 up',exact:true}).click();
 await expect(steps.nth(0)).toHaveText('1. Why the checks matter');

 // Pick a component on the canvas; the Story tab stays open, and the new step focuses it.
 await page.getByRole('button',{name:'Explore Power BI reporting',exact:true}).click();
 await expect(composer).toBeVisible();
 await composer.getByRole('button',{name:'+ Step from current view',exact:true}).click();
 await expect(steps).toHaveCount(count+1);
 await expect(steps.nth(1)).toHaveText('2. Power BI reporting');
 await expect(composer.getByRole('form',{name:'Edit step 2'}).getByLabel('Focus component')).toHaveValue('powerbi');
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(steps).toHaveCount(count);

 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.reload();await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();await page.getByRole('button',{name:'Story',exact:true}).click();
 await expect(steps.nth(0)).toHaveText('1. Why the checks matter');
 await composer.getByRole('form',{name:'Edit step 1'}).getByRole('button',{name:'Play from here',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Present',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.locator('.story-bar')).toContainText(`GUIDED STORY · 1 / ${count}`);
 await expect(page.locator('.story-bar h3')).toHaveText('Why the checks matter');
});
