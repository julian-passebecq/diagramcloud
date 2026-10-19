import {test,expect,type Page} from '@playwright/test';
import {documentSchema,validateDocument,type Project} from '../../src/core/model';
import {addVariant} from '../../src/core/variants';
import {previewDeliveryBrief} from '../../src/intelligence/delivery';

/**
 * V3 W3 linked comparison, opened from the workspace's Compare task: a variant, two revisions of the session and two
 * declared environments. Pairs by exact stable ID, an absent counterpart stays absent, selecting applies nothing, Return
 * restores the reader's view and selection, and a source change marks the comparison stale without re-pairing.
 * Every fixture is synthetic: nothing was deployed, executed or observed.
 */
function fixture():Project{
 const base=validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-v3-comparison',title:'Synthetic V3 comparison',rootViewId:'root',
  summary:'Synthetic project for the linked comparison; no external facts.',
  nodes:[{id:'api',label:'Synthetic API'},{id:'data',label:'Synthetic data',kind:'storage'}],edges:[{id:'reads',source:'api',target:'data',label:'Synthetic read'}],
  views:[{id:'root',title:'Synthetic comparison root',nodeIds:['api','data'],edgeIds:['reads'],positions:{api:{x:0,y:0},data:{x:300,y:0}}}]}));
 const delivered=previewDeliveryBrief(base,{format:'diagramcloud.delivery-brief',version:1,projectId:base.id,baseRevision:base.revision,delivery:{
  environments:[{id:'dev',label:'DEV'},{id:'test',label:'TEST'}],artifacts:[],promotions:[],
  instances:[{id:'api-dev',nodeId:'api-dev-instance',componentId:'api',environmentId:'dev'},{id:'api-test',nodeId:'api-test-instance',componentId:'api',environmentId:'test'},
   {id:'data-dev',nodeId:'data-dev-instance',componentId:'data',environmentId:'dev'}]}}).document;
 // The variant adds a component whose label equals an existing one: it must never be paired by that label.
 return addVariant(delivered,{id:'cache',title:'Synthetic cache',viewId:'root',operations:[
  {op:'add',path:'/nodes/-',value:{id:'cache.copy',label:'Synthetic data',kind:'storage'}},{op:'add',path:'/views/@root/nodeIds/-',value:'cache.copy'},
  {op:'add',path:'/views/@root/positions/cache.copy',value:{x:300,y:220}}]});
}
const workspace=(page:Page)=>page.getByTestId('v3-workspace');
const explorer=(page:Page)=>workspace(page).getByRole('complementary',{name:'Explorer',exact:true});
const card=(page:Page,label:string)=>page.getByTestId('view-root').getByRole('button',{name:'Explore '+label,exact:true});
const comparison=(page:Page)=>page.getByTestId('linked-comparison');
const launcher=(page:Page)=>page.getByTestId('comparison-launcher');
async function importFixture(page:Page,doc:Project){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
}
async function current(page:Page):Promise<Project>{await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const doc=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));await page.getByRole('button',{name:'Close dialog',exact:true}).click();return doc;}
async function start(page:Page,mode:'Explore'|'Edit'){
 await page.goto('/?workspace=v3');await expect(workspace(page)).toBeVisible();
 await importFixture(page,fixture());
 await expect(page.getByRole('tab',{name:mode,exact:true})).toBeEnabled();await page.getByRole('tab',{name:mode,exact:true}).click();
 await page.getByLabel('Reading task',{exact:true}).selectOption('compare');
 await expect(launcher(page)).toBeVisible();
}
const selectedHeading=(page:Page)=>page.locator('.evidence-section h2');

test('compare a variant and two environments from the workspace, inspect absent counterparts, then return to the same view and selection',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await start(page,'Explore');
 const before=await current(page);
 await card(page,'Synthetic data').click();await expect(selectedHeading(page)).toHaveText('Synthetic data');

 // Variant: the candidate shares the label "Synthetic data" with an existing component, and is still its own object.
 await launcher(page).getByRole('button',{name:'Compare variant',exact:true}).click();
 await expect(comparison(page)).toBeVisible();await expect(page.getByTestId('view-root')).toHaveCount(0);
 await expect(comparison(page).getByTestId('comparison-pairing')).toContainText('Paired by exact stable ID');
 await expect(comparison(page).getByTestId('comparison-stale')).toHaveCount(0);
 const objects=comparison(page).getByTestId('variant-objects');
 await comparison(page).getByText(/All objects \(\d+\)/).click();
 await expect(objects.locator('tr').filter({hasText:'cache.copy'})).toContainText('absentpresentadded');
 await expect(objects.locator('tr').filter({has:page.getByText('data',{exact:true})})).toContainText('presentpresentunchanged');
 await comparison(page).getByRole('button',{name:'Variant Synthetic cache: Synthetic data, added',exact:true}).click();
 await expect(comparison(page).getByTestId('absent-before')).toHaveText('Synthetic data is absent from the baseline.');
 await expect(comparison(page).getByTestId('variant-selected')).toContainText('cache.copy');
 await expect(comparison(page).getByRole('group',{name:'Architecture / design'})).toContainText('ADDED');
 await expect(comparison(page).getByRole('group',{name:'Implementation evidence / observation'})).toContainText('UNKNOWN');
 await expect(comparison(page).getByRole('button',{name:/apply/i})).toHaveCount(0);

 // Return restores the reader's view and selection exactly.
 await comparison(page).getByRole('button',{name:'Return to workspace',exact:true}).click();
 await expect(comparison(page)).toHaveCount(0);await expect(page.getByTestId('view-root')).toBeVisible();
 await expect(selectedHeading(page)).toHaveText('Synthetic data');

 // Environments: paired by componentId; Synthetic data has no TEST declaration and is shown absent there.
 await launcher(page).getByLabel('First environment',{exact:true}).selectOption({label:'DEV'});
 await launcher(page).getByLabel('Second environment',{exact:true}).selectOption({label:'TEST'});
 await launcher(page).getByRole('button',{name:'Compare environments',exact:true}).click();
 const env=comparison(page).getByTestId('environment-compare');
 await expect(env.locator('tr[data-component-id="api"] td[data-side="right"]')).toHaveAttribute('data-state','declared');
 await expect(env.locator('tr[data-component-id="data"] td[data-side="right"]')).toHaveAttribute('data-state','absent');
 await env.getByRole('button',{name:'Synthetic data',exact:true}).click();
 await expect(env.getByTestId('absent-after')).toHaveText('Synthetic data is absent from TEST.');
 await expect(env.getByRole('group',{name:'Architecture / design'})).toContainText('DECLARED IN DEV ONLY');
 await expect(env.getByRole('group',{name:'Presentation / layout'})).toContainText('no layout difference');
 await expect(env).toContainText('UNKNOWN without separate cited evidence');
 await comparison(page).getByRole('button',{name:'Return to workspace',exact:true}).click();
 await expect(selectedHeading(page)).toHaveText('Synthetic data');

 const after=await current(page);
 expect(after.revision).toBe(before.revision);expect(after.variants?.map(v=>v.id)).toEqual(['cache']);expect(after.observations).toEqual(before.observations);
 expect(errors).toEqual([]);
});

test('a source change while comparing marks the comparison stale and never re-pairs; comparing again reads the current source',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await start(page,'Edit');
 await card(page,'Synthetic API').click();
 await explorer(page).getByRole('button',{name:'Inspector',exact:true}).click();
 const rename=async(label:string)=>{const form=explorer(page);await form.getByLabel('Component label',{exact:true}).fill(label);await form.getByRole('button',{name:'Apply component',exact:true}).click();};
 await rename('Synthetic gateway');
 await expect(launcher(page).getByRole('button',{name:'Compare with the open revision',exact:true})).toBeVisible();
 const opened=await current(page);
 await launcher(page).getByRole('button',{name:'Compare with the open revision',exact:true}).click();
 await expect(comparison(page)).toBeVisible();
 await expect(comparison(page).getByRole('group',{name:'Architecture / design'})).toContainText('Synthetic gateway: renamed from "Synthetic API"');
 await expect(comparison(page).getByTestId('comparison-stale')).toHaveCount(0);

 // The source changes while comparing: the comparison says so and keeps the pairs it read.
 await rename('Synthetic edge');
 const stale=comparison(page).getByTestId('comparison-stale');
 await expect(stale).toContainText(`revision ${opened.revision}, now ${opened.revision+1}`);await expect(stale).toContainText('nothing was re-paired');
 await expect(comparison(page)).toHaveAttribute('data-stale','true');
 await expect(comparison(page).getByRole('group',{name:'Architecture / design'})).toContainText('Synthetic gateway: renamed from "Synthetic API"');
 await expect(comparison(page).getByRole('group',{name:'Architecture / design'})).not.toContainText('Synthetic edge');

 await stale.getByRole('button',{name:'Compare again on the current source',exact:true}).click();
 await expect(comparison(page).getByTestId('comparison-stale')).toHaveCount(0);
 await expect(comparison(page).getByRole('group',{name:'Architecture / design'})).toContainText('Synthetic edge: renamed from');
 await comparison(page).getByRole('button',{name:'Return to workspace',exact:true}).click();
 await expect(selectedHeading(page)).toHaveText('Synthetic edge');
 expect(errors).toEqual([]);
});

test('selecting a pair applies nothing; Apply stays the one-revision guarded patch of the Variants panel',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await start(page,'Edit');
 const before=await current(page);
 await launcher(page).getByRole('button',{name:'Compare variant',exact:true}).click();
 for(const name of ['Variant Synthetic cache: Synthetic data, added','Baseline: Synthetic API, unchanged','Variant Synthetic cache: Synthetic data, added'])
  await comparison(page).getByRole('button',{name,exact:true}).click();
 await comparison(page).getByRole('group',{name:'Architecture / design'}).getByRole('button',{name:'ADDED',exact:true}).click();
 await expect(comparison(page).getByRole('button',{name:/apply/i})).toHaveCount(0);
 const mid=await current(page);
 expect(mid.revision).toBe(before.revision);expect(mid.nodes.map(n=>n.id)).toEqual(before.nodes.map(n=>n.id));expect(mid.variants?.map(v=>v.id)).toEqual(['cache']);

 // The Variants panel still owns Apply: one revision, the variant removed, one Undo restores both.
 await explorer(page).getByRole('button',{name:'Variants',exact:true}).click();
 const panel=explorer(page).getByRole('region',{name:'Variants'});
 await panel.getByRole('button',{name:'Compare Synthetic cache',exact:true}).click();
 await panel.getByRole('button',{name:'Apply variant',exact:true}).click();
 await expect(panel.getByTestId('variant-notice')).toContainText(/Applied Synthetic cache as revision \d+\. One Undo restores revision \d+ and the variant\./);
 await expect(comparison(page).getByTestId('comparison-stale')).toContainText('nothing was re-paired');
 const applied=await current(page);
 expect(applied.revision).toBe(before.revision+1);expect(applied.variants??[]).toEqual([]);expect(applied.nodes.some(n=>n.id==='cache.copy')).toBe(true);
 await comparison(page).getByRole('button',{name:'Return to workspace',exact:true}).click();
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 const undone=await current(page);
 expect(undone.revision).toBe(before.revision);expect(undone.variants?.map(v=>v.id)).toEqual(['cache']);
 expect(errors).toEqual([]);
});
