import {test,expect,type Page} from '@playwright/test';
import {documentSchema} from '../../src/core/model';

/* Slot decisions: the Inspector reads each candidate as adopted, rejected, under test or candidate and a cited observation's
 * review state; the decisions figure is drawn offline from the public document only. Synthetic fixture. */
const obs=(id:string,over:Record<string,unknown>={})=>({id,nodeId:'memory',sourceApp:'synthetic-lab',authority:'Synthetic lab',observedAt:'2026-11-03T10:00:00Z',sourceRevision:'r1',claim:'observed',summary:`Synthetic result ${id}`,visibility:'public',reviewedAt:'2026-11-04T10:00:00Z',...over});
const doc=documentSchema.parse({schemaVersion:1,id:'slot-decisions-browser',title:'Slot decisions',rootViewId:'root',
 nodes:[{id:'memory',label:'Memory layer',kind:'storage',choices:[{id:'memory-slot',title:'Memory layer slot',goal:'Pick the memory layer',status:'accepted',chosenOptionId:'notes',decidedBy:'Synthetic Person',decidedAt:'2026-11-05',
  observationIds:['exp-reviewed','exp-pending'],
  options:[{id:'notes',label:'Small notes',summary:'Claims with pointers'},
   {id:'transcripts',label:'Full transcripts',rejection:{reason:'Synthetic: crowds out the task context.',decidedAt:'2026-11-02',decidedBy:'Synthetic Person'}},
   {id:'index',label:'Derived index',testPlan:'Synthetic: compare retrieval with and without the index.'}]}]},{id:'agent',label:'Agent',kind:'model'}],
 edges:[{id:'e1',source:'agent',target:'memory',label:'reads'}],
 views:[{id:'root',title:'Agent memory',nodeIds:['memory','agent'],edgeIds:['e1'],positions:{memory:{x:300,y:0},agent:{x:0,y:0}}}],
 observations:[obs('exp-reviewed'),obs('exp-pending',{reviewedAt:undefined,summary:'PENDING_RESULT_SENTINEL'})]});
const svgOf=(page:Page)=>page.getByTestId('design-preview').locator('img.design-figure').evaluate(async(i:HTMLImageElement)=>(await fetch(i.src)).text());

test('slot decisions: Inspector shows adopted, rejected and under test with cited observation review state; the decisions figure exports offline',async({page})=>{
 const errors:string[]=[],network:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');page.on('request',r=>{if(!/^(?:https?:\/\/(?:localhost|127\.0\.0\.1)|blob:|data:)/.test(r.url()))network.push(r.url());});
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(doc));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.getByTestId('view-root').getByRole('button',{name:'Explore Memory layer',exact:true}).click();
 await page.getByRole('button',{name:'Inspector',exact:true}).click();
 const card=page.getByRole('region',{name:'Choice Memory layer slot',exact:true}).first();
 const options=card.getByRole('list',{name:'Options of Memory layer slot',exact:true});
 await expect(options.locator('[data-option-slot="adopted"]')).toContainText('Small notes');await expect(options.locator('[data-option-slot="adopted"]')).toContainText('chosen on 2026-11-05');
 await expect(options.locator('[data-option-slot="rejected"]')).toContainText('Rejected on 2026-11-02 by Synthetic Person: Synthetic: crowds out the task context.');
 await expect(options.locator('[data-option-slot="under-test"]')).toContainText('Test plan (planned, not a result): Synthetic: compare retrieval');
 const cited=card.getByRole('region',{name:'Observations cited by Memory layer slot',exact:true});
 await expect(cited.locator('[data-observation-state="reviewed"]')).toContainText('Observed 2026-11-03 · Synthetic result exp-reviewed');
 await expect(cited.locator('[data-observation-state="awaiting-review"]')).toContainText('Awaiting review');await expect(cited.locator('[data-observation-state="awaiting-review"]')).toContainText('not evidence until the author reviews it');
 // The figure reads the public document: the unreviewed observation never appears, and nothing leaves the machine.
 await page.getByRole('button',{name:'Diagram Design',exact:true}).click();
 const preview=page.getByTestId('design-preview'),figure=preview.locator('img.design-figure');
 await preview.getByLabel('Figure type').selectOption('decisions');await expect(figure).toHaveAttribute('data-design-type','decisions');await expect(preview.getByTestId('design-withheld')).toHaveCount(0);
 const svg=await svgOf(page);
 expect([...svg.matchAll(/data-dd-option-state="([a-z-]+)"/g)].map(m=>m[1])).toEqual(['adopted','rejected','under-test']);
 expect(svg).toContain('Observed 2026-11-03 · Synthetic result exp-reviewed');expect(svg).toContain('Decision recorded by Synthetic Person on 2026-11-05; a presentation, not a verification.');
 expect(svg).not.toContain('PENDING_RESULT_SENTINEL');
 await expect.poll(()=>figure.evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth)).toBeGreaterThan(600);await preview.screenshot({path:'test-results/slot-decisions.png'});
 expect(errors).toEqual([]);expect(network).toEqual([]);
});
