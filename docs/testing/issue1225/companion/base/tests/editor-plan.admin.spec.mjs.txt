// Plan editor on a real Home Assistant (houseplan-card#1010, rows 4–6, 13, 16):
// walls drawn by real clicks become a room, a room is deleted and created
// again in the same walls, a room is resized by its wall, a wall node is
// dragged, a zero-thickness wall is drawn. The oracle is the document the
// integration returns after the edit, then the plan after a page reload.
import { test, expect } from '@playwright/test';
import { installedRecord, requireHooks } from './lib/contract.mjs';
import { compareTags } from '../scripts/tags.mjs';
import { evidence, expectPlanDrawn, card } from './lib/ha-page.mjs';
import { planConfig, spaceOf, waitForConfig } from './lib/ha-ws.mjs';
import { HP, hp } from './lib/hooks.mjs';
import {
  centreOf, clickFloor, dragClient, dragFloor, enterEditor, field, leaveEditor, openPlan, selectSpace,
  settle, snap, toClient, useTool,
} from './lib/plan.mjs';
import { restoreSeedAfterEach } from './lib/seed-guard.mjs';

requireHooks(test, 'stage@data-grid-step', 'mode-tab', 'field', 'action', 'wall-node', 'room-resize');
restoreSeedAfterEach(test);

const GROUND = 'f1';
const YARD = 'smrwhw9la';
const U = 1000; // stored geometry is 0…1, the stage viewBox is the same × 1000
const roomNamed = (space, name) => space.rooms.find((r) => r.name === name);
const vertexKey = ([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`;
const sameOutline = (a, b) => new Set(a.map(vertexKey)).size === new Set(b.map(vertexKey)).size
  && a.every((v) => b.some((w) => vertexKey(v) === vertexKey(w)));
const roomDialog = (host) => host.locator(HP.dialog('room')).first();
const confirmNamed = (dialog, name) => dialog.locator(HP.dialogConfirm).filter({ hasText: name }).first();

/** Draw a closed rectangle with the Walls tool; the room dialog opens. */
async function drawRectangle(page, host, [x0, y0, x1, y1]) {
  await useTool(host, 'draw');
  const corners = [];
  for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) corners.push(await snap(host, x, y));
  for (const c of [...corners, corners[0]]) await clickFloor(page, host, c.x, c.y);
  return corners.map((c) => [c.x / U, c.y / U]);
}

test('walls drawn into a closed contour become a saved room', async ({ page }, testInfo) => {
  const host = await openPlan(page, { space: YARD });
  await evidence(testInfo, page, 'walls-before');
  await enterEditor(host, 'plan');
  const outline = await drawRectangle(page, host, [600, 200, 800, 400]);

  const dialog = roomDialog(host);
  await expect(dialog).toBeVisible();
  await field(dialog, 'room-name').fill('E2E Shed');
  await evidence(testInfo, page, 'walls-room-dialog');
  await confirmNamed(dialog, /save room/i).click();
  await expect(dialog).toBeHidden();
  await evidence(testInfo, page, 'walls-room-saved');

  const config = await waitForConfig((c) => !!roomNamed(spaceOf(c, YARD), 'E2E Shed'), { message: 'room E2E Shed on the server' });
  const yard = spaceOf(config, YARD);
  expect(sameOutline(roomNamed(yard, 'E2E Shed').poly, outline)).toBe(true);
  expect(yard.rooms).toHaveLength(2);

  await leaveEditor(host);
  await page.reload();
  const again = card(page);
  await expectPlanDrawn(page, again);
  await selectSpace(again, YARD);
  const shedId = roomNamed(yard, 'E2E Shed').id;
  await expect(again.locator(hp('room-label', { id: shedId }))).toContainText('E2E Shed');
  await evidence(testInfo, page, 'walls-after-reload');
});

test('a room deleted with its walls kept is created again in the same walls', async ({ page }, testInfo) => {
  const before = spaceOf((await planConfig()).config, GROUND);
  const sauna = roomNamed(before, 'Sauna');
  const centre = sauna.poly.reduce((a, [x, y]) => [a[0] + (x * U) / sauna.poly.length, a[1] + (y * U) / sauna.poly.length], [0, 0]);
  const host = await openPlan(page, { space: GROUND });
  await enterEditor(host, 'plan');
  await evidence(testInfo, page, 'room-delete-before');

  await useTool(host, 'rooms');
  await useTool(host, 'delete-room');
  await clickFloor(page, host, centre[0], centre[1]);
  const confirm = host.locator(HP.dialogConfirm).filter({ hasText: /delete room, keep walls/i }).first();
  await expect(confirm).toBeVisible();
  await confirm.click();
  const deleted = spaceOf(await waitForConfig((c) => !roomNamed(spaceOf(c, GROUND), 'Sauna'), { message: 'Sauna deleted on the server' }), GROUND);
  expect(deleted.rooms).toHaveLength(before.rooms.length - 1);
  expect(deleted.openings).toHaveLength(before.openings.length);
  await evidence(testInfo, page, 'room-deleted');

  // #1176 changes an existing action without a new DOM hook. Keep the previous
  // stable's Walls entry for historical runs; the beta.2 candidate uses Select.
  const version = installedRecord()?.version;
  const selectCandidates = !version || compareTags('v' + version, 'v1.84.0-beta.2') >= 0;
  if (selectCandidates) {
    await useTool(host, 'draw');
    await clickFloor(page, host, centre[0], centre[1]);
    await expect(roomDialog(host)).toBeHidden();
    const width = (Math.max(...sauna.poly.map(([x]) => x)) - Math.min(...sauna.poly.map(([x]) => x))) * U;
    const end = await snap(host, centre[0] + width / 4, centre[1]);
    await clickFloor(page, host, end.x, end.y);
    await expect(roomDialog(host)).toBeHidden();
    await waitForConfig(c => (spaceOf(c, GROUND).partitions || []).length === (deleted.partitions || []).length + 1,
      { message: 'Walls draws a real saved segment inside the free contour' });
    await host.locator(HP.action('geometry-undo')).click();
    await page.keyboard.press('Escape');
    const undone = spaceOf(await waitForConfig(c => (spaceOf(c, GROUND).partitions || []).length === (deleted.partitions || []).length,
      { message: 'temporary inside wall undone on the server' }), GROUND);
    expect(undone.partitions || []).toEqual(deleted.partitions || []);
    expect(undone.rooms).toEqual(deleted.rooms);
    await evidence(testInfo, page, 'walls-inside-free-contour-undone');
  }
  await useTool(host, selectCandidates ? 'select' : 'draw');
  await clickFloor(page, host, centre[0], centre[1]);
  const dialog = roomDialog(host);
  await expect(dialog).toBeVisible();
  await field(dialog, 'room-name').fill('Sauna');
  await confirmNamed(dialog, /save room/i).click();
  await expect(dialog).toBeHidden();

  const recreated = spaceOf(await waitForConfig((c) => !!roomNamed(spaceOf(c, GROUND), 'Sauna'), { message: 'Sauna created again' }), GROUND);
  expect(sameOutline(roomNamed(recreated, 'Sauna').poly, sauna.poly)).toBe(true);
  // the same walls, not a second set; the same openings, not duplicates:
  // the walls kept as independent ones after the deletion are absorbed back
  expect(recreated.rooms).toHaveLength(before.rooms.length);
  expect(recreated.openings).toHaveLength(before.openings.length);
  expect((recreated.partitions || []).length).toBe((before.partitions || []).length);
  expect((recreated.walls || []).length).toBe((before.walls || []).length);
  // the wall model itself: the same segments, none doubled under the new room
  const segments = (space) => (space.wall_segments || []).map((w) => [w.a, w.b].map((p) => p.map((v) => v.toFixed(6)).join(',')).sort().join('|')).sort();
  expect(segments(recreated)).toEqual(segments(before));
  await leaveEditor(host);
  await page.reload();
  await expectPlanDrawn(page, card(page));
  await expect(card(page).locator(hp('room-label', { id: roomNamed(recreated, 'Sauna').id }))).toContainText('Sauna');
  await evidence(testInfo, page, 'room-recreated-after-reload');
});

test('a room is resized by dragging its wall', async ({ page }, testInfo) => {
  const yard = roomNamed(spaceOf((await planConfig()).config, YARD), 'Yard');
  const host = await openPlan(page, { space: YARD });
  await enterEditor(host, 'plan');
  await useTool(host, 'rooms');
  await useTool(host, 'resize');
  await settle(host);
  await evidence(testInfo, page, 'resize-before');

  // the right edge of the Yard rectangle: the vertical edge with the larger x
  const maxX = Math.max(...yard.poly.map(([x]) => x));
  const edge = yard.poly.findIndex(([x], i) => x === maxX && yard.poly[(i + 1) % yard.poly.length][0] === maxX);
  expect(edge).toBeGreaterThanOrEqual(0);
  const handle = host.locator(hp('room-resize', { room: yard.id, edge: String(edge) })).first();
  await expect(handle).toBeVisible();
  await expect(handle).not.toHaveAttribute('aria-disabled', 'true');
  const step = Number(await host.locator(hp('stage')).first().getAttribute('data-grid-step'));
  const from = await centreOf(handle);
  const target = await toClient(host, maxX * U + 6 * step, 0);
  await dragClient(page, from, { x: target.x, y: from.y });

  const resized = await waitForConfig((c) => {
    const r = roomNamed(spaceOf(c, YARD), 'Yard');
    return Math.max(...r.poly.map(([x]) => x)) > maxX + 1e-6;
  }, { message: 'Yard wider on the server' });
  const newMax = Math.max(...roomNamed(spaceOf(resized, YARD), 'Yard').poly.map(([x]) => x));
  expect(newMax * U).toBeCloseTo(maxX * U + 6 * step, 3);
  await evidence(testInfo, page, 'resize-after');

  // after a reload the room is drawn to its new edge
  await leaveEditor(host);
  const fresh = await openPlan(page, { space: YARD });
  const box = await fresh.locator(hp('room', { id: yard.id })).first().boundingBox();
  const edgeAt = await toClient(fresh, newMax * U, 0);
  expect(Math.abs(box.x + box.width - edgeAt.x)).toBeLessThan(4);
  await evidence(testInfo, page, 'resize-after-reload');
});

test('a wall node is dragged to a new point', async ({ page }, testInfo) => {
  const host = await openPlan(page, { space: YARD });
  await enterEditor(host, 'plan');
  // a free-standing wall to move: two clicks, Esc finishes the chain
  await useTool(host, 'draw');
  const a = await snap(host, 620, 560);
  const b = await snap(host, 760, 560);
  await clickFloor(page, host, a.x, a.y);
  await clickFloor(page, host, b.x, b.y);
  await page.keyboard.press('Escape');
  await waitForConfig((c) => (spaceOf(c, YARD).partitions || []).length === 1, { message: 'free wall saved' });
  await useTool(host, 'select');
  await settle(host);
  await evidence(testInfo, page, 'node-before');

  const nodeKey = (p) => `${(p.x / U).toFixed(9)},${(p.y / U).toFixed(9)}`;
  const end = host.locator(hp('wall-node', { node: nodeKey(b) })).first();
  await expect(end).toBeVisible();
  const to = await snap(host, b.x, b.y - 80);
  await dragClient(page, await centreOf(end), await toClient(host, to.x, to.y));

  const moved = await waitForConfig((c) => {
    const p = (spaceOf(c, YARD).partitions || [])[0];
    return p && [p.a, p.b].some(([x, y]) => Math.abs(x * U - to.x) < 1e-3 && Math.abs(y * U - to.y) < 1e-3);
  }, { message: 'wall end at the new point on the server' });
  const wall = spaceOf(moved, YARD).partitions[0];
  expect([wall.a, wall.b].some(([x, y]) => Math.abs(x * U - a.x) < 1e-3 && Math.abs(y * U - a.y) < 1e-3)).toBe(true);
  await evidence(testInfo, page, 'node-after');

  // after a reload the wall's end is at the new point, not at the old one
  await leaveEditor(host);
  const fresh = await openPlan(page, { space: YARD });
  await enterEditor(fresh, 'plan');
  await useTool(fresh, 'select');
  await settle(fresh);
  await expect(fresh.locator(hp('wall-node', { node: nodeKey(to) })).first()).toBeVisible();
  await expect(fresh.locator(hp('wall-node', { node: nodeKey(b) }))).toHaveCount(0);
  await expect(fresh.locator(hp('wall-node', { node: nodeKey(a) })).first()).toBeVisible();
  await evidence(testInfo, page, 'node-after-reload');
});

test('a zero-thickness wall is drawn and kept as an axis without a body', async ({ page }, testInfo) => {
  const host = await openPlan(page, { space: YARD });
  await enterEditor(host, 'plan');
  await useTool(host, 'draw');
  const thickness = field(host, 'wall-thickness');
  await thickness.fill('0');
  await thickness.press('Enter');
  const a = await snap(host, 620, 480);
  const b = await snap(host, 780, 480);
  await clickFloor(page, host, a.x, a.y);
  await clickFloor(page, host, b.x, b.y);
  await page.keyboard.press('Escape');
  const config = await waitForConfig((c) => (spaceOf(c, YARD).partitions || []).length === 1, { message: 'zero wall saved' });
  const wall = spaceOf(config, YARD).partitions[0];
  expect(wall.cm).toBe(0);
  // an axis without a body: the editor draws it as a line, a thick wall as a path
  const axis = (owner) => owner.locator(`line${hp('partition', { id: wall.id })}`);
  const body = (owner) => owner.locator(`path${hp('partition', { id: wall.id })}`);
  await expect(axis(host)).toHaveCount(1);
  await expect(body(host)).toHaveCount(0);
  await leaveEditor(host);
  await evidence(testInfo, page, 'zero-wall-view');

  const fresh = await openPlan(page, { space: YARD });
  expect(spaceOf((await planConfig()).config, YARD).partitions[0]).toMatchObject({ id: wall.id, cm: 0 });
  await evidence(testInfo, page, 'zero-wall-after-reload');
  await enterEditor(fresh, 'plan');
  await expect(axis(fresh)).toHaveCount(1);
  await expect(body(fresh)).toHaveCount(0);
});
