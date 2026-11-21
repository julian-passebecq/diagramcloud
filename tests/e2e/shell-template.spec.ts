import {test,expect} from '@playwright/test';

// R964: start a diagram from a template and rename a group. The e2e server is `vite preview`, which cannot write
// diagrams/, so the new diagram stays in the page and the Output pane says so (the dev-server copy is unit-tested).
test('New from template lists three, refuses a taken name, shows a floor plan, and Rename group updates the navigation', async ({page}) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/shell.html');
  const out=page.getByRole('contentinfo',{name:'Output'});
  const nav=page.getByRole('complementary',{name:'Navigation'});
  const tree=page.getByRole('navigation',{name:'Diagrams'});
  await expect(page.getByRole('button',{name:'Rename group'})).toBeDisabled();
  await page.getByRole('button',{name:'New from template'}).click();
  const menu=page.getByRole('menu',{name:'Templates'});
  await expect(menu.getByRole('menuitem')).toHaveText(['Architecture diagram','Floor plan','Flowchart','Org chart','Sequence diagram','Timeline']);
  if(process.env.SHELL_SHOTS)await page.screenshot({path:`${process.env.SHELL_SHOTS}/1-template-list.png`});

  page.once('dialog',d=>d.accept('floor-plan'));
  await menu.getByRole('menuitem',{name:'Floor plan'}).click();
  await expect(out).toContainText('diagrams/floor-plan.svg already exists');
  await expect(tree.getByRole('button')).toHaveText(['architecture.svg','floor-plan-b.svg','floor-plan.svg']);

  await page.getByRole('button',{name:'New from template'}).click();
  page.once('dialog',d=>d.accept('../my flat'));
  await menu.getByRole('menuitem',{name:'Floor plan'}).click();
  await expect(out).toContainText('is refused: use only letters');

  await page.getByRole('button',{name:'New from template'}).click();
  page.once('dialog',d=>d.accept('my-flat'));
  await menu.getByRole('menuitem',{name:'Floor plan'}).click();
  await expect(tree.getByRole('treeitem',{selected:true})).toHaveText('my-flat.svg');
  await expect(nav.getByRole('button')).toHaveText(['Room 1','Room 2','Room 3','Corridor','Doors','Scale']);
  await expect(out).toContainText('my-flat.svg lives in this page only: not saved to the diagrams/ folder yet');
  if(process.env.SHELL_SHOTS)await page.screenshot({path:`${process.env.SHELL_SHOTS}/2-new-floor-plan.png`});

  await nav.getByRole('button',{name:'Room 1'}).click();
  page.once('dialog',d=>d.accept('Living room'));
  await page.getByRole('button',{name:'Rename group'}).click();
  await expect(nav.getByRole('button')).toHaveText(['Living room','Room 2','Room 3','Corridor','Doors','Scale']);
  await expect(page.locator('#room-1 > title')).toHaveText('Living room');
  await expect(page.locator('#room-1 > text')).toHaveText('Living room');
  await expect(out).toContainText('Renamed group Room 1 to Living room in the page');
  if(process.env.SHELL_SHOTS)await page.screenshot({path:`${process.env.SHELL_SHOTS}/3-renamed-group.png`});

  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Save as'}).click();
  const file=await download;
  expect(file.suggestedFilename()).toBe('my-flat.svg');
  const text=await (await file.createReadStream()).toArray().then(c=>Buffer.concat(c).toString('utf8'));
  expect(text).toContain('<title>Living room</title>');
  expect(text).not.toContain('sh-hl');
  // Switching away and back keeps the rename made in the page.
  await tree.getByRole('button',{name:'architecture.svg'}).click();
  await tree.getByRole('button',{name:'my-flat.svg'}).click();
  await expect(nav.getByRole('button').first()).toHaveText('Living room');
  expect(errors).toEqual([]);
});
