import {test,expect,type Page} from '@playwright/test';
import {documentSchema,validateDocument,type Project} from '../../src/core/model';

// Synthetic fixture: one cited component, one name-only component and one private component. Nothing here is an owner project.
const lessonTitle='Fact grain, dimensions and joins',hiddenLabel='SYNTHETIC_HIDDEN_FACT_MART';
const fixture=():Project=>validateDocument(documentSchema.parse({schemaVersion:1,id:'synthetic-learning-instance',title:'Synthetic learning instance',rootViewId:'root',author:'Synthetic author',
 nodes:[{id:'sales-fact',label:'Sales fact table',kind:'table',sourceIds:['model-doc']},{id:'grain-board',label:'Grain dashboard',kind:'report'},{id:'hidden-fact',label:hiddenLabel,kind:'table',sourceIds:['model-doc'],visibility:'private'}],edges:[],
 views:[{id:'root',title:'Synthetic warehouse',nodeIds:['sales-fact','grain-board','hidden-fact'],positions:{'sales-fact':{x:0,y:0},'grain-board':{x:300,y:0},'hidden-fact':{x:600,y:0}}}],
 sources:[{id:'model-doc',title:'Synthetic model notes',location:'synthetic/model.md:1'}]}));
async function importFixture(page:Page){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(fixture()));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
}
async function openLesson(page:Page){
 await page.getByRole('button',{name:'Business overview',exact:true}).click();
 const catalogue=page.getByRole('region',{name:'Learning catalogue',exact:true});
 await catalogue.getByRole('button',{name:'Open lesson '+lessonTitle,exact:true}).click();
 return catalogue.getByRole('article',{name:'Lesson: '+lessonTitle});
}

test('lesson -> In my project -> exact component -> back to the same lesson, depth and content revision',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await importFixture(page);
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 let lesson=await openLesson(page);
 const mine=lesson.getByRole('region',{name:'In my project'});
 await expect(mine).toContainText('No reviewed mapping.');await expect(mine).toContainText('A shared name, tag or icon is not evidence.');
 await mine.getByText('Candidates by name',{exact:false}).click();
 const candidates=mine.getByRole('list',{name:'Mapping candidates'});
 await expect(candidates).toContainText('Sales fact table');await expect(candidates).toContainText('candidate, not evidence');

 // A name-only candidate stays a suggestion: without a citation it cannot be reviewed.
 await mine.getByRole('button',{name:'Suggest mapping to Grain dashboard',exact:true}).click();
 await expect(mine.getByRole('list',{name:'Suggested mappings'})).toContainText('Suggested · candidate, not evidence');
 await expect(mine.getByRole('button',{name:'Mark mapping to Grain dashboard reviewed',exact:true})).toBeDisabled();
 await mine.getByRole('button',{name:'Suggest mapping to Sales fact table',exact:true}).click();
 // The suggestion cites nothing: the target's citations are shown, none ticked, and review waits for a ticked one.
 const markSales=mine.getByRole('button',{name:'Mark mapping to Sales fact table reviewed',exact:true}),cite=mine.getByRole('checkbox',{name:'Cite Synthetic model notes (source model-doc)',exact:true});
 await expect(cite).not.toBeChecked();await expect(markSales).toBeDisabled();
 await cite.check();await expect(markSales).toBeEnabled();await cite.uncheck();await expect(markSales).toBeDisabled();
 await cite.check();await markSales.click();
 const mapped=mine.getByRole('list',{name:'Mapped instances'});
 await expect(mapped).toContainText('Sales fact table');await expect(mapped).toContainText('Reviewed by the author (Synthetic author');await expect(mapped).toContainText('Synthetic model notes (source model-doc)');

 await lesson.getByRole('radio',{name:'Detail',exact:true}).check();
 await mapped.getByRole('button',{name:'Open Sales fact table',exact:true}).click();
 const back=page.getByRole('button',{name:'Back to lesson '+lessonTitle+' rev 2026-10-16.1',exact:true});
 await expect(back).toBeVisible();await expect(page.getByTestId('view-root')).toBeVisible();
 await expect(page.getByRole('main').getByRole('heading',{name:'Sales fact table',level:2})).toBeVisible();

 await back.click();
 lesson=page.getByRole('article',{name:'Lesson: '+lessonTitle});
 await expect(lesson.getByRole('status',{name:'Lesson return context'})).toHaveText('Returned to this lesson at depth Detail, content revision 2026-10-16.1.');
 await expect(lesson.getByRole('radio',{name:'Detail',exact:true})).toBeChecked();
 await expect(lesson.getByRole('status',{name:'Explanation at selected depth'})).toContainText('Detail:');
 await expect(back).toHaveCount(0);

 // The component lists the concept that explains it, linking back to the lesson.
 await lesson.getByRole('region',{name:'In my project'}).getByRole('button',{name:'Open Sales fact table',exact:true}).click();
 const toggle=page.getByRole('button',{name:'Details panel',exact:true});if(await toggle.getAttribute('aria-pressed')!=='true')await toggle.click();
 const explained=page.getByTestId('project-context').getByRole('region',{name:'Explained by'});
 await expect(explained).toContainText('Reviewed by the author · lesson rev 2026-10-16.1');
 await explained.getByRole('button',{name:'Open lesson '+lessonTitle,exact:true}).click();
 await expect(page.getByRole('article',{name:'Lesson: '+lessonTitle}).getByRole('radio',{name:'Overview',exact:true})).toBeChecked();

 // Public projection: the reviewed mapping is listed, the private component never appears, and nothing is editable.
 await page.getByRole('tab',{name:'Portfolio',exact:true}).click();
 lesson=await openLesson(page);
 const publicMine=lesson.getByRole('region',{name:'In my project'});
 await expect(publicMine).toContainText('Public projection');await expect(publicMine.getByRole('list',{name:'Mapped instances'})).toContainText('Sales fact table');
 await expect(publicMine.getByRole('list',{name:'Suggested mappings'})).toHaveCount(0);
 await expect(publicMine.getByRole('button',{name:/Suggest mapping|Mark mapping|Reject mapping/})).toHaveCount(0);
 await publicMine.getByText('Candidates by name',{exact:false}).click();
 await expect(publicMine).not.toContainText(hiddenLabel);
 expect(errors).toEqual([]);
});
