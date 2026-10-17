import {test,expect,type Locator,type Page} from '@playwright/test';
import {documentSchema,validateDocument} from '../../src/core/model';

/**
 * Hierarchy navigation by keyboard at a real 390 x 844 phone viewport with reduced motion. Every control is reached
 * with real Tab / Shift+Tab presses from the previous one (no programmatic focus) and activated with Enter; focus is
 * never dropped to the page. Navigation never changes the stored revision.
 */
test.use({reducedMotion:'reduce'});

const isFocused=(l:Locator)=>l.evaluate(e=>e===document.activeElement).catch(()=>false);
async function tabTo(page:Page,target:Locator,back=false,max=160){
 await expect(target).toBeVisible();
 for(let i=0;i<max;i++){if(await isFocused(target))return;await page.keyboard.press(back?'Shift+Tab':'Tab');expect(await page.evaluate(()=>document.activeElement!==document.body),'focus never falls to body during the walk').toBe(true);}
 throw new Error(`Not reachable by ${back?'Shift+':''}Tab: ${target}`);
}
async function focusKept(page:Page){expect(await page.evaluate(()=>document.activeElement!==null&&document.activeElement!==document.body)).toBe(true);}
async function inViewport(page:Page,target:Locator){await target.scrollIntoViewIfNeeded();const box=await target.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(390);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);}

// Synthetic: root opens view A and view B; each holds a component opening the shared view (two parents). C opens a third sibling.
const synthetic=()=>validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-keyboard-walk',title:'Synthetic keyboard walk',rootViewId:'root',summary:'Synthetic hierarchy for keyboard navigation.',
 edges:[],nodes:[{id:'a',label:'Synthetic A',childViewId:'va'},{id:'b',label:'Synthetic B',childViewId:'vb'},{id:'c',label:'Synthetic C',childViewId:'other'},
  {id:'s1',label:'Synthetic S1',childViewId:'shared'},{id:'s2',label:'Synthetic S2',childViewId:'shared'},{id:'s',label:'Synthetic shared inner'},{id:'o',label:'Synthetic other inner'}],
 views:[{id:'root',title:'Synthetic root',nodeIds:['a','b','c'],positions:{a:{x:0,y:0},b:{x:300,y:0},c:{x:600,y:0}}},{id:'va',title:'Synthetic view A',nodeIds:['s1']},{id:'vb',title:'Synthetic view B',nodeIds:['s2']},
  {id:'shared',title:'Synthetic shared',nodeIds:['s']},{id:'other',title:'Synthetic other',nodeIds:['o']}],
 story:[{title:'Synthetic first step',narration:'Root.',viewId:'root',nodeId:'a'},{title:'Synthetic second step',narration:'Shared.',viewId:'shared'}]}));

async function projectJson(page:Page){await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const text=await page.getByLabel('Project JSON',{exact:true}).inputValue();await page.getByRole('button',{name:'Close dialog',exact:true}).click();return JSON.parse(text) as {revision:number};}

test('390x844 keyboard walk: canvas cards and sidebar tabs by Tab, Up Down siblings Choose parent and story steps, each one action, no revision',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 // Setup at desktop width: import the synthetic project through the JSON review.
 await page.goto('/');await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(synthetic()));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByTestId('view-root')).toBeVisible();const before=(await projectJson(page)).revision;
 await page.setViewportSize({width:390,height:844});await page.mouse.move(0,0);
 expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
 await page.locator('body').evaluate(()=>(document.activeElement as HTMLElement|null)?.blur());

 // Sidebar tabs and canvas cards are reached by real Tab presses from the top of the page.
 const sidebar=page.getByRole('complementary',{name:'Studio sidebar'}).or(page.getByLabel('Studio sidebar'));
 for(const name of ['Navigate','Project gallery','Inspector','Tours'])await tabTo(page,sidebar.getByRole('button',{name,exact:true}));
 const rail=page.getByRole('group',{name:'Hierarchy navigation'});
 const up=rail.getByRole('button',{name:'Up to parent view',exact:true}),down=rail.getByRole('button',{name:'Down to child view',exact:true});
 const previous=rail.getByRole('button',{name:'Previous sibling view',exact:true}),next=rail.getByRole('button',{name:'Next sibling view',exact:true});
 await inViewport(page,rail);
 const cardA=page.getByTestId('view-root').getByRole('button',{name:'Explore Synthetic A',exact:true});
 await tabTo(page,cardA);await page.keyboard.press('Enter');
 await expect(page.getByTestId('view-va')).toBeVisible();await focusKept(page);

 // Up: one action, back to the root with A selected; the button stays focused although Up is now unavailable.
 await tabTo(page,up,true);await page.keyboard.press('Enter');
 await expect(page.getByTestId('view-va')).toHaveCount(0);await expect(up).toHaveAttribute('aria-disabled','true');await expect(up).toBeFocused();
 // Down: one action, the child view of the selected card.
 await tabTo(page,down);await page.keyboard.press('Enter');await expect(page.getByTestId('view-va')).toBeVisible();await expect(page.getByTestId('view-root')).toBeVisible();
 // Next / Previous sibling: neighbouring child views of the same parent, the parent kept.
 await tabTo(page,next);await page.keyboard.press('Enter');await expect(page.getByTestId('view-vb')).toBeVisible();await expect(page.getByTestId('view-va')).toHaveCount(0);await expect(rail).toContainText('Sibling 2 of 3');
 await tabTo(page,previous,true);await page.keyboard.press('Enter');await expect(page.getByTestId('view-va')).toBeVisible();await expect(page.getByTestId('view-vb')).toHaveCount(0);await focusKept(page);

 // Reach the shared view through A, then make the other parent explicit with Choose parent.
 const s1=page.getByTestId('view-va').getByRole('button',{name:'Explore Synthetic S1',exact:true});await tabTo(page,s1);await page.keyboard.press('Enter');
 await expect(page.getByTestId('view-shared')).toBeVisible();
 const choose=rail.getByLabel('Choose parent',{exact:true});await expect(rail).toContainText('Synthetic shared has 2 parent paths; the choice is navigation only.');
 await tabTo(page,choose,true);await inViewport(page,choose);await page.keyboard.press('ArrowDown');
 await expect(page.getByTestId('view-vb')).toBeVisible();await expect(page.getByTestId('view-va')).toHaveCount(0);await expect(page.getByTestId('view-shared')).toBeVisible();await focusKept(page);
 // Back undoes exactly the parent choice.
 const back=page.getByRole('button',{name:'Back',exact:true});await tabTo(page,back,true);await page.keyboard.press('Enter');await expect(page.getByTestId('view-va')).toBeVisible();await expect(page.getByTestId('view-vb')).toHaveCount(0);

 // Story steps from the rail: one step per press.
 const nextStep=rail.getByRole('button',{name:'Next story step',exact:true}),previousStep=rail.getByRole('button',{name:'Previous story step',exact:true});
 await tabTo(page,nextStep);await page.keyboard.press('Enter');await expect(page.locator('.story-bar')).toContainText('1 / 2');await expect(page.locator('.story-bar')).toContainText('Synthetic first step');
 await tabTo(page,nextStep);await page.keyboard.press('Enter');await expect(page.locator('.story-bar')).toContainText('2 / 2');await expect(page.getByTestId('view-shared')).toBeVisible();
 await expect(nextStep).toHaveAttribute('aria-disabled','true');await focusKept(page);
 await tabTo(page,previousStep,true);await page.keyboard.press('Enter');await expect(page.locator('.story-bar')).toContainText('1 / 2');

 await page.setViewportSize({width:1440,height:1100});
 expect((await projectJson(page)).revision,'navigation never creates a revision').toBe(before);
 expect(errors).toEqual([]);
});
