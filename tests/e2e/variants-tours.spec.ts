import {test,expect,type Page} from '@playwright/test';

/** R3-02 baseline-bound variants and R3-15 tours, in the Studio. */
async function editTotal(page:Page){
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await expect(page.getByRole('tab',{name:'Edit',exact:true})).toBeEnabled();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
}
const canvasNode=(page:Page,label:string)=>page.getByRole('button',{name:`Explore ${label}`,exact:true});

test('Variants: create a variant, compare it without changing the model, apply it as one revision, Undo restores baseline and variant',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await editTotal(page);
 await page.getByRole('button',{name:'Variants',exact:true}).click();
 const panel=page.getByRole('region',{name:'Variants'}),form=panel.getByRole('form',{name:'New variant'});
 await form.getByLabel('Variant ID').fill('read-replica');await form.getByLabel('Title').fill('Rename the checks');
 await form.getByLabel('Operations (JSON Patch, @id addressing)').fill(JSON.stringify([
  {op:'test',path:'/nodes/@checks/label',value:'SQL quality checks'},{op:'replace',path:'/nodes/@checks/label',value:'Quality checks (variant)'},
  {op:'add',path:'/nodes/-',value:{id:'read-replica.audit',label:'Audit log',kind:'storage'}},{op:'add',path:'/views/@overview/nodeIds/-',value:'read-replica.audit'}]));
 await form.getByRole('button',{name:'Record variant',exact:true}).click();
 await expect(panel.getByTestId('variant-notice')).toContainText('Variant read-replica recorded against revision');
 const compare=panel.getByRole('region',{name:'Variant comparison'});
 await expect(compare).toContainText('Selecting a variant compares it with its baseline. Nothing is accepted or applied.');
 await expect(compare.getByTestId('variant-state')).toContainText('Baseline current');
 await expect(compare.getByTestId('variant-ledger')).toContainText('CHANGED · Quality checks (variant): renamed from "SQL quality checks"');
 await expect(compare.getByTestId('variant-ledger')).toContainText('ADDED · Audit log');
 await expect(canvasNode(page,'SQL quality checks')).toBeVisible();await expect(canvasNode(page,'Audit log')).toHaveCount(0);

 await compare.getByRole('button',{name:'Apply variant',exact:true}).click();
 await expect(panel.getByTestId('variant-notice')).toContainText(/Applied Rename the checks as revision \d+\. One Undo restores revision \d+ and the variant\./);
 await expect(canvasNode(page,'Quality checks (variant)')).toBeVisible();await expect(canvasNode(page,'Audit log')).toBeVisible();
 await expect(panel.getByRole('button',{name:'Compare Rename the checks',exact:true})).toHaveCount(0);

 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(canvasNode(page,'SQL quality checks')).toBeVisible();await expect(canvasNode(page,'Audit log')).toHaveCount(0);
 await expect(panel.getByRole('button',{name:'Compare Rename the checks',exact:true})).toBeVisible();
 await expect(panel.locator('[data-variant-status="current"]')).toHaveText('Baseline current');
 expect(errors).toEqual([]);
});

test('Tours: record a tour, then a changed anchor fails visibly as stale when played, in Edit and in Present',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await editTotal(page);
 await page.getByRole('button',{name:'Tours',exact:true}).click();
 const panel=page.getByRole('region',{name:'Tours'}),form=panel.getByRole('form',{name:'Record a tour stop'}),player=panel.getByRole('region',{name:'Tour player'});
 await canvasNode(page,'SQL quality checks').click();
 await expect(form).toContainText('subject component checks');
 await form.getByLabel('Narration').fill('Checks run before anything is reported.');await form.getByLabel('New tour title').fill('Quality walkthrough');
 await form.getByRole('button',{name:'New tour from this stop',exact:true}).click();
 await expect(player).toContainText('Quality walkthrough · stop 1 of 1');await expect(player).toContainText('PRESENTED SEQUENCE - NOT A RUN, NOT TIMING');
 await expect(player.getByTestId('tour-narration')).toHaveText('Checks run before anything is reported.');await expect(player.getByTestId('tour-anchor')).toHaveCount(0);
 await canvasNode(page,'Power BI reporting').click();
 await form.getByLabel('Narration').fill('Reports read only checked data.');
 await form.getByRole('button',{name:'Add stop to Quality walkthrough',exact:true}).click();
 await expect(panel.getByTestId('tour-notice')).toContainText('Added stop 2 to Quality walkthrough');

 // Change the first stop's subject after recording.
 await page.getByRole('button',{name:'Inspector',exact:true}).click();
 await canvasNode(page,'SQL quality checks').click();
 await page.getByLabel('Component summary',{exact:true}).fill('Rewritten after the tour was recorded');
 await page.getByRole('button',{name:'Apply component',exact:true}).click();

 await page.getByRole('button',{name:'Tours',exact:true}).click();
 await panel.getByRole('button',{name:'Play Quality walkthrough',exact:true}).click();
 await expect(player).toContainText('stop 1 of 2');
 await expect(player.getByTestId('tour-anchor')).toContainText(/Anchor stale: the content changed after this tour was recorded at revision \d+ \(now revision \d+\)/);
 await player.getByRole('button',{name:'Next stop',exact:true}).click();
 await expect(player).toContainText('stop 2 of 2');await expect(player.getByTestId('tour-anchor')).toHaveCount(0);
 await expect(player.getByTestId('tour-narration')).toHaveText('Reports read only checked data.');

 await page.getByRole('tab',{name:'Present',exact:true}).click();
 await page.getByRole('button',{name:'Tours',exact:true}).click();
 await panel.getByRole('button',{name:'Play Quality walkthrough',exact:true}).click();
 await expect(player.getByTestId('tour-anchor')).toContainText('Anchor stale');
 await expect(panel.getByRole('form',{name:'Record a tour stop'})).toHaveCount(0);
 expect(errors).toEqual([]);
});

async function revision(page:Page){await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const value=JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()).revision as number;await page.getByRole('button',{name:'Close dialog',exact:true}).click();return value;}
test('Tours: edit, move and remove stops (connection subject included) with one Undo each; Resume by stop identity asks when a stop moved or was removed; a saved context restores the tour position',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await editTotal(page);
 await page.getByRole('button',{name:'Tours',exact:true}).click();
 const panel=page.getByRole('region',{name:'Tours'}),form=panel.getByRole('form',{name:'Record a tour stop'}),player=panel.getByRole('region',{name:'Tour player'}),stopForm=player.getByRole('form',{name:'Edit this stop'});
 await canvasNode(page,'SQL quality checks').click();
 await form.getByLabel('Narration').fill('First: the checks.');await form.getByLabel('New tour title').fill('Resume walk');
 await form.getByRole('button',{name:'New tour from this stop',exact:true}).click();
 // Selecting a connection opens its inspector; the Tours panel records it as the stop subject.
 await page.getByRole('button',{name:/^Select connection .*: trusted views$/}).click();
 await page.getByRole('button',{name:'Tours',exact:true}).click();
 await expect(form).toContainText('subject connection');
 await form.getByLabel('Narration').fill('Second: trusted views.');await form.getByRole('button',{name:'Add stop to Resume walk',exact:true}).click();
 await canvasNode(page,'Power BI reporting').click();
 await form.getByLabel('Narration').fill('Third: the reports.');await form.getByRole('button',{name:'Add stop to Resume walk',exact:true}).click();
 await expect(panel.getByTestId('tour-notice')).toContainText('Added stop 3 to Resume walk');
 const rev=await revision(page);

 // Playing and resuming are reading only.
 await page.getByRole('button',{name:'Tours',exact:true}).click();
 await panel.getByRole('button',{name:'Play Resume walk',exact:true}).click();
 await player.getByRole('button',{name:'Next stop',exact:true}).click();
 await expect(player).toContainText('stop 2 of 3');await expect(player).toContainText(/connection \S+/);await expect(player.getByTestId('tour-narration')).toHaveText('Second: trusted views.');
 await player.getByRole('button',{name:'Next stop',exact:true}).click();await expect(player).toContainText('stop 3 of 3');
 await player.getByRole('button',{name:'Stop tour',exact:true}).click();await expect(player).toHaveCount(0);
 await panel.getByRole('button',{name:'Resume Resume walk',exact:true}).click();
 await expect(panel.getByTestId('tour-notice')).toHaveText('Resumed Resume walk at stop 3 of 3.');await expect(player.getByTestId('tour-narration')).toHaveText('Third: the reports.');
 expect(await revision(page)).toBe(rev);
 await page.getByRole('button',{name:'Tours',exact:true}).click();

 // Narration: Cancel keeps it; Save is one revision; one Undo restores it.
 await stopForm.getByRole('button',{name:'Edit narration',exact:true}).click();await stopForm.getByLabel('Stop narration').fill('Discarded draft.');
 await stopForm.getByRole('button',{name:'Cancel',exact:true}).click();await expect(player.getByTestId('tour-narration')).toHaveText('Third: the reports.');
 await stopForm.getByRole('button',{name:'Edit narration',exact:true}).click();await stopForm.getByLabel('Stop narration').fill('Third, reworded.');
 await stopForm.getByRole('button',{name:'Save narration',exact:true}).click();
 await expect(panel.getByTestId('tour-notice')).toContainText('Saved the narration of stop 3. One Undo restores it.');await expect(player.getByTestId('tour-narration')).toHaveText('Third, reworded.');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(player.getByTestId('tour-narration')).toHaveText('Third: the reports.');

 // Move the stop earlier: the player follows it; Resume from the old position asks instead of rebinding.
 await stopForm.getByRole('button',{name:'Move earlier',exact:true}).click();
 await expect(player).toContainText('stop 2 of 3');await expect(player.getByTestId('tour-narration')).toHaveText('Third: the reports.');
 await player.getByRole('button',{name:'Stop tour',exact:true}).click();
 await panel.getByRole('button',{name:'Resume Resume walk',exact:true}).click();
 await expect(panel.getByTestId('tour-resume-choice')).toContainText('The stop you were on moved from position 3 to 2 of 3.');await expect(player).toHaveCount(0);
 await panel.getByRole('button',{name:'Continue at stop 2',exact:true}).click();
 await expect(player).toContainText('stop 2 of 3');await expect(player.getByTestId('tour-narration')).toHaveText('Third: the reports.');

 // A saved context keeps the tour position by stop ID and restores it.
 await page.getByRole('button',{name:'Navigate',exact:true}).click();
 const saved=page.getByTestId('saved-contexts');await saved.getByLabel('Saved context name',{exact:true}).fill('On the reports stop');await saved.getByRole('button',{name:'Save context',exact:true}).click();
 await page.getByRole('button',{name:'Tours',exact:true}).click();await player.getByRole('button',{name:'Stop tour',exact:true}).click();
 await page.getByRole('button',{name:'Navigate',exact:true}).click();await saved.getByRole('button',{name:'Restore On the reports stop',exact:true}).click();
 await expect(player).toContainText('Resume walk · stop 2 of 3');await expect(player.getByTestId('tour-narration')).toHaveText('Third: the reports.');

 // Remove the stop (one Undo restores it); Resume then says it is gone and offers only explicit choices.
 await stopForm.getByRole('button',{name:'Remove stop',exact:true}).click();
 await expect(panel.getByTestId('tour-notice')).toContainText('Removed stop 2. One Undo restores it.');await expect(player).toContainText('stop 2 of 2');
 await player.getByRole('button',{name:'Stop tour',exact:true}).click();
 await panel.getByRole('button',{name:'Resume Resume walk',exact:true}).click();
 await expect(panel.getByTestId('tour-resume-choice')).toContainText('The stop you were on is no longer in Resume walk.');
 await expect(panel.getByRole('button',{name:/^Continue at stop/})).toHaveCount(0);
 await panel.getByRole('button',{name:'Stay here',exact:true}).click();await expect(panel.getByTestId('tour-resume-choice')).toHaveCount(0);await expect(player).toHaveCount(0);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await panel.getByRole('button',{name:'Play Resume walk',exact:true}).click();await expect(player).toContainText('stop 1 of 3');
 expect(errors).toEqual([]);
});
