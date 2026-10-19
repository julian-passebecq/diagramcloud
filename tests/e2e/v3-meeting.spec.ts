import {test,expect,type Locator,type Page} from '@playwright/test';
import {documentSchema,validateDocument,type Project} from '../../src/core/model';
import {addTour,addTourStop,recordStop,TOUR_LABEL} from '../../src/core/tours';

/**
 * V3 meeting return (W4): play a source-bound tour in the V3 workspace, pause for a question, take a detour (inspect,
 * zoom out, drill into a child view), return and resume explicitly at the stop by its identity. A source change during
 * the pause never moves the presentation; a private stop and private narration never reach a public audience.
 * Every fixture is synthetic.
 */
const PRIVATE_LABEL='SYNTHETIC_MEETING_PRIVATE_COMPONENT',PRIVATE_NARRATION='SYNTHETIC_MEETING_PRIVATE_NARRATION',MIXED_NARRATION='SYNTHETIC_MEETING_MIXED_NARRATION';
function fixture(id:string):Project{
 const d0=validateDocument(documentSchema.parse({schemaVersion:1,id,title:'Synthetic meeting',rootViewId:'root',summary:'Synthetic meeting fixture; no external facts.',edges:[],
  nodes:[{id:'a',label:'Synthetic A',summary:'Synthetic A explanation',childViewId:'inner'},{id:'b',label:'Synthetic B',summary:'Synthetic B explanation'},
   {id:'hidden',label:PRIVATE_LABEL,summary:'Synthetic private fact',visibility:'private'},{id:'i',label:'Synthetic inner'}],
  views:[{id:'root',title:'Synthetic root',nodeIds:['a','b','hidden'],positions:{a:{x:0,y:0},b:{x:300,y:0},hidden:{x:600,y:0}}},{id:'inner',title:'Synthetic inner view',nodeIds:['i']}]}));
 let doc=addTour(d0,{id:'walk',title:'Synthetic walk',visibility:'public',stop:recordStop(d0,'root',[{kind:'node',id:'a'}],'Stop one: synthetic A.')});
 doc=addTourStop(doc,'walk',recordStop(doc,'root',[{kind:'node',id:'hidden'}],PRIVATE_NARRATION));
 doc=addTourStop(doc,'walk',recordStop(doc,'root',[{kind:'node',id:'a'},{kind:'node',id:'hidden'}],MIXED_NARRATION));
 return addTourStop(doc,'walk',recordStop(doc,'root',[{kind:'node',id:'b'}],'Stop four: synthetic B.'));
}

const workspace=(page:Page)=>page.getByTestId('v3-workspace');
const card=(page:Page,view:string,label:string)=>page.getByTestId('view-'+view).getByRole('button',{name:'Explore '+label,exact:true});
const tours=(page:Page)=>page.getByRole('region',{name:'Tours'});
const player=(page:Page)=>tours(page).getByRole('region',{name:'Tour player'});
async function importFixture(page:Page,doc:Project){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
}
async function current(page:Page):Promise<Project>{await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const doc=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));await page.getByRole('button',{name:'Close dialog',exact:true}).click();return doc;}
const isFocused=(l:Locator)=>l.evaluate(e=>e===document.activeElement).catch(()=>false);
async function tabTo(page:Page,target:Locator,back=false,max=200){
 await expect(target).toBeVisible();
 for(let i=0;i<max;i++){if(await isFocused(target))return;await page.keyboard.press(back?'Shift+Tab':'Tab');expect(await page.evaluate(()=>document.activeElement!==document.body),'focus never falls to the body').toBe(true);}
 throw new Error(`Not reachable by ${back?'Shift+':''}Tab: ${target}`);
}
async function press(page:Page,target:Locator,back=false){await tabTo(page,target,back);await page.keyboard.press('Enter');}
async function focusKept(page:Page){expect(await page.evaluate(()=>document.activeElement!==null&&document.activeElement!==document.body)).toBe(true);}
async function noHorizontalScroll(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);}

test.describe('390 x 844, keyboard only, reduced motion',()=>{
 test.use({reducedMotion:'reduce'});
 test('play, pause for a question, detour (inspect, zoom out, drill), return and resume at the stop',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?workspace=v3');await importFixture(page,fixture('synthetic-meeting-walk'));await page.getByRole('tab',{name:'Explore',exact:true}).click();
  const before=await current(page);
  await page.setViewportSize({width:390,height:844});await page.mouse.move(0,0);
  expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await page.locator('body').evaluate(()=>(document.activeElement as HTMLElement|null)?.blur());
  const panes=workspace(page).getByRole('navigation',{name:'Workspace panes'});

  // Explorer pane, Tours, Play.
  await press(page,panes.getByRole('button',{name:'Explorer',exact:true}));
  await press(page,workspace(page).getByRole('button',{name:'Tours',exact:true}));
  await press(page,tours(page).getByRole('button',{name:'Play Synthetic walk',exact:true}));
  // Playing a stop shows its view (one pane at a time at this width); the player is read in the explorer pane.
  await expect(panes.getByRole('button',{name:'View',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByTestId('view-root')).toBeVisible();await focusKept(page);
  // A hidden pane hands focus to the frame's recovery control (before the pane switcher): Tab forward.
  await press(page,panes.getByRole('button',{name:'Explorer',exact:true}));
  await expect(player(page)).toContainText('Synthetic walk · stop 1 of 4');await expect(player(page)).toContainText(TOUR_LABEL.toUpperCase());
  await expect(player(page).getByTestId('tour-narration')).toHaveText('Stop one: synthetic A.');
  await expect(player(page).getByTestId('presentation-cut')).toHaveText(`Source cut: revision ${before.revision}.`);
  await noHorizontalScroll(page);

  // Pause for a question: the stop is kept, narration is set aside, focus goes to Return.
  await press(page,player(page).getByRole('button',{name:'Pause for a question',exact:true}));
  const ret=player(page).getByRole('button',{name:'Return and resume',exact:true});
  await expect(player(page).getByTestId('presentation-paused')).toHaveCount(0);await expect(tours(page).getByTestId('presentation-paused')).toBeVisible();
  await expect(player(page)).toContainText('Synthetic walk · paused at stop 1 of 4');await expect(player(page).getByTestId('tour-narration')).toHaveCount(0);
  await expect(ret).toBeFocused();await noHorizontalScroll(page);

  // Detour in the view pane: drill into A's child view, inspect the inner card, zoom out.
  await press(page,panes.getByRole('button',{name:'View',exact:true}),true);
  await press(page,card(page,'root','Synthetic A'));await expect(page.getByTestId('view-inner')).toBeVisible();await focusKept(page);
  await press(page,card(page,'inner','Synthetic inner'));await focusKept(page);
  const viewport=page.getByTestId('view-inner').locator('.react-flow__viewport'),zoomBefore=await viewport.getAttribute('style');
  const zoomOut=page.getByTestId('view-inner').getByRole('button',{name:'Zoom Out',exact:true});
  await press(page,zoomOut);await expect.poll(()=>viewport.getAttribute('style')).not.toBe(zoomBefore);await focusKept(page);
  await noHorizontalScroll(page);

  // Back to Tours: still paused on stop 1, nothing moved; Return and resume shows the stop's view again.
  await press(page,panes.getByRole('button',{name:'Explorer',exact:true}),true);
  await expect(player(page)).toContainText('paused at stop 1 of 4');
  await press(page,player(page).getByRole('button',{name:'Return and resume',exact:true}));
  // Return shows the stop's view again (the detour's child view is closed), then the player is read in the explorer.
  await expect(page.getByTestId('view-root')).toBeVisible();await expect(page.getByTestId('view-inner')).toHaveCount(0);await focusKept(page);
  // A hidden pane hands focus to the frame's recovery control (before the pane switcher): Tab forward.
  await press(page,panes.getByRole('button',{name:'Explorer',exact:true}));
  await expect(tours(page).getByTestId('tour-notice')).toHaveText('Returned to the presentation. Resumed Synthetic walk at stop 1 of 4.');
  await expect(player(page)).toContainText('Synthetic walk · stop 1 of 4');await expect(player(page).getByTestId('tour-narration')).toHaveText('Stop one: synthetic A.');

  // The presentation continues by keyboard and never edited the project.
  await press(page,player(page).getByRole('button',{name:'Next stop',exact:true}));await focusKept(page);
  await press(page,panes.getByRole('button',{name:'Explorer',exact:true}));await expect(player(page)).toContainText('stop 2 of 4');
  expect(await panelMotion(tours(page))).toBe(0);
  await page.setViewportSize({width:1440,height:1100});
  expect(await current(page),'presenting, pausing and returning never edit the project').toEqual(before);
  expect(errors).toEqual([]);
 });
});
const panelMotion=(root:Locator)=>root.evaluate(r=>[r,...r.querySelectorAll('*')].map(e=>getComputedStyle(e)).filter(s=>(s.animationName!=='none'&&s.animationDuration!=='0s')||s.transitionDuration.split(',').some(d=>parseFloat(d)>0)).length);

test('a source change during the pause never moves the presentation: the presenter is told and chooses',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?workspace=v3');await importFixture(page,fixture('synthetic-meeting-change'));
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await workspace(page).getByRole('button',{name:'Tours',exact:true}).click();
 await tours(page).getByRole('button',{name:'Play Synthetic walk',exact:true}).click();
 for(let i=0;i<3;i++)await player(page).getByRole('button',{name:'Next stop',exact:true}).click();
 await expect(player(page)).toContainText('stop 4 of 4');const started=await current(page);
 await player(page).getByRole('button',{name:'Pause for a question',exact:true}).click();

 // An edit elsewhere during the pause (a component summary) is a source update.
 await card(page,'root','Synthetic B').click();await workspace(page).getByRole('button',{name:'Inspector',exact:true}).click();
 await page.getByLabel('Component summary',{exact:true}).fill('Synthetic B, changed during the question');await page.getByRole('button',{name:'Apply component',exact:true}).click();
 await workspace(page).getByRole('button',{name:'Tours',exact:true}).click();
 await expect(tours(page).getByTestId('presentation-drift')).toContainText(`The source changed since this presentation started on revision ${started.revision} (now revision ${started.revision+1}).`);
 await expect(player(page)).toContainText('paused at stop 4');await expect(player(page).getByTestId('tour-narration')).toHaveCount(0);
 await player(page).getByRole('button',{name:'Return and resume',exact:true}).click();
 const choice=tours(page).getByRole('group',{name:'Resume choice'});
 await expect(choice.getByTestId('tour-resume-choice')).toContainText('The stop you paused on is still stop 4 of 4; check it before continuing. Nothing is picked for you.');
 // Stay here keeps the pause.
 await choice.getByRole('button',{name:'Stay here',exact:true}).click();await expect(choice).toHaveCount(0);
 await expect(player(page).getByRole('button',{name:'Return and resume',exact:true})).toBeFocused();

 // A second update moves the stop (stop 4 becomes stop 1): it is offered at its new place, never followed silently.
 const live=await current(page),moved=structuredClone(live),tour=moved.tours!.find(t=>t.id==='walk')!;tour.stops.unshift(tour.stops.pop()!);
 await importFixture(page,moved);const after=await current(page);expect(after.revision).toBeGreaterThan(live.revision);
 await workspace(page).getByRole('button',{name:'Tours',exact:true}).click();
 await expect(tours(page).getByTestId('presentation-drift')).toContainText(`started on revision ${started.revision}`);
 await expect(player(page)).toContainText('paused at stop 4');
 await player(page).getByRole('button',{name:'Return and resume',exact:true}).click();
 await expect(choice.getByTestId('tour-resume-choice')).toContainText('The stop you were on moved from position 4 to 1 of 4.');
 await choice.getByRole('button',{name:'Continue at stop 1',exact:true}).click();
 await expect(player(page)).toContainText('Synthetic walk · stop 1 of 4');await expect(player(page).getByTestId('tour-narration')).toHaveText('Stop four: synthetic B.');
 await expect(player(page).getByTestId('presentation-cut')).toHaveText(`Source cut: revision ${after.revision}.`);
 expect((await current(page)).revision,'resuming records no revision').toBe(after.revision);
 expect(errors).toEqual([]);
});

test('a public audience never sees the private stop or private narration; an audience change pauses and revalidates',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?workspace=v3');await importFixture(page,fixture('synthetic-meeting-public'));
 await page.getByRole('tab',{name:'Explore',exact:true}).click();
 // Author view: paused on the private stop.
 await workspace(page).getByRole('button',{name:'Tours',exact:true}).click();
 await tours(page).getByRole('button',{name:'Play Synthetic walk',exact:true}).click();await player(page).getByRole('button',{name:'Next stop',exact:true}).click();
 await expect(player(page).getByTestId('tour-narration')).toHaveText(PRIVATE_NARRATION);
 await player(page).getByRole('button',{name:'Pause for a question',exact:true}).click();

 for(const audience of ['Present','Portfolio']){
  await page.getByRole('tab',{name:audience,exact:true}).click();
  await workspace(page).getByRole('button',{name:'Tours',exact:true}).click();
  const html=await page.content();expect(html,`${audience}: no private narration or label`).not.toContain(PRIVATE_NARRATION);expect(html).not.toContain(MIXED_NARRATION);expect(html).not.toContain(PRIVATE_LABEL);
 }
 // The audience change paused the presentation; returning revalidates the stop for the public copy, where it does not exist.
 await expect(tours(page).getByTestId('presentation-drift')).toContainText('The audience changed from the author view to the public copy.');
 await player(page).getByRole('button',{name:'Return and resume',exact:true}).click();
 const choice=tours(page).getByRole('group',{name:'Resume choice'});
 await expect(choice.getByTestId('tour-resume-choice')).toContainText('The stop you were on is no longer in Synthetic walk.');
 await expect(choice.getByRole('button',{name:/^Continue at stop/})).toHaveCount(0);
 await choice.getByRole('button',{name:'Start from stop 1',exact:true}).click();
 await expect(player(page)).toContainText('Synthetic walk · stop 1 of 4');await expect(player(page).getByTestId('tour-narration')).toHaveText('Stop one: synthetic A.');
 // Stop 2 is omitted in the public copy, stop 3 (mixed) keeps its public subject without its narration.
 await player(page).getByRole('button',{name:'Next stop',exact:true}).click();
 await expect(player(page).getByTestId('tour-anchor')).toHaveText('This stop is not public and is omitted from this copy.');await expect(player(page).getByTestId('tour-narration')).toHaveCount(0);
 await player(page).getByRole('button',{name:'Next stop',exact:true}).click();
 await expect(player(page).getByTestId('tour-omission')).toHaveText('Some subjects of this stop are not public and are omitted from this copy.');await expect(player(page).getByTestId('tour-narration')).toHaveCount(0);
 // Pausing and returning in the public copy keeps it public: still no private content anywhere.
 await player(page).getByRole('button',{name:'Pause for a question',exact:true}).click();await player(page).getByRole('button',{name:'Return and resume',exact:true}).click();
 await expect(player(page)).toContainText('Synthetic walk · stop 3 of 4');
 const html=await page.content();expect(html).not.toContain(PRIVATE_NARRATION);expect(html).not.toContain(MIXED_NARRATION);expect(html).not.toContain(PRIVATE_LABEL);
 expect(errors).toEqual([]);
});
