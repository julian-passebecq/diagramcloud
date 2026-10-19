import {test,expect,type Locator,type Page} from '@playwright/test';
import {documentSchema,validateDocument,type Project} from '../../src/core/model';

/**
 * V3 workspace (W1): the real App components inside WorkbenchFrame. Explorer, Follow/Pin, parent-preserving drill,
 * browser Back/Forward and deep links, the unsaved-edit guard, audience privacy and a 390 x 844 keyboard walk.
 * Every fixture is synthetic.
 */
const PRIVATE_LABEL='SYNTHETIC_V3_PRIVATE_COMPONENT',PRIVATE_FACT='SYNTHETIC_V3_PRIVATE_FACT';
function fixture(id:string):Project{return validateDocument(documentSchema.parse({schemaVersion:1,id,title:'Synthetic V3 workspace',rootViewId:'root',
 summary:'Synthetic hierarchy for the V3 workspace; no external facts.',edges:[],
 nodes:[{id:'a',label:'Synthetic A',summary:'Synthetic A explanation',childViewId:'va'},{id:'b',label:'Synthetic B',summary:'Synthetic B explanation',childViewId:'vb'},
  {id:'hidden',label:PRIVATE_LABEL,summary:PRIVATE_FACT,visibility:'private'},
  {id:'s1',label:'Synthetic S1',childViewId:'shared'},{id:'s2',label:'Synthetic S2',childViewId:'shared'},{id:'s',label:'Synthetic shared inner'}],
 views:[{id:'root',title:'Synthetic root',nodeIds:['a','b','hidden'],positions:{a:{x:0,y:0},b:{x:300,y:0},hidden:{x:600,y:0}}},
  {id:'va',title:'Synthetic view A',nodeIds:['s1']},{id:'vb',title:'Synthetic view B',nodeIds:['s2']},{id:'shared',title:'Synthetic shared',nodeIds:['s']}]}));}

const workspace=(page:Page)=>page.getByTestId('v3-workspace');
const explorer=(page:Page)=>workspace(page).getByRole('complementary',{name:'Explorer',exact:true});
const card=(page:Page,view:string,label:string)=>page.getByTestId('view-'+view).getByRole('button',{name:'Explore '+label,exact:true});
const crumbs=(page:Page)=>page.getByLabel('Diagram path',{exact:true});
const followMode=(page:Page)=>page.getByTestId('project-context').getByRole('status',{name:'Context follow mode'});
async function importFixture(page:Page,doc:Project){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
}
async function current(page:Page):Promise<Project>{await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const doc=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));await page.getByRole('button',{name:'Close dialog',exact:true}).click();return doc;}
async function openViewFromNavigator(page:Page,title:string){
 await explorer(page).getByRole('button',{name:'Navigate',exact:true}).click();
 const nav=explorer(page).getByTestId('project-navigator');await nav.getByRole('tab',{name:'Views',exact:true}).click();
 await nav.getByRole('button',{name:title,exact:true}).click();
}
const isFocused=(l:Locator)=>l.evaluate(e=>e===document.activeElement).catch(()=>false);
async function tabTo(page:Page,target:Locator,back=false,max=200){
 await expect(target).toBeVisible();
 const seen:string[]=[];
 for(let i=0;i<max;i++){if(await isFocused(target))return;await page.keyboard.press(back?'Shift+Tab':'Tab');seen.push(await page.evaluate(()=>{const e=document.activeElement as HTMLElement|null;return e?`${e.tagName} ${e.getAttribute('aria-label')??''} ${(e.textContent??'').slice(0,30)}`:'none';}));expect(await page.evaluate(()=>document.activeElement!==document.body),'focus never falls to body during the walk: '+seen.slice(-8).join(' | ')).toBe(true);}
 throw new Error(`Not reachable by ${back?'Shift+':''}Tab: ${target}`);
}
async function focusKept(page:Page){expect(await page.evaluate(()=>document.activeElement!==null&&document.activeElement!==document.body)).toBe(true);}
async function noHorizontalScroll(page:Page,width:number){expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}

test('explorer, Follow/Pin, parent-preserving drill, browser Back/Forward and deep link in the V3 workspace',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?workspace=v3');await expect(workspace(page)).toBeVisible();
 await expect(page.getByRole('button',{name:'V3 workspace',exact:true})).toHaveAttribute('aria-pressed','true');
 const doc=fixture('synthetic-v3-workspace');await importFixture(page,doc);const before=await current(page);
 await page.getByRole('tab',{name:'Explore',exact:true}).click();

 // Explorer: the real project navigator, perspective destinations and the frame's own regions.
 await expect(explorer(page).getByTestId('project-navigator')).toBeVisible();
 await expect(workspace(page).getByRole('navigation',{name:'Workspace destinations'})).toBeVisible();
 await expect(workspace(page).getByRole('complementary',{name:'Context and explanation'})).toBeVisible();

 // Follow, then Pin: the companion keeps the pinned scope while the selection moves.
 await card(page,'root','Synthetic A').click();await expect(page.getByTestId('view-va')).toBeVisible();
 await expect(followMode(page)).toContainText('Following selection: Synthetic A');
 await page.getByTestId('project-context').getByRole('button',{name:'Pin context',exact:true}).click();
 await card(page,'root','Synthetic B').click();await expect(page.getByTestId('view-vb')).toBeVisible();
 await expect(followMode(page)).toContainText('Pinned scope: Synthetic A');await expect(followMode(page)).toContainText('Active selection: Synthetic B');
 await page.getByTestId('project-context').getByRole('button',{name:'Follow selection',exact:true}).click();await expect(followMode(page)).toContainText('Following selection: Synthetic B');

 // Parent-preserving drill: opening the shared view from the navigator keeps the chosen parent (view B).
 await card(page,'vb','Synthetic S2').click();await expect(page.getByTestId('view-shared')).toBeVisible();
 await expect(crumbs(page)).toContainText('Synthetic view B');
 await openViewFromNavigator(page,'Synthetic shared');
 await expect(crumbs(page)).toContainText('Synthetic view B');await expect(crumbs(page)).not.toContainText('Synthetic view A');
 // The hierarchy rail keeps working on the deepest view.
 await page.getByRole('button',{name:'Up to parent view',exact:true}).click();await expect(page.getByTestId('view-shared')).toHaveCount(0);await expect(page.getByTestId('view-vb')).toBeVisible();
 // From the root only, two permitted parents ask for an explicit choice; nothing is guessed.
 await openViewFromNavigator(page,'Synthetic root');await expect(page.getByTestId('view-vb')).toHaveCount(0);
 await openViewFromNavigator(page,'Synthetic shared');
 const choice=page.getByRole('group',{name:'Choose a parent path',exact:true});await expect(choice).toBeVisible();await expect(page.getByTestId('view-shared')).toHaveCount(0);
 await choice.getByRole('button',{name:'Synthetic root › Synthetic view A',exact:true}).click();
 await expect(choice).toHaveCount(0);await expect(page.getByTestId('view-shared')).toBeVisible();await expect(crumbs(page)).toContainText('Synthetic view A');
 await focusKept(page);
 // The dock's route panel lists both parents and marks the open one.
 await page.getByRole('button',{name:'Bottom panel',exact:true}).click();
 const route=page.getByTestId('workspace-route');await expect(route).toBeVisible();
 await expect(route.getByRole('button',{name:'Synthetic root › Synthetic view A',exact:true})).toHaveAttribute('aria-pressed','true');
 await route.getByRole('button',{name:'Synthetic root › Synthetic view B',exact:true}).click();await expect(crumbs(page)).toContainText('Synthetic view B');
 await expect(page).toHaveURL(/workspace=v3/);await expect(page).toHaveURL(/view=shared/);

 // Browser Back / Forward restore the exact parent chain.
 await page.goBack();await expect(crumbs(page)).toContainText('Synthetic view A');await expect(page.getByTestId('view-shared')).toBeVisible();
 await page.goBack();await expect(page.getByTestId('view-shared')).toHaveCount(0);await expect(page).toHaveURL(/view=root/);
 await page.goForward();await expect(page.getByTestId('view-shared')).toBeVisible();await expect(crumbs(page)).toContainText('Synthetic view A');
 await page.goForward();await expect(crumbs(page)).toContainText('Synthetic view B');
 expect(await current(page),'navigation never edits the project').toEqual(before);

 // A deep link opens the workspace on that view with its parent kept visible.
 await page.goto(`/?workspace=v3&project=${doc.id}&view=vb&node=s2`);
 await expect(workspace(page)).toBeVisible();await expect(page.getByTestId('view-vb')).toBeVisible();await expect(crumbs(page)).toContainText('Synthetic root');
 await expect(followMode(page)).toContainText('Following selection: Synthetic S2');
 // Leaving the workspace keeps the studio unchanged.
 await page.getByRole('button',{name:'V3 workspace',exact:true}).click();await expect(workspace(page)).toHaveCount(0);await expect(page).not.toHaveURL(/workspace=v3/);
 expect(errors).toEqual([]);
});

test('an unsaved form edit is never lost by a route change in the workspace',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?workspace=v3');await importFixture(page,fixture('synthetic-v3-dirty'));const before=await current(page);
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await card(page,'root','Synthetic A').click();await expect(page.getByLabel('Component label',{exact:true})).toHaveValue('Synthetic A');
 const summary=page.getByLabel('Component summary',{exact:true});await summary.fill('Unsaved synthetic summary');

 // Selecting another card waits: Keep editing returns to the field with the text intact.
 await card(page,'root','Synthetic B').click();
 const dialog=page.getByRole('alertdialog',{name:'Unsaved edit'});await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Keep editing',exact:true})).toBeFocused();
 await dialog.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect(summary).toBeFocused();await expect(summary).toHaveValue('Unsaved synthetic summary');await expect(page.getByLabel('Component label',{exact:true})).toHaveValue('Synthetic A');

 // Browser Back, a mode change and leaving the workspace wait too.
 await page.goBack();await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(summary).toHaveValue('Unsaved synthetic summary');
 await page.getByRole('tab',{name:'Portfolio',exact:true}).click();await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Edit',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('button',{name:'V3 workspace',exact:true}).click();await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(workspace(page)).toBeVisible();
 await expect(summary).toHaveValue('Unsaved synthetic summary');

 // Discard is explicit and then continues with the requested move; nothing was saved.
 await card(page,'root','Synthetic B').click();await dialog.getByRole('button',{name:'Discard edit and continue',exact:true}).click();
 await expect(page.getByLabel('Component label',{exact:true})).toHaveValue('Synthetic B');await focusKept(page);
 expect(await current(page)).toEqual(before);

 // An applied edit clears the guard: the next move is immediate.
 await page.getByLabel('Component summary',{exact:true}).fill('Applied synthetic summary');await page.getByRole('button',{name:'Apply component',exact:true}).click();
 await card(page,'root','Synthetic A').click();await expect(dialog).toHaveCount(0);await expect(page.getByLabel('Component label',{exact:true})).toHaveValue('Synthetic A');
 const edited=await current(page);expect(edited.nodes.find(n=>n.id==='b')!.summary).toBe('Applied synthetic summary');expect(edited.revision).toBe(before.revision+1);
 expect(errors).toEqual([]);
});

test('audience change and source replacement never show private data in any workspace pane',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?workspace=v3');const doc=fixture('synthetic-v3-privacy');await importFixture(page,doc);
 await page.getByRole('tab',{name:'Explore',exact:true}).click();
 // Author context: the private component is selectable, pinned in the companion and shown in the dock evidence panel.
 await card(page,'root',PRIVATE_LABEL).click();await page.getByTestId('project-context').getByRole('button',{name:'Pin context',exact:true}).click();
 await expect(followMode(page)).toContainText('Pinned scope: '+PRIVATE_LABEL);
 await page.getByRole('button',{name:'Bottom panel',exact:true}).click();
 await page.getByText('Dock panels',{exact:true}).click();await page.getByLabel('Second dock panel',{exact:true}).selectOption('evidence');await page.getByText('Dock panels',{exact:true}).click();
 await expect(workspace(page).getByRole('region',{name:'Selection evidence'})).toBeVisible();
 await expect(workspace(page).getByRole('region',{name:'Navigation map and contextual activity'})).toBeVisible();
 // Collapse the explorer so that it is a hidden pane, not an unmounted one.
 await page.getByRole('button',{name:'Explorer',exact:true}).click();await expect(explorer(page)).toBeHidden();
 for(const audience of ['Portfolio','Present']){
  await page.getByRole('tab',{name:audience,exact:true}).click();await expect(page.getByText('Permitted public copy',{exact:false}).first()).toBeVisible();
  const html=await page.content();expect(html,`${audience}: no private label anywhere, hidden panes included`).not.toContain(PRIVATE_LABEL);expect(html).not.toContain(PRIVATE_FACT);
  expect(page.url()).not.toContain('node=hidden');
 }
 // Back in the author context the pin was not carried across the audience change.
 await page.getByRole('tab',{name:'Explore',exact:true}).click();await expect(followMode(page)).not.toContainText('Pinned scope: '+PRIVATE_LABEL);

 // Source replacement: the same project with B made private, then the public audience.
 await card(page,'root','Synthetic B').click();await page.getByTestId('project-context').getByRole('button',{name:'Pin context',exact:true}).click();
 const live=await current(page);const replaced=structuredClone(live);replaced.nodes.find(n=>n.id==='b')!.visibility='private';replaced.nodes.find(n=>n.id==='b')!.label='SYNTHETIC_V3_NOW_PRIVATE_B';
 await importFixture(page,replaced);await expect(card(page,'root','SYNTHETIC_V3_NOW_PRIVATE_B')).toBeVisible();
 await page.getByRole('tab',{name:'Portfolio',exact:true}).click();await expect(card(page,'root','Synthetic A')).toBeVisible();
 const html=await page.content();expect(html).not.toContain('SYNTHETIC_V3_NOW_PRIVATE_B');expect(html).not.toContain(PRIVATE_LABEL);
 // A browser Back to an author-context entry never re-enters the author audience from the public copy.
 await page.goBack();await expect(page.getByRole('tab',{name:'Portfolio',exact:true})).toHaveAttribute('aria-selected','true');
 expect(await page.content()).not.toContain('SYNTHETIC_V3_NOW_PRIVATE_B');
 expect(errors).toEqual([]);
});

test('a capability brief from the explorer enters the ordinary import review and is not applied by itself',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?workspace=v3');await importFixture(page,fixture('synthetic-v3-capability'));const before=await current(page);
 await explorer(page).getByLabel('Load capability brief',{exact:true}).setInputFiles('tests/fixtures/v3-capabilities/synthetic-rag.guide.json');
 const review=page.getByRole('dialog',{name:'JSON / AI workspace'});await expect(review).toBeVisible();
 await expect(review.getByText(/^Valid: /)).toBeVisible();await expect(review.getByText('A new local project will be added.',{exact:true})).toBeVisible();
 await review.getByRole('button',{name:'Close dialog',exact:true}).click();
 expect(await current(page),'reading a brief changes nothing until the author applies it').toEqual(before);
 // Public audiences have no brief loader.
 await page.getByRole('tab',{name:'Portfolio',exact:true}).click();await expect(explorer(page).getByLabel('Load capability brief',{exact:true})).toHaveCount(0);
 expect(errors).toEqual([]);
});

test.describe('390 x 844',()=>{
 test.use({reducedMotion:'reduce'});
 test('one pane at a time, no horizontal scroll, every pane reached by keyboard and focus never on the body',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?workspace=v3');await importFixture(page,fixture('synthetic-v3-mobile'));await page.getByRole('tab',{name:'Explore',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.mouse.move(0,0);
  const panes=workspace(page).getByRole('navigation',{name:'Workspace panes'});await expect(panes).toBeVisible();await noHorizontalScroll(page,390);
  await page.locator('body').evaluate(()=>(document.activeElement as HTMLElement|null)?.blur());

  // Explorer pane by keyboard, then a navigator entry opens the view pane.
  await tabTo(page,panes.getByRole('button',{name:'Explorer',exact:true}));await page.keyboard.press('Enter');
  await expect(explorer(page)).toBeVisible();await expect(workspace(page).getByRole('region',{name:'Synthetic root'})).toBeHidden();await focusKept(page);await noHorizontalScroll(page,390);
  // The navigator's scope tabs are one roving tab stop: Tab to it, arrows between tabs.
  const nav=explorer(page).getByTestId('project-navigator');await tabTo(page,nav.getByRole('tab',{name:'Project',exact:true}));
  await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await expect(nav.getByRole('tab',{name:'Views',exact:true})).toBeFocused();await page.keyboard.press('Enter');
  await tabTo(page,nav.getByRole('button',{name:'Synthetic view A',exact:true}));await page.keyboard.press('Enter');
  await expect(page.getByTestId('view-va')).toBeVisible();await focusKept(page);await noHorizontalScroll(page,390);

  // Companion pane, then back to the view pane and a canvas card by Tab.
  await tabTo(page,panes.getByRole('button',{name:'Explanation / compare',exact:true}));await page.keyboard.press('Enter');
  await expect(page.getByTestId('project-context')).toBeVisible();await focusKept(page);await noHorizontalScroll(page,390);
  await tabTo(page,page.getByTestId('project-context').getByRole('button',{name:'Pin context',exact:true}));await page.keyboard.press('Enter');
  await expect(page.getByTestId('project-context').getByRole('button',{name:'Pin context',exact:true})).toHaveAttribute('aria-pressed','true');
  await tabTo(page,panes.getByRole('button',{name:'View',exact:true}),true);await page.keyboard.press('Enter');
  await tabTo(page,card(page,'va','Synthetic S1'));await page.keyboard.press('Enter');await expect(page.getByTestId('view-shared')).toBeVisible();await focusKept(page);
  await tabTo(page,page.getByRole('button',{name:'Up to parent view',exact:true}),true);await page.keyboard.press('Enter');await expect(page.getByTestId('view-shared')).toHaveCount(0);await focusKept(page);

  // Reading controls fold into one disclosure; the dock opens as its own pane.
  await expect(workspace(page).getByText(/Reading controls:/)).toBeVisible();
  await tabTo(page,panes.getByRole('button',{name:'Map / activity',exact:true}),true);await page.keyboard.press('Enter');
  await expect(page.getByTestId('workspace-route')).toBeVisible();await focusKept(page);await noHorizontalScroll(page,390);
  expect(errors).toEqual([]);
 });
});
