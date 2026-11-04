import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const tasks=readFileSync('tests/fixtures/delivery-evidence/linked-tasks.json','utf8');
const worker=JSON.parse(tasks);worker.scope.repoId='example.worker';worker.tasks[0].title='Synthetic worker with an independent scope';
const workerRaw=JSON.stringify(worker), workerHash=createHash('sha256').update(workerRaw).digest('hex');
const plan=JSON.parse(readFileSync('tests/fixtures/delivery-evidence/linked-plan.json','utf8'));
plan.handoff.block_details.find((d:any)=>d.pm_task_refs?.length).pm_task_refs.push({task_id:worker.tasks[0].id,input_sha256:workerHash,revision:worker.revision,scope:worker.scope});
const upload=(name:string,raw:string)=>({name,mimeType:'application/json',buffer:Buffer.from(raw)});
async function open(page:Page) {
  await page.goto('/?workspace=v3');const w=page.getByTestId('v3-workspace');
  if(await w.getByRole('region',{name:'Navigation map and contextual activity'}).isHidden()){
    const wide=w.getByRole('button',{name:'Bottom panel',exact:true});
    if(await wide.count())await wide.click();else await w.getByRole('navigation',{name:'Workspace panes'}).getByRole('button',{name:'Map / activity',exact:true}).click();
  }
  await page.getByText('Dock panels',{exact:true}).click();await page.getByLabel('Main dock panel',{exact:true}).selectOption('work');await page.getByText('Dock panels',{exact:true}).click();
  const panel=w.getByRole('region',{name:'Delivery evidence',exact:true});await panel.getByLabel('Load delivery plan',{exact:true}).setInputFiles(upload('plan.json',JSON.stringify(plan)));
  const summary=panel.locator('summary').filter({hasText:'PM task correspondence'});if(await summary.count())await summary.click();
  return panel;
}
for(const width of [1440,390])test.describe(`PM task inventory ${width}`,()=>{
  test.use({viewport:{width,height:1000}});
  test('independent exact snapshots, duplicate refusal, removal and replace semantics',async({page})=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const panel=await open(page);
    await panel.getByLabel('Load PM task snapshot',{exact:true}).setInputFiles(upload('api.json',tasks));
    await panel.getByLabel('Add PM task snapshot',{exact:true}).setInputFiles(upload('worker.json',workerRaw));
    await expect(panel.getByText('MATCHED',{exact:true})).toHaveCount(2);
    await expect(panel).toContainText('Synthetic worker with an independent scope');
    await panel.getByLabel('Add PM task snapshot',{exact:true}).setInputFiles(upload('duplicate.json',workerRaw));
    await expect(panel.getByRole('alert')).toContainText('already loaded');await expect(panel.getByText('MATCHED',{exact:true})).toHaveCount(2);
    await panel.getByRole('button',{name:'Remove task snapshot '+workerHash,exact:true}).click();
    await expect(panel.getByText('MATCHED',{exact:true})).toHaveCount(1);await expect(panel.getByText('SNAPSHOT_MISMATCH',{exact:true})).toHaveCount(1);
    await expect(panel).not.toContainText('Synthetic worker with an independent scope');await expect(panel.getByLabel('Load PM task snapshot',{exact:true})).toBeFocused();
    await panel.getByLabel('Load PM task snapshot',{exact:true}).setInputFiles(upload('worker-only.json',workerRaw));
    await expect(panel).not.toContainText('Implement the synthetic request reader');await expect(panel.getByText('MATCHED',{exact:true})).toHaveCount(1);
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
  });
  test('clear invalidates a pending add; public transition discards inventory',async({page})=>{
    const panel=await open(page);await panel.getByLabel('Load PM task snapshot',{exact:true}).setInputFiles(upload('api.json',tasks));
    await page.evaluate(()=>{const text=File.prototype.text;File.prototype.text=function(){if(this.name==='slow-worker.json')return new Promise<string>(resolve=>{(window as any).releaseTask=()=>void text.call(this).then(resolve);});return text.call(this);};});
    await panel.getByLabel('Add PM task snapshot',{exact:true}).setInputFiles(upload('slow-worker.json',workerRaw));
    await panel.getByRole('button',{name:'Clear task snapshot',exact:true}).click();await page.evaluate(()=>(window as any).releaseTask());
    await expect(panel.getByText('NO_SNAPSHOT',{exact:true})).toHaveCount(2);await expect(panel).not.toContainText('Synthetic worker with an independent scope');
    await panel.getByLabel('Add PM task snapshot',{exact:true}).setInputFiles(upload('worker.json',workerRaw));
    await page.getByRole('tab',{name:'Portfolio',exact:true}).click();await expect(page.getByTestId('v3-workspace')).not.toContainText('Synthetic worker with an independent scope');
    await page.getByRole('tab',{name:'Explore',exact:true}).click();await expect(page.getByTestId('v3-workspace')).not.toContainText('Synthetic worker with an independent scope');
  });
});
