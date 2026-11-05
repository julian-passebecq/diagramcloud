import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {parseDocument,type Project} from '../../src/core/model';
import {publicDocument} from '../../src/core/operations';
import {prepareExplanationWalkthrough} from '../../src/intelligence/explanationWalkthrough';

/** The synthetic retry example with its walkthrough already applied (private), as a person would import it. */
const appliedExample=()=>{const base=parseDocument(readFileSync('examples/pro-expressiveness/retry-metadata.base.json','utf8'));
 return prepareExplanationWalkthrough(base,JSON.parse(readFileSync('examples/pro-expressiveness/retry-metadata.walkthrough.json','utf8'))).preview;};
async function pane(page:Page,name:'Explorer'|'View'){const nav=page.getByRole('navigation',{name:'Workspace panes',exact:true});if(await nav.isVisible())await nav.getByRole('button',{name,exact:true}).click();}
async function stored(page:Page,id:string):Promise<Project>{return page.evaluate(id=>new Promise<Project>((resolve,reject)=>{
 const r=indexedDB.open('diagramcloud-v1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,get=db.transaction('projects','readonly').objectStore('projects').get(id);get.onsuccess=()=>{db.close();resolve(JSON.parse(get.result.json));};get.onerror=()=>{db.close();reject(get.error);};};
}),id);}
async function openTours(page:Page){await page.getByRole('tab',{name:'Edit',exact:true}).click();await pane(page,'Explorer');await page.getByRole('button',{name:'Tours',exact:true}).click();}
async function openApplied(page:Page){
 await page.goto('/?workspace=v3');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(appliedExample()));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();await openTours(page);
 return stored(page,'retry-metadata');
}
async function undoTo(page:Page,expected:Project){
 await pane(page,'View');await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await expect.poll(async()=>JSON.stringify(await stored(page,expected.id))).toBe(JSON.stringify(expected));
}
async function noHorizontalOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);}

for(const width of [1440,390])test.describe(`explanation revise and remove ${width}`,()=>{
 test.use({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
 test('revise rebuilds the applied request, applies one revision and Undo restores it exactly',async({page})=>{
  const before=await openApplied(page),section=page.getByRole('region',{name:'Applied explanations',exact:true});
  await expect(section.getByLabel('Existing explanation',{exact:true})).toHaveValue('lesson');
  await section.getByRole('button',{name:'Revise explanation',exact:true}).click();
  const form=page.getByRole('dialog',{name:'Revise an explanation',exact:true});
  await expect(form.getByLabel('Walkthrough ID',{exact:true})).toHaveValue('lesson');await expect(form.getByLabel('Walkthrough ID',{exact:true})).toHaveAttribute('readonly','');
  await expect(form.getByLabel('Explanation title',{exact:true})).toHaveValue('Retries, decorators and function identity');
  await expect(form.getByLabel('Step 1 narration',{exact:true})).toHaveValue(/The caller names fetch_weather/);
  await expect(form.getByRole('group',{name:'Step 5 (identity)',exact:true})).toBeVisible();
  if(width===390)await noHorizontalOverflow(page);
  await form.getByLabel('Step 1 narration',{exact:true}).fill('A revised synthetic narration; no call ran.');
  expect(await stored(page,before.id)).toEqual(before);
  await form.getByRole('button',{name:'Review revised explanation',exact:true}).click();
  const review=page.getByRole('dialog',{name:'Review revised explanation',exact:true});
  await expect(review.getByRole('list',{name:'Effects of this change',exact:true})).toContainText('Kept steps: call, failure, retry, success, identity');
  expect(await stored(page,before.id)).toEqual(before);
  await review.getByRole('button',{name:'Apply revised explanation',exact:true}).click();
  await expect.poll(async()=>(await stored(page,before.id)).revision).toBe(before.revision+1);
  const revised=await stored(page,before.id);
  expect(revised.tours![0].stops[0].narration).toBe('A revised synthetic narration; no call ran.');
  expect(revised.tours![0].stops.map(s=>s.id)).toEqual(before.tours![0].stops.map(s=>s.id));
  expect({...publicDocument(revised),revision:before.revision}).toEqual(publicDocument(before));
  await undoTo(page,before);
 });
 test('remove prepares a reviewed removal, applies one revision and Undo restores the explanation',async({page})=>{
  const before=await openApplied(page),section=page.getByRole('region',{name:'Applied explanations',exact:true});
  await section.getByRole('button',{name:'Remove explanation',exact:true}).click();
  const review=page.getByRole('dialog',{name:'Review explanation removal',exact:true});
  await expect(review.getByRole('list',{name:'Effects of this change',exact:true})).toContainText('Original components, connections and evidence are unchanged');
  if(width===390)await noHorizontalOverflow(page);
  expect(await stored(page,before.id)).toEqual(before);
  await review.getByRole('button',{name:'Apply removal',exact:true}).click();
  await expect.poll(async()=>(await stored(page,before.id)).tours?.length).toBe(0);
  const removed=await stored(page,before.id);
  expect(removed.nodes.some(n=>n.id.startsWith('walk-lesson'))).toBe(false);expect(removed.blocks.some(b=>b.id.startsWith('walk-lesson'))).toBe(false);
  await expect(page.getByRole('region',{name:'Applied explanations',exact:true})).toHaveCount(0);
  await undoTo(page,before);
  await pane(page,'Explorer');await expect(page.getByRole('region',{name:'Applied explanations',exact:true}).getByLabel('Existing explanation',{exact:true})).toHaveValue('lesson');
 });
 test('an edited generated stop is refused with a reason and nothing changes',async({page})=>{
  const doc=appliedExample();doc.tours![0].stops[0].narration='Edited in Tours after Apply.';
  await page.goto('/?workspace=v3');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));
  await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
  await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();await openTours(page);const before=await stored(page,doc.id);
  const section=page.getByRole('region',{name:'Applied explanations',exact:true});
  await expect(section.getByRole('status')).toContainText('narration copies disagree');
  // Refused actions stay focusable (aria-disabled) and say why when activated by keyboard.
  for(const name of ['Revise explanation','Remove explanation']){const button=section.getByRole('button',{name,exact:true});
   await expect(button).toHaveAttribute('aria-disabled','true');await button.focus();await page.keyboard.press('Enter');
   await expect(page.getByRole('alert').filter({hasText:'narration copies disagree'})).toBeVisible();}
  await expect(page.getByRole('dialog',{name:'Revise an explanation',exact:true})).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'Review explanation removal',exact:true})).toHaveCount(0);
  expect(await stored(page,doc.id)).toEqual(before);
 });
});
