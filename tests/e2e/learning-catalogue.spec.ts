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
