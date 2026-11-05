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

/*
 * 1.34 source refresh: a rescan is reviewed as a source refresh summary (new, changed, uncertain, unavailable,
 * retained authored evidence); Apply is one revision and one Undo and returns to the view being read; a view
 * whose permitted path was revoked in the reviewed document is refused with the generic message.
 */
for(const width of [1440,390])test(`source refresh: rescan → summary → Apply returns to the same view → Undo; a revoked view is refused (${width} px)`,async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width,height:width>800?1100:844});
 await page.goto('/');
 await page.getByLabel('Import project manifest').setInputFiles('tests/fixtures/atlas/shop.manifest.json');
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.getByRole('button',{name:'Project atlas',exact:true}).click();
 await expect(page.getByTestId('atlas-refresh-note')).toBeVisible();
 await page.getByLabel('Rescan Shop').setInputFiles('tests/fixtures/repo-shop');
 await expect(page.getByTestId('source-refresh-summary')).toBeVisible();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 // Drill into the scanned repository and select a component: this is the reading context.
 await page.getByRole('button',{name:'Explore Shop',exact:true}).click();
 const view=page.getByTestId('view-shop.overview');await expect(view).toBeVisible();
 // Scanned cards can overlap on a dense canvas: select the first card a real click reaches.
 const cards=view.locator('.react-flow__node');let id='';
 for(let i=0;i<await cards.count()&&!id;i++){const c=cards.nth(i);if(await c.locator('.component-node').click({trial:true,timeout:1500}).then(()=>true,()=>false))id=(await c.getAttribute('data-id'))!;}
 expect(id).not.toBe('');
 const card=view.locator(`.react-flow__node[data-id="${id}"] .component-node`);
 await card.click();await expect(card).toHaveClass(/chosen/);
 // Rescan from a reduced synthetic copy: queue is new; web, cache and worker are not established (uncertain, never removed).
 await page.getByRole('button',{name:'Project atlas',exact:true}).click();
 await page.getByLabel('Rescan Shop').setInputFiles('tests/fixtures/repo-shop-refresh');
 const summary=page.getByTestId('source-refresh-summary');
 await expect(summary).toBeVisible();
 await expect(summary.locator('[data-category="added"]')).toContainText('queue');
 await expect(summary.locator('[data-category="uncertain"]')).toContainText('worker');await expect(summary.locator('[data-category="uncertain"]')).toContainText('not established by this refresh');
 await expect(summary.locator('[data-category="unavailable"]')).toContainText('revision unknown');
 await expect(summary).not.toContainText('was removed');
 await summary.scrollIntoViewIfNeeded();await summary.screenshot({path:`test-results/atlas/source-refresh-summary-${width}.png`});expect(await summary.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 // Back in the same view, with the same component selected.
 await expect(view).toBeVisible();
 await expect(card).toHaveClass(/chosen/);await expect(view.locator('.component-node.chosen')).toHaveCount(1);
 await expect(page.getByText(/Source refresh applied\. Returned to .*System context\./)).toBeVisible();
 // One revision, one Undo: the queue the refresh added is in the applied document and gone after a single Undo.
 const currentJson=async()=>{await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByRole('button',{name:'Load current JSON',exact:true}).click();
  const text=await page.getByLabel('Project JSON').inputValue();await page.keyboard.press('Escape');await expect(page.getByLabel('Project JSON')).toHaveCount(0);return JSON.parse(text);};
 const applied=await currentJson();
 expect(applied.nodes.some((n:{id:string})=>n.id==='shop.svc-queue')).toBe(true);
 expect(applied.nodes.find((n:{id:string})=>n.id==='shop.app-worker')?.tags).toContain('Not established by latest scan');
 await page.getByRole('button',{name:'Undo',exact:true}).first().click();
 const undone=await currentJson();
 expect(undone.nodes.some((n:{id:string})=>n.id==='shop.svc-queue')).toBe(false);
 expect(undone.nodes.find((n:{id:string})=>n.id==='shop.app-worker')?.tags??[]).not.toContain('Not established by latest scan');
 await expect(view).toBeVisible();
 // Cancel: closing the review applies nothing and returns to the same view.
 await page.getByRole('button',{name:'Project atlas',exact:true}).click();
 await page.getByLabel('Rescan Shop').setInputFiles('tests/fixtures/repo-shop-refresh');
 await expect(summary).toBeVisible();
 await page.keyboard.press('Escape');await expect(summary).toHaveCount(0);
 await expect(view).toBeVisible();
 expect((await currentJson()).nodes.some((n:{id:string})=>n.id==='shop.svc-queue')).toBe(false);
 // Revoked: the reviewed document no longer reaches shop.overview (its drilldown pointer removed by hand); the
 // return is refused with the generic message and no other view is chosen in its place.
 await page.getByRole('button',{name:'Project atlas',exact:true}).click();
 await page.getByLabel('Rescan Shop').setInputFiles('tests/fixtures/repo-shop-refresh');
 await expect(summary).toBeVisible();
 const editor=page.getByLabel('Project JSON'),json=JSON.parse(await editor.inputValue());
 delete json.nodes.find((n:{id:string})=>n.id==='repo-shop').childViewId;
 await editor.fill(JSON.stringify(json,null,1));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(summary).toBeVisible();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('This navigation target is unavailable in the current permitted context.')).toBeVisible();
 await expect(view).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
