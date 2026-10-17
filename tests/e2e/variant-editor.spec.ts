import {test,expect,type Page} from '@playwright/test';

/** P3 visual variants: draw a candidate with the ordinary editors, compare side by side with linked selection, record, apply, undo; a concurrent edit blocks rebase. */
async function editTotal(page:Page){
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await expect(page.getByRole('tab',{name:'Edit',exact:true})).toBeEnabled();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
}
const canvasNode=(page:Page,label:string)=>page.getByRole('button',{name:`Explore ${label}`,exact:true});

async function drawRename(page:Page,id:string,title:string,label:string){
 await page.getByRole('button',{name:'Variants',exact:true}).click();
 const panel=page.getByRole('region',{name:'Variants'}),form=panel.getByRole('form',{name:'New variant'});
 await form.getByLabel('Variant ID').fill(id);await form.getByLabel('Title').fill(title);
 await form.getByRole('button',{name:'Draw the candidate',exact:true}).click();
 const editor=panel.getByRole('region',{name:'Candidate editor'});
 await editor.getByRole('button',{name:'Edit component SQL quality checks',exact:true}).click();
 const component=editor.getByRole('region',{name:'Candidate component'});
 await component.getByLabel('Component label').fill(label);
 await component.getByRole('button',{name:'Apply component',exact:true}).click();
 await expect(editor.getByTestId('draft-ledger')).toContainText(`CHANGED · ${label}: renamed from "SQL quality checks"`);
 return {panel,editor};
}

test('Variant editor: draw a candidate without JSON, compare linked objects, record, apply once and undo once',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await editTotal(page);
 const {panel,editor}=await drawRename(page,'visual-cache','Visual cache','Quality gate');
 const add=editor.getByRole('form',{name:'Add candidate component'});
 await add.getByLabel('New component label').fill('Read cache');await add.getByLabel('Kind').selectOption('storage');
 await add.getByRole('button',{name:'Add component',exact:true}).click();
 const link=editor.getByRole('form',{name:'Add candidate connection'});
 await link.getByLabel('From').selectOption({label:'Quality gate'});await link.getByLabel('To').selectOption({label:'Read cache'});await link.getByLabel('Connection label').fill('caches');
 await link.getByRole('button',{name:'Add connection',exact:true}).click();
 await expect(editor.getByTestId('draft-ledger')).toContainText('ADDED · Read cache (storage)');
 await expect(editor.getByTestId('draft-ledger')).toContainText('ADDED LINK · Quality gate → Read cache (caches)');
 await expect(editor.getByTestId('draft-ledger')).toContainText('UNKNOWN · Read cache: no observation');
 // Nothing reached the model yet.
 await expect(canvasNode(page,'SQL quality checks')).toBeVisible();await expect(canvasNode(page,'Read cache')).toHaveCount(0);

 // Linked selection by exact stable ID; the counterpart that does not exist is shown absent, not matched.
 const compare=editor.getByTestId('variant-compare');
 await compare.getByRole('button',{name:'Candidate: Read cache, added',exact:true}).click();
 await expect(compare.getByTestId('absent-before')).toHaveText('Read cache is absent from the baseline.');
 await expect(compare.getByRole('button',{name:'Candidate: Read cache, added',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(compare.getByTestId('variant-evidence')).toContainText('UNKNOWN (no observation)');
 await compare.getByRole('button',{name:'Baseline: SQL quality checks, changed',exact:true}).click();
 await expect(compare.getByRole('button',{name:'Candidate: Quality gate, changed',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(compare.getByTestId('absent-before')).toHaveCount(0);await expect(compare.getByTestId('absent-after')).toHaveCount(0);
 await expect(compare.getByRole('group',{name:'Architecture / design'})).toContainText('ADDED');
 await expect(compare.getByRole('group',{name:'Implementation evidence / observation'})).toContainText('UNKNOWN');
 await editor.getByText(/Advanced: the \d+ operation\(s\) this draft records/).click();
 await expect(editor.getByTestId('draft-operations')).toContainText('"op": "test"');

 await editor.getByRole('button',{name:'Record variant from draft',exact:true}).click();
 await expect(panel.getByTestId('variant-notice')).toContainText('Variant visual-cache recorded against revision');
 const sel=panel.getByRole('region',{name:'Variant comparison'});
 await expect(sel.getByTestId('variant-state')).toContainText('Baseline current');
 await expect(sel.getByTestId('variant-ledger')).toContainText('ADDED · Read cache');
 await expect(canvasNode(page,'SQL quality checks')).toBeVisible();

 await sel.getByRole('button',{name:'Apply variant',exact:true}).click();
 await expect(panel.getByTestId('variant-notice')).toContainText(/Applied Visual cache as revision \d+\. One Undo restores revision \d+ and the variant\./);
 await expect(canvasNode(page,'Quality gate')).toBeVisible();await expect(canvasNode(page,'Read cache')).toBeVisible();
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(canvasNode(page,'SQL quality checks')).toBeVisible();await expect(canvasNode(page,'Read cache')).toHaveCount(0);
 await expect(panel.getByRole('button',{name:'Compare Visual cache',exact:true})).toBeVisible();
 expect(errors).toEqual([]);
});

test('Variant editor: a concurrent edit of the same field shows a rebase conflict and blocks rebase; editing visually re-derives operations',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await editTotal(page);
 const {panel,editor}=await drawRename(page,'rename-checks','Rename checks','Quality gate');
 await editor.getByRole('button',{name:'Record variant from draft',exact:true}).click();
 await expect(panel.getByTestId('variant-notice')).toContainText('Variant rename-checks recorded');

 // Revise it visually: operations are re-derived from the baseline.
 const sel=panel.getByRole('region',{name:'Variant comparison'});
 await sel.getByRole('button',{name:'Edit candidate visually',exact:true}).click();
 const again=panel.getByRole('region',{name:'Candidate editor'});
 await again.getByRole('button',{name:'Edit component Quality gate',exact:true}).click();
 await again.getByRole('region',{name:'Candidate component'}).getByLabel('Component label').fill('Quality gate v2');
 await again.getByRole('region',{name:'Candidate component'}).getByRole('button',{name:'Apply component',exact:true}).click();
 await expect(again.getByTestId('draft-ledger')).toContainText('CHANGED · Quality gate v2: renamed from "SQL quality checks"');
 await again.getByRole('button',{name:'Save variant changes',exact:true}).click();
 await expect(panel.getByTestId('variant-notice')).toContainText('Variant rename-checks revised');
 await expect(panel.getByRole('region',{name:'Variant comparison'}).getByTestId('variant-ledger')).toContainText('Quality gate v2');

 // Someone renames the same component on the project meanwhile.
 await page.getByRole('button',{name:'Inspector',exact:true}).click();
 await canvasNode(page,'SQL quality checks').click();
 await page.getByLabel('Component label').fill('Checks (edited by someone else)');
 await page.getByRole('button',{name:'Apply component',exact:true}).click();
 await expect(canvasNode(page,'Checks (edited by someone else)')).toBeVisible();
 await page.getByRole('button',{name:'Variants',exact:true}).click();
 await expect(panel.locator('[data-variant-status="stale"]')).toHaveText('Stale baseline');
 // The selected variant is a semantic context dimension kept by the Studio, so it is still selected after the Inspector detour.
 await expect(panel.getByRole('button',{name:'Compare Rename checks',exact:true})).toHaveAttribute('aria-pressed','true');
 const report=panel.getByTestId('rebase-report');
 await expect(report).toContainText('Rebase is refused so their edit is not overwritten');
 await expect(report.getByTestId('rebase-conflicts')).toContainText('/nodes/@checks/label: recorded "SQL quality checks", now "Checks (edited by someone else)"');
 await expect(panel.getByRole('button',{name:'Rebase on current baseline',exact:true})).toBeDisabled();
 await expect(panel.getByRole('button',{name:'Apply variant',exact:true})).toBeDisabled();
 await expect(canvasNode(page,'Checks (edited by someone else)')).toBeVisible();
 expect(errors).toEqual([]);
});

test('Variant editor: the linked comparison fits a 390 x 844 phone viewport and is keyboard operable',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await editTotal(page);
 const toggle=page.getByRole('button',{name:/sidebar/i}).first();
 if(await page.getByRole('button',{name:'Variants',exact:true}).isHidden())await toggle.click();
 const {editor}=await drawRename(page,'phone-rename','Phone rename','Quality gate');
 const node=editor.getByTestId('variant-compare').getByRole('button',{name:'Candidate: Quality gate, changed',exact:true});
 // Choosing the component to edit already linked it; Enter toggles the linked selection off, Space selects it again.
 await expect(node).toHaveAttribute('aria-pressed','true');
 await node.focus();await page.keyboard.press('Enter');await expect(node).toHaveAttribute('aria-pressed','false');
 await page.keyboard.press(' ');
 await expect(editor.getByTestId('variant-compare').getByRole('button',{name:'Baseline: SQL quality checks, changed',exact:true})).toHaveAttribute('aria-pressed','true');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(0);
});
