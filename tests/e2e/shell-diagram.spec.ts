import {test,expect} from '@playwright/test';

// R958: the shell shows a diagram from diagrams/, lists its groups and switches files.
test('shell shows a diagram, its groups and the Output line, and switches file', async ({page}) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/shell.html');
  const tree=page.getByRole('navigation',{name:'Diagrams'});
  await expect(tree.getByRole('button')).toHaveText(['architecture.svg','floor-plan.svg']);
  await expect(page.locator('.sh-diagram svg')).toBeVisible();
  const nav=page.getByRole('complementary',{name:'Navigation'});
  await expect(nav.getByRole('button',{name:'API gateway'})).toBeVisible();
  await expect(page.getByRole('contentinfo',{name:'Output'})).toContainText(/Showing diagrams\/architecture\.svg \(\d+(\.\d)? (B|KB)\)/);
  await nav.getByRole('button',{name:'Database'}).click();
  await expect(page.locator('#database')).toHaveClass(/sh-hl/);
  await page.getByRole('button',{name:'Zoom to fit'}).click();
  await expect(page.getByRole('button',{name:'Zoom to fit'})).toHaveAttribute('aria-pressed','true');
  if(process.env.SHELL_SHOTS)await page.screenshot({path:`${process.env.SHELL_SHOTS}/1-architecture.png`});
  await tree.getByRole('button',{name:'floor-plan.svg'}).click();
  await expect(tree.getByRole('treeitem',{selected:true})).toHaveText('floor-plan.svg');
  await expect(nav.getByRole('button')).toHaveText(['Living room','Kitchen','Bathroom','Bedroom','Hall','Doors']);
  await expect(page.getByRole('contentinfo',{name:'Output'})).toContainText('Showing diagrams/floor-plan.svg');
  if(process.env.SHELL_SHOTS)await page.screenshot({path:`${process.env.SHELL_SHOTS}/2-floor-plan.png`});
  const popup=page.waitForEvent('popup');
  await page.getByRole('button',{name:'Open raw file'}).click();
  await expect((await popup)).toHaveURL(/floor-plan.*\.svg/);
  expect(errors).toEqual([]);
});
