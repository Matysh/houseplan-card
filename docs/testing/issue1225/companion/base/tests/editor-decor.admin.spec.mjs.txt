// Decor editor on a real Home Assistant (houseplan-card#1010, rows 8–12):
// shapes, a text with a live Home Assistant value, furniture, an uploaded
// image, and the space's own backdrop image moved. Oracles: the decor the
// integration stores, the uploaded file served back, and the plan after a
// page reload — in View, where these objects are what a household sees.
import { test, expect } from '@playwright/test';
import { drawsLinesByClicks, requireHooks } from './lib/contract.mjs';
import { card, evidence, expectPlanDrawn } from './lib/ha-page.mjs';
import { planConfig, spaceOf, waitForConfig } from './lib/ha-ws.mjs';
import { HP, hp } from './lib/hooks.mjs';
import {
  centreOf, clickFloor, dragClient, dragFloor, enterEditor, field, leaveEditor, openPlan, selectSpace, settle, snap,
  useTool,
} from './lib/plan.mjs';
import { restoreSeedAfterEach } from './lib/seed-guard.mjs';

requireHooks(test, 'decor', 'stage@data-grid-step', 'mode-tab', 'field', 'action', 'furniture-category', 'furniture-item',
  'image-upload', 'backdrop', 'decor@data-kind');
restoreSeedAfterEach(test);

const YARD = 'smrwhw9la';
const FIRST = 'f2';
const IMAGE = new URL('../fixtures/images/e2e-tile.png', import.meta.url).pathname;
const decorIds = async (spaceId) => new Set((spaceOf((await planConfig()).config, spaceId).decor || []).map((d) => d.id));
/** Decor created since `before`, by kind. */
const added = (config, spaceId, before, kind) => (spaceOf(config, spaceId).decor || [])
  .filter((d) => !before.has(d.id) && d.kind === kind);

async function reloadInView(page, spaceId) {
  await page.reload();
  const host = card(page);
  await expectPlanDrawn(page, host);
  await selectSpace(host, spaceId);
  return host;
}

test('a rectangle, an oval and a line are drawn and kept', async ({ page }, testInfo) => {
  const before = await decorIds(YARD);
  const host = await openPlan(page, { space: YARD });
  await enterEditor(host, 'decor');
  await evidence(testInfo, page, 'shapes-before');
  for (const [tool, from, to] of [
    ['rect', [620, 160], [700, 230]],
    ['ellipse', [720, 160], [800, 230]],
    ['line', [620, 270], [800, 270]],
  ]) {
    await useTool(host, 'shapes');
    await useTool(host, tool);
    const a = await snap(host, ...from);
    const b = await snap(host, ...to);
    if (tool === 'line' && drawsLinesByClicks()) {
      // houseplan-card#1046: two clicks store one segment, Esc ends the chain
      await clickFloor(page, host, a.x, a.y);
      await clickFloor(page, host, b.x, b.y);
      await page.keyboard.press('Escape');
    } else {
      await dragFloor(page, host, a, b);
    }
  }
  const config = await waitForConfig((c) => ['rect', 'ellipse', 'line'].every((k) => added(c, YARD, before, k).length === 1),
    { message: 'three shapes stored' });
  const [rect] = added(config, YARD, before, 'rect');
  expect(rect.w).toBeGreaterThan(0.05);
  expect(rect.h).toBeGreaterThan(0.05);
  await evidence(testInfo, page, 'shapes-drawn');

  await leaveEditor(host);
  const view = await reloadInView(page, YARD);
  for (const kind of ['rect', 'ellipse', 'line']) {
    const [shape] = added(config, YARD, before, kind);
    // several SVG elements can identify one object (hit paths are invisible);
    // a horizontal <line> has a zero-height box, so it is checked as attached
    const drawn = view.locator(`${kind}${hp('decor', { kind, id: shape.id })}`).first();
    if (kind === 'line') await expect(drawn).toBeAttached();
    else await expect(drawn).toBeVisible();
  }
  await evidence(testInfo, page, 'shapes-after-reload');
});

test('a text with a live Home Assistant value is placed and shows the value', async ({ page }, testInfo) => {
  const before = await decorIds(YARD);
  const host = await openPlan(page, { space: YARD });
  await enterEditor(host, 'decor');
  await useTool(host, 'text');
  const at = await snap(host, 700, 420);
  await clickFloor(page, host, at.x, at.y);
  const dialog = host.locator(HP.dialog('decor')).first();
  await expect(dialog).toBeVisible();
  await field(dialog, 'decor-text').fill('Outside {sensor.outdoor_temperature}');
  await evidence(testInfo, page, 'text-dialog');
  await dialog.locator(HP.dialogConfirm).first().click();
  await expect(dialog).toBeHidden();
  const config = await waitForConfig((c) => added(c, YARD, before, 'text').length === 1, { message: 'text stored' });
  const [text] = added(config, YARD, before, 'text');
  expect(text.text).toBe('Outside {sensor.outdoor_temperature}');

  await leaveEditor(host);
  const view = await reloadInView(page, YARD);
  // the seed freezes the outdoor sensor at 16.3 °C; HA formats the value
  await expect(view.locator(hp('decor', { kind: 'text', id: text.id })).first()).toContainText(/Outside 16[.,]3/);
  await evidence(testInfo, page, 'text-after-reload');
});

test('a sofa from the furniture palette is placed and kept', async ({ page }, testInfo) => {
  const before = await decorIds(YARD);
  const host = await openPlan(page, { space: YARD });
  await enterEditor(host, 'decor');
  await useTool(host, 'furniture');
  await host.locator(hp('furniture-category', { id: 'sofa' })).first().click();
  await host.locator(hp('furniture-item', { id: 'sofa' })).first().click();
  const at = await snap(host, 720, 560);
  await clickFloor(page, host, at.x, at.y);
  const config = await waitForConfig((c) => added(c, YARD, before, 'furniture').length === 1, { message: 'sofa stored' });
  const [sofa] = added(config, YARD, before, 'furniture');
  expect(sofa.symbol).toBe('sofa');
  await evidence(testInfo, page, 'furniture-placed');

  await leaveEditor(host);
  const view = await reloadInView(page, YARD);
  await expect(view.locator(hp('decor', { kind: 'furniture', id: sofa.id })).filter({ visible: true }).first()).toBeVisible();
  await evidence(testInfo, page, 'furniture-after-reload');
});

test('an uploaded image is placed on the plan and served back after a reload', async ({ page }, testInfo) => {
  const before = await decorIds(YARD);
  const host = await openPlan(page, { space: YARD });
  await enterEditor(host, 'decor');
  await useTool(host, 'image');
  await host.locator(hp('image-upload', { kind: 'decor' })).setInputFiles(IMAGE);
  // the upload lands in the private palette (deduplicated by content) and
  // arms one placement
  await expect(host.locator(HP.action('image-palette-select')).first()).toBeVisible();
  const at = await snap(host, 700, 470);
  await clickFloor(page, host, at.x, at.y);
  const config = await waitForConfig((c) => added(c, YARD, before, 'image').length === 1, { message: 'image stored' });
  const [image] = added(config, YARD, before, 'image');
  await evidence(testInfo, page, 'image-placed');

  await leaveEditor(host);
  const view = await reloadInView(page, YARD);
  const shown = view.locator(`image${hp('decor', { kind: 'image', id: image.id })}`).first();
  await expect(shown).toBeVisible();
  // the file itself comes back from the integration's signed content URL
  const href = await shown.evaluate((el) => el.getAttribute('href') || el.getAttribute('xlink:href'));
  expect(href).toBeTruthy();
  const served = await page.request.get(new URL(href, page.url()).toString());
  expect(served.status()).toBe(200);
  expect((await served.body()).length).toBeGreaterThan(100);
  await evidence(testInfo, page, 'image-after-reload');
});

test('the backdrop image of a space is moved in its own tool', async ({ page }, testInfo) => {
  const space = spaceOf((await planConfig()).config, FIRST);
  const host = await openPlan(page, { space: FIRST });
  await enterEditor(host, 'decor');
  await useTool(host, 'backdrop');
  await settle(host);
  await evidence(testInfo, page, 'backdrop-before');
  const backdrop = host.locator(hp('backdrop')).first();
  const placed = async (locator) => locator.evaluate((el) => ({ x: Number(el.getAttribute('x')), y: Number(el.getAttribute('y')) }));
  const start = await placed(backdrop);
  const box = await backdrop.boundingBox();
  const from = await centreOf(backdrop);
  await dragClient(page, from, { x: from.x + box.width * 0.08, y: from.y + box.height * 0.05 });
  const moved = await waitForConfig((c) => {
    const s = spaceOf(c, FIRST);
    return (s.plan_x ?? 0) > (space.plan_x ?? 0) + 1e-6 && (s.plan_y ?? 0) > (space.plan_y ?? 0) + 1e-6;
  }, { message: 'backdrop offset stored' });
  const stored = spaceOf(moved, FIRST);
  expect(stored.plan_scale_x).toBeCloseTo(space.plan_scale_x ?? 1, 6);
  await evidence(testInfo, page, 'backdrop-moved');

  // View draws the image where the server says: x is the stored offset
  await leaveEditor(host);
  const view = await reloadInView(page, FIRST);
  const after = await placed(view.locator(hp('backdrop')).first());
  expect(after.x).toBeCloseTo(stored.plan_x * 1000, 1);
  expect(after.x).toBeGreaterThan(start.x);
  expect(after.y).toBeGreaterThan(start.y);
  await evidence(testInfo, page, 'backdrop-after-reload');
});
