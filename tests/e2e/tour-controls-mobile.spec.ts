import {test,expect,type Locator,type Page} from '@playwright/test';

/**
 * Tour and saved-context controls at a real 390 x 844 phone viewport, by keyboard only, with reduced motion.
 * Every control is reached with Tab (or Shift+Tab) from the previous one and activated with Enter or Space;
 * no pointer event is sent. Proof is the viewport itself: no full-page capture is taken.
 */
test.use({reducedMotion:'reduce'});
test.beforeEach(async({page})=>{await page.setViewportSize({width:390,height:844});});

const isFocused=(l:Locator)=>l.evaluate(e=>e===document.activeElement).catch(()=>false);
/** Moves focus with Tab (or Shift+Tab) until the target has it; fails when it is not reachable. */
async function tabTo(page:Page,target:Locator,back=false,max=120){
 await expect(target).toBeVisible();
 for(let i=0;i<max;i++){if(await isFocused(target))return;await page.keyboard.press(back?'Shift+Tab':'Tab');}
 throw new Error(`Not reachable by ${back?'Shift+':''}Tab: ${target}`);
}
async function press(page:Page,target:Locator,key='Enter',back=false){await tabTo(page,target,back);await page.keyboard.press(key);}
/** Focus is never dropped to the document after a control acts. */
async function focusKept(page:Page){expect(await page.evaluate(()=>document.activeElement!==null&&document.activeElement!==document.body)).toBe(true);}
/** The control is inside the 390 px viewport and the page has no horizontal scroll. */
async function reachable(page:Page,target:Locator){
 await target.scrollIntoViewIfNeeded();const box=await target.boundingBox();expect(box,`${target} has a box`).not.toBeNull();
 expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(390);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 // Not clipped by a horizontally scrolling ancestor either.
 expect(await target.evaluate(e=>{const r=e.getBoundingClientRect();for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p);if(s.overflowX==='visible')continue;const q=p.getBoundingClientRect();if(r.left<q.left-1||r.right>q.right+1)return false;}return true;})).toBe(true);
}

async function editTotal(page:Page){
 await page.goto('/');
 const card=page.locator('.project-card').filter({hasText:'TotalEnergies'});
 await card.focus();await page.keyboard.press('Enter');
 const edit=page.getByRole('tab',{name:'Edit',exact:true});await expect(edit).toBeEnabled();
 await edit.focus();await page.keyboard.press('Enter');await expect(edit).toHaveAttribute('aria-selected','true');
}

test('390x844, keyboard only, reduced motion: record and resume a tour, reorder and remove a stop, save and restore a context',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 expect(await page.evaluate(()=>window.innerWidth)).toBe(390);
 await editTotal(page);
 expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);

 const toursTab=page.getByRole('button',{name:'Tours',exact:true});
 const panel=page.getByRole('region',{name:'Tours'}),form=panel.getByRole('form',{name:'Record a tour stop'}),player=panel.getByRole('region',{name:'Tour player'}),stopForm=player.getByRole('form',{name:'Edit this stop'});
 // Select a component by keyboard, then open Tours.
 const checks=page.getByRole('button',{name:'Explore SQL quality checks',exact:true});await checks.focus();await page.keyboard.press('Enter');
 await toursTab.focus();await page.keyboard.press('Enter');
 await expect(form).toContainText('subject component checks');

 const narration=form.getByLabel('Narration',{exact:true}),title=form.getByLabel('New tour title');
 await tabTo(page,narration);await reachable(page,narration);await page.keyboard.type('First: the checks.');
 await tabTo(page,title);await reachable(page,title);await page.keyboard.type('Phone walk');
 const create=form.getByRole('button',{name:'New tour from this stop',exact:true});
 await reachable(page,create);await press(page,create);
 await expect(player).toContainText('Phone walk · stop 1 of 1');await expect(player.locator('[data-focus="tour-player"]')).toBeFocused();

 // Second and third stops, still by keyboard (selection by Enter on the canvas card).
 for(const [label,text] of [['Power BI reporting','Second: the reports.'],['SQL quality checks','Third: back to the checks.']] as const){
  const card=page.getByRole('button',{name:`Explore ${label}`,exact:true});await card.focus();await page.keyboard.press('Enter');
  await toursTab.focus();await page.keyboard.press('Enter');
  await tabTo(page,narration);await page.keyboard.type(text);
  const add=form.getByRole('button',{name:'Add stop to Phone walk',exact:true});await reachable(page,add);await press(page,add,'Enter',true);
  await expect(panel.getByTestId('tour-notice')).toContainText('to Phone walk.');
 }

 // Play, step with Space and Enter, stop, then Resume returns to the last stop.
 const play=panel.getByRole('button',{name:'Play Phone walk',exact:true});await toursTab.focus();await reachable(page,play);await press(page,play);
 await expect(player).toContainText('stop 1 of 3');
 const next=player.getByRole('button',{name:'Next stop',exact:true});await reachable(page,next);await press(page,next,' ');
 await expect(player).toContainText('stop 2 of 3');await page.keyboard.press('Enter');await expect(player).toContainText('stop 3 of 3');
 // Next is disabled on the last stop but keeps focus.
 await focusKept(page);
 const stop=player.getByRole('button',{name:'Stop tour',exact:true});await reachable(page,stop);await press(page,stop);
 await expect(player).toHaveCount(0);await expect(panel.getByRole('button',{name:'Resume Phone walk',exact:true})).toBeFocused();
 const resume=panel.getByRole('button',{name:'Resume Phone walk',exact:true});await reachable(page,resume);await press(page,resume,'Enter',true);
 await expect(panel.getByTestId('tour-notice')).toHaveText('Resumed Phone walk at stop 3 of 3.');await expect(player.getByTestId('tour-narration')).toHaveText('Third: back to the checks.');

 // Reorder: move stop 3 earlier twice, focus stays on the control, then remove it.
 const earlier=stopForm.getByRole('button',{name:'Move earlier',exact:true});await reachable(page,earlier);await press(page,earlier);
 await expect(player).toContainText('stop 2 of 3');await expect(player.getByTestId('tour-narration')).toHaveText('Third: back to the checks.');
 await expect(earlier).toBeFocused();await page.keyboard.press('Enter');
 await expect(player).toContainText('stop 1 of 3');await expect(panel.getByTestId('tour-notice')).toContainText('Moved the stop to position 1.');await focusKept(page);
 const later=stopForm.getByRole('button',{name:'Move later',exact:true});await reachable(page,later);
 const remove=stopForm.getByRole('button',{name:'Remove stop',exact:true});await reachable(page,remove);await press(page,remove);
 await expect(panel.getByTestId('tour-notice')).toContainText('Removed stop 1. One Undo restores it.');await expect(player).toContainText('stop 1 of 2');
 await expect(player.getByTestId('tour-narration')).toHaveText('First: the checks.');await focusKept(page);

 // Save a context on stop 2, leave it, restore it, remove it: all from the keyboard.
 await press(page,next);await expect(player).toContainText('stop 2 of 2');
 const navigate=page.getByRole('button',{name:'Navigate',exact:true});await navigate.focus();await page.keyboard.press('Enter');
 const saved=page.getByTestId('saved-contexts'),name=saved.getByLabel('Saved context name',{exact:true});
 await tabTo(page,name);await reachable(page,name);await page.keyboard.type('Phone reports stop');await page.keyboard.press('Enter');
 await expect(saved.getByRole('status')).toContainText('Saved “Phone reports stop” in this browser.');
 const save=saved.getByRole('button',{name:'Save context',exact:true});await reachable(page,save);
 await toursTab.focus();await page.keyboard.press('Enter');await press(page,stop);await expect(player).toHaveCount(0);
 await navigate.focus();await page.keyboard.press('Enter');
 const restore=saved.getByRole('button',{name:'Restore Phone reports stop',exact:true});await reachable(page,restore);await press(page,restore);
 // Restoring a tour position opens Tours on the saved stop; focus lands on the player, not on the document.
 await expect(player).toContainText('Phone walk · stop 2 of 2');await expect(player.getByTestId('tour-narration')).toHaveText('Second: the reports.');
 await expect(player.locator('[data-focus="tour-player"]')).toBeFocused();
 await navigate.focus();await page.keyboard.press('Enter');
 const removeContext=saved.getByRole('button',{name:'Remove Phone reports stop',exact:true});await reachable(page,removeContext);await press(page,removeContext);
 await expect(saved.locator('[data-saved-context]')).toHaveCount(0);await expect(name).toBeFocused();
 await toursTab.focus();await page.keyboard.press('Enter');await expect(player).toContainText('Phone walk · stop 2 of 2');

 // Reduced motion: nothing in the panels animates or transitions.
 expect(await panel.evaluate(root=>[root,...root.querySelectorAll('*')].map(e=>getComputedStyle(e)).filter(s=>(s.animationName!=='none'&&s.animationDuration!=='0s')||s.transitionDuration.split(',').some(d=>parseFloat(d)>0)).length)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 expect(errors).toEqual([]);
});
