// #894 AC2: an actual View-created draft and a new element with no editor runtime.
import { launchColdView, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { evaluateRetainedAction } from './helpers/retained-page-action.mjs';
requirePinnedBrowser('894 warm View marker renderer ownership');
const out = {};
for (const mode of ['success', 'close', 'permission', 'identity', 'disconnect', 'failure', 'newer']) {
  const { page, browser } = await launchColdView({ width: 1100, height: 900 });
  try {
    const id = await page.evaluate(async mode => {
      window.__894Mode = mode;
      const c = window.__card, original = c.hass;
      window.__894Writer = true; window.__894WarmWrites = [];
      const hass = { ...original, callWS: async message => {
        if (message.type === 'houseplan/config/set') window.__894WarmWrites.push(message);
        const answer = await original.callWS(message);
        return message.type === 'houseplan/config/get' ? { ...answer, can_write: window.__894Writer } : answer;
      } };
      c.hass = hass; window.__894Hass = hass;
      await window.__hpTest.waitForWrites();
      await window.__hpTest.setServerConfig(cfg => {
        cfg.settings = { ...cfg.settings, filter_seeded: true,
          known_devices: c._devices.filter(d => !d.virtual && !d.marker).map(d => d.id).sort(), new_device_ids: [] };
        return cfg;
      });
      await window.__hpTest.waitForWrites();
      const d = c._devices.find(d => d.id === 'd_temp');
      window.__894Device = d.id;
      return d.id;
    }, mode);
    const device = page.locator(`#host houseplan-card [data-hp="device"][data-id="${id}"]`);
    await device.hover(); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
    await page.locator('#host houseplan-card .infofooter button').filter({ hasText: 'Edit' }).click();
    await page.locator('#host houseplan-card hp-dialog[data-kind="marker"] #marker-name').fill('Unsaved 894 draft');
    // Keep this remount action rooted across CDP's pending await (#967/#987).
    // The existing helper preserves failures and enforces a bounded deadline.
    await evaluateRetainedAction(page, async () => {
      const mode = window.__894Mode;
      const old = window.__card, parent = old.parentNode, config = old._config;
      await window.__hpTest.settled(); await window.__hpTest.waitForWrites();
      old.remove();
      const next = document.createElement('houseplan-card'); next.setConfig(config);
      const load = next._editorRuntimeLoader.options.load;
      window.__894WarmLoads = 0; window.__894WarmWrites = [];
      // private-ok: fault-inject only the real chunk transport timing; never a draft or renderer.
      next._editorRuntimeLoader.options.load = async attempt => { // private-ok: #894 delays/fails the actual chunk transport, not dialog state.
        ++window.__894WarmLoads;
        if (mode === 'failure' && !window.__894ChunkAvailable) throw Error('894 chunk unavailable');
        if (mode !== 'failure') await new Promise(resolve => { window.__894ReleaseChunk = resolve; });
        return load(attempt);
      };
      window.__card = next; next.hass = window.__894Hass; parent.appendChild(next);
    }, `894 ${mode} remount`);
    await page.locator('#host houseplan-card hp-dialog[data-kind="marker-restore"]').waitFor();
    await page.evaluate(() => window.__hpUiCapture?.('marker-restore', '#host houseplan-card hp-dialog[data-kind="marker-restore"]'));
    out[`${mode}:loading-is-visible-not-hidden-marker`] = await page.evaluate(() => {
      const c = window.__card; return !c._markerDialog && !c.renderRoot.querySelector('hp-dialog[data-kind="marker"]')
        && !!c.renderRoot.querySelector('hp-dialog[data-kind="marker-restore"]') && window.__894WarmWrites.length === 0;
    });
    if (mode === 'close') await page.locator('#host houseplan-card hp-dialog[data-kind="marker-restore"] .btn[data-hp="dialog-cancel"]').click();
    if (mode === 'permission') await page.evaluate(async () => {
      window.__894Writer = false; await window.__hpTest.setServerConfig(cfg => cfg);
    });
    if (mode === 'identity') await page.evaluate(() => {
      const c = window.__card; c.hass = { ...c.hass, user: { ...c.hass.user, id: '894-other' } };
    });
    if (mode === 'disconnect') await page.evaluate(() => window.__card.remove());
    if (mode === 'newer') {
      await page.locator('#host houseplan-card hp-dialog[data-kind="marker-restore"] .btn[data-hp="dialog-cancel"]').click();
      const other = page.locator('#host houseplan-card [data-hp="device"][data-id="d_tv"]');
      await other.hover(); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
      await page.locator('#host houseplan-card .infofooter button').filter({ hasText: 'Edit' }).click();
    }
    if (mode === 'failure') {
      await page.locator('#host houseplan-card [data-hp="restore-retry"]').waitFor();
      out['failure:retry-and-close-available'] = await page.evaluate(() => window.__894WarmWrites.length === 0
        && !window.__card._markerDialog && !!window.__card.renderRoot.querySelector('[data-hp="dialog-cancel"]'));
      await page.evaluate(() => { window.__894ChunkAvailable = true; });
      await page.locator('#host houseplan-card [data-hp="restore-retry"]').click();
    } else await page.evaluate(() => window.__894ReleaseChunk());
    if (mode === 'success' || mode === 'failure' || mode === 'newer') {
      await page.locator('#host houseplan-card hp-dialog[data-kind="marker"] #marker-name').waitFor();
      out[`${mode}:visible-correct-draft`] = await page.evaluate(mode => {
        const c = window.__card, input = c.renderRoot.querySelector('#marker-name');
        return !!c._editorRuntime && input?.value === (mode === 'newer' ? 'TV' : 'Unsaved 894 draft')
          && c._markerDialog.devId === (mode === 'newer' ? 'd_tv' : window.__894Device)
          && (mode === 'newer' || window.__894WarmWrites.length === 0);
      }, mode);
    } else {
      await page.waitForTimeout(300);
      out[`${mode}:late-completion-not-published-acked`] = await page.evaluate(() => !window.__card._markerDialog
        && !window.__card.renderRoot.querySelector('hp-dialog[data-kind="marker"]') && window.__894WarmWrites.length === 0);
    }
    out[`${mode}:bounded-runtime-load`] = await page.evaluate(mode => window.__894WarmLoads === (mode === 'failure' ? 3 : 1), mode);
    if (mode === 'success' && !out['success:visible-correct-draft']) console.log('894 warm diagnostic', await page.evaluate(() => ({
      name: window.__card.renderRoot.querySelector('#marker-name')?.value,
      draft: window.__card._markerDialog?.name, writes: window.__894WarmWrites.map(m => ({ type: m.type, settings: m.config?.settings })),
    })));
  } finally { await browser.close(); }
}
checkAll(out); await finish(null, out);
