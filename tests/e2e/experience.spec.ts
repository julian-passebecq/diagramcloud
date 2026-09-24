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
 const deckWait=page.waitForEvent('download');await d.getByRole('button',{name:'Export PowerPoint',exact:true}).click();
 const deck=await deckWait;expect(deck.suggestedFilename()).toBe('quicklook-screen.pptx');await deck.saveAs('test-results/experience-exports/quicklook-screen.pptx');
 expect(readFileSync('test-results/experience-exports/quicklook-screen.pptx').subarray(0,2).toString()).toBe('PK');
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

test('FOIL diagram boxes open their report screens: physics formula, economics tornado, pipeline runs',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.locator('.project-card').filter({has:page.locator('strong',{hasText:/^Foil/})}).click();
 const d=page.getByRole('dialog',{name:'Evidence workspace pilot'});
 await page.getByRole('button',{name:'Open task workspace for PySpark simulation',exact:true}).click();
 await expect(d.getByRole('heading',{name:'FOIL | physics, Monte Carlo and Spark',exact:true})).toBeVisible();
 await expect(d.getByTestId('item-fp-formula').locator('.xp-formula')).toHaveText('P = ½ · ρ · A · Cp · V³');
 await expect(d.getByTestId('item-fp-method')).toContainText('1,000 draws per design');
 await d.getByRole('button',{name:'Back to scope map',exact:true}).click();
 await d.locator('.xp-nav').getByRole('button',{name:/Turn outputs into investment indicators/}).click();
 await expect(d.getByTestId('item-fe-tornado')).toContainText('-21 / +21');
 await expect(d.getByTestId('item-fe-scenarios').locator('.xp-neg')).toHaveText('-3.4');
 await expect(d.getByTestId('item-fe-boundary')).toContainText('Two decks, two illustrative sets');
 await d.getByRole('button',{name:'Close dialog'}).click();
 await page.getByRole('button',{name:'Open task workspace for Jobs, catalog and tracking',exact:true}).click();
 await expect(d.getByTestId('item-fl-runs').locator('.xp-status.xp-bad')).toHaveText('Failed');
 await expect(d.getByTestId('item-fl-mlflow')).toContainText('0.118');
 mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/report-foil-pipeline.png',fullPage:true});
 expect(errors).toEqual([]);
});

test('project deck and scope deck download as PowerPoint files',async({page})=>{
 await page.goto('/');
 await page.locator('.project-card').filter({has:page.locator('strong',{hasText:/^Foil/})}).click();
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 mkdirSync('test-results/decks',{recursive:true});
 let wait=page.waitForEvent('download');await page.getByRole('button',{name:/Project deck \(PowerPoint\)/}).click();
 let file=await wait;expect(file.suggestedFilename()).toBe('foilo-databricks.deck.pptx');await file.saveAs('test-results/decks/foilo.deck.pptx');
 expect(readFileSync('test-results/decks/foilo.deck.pptx').subarray(0,2).toString()).toBe('PK');
 await expect(page.getByRole('status')).toContainText('Project deck created: 20 slides');
 await page.getByRole('dialog',{name:'Export & share'}).getByRole('button',{name:'Close dialog'}).click();
 await page.getByRole('button',{name:'Evidence workspaces',exact:true}).click();
 const d=page.getByRole('dialog',{name:'Evidence workspace pilot'});
 await d.locator('.xp-nav').getByRole('button',{name:'All project scopes',exact:true}).click();
 wait=page.waitForEvent('download');await d.getByRole('button',{name:'Export scope deck',exact:true}).click();
 file=await wait;expect(file.suggestedFilename()).toBe('foil.deck.pptx');await file.saveAs('test-results/decks/foil-scope.deck.pptx');
 expect(readFileSync('test-results/decks/foil-scope.deck.pptx').subarray(0,2).toString()).toBe('PK');
});

test('semantic model screen draws the star schema with keys, relationships and reused measures',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Evidence workspaces',exact:true}).click();
 const d=page.getByRole('dialog',{name:'Evidence workspace pilot'}),nav=d.locator('.xp-nav');
 await nav.getByRole('button',{name:'TotalEnergies',exact:true}).first().click();
 await nav.getByRole('button',{name:/^BI reporting and data model/}).click();
 await nav.getByRole('button',{name:/Design the semantic model/}).click();
 await expect(d.getByRole('heading',{name:'Semantic data model | star schema',exact:true})).toBeVisible();
 const star=d.getByTestId('item-sm-model');
 for(const t of ['Fact_Energy','FactCapex','DimDate','DimProject'])await expect(star.locator('svg text',{hasText:new RegExp(`^${t}$`)})).toHaveCount(1);
 await expect(star.locator('svg path[stroke="#8795a8"]')).toHaveCount(10);
 await expect(star.locator('.xp-measures code')).toHaveCount(6);
 await expect(d.getByTestId('item-dax-measure')).toContainText('TOTALYTD');
 expect(errors).toEqual([]);
});

test('edit board: drag to move, drag corner to resize, overlap refused, arrow keys, report view follows',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Evidence workspaces',exact:true}).click();
 const d=page.getByRole('dialog',{name:'Evidence workspace pilot'});
 await d.locator('.xp-nav').getByRole('button',{name:'Portfolio remix',exact:true}).first().click();
 await d.getByRole('button',{name:'Edit board',exact:true}).click();
 const board=d.getByTestId('experience-board');await board.scrollIntoViewIfNeeded();
 const box=(await board.boundingBox())!,col=(box.width-32+12)/12;
 const centre=async(label:string)=>{const b=(await d.getByRole('button',{name:label,exact:true}).boundingBox())!;return {x:b.x+b.width/2,y:b.y+b.height/2};};
 const style=(id:string,prop:'gridColumn'|'gridRow')=>d.getByTestId(`item-${id}`).evaluate((el,p)=>(el as HTMLElement).style[p],prop);

 // Resize: drag the SQL panel's corner three columns to the left.
 let c=await centre('Resize panel SQL validation rule');
 await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x-3*col,c.y,{steps:8});
 await expect(d.getByTestId('drag-ghost')).toContainText('3 wide');
 await page.mouse.up();
 expect(await style('quality-sql','gridColumn')).toBe('1 / span 3');
 await expect(d.getByRole('status').filter({hasText:'SQL validation rule'})).toContainText('3 wide × 4 tall');

 // Move: drag the curve's grip three columns left into the freed space.
 c=await centre('Move panel Cumulative cost curve');
 await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x-3*col,c.y,{steps:8});
 await expect(d.getByTestId('drag-ghost')).not.toHaveClass(/xp-ghost-bad/);
 await page.mouse.up();
 expect(await style('capex-curve','gridColumn')).toBe('4 / span 6');

 // Overlap: dragging the scenario chart up onto the curve shows a red ghost and changes nothing.
 c=await centre('Move panel Scenario comparison');
 await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x,c.y-4*88,{steps:10});
 await expect(d.getByTestId('drag-ghost')).toHaveClass(/xp-ghost-bad/);
 await page.mouse.up();
 expect(await style('foil-chart','gridRow')).toBe('5 / span 4');
 await expect(d.getByRole('status').filter({hasText:'Scenario comparison'})).toContainText('not changed. That would overlap “Cumulative cost curve”');
 await expect(d.getByTestId('drag-ghost')).toHaveCount(0);

 // Keyboard: the grip moves one cell per arrow key.
 await d.getByRole('button',{name:'Move panel Delivery schedule',exact:true}).focus();
 await page.keyboard.press('ArrowDown');
 expect(await style('schedule-gantt','gridRow')).toBe('6 / span 4');
 await d.getByRole('button',{name:'Resize panel Delivery schedule',exact:true}).focus();
 await page.keyboard.press('ArrowLeft');
 expect(await style('schedule-gantt','gridColumn')).toBe('1 / span 5');

 // The report view and the saved pack use the new layout.
 await d.getByRole('button',{name:'Report view',exact:true}).click();
 expect(await d.getByTestId('item-quality-sql').evaluate(el=>(el as HTMLElement).style.gridColumn)).toBe('1 / span 3');
 await expect(d.locator('.xp-grip')).toHaveCount(0);
 expect(errors).toEqual([]);
});
