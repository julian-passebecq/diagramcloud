
import {test,expect} from '@playwright/test';
import {buildFullStackPractice} from '../../examples/interview-client/build';
for(const width of [1440,390])test.describe(`reading wayfinder ${width}`,()=>{
 test.use({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
 test('two-level and route-list navigation preserve hierarchy, source and browser history',async({page})=>{
  await page.goto('/?workspace=v3');
  await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
  await page.getByLabel('Project JSON',{exact:true}).fill(JSON.stringify(buildFullStackPractice().project));
  await page.getByRole('button',{name:'Validate JSON',exact:true}).click();
  await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
  await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
  await page.locator('.dc-wayfinder>summary').filter({hasText:'Where am I?'}).click();
  const children=page.getByRole('navigation',{name:'Inside current level',exact:true});
  await children.getByRole('button',{name:'Full-stack responsibilities',exact:true}).click();
  await children.getByRole('button',{name:'One request and its trust boundaries',exact:true}).click();
  await expect(page.getByRole('navigation',{name:'Current reading route'})).toContainText('Full-stack responsibilities');
  await page.goBack();
  await expect(children).toContainText('One request and its trust boundaries');
  await page.getByLabel('Navigation presentation').selectOption('tree');
  await expect(page.getByRole('navigation',{name:'Explicit view hierarchy'}).getByRole('button',{name:'Data grain and provenance',exact:true})).toHaveCount(2);
  await expect(page.locator('.dc-wayfinder').first()).toContainText('not delivery stages');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
});
