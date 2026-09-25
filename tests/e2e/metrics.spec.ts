import {test,expect} from '@playwright/test';

test('metrics editor: add KPI cards without JSON, reject an unlabelled value, reorder, edit, undo and persist',async({page})=>{
 await page.goto('/');await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await expect(page.getByRole('tab',{name:'Edit',exact:true})).toBeEnabled();await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.getByRole('button',{name:'Explore SQL quality checks',exact:true}).click();
 const editors=page.locator('.block-editor'),before=await editors.count();
 await page.getByLabel('Block type').selectOption('metrics');
 await expect(page.getByLabel('Evidence content')).toHaveCount(0);
 await page.getByLabel('Metrics title').fill('Quality gate');

 // Synthetic is the default; any other provenance without a source asks for one.
 await expect(page.getByLabel('Metrics provenance')).toHaveValue('synthetic');await expect(page.locator('.metric-warning')).toHaveCount(0);
 await page.getByLabel('Metrics provenance').selectOption('author');await expect(page.locator('.metric-warning')).toContainText('Mark illustrative figures as synthetic');
 await page.getByLabel('Metrics provenance').selectOption('synthetic');

 await page.getByLabel('Metric 1 value').fill('12 400');await page.getByLabel('Metric 1 label').fill('Rows checked');
 await page.getByRole('button',{name:'+ Add metric',exact:true}).click();await page.getByLabel('Metric 2 value').fill('3');
 await page.getByRole('button',{name:'Attach metrics',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Metric 2: add a label');await expect(editors).toHaveCount(before);
 await page.getByLabel('Metric 2 label').fill('Failed rules');await page.getByLabel('Metric 2 note').fill('Illustrative run');
 await page.getByRole('button',{name:'Move metric 2 up',exact:true}).click();
 await expect(page.locator('.metrics-preview strong').first()).toHaveText('3');
 await page.locator('.metrics-editor').first().screenshot({path:'test-results/metrics-editor.png'});
 await page.getByRole('button',{name:'Attach metrics',exact:true}).click();

 const block=page.locator('.evidence-block').filter({hasText:'Quality gate'});
 await expect(block.locator('.metrics>div')).toHaveCount(2);await expect(block.locator('.metrics strong').first()).toHaveText('3');
 await expect(block.getByText('synthetic',{exact:true})).toBeVisible();await expect(block.getByText('Illustrative run')).toBeVisible();
 await expect(page.locator('.metrics-editor').first().getByLabel('Metrics title'),'the add form resets after attaching').toHaveValue('');

 // The attached block opens in the same visual editor; JSON stays available as a fallback.
 const attached=editors.filter({hasText:'Quality gate'});await attached.locator('summary').first().click();
 await expect(attached.getByText('Edit as JSON')).toBeVisible();
 await attached.getByLabel('Metric 1 value').fill('4');await attached.getByRole('button',{name:'Apply metrics',exact:true}).click();
 await expect(block.locator('.metrics strong').first()).toHaveText('4');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(block.locator('.metrics strong').first()).toHaveText('3');
 await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(block.locator('.metrics strong').first()).toHaveText('4');

 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();await page.reload();
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();await page.getByRole('button',{name:'Explore SQL quality checks',exact:true}).click();
 await expect(page.locator('.evidence-block').filter({hasText:'Quality gate'}).locator('.metrics strong').first()).toHaveText('4');
});
