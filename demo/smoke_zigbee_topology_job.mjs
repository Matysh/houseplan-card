// #800: production settings + WS transport, with a server-owned fixture outside
// the page. A reload really loses all browser state; backend time is controlled,
// not a 15-minute wall-clock sleep. HA/MQTT lifecycle is covered by HA tests.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 850 });
const output = {};
const record = (name, actual) => { output[name] = actual; check(name, actual); };
const artifacts = new URL('../artifacts/zigbee-topology-800/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
const server = { available: true, session: 'server-800', revision: 0, sequence: 0, publishes: 0, cancels: 0, provider: null };
const state = () => ({ kind: 'state', session_id: server.session, revision: server.revision,
  provider: structuredClone(server.provider) });
const initial = () => [{ kind: 'reset', session_id: server.session, revision: server.revision,
  topics: server.provider ? [server.provider.topic] : [] }, ...(server.provider ? [state()] : [])];
await page.exposeFunction('__scanRpc', async (message) => {
  if (message.type === 'houseplan/config/get') return { available: server.available };
  if (message.type === 'houseplan/zigbee/subscribe') return initial();
  if (message.type === 'houseplan/zigbee/start') {
    if (server.provider?.phase !== 'loading') {
      server.publishes++;
      const last = server.provider;
      server.provider = { topic: 'zigbee2mqtt', job_id: `job-${++server.sequence}`,
        phase: 'loading', stage: 'waiting', started_at: Date.now(), elapsed_ms: 0,
        cancel_after_ms: 600000, ...(last?.result ? {
          result: last.result, obtained_at: last.obtained_at, stale: true,
        } : {}) };
      server.revision++;
    }
    return state();
  }
  if (message.type === 'houseplan/zigbee/cancel') {
    if (message.job_id !== server.provider?.job_id) throw new Error('conflict');
    if (server.provider.elapsed_ms < 600000) throw new Error('not_ready');
    if (server.provider.phase === 'loading') {
      server.cancels++;
      server.provider.phase = 'cancelled'; server.provider.stale = true;
      server.revision++;
    }
    return state();
  }
  throw new Error(`unexpected fixture RPC: ${message.type}`);
});

const install = async (embedded = false) => page.evaluate(async (isEmbedded) => {
  const card = window.__card;
  await card._ensureEditorRuntime();
  card._openSettingsDialog(); await card.updateComplete;
  (card.shadowRoot || card.renderRoot)
    .querySelector('hp-dialog[data-kind="settings"] [data-hp="dialog-cancel"]').click();
  await card.updateComplete;
  const original = card.hass;
  window.__scanCallbacks = new Set();
  window.__scanStats = { subscriptions: 0, active: 0, mqtt: 0 };
  const connection = {
    ...original.connection,
    subscribeMessage: async (callback, message) => {
      if (message.type !== 'houseplan/zigbee/subscribe') {
        if (message.type.startsWith('mqtt/')) window.__scanStats.mqtt++;
        return original.connection.subscribeMessage(callback, message);
      }
      window.__scanStats.subscriptions++; window.__scanStats.active++;
      window.__scanCallbacks.add(callback);
      for (const event of await window.__scanRpc(message)) callback(event);
      let active = true;
      return () => {
        if (!active) return; active = false;
        window.__scanCallbacks.delete(callback); window.__scanStats.active--;
      };
    },
  };
  const hass = { ...original, language: 'en', user: { ...original.user, id: 'admin-800', is_admin: true }, connection,
    callWS: async (message) => {
      if (message.type.startsWith('houseplan/zigbee/')) return window.__scanRpc(message);
      if (message.type === 'houseplan/config/get' && !(await window.__scanRpc(message)).available) {
        throw { code: 'not_ready' };
      }
      const result = await original.callWS(message);
      if (message.type === 'houseplan/config/get') return {
        ...result, zigbee_scan_api: 1,
      };
      return result;
    },
    callService: async (...args) => {
      if (args[0] === 'mqtt') window.__scanStats.mqtt++;
      return original.callService(...args);
    },
  };
  window.__scanHass = hass;
  const element = document.createElement('hp-zigbee-topology-settings');
  element.id = 'scan-settings'; element.hass = hass;
  element.value = { enabled: true, z2mBaseTopics: ['zigbee2mqtt'] };
  element.savedEnabled = true; element.embedded = isEmbedded;
  element.style.cssText = 'position:fixed;inset:0;overflow:auto;padding:20px;box-sizing:border-box;background:#fff;color:#171735;z-index:99999;font:16px sans-serif';
  // Reproduce the tokens normally inherited from hp-dialog .hpf-form. The
  // demo document itself is dark; changing only background would fake a theme.
  for (const [key, value] of Object.entries({
    '--primary-text-color': '#171735', '--secondary-text-color': '#666879',
    '--card-background-color': '#fff', '--divider-color': '#dce5e7',
    '--hpf-surface': '#fff', '--hpf-line': '#dce5e7', '--hpf-muted': '#666879',
    '--hpf-accent': '#f09600', '--hpf-canvas': '#f5f5f8',
  })) element.style.setProperty(key, value);
  document.body.append(element); await element.updateComplete;
}, embedded);
const settings = () => page.locator('#scan-settings');
const refresh = () => settings().getByRole('button', { name: /Update map/ });
const cancel = () => settings().locator('[data-hp="zigbee-scan-cancel"]');
const elapsed = () => settings().locator('[data-hp="zigbee-scan-elapsed"]');
const waitState = async (phase) => page.waitForFunction((expected) =>
  document.getElementById('scan-settings')?._snapshot?.states?.['z2m:zigbee2mqtt']?.phase === expected, phase);
const deliver = async () => page.evaluate((event) => {
  for (const callback of window.__scanCallbacks) callback(event);
}, state());

try {
  await install();
  await refresh().click(); await waitState('loading');
  record('onePublishAndNoBrowserMqtt', server.publishes === 1
    && await page.evaluate(() => window.__scanStats.mqtt === 0));
  record('stageElapsedAndCloseHint', await elapsed().isVisible()
    && await settings().locator('[data-hp="zigbee-scan-stage"]').isVisible()
    && await settings().locator('[data-hp="zigbee-scan-background"]').isVisible());
  record('noInventedPercentOrEarlyCancel', !(await settings().innerText()).includes('%')
    && await cancel().count() === 0);

  await page.evaluate(async () => {
    const element = document.getElementById('scan-settings');
    for (let i = 0; i < 4; i++) {
      element.hass = { ...element.hass, states: { ...element.hass.states } };
      await element.updateComplete;
    }
  });
  record('ordinaryHassUpdatesKeepOneSubscription', await page.evaluate(() =>
    window.__scanStats.subscriptions === 1 && window.__scanStats.active === 1));
  server.provider.elapsed_ms = 599100; server.revision++; await deliver();
  record('599SecondsStillNoCancel', await cancel().count() === 0);
  await cancel().waitFor({ state: 'visible', timeout: 4000 });
  record('cancelAppearsFromLocalClockWithoutServerTick', server.provider.elapsed_ms === 599100);

  // Remove settings and reload the entire document, while fixture server lives.
  await page.evaluate(() => document.getElementById('scan-settings').remove());
  record('closingReleasesOnlyUi', await page.evaluate(() => window.__scanStats.active === 0)
    && server.provider.phase === 'loading');
  server.provider.elapsed_ms = 901000; server.revision++;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__card?._booting === false);
  await install(true); await waitState('loading');
  record('newPageRestoresSameJobAfter15Minutes', server.publishes === 1
    && /15:0[1-9]/.test(await elapsed().innerText()));
  record('longWaitHasCancelAndHonestHint', await cancel().isVisible()
    && await settings().locator('[data-hp="zigbee-scan-long-wait"]').isVisible()
    && await settings().locator('[data-hp="zigbee-scan-cancel-hint"]').isVisible());
  // Narrow layout and real keyboard activation, not a direct private handler.
  await page.setViewportSize({ width: 390, height: 844 });
  await cancel().scrollIntoViewIfNeeded();
  const rect = await cancel().boundingBox();
  record('mobileCancelTouchTargetAndNoOverflow', rect?.height >= 44 && rect?.width >= 44
    && await settings().evaluate((element) => element.scrollWidth <= element.clientWidth + 1));
  await page.screenshot({ path: fileURLToPath(new URL('narrow-light-wait.png', artifacts)) });
  await settings().evaluate((element) => {
    element.style.background = '#202126'; element.style.color = '#eee';
    element.style.setProperty('--card-background-color', '#202126');
    element.style.setProperty('--primary-text-color', '#eee');
    element.style.setProperty('--secondary-text-color', '#aaa');
    element.style.setProperty('--hpf-surface', '#202126');
    element.style.setProperty('--hpf-line', '#555');
    element.style.setProperty('--hpf-muted', '#aaa');
    element.style.setProperty('--hpf-canvas', '#17181d');
  });
  await page.screenshot({ path: fileURLToPath(new URL('narrow-dark-wait.png', artifacts)) });
  await cancel().focus(); await page.keyboard.press('Enter'); await waitState('cancelled');
  record('keyboardCancelsExactJobWithoutRepublish', server.cancels === 1 && server.publishes === 1);
  await refresh().click(); await waitState('loading');
  record('newExplicitScanOnly', server.publishes === 2 && server.provider.job_id === 'job-2');
  server.provider = { ...server.provider, phase: 'ready', elapsed_ms: 960000,
    obtained_at: Date.now(), stale: false,
    result: { status: 'ok', transaction: 'job-2', data: { type: 'raw', value: {
      nodes: [{ ieeeAddr: '00124b0000000001', type: 'Coordinator', networkAddress: 0 }], links: [],
    } } },
  }; server.revision++;
  // Finish with zero observers, then restore the cached result on remount.
  await page.evaluate(() => document.getElementById('scan-settings').remove());
  await install(); await waitState('ready');
  record('resultWhileAbsentRestoresWithoutNewScan', server.publishes === 2
    && await elapsed().count() === 0 && await refresh().isEnabled());
  record('receivedMapNormalized', await page.evaluate(() =>
    document.getElementById('scan-settings')._snapshot.topologies.length === 1));
  await page.setViewportSize({ width: 1000, height: 850 });
  await page.screenshot({ path: fileURLToPath(new URL('desktop-ready.png', artifacts)) });
  const obsolete = state();
  await page.evaluate((event) => {
    for (const callback of window.__scanCallbacks) callback(event);
  }, { kind: 'closed', session_id: server.session, revision: ++server.revision });
  server.session = 'server-800-reloaded'; server.revision = 0; server.provider = null;
  await page.waitForFunction(() => !document.getElementById('scan-settings')._snapshot.states['z2m:zigbee2mqtt']);
  record('integrationUnloadClearsUiWithoutClosingHaSocket', await refresh().isEnabled()
    && await page.evaluate(() => window.__scanStats.active === 0));
  server.available = false;
  await refresh().click(); await waitState('error');
  record('retryDuringReloadDoesNotStartRadioOrDisableRetry', server.publishes === 2
    && await refresh().isEnabled());
  server.available = true;
  await refresh().click(); await waitState('loading');
  await page.evaluate((event) => {
    for (const callback of window.__scanCallbacks) callback(event);
  }, obsolete);
  record('explicitScanAfterIntegrationReloadReobservesNewSession', server.publishes === 3
    && await page.evaluate(() => window.__scanStats.active === 1
      && document.getElementById('scan-settings')._snapshot.states['z2m:zigbee2mqtt'].jobId === 'job-3'));
  await page.evaluate(async () => {
    const element = document.getElementById('scan-settings');
    element.hass = { ...element.hass, user: { id: 'viewer-800', is_admin: false } };
    await element.updateComplete;
  });
  record('permissionLossDropsObserverAndMap', await page.evaluate(() =>
    window.__scanStats.active === 0
    && document.getElementById('scan-settings')._snapshot.topologies.length === 0));
} finally {
  await finish(browser, output);
}
