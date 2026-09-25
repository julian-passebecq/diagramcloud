import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,readFileSync} from 'node:fs';
import {parseProjection} from '../contracts/mongokuProjection';

const observation={id:'obs-e2e',nodeId:'checks',sourceApp:'datapass-vscode',authority:'GitHub Actions workflow “quality”',observedAt:'2026-09-20T08:30:00Z',sourceRevision:'4ad1f4d',claim:'verified',summary:'Required-field checks ran green on the recorded head.',link:'https://github.com/julian-passebecq/diagramcloud/actions',caveat:'CI on synthetic rows only.',blockIds:[],visibility:'private',shareable:false};

async function observationPatch(page:Page,value:Record<string,unknown>){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByRole('button',{name:'New observation patch',exact:true}).click();
 const editor=page.getByLabel('Project JSON'),patch=JSON.parse(await editor.inputValue());
 expect([patch.format,patch.target,patch.operations[1].path]).toEqual(['diagramcloud.patch','project','/observations/-']);
 patch.operations=[{op:'test',path:'/nodes/@checks/id',value:'checks'},{op:'add',path:'/observations/-',value}];
 await editor.fill(JSON.stringify(patch));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
}

test('an external observation is reviewed via preview/patch, presented, cited in the story and exported in the index',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 const checks=page.getByRole('button',{name:'Explore SQL quality checks',exact:true});
 await expect(checks.locator('.node-realization')).toHaveText('Designed');
 await expect(checks.locator('.status-dot')).toHaveAttribute('title',/not a deployment, test or business-validation claim/);

 // Credentials are refused before anything changes, and the value is not echoed.
 await observationPatch(page,{...observation,summary:'Deployed with password=hunter2'});
 await expect(page.getByRole('alert')).toContainText('summary: credential-like value');
 await expect(page.getByRole('alert')).not.toContainText('hunter2');
 await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Close dialog'}).click();

 await observationPatch(page,observation);
 const changes=page.getByRole('region',{name:'Proposed changes'});
 for(const text of ['Observations','datapass-vscode','GitHub Actions workflow “quality”','2026-09-20T08:30:00Z','4ad1f4d','CI on synthetic rows only.'])await expect(changes).toContainText(text);
 await expect(page.getByRole('note',{name:'Check before applying'})).toContainText('claims “verified” as of 2026-09-20T08:30:00Z (revision 4ad1f4d)');
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();

 // Arrives private and unreviewed; the card chip says what was observed and when, not “done”.
 await expect(checks.locator('.node-realization')).toHaveText('Verified · 2026-09-20');
 await checks.click();
 const card=page.getByTestId('observation-obs-e2e');
 await expect(card).toContainText('Not reviewed · private');await expect(card).toContainText('4ad1f4d');await expect(card).toContainText('2026-09-20T08:30:00Z');
 await expect(card.getByRole('link',{name:'Open source ↗'})).toHaveAttribute('href',observation.link);
 await expect(card.getByLabel('Shareable in portfolio index: obs-e2e')).toBeDisabled();
 await card.getByRole('button',{name:'Mark reviewed',exact:true}).click();
 await card.getByLabel('Visibility of observation obs-e2e').selectOption('public');
 await card.getByLabel('Shareable in portfolio index: obs-e2e').check();
 await expect(card).toContainText('Presented');await expect(card).toContainText('Shareable in index');await expect(card).toContainText('Verified');

 // A story step cites the reviewed evidence; the claim and its authority stay the source app's.
 await page.getByRole('button',{name:'Story',exact:true}).click();
 const step=page.locator('.story-pick').filter({hasText:'SQL quality checks'}).first();await step.click();
 const form=page.getByRole('form',{name:/Edit step/});
 await form.getByRole('checkbox',{name:/SQL quality checks: Verified · datapass-vscode · 2026-09-20/}).check();
 await form.getByRole('button',{name:'Save step',exact:true}).click();
 await expect(page.getByRole('list',{name:'Reviewed evidence for this step'})).toContainText('Verified · Required-field checks ran green');
 await expect(page.getByRole('list',{name:'Reviewed evidence for this step'})).toContainText('datapass-vscode @ 4ad1f4d · 2026-09-20 · authority: GitHub Actions workflow “quality”');

 await page.getByRole('tab',{name:'Portfolio'}).click();await checks.click();
 await expect(page.getByTestId('observation-obs-e2e')).toContainText('Presented');
 await expect(page.getByTestId('observation-obs-e2e').getByRole('button')).toHaveCount(0);
 await page.getByTestId('view-overview').screenshot({path:'test-results/realization/presented-canvas.png'});await page.getByRole('region',{name:'Realization'}).screenshot({path:'test-results/realization/presented-card.png'});

 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:/Portfolio index \(Mongoku\)/}).click();
 const file=await wait;expect(file.suggestedFilename()).toBe('total-project-controls.portfolio-index.json');
 mkdirSync('test-results/realization',{recursive:true});await file.saveAs('test-results/realization/index.json');
 const text=readFileSync('test-results/realization/index.json','utf8'),index=JSON.parse(text),parsed=parseProjection(index);
 expect(parsed.ok,parsed.ok?'':parsed.issues.join('; ')).toBe(true);
 expect(index.items).toEqual([expect.objectContaining({id:'obs-e2e',kind:'realization',status:'verified',openUri:observation.link})]);
 expect(index.counts.story_present).toBe(1);expect(index.visibility).toBe('private');
 for(const leak of ['data:image','"nodes"','"blocks"','"views"','privateNotes'])expect(text).not.toContain(leak);
 expect(errors).toEqual([]);
});

test('a deep link opens a component with its parent architecture kept above',async({page})=>{
 await page.goto('/?project=total-project-controls&view=validation&node=mandatory');
 await expect(page.getByRole('heading',{name:'TotalEnergies',exact:true})).toBeVisible();
 await expect(page.getByTestId('view-overview')).toBeVisible();await expect(page.getByTestId('view-validation')).toBeVisible();
 await expect(page.locator('.evidence-section h2')).toHaveText('Required fields');
 await expect(page.getByRole('region',{name:'Realization'})).toContainText('Planned / designed only');
 await page.goto('/?project=not-here');
 await expect(page.getByRole('status')).toContainText('The link asks for project “not-here”');
});
