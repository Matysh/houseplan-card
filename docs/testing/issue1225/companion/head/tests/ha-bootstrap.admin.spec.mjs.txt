// #1125: genuine HA bootstrap may arrive after cached custom-card resources.
// Delay only the original app request; never replace HA bytes or registration.
import { test, expect } from '@playwright/test';
import { installedRecord, requireHooks } from './lib/contract.mjs';
import { compareTags } from '../scripts/tags.mjs';
import { archive, complexPlan, seedExport } from './lib/backup-fixtures.mjs';
import { chooseBackup, footerCancel, openMaintenance, previewReply } from './lib/backup.mjs';
import { planConfig, planLayout } from './lib/ha-ws.mjs';
import { evidence } from './lib/ha-page.mjs';

requireHooks(test, 'action', 'dialog', 'settings-section');

test('settings and import dialogs survive a late genuine HA bootstrap on cold and repeated entry', async ({ page }, info) => {
  const version = installedRecord()?.version;
  test.skip(version && compareTags(`v${version}`, 'v1.83.0-beta.4') < 0,
    '#1125 first ships in beta.4; an old release skip is not bootstrap proof');
  const requests = [], illegalConstructors = [];
  page.on('pageerror', error => {
    if (error.message.includes('Illegal constructor')) illegalConstructors.push({ name: error.name, message: error.message });
  });
  await page.route('**/frontend_latest/app.*.js*', async route => {
    requests.push(new URL(route.request().url()).pathname);
    await new Promise(resolve => setTimeout(resolve, 600));
    await route.continue();
  });
  const configBefore = await planConfig(), layoutBefore = await planLayout();
  // Bootstrap tests UI registration, not malformed geometry migration. Use
  // one repairable nonstructural stale reference and preserve graph authority.
  const plan = complexPlan(await seedExport());
  const radar = plan.document.payload.config.markers.find(marker => marker.id === 'e2e_radar_kitchen');
  expect(radar?.radar).toBeDefined();
  radar.radar.room_id = 'e2e_bootstrap_missing_room';
  const zip = archive(plan);
  for (const entry of ['cold', 'repeated']) {
    const { host, settings } = await openMaintenance(page);
    const replied = previewReply(page);
    const dialog = await chooseBackup(page, host, settings,
      { name: 'bootstrap-preview.zip', mimeType: 'application/zip', buffer: zip });
    const response = await replied;
    const reply = await response.json();
    expect(response.status(), JSON.stringify(reply)).toBe(200);
    expect(reply.preview?.recovery?.counts?.radar).toBe(1);
    await expect(settings).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('The plan will be restored with repairs');
    await evidence(info, page, `late-bootstrap-${entry}-dialog`);
    await footerCancel(dialog).click();
    await expect(dialog).toBeHidden();
    await expect(settings).toBeHidden();
  }
  expect(requests, 'both real document entries exercised the genuine delayed app resource').toHaveLength(2);
  expect(illegalConstructors, 'the actual custom-element constructor must remain registered').toHaveLength(0);
  const configAfter = await planConfig(), layoutAfter = await planLayout();
  expect(configAfter.rev).toBe(configBefore.rev);
  expect(configAfter.config).toEqual(configBefore.config);
  expect(layoutAfter.rev).toBe(layoutBefore.rev);
  expect(layoutAfter.layout).toEqual(layoutBefore.layout);
  await info.attach('genuine-ha-bootstrap-ui', { body: JSON.stringify({ delayMs: 600, requests,
    entries: 2, illegalConstructors, configurationUnchanged: true, layoutUnchanged: true }, null, 2), contentType: 'application/json' });
});
