import {test,expect} from '@playwright/test';

test('table editor: build a table without JSON, reorder, edit, undo/redo and keep it after reload',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.getByRole('button',{name:'Explore SQL quality checks',exact:true}).click();
 await page.getByLabel('Block type').selectOption('table');
 const form=page.getByRole('form',{name:'Table editor'}).first();
 await expect(form.getByLabel('Table provenance')).toHaveValue('synthetic');
 await form.getByLabel('Table title').fill('Exception sample');
 await form.getByLabel('Column 1 name').fill('rule');await form.getByLabel('Column 2 name').fill('rows');
 await form.getByRole('button',{name:'+ Column',exact:true}).click();await form.getByLabel('Column 3 name').fill('owner');
 await form.getByLabel('Row 1, rule').fill('missing date');await form.getByLabel('Row 1, rows').fill('3');await form.getByLabel('Row 1, owner').fill('PMO');
 await form.getByRole('button',{name:'+ Row',exact:true}).click();
 await form.getByLabel('Row 2, rule').fill('negative cost');await form.getByLabel('Row 2, rows').fill('1');
 await form.getByRole('button',{name:'Move row 2 up',exact:true}).click();
 await expect(form.getByLabel('Row 1, rule')).toHaveValue('negative cost');
 await form.getByRole('button',{name:'Move column 3 left',exact:true}).click();
 await expect(form.getByLabel('Column 2 name')).toHaveValue('owner');
 // A duplicate column name is refused with a message, and nothing is attached.
 await form.getByLabel('Column 3 name').fill('owner');await form.getByRole('button',{name:'Attach table',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Column names must be distinct');
 await form.getByLabel('Column 3 name').fill('rows');
 await form.screenshot({path:'test-results/authoring/table-editor.png'});
 await form.getByRole('button',{name:'Attach table',exact:true}).click();

 const block=page.locator('.evidence-block').filter({hasText:'Exception sample'});
 await expect(block.locator('thead th')).toHaveText(['rule','owner','rows']);
 await expect(block.locator('tbody tr').first().locator('td')).toHaveText(['negative cost','—','1']);
 await expect(block.getByText('synthetic',{exact:true})).toBeVisible();

 // Edit it again in the same editor.
 const editor=page.locator('.block-editor').filter({hasText:'Exception sample'});await editor.locator('summary').first().click();
 await editor.getByLabel('Row 1, owner').fill('Finance');await editor.getByRole('button',{name:'Apply table',exact:true}).click();
 await expect(block.locator('tbody tr').first().locator('td').nth(1)).toHaveText('Finance');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(block.locator('tbody tr').first().locator('td').nth(1)).toHaveText('—');
 await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(block.locator('tbody tr').first().locator('td').nth(1)).toHaveText('Finance');
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.reload();await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();await page.getByRole('button',{name:'Explore SQL quality checks',exact:true}).click();
 await expect(page.locator('.evidence-block').filter({hasText:'Exception sample'}).locator('tbody tr').first().locator('td').nth(1)).toHaveText('Finance');
 expect(errors).toEqual([]);
});

test('transformation explainer, block order and sources: ordinary authoring without raw JSON',async({page})=>{
 await page.goto('/');await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();

 // A project source, then cite it from a component.
 await page.getByRole('button',{name:'Inspector',exact:true}).click();
 await page.getByRole('button',{name:'+ Add source',exact:true}).click();
 const sources=page.getByRole('form',{name:'Project sources'}),n=await sources.locator('fieldset').count();
 await sources.getByLabel(`Source ${n} title`).fill('Quality rulebook v3');await sources.getByLabel(`Source ${n} locator`).fill('Section 4.2');
 await sources.getByRole('button',{name:'Apply sources',exact:true}).click();
 await page.getByRole('button',{name:'Explore SQL quality checks',exact:true}).click();
 await page.getByRole('group',{name:'Component sources'}).getByLabel('Quality rulebook v3').check();
 await page.getByRole('button',{name:'Apply component',exact:true}).click();
 await expect(page.locator('.sources')).toContainText('Quality rulebook v3');

 await page.getByLabel('Block type').selectOption('transformation');
 await page.getByLabel('Transformation name').fill('Deduplicate orders');
 await page.getByRole('button',{name:'Add transformation explainer',exact:true}).click();
 const panel=page.getByRole('region',{name:'Transformation'});
 await expect(panel).toContainText('never executed');
 await expect(panel.locator('.transform-label')).toHaveText(['Input rows','→ Transformation logic','→ Output rows']);
 await expect(panel.locator('.evidence-block')).toHaveCount(5);
 await panel.screenshot({path:'test-results/authoring/transformation.png'});

 // Reorder: the last attached block moves up one place.
 const summaries=page.locator('.block-editor > summary'),count=await summaries.count();
 const last=await summaries.nth(count-1).innerText(),before=await summaries.nth(count-2).innerText();
 const editor=page.locator('.block-editor').nth(count-1);await editor.locator('summary').first().click();
 await editor.locator(':scope > .toolbar').getByRole('button',{name:/^Move .* up$/}).click();
 await expect(summaries.nth(count-2)).toHaveText(last);await expect(summaries.nth(count-1)).toHaveText(before);

 // A code block edits visually; the code stays display-only.
 const logic=page.locator('.block-editor').filter({hasText:'Deduplicate orders · logic'});await logic.locator('summary').first().click();
 await logic.getByLabel('Code text').fill('select 1 -- edited');await logic.getByRole('button',{name:'Apply block',exact:true}).click();
 await expect(panel.locator('pre').first()).toHaveText('select 1 -- edited');
});

test('the Inspector reads in the same order for every component: identity, meaning, realization, evidence, work, publication',async({page})=>{
 await page.goto('/');await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await page.getByRole('button',{name:'Explore SQL quality checks',exact:true}).click();
 const groups=page.locator('.inspector-grammar .inspector-group > .eyebrow');
 await expect(groups).toHaveText(['IDENTITY','MEANING','REALIZATION','EVIDENCE','WORK','PUBLICATION']);
 const realization=page.getByRole('group',{name:'Realization',exact:true});
 await expect(page.locator('.inspector-grammar')).toContainText('checks');
 await expect(page.locator('.inspector-grammar')).toContainText('illustrative design state');
 await expect(page.locator('.inspector-grammar')).toContainText('No external observation');
 await expect(realization).toBeVisible();
 await page.locator('.side-panel').screenshot({path:'test-results/authoring/inspector.png'});
});
