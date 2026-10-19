import {test,expect,type Page} from '@playwright/test';
import {buildDomainDataReference} from '../../examples/domain-data/build';
import {validateDocument,type Project} from '../../src/core/model';

/**
 * V3 linked views: two permitted views of the synthetic domain-data teaching project (examples/domain-data, labelled
 * synthetic) side by side in the real App. Imported through the ordinary JSON dialog; every non-loopback request is
 * aborted. One mapping table is made private so the Portfolio audience can be checked.
 */
function fixture():Project{
 const p=structuredClone(buildDomainDataReference().project);
 const b=p.blocks.find(b=>b.type==='table'&&b.transform==='mapping'&&b.rows[0][3]==='sampled-into')!;b.visibility='private';
 return validateDocument(p);
}
const workspace=(page:Page)=>page.getByTestId('v3-workspace');
const linkedView=(page:Page)=>page.getByTestId('linked-perspective');
const pane=(page:Page,side:'left'|'right')=>page.locator(`.linked-pane[data-side="${side}"]`);
const paneCard=(page:Page,side:'left'|'right',label:string)=>pane(page,side).getByRole('button',{name:'Select component '+label,exact:true});
const stateLine=(page:Page,side:'left'|'right')=>pane(page,side).getByRole('status',{name:`${side==='left'?'Left':'Right'} view state`});
const toolbar=(page:Page)=>linkedView(page).getByRole('group',{name:'Linked views controls'});
const linkedToggle=(page:Page)=>workspace(page).getByRole('button',{name:'Linked views',exact:true});
async function guardNetwork(page:Page){
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(url=>!/^(https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/|data:|blob:|about:)/.test(url.toString()),route=>route.abort());
 return errors;
}
async function importFixture(page:Page,doc:Project){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
}
async function openLinked(page:Page){
 await page.getByRole('tab',{name:'Explore',exact:true}).click();
 await page.getByTestId('view-overview').getByRole('button',{name:'Explore Renewable-energy client',exact:true}).click();
 await linkedToggle(page).click();await expect(linkedToggle(page)).toHaveAttribute('aria-pressed','true');
 await expect(linkedView(page)).toBeVisible();
 await toolbar(page).getByLabel('Left view',{exact:true}).selectOption('physical');
 await toolbar(page).getByLabel('Right view',{exact:true}).selectOption('data');
 await expect(linkedView(page).getByRole('region',{name:'Business question'})).toContainText('Business question: Renewable-energy client');
}
const transform=(page:Page,side:'left'|'right')=>pane(page,side).locator('.react-flow__viewport').evaluate(e=>(e as HTMLElement).style.transform);
async function noHorizontalScroll(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
async function focusKept(page:Page){expect(await page.evaluate(()=>document.activeElement!==null&&document.activeElement!==document.body)).toBe(true);}

test.describe('1440px linked views',()=>{
 test.use({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 test('related targets, independent cameras, anchor, gaps, movable detail, history and audience',async({page})=>{
  const errors=await guardNetwork(page);
  await page.goto('/?workspace=v3');await expect(workspace(page)).toBeVisible();await importFixture(page,fixture());
  await openLinked(page);
  const revision=await page.evaluate(()=>document.body.innerText.match(/revision (\d+)/)?.[1]??'');

  // A world component with two authored relations: both data targets are offered, none is chosen.
  await paneCard(page,'left','Wind sensor channel').click();
  await expect(stateLine(page,'right')).toContainText('Several related objects: choose');
  await expect(stateLine(page,'right')).toContainText('Related, not the same object');
  await expect(pane(page,'right').locator('[data-mapping-target]')).toHaveCount(2);
  for(const id of ['data.channel','data.sample'])expect(await pane(page,'right').locator(`.react-flow__node[data-id="${id}"] .component-node`).evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('dashed');
  await expect(linkedView(page).getByRole('region',{name:'Linked detail'})).toContainText('sampled-into');
  // Choosing one moves focus to that card.
  await pane(page,'right').locator('[data-mapping-target="data.sample"]').click();
  await expect(paneCard(page,'right','Measurement sample')).toBeFocused();

  // Independent cameras: zooming the left view leaves the right viewport unchanged.
  const right=await transform(page,'right'),left=await transform(page,'left');
  await pane(page,'left').locator('.react-flow__controls-zoomin').click();
  await expect.poll(()=>transform(page,'left')).not.toBe(left);expect(await transform(page,'right')).toBe(right);

  // Swap keeps the business anchor and the picked object.
  await toolbar(page).getByRole('button',{name:'Swap sides',exact:true}).click();
  await expect(toolbar(page).getByLabel('Left view',{exact:true})).toHaveValue('data');
  await expect(linkedView(page).getByRole('region',{name:'Business question'})).toContainText('Renewable-energy client');
  await expect(stateLine(page,'left')).toContainText('Several related objects: choose');
  await toolbar(page).getByRole('button',{name:'Swap sides',exact:true}).click();
  await expect(toolbar(page).getByLabel('Left view',{exact:true})).toHaveValue('physical');

  // An explicitly unresolved mapping is shown as a gap, never as a counterpart.
  await paneCard(page,'left','Foil assembly').click();
  await expect(stateLine(page,'right')).toContainText('No counterpart in this view');await expect(stateLine(page,'left')).toContainText('Only in left view');
  await expect(linkedView(page).getByRole('note',{name:'Mapping gaps'})).toContainText('Gap: calibration-needed (unresolved).');

  // One detail slot: below the right view, saved, then restored after a reload by an explicit load.
  await toolbar(page).getByLabel('Detail placement',{exact:true}).selectOption('below-right');
  await expect(linkedView(page)).toHaveAttribute('data-placement','below-right');
  const detailBox=await linkedView(page).getByRole('region',{name:'Linked detail'}).boundingBox(),rightBox=await pane(page,'right').boundingBox();
  expect(detailBox!.x).toBeGreaterThanOrEqual(rightBox!.x-1);expect(detailBox!.y).toBeGreaterThan(rightBox!.y);
  // Closing the second view moves the slot below both; reopening restores the chosen placement.
  await toolbar(page).getByRole('button',{name:'Second view',exact:true}).click();await expect(linkedView(page)).toHaveAttribute('data-placement','below-both');
  await toolbar(page).getByRole('button',{name:'Second view',exact:true}).click();await expect(linkedView(page)).toHaveAttribute('data-placement','below-right');
  await toolbar(page).getByRole('button',{name:'Save linked layout',exact:true}).click();await expect(linkedView(page).getByText('Linked layout saved',{exact:false})).toBeVisible();
  await toolbar(page).getByLabel('Detail placement',{exact:true}).selectOption('below-both');
  expect(new URL(page.url()).searchParams.get('linked')).toBe('physical~data');expect(new URL(page.url()).searchParams.get('anchor')).toBe('wind.goal');
  await page.reload();await expect(linkedView(page)).toBeVisible();
  await expect(toolbar(page).getByLabel('Left view',{exact:true})).toHaveValue('physical');await expect(toolbar(page).getByLabel('Right view',{exact:true})).toHaveValue('data');
  await expect(toolbar(page).getByLabel('Detail placement',{exact:true})).toHaveValue('below-both');
  await toolbar(page).getByRole('button',{name:'Load saved linked layout',exact:true}).click();
  await expect(toolbar(page).getByLabel('Detail placement',{exact:true})).toHaveValue('below-right');await expect(linkedView(page)).toHaveAttribute('data-placement','below-right');

  // Each pair change is one history entry: Back and Forward restore the pair.
  await toolbar(page).getByLabel('Right view',{exact:true}).selectOption('etl');
  await page.goBack();await expect(toolbar(page).getByLabel('Right view',{exact:true})).toHaveValue('data');
  await page.goForward();await expect(toolbar(page).getByLabel('Right view',{exact:true})).toHaveValue('etl');
  // The dock's labelled route controls: unavailable ones stay focusable with aria-disabled.
  await workspace(page).getByRole('button',{name:'Bottom panel',exact:true}).click();
  const route=page.getByTestId('linked-route');await expect(route).toBeVisible();
  for(const name of ['Back','Forward','Up to parent view','Down to child view','Swap sides','Back to business question'])await expect(route.getByRole('button',{name,exact:true})).toBeVisible();
  await expect(route.getByRole('button',{name:'Forward',exact:true})).toHaveAttribute('aria-disabled','true');
  await expect(route.getByRole('button',{name:'Down to child view',exact:true})).toHaveAttribute('aria-disabled','true');
  await route.getByRole('button',{name:'Back',exact:true}).click();await expect(toolbar(page).getByLabel('Right view',{exact:true})).toHaveValue('data');
  await route.getByRole('button',{name:'Up to parent view',exact:true}).click();await expect(toolbar(page).getByLabel('Left view',{exact:true})).toHaveValue('overview');
  await page.goBack();await expect(toolbar(page).getByLabel('Left view',{exact:true})).toHaveValue('physical');

  // Portfolio reads the public copy only: the private mapping row is absent and one related target remains.
  await page.getByRole('tab',{name:'Portfolio',exact:true}).click();
  await expect(page.getByText('This linked reading is not available in the current permitted project. Nothing was changed.',{exact:true})).toBeVisible();
  await expect(linkedToggle(page)).toHaveAttribute('aria-pressed','false');
  await linkedToggle(page).click();await toolbar(page).getByLabel('Left view',{exact:true}).selectOption('physical');await toolbar(page).getByLabel('Right view',{exact:true}).selectOption('data');
  await paneCard(page,'left','Wind sensor channel').click();
  await expect(stateLine(page,'right')).toContainText('Related, not the same object');await expect(pane(page,'right').locator('[data-mapping-target]')).toHaveCount(0);
  await expect(linkedView(page)).not.toContainText('sampled-into');await expect(linkedView(page)).toContainText('described-by');
  // Linked mode never creates a revision.
  expect(await page.evaluate(()=>document.body.innerText.match(/revision (\d+)/)?.[1]??'')).toBe(revision);
  await noHorizontalScroll(page);expect(errors).toEqual([]);
 });

 test('a saved context restores the linked pair, anchor and detail placement by stable ID, never a revision',async({page})=>{
  const errors=await guardNetwork(page);
  await page.goto('/?workspace=v3');await expect(workspace(page)).toBeVisible();await importFixture(page,fixture());
  await openLinked(page);
  await toolbar(page).getByLabel('Detail placement',{exact:true}).selectOption('below-right');
  const revision=await page.evaluate(()=>document.body.innerText.match(/revision (\d+)/)?.[1]??'');
  const explorer=workspace(page).getByRole('complementary',{name:'Explorer',exact:true}),saved=page.getByTestId('saved-contexts');
  await explorer.getByRole('button',{name:'Navigate',exact:true}).click();await expect(saved).toBeVisible();
  await saved.getByLabel('Saved context name',{exact:true}).fill('Linked pair');await saved.getByRole('button',{name:'Save context',exact:true}).click();
  await expect(saved.getByRole('status')).toContainText('Saved “Linked pair” in this browser.');
  const stored=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('diagramcloud.saved-contexts.v1:')).map(k=>localStorage.getItem(k)!));
  expect(stored).toHaveLength(1);expect(stored[0]).toContain('"linked":{"leftViewId":"physical","rightViewId":"data","anchorNodeId":"wind.goal","detailPlacement":"below-right"}');
  expect(stored[0]).not.toContain('Renewable-energy client');

  // Leave linked mode and change the pair's layout; restoring brings back the pair, the anchor and the placement.
  await linkedToggle(page).click();await expect(linkedToggle(page)).toHaveAttribute('aria-pressed','false');await expect(linkedView(page)).toHaveCount(0);
  await saved.getByRole('button',{name:'Restore Linked pair',exact:true}).click();
  await expect(linkedToggle(page)).toHaveAttribute('aria-pressed','true');await expect(linkedView(page)).toBeVisible();
  await expect(toolbar(page).getByLabel('Left view',{exact:true})).toHaveValue('physical');await expect(toolbar(page).getByLabel('Right view',{exact:true})).toHaveValue('data');
  await expect(toolbar(page).getByLabel('Detail placement',{exact:true})).toHaveValue('below-right');
  await expect(linkedView(page).getByRole('region',{name:'Business question'})).toContainText('Business question: Renewable-energy client');
  for(const name of ['linked','anchor'])await expect(saved.locator(`[data-dimension="${name}"]`)).toHaveAttribute('data-state','kept');
  expect(new URL(page.url()).searchParams.get('linked')).toBe('physical~data');expect(new URL(page.url()).searchParams.get('anchor')).toBe('wind.goal');
  // The restored anchor works: Back to business question returns to the anchor component by its stable ID.
  await paneCard(page,'left','Wind sensor channel').click();
  await workspace(page).getByRole('button',{name:'Bottom panel',exact:true}).click();
  const back=page.getByTestId('linked-route').getByRole('button',{name:'Back to business question',exact:true});
  await expect(back).not.toHaveAttribute('aria-disabled','true');await back.click();
  await expect.poll(()=>new URL(page.url()).searchParams.get('node')).toBe('wind.goal');
  expect(await page.evaluate(()=>document.body.innerText.match(/revision (\d+)/)?.[1]??'')).toBe(revision);
  expect(errors).toEqual([]);
 });

 test('the V3 workspace can be the default; ?workspace=studio always opens the classic studio',async({page})=>{
  const errors=await guardNetwork(page);
  await page.goto('/');await expect(workspace(page)).toHaveCount(0);
  await page.getByRole('button',{name:'V3 workspace',exact:true}).click();await expect(workspace(page)).toBeVisible();
  await workspace(page).locator('summary',{hasText:'Layout'}).first().click();
  const choice=workspace(page).getByLabel('Open the V3 workspace by default',{exact:true});await choice.check();await expect(choice).toBeChecked();
  await expect(workspace(page).getByRole('link',{name:'Classic studio',exact:true})).toBeVisible();
  await page.goto('/');await expect(workspace(page)).toBeVisible();
  await page.goto('/?workspace=studio');await expect(page.getByRole('button',{name:'V3 workspace',exact:true})).toHaveAttribute('aria-pressed','false');await expect(workspace(page)).toHaveCount(0);
  // The header toggle keeps working, and leaving the workspace keeps the legacy escape in the URL.
  await page.getByRole('button',{name:'V3 workspace',exact:true}).click();await expect(workspace(page)).toBeVisible();
  await page.getByRole('button',{name:'V3 workspace',exact:true}).click();await expect(workspace(page)).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('workspace')).toBe('studio');
  expect(errors).toEqual([]);
 });
});

test.describe('390px linked views',()=>{
 test.use({viewport:{width:390,height:844},reducedMotion:'reduce'});
 test('one pane at a time through labelled buttons, focus kept, no horizontal scroll, public copy only',async({page})=>{
  const errors=await guardNetwork(page);
  await page.goto('/?workspace=v3');await expect(workspace(page)).toBeVisible();await importFixture(page,fixture());
  await openLinked(page);
  const nav=linkedView(page).getByRole('navigation',{name:'Linked panes'});
  await expect(nav.getByRole('button',{name:'Show left view',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(pane(page,'right')).toHaveCount(0);
  await paneCard(page,'left','Wind sensor channel').click();
  await nav.getByRole('button',{name:'Show right view',exact:true}).click();await focusKept(page);
  await expect(nav.getByRole('button',{name:'Show right view',exact:true})).toHaveAttribute('aria-pressed','true');await expect(pane(page,'left')).toHaveCount(0);
  await expect(stateLine(page,'right')).toContainText('Related, not the same object');await expect(pane(page,'right').locator('[data-mapping-target]')).toHaveCount(2);
  await pane(page,'right').locator('[data-mapping-target="data.channel"]').click();await expect(paneCard(page,'right','Channel and unit registry')).toBeFocused();
  await nav.getByRole('button',{name:'Show detail',exact:true}).click();await focusKept(page);
  await expect(linkedView(page).getByRole('region',{name:'Linked detail'})).toContainText('described-by');
  await noHorizontalScroll(page);
  await nav.getByRole('button',{name:'Show left view',exact:true}).click();await paneCard(page,'left','Foil assembly').click();
  await nav.getByRole('button',{name:'Show detail',exact:true}).click();await expect(linkedView(page).getByRole('note',{name:'Mapping gaps'})).toContainText('unresolved');
  await noHorizontalScroll(page);
  await page.getByRole('tab',{name:'Portfolio',exact:true}).click();await expect(linkedToggle(page)).toHaveAttribute('aria-pressed','false');
  await linkedToggle(page).click();await toolbar(page).getByLabel('Left view',{exact:true}).selectOption('physical');await toolbar(page).getByLabel('Right view',{exact:true}).selectOption('data');
  await paneCard(page,'left','Wind sensor channel').click();await linkedView(page).getByRole('navigation',{name:'Linked panes'}).getByRole('button',{name:'Show detail',exact:true}).click();
  await expect(linkedView(page)).not.toContainText('sampled-into');await noHorizontalScroll(page);
  expect(errors).toEqual([]);
 });
});
