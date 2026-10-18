import {test,expect,type Page} from '@playwright/test';
import {validateDocument,type Project} from '../../src/core/model';
import {PM_TASK_REFUSAL} from '../../src/development/pmTasks';

// Synthetic datapass.owner-tasks/1 document: no real organization, project, task or person.
const task=(id:string,title:string,state:string,dependencies:string[]=[])=>({id,title,description:`Synthetic description for ${title}. Not a real task.`,state,desiredDate:null,dependencies,reviewStatus:state==='DONE'?'APPROVED':'NOT_REQUESTED',acceptanceIds:['UX28'],author:'Synthetic author',createdAt:'2026-10-18T00:00:00Z',updatedAt:'2026-10-18T00:00:00Z'});
const owner=()=>({schema:'datapass.owner-tasks/1',scope:{organizationId:'synthetic-org',privacyDomainId:'private',projectId:'synthetic-app',repoId:'synthetic-repo'},revision:3,
 tasks:[task('a','Synthetic schema task','DONE'),task('b','Synthetic reader task','IN_PROGRESS',['a']),task('c','Synthetic view task','TODO',['b'])]});

async function current(page:Page):Promise<Project>{
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const p=validateDocument(JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue()));
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();return p;
}
async function validate(page:Page,raw:string){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON',{exact:true}).fill(raw);
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
}

test('PM task snapshot: import dialog preview, Apply, state/dependency/detail views, reload keeps it',async({page})=>{
 await page.goto('/');const before=await current(page);
 await validate(page,JSON.stringify(owner()));
 const dialog=page.getByRole('dialog');
 await expect(dialog.getByText('Valid: Private work plan',{exact:true})).toBeVisible();
 await expect(dialog.getByText('A new local project will be added.',{exact:true})).toBeVisible();
 // Preview only: nothing is applied before Apply.
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();expect(await current(page)).toEqual(before);
 await validate(page,JSON.stringify(owner()));
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();

 const root=page.getByTestId('view-root');
 await expect(root.getByRole('heading',{name:'Private PM task projection',exact:true})).toBeVisible();
 // State column: DONE is a reported, source-declared state.
 await root.getByRole('button',{name:'Explore Done - reported',exact:true}).click();
 const done=page.getByTestId('view-state-done');
 await expect(done.getByRole('button',{name:'Explore Synthetic schema task',exact:true})).toBeVisible();
 await expect(done.getByText('Done - reported; not a live observation',{exact:true})).toBeVisible();
 // Task detail one level deeper, parent retained.
 await done.getByRole('button',{name:'Explore Synthetic schema task',exact:true}).click();
 const detail=page.locator('[data-testid^="view-detail-task-"]');
 await expect(detail.getByRole('button',{name:'Explore Task scope and acceptance',exact:true})).toBeVisible();
 await expect(root).toBeVisible();
 // Dependency view: the three tasks with two declared prerequisites.
 await root.getByRole('button',{name:'Explore Dependencies',exact:true}).click();
 const deps=page.getByTestId('view-dependencies');
 for(const title of ['Synthetic schema task','Synthetic reader task','Synthetic view task'])await expect(deps.getByRole('button',{name:'Explore '+title,exact:true})).toBeVisible();
 await expect(deps.getByText('3 components · 2 connections',{exact:true})).toBeVisible();

 const imported=await current(page);
 expect(imported.id).not.toBe(before.id);expect(imported.title).toBe('Private work plan');
 expect(imported.observations).toEqual([]);expect(imported.nodes.every(n=>(n.status??'idle')==='idle')).toBe(true);
 expect(imported.nodes.filter(n=>n.tags?.includes('pm-task'))).toHaveLength(3);

 await page.reload();
 if(!await page.getByTestId('view-root').getByRole('heading',{name:'Private PM task projection',exact:true}).isVisible()){
  const gallery=page.getByRole('button',{name:'Project gallery',exact:true});if(await gallery.isVisible())await gallery.click();
  await page.locator('.project-card').filter({hasText:'Private work plan'}).first().click();
 }
 await expect(page.getByTestId('view-root').getByRole('heading',{name:'Private PM task projection',exact:true})).toBeVisible();
 const reopened=await current(page);expect(reopened.id).toBe(imported.id);expect(reopened.nodes).toEqual(imported.nodes);
});

test('PM task snapshot: an invalid or cyclic file is refused without mutation',async({page})=>{
 await page.goto('/');const before=await current(page);
 const cyclic=owner();cyclic.tasks[0].dependencies=['c'];
 const unknownField={...owner(),approval:'GRANTED'};
 for(const raw of [JSON.stringify(cyclic),JSON.stringify(unknownField)]){
  await validate(page,raw);
  await expect(page.getByRole('alert')).toHaveText(PM_TASK_REFUSAL);
  await expect(page.getByRole('button',{name:'Apply imported document',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  expect(await current(page)).toEqual(before);
 }
});
