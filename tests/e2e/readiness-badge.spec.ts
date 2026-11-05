import {test, expect, type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import type {Project} from '../../src/core/model';
import {projectReadiness, purposeBadge, PURPOSE_BADGE_NOTICE} from '../../src/intelligence/readiness';
import {PURPOSES} from '../../src/intelligence/types';

async function openPanel(page: Page) {
  await page.goto('/');
  await page.getByRole('button', {name: 'JSON / AI', exact: true}).click();
  const source = await page.getByLabel('Project JSON', {exact: true}).inputValue();
  const panel = page.getByTestId('project-readiness');
  await panel.locator('summary').click();
  return {panel, source, project: JSON.parse(source) as Project};
}

for (const viewport of [{width: 1440, height: 1100}, {width: 390, height: 844}]) {
  test.describe(`readiness purpose badge at ${viewport.width}px`, () => {
    test.use({viewport});

    test('badge follows the purpose select, links to required gaps and is carried in the JSON download', async ({page}) => {
      const {panel, source, project} = await openPanel(page);
      const badge = panel.getByTestId('readiness-purpose-badge');
      await expect(badge).toContainText(PURPOSE_BADGE_NOTICE);
      let sawIncomplete = false;
      for (const purpose of PURPOSES) {
        await panel.getByLabel('Readiness purpose').selectOption(purpose);
        const expected = purposeBadge(projectReadiness(project, {purpose}));
        await expect(badge.locator('.readiness-badge-text')).toHaveText(expected.text);
        await expect(badge).not.toContainText('%');
        await expect(badge.getByRole('button')).toHaveCount(expected.requiredGaps.length);
        if (expected.complete) continue;
        sawIncomplete = true;
        const first = expected.requiredGaps[0];
        await badge.getByRole('button', {name: `Go to gap: ${first.title}`, exact: true}).click();
        const target = panel.locator('li', {has: page.getByText(first.title, {exact: true})}).last();
        await expect(target).toBeFocused();
      }
      expect(sawIncomplete, 'the default sample exercises both badge states').toBe(true);

      await panel.getByLabel('Readiness purpose').selectOption('portfolio');
      const downloaded = page.waitForEvent('download');
      await panel.getByRole('button', {name: 'Download readiness JSON', exact: true}).click();
      const file = JSON.parse(await readFile((await (await downloaded).path())!, 'utf8'));
      expect(file.purposeBadge).toEqual(purposeBadge(projectReadiness(project, {purpose: 'portfolio'})));
      expect(file.purposeBadge.text).toBe(await badge.locator('.readiness-badge-text').innerText());
      expect(await page.getByLabel('Project JSON', {exact: true}).inputValue()).toBe(source);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test('incomplete purpose: keyboard reaches the gap link and Enter moves focus to the gap', async ({page}) => {
      const {panel} = await openPanel(page);
      const select = panel.getByLabel('Readiness purpose');
      const badge = panel.getByTestId('readiness-purpose-badge');
      for (const purpose of PURPOSES) {
        await select.selectOption(purpose);
        if (await badge.getByRole('button').count()) break;
      }
      const links = badge.getByRole('button');
      expect(await links.count(), 'some purpose has a required gap in the default sample').toBeGreaterThan(0);
      await select.focus();
      await page.keyboard.press('Tab');
      await expect(links.first()).toBeFocused();
      const title = (await links.first().innerText()).replace(/^Go to gap: /, '');
      await page.keyboard.press('Enter');
      await expect(panel.locator('li', {has: page.getByText(title, {exact: true})}).last()).toBeFocused();
      await expect(badge.getByRole('status')).toHaveText(/required gaps? open for /);
    });
  });
}
