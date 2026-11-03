// #1113: native profile UI and actual HA persistence/stream adoption.
import { test, expect } from '@playwright/test';
import { hasBeta5UiPolishContract } from './lib/panel-release-contract.mjs';
import { requireHooks } from './lib/contract.mjs';
import { hp, HP } from './lib/hooks.mjs';
import { card, evidence, expectPlanDrawn } from './lib/ha-page.mjs';
import { selectSpace } from './lib/plan.mjs';
import { planConfig } from './lib/ha-ws.mjs';
import { PROFILE_HOOKS, ProfileFixture, HIDDEN_MARKER, profileOf, profileWire, openProfile,
  expectFloor, profileSettings, editProfile, chooseProfileField, finishProfile, saveProfileSettings,
  expectSizes, setLocalSizes, planDirection, expectQuarterTurn, withoutProfiles, changedPaths, attachProfileReceipt } from './lib/panel-profiles.mjs';

requireHooks(test, ...PROFILE_HOOKS);
let fixture;
test.beforeEach(async () => { fixture = new ProfileFixture(); await fixture.setup(); });
test.afterEach(async ({ page }) => { await fixture?.cleanup(page); fixture = null; });

test('a cold saved profile opens its floor, rotation, sizes and display defaults', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const context = await fixture.context(browser, 'admin', { authOnly: true }), page = await context.newPage();
  const wire = await profileWire(page);
  let host = await openProfile(page, fixture.id, hasBeta5UiPolishContract()?'hpkiosk=0&hpcontrols=1':'hpkiosk=0');
  await expectFloor(host, fixture, 'f2');
  const profileAngle = await planDirection(host, fixture.rooms.f2[0]);
  await expect(host.locator(hp('summary-panel'))).toBeVisible();
  await expect(host.locator(hp('device', { id: HIDDEN_MARKER }))).toBeVisible();
  await expect(host.locator(hp('summary-toggle'))).toHaveCount(0);
  await expect(host.locator(hp('summary-settings'))).toHaveCount(0);
  // A kiosk header may be omitted or CSS-hidden; its editors stay unavailable.
  // Assert user-visible/editor accessibility, rather than DOM removal.
  const hiddenModes = host.locator(hp('mode-tab'));
  for (const mode of await hiddenModes.all()) await expect(mode).toBeHidden();
  await expect(host.getByRole('button', { name: /^(Plan|Device|Background) editor$/ })).toHaveCount(0);
  await expectSizes(page, host, 175, 150);
  expect(new URL(page.url()).searchParams.get('hpprofile')).toBe(String(fixture.id));
  await evidence(testInfo, page, 'cold-server-profile');
  // Visible floor-plane positive neighbour; no private rotation attribute.
  host = await openProfile(page, fixture.id, 'hprotate=0');
  await expectFloor(host, fixture, 'f2');
  const zeroAngle = await planDirection(host, fixture.rooms.f2[0]);
  await testInfo.attach('cold-profile-plan-angles.json', { body: JSON.stringify({
    roomId: fixture.rooms.f2[0], zeroAngle, profileAngle,
  }), contentType: 'application/json' });
  expectQuarterTurn(zeroAngle, profileAngle);
  expect(profileOf((await planConfig()).config, fixture.id)).toEqual(fixture.profile);
  expect(wire.receipt.commands.filter(command => command.type === 'houseplan/config/set')).toHaveLength(0);
  await attachProfileReceipt(testInfo, 'cold-profile-real-ws.json', wire);
});
test('a native admin Save reaches a real read-only screen live with zero extra config GETs', async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  await fixture.readOnlyViewer();
  const adminWire = await profileWire(page);
  // A genuine edit of an owned secondary profile materializes ordinary
  // General-settings defaults before the measured read-only viewer connects.
  // A disabled no-op Save can still compare a normalized draft/base equally.
  let { dialog } = await profileSettings(page);
  const preparation = await editProfile(dialog, fixture.localId);
  await chooseProfileField(preparation, 'rotation', 90);
  await finishProfile(preparation);
  await saveProfileSettings(dialog, adminWire);
  await adminWire.settle();
  const prepared = await planConfig();
  expect(profileOf(prepared.config, fixture.id)).toEqual(fixture.profile);
  expect(profileOf(prepared.config, fixture.localId).rotation).toBe(90);
  const context = await fixture.context(browser, 'viewer'), viewerPage = await context.newPage();
  const viewerWire = await profileWire(viewerPage), viewerHost = await openProfile(viewerPage, fixture.id);
  await viewerWire.ready();
  expect(viewerWire.receipt.replies.some(reply => reply.type === 'houseplan/config/get' && reply.success && reply.canWrite === false)).toBe(true);
  expect(adminWire.receipt.replies.some(reply => reply.type === 'houseplan/config/get' && reply.success && reply.canWrite === true)).toBe(true);
  await expectFloor(viewerHost, fixture, 'f2');
  await expect(viewerHost.locator(hp('summary-panel'))).toBeVisible();
  const direction = await planDirection(viewerHost, fixture.rooms.f2[0]);
  const sameHost = await viewerHost.elementHandle();
  const gets = viewerWire.configGets(), navigations = viewerWire.receipt.navigations;
  const eventCount = viewerWire.receipt.events.length;
  const before = await planConfig();
  ({ dialog } = await profileSettings(page));
  const child = await editProfile(dialog, fixture.id);
  for (const [field, value] of [['rotation', 180], ['summary', 'hide'], ['hidden_devices', 'hide'],
    ['icon_scale', 1.5], ['font_scale', 1.25], ['controls', true]]) await chooseProfileField(child, field, value);
  await finishProfile(child);
  expect(profileOf((await planConfig()).config, fixture.id)).toEqual(profileOf(before.config, fixture.id));
  try {
    const ack = await saveProfileSettings(dialog, adminWire);
    await viewerWire.settle();
    const after = await planConfig();
    await testInfo.attach('profile-save-nonprofile-paths.json', {
      body: JSON.stringify({ beforeRev: before.rev, afterRev: after.rev, ackRev: ack.rev,
        nonprofileChangedPaths: changedPaths(withoutProfiles(before.config), withoutProfiles(after.config)) }, null, 2),
      contentType: 'application/json',
    });
    expect(ack.rev).toBe(before.rev + 1);
    await expect(viewerHost.locator(hp('summary-panel'))).toBeHidden();
    await expect(viewerHost.locator(hp('device', { id: HIDDEN_MARKER }))).toHaveCount(0);
    await expectSizes(viewerPage, viewerHost, 150, 125);
    expectQuarterTurn(direction, await planDirection(viewerHost, fixture.rooms.f2[0]));
    await viewerWire.settle();
    expect(viewerWire.configGets()).toBe(gets);
    expect(viewerWire.receipt.navigations).toBe(navigations);
    expect(await sameHost.evaluate(host => host.isConnected)).toBe(true);
    expect(viewerWire.receipt.events.slice(eventCount).some(event => event.kind === 'update' && event.rev === ack.rev
      && event.baseRev === before.rev && event.profilePatch === true)).toBe(true);
    expect(viewerWire.receipt.events.slice(eventCount).some(event => ['resync', 'closed'].includes(event.kind))).toBe(false);
    expect(withoutProfiles(after.config)).toEqual(withoutProfiles(before.config));
    expect(profileOf(after.config, fixture.id)).toMatchObject({ rotation: 180, summary: 'hide',
      hidden_devices: 'hide', icon_scale: 1.5, font_scale: 1.25, controls: !hasBeta5UiPolishContract() });
    await expect(viewerHost.locator(hp('settings'))).toHaveCount(0);
    await expect(viewerHost.locator(hp('mode-tab'))).toHaveCount(0);
    await evidence(testInfo, viewerPage, 'readonly-live-profile-adopted');
  } finally {
    await attachProfileReceipt(testInfo, 'admin-native-save-real-ws.json', adminWire);
    await attachProfileReceipt(testInfo, 'readonly-profile-live-real-ws.json', viewerWire);
  }
});

test('URL overrides outrank profile and native local choices without persisting them', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const wire = await profileWire(page);
  await page.goto('/houseplan');
  let host = card(page); await expectPlanDrawn(page, host); await selectSpace(host, 'f2');
  // Establish real local preferences with the ordinary View controls.
  const panel = host.locator(hp('summary-panel'));
  if (!(await panel.isVisible())) await host.locator(hp('summary-toggle')).first().click();
  await expect(panel).toBeVisible(); await host.locator(hp('summary-toggle')).first().click();
  await expect(panel).toBeHidden();
  const hidden = host.locator(hp('hidden-devices')).first();
  if (await hidden.getAttribute('aria-pressed') === 'true') await hidden.click();
  await hidden.click(); await expect(host.locator(hp('device', { id: HIDDEN_MARKER }))).toBeVisible();
  await hidden.click(); await expect(host.locator(hp('device', { id: HIDDEN_MARKER }))).toHaveCount(0);
  await page.goto('/houseplan/kiosk/2'); host = card(page); await expectPlanDrawn(page, host);
  await setLocalSizes(page, host, 125, 115);
  await expectSizes(page, host, 125, 115, false);

  host = await openProfile(page, fixture.id, 'hpkiosk=0');
  await expect(host.locator(hp('summary-panel'))).toBeVisible();
  await expect(host.locator(hp('device', { id: HIDDEN_MARKER }))).toBeVisible();
  await expectSizes(page, host, 175, 150);
  const profileAngle = await planDirection(host, fixture.rooms.f2[0]);
  host = await openProfile(page, fixture.id,
    'hprotate=270&hpsummary=0&hphidden=0&hpicons=133&hptext=127&hpcontrols=0&foreign=keep');
  await expectFloor(host, fixture, 'f2');
  expectQuarterTurn(profileAngle, await planDirection(host, fixture.rooms.f2[0]), 180);
  await expect(host.locator(hp('summary-panel'))).toBeHidden();
  await expect(host.locator(hp('device', { id: HIDDEN_MARKER }))).toHaveCount(0);
  await expectSizes(page, host, 135, 125);
  expect(new URL(page.url()).searchParams.get('foreign')).toBe('keep');
  expect(new URL(page.url()).searchParams.get('hpicons')).toBe('133');

  // Invalid values fall through to the saved profile rather than to locals.
  host = await openProfile(page, fixture.id,
    'hprotate=45&hpsummary=no&hphidden=2&hpicons=NaN&hptext=301&hpcontrols=maybe&hpcycle=-1&hpidle=bad');
  await expect(host.locator(hp('summary-panel'))).toBeVisible();
  await expect(host.locator(hp('device', { id: HIDDEN_MARKER }))).toBeVisible();
  await expectSizes(page, host, 175, 150);
  expectQuarterTurn(profileAngle, await planDirection(host, fixture.rooms.f2[0]), 0);
  await page.goto(`/houseplan/kiosk/1?hpprofile=${fixture.id}&hpspace=2`);
  host = card(page); await expectPlanDrawn(page, host); await expectFloor(host, fixture, 'f1');
  await page.goto('/houseplan?hpprofile=not-an-id&hpicons=200');
  host = card(page); await expectPlanDrawn(page, host);
  await expect(host.locator(hp('settings')).first()).toBeVisible();
  expect(await host.locator(hp('mode-tab')).count()).toBeGreaterThan(0);
  expect(new URL(page.url()).searchParams.get('hpprofile')).toBe('not-an-id');
  // Removing the profile/overrides restores the same native local choices,
  // shared by both URL forms; no localStorage injection or reset is involved.
  await page.goto('/houseplan?hpkiosk=1&hpspace=2');
  host = card(page); await expectPlanDrawn(page, host); await expectFloor(host, fixture, 'f2');
  await expectSizes(page, host, 125, 115, false);
  await expect(host.locator(hp('summary-panel'))).toBeHidden();
  await expect(host.locator(hp('device', { id: HIDDEN_MARKER }))).toHaveCount(0);
  expect(profileOf((await planConfig()).config, fixture.id)).toEqual(fixture.profile);
  expect(wire.receipt.commands.filter(command => command.type === 'houseplan/config/set')).toHaveLength(0);
  await evidence(testInfo, page, 'profile-url-local-precedence');
  await attachProfileReceipt(testInfo, 'precedence-real-ws.json', wire);
});
