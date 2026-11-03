// Import on a real Home Assistant (houseplan-card#1010, row 22): a «dirty»
// full ZIP and a JSON from House Plan 1.62 through the real dialog. The
// preview must name every stale reference; the import keeps the healthy plan,
// switches broken features off with their settings kept, and leaves awkward
// geometry exactly as it came; «Undo last full import» puts the previous plan
// back. Damaged and wrong files are refused and change nothing.
//
// The import preview names stale references, not geometry: self-crossing
// outlines, partitions lying on each other and nodes off the grid are kept
// as they came and not reported (findings F127) — the oracle here is that
// nothing changed them.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repairsBackups, requireHooks } from './lib/contract.mjs';
import { archive, complexPlan, CREATED_AT, dirtyPlan, oldJsonPlan, seedExport } from './lib/backup-fixtures.mjs';
import { chooseBackup, footerCancel, openMaintenance, previewReply, revisions } from './lib/backup.mjs';
import { card, evidence, expectPlanDrawn, spaceEntry } from './lib/ha-page.mjs';
import { planConfig, planLayout, wsCall } from './lib/ha-ws.mjs';
import { HP, hp } from './lib/hooks.mjs';
import { action, field, selectSpace } from './lib/plan.mjs';
import { restoreSeedAfterEach } from './lib/seed-guard.mjs';

requireHooks(test, 'action', 'field', 'settings-section', 'toast@data-id');
restoreSeedAfterEach(test);

const toast = (host, id) => host.locator(hp('toast', { id }));
const byId = (list, id) => list.find((item) => item.id === id);

test('a dirty ZIP: the preview names every problem, the import keeps the plan sound, undo brings the old plan back', async ({ page }, testInfo) => {
  const before = await planConfig();
  const beforeLayout = await planLayout();
  const plan = dirtyPlan(await seedExport());
  const zip = archive(plan);
  await testInfo.attach('dirty-plan.zip', { body: zip, contentType: 'application/zip' });
  const { expected } = plan;

  const { host, settings } = await openMaintenance(page);
  const replied = previewReply(page);
  const dialog = await chooseBackup(page, host, settings, { name: 'dirty-plan.zip', mimeType: 'application/zip', buffer: zip });
  const { preview } = await (await replied).json();
  // the integration's own report: every stale reference is counted
  expect(preview.bindings.missing).toBe(expected.missingBindings);
  expect(preview.missing_areas).toEqual(expected.missingAreas);
  const recovered = Object.fromEntries(Object.keys(expected.recovery).map((kind) => [kind,
    preview.recovery.examples.filter((row) => row.kind === kind).map((row) => row.marker_id)]));
  expect(recovered).toEqual(expected.recovery);
  expect(preview.content.filter((row) => row.state === 'missing_preserved').map((row) => row.owner_id))
    .toEqual(expected.missingPictures.map((id) => `f1:${id}`));
  expect(preview.content.filter((row) => row.state === 'external').map((row) => row.url)).toEqual(expected.external);
  expect(preview.confirmation_required).toBe(true);
  const ground = byId(plan.document.payload.config.spaces, 'f1');
  if (expected.offWall) {
    // houseplan-card#1033: the door off its wall is repaired, not a refusal
    expect(preview.opening_repairs).toEqual({
      rehosted: 0, detached: 1, legacy_detached: 0,
      examples: [{ space_id: 'f1', space_title: ground.title, opening_id: 'e2e-off-wall', type: expected.offWall.type, result: 'detached' }],
    });
    expect(preview.warnings).toContain('openings_detached');
  }

  // …and the dialog says it in words
  await expect(dialog).toContainText(`missing: ${expected.missingBindings}`);
  await expect(dialog).toContainText(`Areas missing on the target: ${expected.missingAreas.join(', ')}`);
  await expect(dialog).toContainText('The plan will be restored with repairs');
  for (const line of ['Radars needing setup: 1', 'Vacuums with a missing floor: 1', 'Removed control links: 1', 'Disabled dependent values: 1']) {
    await expect(dialog).toContainText(line);
  }
  await expect(dialog).toContainText('Incomplete backup: some images are not included');
  await expect(dialog).toContainText('Custom images: 2 objects, 2 files; missing files: 1.');
  await expect(dialog).toContainText(`${expected.external[0]} · external link`);
  if (expected.offWall) {
    await expect(dialog).toContainText('Openings kept off walls: 1. They stay where they were and cut no wall');
    await action(dialog, 'backup-openings-details').click();
    await expect(dialog).toContainText(`${ground.title} — Door (e2e-off-wall)`);
    await expect(dialog.locator('.backupconfirm')).toContainText('Openings that do not fit their walls will be kept off walls.');
    // the list at the bottom of the frame: below it the staged file names
    // of the archive change from run to run
    await action(dialog, 'backup-openings-details').evaluate((summary) => summary.parentElement.scrollIntoView({ block: 'end' }));
    await evidence(testInfo, page, 'import-dirty-openings');
    await dialog.getByText('dirty-plan.zip').scrollIntoViewIfNeeded();
  }
  const replace = dialog.locator(HP.dialogConfirm).first();
  await expect(replace).toBeDisabled();
  await field(dialog, 'backup-confirm-missing').check();
  await expect(replace).toBeEnabled();
  // the frame shows the top of the report; further down the staged file
  // names of the archive change from run to run
  await dialog.getByText('dirty-plan.zip').scrollIntoViewIfNeeded();
  await evidence(testInfo, page, 'import-dirty-preview');
  await replace.click();
  await expect(toast(host, 'backup.full_done')).toBeVisible();
  await expect(dialog).toBeHidden();

  // the healthy plan arrived; broken features are off, their settings kept
  const after = (await planConfig()).config;
  const source = plan.document.payload.config;
  expect(after.spaces.map((s) => s.id)).toEqual(source.spaces.map((s) => s.id));
  expect(after.markers.map((m) => m.id).sort()).toEqual(source.markers.map((m) => m.id).sort());
  const layout = (await planLayout()).layout;
  for (const id of ['e2e_gone_entity', 'e2e_gone_device', 'e2e_radar_kitchen', 'e2e_lamp_switch']) {
    expect(layout[id]).toMatchObject(plan.document.payload.layout[id]);
  }
  expect(byId(after.markers, 'e2e_gone_entity').binding).toBe('entity:light.e2e_gone_lamp');
  expect(byId(after.markers, 'e2e_gone_device').binding).toBe('device:00000000000000000000000000e2e0ff');
  expect(byId(after.spaces, 'smrwhw9la').rooms[0].area).toBe(expected.missingAreas[0]);
  const { enabled, ...radar } = byId(after.markers, 'e2e_radar_lost').radar;
  expect(enabled).toBe(false);
  const { enabled: wasEnabled, ...sourceRadar } = byId(source.markers, 'e2e_radar_lost').radar;
  expect(wasEnabled).toBe(true);
  expect(radar).toEqual(sourceRadar);
  const robot = byId(after.markers, 'e_vacuum_demo_robot').vacuum;
  expect(robot.live).toBe(false);
  expect(robot.map_routes).toEqual(byId(source.markers, 'e_vacuum_demo_robot').vacuum.map_routes);
  expect(robot.calibration).toEqual(byId(source.markers, 'e_vacuum_demo_robot').vacuum.calibration);
  expect(byId(after.markers, 'e2e_lamp_switch').controls).toEqual(['marker:e2e_lamp_target']);
  expect(byId(after.markers, 'e2e_badge_lost').value_badge).toEqual({ enabled: false, position: 'right', source: null });
  expect(byId(after.markers, 'e2e_radar_kitchen').radar.enabled).toBe(true);
  // the missing picture stays as a placeholder to repair, the external backdrop as a link
  expect(byId(byId(after.spaces, 'f1').decor, 'e2e-picture-lost')).toEqual(byId(byId(source.spaces, 'f1').decor, 'e2e-picture-lost'));
  expect(byId(after.spaces, 'smrwhw9la').plan_url).toBe(expected.external[0]);
  // geometry exactly as it came: nothing «optimized» without being asked
  for (const [space, ids] of Object.entries(expected.keptGeometry.partitions)) {
    for (const id of ids) expect(byId(byId(after.spaces, space).partitions, id)).toEqual(byId(byId(source.spaces, space).partitions, id));
  }
  for (const [space, ids] of Object.entries(expected.keptGeometry.rooms)) {
    for (const id of ids) expect(byId(byId(after.spaces, space).rooms, id)).toEqual(byId(byId(source.spaces, space).rooms, id));
  }
  if (expected.offWall) {
    // kept where it was, without a wall; nothing else about it changed
    const { host, ...offWall } = expected.offWall;
    expect(host).toBeTruthy();
    expect(byId(byId(after.spaces, 'f1').openings, 'e2e-off-wall')).toEqual(offWall);
  }

  await page.reload();
  const fresh = card(page);
  await expectPlanDrawn(page, fresh);
  await selectSpace(fresh, 'smrwhw9la');
  await expect(fresh.locator(hp('room', { id: 'e2e-bowtie' })).first()).toBeAttached();
  await evidence(testInfo, page, 'import-dirty-after-reload');

  // «Undo last full import»: the previous plan, exactly
  const { host: again, settings: maintenance } = await openMaintenance(page);
  await action(maintenance, 'plan-optimization-undo').click();
  await expect(toast(again, 'backup.import_undone')).toBeVisible();
  const undone = (await planConfig()).config;
  expect(undone.spaces).toEqual(before.config.spaces);
  expect(undone.markers).toEqual(before.config.markers);
  expect((await planLayout()).layout).toEqual(beforeLayout.layout);
  await page.reload();
  await expectPlanDrawn(page, card(page));
  await evidence(testInfo, page, 'import-undone');
});

test('a JSON from House Plan 1.62 on another Home Assistant is migrated to the current plan model', async ({ page }, testInfo) => {
  const { document, expected } = oldJsonPlan();
  const raw = Buffer.from(JSON.stringify(document, null, 1));
  await testInfo.attach('houseplan-1.62-full.json', { body: raw, contentType: 'application/json' });
  const { host, settings } = await openMaintenance(page);
  const replied = previewReply(page);
  const dialog = await chooseBackup(page, host, settings, { name: 'houseplan-full-2026-08-11.json', mimeType: 'application/json', buffer: raw });
  const { preview } = await (await replied).json();
  expect(preview).toMatchObject({ model_version: expected.model, source: 'foreign', confirmation_required: true });
  expect(preview.bindings.missing).toBe(expected.missingBindings);
  expect(preview.missing_areas).toEqual(expected.missingAreas);
  await expect(dialog).toContainText('Created on another Home Assistant instance');
  await expect(dialog).toContainText(`Card 1.62.0; integration 1.62.0; data model ${expected.model}`);
  await expect(dialog).toContainText(`missing: ${expected.missingBindings}`);
  await expect(dialog).toContainText(`Areas missing on the target: ${expected.missingAreas.join(', ')}`);
  // a JSON carries no files: the backdrop of another instance is detached
  await expect(dialog).toContainText('/api/houseplan/content/plans/_/first-floor.svg · will be detached');
  await field(dialog, 'backup-confirm-missing').check();
  await evidence(testInfo, page, 'import-old-json-preview');
  await dialog.locator(HP.dialogConfirm).first().click();
  await expect(toast(host, 'backup.full_done')).toBeVisible();

  const after = (await planConfig()).config;
  const ground = byId(after.spaces, 'f1');
  // migrated: rooms carry their walls as segments, legacy spans are gone
  expect(ground.wall_segments?.length).toBeGreaterThan(0);
  expect(ground.rooms.every((room) => Array.isArray(room.wall_ids) && room.wall_ids.length === room.poly.length)).toBe(true);
  expect(ground.open_spans).toBeUndefined();
  expect(byId(after.markers, 'e2e_old_gone').binding).toBe('entity:light.e2e_old_gone_lamp');
  expect(byId(after.spaces, 'f2').plan_url ?? null).toBeNull();
  expect(after.spaces.map((s) => s.rooms.length)).toEqual(document.payload.config.spaces.map((s) => s.rooms.length));
  await page.reload();
  await expectPlanDrawn(page, card(page));
  await evidence(testInfo, page, 'import-old-json-after-reload');
});

test('a space exported as JSON comes back as a new space, devices already on the plan skipped', async ({ page }, testInfo) => {
  const before = (await planConfig()).config;
  const { document } = await wsCall({ type: 'houseplan/export/create', kind: 'space', space_id: 'f1', card_version: 'e2e' });
  const raw = Buffer.from(JSON.stringify({ ...document, created_at: CREATED_AT })); // the preview shows it
  await testInfo.attach('ground-floor-space.json', { body: raw, contentType: 'application/json' });
  const { host, settings } = await openMaintenance(page);
  const replied = previewReply(page);
  const dialog = await chooseBackup(page, host, settings, { name: 'ground-floor-space.json', mimeType: 'application/json', buffer: raw });
  const { preview } = await (await replied).json();
  const owned = before.markers.filter((m) => m.space === 'f1' && m.binding !== 'virtual').length;
  expect(preview.kind).toBe('space');
  expect(preview.duplicates).toBe(owned);
  await expect(dialog).toContainText(`Bindings already present: ${owned}`);
  await expect(field(dialog, 'duplicate-policy', 'skip')).toBeChecked();
  await evidence(testInfo, page, 'import-space-preview');
  await dialog.locator(HP.dialogConfirm).first().click();
  await expect(toast(host, 'backup.space_done')).toBeVisible();

  const after = (await planConfig()).config;
  const added = after.spaces.filter((s) => !before.spaces.some((old) => old.id === s.id));
  expect(added).toHaveLength(1);
  expect(added[0].rooms.map((r) => r.name)).toEqual(byId(before.spaces, 'f1').rooms.map((r) => r.name));
  // skipped: no second marker for a binding that is already on the plan
  const bindings = after.markers.filter((m) => m.binding !== 'virtual').map((m) => m.binding);
  expect(new Set(bindings).size).toBe(bindings.length);
  await expect(spaceEntry(host, added[0].id)).toHaveCount(1);
  await selectSpace(host, added[0].id);
  await evidence(testInfo, page, 'import-space-added');
});

/** Files that must be refused, with the words the dialog refuses them in. */
function refusals(base) {
  const complex = archive(complexPlan(base));
  const png = readFileSync(resolve(import.meta.dirname, '../fixtures/images/e2e-tile.png'));
  const zeroSize = complexPlan(base);
  byId(zeroSize.document.payload.config.spaces, 'f1').decor.push({ id: 'e2e-zero', kind: 'rect', x: 0.5, y: 0.5, w: 0, h: 0.1, color: '#000000', fill: false });
  // a door off its wall: refused by products older than houseplan-card#1033,
  // repaired by newer ones (the dirty ZIP above carries it then)
  const offWall = complexPlan(base);
  const ground = byId(offWall.document.payload.config.spaces, 'f1');
  ground.openings.push({ ...JSON.parse(JSON.stringify(ground.openings[0])), id: 'e2e-off-wall', x: 0.95, y: 0.95 });
  const huge = { format: 'houseplan-export', export_version: 2, kind: 'full', padding: 'x'.repeat(8 * 1024 * 1024) };
  return [
    ['a damaged ZIP', 'damaged.zip', 'application/zip', complex.subarray(0, Math.floor(complex.length * 0.6)), 'The ZIP backup is damaged or unsupported. Choose a valid House Plan backup.'],
    ['a picture renamed .zip', 'picture.zip', 'application/zip', png, 'The ZIP backup is damaged or unsupported. Choose a valid House Plan backup.'],
    ['a picture renamed .json', 'picture.json', 'application/json', png, 'The selected file is not valid JSON.'],
    ['JSON that is not a House Plan backup', 'other.json', 'application/json', Buffer.from('{"version":1,"items":[]}'), 'The selected file is not a House Plan backup.'],
    ['JSON over the 8 MiB limit', 'huge.json', 'application/json', Buffer.from(JSON.stringify(huge)), 'The backup exceeds the 8 MiB limit.'],
    ['a shape of zero width', 'zero-size.zip', 'application/zip', archive(zeroSize), 'The backup contains an invalid House Plan configuration.'],
    ...(repairsBackups() ? [] : [['an opening off its wall', 'off-wall.json', 'application/json', Buffer.from(JSON.stringify(offWall.document)), 'The backup contains an invalid House Plan configuration.']]),
  ];
}

test('damaged, wrong and invalid files are refused and the plan stays as it was', async ({ page }, testInfo) => {
  const cases = refusals(await seedExport());
  const before = await revisions();
  const { host, settings } = await openMaintenance(page);
  let maintenance = settings;
  for (const [what, name, mimeType, buffer, message] of cases) {
    await test.step(what, async () => {
      const dialog = await chooseBackup(page, host, maintenance, { name, mimeType, buffer });
      await expect(dialog.getByRole('alert')).toContainText(message);
      await expect(dialog.locator(HP.dialogConfirm)).toHaveCount(0);
      if (what === 'a damaged ZIP') await evidence(testInfo, page, 'import-refused-damaged-zip');
      await footerCancel(dialog).click();
      await expect(dialog).toBeHidden();
      expect(await revisions(), `${what}: nothing written`).toEqual(before);
      ({ settings: maintenance } = await reopenMaintenance(host));
    });
  }
});

async function reopenMaintenance(host) {
  await host.locator(HP.settings).first().click();
  const settings = host.locator(HP.dialog('settings')).first();
  await expect(settings).toBeVisible();
  await settings.locator(hp('settings-section', { kind: 'general', section: 'data' })).first().click();
  return { settings };
}
