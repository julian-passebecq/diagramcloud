import {test,expect} from '@playwright/test';

// R993: compare floor plan A with floor plan B side by side; the navigation marks each room A only / B only / both.
test('Compare A vs B shows both plans, marks each group, writes and copies the comparison, and Exit compare returns',async({page,context})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.goto('/shell.html');
  const tree=page.getByRole('navigation',{name:'Diagrams'});
  await tree.getByRole('button',{name:'floor-plan.svg',exact:true}).click();
  await page.getByRole('button',{name:'Compare A vs B'}).click();
  const picker=page.getByRole('menu',{name:'Compare floor-plan.svg with'});
  await expect(picker.getByRole('menuitem')).toHaveText(['architecture.svg','floor-plan-b.svg']);
  await picker.getByRole('menuitem',{name:'floor-plan-b.svg'}).click();
  const a=page.getByRole('region',{name:'Option A: floor-plan.svg'}),b=page.getByRole('region',{name:'Option B: floor-plan-b.svg'});
  await expect(a.locator('.sh-diagram svg')).toBeVisible();
  await expect(b.locator('.sh-diagram svg')).toBeVisible();
  const boxA=(await a.boundingBox())!,boxB=(await b.boundingBox())!;
  expect(boxB.x).toBeGreaterThan(boxA.x+boxA.width-1); // side by side, B right of A
  const nav=page.getByRole('list',{name:'Groups of A and B'});
  const marks=Object.fromEntries(await nav.getByRole('button').evaluateAll(bs=>bs.map(x=>[x.querySelector('.sh-row-label')!.textContent,x.querySelector('.sh-mark')!.textContent])));
  expect(marks).toEqual({'Living room':'both','Kitchen':'both','Bathroom':'both','Bedroom':'both','Hall':'A only','Doors':'both','Study':'B only'});
  const out=page.getByRole('contentinfo',{name:'Output'});
  await expect(out).toContainText(/Compare A = diagrams\/floor-plan\.svg \(\d+(\.\d)? (B|KB)\) with B = diagrams\/floor-plan-b\.svg \(\d+(\.\d)? (B|KB)\)\./);
  await expect(out).toContainText('Only in A (1): Hall.');
  await expect(out).toContainText('Only in B (1): Study.');
  await expect(out).toContainText('In both (5): Living room, Kitchen, Bathroom, Bedroom, Doors.');
  await expect(out).not.toContainText('Only in A (6)'); // never a comparison written before B is drawn
  // Clicking a row highlights the group in each stage where it exists.
  await nav.getByRole('button',{name:/Kitchen/}).click();
  await expect(a.locator('.sh-diagram')).toHaveCount(1);
  expect(await page.evaluate(()=>[...document.querySelectorAll('.sh-diagram')].map(h=>!!h.shadowRoot?.querySelector('#kitchen.sh-hl')))).toEqual([true,true]);
  await nav.getByRole('button',{name:/Study/}).click();
  expect(await page.evaluate(()=>[...document.querySelectorAll('.sh-diagram')].map(h=>!!h.shadowRoot?.querySelector('#study.sh-hl')))).toEqual([false,true]);
  await page.getByRole('button',{name:'Copy comparison'}).click();
  await expect(out).toContainText('Copied the comparison to the clipboard.');
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('Only in B (1): Study.');
  if(process.env.SHELL_SHOTS)await page.screenshot({path:`${process.env.SHELL_SHOTS}/r993-compare-floor-plan-a-b.png`});
  await page.getByRole('button',{name:'Exit compare'}).click();
  await expect(b).toHaveCount(0);
  await expect(page.locator('.sh-stage[hidden]')).toHaveCount(1);
  await expect(page.getByRole('complementary',{name:'Navigation'}).getByRole('button')).toHaveText(['Living room','Kitchen','Bathroom','Bedroom','Hall','Doors']);
  await expect(tree.getByRole('treeitem',{selected:true})).toHaveText('floor-plan.svg');
  await expect(page.getByRole('button',{name:'Compare A vs B'})).toBeVisible();
  // Esc also leaves compare.
  await page.getByRole('button',{name:'Compare A vs B'}).click();
  await page.getByRole('menu',{name:'Compare floor-plan.svg with'}).getByRole('menuitem',{name:'floor-plan-b.svg'}).click();
  await expect(page.getByRole('button',{name:'Exit compare'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Compare A vs B'})).toBeVisible();
  await expect(page.getByRole('region',{name:/Option B/})).toHaveCount(0);
  expect(errors).toEqual([]);
});
