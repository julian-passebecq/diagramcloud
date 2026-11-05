import {test,expect,type Page} from '@playwright/test';

// Static authored lessons and their synthetic adoption journeys only. Selecting and opening inside are navigation: nothing is saved.
const LESSON='Data refinement is not DEV, TEST and PROD';
async function projectJson(page:Page){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const json=await page.getByLabel('Project JSON',{exact:true}).inputValue();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 return json;
}
function parts(page:Page){
 const catalogue=page.getByRole('region',{name:'Learning catalogue',exact:true}),lesson=catalogue.getByRole('article',{name:'Lesson: '+LESSON});
 const diagram=lesson.getByRole('region',{name:'Lesson diagram',exact:true});
 return {catalogue,lesson,diagram,stage:diagram.getByTestId('lesson-diagram-stage'),detail:diagram.getByRole('region',{name:'Selected component',exact:true}),
  state:diagram.getByRole('status',{name:'Lesson diagram state'}),list:diagram.getByTestId('lesson-diagram-list')};
}
const focusedHit=(page:Page)=>page.evaluate(()=>document.activeElement?.getAttribute('data-figure-hit')??null);

test('clicking a figure component selects it in figure, list and detail; Open inside drills one depth and Back returns, changing no document',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 const before=await projectJson(page);
 await page.getByRole('button',{name:'Business overview',exact:true}).click();
 const {catalogue,lesson,diagram,stage,detail,state,list}=parts(page);
 await catalogue.getByRole('button',{name:'Open lesson '+LESSON,exact:true}).click();
 await expect(state).toHaveText('Depth Overview · containment level 0 · 4 components · camera zoom 100% · environment not chosen');
 // Every drawn component is a real button named by its label.
 await expect(stage.getByRole('button')).toHaveCount(4);
 await expect(detail).toContainText('Select a component in the figure');
 await diagram.getByLabel('Lesson diagram environment',{exact:true}).selectOption({label:'TEST'});
 await diagram.getByRole('button',{name:'Zoom in',exact:true}).click();
 const refinement=stage.getByRole('button',{name:'Data refinement',exact:true});
 await refinement.click();
 await expect(refinement).toHaveAttribute('aria-pressed','true');
 await expect(diagram.getByTestId('lesson-diagram-figure').locator('[data-figure-node-id="refinement"] rect').first()).toHaveAttribute('stroke-dasharray','8 4');
 await expect(list.locator('[data-node-id="refinement"]')).toHaveAttribute('data-selected','true');
 await expect(list.locator('[data-selected]')).toHaveCount(1);
 await expect(detail.getByRole('heading',{name:'Data refinement'})).toBeVisible();
 await expect(detail).toContainText('Opens Bronze, silver, gold.');
 // The list selects the same one selection.
 await list.getByRole('button',{name:'Select Report in the figure',exact:true}).click();
 await expect(stage.getByRole('button',{name:'Report',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(refinement).toHaveAttribute('aria-pressed','false');
 await expect(detail.getByRole('button',{name:/^Open inside/})).toHaveCount(0);
 await refinement.click();

 await detail.getByRole('button',{name:'Open inside Data refinement',exact:true}).click();
 await expect(state).toHaveText('Depth Mechanism · containment level 1 · 9 components · camera zoom 125% · environment TEST (declared)');
 // The lesson's own depth and explanation stay; only the diagram opened one level.
 await expect(lesson.getByRole('radio',{name:'Overview',exact:true})).toBeChecked();
 await expect(lesson.getByRole('status',{name:'Explanation at selected depth'})).toContainText('Overview:');
 await expect(stage.getByRole('button')).toHaveCount(9);
 await expect(diagram.getByTestId('lesson-diagram-figure').locator('[data-figure-frame="refinement-detail"]')).toHaveCount(1);
 await expect(detail).toContainText('Inside (Bronze, silver, gold): Bronze, Silver, Gold.');
 const back=diagram.getByRole('button',{name:'Back to Overview',exact:true});
 await expect(back).toBeFocused();
 await stage.getByRole('button',{name:'Silver',exact:true}).click();
 await expect(detail.getByRole('heading',{name:'Silver'})).toBeVisible();
 await back.click();
 await expect(state).toHaveText('Depth Overview · containment level 0 · 4 components · camera zoom 125% · environment TEST (declared)');
 await expect(refinement).toBeFocused();await expect(refinement).toHaveAttribute('aria-pressed','true');
 await expect(diagram.getByRole('button',{name:/^Back to/})).toHaveCount(0);
 // A lesson depth change is the lesson's own move and clears the figure trail.
 await refinement.click();await refinement.click();
 await detail.getByRole('button',{name:'Open inside Data refinement',exact:true}).click();
 await lesson.getByRole('radio',{name:'Mechanism',exact:true}).check();
 await expect(diagram.getByRole('button',{name:/^Back to/})).toHaveCount(0);
 await expect(state).toContainText('Depth Mechanism');
 await lesson.getByRole('button',{name:'Close lesson',exact:true}).click();
 expect(await projectJson(page)).toBe(before);
 expect(errors).toEqual([]);
});

test('at 390x844 the figure is reached by Tab alone: Enter selects, opens inside and goes back, and the page never scrolls sideways',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?catalogue');
 const {catalogue,diagram,stage,detail,state}=parts(page);
 await catalogue.getByRole('button',{name:'Open lesson '+LESSON,exact:true}).click();
 const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 await diagram.getByRole('button',{name:'Reset zoom',exact:true}).focus();
 let hops=0;while(!(await focusedHit(page))&&hops<6){await page.keyboard.press('Tab');hops++;}
 expect(await focusedHit(page)).toBe('capability');
 // Visible focus on the figure button.
 expect(await page.evaluate(()=>getComputedStyle(document.activeElement!).outlineStyle)).toBe('solid');
 await page.keyboard.press('Tab');expect(await focusedHit(page)).toBe('refinement');
 await page.keyboard.press('Enter');
 await expect(stage.getByRole('button',{name:'Data refinement',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(detail.getByRole('heading',{name:'Data refinement'})).toBeVisible();
 // Tab on to Open inside (past the two remaining figure buttons).
 const open=detail.getByRole('button',{name:'Open inside Data refinement',exact:true});
 hops=0;while(!(await open.evaluate(el=>el===document.activeElement))&&hops<6){await page.keyboard.press('Tab');hops++;}
 await expect(open).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(state).toContainText('Depth Mechanism · containment level 1 · 9 components');
 const back=diagram.getByRole('button',{name:'Back to Overview',exact:true});
 await expect(back).toBeFocused();
 expect(await overflow()).toBeLessThanOrEqual(0);
 await page.keyboard.press('Enter');
 await expect(state).toContainText('Depth Overview · containment level 0 · 4 components');
 expect(await focusedHit(page)).toBe('refinement');
 // Space toggles the selection off again.
 await page.keyboard.press('Space');
 await expect(stage.getByRole('button',{name:'Data refinement',exact:true})).toHaveAttribute('aria-pressed','false');
 await expect(detail).toContainText('Select a component in the figure');
 const box=await stage.getByRole('button',{name:'Data refinement',exact:true}).boundingBox();
 expect(box&&box.x>=0&&box.x+box.width<=390).toBe(true);
 expect(await overflow()).toBeLessThanOrEqual(0);
 expect(errors).toEqual([]);
});
