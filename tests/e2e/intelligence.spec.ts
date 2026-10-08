import {test, expect} from '@playwright/test';

test('authoring readiness changes purpose without modifying the source JSON', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'JSON / AI', exact: true}).click();
  const source = await page.getByLabel('Project JSON', {exact: true}).inputValue();
  const panel = page.getByTestId('project-readiness');
  await panel.locator('summary').click();
  await expect(panel.getByText('Minimum output plan', {exact: true})).toBeVisible();
  await panel.getByLabel('Readiness purpose').selectOption('audit');
  await expect(panel.getByText('Runtime not evaluated by this report', {exact: true})).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await panel.getByRole('button', {name: 'Download asset checklist CSV', exact: true}).click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.asset-checklist\.csv$/);
  expect(await page.getByLabel('Project JSON', {exact: true}).inputValue()).toBe(source);
});
