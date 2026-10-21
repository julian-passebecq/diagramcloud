import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {buildFullStackPractice} from '../../examples/interview-client/build';
import {validateDocument,type Project} from '../../src/core/model';

// Uses the existing App, IndexedDB and saved-context controls. No alternate host,
// injected route implementation, generated grading, permissions or new service.
async function importProject(page:Page,value:unknown){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(value));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
}
async function currentProject(page:Page){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const doc=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();return doc;
}
async function explorer(page:Page){
 const panes=page.getByRole('navigation',{name:'Workspace panes',exact:true});
 if(await panes.isVisible())await panes.getByRole('button',{name:'Explorer',exact:true}).click();
 await page.getByRole('button',{name:'Navigate',exact:true}).click();
}
async function primary(page:Page){
 const panes=page.getByRole('navigation',{name:'Workspace panes',exact:true});
 if(await panes.isVisible())await panes.getByRole('button',{name:'View',exact:true}).click();
}
const newBrief=()=>JSON.parse(readFileSync('examples/idea-client/orchard.brief.json','utf8'));
for(const width of [1440,390])test.describe(`learning release recovery ${width}`,()=>{
 test.use({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
 test('Beacon saved copy and its chosen shared parent survive real reload and reopen',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const original=buildFullStackPractice().project;
  await page.goto('/?workspace=v3');await importProject(page,original);
  const way=page.locator('.dc-wayfinder').filter({has:page.locator('summary')}).filter({hasText:'Where am I?'}).first();
  await way.locator('summary').click();
  const children=page.getByRole('navigation',{name:'Inside current level',exact:true});
  await children.getByRole('button',{name:'Full-stack responsibilities',exact:true}).click();
  await children.getByRole('button',{name:'Data grain and provenance',exact:true}).click();
  await page.getByLabel('Navigation presentation',{exact:true}).selectOption('tree');
  const tree=page.getByRole('navigation',{name:'Explicit view hierarchy',exact:true});
  await expect(tree.getByRole('button',{name:'Data grain and provenance',exact:true})).toHaveCount(2);
  await expect(tree.locator('[aria-current="location"]')).toHaveCount(1);
  await explorer(page);const saved=page.getByTestId('saved-contexts');
  await saved.getByLabel('Saved context name',{exact:true}).fill('Beacon through application');
  await saved.getByRole('button',{name:'Save context',exact:true}).click();
  await expect(saved.getByRole('status')).toContainText('Saved');
  const before=await currentProject(page);expect(before).toEqual(original);
  // Prove the actual App saved the data, rather than obtaining another sample from the import helper.
  const stored=await page.evaluate(id=>new Promise<string>((resolve,reject)=>{
   const request=indexedDB.open('diagramcloud-v1',1);request.onerror=()=>reject(request.error);
   request.onsuccess=()=>{const db=request.result,get=db.transaction('projects','readonly').objectStore('projects').get(id);
    get.onerror=()=>{db.close();reject(get.error);};get.onsuccess=()=>{const json=get.result?.json;db.close();typeof json==='string'?resolve(json):reject(Error('Saved copy missing'));};};
  }),original.id);
  expect(validateDocument(JSON.parse(stored))).toEqual(before);
  await page.reload();await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
  // A stable project deep link explicitly reopens its stored copy. No second import occurs.
  await page.goto('/?workspace=v3&project='+original.id);await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
  await explorer(page);await saved.getByRole('button',{name:'Restore Beacon through application',exact:true}).click();
  const restored=saved.getByRole('status',{name:'Restored dimensions'});
  await expect(restored.locator('[data-dimension="path"]')).toHaveAttribute('data-state','kept');
  await expect(restored.locator('[data-dimension="view"]')).toHaveAttribute('data-state','kept');
  await primary(page);await way.locator('summary').click();
  await expect(page.getByRole('navigation',{name:'Current reading route'})).toContainText('Full-stack responsibilities');
  await expect(page.getByRole('navigation',{name:'Current reading route'})).toContainText('Data grain and provenance');
  expect(await currentProject(page)).toEqual(before);expect(errors).toEqual([]);
 });
 test('brainstorm focus, return and view switching keep keyboard location and source unchanged',async({page})=>{
  await page.goto('/?workspace=v3');await importProject(page,newBrief());
  const before=await currentProject(page);
  await page.getByRole('button',{name:'Brainstorm',exact:true}).click();await primary(page);
  const ideas=page.getByRole('region',{name:'Brainstorming workspace',exact:true});
  const first=ideas.locator('.dc-idea-card').first();const id=await first.getAttribute('data-idea-id');
  await first.focus();await page.keyboard.press('Enter');
  const focus=ideas.getByRole('button',{name:'Focus selected idea',exact:true});await focus.focus();await page.keyboard.press('Enter');
  await expect(ideas.locator('main>h3')).toBeFocused();
  await ideas.getByRole('button',{name:'Back to All permitted ideas',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(ideas.locator('[data-idea-id="'+id+'"]')).toBeFocused();
  await ideas.getByRole('button',{name:'Focus selected idea',exact:true}).click();
  await ideas.getByRole('button',{name:'Comparison matrix',exact:true}).click();
  await expect(ideas.getByRole('table')).toBeVisible();await expect(ideas.locator('.dc-idea-focus')).toHaveCount(0);
  await ideas.getByRole('button',{name:'Scope summary',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(ideas.getByRole('heading',{name:'Scope synthesis',exact:true})).toBeFocused();
  expect(await currentProject(page)).toEqual(before);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
 test('private brainstorming pins and searches do not survive the public audience or its exported file',async({page})=>{
  const b=newBrief();b.provenance='supplied-discussion';b.visibility='private';
  b.title='PRIVATE_BRAINSTORM_TITLE';b.question='PRIVATE_BRAINSTORM_QUESTION';b.ideas[0].title='PRIVATE_IDEA_LABEL';
  b.ideas[0].proposal='PRIVATE_IDEA_CONTENT';
  await page.goto('/?workspace=v3');await importProject(page,b);
  const before:Project=await currentProject(page);
  await page.getByRole('button',{name:'Brainstorm',exact:true}).click();await primary(page);
  const ideas=page.getByRole('region',{name:'Brainstorming workspace',exact:true});
  await ideas.getByLabel('Search ideas').fill('PRIVATE_IDEA_LABEL');await ideas.locator('.dc-idea-card').click();
  await ideas.getByRole('button',{name:'Pin detail',exact:true}).click();
  await page.getByRole('tab',{name:'Portfolio',exact:true}).click();
  await expect(ideas).toHaveCount(0);await expect(page.getByRole('button',{name:'Brainstorm',exact:true})).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toContain('PRIVATE_');
  await page.getByRole('button',{name:'Export & share',exact:true}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:/^Public JSON/}).click();
  const file=await download;expect(await file.failure()).toBeNull();const path=await file.path();expect(path).not.toBeNull();
  expect(readFileSync(path!,'utf8')).not.toContain('PRIVATE_');await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByRole('tab',{name:'Explore',exact:true}).click();await primary(page);
  if(!await ideas.isVisible())await page.getByRole('button',{name:'Brainstorm',exact:true}).click();
  await expect(ideas.getByLabel('Search ideas')).toHaveValue('');
  await expect(ideas.getByRole('button',{name:'Unpin detail',exact:true})).toHaveCount(0);
  expect(await currentProject(page)).toEqual(before);
 });
});
