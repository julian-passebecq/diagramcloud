import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateDocument,type Project} from '../../src/core/model';
import {buildReviewWorkspace} from '../../examples/review-workspace/build';
import {buildDomainDataReference} from '../../examples/domain-data/build';

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

/*
 * 1.32.0 release journeys (UX36-UX38 and the Galaxy-style rows UX26/UX27/UX29/UX30). Every input is synthetic and labelled
 * synthetic: the delivery and history fixtures under tests/fixtures/, the review-workspace example and the domain-data example.
 */
async function importProject(page:Page,doc:Project){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
}
async function dock(page:Page,primary:string){
 if(await workspace(page).getByRole('region',{name:'Navigation map and contextual activity'}).isHidden())await workspace(page).getByRole('button',{name:'Bottom panel',exact:true}).click();
 await page.getByText('Dock panels',{exact:true}).click();await page.getByLabel('Main dock panel',{exact:true}).selectOption(primary);await page.getByText('Dock panels',{exact:true}).click();
}
// A synthetic project whose component IDs equal the history fixture's exact surface and path values.
function exampleService():Project{
 const n=(id:string,label:string,kind:Project['nodes'][number]['kind'])=>({id,label,kind,provider:'Synthetic',icon:'generic',summary:`Synthetic ${label}. Not a real service.`,role:'Synthetic',status:'idle' as const,basis:'planned' as const,sourceIds:[],blockIds:[],tags:['synthetic'],visibility:'public' as const});
 return validateDocument({schemaVersion:1,id:'synthetic-example-service',title:'Example Service (synthetic)',category:'Reference',summary:'Synthetic service for the delivery and history journey.',author:'Synthetic author',rootViewId:'overview',provenance:'Synthetic fixture.',
  nodes:[n('svc.api','Request endpoint','process'),n('svc.ui','Request form','app')],edges:[],
  views:[{id:'overview',title:'Example Service',description:'Synthetic.',nodeIds:['svc.api','svc.ui'],edgeIds:[],positions:{'svc.api':{x:0,y:0},'svc.ui':{x:330,y:0}},visibility:'public'}],
  blocks:[],sources:[],story:[],tours:[],observations:[]});
}

test('Galaxy-style plan: source identity, owner conflict, named gaps, remaining range, intervals, results and five history questions',async({page})=>{
 test.setTimeout(90000);
 const attempted=await offline(page.context()),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/?workspace=v3');await expect(workspace(page)).toBeVisible();await importProject(page,exampleService());
 const before=await current(page);
 await dock(page,'work');
 const plan=workspace(page).getByRole('region',{name:'Delivery evidence'});await expect(plan).toContainText('No delivery plan loaded');
 await plan.getByLabel('Load delivery plan').setInputFiles('tests/fixtures/delivery-evidence/example-service.json');
 const sha=createHash('sha256').update(readFileSync('tests/fixtures/delivery-evidence/example-service.json')).digest('hex');
 await expect(plan).toContainText(sha);await expect(plan).toContainText('Example Service delivery plan (synthetic)');
 await expect(plan.getByText('Unordered overlap',{exact:true})).toHaveCount(1);
 await expect(plan).toContainText('NO_ESTIMATE');await expect(plan).toContainText('TOKENS_UNKNOWN');
 await expect(plan.getByRole('note').filter({hasText:'Uncalibrated'})).toBeVisible();
 await expect(plan.getByRole('region',{name:'Remaining effort'})).toContainText('UNKNOWN');
 const intervals=plan.getByRole('region',{name:'Dated intervals'});await expect(intervals.locator('tbody tr')).toHaveCount(1);await expect(intervals).toContainText('Europe/Paris');
 const results=plan.getByRole('region',{name:'Result and artifact references'});await expect(results).toContainText('abc1234');await expect(results).toContainText('DECLARED');
 await expect(plan.getByRole('button',{name:/dispatch|launch|approve/i})).toHaveCount(0);
 // Portfolio: the private plan is withheld (an audience change resets the session dock, so it is chosen again).
 await page.getByRole('tab',{name:'Portfolio',exact:true}).click();await dock(page,'work');
 await expect(workspace(page).getByRole('region',{name:'Delivery evidence'})).toContainText('This delivery plan is private and is not shown to this audience.');
 expect(await page.content()).not.toContain('Define the request schema');
 await page.getByRole('tab',{name:'Explore',exact:true}).click();

 // Five history questions over a supplied synthetic slice.
 await dock(page,'git');
 const history=workspace(page).getByRole('region',{name:'Change history'});
 await history.getByLabel('Load history records').setInputFiles('tests/fixtures/history-questions/example-history.json');
 await expect(history.getByLabel('History question',{exact:true})).toBeVisible();
 await expect(history.locator('.dc-ancestry').first()).toBeVisible();
 await history.getByLabel('History question',{exact:true}).selectOption('associations');
 await expect(history).toContainText('request-form');
 await history.getByLabel('History question',{exact:true}).selectOption('impact');
 await history.getByRole('button',{name:'svc.ui',exact:true}).click();
 await expect(page).toHaveURL(/node=svc\.ui/);
 expect(await current(page),'reading a plan and history never edits the project').toEqual(before);
 expect(attempted).toEqual([]);expect(errors).toEqual([]);
});

test('Synthetic commerce: join 42 to 70, stage evidence, meeting summary',async({page},testInfo)=>{
 test.setTimeout(90000);
 const attempted=await offline(page.context()),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/?workspace=v3');await expect(workspace(page)).toBeVisible();
 await importProject(page,buildReviewWorkspace().project);
 await page.getByRole('tab',{name:'Explore',exact:true}).click();
 await card(page,'overview','Inspect the join').click();
 await dock(page,'evidence');
 const join=workspace(page).getByRole('region',{name:'Selection evidence'}).getByRole('region',{name:'Join evidence'});
 await expect(join).toContainText('42');await expect(join).toContainText('70');await expect(join).toContainText('ynthetic');
 const base=await current(page);
 // Edit mode: the committed request collides with the existing prefix and is refused; a renamed copy stages one patch.
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 const request=workspace(page).getByRole('region',{name:'Inspect a join'});
 await request.getByLabel('Load join request').setInputFiles('examples/review-workspace/join.request.json');
 await expect(request.getByRole('alert')).toContainText('already used');
 const renamed=testInfo.outputPath('join.request.renamed.json');
 writeFileSync(renamed,JSON.stringify({...JSON.parse(readFileSync('examples/review-workspace/join.request.json','utf8')),id:'order-join-review'}));
 await request.getByLabel('Load join request').setInputFiles(renamed);
 await request.getByRole('button',{name:'Stage as evidence',exact:true}).click();
 const review=page.getByRole('dialog',{name:'JSON / AI workspace'});await expect(review).toBeVisible();
 await review.getByRole('button',{name:'Close dialog',exact:true}).click();
 expect(await current(page),'preview applies nothing').toEqual(base);
 await request.getByRole('button',{name:'Stage as evidence',exact:true}).click();
 await review.getByRole('button',{name:'Apply imported document',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 const applied=await current(page);expect(applied.revision).toBe(base.revision+1);
 const added=applied.blocks.filter(b=>b.id.startsWith('order-join-review.'));expect(added).toHaveLength(6);expect(added.every(b=>b.visibility==='private')).toBe(true);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect.poll(async()=>(await current(page)).blocks.some(b=>b.id.startsWith('order-join-review.'))).toBe(false);
 // Export & share > Meeting summary: the overview view, offline HTML.
 await page.getByRole('tab',{name:'Explore',exact:true}).click();
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 await page.getByRole('button',{name:/^Meeting summary \(HTML\)/}).click();
 const form=page.getByRole('form',{name:'Meeting summary'});await expect(form).toBeVisible();
 await expect(form.getByRole('checkbox',{name:'Business question and data path',exact:true})).toBeChecked();
 await form.getByLabel('Audience',{exact:true}).fill('Synthetic business owner and data engineer');
 const pending=page.waitForEvent('download');await form.getByRole('button',{name:'Download meeting summary',exact:true}).click();const download=await pending;
 expect(download.suggestedFilename()).toBe('review-workspace-reference.meeting-summary.html');
 const html=readFileSync((await download.path())!,'utf8');
 expect(html).toContain('Why the joined total changed');expect(html).toContain('Revision');expect(html).not.toMatch(/<script/i);expect(html).not.toContain('order-join-review');
 expect(attempted).toEqual([]);expect(errors).toEqual([]);
});

for(const size of [{width:1440,height:1000},{width:390,height:844}])test(`World/data correspondence with a catalogue pattern (${size.width})`,async({page})=>{
 test.setTimeout(90000);
 const attempted=await offline(page.context()),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize(size);await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/?workspace=v3');await expect(workspace(page)).toBeVisible();
 await importProject(page,buildDomainDataReference().project);
 const before=await current(page);
 await page.getByRole('tab',{name:'Explore',exact:true}).click();
 await page.getByTestId('view-overview').getByRole('button',{name:'Explore Renewable-energy client',exact:true}).click();
 const toggle=workspace(page).getByRole('button',{name:'Linked views',exact:true});await toggle.click();await expect(toggle).toHaveAttribute('aria-pressed','true');
 const linked=page.getByTestId('linked-perspective'),toolbar=linked.getByRole('group',{name:'Linked views controls'});
 await toolbar.getByLabel('Left view',{exact:true}).selectOption('physical');await toolbar.getByLabel('Right view',{exact:true}).selectOption('data');
 const banner=linked.getByRole('region',{name:'Business question'});await expect(banner).toContainText('Renewable-energy client');
 await page.locator('.linked-pane[data-side="left"]').getByRole('button',{name:'Select component Wind sensor channel',exact:true}).click();
 if(size.width<=600)await linked.getByRole('navigation',{name:'Linked panes'}).getByRole('button',{name:'Show right view',exact:true}).click();
 const right=page.locator('.linked-pane[data-side="right"]');
 await expect(right.getByRole('status',{name:'Right view state'})).toContainText('Related, not the same object');
 await expect(right.locator('[data-mapping-target]')).toHaveCount(2);
 // The data-only view on the left: the business question stays.
 await toolbar.getByLabel('Left view',{exact:true}).selectOption('data');await expect(banner).toContainText('Renewable-energy client');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 expect(await current(page),'linked reading never edits the project').toEqual(before);
 // Learning catalogue: a practical pattern is a candidate alternative, never a recommended replacement.
 await page.goto('/?workspace=studio');
 await page.getByRole('button',{name:'Business overview',exact:true}).click();
 const catalogue=page.getByRole('region',{name:'Learning catalogue',exact:true});await expect(catalogue).toBeVisible();
 await catalogue.getByLabel('Entry kind',{exact:true}).selectOption('pattern');
 await catalogue.getByRole('button',{name:'Open lesson Power BI and Fabric App: reuse before migration',exact:true}).click();
 const lesson=catalogue.getByRole('article',{name:'Lesson: Power BI and Fabric App: reuse before migration'});
 await expect(lesson.getByRole('region',{name:'Alternatives'}).getByText('Candidate, not selected.')).toHaveCount(2);
 await expect(lesson).not.toContainText(/recommended replacement|we recommend/i);
 expect(attempted).toEqual([]);expect(errors).toEqual([]);
});
