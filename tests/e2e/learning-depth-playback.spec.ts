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
 const nodes=diagram.getByTestId('lesson-diagram-list').locator('[data-node-id]');
 const figure=diagram.getByTestId('lesson-diagram-figure'),figureNodes=figure.locator('[data-figure-node-id]'),frames=figure.locator('[data-figure-frame]');
 await expect(state).toHaveText('Depth Overview · containment level 0 · 4 components · camera zoom 100% · environment not chosen');
 await expect(nodes).toHaveCount(4);await expect(diagram.locator('[data-node-id="bronze"]')).toHaveCount(0);
 // The spatial figure draws the same depth scene; the list stays as its text and keyboard alternative.
 await expect(figure).toHaveAttribute('role','img');await expect(figure).toHaveAttribute('data-depth','overview');
 await expect(figureNodes).toHaveCount(4);await expect(frames).toHaveCount(0);
 await expect(diagram).toContainText('Opens Bronze, silver, gold: shown at a deeper depth.');

 await lesson.getByRole('radio',{name:'Mechanism',exact:true}).check();
 await expect(state).toHaveText('Depth Mechanism · containment level 1 · 9 components · camera zoom 100% · environment not chosen');
 await expect(nodes).toHaveCount(9);
 await expect(diagram.getByRole('list',{name:'Inside Data refinement (Bronze, silver, gold)'})).toContainText('Silver');
 await expect(figure).toHaveAttribute('data-depth','architecture');await expect(figureNodes).toHaveCount(9);await expect(frames).toHaveCount(2);
 await expect(figure.locator('[data-figure-frame="refinement-detail"]')).toHaveAttribute('data-frame-via','refinement');
 await expect(figure.locator('[data-figure-frame="refinement-detail"]')).toContainText('Inside Data refinement · Bronze, silver, gold');
 await expect(lesson.getByRole('status',{name:'Explanation at selected depth'})).toContainText('Mechanism:');

 // The camera only scales the picture: depth, components and environment stay.
 await diagram.getByLabel('Lesson diagram environment',{exact:true}).selectOption({label:'TEST'});
 await expect(state).toHaveText('Depth Mechanism · containment level 1 · 9 components · camera zoom 100% · environment TEST (declared)');
 await expect(diagram.locator('[data-node-id="cloud-run"]')).toContainText('declared instance in TEST');
 await expect(figure.locator('[data-figure-environment="cloud-run"]')).toHaveText('declared in TEST');
 const listWidth=await diagram.getByTestId('lesson-diagram-list').evaluate(el=>el.getBoundingClientRect().width);
 const figureWidth=await figure.evaluate(el=>el.getBoundingClientRect().width);
 for(let i=0;i<4;i++)await diagram.getByRole('button',{name:'Zoom in',exact:true}).click();
 await expect(diagram.getByRole('button',{name:'Zoom in',exact:true})).toBeDisabled();
 await expect(state).toHaveText('Depth Mechanism · containment level 1 · 9 components · camera zoom 200% · environment TEST (declared)');
 await expect(nodes).toHaveCount(9);await expect(lesson.getByRole('radio',{name:'Mechanism',exact:true})).toBeChecked();
 await expect(diagram.getByTestId('lesson-diagram-camera')).toHaveAttribute('data-zoom','2');
 // Zoom sizes the figure only: the list alternative keeps its width.
 expect(await figure.evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(figureWidth*1.5);
 expect(await diagram.getByTestId('lesson-diagram-list').evaluate(el=>el.getBoundingClientRect().width)).toBe(listWidth);
 await expect(figureNodes).toHaveCount(9);
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
 // The figure lights up the played component and its connections, and nothing else.
 const figure=diagram.getByTestId('lesson-diagram-figure');
 await expect(figure.locator('[data-figure-node-id="worktree"]')).toHaveAttribute('data-highlighted','true');
 await expect(figure.locator('[data-figure-node-id][data-highlighted]')).toHaveCount(1);
 await expect(figure.locator('[data-figure-edge-id][data-highlighted]')).toHaveCount(2);
 await expect(diagram.getByTestId('lesson-diagram-list').locator('[data-edge-id][aria-current="true"]')).toHaveCount(2);
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

test('at 390 px with reduced motion the lesson figure scrolls inside its own box, highlights without motion and keeps the list alternative',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/?catalogue');
 const catalogue=page.getByRole('region',{name:'Learning catalogue',exact:true});
 await catalogue.getByRole('button',{name:'Open lesson Agent worktrees, changes, review and CI',exact:true}).click();
 const lesson=catalogue.getByRole('article',{name:'Lesson: Agent worktrees, changes, review and CI'});
 await lesson.getByRole('radio',{name:'Mechanism',exact:true}).check();
 const diagram=lesson.getByRole('region',{name:'Lesson diagram',exact:true}),figure=diagram.getByTestId('lesson-diagram-figure');
 await expect(figure.locator('[data-figure-node-id]')).toHaveCount(await diagram.getByTestId('lesson-diagram-list').locator('[data-node-id]').count());
 const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(await overflow()).toBeLessThanOrEqual(0);
 for(let i=0;i<4;i++)await diagram.getByRole('button',{name:'Zoom in',exact:true}).click();
 await expect(diagram.getByTestId('lesson-diagram-camera')).toHaveAttribute('data-zoom','2');
 // The zoomed figure scrolls inside the camera box; the page never scrolls sideways.
 expect(await overflow()).toBeLessThanOrEqual(0);
 expect(await diagram.getByTestId('lesson-diagram-camera').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
 const playback=diagram.getByRole('region',{name:'Step playback: Declared procedure: Intended procedure',exact:true});
 await playback.getByRole('button',{name:'Next step',exact:true}).click();
 const lit=figure.locator('[data-figure-node-id="worktree"] rect').first();
 await expect(figure.locator('[data-figure-node-id="worktree"]')).toHaveAttribute('data-highlighted','true');
 expect(await lit.evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
 // The list alternative is still reachable by keyboard and names the played step.
 await playback.focus();await page.keyboard.press('ArrowRight');
 await expect(diagram.locator('[data-node-id="pr"]')).toHaveAttribute('aria-current','step');
 await expect(figure.locator('[data-figure-node-id="pr"]')).toHaveAttribute('data-highlighted','true');
 expect(await overflow()).toBeLessThanOrEqual(0);
 expect(errors).toEqual([]);
});
