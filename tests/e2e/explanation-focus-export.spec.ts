import {test,expect} from '@playwright/test';
import {portfolioHtml} from '../../src/export/html';
import {teachingCases,teachingProject} from '../../examples/pro-expressiveness/cases';

/* UX33 (partial): the opt-in focused portfolio export, opened offline in Chromium.
 * Manual next/previous, context breadcrumbs, detour and explicit return, focus toggle, code-first detail
 * and keyboard focus kept after activation. No request leaves the page. */
const project=teachingProject(teachingCases()[0]);

test('focused export: step, detour through the context, explicit return and focus toggle, offline',async({page})=>{
 const errors:string[]=[],requests:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('data:')&&r.url()!=='about:blank')requests.push(r.url());});
 await page.setContent(portfolioHtml(project,undefined,{focusStory:true}));
 const story=page.locator('#story'),context=page.locator('#context button'),ret=page.getByRole('button',{name:'Return to explanation step'});
 await expect(ret).toBeDisabled();
 await page.getByRole('button',{name:'Next step'}).click();
 await expect(story).toContainText(`1 / ${project.story.length}`);
 // The step opens its frame view through the drilldown path; only the current view is drawn.
 const crumbs=await context.count();expect(crumbs).toBeGreaterThan(1);
 await expect(page.locator('section.view')).toHaveCount(1);
 await expect(ret).toBeDisabled();
 // Code and tables come before text in the detail pane.
 await expect(page.locator('#details article').first().locator('small')).toContainText('synthetic');
 const types=await page.locator('#details article').evaluateAll(list=>list.map(a=>a.querySelector('pre')?'code':a.querySelector('table')?'table':'text'));
 expect(types.indexOf('code')).toBe(0);
 // Detour to the overview through the context breadcrumb: the story leaves the step, focus stays on the breadcrumb.
 await context.first().click();
 await expect(story).toContainText('Explore freely');
 await expect(page.locator('#context button').first()).toBeFocused();
 await expect(ret).toBeEnabled();
 // Explicit return to the last step.
 await ret.click();
 await expect(story).toContainText(`1 / ${project.story.length}`);
 await expect(page.locator('#context button').last()).toBeFocused();
 // Focus toggle shows every view on the path.
 await page.getByRole('button',{name:'Focus current view'}).click();
 await expect(page.getByRole('button',{name:'Focus current view'})).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('section.view')).toHaveCount(crumbs);
 expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('focused export: keyboard activation keeps focus on the same component',async({page})=>{
 await page.setContent(portfolioHtml(project,undefined,{focusStory:true}));
 const card=page.locator('#views g[data-node-id="wrapper"]');
 await card.focus();await page.keyboard.press('Enter');
 await expect(page.locator('#views g[data-node-id="wrapper"]')).toBeFocused();
 await expect(page.locator('#details h2')).toHaveText('Retry wrapper');
});

test('default export keeps the classic layout: no context bar, no return button',async({page})=>{
 await page.setContent(portfolioHtml(project));
 await expect(page.locator('#context')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Return to explanation step'})).toHaveCount(0);
 await page.getByRole('button',{name:'Next step'}).click();
 await expect(page.locator('#story')).toContainText(`1 / ${project.story.length}`);
});
