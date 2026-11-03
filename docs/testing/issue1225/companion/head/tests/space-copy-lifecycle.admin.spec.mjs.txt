// #1154: real-HA replacement of Space settings by Copy must retain the name.
import { test, expect } from '@playwright/test';
import { compareTags } from '../scripts/tags.mjs';
import { installedRecord, requireHooks } from './lib/contract.mjs';
import { card, evidence, expectPlanDrawn, stageOf } from './lib/ha-page.mjs';
import { planConfig, planLayout, spaceOf, waitForConfig } from './lib/ha-ws.mjs';
import { HP, hp } from './lib/hooks.mjs';
import { clickFloor, enterEditor, field, leaveEditor, openPlan, selectSpace, snap, useTool } from './lib/plan.mjs';
import { profileWire, attachProfileReceipt } from './lib/panel-profiles.mjs';
import { restoreSeedAfterEach } from './lib/seed-guard.mjs';

requireHooks(test, 'space-settings', 'action@data-action', 'dialog@data-kind', 'stage');
restoreSeedAfterEach(test);

test('space-copy name survives the retired HA settings shell and Cancel keeps configuration', async ({ page }, testInfo) => {
  const version = installedRecord()?.version;
  test.skip(!!version && compareTags('v' + version, 'v1.83.0-beta.6') < 0,
    'Space-copy lifecycle correction #1154 ships in 1.83.0-beta.6; an older release is not its proof');
  const before = (await planConfig()).config;
  const source = before.spaces.find(space => space.id === 'f1') || before.spaces[0];
  expect(source).toBeTruthy();
  await page.goto('/houseplan');
  const host = card(page);
  await expectPlanDrawn(page, host);
  await selectSpace(host, source.id);
  await host.locator(hp('space-settings', { id: source.id })).first().click();
  const dialog = host.locator(HP.dialog('space')).first();
  await expect(dialog).toBeVisible();
  await dialog.locator(hp('action', { action: 'space-copy' })).click();
  const name = dialog.getByRole('textbox');
  await expect(name).toBeVisible();
  await name.fill('E2E retained copy name');
  // Observe beyond the retired shell's bounded exit. This is real HA lifecycle:
  // no synthetic events, constructor replacement, retries or product patches.
  await page.waitForTimeout(750);
  await expect(dialog).toBeVisible();
  await expect(name).toHaveValue('E2E retained copy name');
  expect((await planConfig()).config).toEqual(before);
  await evidence(testInfo, page, 'copy-name-retained');
  await dialog.locator(HP.dialogCancel).first().click();
  await expect(field(dialog, 'space-title')).toHaveValue(source.title);
  await evidence(testInfo, page, 'copy-cancel-returned-settings');
  await dialog.locator(HP.dialogCancel).first().click();
  await expect(host.locator(HP.dialog('space'))).toHaveCount(0);
  expect((await planConfig()).config).toEqual(before);
});

// #1156: actual browser actions produce the copy; config/get and reload are
// the oracle. The fixture is enriched through the real editor/upload path.
test('space-copy furniture and decor choices persist all four combinations without changing the source', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const version = installedRecord()?.version;
  test.skip(!!version && compareTags('v' + version, 'v1.84.0-beta.2') < 0,
    'Copy composition #1156 first ships in 1.84.0-beta.2; the earlier copy contract remains unchanged');
  const wire = await profileWire(page);
  const sourceId = 'smrwhw9la';
  const host = await openPlan(page, { space: sourceId });
  await enterEditor(host, 'decor');
  await useTool(host, 'furniture');
  await host.locator(hp('furniture-category', { id: 'sofa' })).first().click();
  await host.locator(hp('furniture-item', { id: 'sofa' })).first().click();
  let at = await snap(host, 720, 560);
  await clickFloor(page, host, at.x, at.y);
  await waitForConfig(c => (spaceOf(c, sourceId).decor || []).some(d => d.kind === 'furniture'), { message: 'source furniture stored' });
  await useTool(host, 'image');
  await host.locator(hp('image-upload', { kind: 'decor' })).setInputFiles(new URL('../fixtures/images/e2e-tile.png', import.meta.url).pathname);
  await expect(host.locator(HP.action('image-palette-select')).first()).toBeVisible();
  at = await snap(host, 700, 470);
  await clickFloor(page, host, at.x, at.y);
  await waitForConfig(c => (spaceOf(c, sourceId).decor || []).some(d => d.kind === 'image'), { message: 'source uploaded image stored' });
  await useTool(host, 'shapes');
  await useTool(host, 'line');
  for (const xy of [[620, 650], [700, 650]]) {
    at = await snap(host, ...xy);
    await clickFloor(page, host, at.x, at.y);
  }
  await page.keyboard.press('Escape');
  await waitForConfig(c => (spaceOf(c, sourceId).decor || []).some(d => d.kind === 'line'), { message: 'source line stored' });
  await leaveEditor(host);
  // #1227 copies accepted saved geometry directly; no Optimize admission step.
  // Observe real passthrough websocket traffic rather than mocking the writer.
  await wire.settle();
  const optimizeRequests = () => wire.receipt.commands.filter(command => command.type === 'houseplan/plan/optimize');
  expect(optimizeRequests()).toHaveLength(0);
  const before = (await planConfig()).config, source = structuredClone(spaceOf(before, sourceId));
  const layoutBefore = (await planLayout()).layout;
  expect(new Set(source.decor.map(d => d.kind))).toEqual(new Set(['rect', 'text', 'furniture', 'image', 'line']));
  const openCopy = async () => {
    await selectSpace(host, sourceId);
    await host.locator(hp('space-settings', { id: sourceId })).first().click();
    const dialog = host.locator(HP.dialog('space')).first();
    await expect(dialog).toBeVisible();
    await dialog.locator(HP.action('space-copy')).click();
    await expect(field(dialog, 'space-copy-furniture')).not.toBeChecked();
    await expect(field(dialog, 'space-copy-decor')).not.toBeChecked();
    return dialog;
  };
  let dialog = await openCopy();
  await field(dialog, 'space-copy-furniture').focus();
  await page.keyboard.press('Space');
  await expect(field(dialog, 'space-copy-furniture')).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(field(dialog, 'space-title')).toBeVisible();
  await dialog.locator(HP.dialogCancel).first().click();
  expect((await planConfig()).config).toEqual(before);
  const withoutId = ({ id, ...object }) => object;
  for (const [furniture, decor] of [[false, false], [true, false], [false, true], [true, true]]) {
    dialog = await openCopy();
    const title = `E2E copy composition ${Number(furniture)}${Number(decor)}`;
    await dialog.getByRole('textbox').fill(title);
    await field(dialog, 'space-copy-furniture').setChecked(furniture);
    await field(dialog, 'space-copy-decor').setChecked(decor);
    await dialog.locator(HP.dialogConfirm).first().click();
    await expect.poll(async () => {
      if (await host.locator(HP.dialog('confirm')).first().isVisible())
        throw Error('Copy unexpectedly requests Optimize instead of copying accepted geometry (#1227)');
      return (await planConfig()).config.spaces.some(s => s.title === title);
    }, { timeout: 30_000, message: 'selected copy accepted by the real integration' }).toBe(true);
    await wire.settle();
    expect(optimizeRequests()).toHaveLength(0);
    const stored = (await planConfig()).config, copy = stored.spaces.find(s => s.title === title);
    const expected = source.decor.filter(d => d.kind === 'furniture' ? furniture : decor);
    expect((copy.decor || []).map(withoutId)).toEqual(expected.map(withoutId));
    expect(new Set((copy.decor || []).map(d => d.id)).size).toBe(expected.length);
    expect((copy.decor || []).every(d => !source.decor.some(original => original.id === d.id))).toBe(true);
    expect(spaceOf(stored, sourceId)).toEqual(source);
    expect(stored.markers).toEqual(before.markers);
    expect((await planLayout()).layout).toEqual(layoutBefore);
    await page.reload();
    const fresh = card(page);
    // Copy converts the room outline into independent partitions; this saved
    // space intentionally has no room records. Require its real geometry.
    await expect(fresh.locator(HP.ready)).toBeVisible();
    const surface = stageOf(fresh); await expect(surface).toBeVisible();
    await expect.poll(async () => (await surface.boundingBox())?.height ?? 0).toBeGreaterThan(200);
    const reloaded = (await planConfig()).config;
    expect(spaceOf(reloaded, copy.id)).toEqual(copy);
    expect(copy.rooms).toEqual([]);
    await expect(fresh.locator(HP.room)).toHaveCount(0);
    expect(copy.partitions).toHaveLength(4);
    expect(copy.partitions.every(partition => partition.cm === 0)).toBe(true);
    const orderSegments = segments => segments.map(segment => segment.sort((a, b) => a[0] - b[0] || a[1] - b[1]))
      .sort((a, b) => a[0][0] - b[0][0] || a[0][1] - b[0][1] || a[1][0] - b[1][0] || a[1][1] - b[1][1]);
    const group = surface.locator('.zero-walls');
    await expect(group).toBeVisible();
    expect(await group.evaluate(node => Number(getComputedStyle(node).opacity))).toBeGreaterThan(0);
    const lines = surface.locator('line.zero-wall');
    await expect(lines).toHaveCount(4);
    const rendered = await lines.evaluateAll(nodes => nodes.map(node => {
      const style = getComputedStyle(node);
      return { points: [[Number(node.getAttribute('x1')), Number(node.getAttribute('y1'))],
        [Number(node.getAttribute('x2')), Number(node.getAttribute('y2'))]],
        paints: style.display !== 'none' && style.visibility !== 'hidden' && style.stroke !== 'none'
          && Number(style.strokeOpacity) > 0 && parseFloat(style.strokeWidth) > 0 };
    }));
    expect(rendered.every(line => line.paints)).toBe(true);
    expect(orderSegments(rendered.map(line => line.points))).toEqual(orderSegments(copy.partitions.map(partition =>
      [partition.a.map(value => value * 1000), partition.b.map(value => value * 1000)])));
    expect(spaceOf(reloaded, copy.id).decor || []).toEqual(copy.decor || []);
    expect(spaceOf(reloaded, sourceId)).toEqual(source);
    await selectSpace(card(page), copy.id);
    if (decor) {
      const image = copy.decor.find(d => d.kind === 'image');
      expect(image.asset_id).toBe(source.decor.find(d => d.kind === 'image').asset_id);
      const drawn = card(page).locator(`image${hp('decor', { kind: 'image', id: image.id })}`).first();
      await expect(drawn).toBeVisible();
      const href = await drawn.evaluate(el => el.getAttribute('href') || el.getAttribute('xlink:href'));
      expect((await page.request.get(new URL(href, page.url()).toString())).status()).toBe(200);
    }
    await evidence(testInfo, page, `copy-composition-${Number(furniture)}${Number(decor)}-after-reload`);
    await attachProfileReceipt(testInfo, 'copy-direct-real-ws.json', wire);
  }
});
