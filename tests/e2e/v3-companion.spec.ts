import {test,expect,type Locator,type Page} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {validateDocument,type Project} from '../../src/core/model';
import {prepareExplanationFiles} from '../../scripts/prepare-explanation';

/**
 * V3 companion pane, walkthrough import and focused export (UX31-UX33), in the real App.
 * The retry example is an original synthetic teaching fixture; the walkthrough patch is the `npm run explain` output.
 */
const EXAMPLE='examples/pro-expressiveness/retry-metadata';
const TITLE='Retries, decorators and function identity';
const STEP='The caller invokes one logical operation';
const workspace=(page:Page)=>page.getByTestId('v3-workspace');
const card=(page:Page,view:string,label:string)=>page.getByTestId('view-'+view).getByRole('button',{name:'Explore '+label,exact:true});
const companion=(page:Page)=>page.getByTestId('companion-pane');
const anchor=(page:Page)=>companion(page).getByRole('status',{name:'Companion anchor'});
const crumbs=(page:Page)=>page.getByLabel('Diagram path',{exact:true});

async function explainPatch(testInfo:{outputPath:(name:string)=>string}):Promise<string>{
 const out=testInfo.outputPath('explain');await fs.rm(out,{recursive:true,force:true});await fs.mkdir(path.dirname(out),{recursive:true});
 await prepareExplanationFiles(['--project',EXAMPLE+'.base.json','--request',EXAMPLE+'.walkthrough.json','--out',out]);
 return fs.readFile(path.join(out,'explanation.patch.json'),'utf8');
}
async function importText(page:Page,text:string){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(text);
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
}
async function current(page:Page):Promise<Project>{await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const doc=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));await page.getByRole('button',{name:'Close dialog',exact:true}).click();return doc;}
async function openRetryExample(page:Page){
 await importText(page,await fs.readFile(EXAMPLE+'.base.json','utf8'));
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
}
/** The walkthrough patch goes through the ordinary review: preview, Apply, Undo and Redo, one revision. */
async function importWalkthrough(page:Page,patch:string){
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 const before=await current(page);
 await importText(page,patch);
 const review=page.getByRole('region',{name:'Proposed changes'});await expect(review).toBeVisible();
 await expect(card(page,'overview',TITLE),'the preview applies nothing').toHaveCount(0);
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(card(page,'overview',TITLE)).toBeVisible();
 const applied=await current(page);expect(applied.revision).toBe(before.revision+1);expect(applied.tours?.length).toBe(1);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(card(page,'overview',TITLE)).toHaveCount(0);
 expect(await current(page)).toEqual(before);
 await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(card(page,'overview',TITLE)).toBeVisible();
 return applied;
}
const isFocused=(l:Locator)=>l.evaluate(e=>e===document.activeElement).catch(()=>false);
async function tabTo(page:Page,target:Locator,back=false,max=400){
 await expect(target).toBeVisible();
 for(let i=0;i<max;i++){if(await isFocused(target))return;await page.keyboard.press(back?'Shift+Tab':'Tab');expect(await page.evaluate(()=>document.activeElement!==document.body),'focus never falls to body').toBe(true);}
 throw new Error(`Not reachable by ${back?'Shift+':''}Tab: ${target}`);
}

test('retry example: walkthrough patch review, steps, companion tabs, related detour and explicit return',async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?workspace=v3');await expect(workspace(page)).toBeVisible();
 await openRetryExample(page);
 const applied=await importWalkthrough(page,await explainPatch(testInfo));
 await page.getByRole('tab',{name:'Explore',exact:true}).click();

 // Walkthrough steps: entry card, index of steps, then one step frame with its note, kept under its parents.
 // Keyboard activation: the canvas keeps its viewport after Apply, so the new entry card can sit outside the visible area.
 await card(page,'overview',TITLE).press('Enter');await expect(page.getByTestId('view-walk-lesson.index')).toBeVisible();
 for(const step of [STEP,'First response is 503 in this selected scenario','Repeat the same request edge with a new attempt','This branch succeeds; another branch can exhaust retries','wraps preserves metadata, not retry correctness'])
  await expect(card(page,'walk-lesson.index',step)).toBeVisible();
 await card(page,'walk-lesson.index',STEP).click();
 const stepView=page.getByTestId('view-walk-lesson.call.view');await expect(stepView).toBeVisible();
 await expect(crumbs(page)).toContainText('Walkthrough: '+TITLE);

 // Companion: anchored on the selected component, tabs only where there is content.
 await card(page,'walk-lesson.call.view','Retry wrapper').click();
 await expect(anchor(page)).toContainText('About Retry wrapper');await expect(anchor(page)).toContainText('Following the selection.');
 const tabs=companion(page).getByRole('tablist',{name:'Companion sections'});
 await expect(tabs.getByRole('tab')).toHaveText(['Code/State','Related','Evidence']);
 await tabs.getByRole('tab',{name:'Code/State',exact:true}).click();
 await expect(companion(page).getByRole('tabpanel')).toContainText('from functools import wraps');await expect(companion(page).getByRole('tabpanel')).toContainText('Displayed, never executed.');
 await tabs.getByRole('tab',{name:'Related',exact:true}).click();
 const coverage=companion(page).getByTestId('companion-coverage'),related=companion(page).getByRole('list',{name:'Related components'});
 await expect(coverage).toHaveText('1 related component and 1 connection within depth 1, this view, both directions, all relation kinds; display limit 20.');
 await expect(related.getByRole('listitem')).toHaveCount(1);await expect(related).toContainText('Pipeline');
 // Explicit filters: project scope reaches the Weather API through explicit connections only; an excluded kind narrows it.
 await companion(page).getByLabel('Scope',{exact:true}).selectOption('project');
 await expect(coverage).toContainText('within depth 1, the permitted project');await expect(related).toContainText('Weather API');
 await companion(page).getByRole('group',{name:'Relation kinds'}).getByLabel('query').uncheck();
 await expect(related).not.toContainText('Weather API');await expect(coverage).toContainText('batch, stream, control, dependency');
 await companion(page).getByRole('group',{name:'Relation kinds'}).getByLabel('query').check();
 await companion(page).getByLabel('Display limit',{exact:true}).selectOption('5');await expect(coverage).toContainText('display limit 5');

 // Detour: open the Weather API where it lives; the companion keeps the original question.
 await related.getByRole('button',{name:'Open Weather API as a detour',exact:true}).click();
 await expect(page.getByTestId('view-walk-lesson.call.view')).toHaveCount(0);await expect(page).toHaveURL(/node=weather/);
 await expect(anchor(page)).toContainText('About Retry wrapper');await expect(anchor(page)).toContainText('Detour: the original question stays on Retry wrapper.');
 const detour=companion(page).getByTestId('companion-detour');await expect(detour).toContainText('You opened Weather API as a detour from Retry wrapper.');
 await expect(page.getByTestId('project-context').getByRole('status',{name:'Context follow mode'})).toContainText('Following selection: Weather API');
 // A second hop keeps the first origin.
 await related.getByRole('button',{name:'Open Pipeline as a detour',exact:true}).click();
 await expect(detour).toContainText('You opened Pipeline as a detour from Retry wrapper.');
 // Explicit return: back to the step frame, under its walkthrough parents, with the wrapper selected.
 await detour.getByRole('button',{name:'Return to Retry wrapper',exact:true}).click();
 await expect(stepView).toBeVisible();await expect(crumbs(page)).toContainText('Walkthrough: '+TITLE);await expect(page).toHaveURL(/node=wrapper/);
 await expect(companion(page).getByTestId('companion-detour')).toHaveCount(0);await expect(anchor(page)).toContainText('Following the selection.');

 // Pin is respected: the companion stays on the pinned component while the selection moves.
 await page.getByTestId('project-context').getByRole('button',{name:'Pin context',exact:true}).click();
 await card(page,'walk-lesson.call.view','Pipeline').click();
 await expect(anchor(page)).toContainText('About Retry wrapper');await expect(anchor(page)).toContainText('Pinned: the companion keeps the pinned component.');
 await page.getByTestId('project-context').getByRole('button',{name:'Follow selection',exact:true}).click();await expect(anchor(page)).toContainText('About Pipeline');

 // Public audience: the walkthrough is private, so nothing of it reaches the companion or the page.
 await page.getByRole('tab',{name:'Portfolio',exact:true}).click();
 const html=await page.content();expect(html).not.toContain('Walkthrough: '+TITLE);expect(html).not.toContain('walk-lesson');
 expect(await current(page).catch(()=>applied)).toBeTruthy();
 expect(errors).toEqual([]);
});

test('focused explanation HTML is an explicit export option, offline, with keyboard focus kept',async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?workspace=v3');await openRetryExample(page);
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 const option=page.getByRole('button',{name:/^Focused explanation HTML/});await expect(option).toBeVisible();
 const pending=page.waitForEvent('download');await option.click();const download=await pending;
 expect(download.suggestedFilename()).toBe('retry-metadata.focused.html');
 const html=await fs.readFile((await download.path())!,'utf8');
 expect(html).toContain('class="focus-story"');expect(html).toContain('Return to explanation step');

 // Open it with every request blocked: it needs none.
 const offline=await context.newPage();const requests:string[]=[];
 await offline.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
 offline.on('pageerror',e=>errors.push(e.message));
 await offline.setContent(html);
 await expect(offline.getByRole('navigation',{name:'Current view context'})).toBeVisible();
 await expect(offline.getByRole('button',{name:'Return to explanation step'})).toBeDisabled();
 const wrapper=offline.locator('#views g[data-node-id="wrapper"]');
 await wrapper.focus();await offline.keyboard.press('Enter');
 await expect(offline.locator('#views g[data-node-id="wrapper"]')).toBeFocused();
 await expect(offline.locator('#details h2')).toHaveText('Retry wrapper');
 const types=await offline.locator('#details article').evaluateAll(list=>list.map(a=>a.querySelector('pre')?'code':a.querySelector('table')?'table':'text'));
 expect(types[0]).toBe('code');
 // Compact form: 390 x 844, no horizontal scroll, the same controls still reachable and focus still kept.
 await offline.setViewportSize({width:390,height:844});
 expect(await offline.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await expect(offline.getByRole('navigation',{name:'Current view context'})).toBeVisible();
 await offline.locator('#views g[data-node-id="weather"]').focus();await offline.keyboard.press('Enter');
 await expect(offline.locator('#views g[data-node-id="weather"]')).toBeFocused();await expect(offline.locator('#details h2')).toHaveText('Weather API');
 expect(requests).toEqual([]);expect(errors).toEqual([]);
});

test.describe('390 x 844',()=>{
 test.use({reducedMotion:'reduce'});
 test('companion by keyboard: list alternative opens a detour and Return comes back, no horizontal scroll',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?workspace=v3');await openRetryExample(page);await importWalkthrough(page,await explainPatch(testInfo));
  await page.getByRole('tab',{name:'Explore',exact:true}).click();
  await card(page,'overview','Retry wrapper').click();
  await page.setViewportSize({width:390,height:844});await page.mouse.move(0,0);
  const panes=workspace(page).getByRole('navigation',{name:'Workspace panes'});await expect(panes).toBeVisible();
  // Start the keyboard walk from the header, as a reader arriving on the page would.
  await page.getByRole('button',{name:'V3 workspace',exact:true}).focus();
  await tabTo(page,panes.getByRole('button',{name:'Explanation / compare',exact:true}));await page.keyboard.press('Enter');
  await expect(companion(page)).toBeVisible();await expect(anchor(page)).toContainText('About Retry wrapper');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // Tabs are one roving stop: Tab to the selected one, arrows to Related.
  const tabs=companion(page).getByRole('tablist',{name:'Companion sections'});
  const selectedTab=tabs.getByRole('tab',{selected:true});await tabTo(page,selectedTab);
  // On the overview the wrapper has code and a table but no narration: no empty Explanation tab is offered.
  await expect(tabs.getByRole('tab')).toHaveText(['Code/State','Related','Evidence']);
  await page.keyboard.press('Home');await expect(tabs.getByRole('tab',{name:'Code/State',exact:true})).toBeFocused();
  await page.keyboard.press('ArrowRight');await expect(tabs.getByRole('tab',{name:'Related',exact:true})).toBeFocused();
  const open=companion(page).getByRole('list',{name:'Related components'}).getByRole('button',{name:'Open Weather API as a detour',exact:true});
  await tabTo(page,open);await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/node=weather/);
  // The detour shows the view pane; focus follows to the opened component instead of falling to the body.
  await expect(card(page,'overview','Weather API')).toBeFocused();
  await tabTo(page,panes.getByRole('button',{name:'Explanation / compare',exact:true}),true);await page.keyboard.press('Enter');
  const back=companion(page).getByTestId('companion-detour').getByRole('button',{name:'Return to Retry wrapper',exact:true});
  await tabTo(page,back);await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/node=wrapper/);await expect(companion(page).getByTestId('companion-detour')).toHaveCount(0);
  expect(await page.evaluate(()=>document.activeElement!==document.body)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
 });
});
