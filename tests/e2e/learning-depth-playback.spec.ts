import {test,expect,type Page} from '@playwright/test';

// Static authored lessons and their synthetic adoption journeys only. Nothing is mapped, observed, executed or saved.
async function projectJson(page:Page){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const json=await page.getByLabel('Project JSON',{exact:true}).inputValue();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 return json;
}
async function openLesson(page:Page,title:string){
 await page.getByRole('button',{name:'Business overview',exact:true}).click();
 const catalogue=page.getByRole('region',{name:'Learning catalogue',exact:true});
 await catalogue.getByRole('button',{name:'Open lesson '+title,exact:true}).click();
 return catalogue.getByRole('article',{name:'Lesson: '+title});
}

test('semantic depth changes the components the lesson diagram shows; camera zoom and environment never change depth',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?catalogue');
 const catalogue=page.getByRole('region',{name:'Learning catalogue',exact:true});
 await catalogue.getByRole('button',{name:'Open lesson Data refinement is not DEV, TEST and PROD',exact:true}).click();
 const lesson=catalogue.getByRole('article',{name:'Lesson: Data refinement is not DEV, TEST and PROD'});
 const diagram=lesson.getByRole('region',{name:'Lesson diagram',exact:true}),state=diagram.getByRole('status',{name:'Lesson diagram state'});
 const nodes=diagram.getByTestId('lesson-diagram-camera').locator('[data-node-id]');
 await expect(state).toHaveText('Depth Overview · containment level 0 · 4 components · camera zoom 100% · environment not chosen');
 await expect(nodes).toHaveCount(4);await expect(diagram.locator('[data-node-id="bronze"]')).toHaveCount(0);
 await expect(diagram).toContainText('Opens Bronze, silver, gold: shown at a deeper depth.');

 await lesson.getByRole('radio',{name:'Mechanism',exact:true}).check();
 await expect(state).toHaveText('Depth Mechanism · containment level 1 · 9 components · camera zoom 100% · environment not chosen');
 await expect(nodes).toHaveCount(9);
 await expect(diagram.getByRole('list',{name:'Inside Data refinement (Bronze, silver, gold)'})).toContainText('Silver');
 await expect(lesson.getByRole('status',{name:'Explanation at selected depth'})).toContainText('Mechanism:');

 // The camera only scales the picture: depth, components and environment stay.
 await diagram.getByLabel('Lesson diagram environment',{exact:true}).selectOption({label:'TEST'});
 await expect(state).toHaveText('Depth Mechanism · containment level 1 · 9 components · camera zoom 100% · environment TEST (declared)');
 await expect(diagram.locator('[data-node-id="cloud-run"]')).toContainText('declared instance in TEST');
 for(let i=0;i<4;i++)await diagram.getByRole('button',{name:'Zoom in',exact:true}).click();
 await expect(diagram.getByRole('button',{name:'Zoom in',exact:true})).toBeDisabled();
 await expect(state).toHaveText('Depth Mechanism · containment level 1 · 9 components · camera zoom 200% · environment TEST (declared)');
 await expect(nodes).toHaveCount(9);await expect(lesson.getByRole('radio',{name:'Mechanism',exact:true})).toBeChecked();
 await expect(diagram.getByTestId('lesson-diagram-camera')).toHaveAttribute('style',/scale\(2\)/);
 for(let i=0;i<6;i++)await diagram.getByRole('button',{name:'Zoom out',exact:true}).click();
 await expect(state).toHaveText('Depth Mechanism · containment level 1 · 9 components · camera zoom 50% · environment TEST (declared)');

 // Depth moves alone too: zoom and environment are kept.
 await lesson.getByRole('radio',{name:'Overview',exact:true}).check();
 await expect(state).toHaveText('Depth Overview · containment level 0 · 4 components · camera zoom 50% · environment TEST (declared)');
 await expect(nodes).toHaveCount(4);
 await lesson.getByRole('radio',{name:'Detail',exact:true}).check();
 await expect(diagram.locator('[data-node-id="refinement"]')).toContainText('Evidence: Synthetic refinement example.');
 expect(errors).toEqual([]);
});

test('step playback highlights declared steps in order, is labelled a presented sequence, works by keyboard and changes no document',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 const before=await projectJson(page);
 const lesson=await openLesson(page,'Agent worktrees, changes, review and CI');
 const diagram=lesson.getByRole('region',{name:'Lesson diagram',exact:true});
 await expect(diagram.getByRole('region',{name:/^Step playback: Declared procedure/})).toHaveCount(0);
 await lesson.getByRole('radio',{name:'Mechanism',exact:true}).check();
 const playback=diagram.getByRole('region',{name:'Step playback: Declared procedure: Intended procedure',exact:true});
 await expect(playback.getByRole('note')).toContainText('Presented sequence - not a run, not timing');
 await expect(playback.getByRole('note')).toContainText('records no observation, attempt or run');
 const position=playback.getByRole('status',{name:'Playback position'});
 await expect(position).toHaveText('Step 1 of 6: Session');
 await expect(diagram.locator('[data-node-id="session"]')).toHaveAttribute('aria-current','step');
 await expect(playback.getByRole('button',{name:'Previous step',exact:true})).toBeDisabled();
 await playback.getByRole('button',{name:'Next step',exact:true}).click();
 await expect(position).toHaveText('Step 2 of 6: Worktree');
 await expect(diagram.locator('[data-node-id="worktree"]')).toHaveAttribute('aria-current','step');
 await expect(diagram.locator('[data-node-id="session"]')).not.toHaveAttribute('aria-current','step');
 // Keyboard: focus the panel, then arrows, End and Home.
 await playback.focus();await page.keyboard.press('ArrowRight');
 await expect(position).toHaveText('Step 3 of 6: Pull request');
 await page.keyboard.press('End');await expect(position).toHaveText('Step 6 of 6: Handoff');
 await expect(playback.getByRole('button',{name:'Next step',exact:true})).toBeDisabled();
 await page.keyboard.press('ArrowLeft');await expect(position).toHaveText('Step 5 of 6: Merge');
 await page.keyboard.press('Home');await expect(position).toHaveText('Step 1 of 6: Session');

 // The lesson example's own authored steps play the same way.
 const steps=lesson.getByRole('region',{name:'Step playback: Lesson example steps',exact:true});
 await expect(steps.getByRole('note')).toContainText('Presented sequence - not a run, not timing');
 await steps.getByRole('button',{name:'Next step',exact:true}).click();
 await expect(steps.getByRole('status',{name:'Playback position'})).toContainText('Step 2 of');
 await expect(steps.getByRole('list',{name:'Declared steps'}).locator('[aria-current="step"]')).toHaveCount(1);

 await lesson.getByRole('button',{name:'Close lesson',exact:true}).click();
 expect(await projectJson(page)).toBe(before);
 expect(errors).toEqual([]);
});
