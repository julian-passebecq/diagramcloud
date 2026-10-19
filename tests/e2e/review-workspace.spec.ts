import {test,expect} from '@playwright/test';
import {buildReviewWorkspace} from '../../examples/review-workspace/build';
import {linkedReadingHtml} from '../../src/export/linkedReadingHtml';
import {meetingSummaryHtml} from '../../src/export/meetingSummary';
const f=buildReviewWorkspace();
for(const width of [1440,390])test.describe(`review reading at ${width}`,()=>{
 test.use({viewport:{width,height:900},reducedMotion:'reduce'});
 test('join evidence follows selection, and one detail dock moves without losing context',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
  await page.setContent(linkedReadingHtml(f.project,f.reading,{now:new Date('2026-10-19T00:00:00Z')}));
  await page.locator('#left-nodes').locator('..').evaluate(e=>(e as HTMLDetailsElement).open=true);
  await page.locator('#left-nodes [data-select-id="join"]').click();
  await expect(page.locator('#dock-content')).toContainText('70 instead of 42');
  await expect(page.locator('#right-status')).toContainText('Selected: Inspect the join');
  await page.locator('#detail-placement').selectOption('right');
  await expect(page.locator('#right-pane > .dock')).toHaveCount(1);await expect(page.locator('.dock')).toHaveCount(1);
  await page.locator('#companion-toggle').click();await expect(page.locator('#dock-home > .dock')).toHaveCount(1);
  await page.locator('#companion-toggle').click();await expect(page.locator('#right-pane > .dock')).toHaveCount(1);
  for(const theme of ['dark','editorial','light']){await page.locator('#theme').selectOption(theme);await expect(page.locator('#dock-content')).toContainText('70 instead of 42');}
  await page.locator('#chapters button').nth(1).click();await expect(page.locator('#business-anchor')).toContainText('Preserve the business meaning');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
 });
 test('summary has a resolved glossary and print-safe native SVG',async({page})=>{
  await page.route('**/*',r=>r.abort());await page.setContent(meetingSummaryHtml(f.project,f.brief));
  await expect(page.locator('script')).toHaveCount(0);
  expect(await page.evaluate(()=>[...document.links].filter(a=>a.getAttribute('href')?.startsWith('#')).every(a=>document.getElementById(a.hash.slice(1))))).toBe(true);
  await page.emulateMedia({media:'print'});expect(await page.locator('.figure').evaluateAll(es=>es.every(e=>getComputedStyle(e).overflow!=='hidden'))).toBe(true);
 });
});
