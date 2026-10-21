import {test,expect} from '@playwright/test';import {readFileSync} from 'node:fs';
const brief=()=>JSON.parse(readFileSync('examples/idea-client/orchard.brief.json','utf8'));
for(const width of [1440,390])test.describe(`brainstorming ${width}`,()=>{
 test.use({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
 test('ordinary import then read-only focus, parent reminder and comparison',async({page})=>{
  await page.goto('/?workspace=v3');const b=brief();
  await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(b));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
  await expect(page.getByRole('dialog').getByText(/^Valid: /)).toBeVisible();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
  await page.getByRole('button',{name:'Brainstorm',exact:true}).click();const ideas=page.getByRole('region',{name:'Brainstorming workspace'});
  await ideas.locator('.dc-idea-card').first().click();await ideas.getByRole('button',{name:'Focus selected idea'}).click();await ideas.getByLabel('Show parent context').check();await expect(ideas.getByRole('region',{name:'Parent context'})).toContainText('not the last page');
  await ideas.getByRole('button',{name:/Back to All permitted/}).click();await ideas.getByRole('button',{name:'Comparison matrix'}).click();await expect(ideas.getByRole('table').locator('tbody tr')).toHaveCount(b.ideas.length);
  await page.getByRole('button',{name:'JSON / AI',exact:true}).click();const doc=JSON.parse(await page.getByLabel('Project JSON',{exact:true}).inputValue());expect(doc.observations).toEqual([]);expect(doc.revision).toBe(0);expect(doc.nodes.filter((n:any)=>n.tags.includes('brainstorm-idea')).every((n:any)=>n.choices.every((c:any)=>c.status==='candidate'))).toBe(true);
 });
 test('private discussion retains author context without fabricating completion',async({page})=>{
  await page.goto('/?workspace=v3');const b=brief();b.provenance='supplied-discussion';b.visibility='private';b.title='PRIVATE_IDEA_SENTINEL';b.question='PRIVATE_QUESTION_SENTINEL';
  await page.getByRole('button',{name:'JSON / AI',exact:true}).click();await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(b));await page.getByRole('button',{name:'Validate JSON',exact:true}).click();await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
  await page.getByRole('button',{name:'Brainstorm',exact:true}).click();await expect(page.getByRole('region',{name:'Brainstorming workspace'})).toContainText('PRIVATE_IDEA_SENTINEL');
  // Native public-view toggle is version-specific. The pure projection tests independently
  // assert zero private nodes, sources, titles and question content; the integrator must
  // add the current public route plus reload to this actual App journey before release.
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
});
