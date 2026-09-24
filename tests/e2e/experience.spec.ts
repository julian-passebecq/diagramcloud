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
 // Report view hides the scope navigator; go back to the scope map to switch project.
 await d.getByRole('button',{name:'Back to scope map',exact:true}).click();
 await nav.getByRole('button',{name:'Portfolio remix',exact:true}).first().click();
 await expect(d.getByTestId('item-capex-curve')).toBeVisible();
 await expect(d.getByTestId('item-quality-sql')).toBeVisible();
 await d.getByRole('button',{name:'Edit board',exact:true}).click();
 await d.getByLabel('Search reusable items').fill('Portable project');await d.getByLabel('Reusable item',{exact:true}).selectOption('manifest-code');await d.getByRole('button',{name:'Add reference',exact:true}).click();await expect(d.getByTestId('item-manifest-code')).toBeVisible();
 await d.getByTestId('item-manifest-code').getByRole('button',{name:'Focus item',exact:true}).click();await expect(d.getByTestId('item-quality-sql')).toHaveCount(0);await d.getByRole('button',{name:'Exit item focus',exact:true}).click();
 await d.getByRole('button',{name:'Two-column layout',exact:true}).click();
 await expect(d.getByTestId('item-quality-sql')).toHaveCSS('grid-column-start','1');
 await expect(d.getByTestId('item-capex-curve')).toHaveCSS('grid-column-start','7');
 await d.getByRole('button',{name:'Single-column layout',exact:true}).click();
 await expect(d.getByTestId('item-capex-curve')).toHaveCSS('grid-column-start','1');
 await d.getByRole('button',{name:'Duplicate as board',exact:true}).click();
 await expect(d.getByRole('heading',{name:/Portfolio \| mixed evidence board \| remix/})).toBeVisible();
 await d.getByRole('button',{name:'Board settings',exact:true}).click();await d.getByLabel('Board title').fill('Interview evidence board');await d.getByLabel('Board description').fill('Curated reusable evidence for an interview walkthrough.');await d.getByRole('button',{name:'Save board settings',exact:true}).click();await expect(d.getByRole('heading',{name:'Interview evidence board',exact:true})).toBeVisible();
 await d.getByTestId('item-quality-sql').getByRole('button',{name:'Remove placement',exact:true}).click();
 await expect(d.getByTestId('item-quality-sql')).toHaveCount(0);
 await d.getByLabel('Search reusable items').fill('SQL validation');await d.getByLabel('Reusable item type').selectOption('code');await d.getByLabel('Reusable item',{exact:true}).selectOption('quality-sql');
 await d.getByRole('button',{name:'Add reference',exact:true}).click();
 await expect(d.getByTestId('item-quality-sql')).toBeVisible();
 mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/experience-remix.png',fullPage:true});expect(errors).toEqual([]);
});
test('experience mini document, panel PNG and stable-ID JSON are downloadable',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Evidence workspaces',exact:true}).click();const d=page.getByRole('dialog',{name:'Evidence workspace pilot'});await d.getByRole('button',{name:'Portfolio remix',exact:true}).click();mkdirSync('test-results/experience-exports',{recursive:true});
 let wait=page.waitForEvent('download');await d.getByRole('button',{name:'Export mini document',exact:true}).click();let file=await wait;await file.saveAs('test-results/experience-exports/remix.html');expect(readFileSync('test-results/experience-exports/remix.html','utf8')).toContain('data-document-role="page"');
 await d.getByRole('button',{name:'Edit board',exact:true}).click();
 wait=page.waitForEvent('download');await d.getByTestId('item-capex-curve').getByRole('button',{name:'PNG',exact:true}).click();file=await wait;await file.saveAs('test-results/experience-exports/curve.png');expect(readFileSync('test-results/experience-exports/curve.png').subarray(1,4).toString()).toBe('PNG');
 wait=page.waitForEvent('download');await d.getByRole('button',{name:'Export workspace pack',exact:true}).click();file=await wait;await file.saveAs('test-results/experience-exports/pack.json');expect(JSON.parse(readFileSync('test-results/experience-exports/pack.json','utf8')).format).toBe('diagramcloud.experience');
});
test('workspace import validates before apply and rejects overlapping panels',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Evidence workspaces',exact:true}).click();const d=page.getByRole('dialog',{name:'Evidence workspace pilot'});await d.getByRole('button',{name:'Workspace JSON / AI',exact:true}).click();const input=d.getByLabel('Experience JSON');const p=JSON.parse(await input.inputValue());p.workspaces[0].placements[1].x=0;await input.fill(JSON.stringify(p));await d.getByRole('button',{name:'Validate workspace import',exact:true}).click();await expect(d.getByRole('alert')).toContainText('overlapping');await expect(d.getByRole('button',{name:'Apply reviewed workspace import',exact:true})).toBeDisabled();
});


test('architecture drilldown and task workspace are separate explicit actions',async({page})=>{
 await page.goto('/');
 const d=page.getByRole('dialog',{name:'Evidence workspace pilot'});
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();

 // Card click = Explore architecture only.
 await page.getByRole('button',{name:'Explore SQL quality checks',exact:true}).click();
 await expect(page.getByTestId('view-validation')).toBeVisible();
 await expect(d).toHaveCount(0);

 // Sibling card action = Open task workspace only (deep-linked, full breadcrumb, no extra drill level).
 await page.getByRole('button',{name:'Open task workspace for SQL quality checks',exact:true}).click();
 await expect(d.getByRole('heading',{name:'SQL quality task | input, code, output',exact:true})).toBeVisible();
 await expect(d.getByTestId('item-quality-sql')).toContainText('start_date > finish_date');
 await expect(d.getByRole('navigation',{name:'Workspace path'}).getByRole('button')).toHaveText(['TotalEnergies','Project controls','Validate schedule rows']);
 await d.getByRole('button',{name:'Close dialog'}).click();
 await expect(d).toHaveCount(0);
 await expect(page.getByTestId('view-check-detail')).toHaveCount(0);

 // Same contract from the Inspector for a DataPass node reached by drilldown.
 await page.getByRole('button',{name:'Project gallery',exact:true}).click();
 await page.locator('.project-card').filter({hasText:'Data Projects | constellation'}).click();
 await page.getByRole('button',{name:'Explore Developer control plane',exact:true}).click();
 await page.getByRole('button',{name:'Explore Data Platform VS Code control plane',exact:true}).click();
 await expect(page.getByTestId('view-datapass-vscode-detail')).toBeVisible();
 await expect(d).toHaveCount(0);
 await page.getByRole('button',{name:'Open task workspace',exact:true}).click();
 await expect(d.getByRole('heading',{name:'DataPass | Galaxy control-plane screen',exact:true})).toBeVisible();
 await expect(d.getByTestId('item-galaxy-surfaces')).toContainText('Fabric');
 await expect(d.getByTestId('item-galaxy-safety')).toContainText('vendor authentication');
});

test('report screens: KPI trends, charts, status badges, CSS tabs, edit toggle and matching export',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await page.getByRole('button',{name:'Open task workspace for Power BI reporting',exact:true}).click();
 const d=page.getByRole('dialog',{name:'Evidence workspace pilot'});
 await expect(d.getByRole('heading',{name:'BI quicklook | executive dashboard',exact:true})).toBeVisible();
 await expect(d.locator('.xp-rail')).toContainText('Executive quicklook dashboard');
 await expect(d.locator('.xp-nav')).toBeHidden();
 await expect(d.getByTestId('item-ql-kpi-prod')).toContainText('+2.1%');
 await expect(d.getByTestId('item-ql-kpi-prod').locator('.xp-delta.xp-good')).toBeVisible();
 await expect(d.getByTestId('item-ql-by-region').locator('svg path')).toHaveCount(5);
 await expect(d.getByTestId('item-ql-loads').locator('.xp-status.xp-warn')).toHaveText('Pending');
 await expect(d.getByTestId('item-ql-kpi-prod').getByRole('button')).toHaveCount(0);
 await expect(d.locator('.xp-screen-foot')).toContainText('nothing on this screen is a live query');
 const wait=page.waitForEvent('download');await d.getByRole('button',{name:'Export mini document',exact:true}).click();
 mkdirSync('test-results/experience-exports',{recursive:true});const file=await wait;await file.saveAs('test-results/experience-exports/quicklook.html');
 const html=readFileSync('test-results/experience-exports/quicklook.html','utf8');
 expect(html).toContain('class="xp-rail"');expect(html).toContain('xp-status xp-warn');expect(html).not.toMatch(/<script/i);
 await d.getByRole('button',{name:'Edit board',exact:true}).click();
 await expect(d.getByTestId('item-ql-kpi-prod').getByRole('button',{name:'Focus item',exact:true})).toBeVisible();
 await d.getByRole('button',{name:'Report view',exact:true}).click();
 await expect(d.locator('.xp-rail')).toBeVisible();
 await d.getByRole('button',{name:'Back to scope map',exact:true}).click();
 await d.locator('.xp-nav').getByRole('button',{name:'BI reporting and data model',exact:true}).click();
 await d.locator('.xp-nav').getByRole('button',{name:/Define a revenue measure/}).click();
 const tabs=d.getByTestId('item-dax-tabs');
 await expect(tabs.locator('.xp-tab-panels>section').first()).toContainText('TOTALYTD');
 await expect(tabs.getByText('FROM dbo.Fact_Energy f')).toBeHidden();
 await tabs.getByText('SQL source query',{exact:true}).click();
 await expect(tabs.getByText('FROM dbo.Fact_Energy f')).toBeVisible();
 await expect(d.getByTestId('item-dax-fact')).toContainText('20250101');
 mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/report-daxsql.png',fullPage:true});
 expect(errors).toEqual([]);
});
