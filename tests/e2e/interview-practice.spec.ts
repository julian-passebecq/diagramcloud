
import {test,expect} from '@playwright/test';
for(const width of [1440,390])test.describe(`catalogue interview ${width}`,()=>{
 test.use({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
 test('projectless practice preserves four-question purpose and self-review is not a score',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?catalogue');
  await page.getByText('Interview practice · four-question rounds and fictional company cases',{exact:true}).click();
  const practice=page.getByRole('region',{name:'Interview practice',exact:true});
  await expect(practice.getByRole('navigation',{name:'Four-question round'}).getByRole('button')).toHaveCount(4);
  await expect(practice.getByRole('region',{name:'Reference explanation'})).toHaveCount(0);
  await practice.getByLabel('Your practice answer').fill('Describe row grain and preserve the population.');
  await practice.getByRole('button',{name:'Reveal reference',exact:true}).click();
  await practice.getByLabel('Practice self review').selectOption('explained');
  await expect(practice.getByLabel('Practice coverage')).toContainText('1 self-reviewed');
  await practice.getByLabel('Your practice answer').fill('A revised explanation');
  await expect(practice.getByLabel('Practice self review')).toHaveValue('unrated');
  await expect(practice).toContainText('Fictional case.');
  expect(await practice.locator('.dc-practice-topics button').evaluateAll(bs=>bs.every(b=>b.scrollHeight<=b.clientHeight+1))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
 });
 test('search, keyboard and explicit clear do not execute snippets or persist answers',async({page})=>{
  await page.goto('/?catalogue');
  const before=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()));
  await page.getByText('Interview practice · four-question rounds and fictional company cases',{exact:true}).click();
  const practice=page.getByRole('region',{name:'Interview practice',exact:true});
  await practice.getByLabel('Find practice topic').fill('Spark driver');
  await practice.getByRole('button',{name:'Spark architecture and execution'}).click();
  await expect(practice.locator('article h4')).toBeFocused();
  await practice.getByLabel('Your practice answer').fill('LOCAL_PRACTICE_NOTE');
  await practice.getByRole('button',{name:'Clear local practice',exact:true}).click();
  await practice.getByRole('button',{name:'Keep answers',exact:true}).click();
  await expect(practice.getByLabel('Your practice answer')).toHaveValue('LOCAL_PRACTICE_NOTE');
  expect(await practice.locator('iframe,object,embed,script').count()).toBe(0);
  expect(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()))).toBe(before);
  await page.reload();
  await page.getByText('Interview practice · four-question rounds and fictional company cases',{exact:true}).click();
  await expect(page.getByLabel('Your practice answer')).toHaveValue('');
 });
});

for(const width of [1440,390])test.describe(`practice confirmation focus ${width}`,()=>{
 test.use({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
 test('clear confirmation, cancellation and confirmation keep a usable keyboard location',async({page})=>{
  await page.goto('/?catalogue');await page.getByText('Interview practice \u00b7 four-question rounds and fictional company cases',{exact:true}).click();
  const practice=page.getByRole('region',{name:'Interview practice',exact:true}),clear=practice.getByRole('button',{name:'Clear local practice',exact:true});
  await practice.getByLabel('Your practice answer',{exact:true}).fill('Kept until explicit clear');await clear.focus();await page.keyboard.press('Enter');
  await expect(practice.getByRole('button',{name:'Confirm clear',exact:true})).toBeFocused();
  await practice.getByRole('button',{name:'Keep answers',exact:true}).focus();await page.keyboard.press('Enter');await expect(clear).toBeFocused();await expect(practice.getByLabel('Your practice answer',{exact:true})).toHaveValue('Kept until explicit clear');
  await page.keyboard.press('Enter');await page.keyboard.press('Enter');await expect(clear).toBeFocused();await expect(practice.getByLabel('Your practice answer',{exact:true})).toHaveValue('');
 });
});
