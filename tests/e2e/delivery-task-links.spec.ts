import {test, expect, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

// Existing App/dock and producer formats; these are synthetic inputs, never real PM work.
const planRaw = readFileSync('tests/fixtures/delivery-evidence/linked-plan.json', 'utf8');
const taskRaw = readFileSync('tests/fixtures/delivery-evidence/linked-tasks.json', 'utf8');
const upload = (name: string, raw: string) => ({name, mimeType: 'application/json', buffer: Buffer.from(raw)});
async function ensurePlanDock(page: Page) {
  const w = page.getByTestId('v3-workspace');
  await expect(w).toBeVisible();
  if (await w.getByRole('region', {name: 'Navigation map and contextual activity'}).isHidden()) {
    // Wide layouts toggle the dock; the 390 px compact layout switches to its "Map / activity" pane.
    const wide = w.getByRole('button', {name: 'Bottom panel', exact: true});
    if (await wide.count()) await wide.click();
    else await w.getByRole('navigation', {name: 'Workspace panes'}).getByRole('button', {name: 'Map / activity', exact: true}).click();
  }
  await page.getByText('Dock panels', {exact: true}).click();
  await page.getByLabel('Main dock panel', {exact: true}).selectOption('work');
  await page.getByText('Dock panels', {exact: true}).click();
  return w.getByRole('region', {name: 'Delivery evidence', exact: true});
}
async function openPlan(page: Page) {
  await page.goto('/?workspace=v3');
  const panel = await ensurePlanDock(page);
  await panel.getByLabel('Load delivery plan', {exact: true}).setInputFiles(upload('plan.json', planRaw));
  // Compact mode uses semantic disclosures; do not make assertions on hidden descendants.
  for (const details of await panel.locator('details').all()) {
    if ((await details.getAttribute('open')) === null) await details.locator('summary').click();
  }
  return panel;
}
for (const width of [1440, 390]) test.describe(`delivery task binding ${width}`, () => {
  test.use({viewport: {width, height: width === 390 ? 844 : 1000}});
  test('explicit scope and bytes; invalid input retains last valid, changed bytes do not match', async ({page}) => {
    const panel = await openPlan(page);
    await expect(panel).toContainText('Known estimate subtotal');
    await expect(panel).toContainText('Partial estimate coverage');
    await expect(panel).toContainText('test.desktop');
    const load = panel.getByLabel('Load PM task snapshot', {exact: true});
    await load.setInputFiles(upload('tasks.json', taskRaw));
    await expect(panel.getByText('MATCHED', {exact: true})).toBeVisible();
    await expect(panel).toContainText('APPROVED (source-declared)');
    await load.setInputFiles(upload('invalid.json', '{broken'));
    await expect(panel.getByRole('alert')).toContainText('previous valid snapshot is retained');
    await expect(panel.getByText('MATCHED', {exact: true})).toBeVisible();
    await load.setInputFiles(upload('different-bytes.json', taskRaw + '\n'));
    await expect(panel.getByText('SNAPSHOT_MISMATCH', {exact: true})).toBeVisible();
    await expect(panel).not.toContainText('Implement the synthetic request reader');
    await expect(panel.getByRole('button', {name: /dispatch|approve|execute/i})).toHaveCount(0);
  });
  test('audience and new plan cut discard task details; return does not silently rebind', async ({page}) => {
    const panel = await openPlan(page);
    await panel.getByLabel('Load PM task snapshot', {exact: true}).setInputFiles(upload('tasks.json', taskRaw));
    await expect(panel.getByText('MATCHED', {exact: true})).toBeVisible();
    await page.getByRole('tab', {name: 'Portfolio', exact: true}).click();
    await expect(page.getByTestId('v3-workspace')).not.toContainText('Implement the synthetic request reader');
    await page.getByRole('tab', {name: 'Explore', exact: true}).click();
    await ensurePlanDock(page);
    const newPlan = {...JSON.parse(planRaw), title: 'A new, explicit plan source cut'};
    await panel.getByLabel('Load delivery plan', {exact: true}).setInputFiles(upload('new-plan.json', JSON.stringify(newPlan)));
    await expect(panel).toContainText('A new, explicit plan source cut');
    await expect(panel).not.toContainText('Implement the synthetic request reader');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
  test('a slow older file cannot replace the newest file', async ({page}) => {
    const panel = await openPlan(page);
    await page.evaluate(() => {
      const original = File.prototype.text;
      (window as unknown as {releasePlan?: () => void}).releasePlan = undefined;
      File.prototype.text = function() {
        if (this.name === 'old-slow.json') return new Promise<string>(resolve => {
          (window as unknown as {releasePlan: () => void}).releasePlan = () => {void original.call(this).then(resolve);};
        });
        return original.call(this);
      };
    });
    const old = JSON.stringify({...JSON.parse(planRaw), title: 'Old slow plan'});
    const latest = JSON.stringify({...JSON.parse(planRaw), title: 'Latest selected plan'});
    const load = panel.getByLabel('Load delivery plan', {exact: true});
    await load.setInputFiles(upload('old-slow.json', old));
    await load.setInputFiles(upload('latest.json', latest));
    await expect(panel).toContainText('Latest selected plan');
    await page.evaluate(() => (window as unknown as {releasePlan: () => void}).releasePlan());
    await expect(panel).not.toContainText('Old slow plan');
    await expect(panel).toContainText('Latest selected plan');
  });
});
