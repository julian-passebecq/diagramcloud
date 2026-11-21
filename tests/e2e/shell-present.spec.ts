import {test,expect,type Page} from '@playwright/test';

// R998: Present turns the diagrams picked in the tree (or all of diagrams/) into a deck, one diagram full size per slide.
const slideSvg=(page:Page)=>page.evaluate(()=>{
  const h=document.querySelector('.sh-canvas .sh-diagram');const svg=h?.shadowRoot?.querySelector('svg');
  return svg?{title:svg.querySelector(':scope>title')?.textContent??'',w:svg.getBoundingClientRect().width,style:!!h!.shadowRoot!.querySelector('style')}:null;
});

test('Present over three picked diagrams: arrows and Space move, the navigation jumps, Copy deck outline, Esc returns',async({page,context})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.goto('/shell.html');
  const tree=page.getByRole('navigation',{name:'Diagrams'});
  await tree.getByRole('button',{name:'floor-plan.svg',exact:true}).click();
  // Picked out of order: the deck still follows the tree.
  for(const n of ['floor-plan.svg','floor-plan-b.svg','architecture.svg'])await tree.getByRole('button',{name:n,exact:true}).click({modifiers:['ControlOrMeta']});
  await expect(tree.getByRole('treeitem',{selected:true})).toHaveCount(3);
  const present=page.getByRole('button',{name:'Present',exact:true});
  await present.click();
  const status=page.getByRole('contentinfo',{name:'Output'}).getByRole('status');
  const slides=page.getByRole('list',{name:'Slides'}).getByRole('button');
  await expect(slides).toHaveText(['1. architecture.svg','2. floor-plan-b.svg','3. floor-plan.svg']);
  await expect(status).toHaveText('slide 1 of 3: architecture.svg');
  const first=(await slideSvg(page))!;
  expect(first.title).toBe('Sample architecture: six services');
  expect(first.style).toBe(true); // drawn as before: sanitised into its own shadow root with the stage style
  const canvas=(await page.getByRole('main',{name:'Diagram'}).boundingBox())!;
  expect(first.w).toBeGreaterThan(canvas.width*0.6); // fitted to the centre, not actual size
  await expect(page.getByRole('button',{name:'Compare A vs B'})).toBeDisabled();
  // Space while the focused Present button would click it: it moves the deck instead.
  await page.keyboard.press(' ');
  await expect(status).toHaveText('slide 2 of 3: floor-plan-b.svg');
  await expect(page.getByRole('button',{name:'Exit present'})).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(status).toHaveText('slide 3 of 3: floor-plan.svg');
  expect((await slideSvg(page))!.title).toBe('Sample floor plan: small flat');
  await page.keyboard.press('ArrowRight'); // stays on the last slide
  await expect(status).toHaveText('slide 3 of 3: floor-plan.svg');
  await page.keyboard.press('ArrowLeft');
  await expect(status).toHaveText('slide 2 of 3: floor-plan-b.svg');
  await slides.nth(0).click();
  await expect(status).toHaveText('slide 1 of 3: architecture.svg');
  await expect(slides.nth(0)).toHaveAttribute('aria-current','true');
  await page.keyboard.press('ArrowLeft'); // stays on the first slide
  await expect(status).toHaveText('slide 1 of 3: architecture.svg');
  await page.getByRole('button',{name:'Copy deck outline'}).click();
  const out=page.getByRole('contentinfo',{name:'Output'});
  await expect(out).toContainText('Copied the deck outline (3 slide(s)) to the clipboard.');
  // The Windows clipboard turns \n into \r\n; the outline itself joins with \n.
  expect(await page.evaluate(()=>navigator.clipboard.readText().then(t=>t.replace(/\r\n/g,'\n')))).toBe(
    '1. architecture.svg, Sample architecture: six services\n2. floor-plan-b.svg, Sample floor plan B: small flat with a study\n3. floor-plan.svg, Sample floor plan: small flat');
  await page.keyboard.press('ArrowRight');
  if(process.env.SHELL_SHOTS)await page.screenshot({path:`${process.env.SHELL_SHOTS}/r998-present-deck.png`});
  await page.keyboard.press('Escape');
  await expect(present).toBeVisible();
  await expect(status).toHaveCount(0);
  await expect(out).toContainText('Left Present: showing diagrams/floor-plan.svg.');
  expect((await slideSvg(page))!.title).toBe('Sample floor plan: small flat');
  await expect(page.getByRole('complementary',{name:'Navigation'}).getByRole('button')).toHaveText(['Living room','Kitchen','Bathroom','Bedroom','Hall','Doors']);
  expect(errors).toEqual([]);
});

test('Present with nothing picked shows every diagram in diagrams/, in tree order',async({page})=>{
  await page.goto('/shell.html');
  await page.getByRole('button',{name:'Present',exact:true}).click();
  await expect(page.getByRole('list',{name:'Slides'}).getByRole('button')).toHaveText(['1. architecture.svg','2. floor-plan-b.svg','3. floor-plan.svg']);
  await page.getByRole('button',{name:'Exit present'}).click();
  await expect(page.getByRole('list',{name:'Slides'})).toHaveCount(0);
});
