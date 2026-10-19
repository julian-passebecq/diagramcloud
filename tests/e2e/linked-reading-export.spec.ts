import {test,expect} from '@playwright/test';
import {buildTechnicalCatalogue} from '../../examples/client-atlas/build';
import {linkedReadingHtml} from '../../src/export/linkedReadingHtml';
const example=buildTechnicalCatalogue();
const html=linkedReadingHtml(example.project,example.reading,{now:new Date('2026-10-19T09:40:00Z')});
for(const width of [1440,390])test.describe(`${width}px linked reading`,()=>{
 test.use({viewport:{width,height:844},reducedMotion:'reduce'});
 test('shared identities, pin, separate cameras and source-backed details',async({page})=>{
  const errors:string[]=[],requests:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url()!=='about:blank'&&!r.url().startsWith('data:'))requests.push(r.url())});
  await page.setContent(html);await expect(page.locator('.figure svg')).toHaveCount(2);await expect(page.locator('#left-figure [data-plane]')).toHaveCount(3);
  await expect(page.locator('#left-figure [data-node-id="hnsw.b"]')).toHaveCount(3);
  await expect(page.locator('#left-figure [data-node-id="hnsw.query"]')).toHaveCount(0);
  await page.locator('#left-figure [data-node-id="hnsw.b"]').first().click();await expect(page.locator('#right-status')).toHaveText('Selected: Vector B');
  await page.locator('#pin').click();await page.locator('#left-figure [data-node-id="hnsw.c"]').first().click();await expect(page.locator('#right-status')).toHaveText('Pinned. Selected: Vector B');
  await page.locator('#pin').click();await expect(page.locator('#right-status')).toHaveText('Selected: Vector C');
  const right=await page.locator('#right-figure svg').getAttribute('viewBox');await page.locator('[data-zoom="left:in"]').click();expect(await page.locator('#right-figure svg').getAttribute('viewBox')).toBe(right);
  const left=await page.locator('#left-figure svg').getAttribute('viewBox');await page.locator('#theme').selectOption('light');expect(await page.locator('#left-figure svg').getAttribute('viewBox')).toBe(left);
  await page.locator('[data-dock="sources"]').click();await expect(page.locator('#dock-content')).toContainText('HNSW documentation');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);expect(requests).toEqual([]);
 });
 test('topic navigation, focus, controls and all native theme variants',async({page})=>{
  await page.setContent(html);await page.locator('#chapters button').nth(1).click();await expect(page.locator('#chapters button.current')).toBeFocused();
  await page.locator('#context').getByRole('button',{name:'Parent',exact:true}).click();await expect(page.locator('#left-title')).toHaveText('HNSW: Level 2 to Level 0');
  await page.locator('#companion-toggle').click();await expect(page.locator('#right-pane')).toBeHidden();await page.locator('#companion-toggle').click();
  await page.locator('#filter').fill('Milvus');await expect(page.locator('#chapters button')).toHaveCount(1);await page.locator('#chapters button').click();await page.locator('#filter').fill('');
  for(let i=0;i<example.reading.chapters.length;i++){await page.locator('#chapters button').nth(i).click();for(const theme of ['light','dark','editorial']){await page.locator('#theme').selectOption(theme);expect(await page.evaluate(()=>{const ids=[...document.querySelectorAll('.figure svg [id]')].map(e=>e.id);return new Set(ids).size===ids.length})).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)}}
 });
});
