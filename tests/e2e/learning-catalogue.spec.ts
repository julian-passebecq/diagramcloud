import {test,expect} from '@playwright/test';

// Static authored lessons only. No owner project, Git, cloud or AI service is needed; nothing is mapped or executed.
test('learning catalogue opens a warehouse lesson and the RAG lesson, changes depth and reveals hints',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const source=await page.getByLabel('Project JSON',{exact:true}).inputValue();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.getByRole('button',{name:'Business overview',exact:true}).click();
 const catalogue=page.getByRole('region',{name:'Learning catalogue',exact:true});
 await expect(catalogue).toBeVisible();
 await expect(catalogue.getByRole('status',{name:'Learning catalogue results'})).toHaveText('Showing 24 of 24 catalogue entries.');

 await catalogue.getByLabel('Entry kind',{exact:true}).selectOption('case-study');
 await expect(catalogue.getByRole('status',{name:'Learning catalogue results'})).toHaveText('Showing 1 of 24 catalogue entries.');
 await catalogue.getByLabel('Lesson reference family',{exact:true}).selectOption('Data');
 await expect(catalogue.getByText('No catalogue entries match these filters.',{exact:false})).toBeVisible();
 await catalogue.getByRole('button',{name:'Reset lesson filters',exact:true}).click();
 await catalogue.getByLabel('Learning domain',{exact:true}).selectOption('warehousing');
 await expect(catalogue.getByRole('status',{name:'Learning catalogue results'})).toHaveText('Showing 3 of 24 catalogue entries.');

 await catalogue.getByRole('button',{name:'Open lesson Slowly changing dimensions and temporal joins',exact:true}).click();
 const scd=catalogue.getByRole('article',{name:'Lesson: Slowly changing dimensions and temporal joins'});
 await expect(scd.getByRole('status',{name:'Explanation at selected depth'})).toContainText('Overview:');
 await scd.getByRole('radio',{name:'Mechanism',exact:true}).check();
 await expect(scd.getByRole('status',{name:'Explanation at selected depth'})).toContainText('Mechanism:');
 await scd.getByRole('radio',{name:'Detail',exact:true}).check();
 await expect(scd.getByRole('status',{name:'Explanation at selected depth'})).toContainText('half-open validity intervals');
 const join=scd.getByRole('list',{name:'Temporal join result'});
 await expect(join).toContainText('2026-06-15 → North');
 await expect(join).toContainText('2026-08-15 → South');
 await expect(scd.getByRole('region',{name:'In my project'})).toContainText('No reviewed mapping.');
 await expect(scd.getByRole('link',{name:'Dimension tables and historical change',exact:true})).toHaveAttribute('rel','noopener noreferrer');
 const downloaded=page.waitForEvent('download');
 await scd.getByRole('button',{name:'Download synthetic example JSON',exact:true}).click();
 expect((await downloaded).suggestedFilename()).toBe('lesson-example-warehouse.json');

 await catalogue.getByRole('button',{name:'Reset lesson filters',exact:true}).click();
 await catalogue.getByLabel('Search lessons',{exact:true}).fill('RAG indexing');
 await catalogue.getByRole('button',{name:'Open lesson RAG indexing, query-time retrieval and evaluation',exact:true}).click();
 const rag=catalogue.getByRole('article',{name:'Lesson: RAG indexing, query-time retrieval and evaluation'});
 await expect(rag).toBeVisible();
 await expect(scd).toHaveCount(0);
 await expect(rag.getByRole('region',{name:'Alternatives'})).toContainText('Candidate, not selected.');
 const interview=rag.getByRole('region',{name:'Interview'});
 await expect(interview).toContainText('How would you distinguish retrieval failure from generation failure?');
 await expect(interview.getByRole('list',{name:'Answer hints'})).toHaveCount(0);
 await interview.getByRole('button',{name:'Reveal answer hints',exact:true}).click();
 await expect(interview.getByRole('list',{name:'Answer hints'})).toContainText('Inspect what was retrieved.');
 await rag.getByRole('radio',{name:'Detail',exact:true}).check();
 await expect(rag.getByRole('status',{name:'Explanation at selected depth'})).toContainText('reranking');
 await rag.getByRole('button',{name:'Training, fine-tuning, inference and RAG',exact:true}).click();
 await expect(catalogue.getByRole('article',{name:'Lesson: Training, fine-tuning, inference and RAG'})).toBeVisible();

 // Browsing lessons never changes the authoring document.
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 expect(await page.getByLabel('Project JSON',{exact:true}).inputValue()).toBe(source);
});

test('a lesson with code snippets is inert: no script added, no request, document revision and storage unchanged',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const source=await page.getByLabel('Project JSON',{exact:true}).inputValue(),revision=JSON.parse(source).revision;
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.getByRole('button',{name:'Business overview',exact:true}).click();
 const catalogue=page.getByRole('region',{name:'Learning catalogue',exact:true});await expect(catalogue).toBeVisible();
 const storage=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()));
 const scripts=await page.evaluate(()=>{const w=window as unknown as {__addedScripts:number};w.__addedScripts=0;new MutationObserver(list=>{for(const m of list)for(const n of m.addedNodes)if(n instanceof Element&&(n.matches('script,iframe,object,embed')||n.querySelector('script,iframe,object,embed')))w.__addedScripts++;}).observe(document,{childList:true,subtree:true});return document.scripts.length;});
 const requests:string[]=[];page.on('request',request=>requests.push(request.url()));
 // Agent worktrees cites a CI expression `always()`; the dbt lesson walks through a SQL model. Both are text to read, never to run.
 for(const [title,snippet] of [['Agent worktrees, changes, review and CI','always()'],['SQL, dbt, Spark and orchestration have different roles','Identify the SQL logic.']] as const){
  await catalogue.getByRole('button',{name:'Reset lesson filters',exact:true}).click();
  await catalogue.getByRole('button',{name:'Open lesson '+title,exact:true}).click();
  const article=catalogue.getByRole('article',{name:'Lesson: '+title});
  await expect(article).toContainText(snippet);
  for(const depth of ['Mechanism','Detail','Overview'])await article.getByRole('radio',{name:depth,exact:true}).check();
  await article.getByRole('button',{name:'Reveal answer hints',exact:true}).click();
  await expect(article.locator('script,iframe,object,embed,pre[contenteditable],[contenteditable="true"]')).toHaveCount(0);
  await expect(article.getByRole('button',{name:/\b(run|execute|exec|eval|deploy|launch)\b/i})).toHaveCount(0);
 }
 expect(await page.evaluate(()=>(window as unknown as {__addedScripts:number}).__addedScripts)).toBe(0);
 expect(await page.evaluate(()=>document.scripts.length)).toBe(scripts);
 expect(requests).toEqual([]);
 expect(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()))).toBe(storage);
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const after=await page.getByLabel('Project JSON',{exact:true}).inputValue();
 expect(JSON.parse(after).revision).toBe(revision);expect(after).toBe(source);expect(errors).toEqual([]);
});

test('learning catalogue opens from the gallery without a project: no sample, saved workspace, AI or network',async({page,baseURL})=>{
 const errors:string[]=[],foreign:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{if(!request.url().startsWith(baseURL!)&&!request.url().startsWith('data:'))foreign.push(request.url());});
 // A fresh browser opening the catalogue entry never mounts the studio: no project and no IndexedDB workspace is created.
 await page.goto('/?catalogue');
 const catalogue=page.getByRole('region',{name:'Learning catalogue',exact:true});
 await expect(catalogue.getByRole('status',{name:'Learning catalogue results'})).toHaveText('Showing 24 of 24 catalogue entries.');
 await expect(page.getByRole('note').first()).toContainText('No project is open.');
 await expect(page.locator('.project-hero')).toHaveCount(0);await expect(page.getByRole('tablist',{name:'Workspace mode'})).toHaveCount(0);
 expect(await page.evaluate(async()=>(await indexedDB.databases()).length)).toBe(0);
 await catalogue.getByRole('button',{name:'Open lesson Fact grain, dimensions and joins',exact:true}).click();
 await expect(catalogue.getByRole('region',{name:'In my project'})).toContainText('No reviewed mapping. No project is open.');
 // The gallery entry leads to the same project-less page.
 await page.goto('/');const sample=(await page.locator('.project-hero h1').textContent())!;expect(sample.length).toBeGreaterThan(0);
 await page.getByRole('link',{name:'Learning catalogue',exact:true}).click();
 await expect(page).toHaveURL(/\?catalogue$/);
 await expect(page.getByRole('region',{name:'Learning catalogue',exact:true})).toBeVisible();
 await expect(page.getByText(sample,{exact:true})).toHaveCount(0);await expect(page.locator('.project-hero')).toHaveCount(0);
 await page.getByRole('link',{name:'Back to the studio',exact:true}).click();await expect(page.locator('.project-hero h1')).toBeVisible();
 expect(foreign).toEqual([]);expect(errors).toEqual([]);
});
