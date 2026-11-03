// Seed variant `empty`: the very first contact of an administrator — the
// step where the cold Reddit user was lost (#486). Ends with a persisted
// first space; model11 candidates also cross the native graph write/history seam.
import { test, expect } from '@playwright/test';
import { seedVariant } from '../lib/ha-ctl.mjs';
import { card, editorTabs, evidence, spaceEntries, stageOf } from '../lib/ha-page.mjs';
import { HP, confirmIn } from '../lib/hooks.mjs';
import {installedRecord} from '../lib/contract.mjs';
import {compareTags} from '../../scripts/tags.mjs';
import {exactGraphFirstSpace} from '../lib/exact-graph-first-space.mjs';
import {planConfig} from '../lib/ha-ws.mjs';

test.skip(() => seedVariant() !== 'empty', 'needs the empty seed variant');

test('from the sidebar page to a saved first space without any image', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.goto('/houseplan');
  await expect(page.locator('houseplan-panel')).toBeVisible({ timeout: 60_000 });
  const host = card(page);
  const empty = host.locator(HP.empty).first();
  await expect(empty).toBeVisible({ timeout: 60_000 });
  await expect(empty).toContainText(/add the first space/i);
  await evidence(testInfo, page, 'empty-admin.png');

  // an administrator with write access gets the first space's dialog opened
  // for them, a moment after the empty state is drawn — the onboarding form
  // since #877, the ordinary space dialog before it; only when none opens, the
  // Add space button is the way. A click that the opening dialog intercepts is
  // simply tried again.
  const dialog = host.locator(`${HP.dialog('onboarding')}, ${HP.dialog('space')}`).first();
  await expect(async () => {
    if (await dialog.isVisible()) return;
    await host.locator(HP.createSpace).first().click({ timeout: 2_000 });
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await dialog.locator('input[type="text"]').first().fill('Ground floor');
  // drawing instead of an image (the dialog redesigned in #600, 1.77.0)
  await dialog.getByRole('radio', { name: /draw it myself/i }).check();
  await evidence(testInfo, page, 'first-space-dialog.png');
  await confirmIn(dialog).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });

  await expect(spaceEntries(host)).toHaveCount(1);
  await expect(spaceEntries(host).first()).toContainText('Ground floor');
  await expect(stageOf(host)).toBeVisible();
  await expect(editorTabs(host)).toHaveCount(3);
  await evidence(testInfo, page, 'first-space-created.png');

  // The fixed beta first-use journey now crosses the model11 render/write seam.
  // Historical releases keep their own first-space behavior, not a silent pass
  // of graph expectations unsupported by their installed version.
  const version=installedRecord()?.version;
  const saved=await planConfig();
  if(!version||compareTags('v'+version,'v1.84.0-beta.3')>=0||saved.graph_change_api===2)
    await exactGraphFirstSpace(page,host,testInfo,saved);

  // the space lives on the server, not in this tab
  await page.reload();
  await expect(spaceEntries(page.locator('houseplan-card').first())).toHaveCount(1, { timeout: 60_000 });
  await expect(spaceEntries(page.locator('houseplan-card').first()).first()).toContainText('Ground floor');
});
