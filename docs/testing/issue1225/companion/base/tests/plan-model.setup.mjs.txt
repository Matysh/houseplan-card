// The seed plan is an old document (plan model 5, from the public demo stand).
// The product migrates it on the first structural edit, after which the
// integration refuses an older document from a client — so a scenario could
// not put the seed back after editing it. One real edit through the editor,
// undone at once, brings the stored plan to the product's current model before
// any journey snapshots it. It is also a check of its own: an old plan
// survives that first migrating edit with every room, opening and wall.
import { test as setup, expect } from '@playwright/test';
import { seedVariant } from './lib/ha-ctl.mjs';
import { requireHooks } from './lib/contract.mjs';
import { planConfig } from './lib/ha-ws.mjs';
import { action, clickFloor, enterEditor, leaveEditor, openPlan, snap, useTool } from './lib/plan.mjs';
import { USERS } from '../scripts/users.mjs';

setup.use({ storageState: USERS.admin.storageState });

const YARD = 'smrwhw9la';
const census = (config) => config.spaces.map((s) => ({
  id: s.id, rooms: s.rooms.map((r) => r.id).sort(), openings: (s.openings || []).length, partitions: (s.partitions || []).length,
}));

setup('the seed plan reaches the current plan model through one undone edit', async ({ page }) => {
  setup.skip(seedVariant() !== 'house', 'only the house seed has a plan');
  // a product without the editor hooks has nothing that edits the plan: skipped, not failed
  requireHooks(setup, 'stage@data-grid-step', 'action');
  const before = await planConfig();
  const host = await openPlan(page, { space: YARD });
  await enterEditor(host, 'plan');
  await useTool(host, 'draw');
  const a = await snap(host, 650, 650);
  const b = await snap(host, 750, 650);
  await clickFloor(page, host, a.x, a.y);
  await clickFloor(page, host, b.x, b.y);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await planConfig()).config.spaces.find((s) => s.id === YARD).partitions?.length ?? 0)
    .toBe(1);
  await action(host, 'geometry-undo').click();
  await expect.poll(async () => (await planConfig()).config.spaces.find((s) => s.id === YARD).partitions?.length ?? 0)
    .toBe(0);
  await leaveEditor(host);
  const after = await planConfig();
  expect(after.config.model_version).toBeGreaterThanOrEqual(before.config.model_version);
  expect(census(after.config)).toEqual(census(before.config));
});
