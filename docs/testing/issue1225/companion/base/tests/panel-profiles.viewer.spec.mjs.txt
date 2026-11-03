// #1113: deleted profile identity stays deleted for an actual HA read-only user.
import { test, expect } from '@playwright/test';
import { hasBeta5UiPolishContract } from './lib/panel-release-contract.mjs';
import { requireHooks } from './lib/contract.mjs';
import { hp, HP } from './lib/hooks.mjs';
import { card, expectPlanDrawn, evidence } from './lib/ha-page.mjs';
import { planConfig, wsCall } from './lib/ha-ws.mjs';
import { PROFILE_HOOKS, ProfileFixture, profileOf, profileNamespace, profileWire, openProfile,
  expectFloor, profileSettings, profileEditButton, chooseProfileField, finishProfile, saveProfileSettings,
  expectSizes, planConfigForViewer, attachProfileReceipt } from './lib/panel-profiles.mjs';

requireHooks(test, ...PROFILE_HOOKS);
let fixture;
test.beforeEach(async () => { fixture = new ProfileFixture(); await fixture.setup(); await fixture.readOnlyViewer(); });
test.afterEach(async ({ page }) => { await fixture?.cleanup(page); fixture = null; });

test('deletion falls back live, new IDs never capture the old URL, and the screen stays read-only', async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const viewerWire = await profileWire(page), host = await openProfile(page, fixture.id);
  await viewerWire.ready();
  await expectFloor(host, fixture, 'f2');
  await expect(host.locator(hp('summary-panel'))).toBeVisible();
  const sameHost = await host.elementHandle();
  const context = await fixture.context(browser, 'admin'), adminPage = await context.newPage();
  const adminWire = await profileWire(adminPage);
  let { dialog } = await profileSettings(adminPage);
  // Buttons have no profile data-id: locate the same row by its declared
  // Edit hook's accessible Screen N name, then use that row's Delete button.
  const edit = profileEditButton(dialog, fixture.id);
  const row = edit.locator('..');
  await expect(row).toHaveAttribute('role', 'listitem');
  await row.locator(hp('external-screen-delete')).click();
  await saveProfileSettings(dialog, adminWire);
  await expect.poll(async () => profileOf((await planConfig()).config, fixture.id) ?? null).toBe(null);
  await expect(host.locator(hp('summary-panel'))).toBeHidden();
  await expectSizes(page, host, 100, 100, false);
  if(hasBeta5UiPolishContract()) await expect(host.locator(hp('summary-toggle'))).toHaveCount(0);
  else await expect(host.locator(hp('summary-toggle'))).toBeVisible();
  expect(await sameHost.evaluate(element => element.isConnected)).toBe(true);
  const afterDelete = await planConfig(), allocated = profileNamespace(afterDelete.config).next_id;
  expect(allocated).toBeGreaterThan(fixture.id);
  fixture.ownProfile(allocated); // Own only the exact ID this native draft will allocate.

  ({ dialog } = await profileSettings(adminPage));
  await dialog.locator(hp('external-screen-add')).click();
  const child = card(adminPage).locator(HP.dialog('external-screen-constructor')).first();
  await expect(child).toBeVisible();
  for (const [field, value] of [['space', 'f2'], ['rotation', 270], ['summary', 'show'],
    ['icon_scale', 2.5], ['font_scale', 2], ['controls', false]]) await chooseProfileField(child, field, value);
  await finishProfile(child);
  await saveProfileSettings(dialog, adminWire);
  const stored = (await planConfig()).config;
  expect(profileOf(stored, fixture.id)).toBeUndefined();
  expect(profileOf(stored, allocated)).toMatchObject({ id: allocated, space: 'f2', rotation: 270,
    summary: 'show', icon_scale: 2.5, font_scale: 2 });
  expect(profileNamespace(stored).next_id).toBe(allocated + 1);
  await viewerWire.settle();
  // The already-open URL still means no profile after a new one is allocated.
  await expect(host.locator(hp('summary-panel'))).toBeHidden();
  await expectSizes(page, host, 100, 100, false);
  expect(new URL(page.url()).searchParams.get('hpprofile')).toBe(String(fixture.id));
  const current = await planConfigForViewer();
  expect(current.can_write).toBe(false);
  await expect(host.locator(hp('settings'))).toHaveCount(0);
  await expect(host.locator(hp('mode-tab'))).toHaveCount(0);
  // #1132 removes all kiosk controls. Exercise the unchanged read-only local
  // preference surface on ordinary View, then restore the deleted-profile URL.
  if(hasBeta5UiPolishContract()) {
    await expect(host.locator(hp('summary-settings'))).toHaveCount(0);
    await page.goto('/houseplan');await expectPlanDrawn(page,host);
  }
  // On older versions a deleted profile falls back to kiosk controls. Read-only users
  // may change their local summary visibility, but cannot edit shared content.
  const localWrites = viewerWire.receipt.commands.filter(command => command.type === 'houseplan/config/set').length;
  await host.locator(hp('summary-settings')).click();
  const localDialog = host.locator(HP.dialog('summary')).first();
  await expect(localDialog).toBeVisible();
  await expect(localDialog.getByText('You can change settings for this card. Shared panel contents are managed by an administrator.', { exact: true })).toBeVisible();
  await expect(localDialog.getByRole('textbox')).toHaveCount(0);
  await expect(localDialog.getByRole('checkbox')).toHaveCount(1);
  await expect(localDialog.getByRole('button', { name: /add block|add value/i })).toHaveCount(0);
  const localShow = localDialog.getByRole('checkbox', { name: 'Show panel on this card', exact: true });
  await expect(localShow).not.toBeChecked();
  await localShow.check();
  await localDialog.locator(HP.dialogConfirm).first().click();
  await expect(localDialog).toBeHidden();
  await expect(host.locator(hp('summary-panel'))).toBeVisible();
  await host.locator(hp('summary-settings')).click();
  await expect(localDialog).toBeVisible();
  await localShow.uncheck();
  await localDialog.locator(HP.dialogConfirm).first().click();
  await expect(localDialog).toBeHidden();
  await expect(host.locator(hp('summary-panel'))).toBeHidden();
  await viewerWire.settle();
  expect(viewerWire.receipt.commands.filter(command => command.type === 'houseplan/config/set')).toHaveLength(localWrites);
  expect((await planConfig()).config).toEqual(current.config);
  await expect(wsCall({ type: 'houseplan/config/set', config: current.config, expected_rev: current.rev }, 'viewer'))
    .rejects.toMatchObject({ code: 'unauthorized' });
  expect(profileNamespace((await planConfig()).config)).toEqual(profileNamespace(stored));

  if(hasBeta5UiPolishContract()) await page.goto(`/houseplan?hpprofile=${fixture.id}`);
  await page.reload(); await expectPlanDrawn(page, card(page));
  await expectFloor(card(page), fixture, 'f1');
  await expectSizes(page, card(page), 100, 100, false);
  // Positive neighbour: only the freshly allocated ID selects its new values.
  const fresh = await openProfile(page, allocated);
  await expectFloor(fresh, fixture, 'f2'); await expectSizes(page, fresh, 250, 200);
  await expect(fresh.locator(hp('summary-panel'))).toBeVisible();
  await evidence(testInfo, page, 'readonly-new-profile-new-identity');
  await attachProfileReceipt(testInfo, 'delete-create-admin-real-ws.json', adminWire);
  await attachProfileReceipt(testInfo, 'deleted-id-viewer-real-ws.json', viewerWire);
});
