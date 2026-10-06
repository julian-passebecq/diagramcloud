import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

/*
 * 1.5: a project made of several repositories. Membership comes from a manifest; each repository keeps its own
 * revision; a rescan replaces one repository after review; snapshots are compared; adding a repository is explicit.
 */
mkdirSync('test-results/atlas',{recursive:true});

test('project atlas: manifest → reviewed project → rescan one repository → snapshot comparison → add repository',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByLabel('Import project manifest').setInputFiles('tests/fixtures/atlas/shop.manifest.json');
 const report=page.getByTestId('import-report');
 await expect(report).toContainText('Project atlas');await expect(report).toContainText('3 repositories');
 await expect(report.getByRole('region',{name:'Kept'})).toContainText('handbook @ 1234567890ab');
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Shop platform (synthetic)',exact:true,level:1})).toBeVisible();
 // The atlas panel: a revision vector, stale sources named, not guessed.
 await page.getByRole('button',{name:'Project atlas',exact:true}).click();
 const panel=page.getByTestId('atlas-panel');
 await expect(panel.getByTestId('atlas-repo-handbook')).toContainText('1234567890ab');await expect(panel.getByTestId('atlas-repo-handbook')).toContainText('never scanned');
 await expect(panel.getByTestId('atlas-repo-shop')).toContainText('revision unknown');
 await page.keyboard.press('Escape');
 // Edit: rescan the shop repository from its folder; the review shows the change; apply.
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.getByRole('button',{name:'Project atlas',exact:true}).click();
 await page.getByLabel('Rescan Shop').setInputFiles('tests/fixtures/repo-shop');
 await expect(report).toContainText('Project atlas');await expect(report.getByRole('region',{name:'Kept'})).toContainText('Shop rescanned');
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await page.getByRole('button',{name:'Project atlas',exact:true}).click();
 await expect(panel.getByTestId('atlas-repo-shop')).toContainText('scanned');
 await expect(panel.getByRole('region',{name:'Snapshot comparison'})).toContainText('Shop');
 // Drill from the atlas root into the scanned repository: the parent stays visible.
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Explore Shop',exact:true}).click();
 await expect(page.getByTestId('view-shop.overview')).toBeVisible();await expect(page.getByTestId('view-atlas')).toBeVisible();
 // Add a repository explicitly.
 await page.getByRole('button',{name:'Project atlas',exact:true}).click();
 await panel.getByText('Add repository').first().click();
 await panel.getByLabel('Repository ID').fill('warehouse');await panel.getByLabel('Repository title').fill('Warehouse');await panel.getByLabel('Repository locator').fill('https://gitlab.com/example/warehouse');
 await panel.getByRole('button',{name:'Add repository',exact:true}).click();
 await expect(panel.getByTestId('atlas-repo-warehouse')).toContainText('never scanned');
 await page.screenshot({path:'test-results/atlas/atlas-panel.png',fullPage:true});
 // Survives a reload.
 await page.reload();await page.locator('.project-card').filter({hasText:'Shop platform (synthetic)'}).click();await page.getByRole('button',{name:'Project atlas',exact:true}).click();
 await expect(page.getByTestId('atlas-repo-warehouse')).toBeVisible();
 // 1.11: a Lens minimap adds observed Git and delivery pointers after review; components stay. Warehouse was added explicitly above, so it matches.
 await page.keyboard.press('Escape');await page.getByRole('tab',{name:'Edit',exact:true}).click();
 const nodes=await page.locator('.component-node').count();
 await page.getByRole('button',{name:'Project atlas',exact:true}).click();
 await page.getByLabel('Read Lens minimap').setInputFiles('tests/fixtures/atlas/lens.minimap.json');
 await expect(report.getByRole('region',{name:'Kept'})).toContainText('Shop: main @ eeeeeeeeeeee, CI FAILED');
 await expect(report.getByRole('region',{name:'Kept'})).toContainText('Warehouse: main @ 111111111111');await expect(report.getByRole('region',{name:'Not imported'})).toContainText('request 43 link carries credentials');
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await page.getByRole('button',{name:'Project atlas',exact:true}).click();
 const lens=panel.getByRole('region',{name:'Observed by Lens'});
 await expect(lens.getByTestId('lens-shop')).toContainText('FAILED @ eeeeeeeeeeee');await expect(lens.getByTestId('lens-shop')).toContainText('https://github.com/example/shop/pull/42');
 await expect(lens.getByTestId('lens-billing')).toContainText('SUCCESS');await expect(panel).not.toContainText('SECRET-TOKEN');
 await page.screenshot({path:'test-results/atlas/atlas-lens.png',fullPage:true});
 await page.keyboard.press('Escape');await expect(page.locator('.component-node')).toHaveCount(nodes);
 expect(errors).toEqual([]);
});
