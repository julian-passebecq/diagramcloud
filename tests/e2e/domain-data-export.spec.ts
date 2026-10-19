import {test,expect} from '@playwright/test';
import {buildDomainDataReference} from '../../examples/domain-data/build';
import {linkedReadingHtml} from '../../src/export/linkedReadingHtml';
const example=buildDomainDataReference();const html=linkedReadingHtml(example.project,example.reading,{now:new Date('2026-10-19T12:00:00Z')});
for(const width of [1440,390])test.describe(`${width}px world/data reading`,()=>{
 test.use({viewport:{width,height:844},reducedMotion:'reduce'});
 test('related is not identical; many targets, pin, business context and gaps',async({page})=>{
  const errors:string[]=[],requests:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));await page.route('**/*',r=>r.abort());
  await page.setContent(html);await page.locator('#left-nodes').locator('..').evaluate(e=>(e as HTMLDetailsElement).open=true);
  await page.locator('#left-nodes [data-select-id="wind.sensor"]').click();await expect(page.locator('#right-status [data-mapping-target]')).toHaveCount(2);
  await expect(page.locator('#right-status')).toContainText('Related, not the same object');
  await page.locator('[data-mapping-target="data.sample"]').click();await expect(page.locator('#right-nodes [data-select-id="data.sample"]')).toBeFocused();
  await page.locator('#pin').click();await page.locator('#left-nodes [data-select-id="wind.machine"]').click();await expect(page.locator('#right-status')).toContainText('Measurement sample');await expect(page.locator('#dock-content')).toContainText('pinned or unlinked');
  await page.locator('#pin').click();await expect(page.locator('#right-status')).toContainText('Asset configuration');
  const right=await page.locator('#right-figure svg').getAttribute('viewBox');await page.locator('[data-zoom="left:in"]').click();expect(await page.locator('#right-figure svg').getAttribute('viewBox')).toBe(right);
  await page.locator('#chapters button').nth(2).click();await expect(page.locator('#business-anchor')).toContainText('Renewable-energy client');
  await page.locator('#chapters button').first().click();await page.locator('#left-nodes').locator('..').evaluate(e=>(e as HTMLDetailsElement).open=true);await page.locator('#left-nodes [data-select-id="wind.foil"]').click();await expect(page.locator('#right-status')).toContainText('No selected counterpart');await expect(page.locator('#dock-content')).toContainText('unresolved');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);expect(requests).toEqual([]);
 });
});
