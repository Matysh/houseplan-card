// #1005: actual General Settings, public HA/config inputs and provider events.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { settingsSection } from './helpers/settings-section.mjs';

requirePinnedBrowser('smoke_zigbee_incomplete_reasons');
const { page, browser } = await launch({ width: 1200, height: 900 });
page.setDefaultTimeout(15000);
const artifacts = new URL('../artifacts/zigbee-incomplete-1005/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
const out = { completed: false }, evidence = {};
const topics = ['zigbee2mqtt', 'house/z2m'];
const ieee = id => id.toString(16).padStart(16, '0');
const hostile = '<img src=x onerror="window.__injected=1">' + 'LongRadio'.repeat(28);
// Provider names already have a 255-character normalisation limit (#798).
const displayedHostile = hostile.slice(0, 255);
const zhaRows = () => [
  { ieee: ieee(1), nwk: 0, device_reg_id: 'd_light1', device_type: 'Coordinator', name: 'ZHA hub', neighbors: [] },
  { ieee: ieee(2), nwk: 2, device_reg_id: 'd_temp', device_type: 'Router', name: 'ZHA missing route', neighbors: [], routes: [] },
];
const z2m = (label, failed = ['routingTable', 'neighborTable']) => ({ nodes: [
  { ieeeAddr: ieee(1), networkAddress: 0, type: 'Coordinator', friendlyName: 'MQTT hub' },
  { ieeeAddr: ieee(2), networkAddress: 2, type: 'Router', friendlyName: label, ...(failed ? { failed } : {}) },
], links: [{ source: { ieeeAddr: ieee(1) }, target: { ieeeAddr: ieee(2) },
  routes: [{ status: 'ACTIVE', destinationAddress: 0, nextHopAddress: 0 }] }] });
const server = { session: 'server-1005', revision: 0, maps: new Map(), zha: zhaRows(), zhaError: false,
  reads: 0, scans: 0, cancels: 0, calls: [] };
const state = topic => ({ kind: 'state', session_id: server.session, revision: ++server.revision,
  provider: structuredClone(server.maps.get(topic)) });
const ready = (topic, result) => server.maps.set(topic, { topic, job_id: `job-${topic}`, phase: 'ready',
  elapsed_ms: 0, obtained_at: Date.now(), result });
await page.exposeFunction('__incompleteRpc', async message => {
  server.calls.push(message.type);
  if (message.type === 'zha/devices') {
    server.reads++;
    if (server.zhaError) throw new Error('fixture read failed');
    return structuredClone(server.zha);
  }
  if (message.type === 'houseplan/zigbee/subscribe') return [
    { kind: 'reset', session_id: server.session, revision: server.revision, topics: [...server.maps.keys()] },
    ...[...server.maps.keys()].map(state),
  ];
  if (message.type === 'houseplan/zigbee/start') {
    server.scans++;
    server.maps.set(message.topic, { topic: message.topic, job_id: `scan-${server.scans}`, phase: 'loading',
      stage: 'waiting', elapsed_ms: 600001, started_at: Date.now() - 600001, cancel_after_ms: 600000 });
    return state(message.topic);
  }
  if (message.type === 'houseplan/zigbee/cancel') {
    server.cancels++;
    server.maps.set(message.topic, { ...server.maps.get(message.topic), phase: 'cancelled' });
    return state(message.topic);
  }
  throw new Error(`unexpected fixture RPC: ${message.type}`);
});
const root = page.locator('#host > houseplan-card');
const dialog = () => root.locator('hp-dialog[data-kind="settings"]');
const settings = () => dialog().locator('hp-zigbee-topology-settings');
const details = provider => settings().locator(`[data-incomplete-provider="${provider}"]`);
const text = provider => details(provider).locator('.incomplete-text');
const settle = () => page.evaluate(() => window.__hpTest.settled());
const deliver = event => page.evaluate(event => {
  for (const callback of window.__incompleteCallbacks) callback(event);
}, event);
const readZha = async (phase = 'ready') => {
  await settings().locator('.hpf-provider').first().locator('.hpf-actions button').click();
  await page.waitForFunction(expected => window.__card.shadowRoot.querySelector('hp-zigbee-topology-settings')
    ?._snapshot?.states?.zha?.phase === expected, phase);
  await settle();
};
const modelText = () => page.evaluate(() => window.__card.shadowRoot.querySelector('hp-zigbee-topology-settings')
  ?.shadowRoot.querySelector('[data-incomplete-provider]')?.textContent || '');

try {
  await page.evaluate(async ({ topics, first, second }) => {
    const card = window.__card, original = card.hass;
    card.setConfig({ type: 'custom:houseplan-card', language: 'ru' });
    for (const [id, name, address] of [['d_light1', 'Ceiling light', first], ['d_temp', 'Temperature', second]]) {
      const row = original.devices[id];
      window.__addRegistryDevice(id, name, row.model, row.area_id,
        { ...row, identifiers: [['zha', address], ['mqtt', address]] });
    }
    window.__incompleteCallbacks = new Set();
    window.__incompleteStats = { subscriptions: 0, active: 0, mqtt: 0 };
    const connection = { ...original.connection, subscribeMessage: async (callback, message) => {
      if (message.type !== 'houseplan/zigbee/subscribe') return original.connection.subscribeMessage(callback, message);
      window.__incompleteStats.subscriptions++; window.__incompleteStats.active++;
      window.__incompleteCallbacks.add(callback);
      for (const event of await window.__incompleteRpc(message)) callback(event);
      return () => { window.__incompleteCallbacks.delete(callback); window.__incompleteStats.active--; };
    } };
    const hass = { ...original, language: 'ru', user: { ...original.user, is_admin: true }, connection,
      callWS: async message => {
        if (message.type === 'config_entries/get') return [
          { entry_id: 'zha-1005', domain: 'zha', title: 'ZHA' },
          { entry_id: 'mqtt-1005', domain: 'mqtt', title: 'MQTT' },
        ];
        if (message.type === 'zha/devices' || message.type.startsWith('houseplan/zigbee/')) return window.__incompleteRpc(message);
        const result = await original.callWS(message);
        return message.type === 'houseplan/config/get' ? { ...result, zigbee_scan_api: 1, zigbee_maps_api: 1 } : result;
      }, callService: async (...args) => {
        if (args[0] === 'mqtt') window.__incompleteStats.mqtt++;
        return original.callService(...args);
      } };
    window.__incompleteHass = hass;
    card.hass = hass;
  }, { topics, first: ieee(1), second: ieee(2) });
  await page.waitForFunction(() => window.__card._loadOk && window.__card._serverCfg, null, { timeout: 15000 });
  await page.evaluate(topics => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
    settings: { ...cfg.settings, zigbee_topology: { enabled: true, z2m_base_topics: topics } } })), topics);
  await root.locator('[data-hp="settings"]').click();
  await settingsSection(dialog(), 'zigbee');
  await page.waitForFunction(() => window.__incompleteStats.active === 1);
  out.noReasonsBeforeDataAndNoAutomaticRead = await settings().locator('[data-incomplete-provider]').count() === 0
    && server.reads === 0 && server.scans === 0;
  evidence.idleTypography = await settings().locator('.hpf-provider').first().locator('[role="status"]').evaluate(el => {
    const s = getComputedStyle(el); return { font: s.fontFamily, size: s.fontSize, height: s.lineHeight, color: s.color };
  });
  await readZha();
  await details('zha').waitFor();
  ready(topics[0], z2m(hostile)); ready(topics[1], z2m('Second topic radio', ['routingTable']));
  await deliver(state(topics[0])); await deliver(state(topics[1]));
  await details('z2m').waitFor();
  out.exactRussianHeadingAndInitiallyCollapsed = await details('zha').locator('summary').innerText() === 'Почему данные неполные'
    && await details('z2m').locator('summary').innerText() === 'Почему данные неполные'
    && !await details('zha').evaluate(el => el.open) && !await details('z2m').evaluate(el => el.open);
  out.providerFootersFollowAllControls = await settings().evaluate(el => {
    const r = el.shadowRoot, zha = r.querySelector('[data-incomplete-provider="zha"]'), mqtt = r.querySelector('[data-incomplete-provider="z2m"]');
    return zha.parentElement.lastElementChild === zha && mqtt.parentElement.lastElementChild === mqtt
      && mqtt.previousElementSibling.dataset.topic === 'house/z2m' && r.querySelectorAll('[data-incomplete-provider]').length === 2;
  });
  const radioCalls = { reads: server.reads, scans: server.scans, cancels: server.cancels };
  await details('zha').locator('summary').click();
  await details('z2m').locator('summary').focus(); await page.keyboard.press('Enter');
  out.nativeMouseAndKeyboardToggle = await text('zha').isVisible() && await text('z2m').isVisible();
  evidence.zha = await text('zha').innerText(); evidence.z2m = await text('z2m').innerText();
  out.namedReasonsAndFailedStagesWithoutFaultClaim = evidence.zha.includes('ZHA missing route')
    && evidence.zha.includes('исходящ') && !/неисправ|offline/i.test(evidence.zha)
    && evidence.z2m.includes(displayedHostile) && evidence.z2m.includes('routingTable, neighborTable');
  out.topicGroupsDoNotMix = evidence.z2m.indexOf(topics[0]) < evidence.z2m.indexOf(displayedHostile)
    && evidence.z2m.indexOf(displayedHostile) < evidence.z2m.indexOf(topics[1])
    && evidence.z2m.indexOf(topics[1]) < evidence.z2m.indexOf('Second topic radio')
    && !evidence.zha.includes('Second topic radio');
  out.providerLabelsRemainEscaped = await details('z2m').locator('img,script,svg').count() === 0
    && await page.evaluate(() => !window.__injected);
  for (const [theme, paper, foreground, muted] of [['light', '#ffffff', '#17212b', '#667788'], ['dark', '#17212b', '#ffffff', '#aabbcc']]) {
    await root.evaluate((card, values) => {
      for (const [key, value] of Object.entries(values)) card.style.setProperty(key, value);
    }, { '--card-background-color': paper, '--primary-text-color': foreground, '--secondary-text-color': muted });
    await settle();
    evidence[`${theme}Typography`] = await details('zha').evaluate(el => {
      const summary = getComputedStyle(el.querySelector('summary')), body = getComputedStyle(el.querySelector('div'));
      const reference = getComputedStyle(el.parentElement.querySelector('[role="status"]'));
      return { same: ['fontFamily', 'fontSize', 'lineHeight', 'color'].every(key => summary[key] === reference[key] && body[key] === reference[key]),
        nativeMarker: summary.display === 'list-item' && summary.listStyleType === 'disclosure-open', size: summary.fontSize };
    });
    out[`${theme}StatusTypographyAndNativeTriangle`] = evidence[`${theme}Typography`].same
      && evidence[`${theme}Typography`].size === '12px' && evidence[`${theme}Typography`].nativeMarker;
    for (const width of [1200, 390]) {
      await page.setViewportSize({ width, height: 900 });
      out[`${theme}${width}LongTextWraps`] = await text('z2m').evaluate(el => {
        const r = el.getBoundingClientRect(); return el.scrollWidth <= el.clientWidth + 1 && r.left >= -1 && r.right <= innerWidth + 1;
      });
      await details('z2m').scrollIntoViewIfNeeded();
      await page.screenshot({ path: fileURLToPath(new URL(`${theme}-${width}.png`, artifacts)) });
    }
  }
  await page.evaluate(async () => {
    const c = window.__card;
    for (let i = 0; i < 4; i++) {
      c.hass = { ...c.hass, states: { ...c.hass.states } };
      await window.__hpTest.settled();
    }
  });
  out.spoilerAndThemesDoNotFetchOrScan = JSON.stringify(radioCalls) === JSON.stringify({ reads: server.reads, scans: server.scans, cancels: server.cancels })
    && await page.evaluate(() => window.__incompleteStats.subscriptions === 1 && window.__incompleteStats.mqtt === 0);
  await page.setViewportSize({ width: 1200, height: 900 });
  await settings().locator('#z2m-topics').fill(topics[1]); await settle();
  out.topicEditHidesRetiredGroup = !(await text('z2m').innerText()).includes(displayedHostile)
    && (await text('z2m').innerText()).includes('Second topic radio');
  await settings().locator('#z2m-topics').fill(topics.join('\n')); await settle();
  // A successful replacement clears both old names and causes for that topic.
  ready(topics[0], z2m('Full topic', null)); await deliver(state(topics[0])); await settle();
  out.fullSnapshotRemovesOnlyItsGroup = !(await text('z2m').innerText()).includes(displayedHostile)
    && (await text('z2m').innerText()).includes('Second topic radio') && await details('z2m').evaluate(el => el.open);
  server.maps.delete(topics[1]);
  await deliver({ kind: 'removed', session_id: server.session, revision: ++server.revision, topic: topics[1] });
  await settle();
  out.removedLastPartialTopicRemovesFooter = await details('z2m').count() === 0;
  server.zhaError = true;
  await readZha('error');
  out.failedZhaRefreshKeepsSnapshotAndSeparateError = (await text('zha').innerText()).includes('ZHA missing route')
    && (await text('zha').innerText()).includes('Последнее обновление');
  server.zhaError = false; server.zha = zhaRows().slice(0, 1);
  await readZha(); await settle();
  out.fullZhaSnapshotRemovesFooter = await details('zha').count() === 0;
  ready(topics[0], z2m('Retired session radio')); await deliver(state(topics[0])); await settle();
  await settingsSection(dialog(), 'display'); await settle();
  out.inactiveSectionRetiresNames = !(await modelText()).includes('Retired session radio');
  await settingsSection(dialog(), 'zigbee'); await details('z2m').waitFor();
  // New HA connection has a new empty backend session; late old events have no observer.
  server.maps.clear(); server.session = 'replacement-1005'; server.revision = 0;
  await page.evaluate(() => {
    const c = window.__card; c.hass = { ...c.hass, connection: { ...c.hass.connection } };
  });
  await settle();
  out.connectionChangeRetiresNames = !(await modelText()).includes('Retired session radio');
  ready(topics[0], z2m('Retired user radio')); await deliver(state(topics[0])); await details('z2m').waitFor();
  server.maps.clear(); server.session = 'user-1005'; server.revision = 0;
  await page.evaluate(() => {
    const c = window.__card; c.hass = { ...c.hass, user: { ...c.hass.user, id: 'next-admin-1005' } };
  });
  await settle();
  out.userChangeRetiresNames = !(await modelText()).includes('Retired user radio');
  ready(topics[0], z2m('Retired permissions radio')); await deliver(state(topics[0])); await details('z2m').waitFor();
  await page.evaluate(() => {
    const c = window.__card; c.hass = { ...c.hass, user: { ...c.hass.user, is_admin: false } };
  });
  await settle();
  out.permissionLossRetiresNames = !(await modelText()).includes('Retired permissions radio');
  out.completed = true;
} catch (error) {
  console.error(error);
  evidence.failure = await page.evaluate(() => ({ loaded: window.__card._loadOk, busy: window.__card._loading,
    config: !!window.__card._serverCfg, text: window.__card.shadowRoot.innerHTML.slice(-4000) }));
  throw error;
} finally {
  writeFileSync(new URL('evidence.json', artifacts), JSON.stringify({ out, evidence, calls: server.calls }, null, 2));
  checkAll(out); await finish(browser, out);
}
