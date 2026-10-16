import {test,expect,type Page} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';

// Three built-in adoption journeys. No owner project, Git folder, cloud or AI service is used; nothing executes.
const workflowLesson='Deterministic workflow versus model-directed agent',revision='2026-10-16.1',privateMarker='PRIVATE_JOURNEY_CHOICE';
async function openJourney(page:Page,title:string){
 const filter=page.getByRole('button',{name:/^Adoption journeys/});
 if(!await filter.isVisible())await page.getByRole('button',{name:'Project gallery',exact:true}).click();
 await filter.click();
 await expect(page.locator('.project-card')).toHaveCount(3);
 await page.locator('.project-card').filter({hasText:title}).click();
 await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
}
async function gaps(page:Page){
 const toggle=page.getByRole('button',{name:'Details panel',exact:true});if(await toggle.getAttribute('aria-pressed')!=='true')await toggle.click();
 const context=page.getByTestId('project-context');await context.getByRole('tab',{name:'Gaps',exact:true}).click();
 return context.getByRole('region',{name:'What is missing to explain this?'});
}

test('adoption journeys: catalogue lesson and example, self-description mapping round trip, Galaxy and FOIL samples, drawer edit to public export',async({page},info)=>{
 test.setTimeout(120000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');

 // 1. Learning without a project: catalogue -> SCD lesson -> synthetic example.
 await page.getByRole('button',{name:'Business overview',exact:true}).click();
 let catalogue=page.getByRole('region',{name:'Learning catalogue',exact:true});
 await catalogue.getByRole('button',{name:'Open lesson Slowly changing dimensions and temporal joins',exact:true}).click();
 const scd=catalogue.getByRole('article',{name:'Lesson: Slowly changing dimensions and temporal joins'});
 await expect(scd.getByRole('list',{name:'Temporal join result'})).toContainText('2026-08-15 → South');
 const example=page.waitForEvent('download');await scd.getByRole('button',{name:'Download synthetic example JSON',exact:true}).click();
 expect((await example).suggestedFilename()).toBe('lesson-example-warehouse.json');

 // 2. DiagramCloud describes itself: the lesson lists a source-declared instance; open it, then return to the same lesson.
 await openJourney(page,'DiagramCloud describes itself');
 await page.getByRole('button',{name:'Business overview',exact:true}).click();
 catalogue=page.getByRole('region',{name:'Learning catalogue',exact:true});
 await catalogue.getByRole('button',{name:'Open lesson '+workflowLesson,exact:true}).click();
 let lesson=catalogue.getByRole('article',{name:'Lesson: '+workflowLesson});
 const mapped=lesson.getByRole('region',{name:'In my project'}).getByRole('list',{name:'Mapped instances'});
 await expect(mapped).toContainText('Revision guard');await expect(mapped).toContainText('Source-declared');await expect(mapped).toContainText('JSON Patch revision guard');
 await lesson.getByRole('radio',{name:'Mechanism',exact:true}).check();
 await mapped.getByRole('button',{name:'Open Revision guard',exact:true}).click();
 const back=page.getByRole('button',{name:`Back to lesson ${workflowLesson} rev ${revision}`,exact:true});
 await expect(back).toBeVisible();await expect(page.getByRole('main').getByRole('heading',{name:'Revision guard',level:2})).toBeVisible();
 await back.click();
 lesson=page.getByRole('article',{name:'Lesson: '+workflowLesson});
 await expect(lesson.getByRole('radio',{name:'Mechanism',exact:true})).toBeChecked();
 await expect(lesson.getByRole('status',{name:'Lesson return context'})).toContainText(`content revision ${revision}`);

 // 3. Galaxy process: nothing supplies timing, quantities or a mapping, so each is named as missing.
 await openJourney(page,'Galaxy agent process');
 await expect(page.getByRole('button',{name:'Explore Attempt (synthetic)',exact:true})).toBeVisible();
 let missing=await gaps(page);
 await expect(missing.locator('[data-gap="timing"]')).toHaveAttribute('data-state','missing');
 await expect(missing.locator('[data-gap="quantities"]')).toContainText('withheld: Sankey flow figure');
 await expect(missing.locator('[data-gap="mappings"]')).toHaveAttribute('data-state','missing');

 // 4. FOIL slice: macro by default, environments distinct from refinement.
 await openJourney(page,'FOIL local and environments');
 for(const label of ['Forecast capability','Data refinement','Environments','Report'])await expect(page.getByRole('button',{name:'Explore '+label,exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Explore Bronze',exact:true})).toHaveCount(0);
 missing=await gaps(page);await expect(missing.locator('[data-gap="timing"]')).toContainText('withheld: Scheduled timeline (Gantt)');

 // 5. Edit through the JSON drawer, apply, save, reload, export public HTML: the private choice never leaves.
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.getByRole('button',{name:'Explore Report',exact:true}).click();
 await page.getByRole('button',{name:'JSON drawer',exact:true}).click();
 const drawer=page.getByRole('complementary',{name:'JSON drawer'}),text=drawer.getByLabel('JSON draft');
 await drawer.getByLabel('Draft scope').selectOption('node');await expect(text).toHaveValue(/"id": "serving"/);
 const node=JSON.parse(await text.inputValue());
 await text.fill(JSON.stringify({...node,label:'Forecast report',choices:[{id:'report-tool',title:privateMarker,goal:'Pick a report tool',options:[{id:'a',label:'Option A'}],status:'candidate',origin:'author',visibility:'private'}]},null,2));
 await drawer.getByRole('button',{name:'Apply draft',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explore Forecast report',exact:true})).toBeVisible();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.reload();
 await openJourney(page,'FOIL local and environments');
 await expect(page.getByRole('button',{name:'Explore Forecast report',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Export & share',exact:true}).click();
 const exported=page.waitForEvent('download');await page.getByRole('button',{name:/^Interactive HTML/}).click();
 mkdirSync(info.outputPath(),{recursive:true});const file=info.outputPath('foil-journey.html');await(await exported).saveAs(file);
 const html=readFileSync(file,'utf8');
 expect(html).toContain('Forecast report');expect(html).not.toContain(privateMarker);expect(html).not.toContain('Pick a report tool');
 expect(errors).toEqual([]);
});
