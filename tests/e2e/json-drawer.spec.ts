import {test,expect,type Page} from '@playwright/test';

/** Native JSON drawer: applied model, current draft and last valid preview stay distinct; Apply is one guarded, undoable revision. */
async function openDrawerOn(page:Page,component:string){
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await expect(page.getByRole('tab',{name:'Edit',exact:true})).toBeEnabled();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.getByRole('button',{name:`Explore ${component}`,exact:true}).click();
 await page.getByRole('button',{name:'JSON drawer',exact:true}).click();
 const drawer=page.getByRole('complementary',{name:'JSON drawer'});
 await expect(drawer.getByRole('region',{name:'Applied model'})).toBeVisible();
 await expect(drawer.getByRole('region',{name:'Current draft'})).toBeVisible();
 await expect(drawer.getByRole('region',{name:'Last valid preview'})).toBeVisible();
 await drawer.getByLabel('Draft scope').selectOption('node');
 await expect(drawer.getByLabel('JSON draft')).toHaveValue(/"id": "checks"/);
 return drawer;
}
const choice={id:'checks-engine',title:'Where quality checks run',goal:'Fail bad loads before reporting',options:[{id:'sql',label:'SQL assertions'},{id:'spark',label:'Spark expectations'}],recommendedOptionId:'sql',reasons:['Runs next to the data'],tradeoffs:['Less portable'],status:'candidate',origin:'ai'};

test('JSON drawer: invalid keeps the last valid preview and applies nothing; valid applies once, Undo restores, reload persists',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const drawer=await openDrawerOn(page,'SQL quality checks'),text=drawer.getByLabel('JSON draft'),apply=drawer.getByRole('button',{name:'Apply draft',exact:true});
 const revision=Number(await drawer.getByTestId('applied-revision').textContent());
 const node=JSON.parse(await text.inputValue());
 await expect(apply).toBeDisabled();

 await text.fill(JSON.stringify({...node,label:'Checks (draft)'},null,2));
 await expect(drawer.getByTestId('draft-status')).toHaveText('Edited · valid · not applied yet');
 await expect(drawer.locator('.change-preview')).toContainText('nodes +0 / ~1');
 await text.fill(JSON.stringify({...node,label:'Checks (draft)'},null,2).slice(0,-3));
 await expect(drawer.getByTestId('draft-error')).toContainText('Not valid JSON');
 await expect(apply).toBeDisabled();
 await expect(drawer.getByRole('region',{name:'Last valid preview'})).toContainText('From an earlier version of the draft');
 await expect(drawer.locator('.change-preview')).toContainText('nodes +0 / ~1');
 await expect(drawer.getByTestId('applied-revision')).toHaveText(String(revision));
 await expect(page.getByRole('button',{name:'Explore SQL quality checks',exact:true})).toBeVisible();

 await text.fill(JSON.stringify({...node,label:'Checks via drawer',choices:[choice]},null,2));
 await expect(apply).toBeEnabled();await apply.click();
 await expect(drawer.getByTestId('draft-notice')).toHaveText(`Applied as revision ${revision+1}. One Undo restores revision ${revision}.`);
 await expect(drawer.getByTestId('applied-revision')).toHaveText(String(revision+1));
 await expect(page.getByRole('button',{name:'Explore Checks via drawer',exact:true})).toBeVisible();
 const card=page.locator('.inspector .choice-card').first();
 await expect(card).toContainText('Candidate · not an accepted decision');await expect(card).not.toContainText('Accepted decision');await expect(card).toContainText('recommended, not chosen');

 await drawer.getByRole('button',{name:'Undo last revision',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explore SQL quality checks',exact:true})).toBeVisible();
 await expect(drawer.getByTestId('applied-revision')).toHaveText(String(revision));
 await expect(text).toHaveValue(/"label": "SQL quality checks"/);

 await drawer.getByRole('button',{name:'Redo revision',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explore Checks via drawer',exact:true})).toBeVisible();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.reload();
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await page.getByRole('button',{name:'Explore Checks via drawer',exact:true}).click();
 await expect(page.locator('.inspector .choice-card').first()).toContainText('Where quality checks run');
 await expect(page.locator('.inspector .choice-card').first()).toContainText('Candidate · not an accepted decision');
 expect(errors).toEqual([]);
});

test('JSON drawer: a concurrent visual edit makes Apply refuse visibly; public modes never show the drawer',async({page})=>{
 const drawer=await openDrawerOn(page,'SQL quality checks'),text=drawer.getByLabel('JSON draft');
 const node=JSON.parse(await text.inputValue());
 await text.fill(JSON.stringify({...node,summary:'Summary from the drawer'},null,2));
 await expect(drawer.getByTestId('draft-status')).toHaveText('Edited · valid · not applied yet');
 await page.getByLabel('Component label').fill('Renamed on the canvas');
 await page.getByRole('button',{name:'Apply component',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explore Renamed on the canvas',exact:true})).toBeVisible();
 await expect(drawer.getByRole('region',{name:'Applied model'})).toContainText('Apply will be refused');
 await drawer.getByRole('button',{name:'Apply draft',exact:true}).click();
 await expect(drawer.getByTestId('draft-notice')).toContainText('Nothing was applied');
 await expect(page.getByRole('button',{name:'Explore Renamed on the canvas',exact:true})).toBeVisible();
 await expect(text).toHaveValue(/Summary from the drawer/);

 await page.getByRole('tab',{name:'Portfolio',exact:true}).click();
 await expect(page.getByRole('complementary',{name:'JSON drawer'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'JSON drawer',exact:true})).toHaveCount(0);
 await expect(page.getByLabel('JSON draft')).toHaveCount(0);
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await expect(page.getByLabel('JSON draft')).toHaveValue(/Summary from the drawer/);
});

test('JSON drawer: an edited draft never lands in another project after a project switch, and still applies once back home',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const drawer=await openDrawerOn(page,'SQL quality checks'),text=drawer.getByLabel('JSON draft'),apply=drawer.getByRole('button',{name:'Apply draft',exact:true});
 const home=Number(await drawer.getByTestId('applied-revision').textContent()),node=JSON.parse(await text.inputValue());
 await text.fill(JSON.stringify({...node,label:'Checks (draft)'},null,2));
 await expect(drawer.getByTestId('draft-status')).toHaveText('Edited · valid · not applied yet');await expect(apply).toBeEnabled();
 await page.getByRole('button',{name:'Project gallery',exact:true}).click();await page.locator('.project-card').filter({hasText:'Microsoft Fabric'}).click();
 await expect(page.locator('.project-hero').getByRole('heading',{name:'Microsoft Fabric',exact:true})).toBeVisible();
 await expect(drawer.getByRole('status').filter({hasText:'This draft belongs to project'})).toBeVisible();
 await expect(apply).toBeDisabled();await expect(text).toHaveValue(/Checks \(draft\)/);
 const other=Number(await drawer.getByTestId('applied-revision').textContent());
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await expect(drawer.getByRole('status').filter({hasText:'This draft belongs to project'})).toHaveCount(0);await expect(apply).toBeEnabled();
 await apply.click();await expect(drawer.getByTestId('draft-notice')).toHaveText(`Applied as revision ${home+1}. One Undo restores revision ${home}.`);
 await page.locator('.project-card').filter({hasText:'Microsoft Fabric'}).click();await expect(drawer.getByTestId('applied-revision')).toHaveText(String(other));
 await drawer.getByRole('button',{name:'Reload from applied model',exact:true}).click();await expect(text).not.toHaveValue(/Checks \(draft\)/);
 expect(errors).toEqual([]);
});
