import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {validateDocument,type Project} from '../../src/core/model';

/**
 * V3 release journey (1.30.0, W6): one pass through the real App with every non-loopback request aborted.
 * Open the V3 workspace, import a private PM task snapshot, explore it with Follow / Pin, open a capability example
 * through the ordinary import review, compare a session revision, present a tour with pause, detour and explicit
 * resume, then export the public HTML and open it with no network. Every input is synthetic.
 */
const LOOPBACK=/^(?:https?|wss?):\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?\//i;
async function offline(context:BrowserContext){
 const attempted:string[]=[];
 await context.route('**/*',route=>{const url=route.request().url();if(LOOPBACK.test(url)||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();attempted.push(url);return route.abort('internetdisconnected');});
 context.on('page',p=>p.on('websocket',ws=>{if(!LOOPBACK.test(ws.url()))attempted.push(ws.url());}));
 return attempted;
}
// Synthetic datapass.owner-tasks/1 snapshot: no real organization, project, task or person.
const task=(id:string,title:string,state:string,dependencies:string[]=[])=>({id,title,description:`Synthetic description for ${title}. Not a real task.`,state,desiredDate:null,dependencies,reviewStatus:state==='DONE'?'APPROVED':'NOT_REQUESTED',acceptanceIds:['UX28'],author:'Synthetic author',createdAt:'2026-10-18T00:00:00Z',updatedAt:'2026-10-18T00:00:00Z'});
const ownerTasks=()=>({schema:'datapass.owner-tasks/1',scope:{organizationId:'synthetic-org',privacyDomainId:'private',projectId:'synthetic-release-app',repoId:'synthetic-repo'},revision:1,
 tasks:[task('a','Synthetic release schema task','DONE'),task('b','Synthetic release reader task','IN_PROGRESS',['a']),task('c','Synthetic release view task','TODO',['b'])]});

const workspace=(page:Page)=>page.getByTestId('v3-workspace');
const explorer=(page:Page)=>workspace(page).getByRole('complementary',{name:'Explorer',exact:true});
const card=(page:Page,view:string,label:string)=>page.getByTestId('view-'+view).getByRole('button',{name:'Explore '+label,exact:true});
const followMode=(page:Page)=>page.getByTestId('project-context').getByRole('status',{name:'Context follow mode'});
const tours=(page:Page)=>page.getByRole('region',{name:'Tours'});
const player=(page:Page)=>tours(page).getByRole('region',{name:'Tour player'});
const comparison=(page:Page)=>page.getByTestId('linked-comparison');
async function current(page:Page):Promise<Project>{await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const doc=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));await page.getByRole('button',{name:'Close dialog',exact:true}).click();return doc;}

test('V3 release journey: workspace, PM import, Follow/Pin, capability example, compare, present with detour and resume, offline HTML export',async({page,browser})=>{
 test.setTimeout(120000);
 const attempted=await offline(page.context()),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));

 // 1. Open the V3 workspace.
 await page.goto('/?workspace=v3');await expect(workspace(page)).toBeVisible();
 await expect(page.getByRole('button',{name:'V3 workspace',exact:true})).toHaveAttribute('aria-pressed','true');

 // 2. Import the PM task snapshot: preview, then Apply; a private read-only projection with declared states only.
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(ownerTasks()));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await expect(page.getByRole('dialog').getByText('Valid: Private work plan',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await expect(page.getByTestId('view-root').getByRole('heading',{name:'Private PM task projection',exact:true})).toBeVisible();
 const plan=await current(page);
 expect(plan.observations).toEqual([]);expect(plan.nodes.filter(n=>n.tags?.includes('pm-task'))).toHaveLength(3);

 // 3. Explore with Follow, then Pin: the companion keeps the pinned scope while the selection moves.
 await page.getByRole('tab',{name:'Explore',exact:true}).click();
 await card(page,'root','Done - reported').click();await expect(page.getByTestId('view-state-done')).toBeVisible();
 await expect(page.getByTestId('view-state-done').getByText('Done - reported; not a live observation',{exact:true})).toBeVisible();
 await expect(followMode(page)).toContainText('Following selection: Done - reported');
 await page.getByTestId('project-context').getByRole('button',{name:'Pin context',exact:true}).click();
 await card(page,'root','Dependencies').click();await expect(page.getByTestId('view-dependencies')).toBeVisible();
 await expect(followMode(page)).toContainText('Pinned scope: Done - reported');await expect(followMode(page)).toContainText('Active selection: Dependencies');
 await page.getByTestId('project-context').getByRole('button',{name:'Follow selection',exact:true}).click();await expect(followMode(page)).toContainText('Following selection: Dependencies');
 expect(await current(page),'exploring never edits the imported plan').toEqual(plan);

 // 4. Open a capability example: the brief enters the ordinary import review and is applied by the author.
 await explorer(page).getByRole('button',{name:'Navigate',exact:true}).click();
 await explorer(page).getByLabel('Load capability brief',{exact:true}).setInputFiles('tests/fixtures/v3-capabilities/synthetic-rag.guide.json');
 const review=page.getByRole('dialog',{name:'JSON / AI workspace'});await expect(review).toBeVisible();
 await expect(review.getByText(/^Valid: /)).toBeVisible();await expect(review.getByText('A new local project will be added.',{exact:true})).toBeVisible();
 await review.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await expect(card(page,'guide-root','Capabilities')).toBeVisible();
 const example=await current(page);
 expect(example.id).not.toBe(plan.id);expect(example.observations).toEqual([]);

 // 5. Compare: an edit in the session, then the linked comparison with the open revision; Return keeps the view.
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.getByLabel('Reading task',{exact:true}).selectOption('compare');
 const launcher=page.getByTestId('comparison-launcher');await expect(launcher).toBeVisible();
 await card(page,'guide-root','Interfaces').click();
 await explorer(page).getByRole('button',{name:'Inspector',exact:true}).click();
 await explorer(page).getByLabel('Component label',{exact:true}).fill('Synthetic entry surfaces');await explorer(page).getByRole('button',{name:'Apply component',exact:true}).click();
 await launcher.getByRole('button',{name:'Compare with the open revision',exact:true}).click();
 await expect(comparison(page)).toBeVisible();
 await expect(comparison(page).getByTestId('comparison-pairing')).toContainText('Paired by exact stable ID');
 await expect(comparison(page).getByRole('group',{name:'Architecture / design'})).toContainText('Synthetic entry surfaces: renamed from "Interfaces"');
 await expect(comparison(page).getByRole('button',{name:/apply/i})).toHaveCount(0);
 await comparison(page).getByRole('button',{name:'Return to workspace',exact:true}).click();
 await expect(comparison(page)).toHaveCount(0);await expect(card(page,'guide-root','Synthetic entry surfaces')).toBeVisible();
 const compared=await current(page);expect(compared.revision,'comparing records no revision beyond the edit').toBe(example.revision+1);

 // 6. Record a public tour on the root view, then present it: pause for a question, detour, return and resume.
 await page.getByRole('button',{name:'Up to parent view',exact:true}).click();await expect(page.getByTestId('view-guide-surfaces')).toHaveCount(0);
 await workspace(page).getByRole('button',{name:'Tours',exact:true}).click();
 const record=tours(page).getByRole('form',{name:'Record a tour stop'});
 await record.getByLabel('Narration',{exact:true}).fill('Synthetic release stop one: the capability guide.');
 await record.getByLabel('New tour title',{exact:true}).fill('Synthetic release walk');
 await record.getByRole('button',{name:'New tour from this stop',exact:true}).click();
 await expect(player(page)).toContainText('Synthetic release walk · stop 1 of 1');
 await player(page).getByRole('button',{name:'Stop tour',exact:true}).click();
 const recorded=await current(page);expect(recorded.tours?.map(t=>t.title)).toEqual(['Synthetic release walk']);

 // A recorded tour leaves no unsaved form edit behind: the audience change is immediate.
 await page.getByRole('tab',{name:'Present',exact:true}).click();
 await expect(page.getByRole('alertdialog',{name:'Unsaved edit'})).toHaveCount(0);
 await expect(page.getByRole('tab',{name:'Present',exact:true})).toHaveAttribute('aria-selected','true');
 await workspace(page).getByRole('button',{name:'Tours',exact:true}).click();
 await tours(page).getByRole('button',{name:'Play Synthetic release walk',exact:true}).click();
 await expect(player(page)).toContainText('Synthetic release walk · stop 1 of 1');
 await expect(player(page).getByTestId('tour-narration')).toHaveText('Synthetic release stop one: the capability guide.');
 await player(page).getByRole('button',{name:'Pause for a question',exact:true}).click();
 await expect(player(page)).toContainText('Synthetic release walk · paused at stop 1 of 1');
 // Detour: drill into a child view; the presentation stays on its stop.
 await card(page,'guide-root','Capabilities').click();await expect(page.getByTestId('view-guide-list')).toBeVisible();
 await expect(player(page)).toContainText('paused at stop 1 of 1');
 await player(page).getByRole('button',{name:'Return and resume',exact:true}).click();
 await expect(page.getByTestId('view-guide-list')).toHaveCount(0);await expect(page.getByTestId('view-guide-root')).toBeVisible();
 await expect(tours(page).getByTestId('tour-notice')).toHaveText('Returned to the presentation. Resumed Synthetic release walk at stop 1 of 1.');
 await expect(player(page).getByTestId('tour-narration')).toHaveText('Synthetic release stop one: the capability guide.');
 await player(page).getByRole('button',{name:'Stop tour',exact:true}).click();
 expect(await current(page),'presenting, pausing and returning never edit the project').toEqual(recorded);

 // 7. Export the public HTML and open it with every request aborted.
 await page.getByRole('tab',{name:'Explore',exact:true}).click();
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:/^Interactive HTML/}).click();const download=await pending;
 const html=readFileSync((await download.path())!,'utf8');
 expect(html).toContain('Synthetic entry surfaces');expect(html).not.toContain('Original guide context (private)');
 const exported=await browser.newContext(),viewer=await exported.newPage(),viewerRequests:string[]=[],viewerErrors:string[]=[];
 await exported.route('**/*',route=>{viewerRequests.push(route.request().url());return route.abort();});
 viewer.on('pageerror',e=>viewerErrors.push(e.message));await viewer.setContent(html);
 await expect(viewer.getByRole('heading',{name:example.title,exact:true}).first()).toBeVisible();
 expect(viewerErrors).toEqual([]);expect(viewerRequests.filter(u=>!u.startsWith('data:'))).toEqual([]);await exported.close();
 await page.keyboard.press('Escape');

 expect(attempted,'no request left the loopback test server').toEqual([]);
 expect(errors).toEqual([]);
});
