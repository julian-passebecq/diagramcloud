import {test,expect,type Page} from '@playwright/test';
import {documentSchema,validateDocument,type Project} from '../../src/core/model';
import {previewDeliveryBrief} from '../../src/intelligence/delivery';

// Synthetic fixture: declared DEV/TEST/PROD instances and one reviewed TEST claim. Nothing was deployed or executed.
function fixture():Project{
 const base=documentSchema.parse({schemaVersion:1,id:'synthetic-environment-context',title:'Synthetic environment studio',rootViewId:'root',
  nodes:[{id:'api',label:'Synthetic API'},{id:'data',label:'Synthetic data'}],edges:[{id:'reads',source:'api',target:'data',label:'Synthetic read'}],
  views:[{id:'root',title:'Synthetic environment root',nodeIds:['api','data'],edgeIds:['reads'],positions:{api:{x:0,y:0},data:{x:300,y:0}},perspective:'system'}]});
 const doc=previewDeliveryBrief(base,{format:'diagramcloud.delivery-brief',version:1,projectId:base.id,baseRevision:base.revision,delivery:{
  environments:[{id:'dev',label:'DEV'},{id:'test',label:'TEST'},{id:'prod',label:'PROD'}],artifacts:[{id:'build',label:'Synthetic build',version:'1'}],
  instances:[{id:'api-dev',nodeId:'api-dev-instance',componentId:'api',environmentId:'dev',declaredRevision:'aaaaaaa'},{id:'api-test',nodeId:'api-test-instance',componentId:'api',environmentId:'test',declaredRevision:'aaaaaaa'}],
  promotions:[{id:'test-to-prod',fromEnvironmentId:'test',toEnvironmentId:'prod',artifactId:'build',gates:[{id:'suite',label:'Synthetic suite'}]}]}}).document;
 doc.observations=[{id:'test-pass',nodeId:'api-test-instance',sourceApp:'external',authority:'Synthetic CI fixture',observedAt:'2026-10-17T10:00:00Z',sourceRevision:'aaaaaaa',claim:'verified',summary:'Synthetic reported pass',blockIds:[],caveat:'Synthetic fixture; nothing was executed',visibility:'private',shareable:false,reviewedAt:'2026-10-17T10:30:00Z'}];
 doc.delivery!.promotions[0].gates[0].observationId='test-pass';
 return validateDocument(doc);
}
async function importDoc(page:Page,doc:Project){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
}
const card=(page:Page,label:string)=>page.getByTestId('view-root').locator('.component-node').filter({has:page.getByRole('button',{name:`Explore ${label}`,exact:true})});

test('one studio environment selection drives canvas cards, the navigator and saved contexts; a reported TEST pass stays in TEST',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await importDoc(page,fixture());
 const select=page.getByLabel('Studio environment',{exact:true});
 await expect(select.locator('option')).toHaveText(['All components (no environment)','DEV','TEST','PROD']);
 await expect(card(page,'Synthetic API').locator('[data-environment-state]')).toHaveCount(0);
 const crumbs=await page.getByLabel('Diagram path').innerText();
 await select.selectOption({label:'TEST'});
 await expect(card(page,'Synthetic API').locator('[data-environment-state]')).toHaveText(/^Declared instance in TEST · reviewed external claim verified by Synthetic CI fixture/);
 await expect(card(page,'Synthetic data').locator('[data-environment-state]')).toHaveText('No declaration in TEST · UNKNOWN');
 expect(await page.getByLabel('Diagram path').innerText()).toBe(crumbs);
 await select.selectOption({label:'DEV'});
 await expect(card(page,'Synthetic API').locator('[data-environment-state]')).toHaveText('Declared instance in DEV · no reviewed claim');
 await select.selectOption({label:'PROD'});
 await expect(card(page,'Synthetic API').locator('[data-environment-state]')).toHaveText('No declaration in PROD · UNKNOWN');
 await expect(page.getByTestId('view-root').locator('[data-environment-state]').filter({hasText:'verified'})).toHaveCount(0);
 // The navigator reads the same studio selection; it has no environment filter of its own.
 await page.getByRole('button',{name:'Navigate',exact:true}).click();
 await expect(page.getByTestId('navigation-environment')).toContainText('Environment: PROD');
 await expect(page.getByLabel('Navigation environment filter')).toHaveCount(0);
 // Saved context: captured and restored by exact environment identity.
 await select.selectOption({label:'TEST'});
 const saved=page.getByTestId('saved-contexts');
 await saved.getByLabel('Saved context name',{exact:true}).fill('TEST view');await saved.getByRole('button',{name:'Save context',exact:true}).click();
 await select.selectOption({label:'All components (no environment)'});
 await expect(card(page,'Synthetic API').locator('[data-environment-state]')).toHaveCount(0);
 await saved.getByRole('button',{name:'Restore TEST view',exact:true}).click();
 await expect(select).toHaveValue('test');
 await expect(saved.locator('[data-dimension="environment"]')).toHaveAttribute('data-state','kept');
 await expect(card(page,'Synthetic API').locator('[data-environment-state]')).toHaveAttribute('data-environment-state','reviewed-claim');
 // The public projection holds no private environment: the selection falls back visibly to all components.
 await page.getByRole('tab',{name:'Portfolio',exact:true}).click();
 await expect(page.getByTestId('environment-fallback')).toHaveText('The selected environment is unavailable in this projection; all components are shown.');
 await expect(page.getByLabel('Studio environment',{exact:true}).locator('option')).toHaveText(['All components (no environment)']);
 await expect(page.locator('[data-environment-state]')).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await expect(select).toHaveValue('test');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
