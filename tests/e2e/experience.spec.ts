import {test,expect} from '@playwright/test';
import {mkdirSync,readFileSync} from 'node:fs';

test('in-app workspace drills into SQL task and remixes shared items',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.getByRole('button',{name:'Evidence workspaces',exact:true}).click();
 const d=page.getByRole('dialog',{name:'Evidence workspace pilot'});
 const nav=d.locator('.xp-nav');
 await nav.getByRole('button',{name:'TotalEnergies',exact:true}).first().click();
 await nav.getByRole('button',{name:/Project controls/}).click();
 await nav.getByRole('button',{name:/Validate schedule rows/}).click();
 await expect(d.getByTestId('item-quality-sql')).toContainText('start_date > finish_date');
 await expect(d.getByTestId('item-quality-output')).toContainText('wbs-02');
 await nav.getByRole('button',{name:'Portfolio remix',exact:true}).first().click();
 await expect(d.getByTestId('item-capex-curve')).toBeVisible();
 await expect(d.getByTestId('item-quality-sql')).toBeVisible();
 await d.getByLabel('Reusable item').selectOption('manifest-code');await d.getByRole('button',{name:'Add reference',exact:true}).click();await expect(d.getByTestId('item-manifest-code')).toBeVisible();
 await d.getByTestId('item-manifest-code').getByRole('button',{name:'Focus item',exact:true}).click();await expect(d.getByTestId('item-quality-sql')).toHaveCount(0);await d.getByRole('button',{name:'Exit item focus',exact:true}).click();
 await d.getByRole('button',{name:'Two-column layout',exact:true}).click();
 await expect(d.getByTestId('item-quality-sql')).toHaveCSS('grid-column-start','1');
 await expect(d.getByTestId('item-capex-curve')).toHaveCSS('grid-column-start','7');
 await d.getByRole('button',{name:'Single-column layout',exact:true}).click();
 await expect(d.getByTestId('item-capex-curve')).toHaveCSS('grid-column-start','1');
 mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/experience-remix.png',fullPage:true});expect(errors).toEqual([]);
});
test('experience mini document, panel PNG and stable-ID JSON are downloadable',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Evidence workspaces',exact:true}).click();const d=page.getByRole('dialog',{name:'Evidence workspace pilot'});await d.getByRole('button',{name:'Portfolio remix',exact:true}).click();mkdirSync('test-results/experience-exports',{recursive:true});
 let wait=page.waitForEvent('download');await d.getByRole('button',{name:'Export mini document',exact:true}).click();let file=await wait;await file.saveAs('test-results/experience-exports/remix.html');expect(readFileSync('test-results/experience-exports/remix.html','utf8')).toContain('data-document-role="page"');
 wait=page.waitForEvent('download');await d.getByTestId('item-capex-curve').getByRole('button',{name:'PNG',exact:true}).click();file=await wait;await file.saveAs('test-results/experience-exports/curve.png');expect(readFileSync('test-results/experience-exports/curve.png').subarray(1,4).toString()).toBe('PNG');
 wait=page.waitForEvent('download');await d.getByRole('button',{name:'Export workspace pack',exact:true}).click();file=await wait;await file.saveAs('test-results/experience-exports/pack.json');expect(JSON.parse(readFileSync('test-results/experience-exports/pack.json','utf8')).format).toBe('diagramcloud.experience');
});
test('workspace import validates before apply and rejects overlapping panels',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Evidence workspaces',exact:true}).click();const d=page.getByRole('dialog',{name:'Evidence workspace pilot'});await d.getByRole('button',{name:'Workspace JSON / AI',exact:true}).click();const input=d.getByLabel('Experience JSON');const p=JSON.parse(await input.inputValue());p.workspaces[0].placements[1].x=0;await input.fill(JSON.stringify(p));await d.getByRole('button',{name:'Validate workspace import',exact:true}).click();await expect(d.getByRole('alert')).toContainText('overlapping');await expect(d.getByRole('button',{name:'Apply reviewed workspace import',exact:true})).toBeDisabled();
});


test('architecture nodes open their linked task workspaces directly',async({page})=>{
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await page.getByRole('button',{name:'Explore SQL quality checks',exact:true}).click();
 const d=page.getByRole('dialog',{name:'Evidence workspace pilot'});
 await expect(d).toBeVisible();
 await expect(d.getByRole('heading',{name:'SQL quality task | input, code, output',exact:true})).toBeVisible();
 await expect(d.getByTestId('item-quality-sql')).toContainText('start_date > finish_date');
 await d.getByRole('button',{name:'Close dialog'}).click();

 await page.locator('.project-card').filter({hasText:'Data Projects | constellation'}).click();
 await page.getByRole('button',{name:'Explore Developer control plane',exact:true}).click();
 await page.getByRole('button',{name:'Explore Data Platform VS Code control plane',exact:true}).click();
 const d2=page.getByRole('dialog',{name:'Evidence workspace pilot'});
 await expect(d2.getByRole('heading',{name:'DataPass | Galaxy control-plane screen',exact:true})).toBeVisible();
 await expect(d2.getByTestId('item-galaxy-surfaces')).toContainText('Fabric');
 await expect(d2.getByTestId('item-galaxy-safety')).toContainText('vendor authentication');
});
