import {test,expect} from '@playwright/test';
import {mkdirSync,readFileSync} from 'node:fs';
import {checkConceptSpec} from '../contracts/mosaicstudio/schema';

/* 1.6: the same component through several perspectives, Back/Forward, provenance filter and the renderer-neutral view spec. */
mkdirSync('test-results/perspectives',{recursive:true});

test('perspectives: switch a component from System to CI/CD with its parents kept, go Back and Forward, filter by basis, export the view spec',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByLabel('Scan repository folder').setInputFiles('tests/fixtures/repo-shop');
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await page.getByRole('button',{name:'Explore shop',exact:true}).click();
 await expect(page.getByTestId('view-containers')).toBeVisible();
 await expect(page.getByTestId('view-overview').getByTestId('view-context')).toContainText('SYSTEM');
 const strip=page.getByRole('region',{name:'Perspectives'});
 await expect(strip.getByRole('button',{name:'System: available'})).toBeVisible();
 await expect(strip.getByLabel('Git: not in this project')).toBeVisible();
 await strip.getByRole('button',{name:'CI/CD: available'}).click();
 await expect(page.getByTestId('view-delivery')).toBeVisible();await expect(page.getByTestId('view-overview')).toBeVisible();
 await expect(page.getByTestId('view-delivery').getByTestId('view-context')).toContainText('CI/CD');
 await expect(page.getByTestId('view-containers')).toHaveCount(0);
 await page.getByRole('button',{name:'Back',exact:true}).click();
 await expect(page.getByTestId('view-containers')).toBeVisible();await expect(page.getByTestId('view-delivery')).toHaveCount(0);
 await page.getByRole('button',{name:'Forward',exact:true}).click();
 await expect(page.getByTestId('view-delivery')).toBeVisible();
 // Provenance filter: everything here is read from source, so "Planned" dims every card.
 await page.getByLabel('Basis filter').selectOption('planned');
 await expect(page.getByTestId('view-overview').locator('.component-node.dimmed').first()).toBeVisible();
 await page.getByLabel('Basis filter').selectOption('all');
 await page.screenshot({path:'test-results/perspectives/cicd.png',fullPage:true});
 // The renderer-neutral view spec of the current view.
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:/View spec \(JSON\)/}).click();
 const file=await wait;await file.saveAs('test-results/perspectives/delivery.viewspec.json');
 const spec=JSON.parse(readFileSync('test-results/perspectives/delivery.viewspec.json','utf8'));
 expect(spec.format).toBe('diagramcloud.viewspec');expect(spec.viewId).toBe('delivery');expect(spec.perspective).toBe('cicd');
 expect(spec.path.map((p:{viewId:string})=>p.viewId)).toEqual(['overview','delivery']);
 // The same view for MosaicStudio, checked with the owner's own validator.
 const wait2=page.waitForEvent('download');await page.getByRole('button',{name:/MosaicStudio concept \(JSON\)/}).click();
 const concept=await wait2;await concept.saveAs('test-results/perspectives/delivery.concept.json');
 const check=checkConceptSpec(JSON.parse(readFileSync('test-results/perspectives/delivery.concept.json','utf8')));
 expect(check.ok?[]:check.issues).toEqual([]);expect(check.warnings).toEqual([]);
 await expect(page.getByText(/MosaicStudio concept spec exported/)).toBeVisible();
 expect(errors).toEqual([]);
});
