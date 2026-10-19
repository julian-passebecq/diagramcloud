import {test,expect,type Page} from '@playwright/test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildReviewWorkspace} from '../../examples/review-workspace/build';
import {meetingSummaryFile} from '../../src/export/meetingSummary';

// Playwright compiles JSX for component testing, so the form's static markup is rendered by tsx in a child process.
function dialogMarkup(){
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const code="import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {MeetingSummaryDialog} from './src/ui/MeetingSummaryDialog';import {buildReviewWorkspace} from './examples/review-workspace/build';process.stdout.write(renderToStaticMarkup(createElement(MeetingSummaryDialog,{project:buildReviewWorkspace().project,activeViewId:'overview',onDone(){},onCancel(){}})));";
 const out=spawnSync(process.execPath,[root+'node_modules/tsx/dist/cli.mjs','-e',code],{cwd:root,encoding:'utf8',timeout:30000});
 if(out.status!==0)throw new Error(out.stderr);return out.stdout;
}

// Offline: the meeting summary file is loaded with page.setContent and every request is aborted and recorded.
const f=buildReviewWorkspace();
const file=meetingSummaryFile(f.project,{...f.brief,viewIds:['overview','join-detail','contract'],detail:'standard'},new Date('2026-10-19T00:00:00Z'));
async function offline(page:Page){
 const errors:string[]=[],requests:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('data:'))requests.push(r.url());});
 await page.route('**/*',r=>r.abort());
 return {errors,requests};
}
for(const width of [1440,390])test.describe(`meeting summary at ${width}`,()=>{
 test.use({viewport:{width,height:900},reducedMotion:'reduce'});
 test('glossary links move focus, print shows no clipped figure, no request, no page error',async({page})=>{
  const {errors,requests}=await offline(page);
  await page.setContent(file.html);
  await expect(page.locator('script')).toHaveCount(0);
  const glossary=page.getByRole('navigation',{name:'Summary glossary'});
  const links=glossary.getByRole('link');const count=await links.count();expect(count).toBe(4);
  for(let i=0;i<count;i++){
   const link=links.nth(i),hash=(await link.getAttribute('href'))!;
   await link.focus();await page.keyboard.press('Enter');
   // Activating a glossary entry moves keyboard focus to its section, not only the scroll position.
   await expect.poll(()=>page.evaluate(()=>document.activeElement?.id??'')).toBe(hash.slice(1));
  }
  // Component links reach their evidence block the same way.
  const evidence=page.locator('a[href="#block-order-join.rules"]').first();await evidence.focus();await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>document.activeElement?.id??'')).toBe('block-order-join.rules');
  await expect(page.locator('#block-order-join\\.rules')).toContainText('Measure after');
  await expect(page.locator('.synthetic').first()).toHaveText('Synthetic example data, not a measured result.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);

  await page.emulateMedia({media:'print'});
  const clipped=await page.evaluate(()=>{
   const problems:string[]=[];const main=document.querySelector('main')!.getBoundingClientRect();
   for(const figure of document.querySelectorAll<HTMLElement>('.figure')){
    const style=getComputedStyle(figure),svg=figure.querySelector('svg');
    if(style.overflow==='hidden'||style.overflow==='clip')problems.push('figure overflow '+style.overflow);
    if(!svg){problems.push('figure without svg');continue;}
    const box=svg.getBoundingClientRect();
    if(box.width<1||box.height<1)problems.push('empty figure');
    if(box.left<main.left-1||box.right>main.right+1)problems.push('figure wider than the page');
    if(figure.scrollWidth>figure.clientWidth+1||figure.scrollHeight>figure.clientHeight+1)problems.push('figure content exceeds its box');
   }
   for(const wrap of document.querySelectorAll<HTMLElement>('.table-wrap'))if(getComputedStyle(wrap).overflow!=='visible')problems.push('table clipped in print');
   return {problems,figures:document.querySelectorAll('.figure').length};
  });
  expect(clipped.figures).toBe(3);expect(clipped.problems).toEqual([]);
  expect(requests).toEqual([]);expect(errors).toEqual([]);
 });
});
test.describe('meeting summary form at 390',()=>{
 test.use({viewport:{width:390,height:844},reducedMotion:'reduce'});
 test('every field is reached by Tab alone, labelled, without horizontal scroll',async({page})=>{
  const {errors,requests}=await offline(page);
  const markup=dialogMarkup();
  await page.setContent(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:16px;font:15px system-ui">${markup}</body></html>`);
  const form=page.getByRole('form',{name:'Meeting summary'});await expect(form).toBeVisible();
  for(const name of ['Title','Audience'])await expect(form.getByRole('textbox',{name})).toBeVisible();
  await expect(form.getByRole('checkbox',{name:'Business question and data path'})).toBeChecked();
  await expect(form.getByText('Browser print gives the PDF.',{exact:false})).toBeVisible();
  // Static markup: Tab order is the document order; radio groups take one stop each.
  const reached:string[]=[];
  for(let i=0;i<14;i++){
   await page.keyboard.press('Tab');
   const name=await page.evaluate(()=>{const e=document.activeElement as HTMLElement|null;if(!e||e===document.body)return 'BODY';const label=e.closest('label')?.textContent?.trim()??e.textContent?.trim()??'';return e.tagName.toLowerCase()+':'+label.slice(0,40);});
   reached.push(name);if(name.startsWith('button:Cancel'))break;
  }
  expect(reached).not.toContain('BODY');
  expect(reached[0]).toMatch(/^input:Title/);expect(reached[1]).toMatch(/^input:Audience/);
  expect(reached).toContain('button:Download meeting summary');expect(reached.at(-1)).toBe('button:Cancel');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(requests).toEqual([]);expect(errors).toEqual([]);
 });
});
