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
import { planConfig, waitForConfig } from './lib/ha-ws.mjs';
import { action, clickFloor, enterEditor, leaveEditor, openPlan, stage, gridStep, useTool } from './lib/plan.mjs';
import { visiblePlanSegment } from './lib/visible-plan-target.mjs';
import { USERS } from '../scripts/users.mjs';

setup.use({ storageState: USERS.admin.storageState });

const YARD = 'smrwhw9la';
const census = (config) => config.spaces.map((s) => ({
  id: s.id, rooms: s.rooms.map((r) => r.id).sort(), openings: (s.openings || []).length, partitions: (s.partitions || []).length,
}));

setup('the seed plan reaches the current plan model through one undone edit', async ({ page }, testInfo) => {
  setup.skip(seedVariant() !== 'house', 'only the house seed has a plan');
  // a product without the editor hooks has nothing that edits the plan: skipped, not failed
  requireHooks(setup, 'stage@data-grid-step', 'action');
  const before = await planConfig();
  const host = await openPlan(page, { space: YARD });
  await enterEditor(host, 'plan');
  await useTool(host, 'draw');
  const witness = await stage(host).evaluate(visiblePlanSegment, { step: await gridStep(host) });
  await testInfo.attach('native-migration-targets.json', { body: JSON.stringify(witness, null, 2), contentType: 'application/json' });
  const { a, b } = witness;
  const originalCount = before.config.spaces.find(s => s.id === YARD).partitions?.length ?? 0;
  await clickFloor(page, host, a.x, a.y);
  await clickFloor(page, host, b.x, b.y);
  await page.keyboard.press('Escape');
  await waitForConfig(config => (config.spaces.find(s => s.id === YARD).partitions?.length ?? 0) === originalCount + 1,
    { message: 'visible native migration segment is committed by HA' });
  const committed = await planConfig();
  expect(committed.rev).toBeGreaterThan(before.rev);
  const undo = action(host, 'geometry-undo'); await expect(undo).toBeEnabled(); await undo.click();
  await waitForConfig(config => (config.spaces.find(s => s.id === YARD).partitions?.length ?? 0) === originalCount,
    { message: 'native Undo is accepted by HA' });
  const undone = await planConfig();
  expect(undone.rev).toBeGreaterThan(committed.rev);
  await leaveEditor(host);
  const after = await planConfig();
  expect(after.config.model_version).toBeGreaterThanOrEqual(before.config.model_version);
  expect(census(after.config)).toEqual(census(before.config));
});
