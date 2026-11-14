/** #1446: the actual marker dialog receives provenance without raw HA transport. */
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { settingsSection } from './helpers/settings-section.mjs';
requirePinnedBrowser('device integration metadata boundary');
const { page, browser } = await launch({ width: 1180, height: 1200 });
const out = {};
await page.evaluate(async () => {
  const c = window.__card, base = c.hass;
  window.__metadata1446 = { calls: [], releases: 0 };
  c.hass = { ...base,
    // This witness targets manifest fallback; HA translations remain higher
    // priority and are independently covered by the provider unit.
    localize: () => null,
    async callWS(command) {
      if (command.type === 'config_entries/get' || command.type === 'manifest/list') {
        window.__metadata1446.calls.push(command.type);
        return command.type === 'config_entries/get'
          ? [{ entry_id: 'metadata_entry', domain: 'demo', title: 'Entry fallback', private: 'not a display fact' }]
          : [{ domain: 'demo', name: 'HA Manifest Name', private: 'not a display fact' }];
      }
      return base.callWS.call(base, command);
    },
    connection: { ...base.connection, async subscribeMessage(receive, command) {
      if (command.type === 'config_entries/subscribe')
        return () => { window.__metadata1446.releases++; };
      return base.connection.subscribeMessage.call(base.connection, receive, command);
    } },
  };
  await window.__hpTest.settled();
  await window.__hpTest.setMode('devices');
  await window.__hpTest.openMarkerDialog('d_light1');
});
const dialog = page.locator('houseplan-card').locator('hp-dialog[data-kind="marker"]');
await settingsSection(dialog, 'appearance');
await page.waitForFunction(() => {
  const c = window.__card, preview = c.renderRoot.querySelector('hp-device-preview');
  return preview?.renderRoot?.textContent.includes('HA Manifest Name');
});
Object.assign(out, await page.evaluate(async () => {
  const c = window.__card, preview = c.renderRoot.querySelector('hp-device-preview');
  const facts = preview.renderRoot.querySelector('.previewfacts')?.textContent || '';
  const source = preview.integrationMetadata, metadata = source.snapshot();
  const before = window.__metadata1446.calls.length;
  c.hass = { ...c.hass };
  await window.__hpTest.settled();
  return {
    manifestDisplayName: facts.includes('HA Manifest Name'),
    onlyFiniteMetadataOperations: Object.keys(source).sort().join(',') === 'acquire,identity,snapshot',
    noRawHaInDomainFrame: ['callWS', 'connection', 'auth'].every(key => !(key in preview.hass)),
    onlyDisplayFacts: !JSON.stringify(metadata).includes('not a display fact'),
    sharedReaderOnOrdinaryTick: c.renderRoot.querySelector('hp-device-preview').integrationMetadata === source,
    noExtraMetadataFetchOnTick: window.__metadata1446.calls.length === before,
    exactlyTwoDiscoveryReads: before === 2,
  };
}));
await dialog.press('Escape');
await page.waitForFunction(() => window.__metadata1446.releases === 1);
out.dialogCloseReleasesMetadata = await dialog.count() === 0;
checkAll(out);
await finish(browser, out);
