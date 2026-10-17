import {test,expect,type Locator,type Page} from '@playwright/test';
import {documentSchema,validateDocument,type Project} from '../../src/core/model';
import {reviewChoice} from '../../src/core/decisionReview';

// Synthetic browser fixture: authored components, one cited source and one non-synthetic note. No run, no observation.
function fixture():Project{
 const d=validateDocument(documentSchema.parse({schemaVersion:1,id:'evidence-authoring-fixture',title:'Evidence authoring fixture',rootViewId:'root',
  nodes:[{id:'api',label:'Checkout API',kind:'app',blockIds:['api-note','sketch'],choices:[{id:'store',title:'Order store',goal:'Keep orders queryable',options:[{id:'sql',label:'SQL database'},{id:'docs',label:'Document store'}],recommendedOptionId:'sql',status:'candidate',origin:'ai',suggestedBy:'claude',sourceIds:['apm']}]},
   {id:'db',label:'Orders DB',kind:'storage'}],
  edges:[{id:'q',source:'api',target:'db',kind:'query'}],
  views:[{id:'root',title:'Checkout',nodeIds:['api','db'],edgeIds:['q'],positions:{api:{x:0,y:0},db:{x:320,y:0}}}],
  sources:[{id:'apm',title:'APM export',location:'Authored fixture, not a provider export'}],
  blocks:[{id:'api-note',title:'Load test note',type:'text',text:'Authored note for the fixture.',provenance:'author',sourceIds:['apm']},
   {id:'sketch',title:'Synthetic sketch',type:'text',text:'Illustration only.',provenance:'synthetic'}]}));
 return reviewChoice(d,'store',{reviewedBy:'Fixture author'});
}
async function open(page:Page){
 await page.goto('/');
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(fixture()));
 await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.getByTestId('view-root').getByRole('button',{name:'Explore Checkout API',exact:true}).click();
 await page.getByRole('button',{name:'Inspector',exact:true}).click();
}
async function saved(page:Page):Promise<Project>{
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const value=await page.getByLabel('Project JSON',{exact:true}).inputValue();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 return validateDocument(JSON.parse(value));
}
async function disclosure(owner:Locator,name:string){
 const summary=owner.locator('summary').filter({hasText:name}).first(),details=summary.locator('..');
 if(!await details.evaluate(element=>(element as HTMLDetailsElement).open))await summary.click();
 return details;
}

test('schedule form: inline errors refuse an end before its start without repair; apply and edit are one revision and one Undo',async({page})=>{
 await open(page);
 await page.getByLabel('Block type').selectOption('schedule');
 const form=page.getByRole('form',{name:'Schedule editor'}).first();
 await form.getByLabel('Schedule title').fill('Rollout');
 await form.getByLabel('Item 1 label').fill('Build');await form.getByLabel('Item 1 start').fill('2026-10-05');await form.getByLabel('Item 1 end',{exact:true}).fill('2026-10-03');
 await form.getByLabel('Item 1 concerns Checkout API').check();
 await expect(form.locator('[data-schedule-error="1"]')).toContainText('Ends (2026-10-03) before it starts (2026-10-05).');
 await form.getByRole('button',{name:'Attach schedule',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Item 1: Ends (2026-10-03) before it starts'})).toBeVisible();
 expect((await saved(page)).blocks.some(b=>b.type==='schedule'),'nothing is attached').toBe(false);
 await expect(form.getByLabel('Item 1 end',{exact:true}),'the typed end is kept, not repaired').toHaveValue('2026-10-03');
 await form.getByLabel('Item 1 end',{exact:true}).fill('2026-10-08');await expect(form.locator('[data-schedule-error]')).toHaveCount(0);
 await form.getByRole('button',{name:'Attach schedule',exact:true}).click();
 let doc=await saved(page);const added=doc.blocks.find(b=>b.type==='schedule');
 expect(added&&added.type==='schedule'&&added.items).toEqual([{id:'item-1',label:'Build',nodeIds:['api'],start:'2026-10-05',end:'2026-10-08',basis:'supplied'}]);
 const revision=doc.revision;
 // The attached schedule opens in the same form: a disagreeing duration is refused, then replaced by the duration alone.
 const editor=page.locator('.block-editor').filter({hasText:'Rollout'});await editor.locator('summary').first().click();
 await editor.getByLabel('Item 1 duration').fill('P2D');
 await expect(editor.locator('[data-schedule-error="1"]')).toContainText('End 2026-10-08 and duration P2D disagree');
 await editor.getByLabel('Item 1 end',{exact:true}).fill('');await editor.getByLabel('Item 1 basis').selectOption('estimate');
 await expect(editor.getByLabel('Item 1 ID'),'a stored item keeps its stable ID').toHaveAttribute('readonly','');
 await editor.getByRole('button',{name:'Apply schedule',exact:true}).click();
 doc=await saved(page);const edited=doc.blocks.find(b=>b.id===added!.id)!;
 expect(edited.type==='schedule'&&edited.items[0]).toEqual({id:'item-1',label:'Build',nodeIds:['api'],start:'2026-10-05',duration:'P2D',basis:'estimate'});expect(doc.revision).toBe(revision+1);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 doc=await saved(page);const undone=doc.blocks.find(b=>b.id===added!.id)!;expect(undone.type==='schedule'&&undone.items[0].end).toBe('2026-10-08');
});

test('metrics form: a baseline and a current reading are typed beside their KPI cards; a non-number or a measured synthetic reading is refused inline',async({page})=>{
 await open(page);
 await page.getByLabel('Block type').selectOption('metrics');
 const form=page.locator('.metrics-editor').first();
 await form.getByLabel('Metrics title').fill('Latency');await form.getByLabel('Metrics provenance').selectOption('source-derived');await form.getByRole('checkbox',{name:'APM export'}).check();
 const reading=async(n:number,role:'baseline'|'current',value:string,from:string,to:string)=>{
  await form.getByLabel(`Metric ${n} value`,{exact:true}).fill(value);await form.getByLabel(`Metric ${n} label`,{exact:true}).fill(`${role} p95`);
  await form.getByRole('button',{name:`Add a structured reading to metric ${n}`,exact:true}).click();
  await form.getByLabel(`Metric ${n} reading role`).selectOption(role);await form.getByLabel(`Metric ${n} reading metric`).fill('p95 latency');
  await form.getByLabel(`Metric ${n} reading scope`).fill('checkout API');await form.getByLabel(`Metric ${n} reading unit`).fill('ms');
  await form.getByLabel(`Metric ${n} reading window from`).fill(from);await form.getByLabel(`Metric ${n} reading window to`).fill(to);
  await form.getByLabel(`Metric ${n} reading value`).fill(value);};
 await reading(1,'baseline','420 ms','2026-09-01','2026-09-07');
 await expect(form.locator('[data-reading-error="1"]')).toContainText('Value: type a number');
 await form.getByLabel('Metric 1 reading value').fill('420');await expect(form.locator('[data-reading-error]')).toHaveCount(0);
 await form.getByRole('button',{name:'+ Add metric',exact:true}).click();await reading(2,'current','380','2026-10-01','2026-10-07');
 await form.getByLabel('Metrics provenance').selectOption('synthetic');
 await expect(form.locator('[data-reading-error="1"]')).toContainText('A synthetic block cannot carry a measured value');
 await form.getByRole('button',{name:'Attach metrics',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Metric 1 reading: A synthetic block cannot carry a measured value'})).toBeVisible();
 expect((await saved(page)).blocks.some(b=>b.title==='Latency'),'nothing is attached').toBe(false);
 await form.getByLabel('Metrics provenance').selectOption('source-derived');
 await form.getByRole('button',{name:'Attach metrics',exact:true}).click();
 const block=(await saved(page)).blocks.find(b=>b.title==='Latency')!;
 expect(block.type==='metrics'&&block.items.map(i=>[i.measure?.role,i.measure?.value,i.measure?.basis,i.measure?.window.from])).toEqual([['baseline',420,'measured','2026-09-01'],['current',380,'measured','2026-10-01']]);
});

test('compatibility evidence: recorded under a named author with a citation, read by the substitution check, and the review becomes needed',async({page},info)=>{
 await open(page);
 const card=page.getByRole('region',{name:'Choice Order store',exact:true}).first();
 const state=card.getByRole('status',{name:'Review state of Order store',exact:true});await expect(state).toContainText('Reviewed against the current facts');
 const alternatives=card.getByRole('region',{name:'Alternatives to SQL database',exact:true});
 await expect(alternatives).toContainText('UNKNOWN · compatibility not established');
 const check=await disclosure(alternatives,'Substitution check');
 const form=check.getByRole('group',{name:'Record compatibility of Document store',exact:true});
 await expect(form.getByLabel('Cite block Synthetic sketch for compatibility of Document store'),'a synthetic block cannot be cited').toBeDisabled();
 await form.getByLabel('Recorder of compatibility of Document store').fill('Julian');await form.getByLabel('Record date of compatibility of Document store').fill('2026-10-17');
 await form.getByRole('button',{name:'Record evidence',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Cite at least one project source'})).toBeVisible();
 await form.getByLabel('Cite source APM export for compatibility of Document store').check();
 await form.getByRole('button',{name:'Record evidence',exact:true}).click();
 await expect(check.locator('[data-requirement="role:api"]')).toHaveAttribute('data-requirement-state','satisfied');
 await expect(check.locator('[data-requirement="role:api"]')).toContainText('recorded by Julian on 2026-10-17');
 await expect(state).toContainText('Review needed · supporting facts changed');
 await expect(alternatives).toContainText('UNKNOWN · compatibility not established');
 await form.getByLabel('Requirement for compatibility of Document store').selectOption('out:q');
 await form.getByLabel('Cite block Load test note for compatibility of Document store').check();
 await form.getByRole('button',{name:'Record evidence',exact:true}).click();
 await expect(alternatives.locator('[data-substitution]')).toHaveText('Compatible per cited evidence · not a verification');
 await card.screenshot({path:info.outputPath('compatibility-recorded.png')});
 const option=(await saved(page)).nodes.find(n=>n.id==='api')!.choices![0].options.find(o=>o.id==='docs')!;
 expect(option.compatibility!.map(e=>[e.requirementId,e.verdict,e.recordedBy,e.sourceIds,e.blockIds])).toEqual([['role:api','satisfied','Julian',['apm'],[]],['out:q','satisfied','Julian',['apm'],['api-note']]]);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(alternatives.locator('[data-substitution]')).toHaveText('UNKNOWN · compatibility not established');
});
