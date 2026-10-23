import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {parseDocument,type Project} from '../../src/core/model';
import {publicDocument} from '../../src/core/operations';

async function pane(page:Page,name:'Explorer'|'View'){const nav=page.getByRole('navigation',{name:'Workspace panes',exact:true});if(await nav.isVisible())await nav.getByRole('button',{name,exact:true}).click();}
const original=()=>parseDocument(readFileSync('examples/pro-expressiveness/retry-metadata.base.json','utf8'));
async function openProject(page:Page,doc=original()){
 await page.goto('/?workspace=v3');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();await page.getByRole('tab',{name:'Edit',exact:true}).click();await pane(page,'Explorer');await page.getByRole('button',{name:'Tours',exact:true}).click();
 return doc;
}
async function stored(page:Page,id:string):Promise<Project>{return page.evaluate(id=>new Promise<Project>((resolve,reject)=>{
 const r=indexedDB.open('diagramcloud-v1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,get=db.transaction('projects','readonly').objectStore('projects').get(id);get.onsuccess=()=>{db.close();resolve(JSON.parse(get.result.json));};get.onerror=()=>{db.close();reject(get.error);};};
}),id);}
async function fillRequest(page:Page){
 await page.getByRole('button',{name:'Author explanation',exact:true}).click();
 const form=page.getByRole('dialog',{name:'Author an explanation',exact:true});
 await form.getByLabel('Explanation title',{exact:true}).fill('Synthetic authored explanation');
 await form.getByLabel('Question to explain',{exact:true}).fill('What does the wrapper do?');
 await form.getByLabel('Step 1 title',{exact:true}).fill('The authored call');
 await form.getByLabel('Step 1 component Retry wrapper',{exact:true}).check();
 await form.getByLabel('Step 1 narration',{exact:true}).fill('A synthetic narrated call, not an observed run.');
 return form;
}
for(const width of [1440,390])test.describe(`explanation request form ${width}`,()=>{
 test.use({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
 test('form prepares ordinary review, applies once, undoes, reloads and stays private',async({page})=>{
  const errors:string[]=[],remote:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(!['127.0.0.1','localhost'].includes(u.hostname)){remote.push(u.origin);return route.abort();}return route.continue();});
  const before=await openProject(page),form=await fillRequest(page);
  expect(await stored(page,before.id)).toEqual(before);
  const pending=page.waitForEvent('download');await form.getByRole('button',{name:'Download request draft',exact:true}).click();const backup=await pending;
  expect(await backup.failure()).toBeNull();const request=JSON.parse(readFileSync((await backup.path())!,'utf8'));
  expect(request.format).toBe('diagramcloud.explanation-walkthrough');expect(request.baseRevision).toBe(before.revision);expect(request.steps[0].nodeIds).toContain('wrapper');
  await form.getByRole('button',{name:'Review explanation',exact:true}).click();
  await expect(page.getByRole('region',{name:'Proposed changes',exact:true})).toBeVisible();
  expect(await stored(page,before.id)).toEqual(before);
  await page.getByRole('button',{name:'Apply explanation',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
  const applied=await stored(page,before.id);expect(applied.revision).toBe(before.revision+1);expect(applied.tours!.length).toBe((before.tours?.length??0)+1);
  expect(applied.nodes.some(n=>n.label==='Synthetic authored explanation'&&n.visibility==='private')).toBe(true);
  expect({...publicDocument(applied),revision:before.revision}).toEqual(publicDocument(before));
  await pane(page,'View');await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();expect(await stored(page,before.id)).toEqual(before);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();expect(await stored(page,before.id)).toEqual(applied);
  await page.reload();await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();expect(await stored(page,before.id)).toEqual(applied);
  await page.getByRole('tab',{name:'Portfolio',exact:true}).click();await expect(page.getByRole('button',{name:'Author explanation',exact:true})).toHaveCount(0);
  expect(await page.content()).not.toContain('Synthetic authored explanation');expect(errors).toEqual([]);expect(remote).toEqual([]);
 });
 test('Escape keeps a dirty request until explicit discard; no overflow or project edit',async({page})=>{
  const before=await openProject(page),form=await fillRequest(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
  expect(await form.evaluate(e=>e.scrollWidth<=e.clientWidth+2)).toBe(true);
  await page.keyboard.press('Escape');const choice=form.getByRole('alertdialog',{name:'Discard explanation draft',exact:true});await expect(choice).toBeVisible();
  await expect(choice.getByRole('button',{name:'Keep editing',exact:true})).toBeFocused();await page.keyboard.press('Enter');
  await expect(form.getByLabel('Explanation title',{exact:true})).toHaveValue('Synthetic authored explanation');
  await form.getByRole('button',{name:'Close explanation editor',exact:true}).click();await choice.getByRole('button',{name:'Discard draft',exact:true}).click();await expect(form).toHaveCount(0);
  expect(await stored(page,before.id)).toEqual(before);
 });
 test('Back to request retains every authored field and original source basis before review and Apply',async({page},testInfo)=>{
  const before=await openProject(page),form=await fillRequest(page);
  await form.getByText('Optional state, code and takeaway',{exact:true}).click();
  await form.getByRole('button',{name:'Add before state',exact:true}).click();
  await form.getByLabel('Step 1 before field 1',{exact:true}).fill('attempt');
  await form.getByLabel('Step 1 before value 1',{exact:true}).fill('0');
  await form.getByRole('button',{name:'Add after state',exact:true}).click();
  await form.getByLabel('Step 1 after field 1',{exact:true}).fill('attempt');
  await form.getByLabel('Step 1 after value 1',{exact:true}).fill('1');
  const code=before.blocks.find(b=>b.type==='code'&&before.nodes.find(n=>n.id==='wrapper')!.blockIds.includes(b.id))!;
  await form.getByLabel('Step 1 code block',{exact:true}).selectOption(code.id);
  await form.getByLabel('Step 1 takeaway',{exact:true}).fill('Illustrative state only; no code was executed.');
  const draft=async()=>{const pending=page.waitForEvent('download');await form.getByRole('button',{name:'Download request draft',exact:true}).click();const file=await pending;expect(await file.failure()).toBeNull();return JSON.parse(readFileSync((await file.path())!,'utf8'));};
  const request=await draft();
  await form.evaluate(e=>{e.scrollTop=0;});
  await page.screenshot({path:testInfo.outputPath(`request-${width}.png`)});
  await form.getByRole('button',{name:'Review explanation',exact:true}).click();
  const review=page.getByRole('dialog',{name:'Review authored explanation',exact:true});
  await expect(review.getByRole('region',{name:'Proposed changes',exact:true})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath(`review-${width}.png`)});
  expect(await stored(page,before.id)).toEqual(before);
  await review.getByRole('button',{name:'Back to request',exact:true}).click();
  await expect(form.getByLabel('Explanation title',{exact:true})).toHaveValue(request.title);
  await expect(form.getByLabel('Question to explain',{exact:true})).toHaveValue(request.question);
  await expect(form.getByLabel('Step 1 narration',{exact:true})).toHaveValue(request.steps[0].narration);
  // The downloaded request checks every optional field and the full original fingerprint,
  // not merely the visible title or revision. Returning must not silently rebase it.
  expect(await draft()).toEqual(request);
  expect(await stored(page,before.id)).toEqual(before);
  // Closing review returns to the preserved request; only the editor's explicit
  // discard decision may abandon this unsaved authored text.
  await form.getByRole('button',{name:'Review explanation',exact:true}).click();
  await page.keyboard.press('Escape');await expect(form).toBeVisible();
  expect(await draft()).toEqual(request);
  await form.getByRole('button',{name:'Review explanation',exact:true}).click();
  await review.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(form).toBeVisible();
  expect(await draft()).toEqual(request);expect(await stored(page,before.id)).toEqual(before);
  await form.getByRole('button',{name:'Review explanation',exact:true}).click();
  await review.getByRole('button',{name:'Apply explanation',exact:true}).click();
  await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
  const applied=await stored(page,before.id);expect(applied.revision).toBe(before.revision+1);
  expect(applied.tours!.length).toBe((before.tours?.length??0)+1);
  expect({...publicDocument(applied),revision:before.revision}).toEqual(publicDocument(before));
  await pane(page,'View');await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();expect(await stored(page,before.id)).toEqual(before);
 });
 test('unsupported code range is refused without discarding the author draft',async({page})=>{
  const before=await openProject(page),form=await fillRequest(page),code=before.blocks.find(b=>b.type==='code'&&before.nodes.find(n=>n.id==='wrapper')!.blockIds.includes(b.id))!;
  await form.getByText('Optional state, code and takeaway',{exact:true}).click();await form.getByLabel('Step 1 code block',{exact:true}).selectOption(code.id);
  await form.getByLabel('Step 1 last code line',{exact:true}).fill('999999');await form.getByRole('button',{name:'Review explanation',exact:true}).click();
  await expect(form.getByRole('alert')).toContainText('Code focus is outside');await expect(form.getByLabel('Explanation title',{exact:true})).toHaveValue('Synthetic authored explanation');expect(await stored(page,before.id)).toEqual(before);
 });
 test('missing Tours initialization is explicit and undoable, not a hidden preparation write',async({page})=>{
  const before=original();delete before.tours;await openProject(page,before);await page.getByRole('button',{name:'Author explanation',exact:true}).click();
  const form=page.getByRole('dialog',{name:'Author an explanation',exact:true});await expect(form.getByRole('button',{name:'Initialize Tours for explanations',exact:true})).toBeVisible();expect(await stored(page,before.id)).toEqual(before);
  await form.getByRole('button',{name:'Initialize Tours for explanations',exact:true}).click();await expect(form.getByLabel('Explanation title',{exact:true})).toBeVisible();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
  const initialized=await stored(page,before.id);expect(initialized.tours).toEqual([]);expect(initialized.revision).toBe(before.revision+1);
  await form.getByRole('button',{name:'Close explanation editor',exact:true}).click();await pane(page,'View');await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();expect(await stored(page,before.id)).toEqual(before);
 });
 test('undoing Tours initialization retains the original request through source drift and Back from review',async({page})=>{
  const before=original();delete before.tours;await openProject(page,before);await page.getByRole('button',{name:'Author explanation',exact:true}).click();
  const form=page.getByRole('dialog',{name:'Author an explanation',exact:true});
  await form.getByRole('button',{name:'Initialize Tours for explanations',exact:true}).click();
  await expect(form.getByLabel('Explanation title',{exact:true})).toBeVisible();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
  const initialized=await stored(page,before.id);expect(initialized.tours).toEqual([]);expect(initialized.revision).toBe(before.revision+1);
  await form.getByLabel('Explanation title',{exact:true}).fill('Keep this original authored request');
  await form.getByLabel('Question to explain',{exact:true}).fill('Which source cut does this request explain?');
  await form.getByLabel('Step 1 title',{exact:true}).fill('Original source');
  await form.getByLabel('Step 1 component Retry wrapper',{exact:true}).check();
  await form.getByLabel('Step 1 narration',{exact:true}).fill('Synthetic explanation bound to the initialized source.');
  const draft=async()=>{const pending=page.waitForEvent('download');await form.getByRole('button',{name:'Download request draft',exact:true}).click();const file=await pending;expect(await file.failure()).toBeNull();return JSON.parse(readFileSync((await file.path())!,'utf8'));};
  const request=await draft();expect(request.baseRevision).toBe(initialized.revision);
  // The focused download button allows the ordinary project history shortcut.
  // Undo must stale the captured request, never unmount and forget its local fields.
  await page.keyboard.press('Control+z');
  await expect(form.getByRole('alert')).toContainText('The explanation source changed');
  await expect(form.getByLabel('Explanation title',{exact:true})).toHaveValue(request.title);
  await expect(form.getByRole('button',{name:'Initialize Tours for explanations',exact:true})).toHaveCount(0);
  await expect(form.getByRole('button',{name:'Review explanation',exact:true})).toBeDisabled();
  expect(await draft()).toEqual(request);
  await expect.poll(()=>stored(page,before.id)).toEqual(before);
  // Restoring exactly the original cut permits review without rebasing the draft.
  await page.keyboard.press('Control+Shift+z');
  await expect(form.getByRole('button',{name:'Review explanation',exact:true})).toBeEnabled();
  expect(await draft()).toEqual(request);await expect.poll(()=>stored(page,before.id)).toEqual(initialized);
  await form.getByRole('button',{name:'Review explanation',exact:true}).click();
  const review=page.getByRole('dialog',{name:'Review authored explanation',exact:true});
  await review.getByRole('button',{name:'Back to request',exact:true}).focus();await page.keyboard.press('Control+z');
  await expect(review.getByRole('button',{name:'Apply explanation',exact:true})).toBeDisabled();
  await review.getByRole('button',{name:'Back to request',exact:true}).click();
  await expect(form.getByRole('alert')).toContainText('The explanation source changed');
  await expect(form.getByRole('button',{name:'Review explanation',exact:true})).toBeDisabled();expect(await draft()).toEqual(request);
  await form.getByRole('button',{name:'Close explanation editor',exact:true}).click();
  await form.getByRole('alertdialog',{name:'Discard explanation draft',exact:true}).getByRole('button',{name:'Discard draft',exact:true}).click();
  await expect(form).toHaveCount(0);await expect.poll(()=>stored(page,before.id)).toEqual(before);
 });
});
