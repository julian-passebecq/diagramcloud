import {test,expect,type Page} from '@playwright/test';

/** QA polish (2026-11-05): header on one row at 1440, readable JSON drawer refusals, no horizontal scroll in a lesson at 390. */
async function headerOnOneRow(page:Page){
 const header=page.locator('header.app-header');
 const boxes=await header.locator('.header-actions > button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return {label:b.textContent??'',top:r.top,bottom:r.bottom,right:r.right};}));
 expect(boxes.length).toBeGreaterThan(4);
 const centres=new Set(boxes.map(b=>Math.round((b.top+b.bottom)/2)));
 expect(centres.size,JSON.stringify(boxes)).toBe(1);
 expect(Math.max(...boxes.map(b=>b.bottom-b.top))-Math.min(...boxes.map(b=>b.bottom-b.top)),'every header action has the same height').toBeLessThanOrEqual(1);
 const headerBox=(await header.boundingBox())!;
 for(const b of boxes){expect(b.bottom,b.label).toBeLessThanOrEqual(headerBox.y+headerBox.height);expect(b.right,b.label).toBeLessThanOrEqual(1440);}
 const tabs=(await page.getByRole('tablist',{name:'Workspace mode'}).boundingBox())!;
 expect(tabs.y+tabs.height).toBeLessThanOrEqual(headerBox.y+headerBox.height);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
}

test('header: actions stay on one row at 1440 in Explore and in Edit with the JSON drawer open; view-title actions are app-styled',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await headerOnOneRow(page);
 await expect(page.getByRole('tab',{name:'Edit',exact:true})).toBeEnabled();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await expect(page.getByRole('button',{name:'JSON drawer',exact:true})).toBeVisible();
 await headerOnOneRow(page);
 await page.getByRole('button',{name:'JSON drawer',exact:true}).click();
 await headerOnOneRow(page);
 for(const name of ['Edit view details','Reuse existing component']){
  const button=page.getByRole('button',{name,exact:true}).first();
  await expect(button).toBeVisible();
  const style=await button.evaluate(b=>{const s=getComputedStyle(b);return {radius:s.borderTopLeftRadius,font:s.fontSize,bg:s.backgroundColor};});
  expect(style.radius,name).toBe('5px');expect(style.font,name).toBe('12px');expect(style.bg,name).not.toBe('rgb(239, 239, 239)');
 }
});

test('JSON drawer: a structurally invalid draft reads one "path: message" line per issue and applies nothing',async({page})=>{
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await expect(page.getByRole('tab',{name:'Edit',exact:true})).toBeEnabled();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();
 await page.getByRole('button',{name:'JSON drawer',exact:true}).click();
 const drawer=page.getByRole('complementary',{name:'JSON drawer'}),text=drawer.getByLabel('JSON draft');
 const revision=await drawer.getByTestId('applied-revision').textContent();
 await page.getByRole('button',{name:'Explore SQL quality checks',exact:true}).click();
 await drawer.getByLabel('Draft scope').selectOption('node');
 await expect(text).toHaveValue(/"id": "checks"/);
 const node=JSON.parse(await text.inputValue());
 await text.fill(JSON.stringify({...node,label:42},null,2));
 const error=drawer.getByTestId('draft-error');
 await expect(error).toContainText(/^nodes\[\d+\]\.label: Expected string, received number$/m);
 await expect(error).not.toContainText('"code"');
 expect((await error.textContent())!.trimStart().startsWith('[')).toBe(false);
 await expect(drawer.getByRole('button',{name:'Apply draft',exact:true})).toBeDisabled();
 await expect(drawer.getByTestId('applied-revision')).toHaveText(revision!);
});

test('lesson at 390x844: the diagram source choice never widens the page',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?catalogue');
 const catalogue=page.getByRole('region',{name:'Learning catalogue',exact:true});
 const title='Deterministic workflow versus model-directed agent';
 await catalogue.getByRole('button',{name:'Open lesson '+title,exact:true}).click();
 const lesson=catalogue.getByRole('article',{name:'Lesson: '+title});
 const source=lesson.getByLabel('Lesson diagram source');
 await expect(source).toBeVisible();
 const box=(await source.boundingBox())!;
 expect(box.x+box.width).toBeLessThanOrEqual(390);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

for(const width of [1280,1440])test(`V3 Explore at ${width}: context scope tabs keep whole labels (Alternatives never breaks mid-word)`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.goto('/?workspace=v3');
 await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
 const tabs=page.getByRole('tablist',{name:'Context scope'});
 await expect(tabs.getByRole('tab',{name:'Alternatives',exact:true})).toBeVisible();
 const metrics=await tabs.getByRole('tab').evaluateAll(list=>list.map(t=>{const s=getComputedStyle(t),line=parseFloat(s.lineHeight)||parseFloat(s.fontSize)*1.3;const pad=parseFloat(s.paddingTop)+parseFloat(s.paddingBottom)+parseFloat(s.borderTopWidth)+parseFloat(s.borderBottomWidth);return {label:t.textContent,lines:Math.round((t.getBoundingClientRect().height-pad)/line),overflow:t.scrollWidth>t.clientWidth+1};}));
 for(const m of metrics){expect(m.lines,JSON.stringify(m)).toBeLessThanOrEqual(1);expect(m.overflow,JSON.stringify(m)).toBe(false);}
});
