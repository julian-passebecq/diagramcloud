import {test, expect, type Page} from '@playwright/test';
import {presentationPreferenceKey} from '../../src/core/presentationProfile';

async function openProject(page: Page) {
  await page.goto('/');
  await page.locator('.project-card').filter({hasText: 'TotalEnergies'}).click();
  await expect(page.getByRole('heading', {name: 'TotalEnergies', exact: true})).toBeVisible();
}

async function authoringJson(page: Page) {
  const button = page.getByRole('button', {name: 'JSON / AI', exact: true});
  if(!await button.isVisible()) await page.getByText('More tools', {exact: true}).click();
  await button.click();
  const json = await page.getByLabel('Project JSON', {exact: true}).inputValue();
  await page.getByRole('button', {name: 'Close dialog', exact: true}).click();
  return JSON.parse(json);
}

test('presentation choices survive reopening and leave the complete authoring document unchanged', async ({page}) => {
  await openProject(page);
  const before = await authoringJson(page);
  for(const profile of ['vanilla', 'standard', 'advanced']) {
    await page.getByLabel('Presentation profile', {exact: true}).selectOption(profile);
    await expect(page.getByRole('button', {name: 'Export & share', exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Relationships', exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Evidence / gaps', exact: true})).toBeVisible();
    if(profile === 'vanilla') {
      await expect(page.getByRole('button', {name: 'Blueprint', exact: true})).toBeHidden();
      await page.getByText('More tools', {exact: true}).click();
      await expect(page.getByRole('button', {name: 'Blueprint', exact: true})).toBeVisible();
    } else await expect(page.getByRole('button', {name: 'Blueprint', exact: true})).toBeVisible();
    if(profile === 'advanced') await expect(page.getByRole('button', {name: 'Source details', exact: true})).toBeVisible();
    expect(await authoringJson(page)).toEqual(before);
  }
  await page.locator('.project-card').filter({hasText: 'Datapass | project architecture map'}).click();
  await expect(page.getByLabel('Presentation profile', {exact: true})).toHaveValue('standard');
  await page.locator('.project-card').filter({hasText: 'TotalEnergies'}).click();
  await expect(page.getByLabel('Presentation profile', {exact: true})).toHaveValue('advanced');
  await page.reload();
  await page.locator('.project-card').filter({hasText: 'TotalEnergies'}).click();
  await expect(page.getByLabel('Presentation profile', {exact: true})).toHaveValue('advanced');
  expect(await authoringJson(page)).toEqual(before);
});

test('a corrupt preference and blocked preference writes do not prevent project inspection', async ({page}) => {
  await page.goto('/');
  const host = new URL(page.url()).host;
  await page.evaluate(({key}) => localStorage.setItem(key, '{broken'), {key: presentationPreferenceKey('total-project-controls', host)});
  await page.reload();
  await page.locator('.project-card').filter({hasText: 'TotalEnergies'}).click();
  await expect(page.getByLabel('Presentation profile', {exact: true})).toHaveValue('standard');
  await expect(page.getByRole('status').filter({hasText: 'saved presentation preference is unreadable'})).toBeVisible();
  await page.evaluate(() => {Storage.prototype.setItem = () => {throw new DOMException('Blocked', 'SecurityError');};});
  await page.getByLabel('Presentation profile', {exact: true}).selectOption('vanilla');
  await expect(page.getByLabel('Presentation profile', {exact: true})).toHaveValue('vanilla');
  await expect(page.getByRole('status').filter({hasText: 'Presentation preference could not be saved'})).toBeVisible();
  await page.getByRole('button', {name: 'Explore SQL quality checks', exact: true}).click();
  await expect(page.getByTestId('view-overview')).toBeVisible();
  await expect(page.getByTestId('view-validation')).toBeVisible();
});
