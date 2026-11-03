// Export on a real Home Assistant (houseplan-card#1010, row 21): the full
// ZIP of a complex plan, the current space as JSON with and without its
// devices, and a plan with problems — the export names them and offers the
// repaired, incomplete copy. The downloaded file is the oracle: it is opened
// and read, not just counted.
//
// Fixtures are code (tests/lib/backup-fixtures.mjs, fixtures/backups/README.md)
// and every one a journey used is attached to the report.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { requireHooks } from './lib/contract.mjs';
import { archive, complexPlan, dirtyPlan, PLAN, seedExport, TILE, ZIGBEE_TOPICS } from './lib/backup-fixtures.mjs';
import { byContent, exportArchive, kindField, openArchive, openMaintenance, restoreArchive } from './lib/backup.mjs';
import { evidence } from './lib/ha-page.mjs';
import { planConfig, wsCall } from './lib/ha-ws.mjs';
import { HP, hp } from './lib/hooks.mjs';
import { action, field } from './lib/plan.mjs';
import { restoreSeedAfterEach } from './lib/seed-guard.mjs';

requireHooks(test, 'action', 'field', 'settings-section', 'toast@data-id');
restoreSeedAfterEach(test);

async function openExport(page) {
  const { host, settings } = await openMaintenance(page);
  await action(settings, 'backup-export-open').click();
  const dialog = host.locator(HP.dialog('backup')).first();
  await expect(dialog).toBeVisible();
  return { host, dialog };
}

async function download(page, button) {
  const downloading = page.waitForEvent('download');
  await button.click();
  const file = await downloading;
  return { name: file.suggestedFilename(), bytes: readFileSync(await file.path()) };
}

const imageOf = (opened, kind, ownerId) => {
  const row = opened.manifest.images.find((r) => r.ref.kind === kind && r.ref.owner_id === ownerId);
  return row?.blob ? opened.entries[row.blob] : null;
};

test('a complex plan exports as a complete ZIP with its backdrop, pictures and Zigbee snapshot', async ({ page }, testInfo) => {
  const plan = complexPlan(await seedExport());
  const fixture = archive(plan);
  await testInfo.attach('complex-plan.zip', { body: fixture, contentType: 'application/zip' });
  // nothing in the complex plan is broken: its preview has nothing to report
  const { preview } = await restoreArchive(fixture);
  expect(preview.recovery?.total ?? 0).toBe(0);
  expect(preview.bindings.missing).toBe(0);
  expect(preview.missing_areas).toEqual([]);
  expect(preview.confirmation_required).toBe(false);
  expect(preview.content.map((row) => [row.kind, row.state])).toEqual([['plan', 'available'], ['decor_asset', 'available']]);
  expect(preview.archive).toMatchObject({ complete: true, missing: [] });
  expect(preview.counts.stairs).toBe(2);

  const { host, dialog } = await openExport(page);
  await expect(kindField(dialog, 'full')).toBeChecked();
  await evidence(testInfo, page, 'export-full-dialog');
  const file = await download(page, dialog.locator(HP.dialogConfirm).first());
  await expect(host.locator(hp('toast', { id: 'backup.export_done' }))).toBeVisible();
  await testInfo.attach(file.name, { body: file.bytes, contentType: 'application/zip' });
  expect(file.name).toMatch(/^houseplan-full-[\d_-]+\.zip$/);

  const exported = openArchive(file.bytes);
  expect(exported.manifest.complete).toBe(true);
  expect(Object.keys(exported.entries).sort()).toEqual([
    'document.json', 'manifest.json', 'zigbee.json',
    ...Object.keys(exported.manifest.blobs),
  ].sort());
  // the backdrop and the picture travel as their own bytes, the snapshot as saved
  expect(imageOf(exported, 'plan', 'f2')?.equals(PLAN)).toBe(true);
  expect(imageOf(exported, 'decor_asset', 'f1:e2e-picture')?.equals(TILE)).toBe(true);
  expect(exported.topics).toEqual(ZIGBEE_TOPICS);
  // the plan in it is the plan that was restored: floors, stairs, radar, robot
  const config = exported.document.payload.config;
  const source = plan.document.payload.config;
  expect(config.spaces.map((s) => s.id)).toEqual(source.spaces.map((s) => s.id));
  for (const id of ['f1', 'f2']) {
    expect(config.spaces.find((s) => s.id === id).stairs).toEqual(source.spaces.find((s) => s.id === id).stairs);
  }
  const marker = (c, id) => c.markers.find((m) => m.id === id);
  expect(marker(config, 'e2e_radar_kitchen').radar).toEqual(marker(source, 'e2e_radar_kitchen').radar);
  expect(marker(config, 'e_vacuum_demo_robot').vacuum).toEqual(marker(source, 'e_vacuum_demo_robot').vacuum);
  expect(marker(config, 'e2e_lamp_switch').controls).toEqual(['marker:e2e_lamp_target']);
  expect(config.markers.map((m) => m.id).sort()).toEqual(source.markers.map((m) => m.id).sort());

  // the same plan as a full JSON: the document of the ZIP, without the bytes
  const json = await wsCall({ type: 'houseplan/export/create', kind: 'full', card_version: 'e2e' });
  expect(json.document.payload.config.markers).toEqual(config.markers);

  // idempotent: the exported ZIP restored and exported again is the same plan
  await restoreArchive(file.bytes);
  const again = await exportArchive();
  expect(again.manifest.complete).toBe(true);
  expect(again.prepared.recovery ?? null).toBeNull();
  expect(byContent(again)).toEqual(byContent(exported));
  expect(again.topics).toEqual(ZIGBEE_TOPICS);
});

test('the current space exports as JSON, and as its plan only', async ({ page }, testInfo) => {
  const stored = (await planConfig()).config;
  const ground = stored.spaces.find((s) => s.id === 'f1');
  let { host, dialog } = await openExport(page);
  await kindField(dialog, 'space').check();
  await expect(field(dialog, 'backup-plan-only')).not.toBeChecked();
  await evidence(testInfo, page, 'export-space-dialog');
  const space = await download(page, dialog.locator(HP.dialogConfirm).first());
  await testInfo.attach(space.name, { body: space.bytes, contentType: 'application/json' });
  expect(space.name).toMatch(/^houseplan-space-Ground-Floor-[\d_-]+\.json$/);
  const doc = JSON.parse(space.bytes);
  expect(doc).toMatchObject({ format: 'houseplan-export', kind: 'space' });
  expect(doc.payload.config.spaces.map((s) => s.id)).toEqual(['f1']);
  expect(doc.payload.config.spaces[0].rooms).toEqual(ground.rooms);
  const owned = stored.markers.filter((m) => m.space === 'f1').map((m) => m.id).sort();
  expect(doc.payload.config.markers.map((m) => m.id).sort()).toEqual(owned);
  expect(doc.transfer.plan_only ?? false).toBe(false);

  ({ dialog } = await openExport(page));
  await kindField(dialog, 'space').check();
  await field(dialog, 'backup-plan-only').check();
  await evidence(testInfo, page, 'export-plan-only-dialog');
  const planOnly = await download(page, dialog.locator(HP.dialogConfirm).first());
  await testInfo.attach(planOnly.name, { body: planOnly.bytes, contentType: 'application/json' });
  const bare = JSON.parse(planOnly.bytes);
  expect(bare.transfer.plan_only).toBe(true);
  expect(bare.payload.config.markers).toEqual([]);
  expect(bare.payload.config.spaces[0].rooms.map((r) => r.id)).toEqual(ground.rooms.map((r) => r.id));
  // no device positions travel: only room-label positions
  const roomIds = new Set(ground.rooms.map((r) => r.id));
  for (const key of Object.keys(bare.payload.layout)) expect(owned).not.toContain(key);
  expect(Object.keys(bare.payload.layout).length).toBeLessThanOrEqual(roomIds.size);
  await expect(host.locator(hp('toast', { id: 'backup.export_done' }))).toBeVisible();
});

test('a plan with problems: the export names them and gives the repaired, incomplete copy', async ({ page }, testInfo) => {
  const plan = dirtyPlan(await seedExport());
  const fixture = archive(plan);
  await testInfo.attach('dirty-plan.zip', { body: fixture, contentType: 'application/zip' });
  await restoreArchive(fixture, { confirm: true });

  const { dialog } = await openExport(page);
  const confirm = dialog.locator(HP.dialogConfirm).first();
  // the first click prepares the archive and reports instead of downloading
  await confirm.click();
  await expect(dialog).toContainText('The backup is ready with repairs');
  await expect(dialog).toContainText('Radars needing setup: 1');
  await expect(dialog).toContainText('Vacuums with a missing floor: 1');
  await expect(dialog).toContainText('Incomplete backup: some images are not included');
  await expect(dialog).toContainText('Images not included: 2');
  await expect(confirm).toContainText('Download repaired backup');
  await dialog.getByText('Images not included: 2').click();
  await dialog.getByText('Show devices').click();
  await expect(dialog).toContainText('Lost radar');
  await expect(dialog).toContainText('Robot Vacuum');
  await expect(dialog).toContainText('Ground Floor — File not found; upload the image again');
  await expect(dialog).toContainText('Yard — External link; image bytes are not included');
  await evidence(testInfo, page, 'export-report');

  const file = await download(page, confirm);
  await testInfo.attach(file.name, { body: file.bytes, contentType: 'application/zip' });
  expect(file.name).toMatch(/-incomplete\.zip$/);
  const exported = openArchive(file.bytes);
  expect(exported.manifest.complete).toBe(false);
  const reasons = Object.fromEntries(exported.manifest.images.filter((r) => r.reason).map((r) => [r.ref.owner_id, r.reason]));
  expect(reasons).toEqual({ 'f1:e2e-picture-lost': 'missing', smrwhw9la: 'external' });
  // the copy keeps the switched-off features with their settings, as the plan does
  const markers = exported.document.payload.config.markers;
  const radar = markers.find((m) => m.id === 'e2e_radar_lost').radar;
  expect(radar).toMatchObject({ enabled: false, room_id: 'e2e_gone_room', mount: { installation_id: 'e2e-radar-lost' } });
  const robot = markers.find((m) => m.id === 'e_vacuum_demo_robot').vacuum;
  expect(robot.live).toBe(false);
  expect(robot.map_routes.map((r) => r.space)).toEqual(['f1', 'e2e_gone_space']);
});
