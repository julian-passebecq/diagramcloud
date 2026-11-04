import {test,expect,type Page} from '@playwright/test';
import {validateDocument} from '../../src/core/model';

const fixture=()=>validateDocument({schemaVersion:1,id:'connected-workspace',title:'Synthetic connected workspace',rootViewId:'root',summary:'Synthetic navigation fixture; no repository or runtime claim.',
 nodes:[{id:'intake',label:'Order intake',summary:'Accept order records and validate their shape.',role:'Own the schema boundary.',childViewId:'implementation',blockIds:['sample']},{id:'store',label:'Order storage',kind:'storage',summary:'Retain accepted order records.'},{id:'check',label:'Schema check',kind:'function',summary:'Reject records without an order identifier.'}],
 edges:[{id:'accepted',source:'intake',target:'store',label:'Accepted order records',kind:'batch'}],
 views:[{id:'root',title:'Order overview',nodeIds:['intake','store'],edgeIds:['accepted'],positions:{intake:{x:0,y:0},store:{x:330,y:0}}},{id:'implementation',title:'Validation implementation',nodeIds:['check'],positions:{check:{x:0,y:0}}}],
 blocks:[{id:'sample',title:'Sample record',type:'code',language:'json',code:'{"order_id":"synthetic-1"}',provenance:'synthetic'}],
 story:[{title:'Receive orders',viewId:'root',nodeId:'intake',narration:'Authored first explanation step.'},{title:'Inspect validation',viewId:'implementation',nodeId:'check',narration:'Authored detail step, not an execution.'}]});
const tree=(page:Page)=>page.getByTestId('project-navigator');
const detail=(page:Page)=>page.getByTestId('component-context');
const dock=(page:Page)=>page.getByRole('region',{name:'Project workflow and source dock',exact:true});
async function open(page:Page){
 await page.goto('/?workspace=v3');
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(fixture()));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Explore',exact:true}).click();
}
async function noOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}

test('desktop tree previews and selected detail form one workspace with existing Follow and Pin',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 await expect(tree(page)).toBeVisible();await expect(detail(page)).toBeVisible();await expect(dock(page)).toBeVisible();await expect(page.getByTestId('view-root')).toBeVisible();
 for(const pane of [tree(page),detail(page),dock(page),page.getByTestId('view-root')])await expect(pane).toBeInViewport();
 const intake=tree(page).getByRole('button',{name:'Order intake',exact:true}),store=tree(page).getByRole('button',{name:'Order storage',exact:true});
 await intake.click();await expect(page.getByTestId('view-implementation').getByRole('heading',{name:'Validation implementation',exact:true})).toBeInViewport();await expect(intake).toHaveAttribute('aria-current','true');await expect(detail(page).getByRole('heading',{name:'Order intake',exact:true})).toBeVisible();
 const committed=page.url();await store.hover();await expect(detail(page).getByRole('heading',{name:'Order storage',exact:true})).toBeVisible();await expect(detail(page)).toContainText('Hover preview');expect(page.url()).toBe(committed);await expect(intake).toHaveAttribute('aria-current','true');
 await page.getByRole('heading',{name:'Explorer',exact:true}).hover();await expect(detail(page).getByRole('heading',{name:'Order intake',exact:true})).toBeVisible();expect(page.url()).toBe(committed);
 await store.click();await expect(store).toHaveAttribute('aria-current','true');await expect(detail(page).getByRole('heading',{name:'Order storage',exact:true})).toBeVisible();
 await page.getByTestId('project-context').getByRole('button',{name:'Pin context',exact:true}).click();await intake.hover();await expect(detail(page).getByRole('heading',{name:'Order storage',exact:true})).toBeVisible();
 await page.getByTestId('project-context').getByRole('button',{name:'Follow selection',exact:true}).click();
 await page.getByRole('heading',{name:'Explorer',exact:true}).hover();const beforeFocus=page.url();await intake.focus();await expect(detail(page).getByRole('heading',{name:'Order intake',exact:true})).toBeVisible();await expect(store).toHaveAttribute('aria-current','true');expect(page.url()).toBe(beforeFocus);
 await page.keyboard.press('Enter');await expect(intake).toHaveAttribute('aria-current','true');await expect(detail(page)).toContainText('Own the schema boundary.');await expect(detail(page)).toContainText('Accepted order records');await expect(detail(page)).toContainText('Sample record');await noOverflow(page);
});

test('route context collapses with focus retained and the bottom dock navigates supplied story without Git invention',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 const route=page.getByRole('button',{name:'Route bar',exact:true}),rail=page.getByRole('navigation',{name:'Semantic navigation',exact:true});
 const wasOpen=await route.getAttribute('aria-expanded')==='true';await route.focus();await page.keyboard.press('Enter');await expect(route).toBeFocused();await expect(route).toHaveAttribute('aria-expanded',String(!wasOpen));
 if(wasOpen)await expect(rail).toBeHidden();else await expect(rail).toBeVisible();
 await page.keyboard.press('Enter');await expect(route).toBeFocused();await expect(route).toHaveAttribute('aria-expanded',String(wasOpen));
 await dock(page).getByRole('tab',{name:'Workflow',exact:true}).click();await expect(dock(page)).toContainText('Presented sequence');await dock(page).getByRole('button',{name:'2. Inspect validation',exact:true}).click();
 await expect(page.getByTestId('view-implementation')).toBeVisible();await expect(page.getByTestId('view-implementation').getByRole('heading',{name:'Validation implementation',exact:true})).toBeInViewport();await expect(detail(page).getByRole('heading',{name:'Schema check',exact:true})).toBeVisible();
 await dock(page).getByRole('tab',{name:'Sources & Git',exact:true}).click();await expect(dock(page)).toContainText('No repository snapshot supplied');await expect(dock(page)).toContainText('A document revision is not a Git commit');await expect(dock(page)).toContainText('No evidence sources supplied');await noOverflow(page);
});

test('compact workspace keeps tree, detail and workflow reachable by keyboard without page overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);const panes=page.getByRole('navigation',{name:'Workspace panes',exact:true});
 async function show(label:string){const button=panes.getByRole('button',{name:label,exact:true});await button.focus();await page.keyboard.press('Enter');await expect(button).toHaveAttribute('aria-pressed','true');await noOverflow(page);}
 await show('Explorer');const intake=tree(page).getByRole('button',{name:'Order intake',exact:true});await intake.focus();await page.keyboard.press('Enter');
 await show('Explanation / compare');await expect(detail(page).getByRole('heading',{name:'Order intake',exact:true})).toBeVisible();
 await show('Map / activity');const workflow=dock(page).getByRole('tab',{name:'Workflow',exact:true});await workflow.focus();await page.keyboard.press('Enter');await expect(workflow).toHaveAttribute('aria-selected','true');
 await dock(page).getByRole('button',{name:'2. Inspect validation',exact:true}).focus();await page.keyboard.press('Enter');
 await show('View');await expect(page.getByTestId('view-implementation')).toBeVisible();await expect(page.getByTestId('view-implementation').getByRole('heading',{name:'Validation implementation',exact:true})).toBeInViewport();await noOverflow(page);
});
