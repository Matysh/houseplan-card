// #131: a read-only HA session may read the House Plan snapshot while HA
// rejects event subscriptions. The initial frame must still select one exact
// space and render every raw-space layer before any user click.
import { launch, checkAll, finish } from './serve.mjs';
import { makeVisualMatrixFixture } from './fixtures/visual-matrix.mjs';

const fixture = makeVisualMatrixFixture();
const { page, browser } = await launch({ width: 820, height: 760 });

const result = await page.evaluate(async (rawFixture) => {
  const out = {};
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const HP = customElements.get('houseplan-card');
  const host = document.getElementById('host');
  window.__card.remove();
  HP._warmBootReset?.();
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('houseplan_card_')) localStorage.removeItem(key);
  }
  history.replaceState(null, '', '/demo.html');

  const fixture = structuredClone(rawFixture);
  const lighting = fixture.config.spaces.find((space) => space.id === 'golden-lighting');
  const geometry = fixture.config.spaces.find((space) => space.id === 'golden-geometry');
  lighting.id = 'home';
  lighting.title = 'Home';
  lighting.settings = {
    ...lighting.settings,
    fill_mode: 'custom',
    custom_fill: { c: '#cdbb96', a: 0.42 },
    glow_enabled: true,
    show_borders: true,
  };
  lighting.decor = [{
    id: 'readonly-furniture', kind: 'rect', x: 0.16, y: 0.18, w: 0.12, h: 0.08,
    color: '#8d6e63', opacity: 1, width_cm: 2, fill: true,
    fill_color: '#bcaaa4', fill_opacity: 1,
  }];
  geometry.id = 'upstairs';
  geometry.title = 'Upstairs';
  fixture.config.spaces = [lighting, geometry];
  fixture.config.markers.push({
    id: 'golden-light-one', binding: 'device:golden-light-one', display: 'value',
  });
  fixture.layout = Object.fromEntries(Object.entries(fixture.layout).map(([id, pos]) => [
    id,
    { ...pos, s: pos.s === 'golden-lighting' ? 'home' : pos.s === 'golden-geometry' ? 'upstairs' : pos.s },
  ]));

  const base = window.__mkHass();
  const makeHass = (subscriptionMode = 'partial') => {
    const calls = { configGets: 0, events: {}, unsubscribed: [] };
    const connection = {
      subscribeEvents: async (callback, event) => {
        calls.events[event] = (calls.events[event] || 0) + 1;
        if (String(event).startsWith('houseplan_')
            && (subscriptionMode === 'reject-all'
              || event === 'houseplan_config_updated' || event === 'houseplan_trail_updated')) {
          throw new Error('unauthorized');
        }
        return () => { calls.unsubscribed.push(event); };
      },
      subscribeMessage: async () => () => {},
    };
    const hass = {
      ...base,
      user: { id: 'readonly', name: 'Readonly', is_admin: false },
      devices: fixture.devices,
      entities: fixture.entities,
      areas: fixture.areas,
      states: fixture.states,
      connection,
      callWS: async (message) => {
        if (message.type === 'houseplan/config/get') {
          calls.configGets += 1;
          return { config: structuredClone(fixture.config), rev: 131, can_write: false };
        }
        if (message.type === 'houseplan/layout/get') {
          return { layout: structuredClone(fixture.layout), rev: 131 };
        }
        if (message.type === 'houseplan/trail/get') return { trails: {} };
        if (message.type === 'config/device_registry/list') return Object.values(fixture.devices);
        if (message.type === 'config/entity_registry/list') return Object.values(fixture.entities);
        if (message.type === 'config_entries/get') {
          return [{ entry_id: 'golden_entry', domain: 'houseplan_golden', title: 'Golden' }];
        }
        if (message.type === 'manifest/list') {
          return [{ domain: 'houseplan_golden', name: 'Golden' }];
        }
        return { ok: true };
      },
    };
    return { hass, calls };
  };

  const layerSnapshot = (card) => {
    const root = card.shadowRoot || card.renderRoot;
    return {
      exactSpace: card._curSpaceCfg?.id || null,
      activeSpace: root.querySelector('[data-hp="space-tab"].active')?.getAttribute('data-id') || null,
      rooms: root.querySelectorAll('[data-hp="room"]').length,
      decor: root.querySelectorAll('[data-hp="decor"]').length,
      walls: root.querySelectorAll('.wallbodies .wallbody-fill').length,
      glow: root.querySelectorAll('.glow-spot').length,
      devices: root.querySelectorAll('[data-hp="device"]').length,
      values: root.querySelectorAll('[data-hp="device"] .valtext').length,
    };
  };
  const complete = (snapshot) => snapshot.exactSpace === 'home'
    && snapshot.activeSpace === 'home' && snapshot.rooms > 0 && snapshot.decor > 0
    && snapshot.walls > 0 && snapshot.glow > 0 && snapshot.devices > 0 && snapshot.values > 0;
  const waitForCard = async (card, calls, kiosk = false) => {
    const until = performance.now() + 9000;
    while (performance.now() < until) {
      const snapshot = layerSnapshot(card);
      const allSubscriptionsTried = ['houseplan_config_updated', 'houseplan_trail_updated', 'houseplan_layout_updated']
        .every((event) => calls.events[event] === 1);
      if (card._loadOk && !card._loading && card._booting === false
          && allSubscriptionsTried && complete({
            ...snapshot,
            activeSpace: kiosk ? 'home' : snapshot.activeSpace,
          })) return snapshot;
      await sleep(25);
    }
    throw new Error(`readonly card did not settle: ${JSON.stringify({
      state: layerSnapshot(card), calls, space: card._space, loadOk: card._loadOk,
    })}`);
  };
  const mount = async (title, options = {}) => {
    const runtime = makeHass(options.subscriptionMode);
    const card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card', title, kiosk: !!options.kiosk });
    host.appendChild(card);
    card.hass = runtime.hass;
    const snapshot = await waitForCard(card, runtime.calls, !!options.kiosk);
    return { card, snapshot, ...runtime };
  };

  const cold = await mount('Readonly cold start');
  out.coldSelectsExactSpace = cold.card._space === 'home'
    && cold.snapshot.exactSpace === 'home' && cold.snapshot.activeSpace === 'home';
  out.coldRendersAllSpatialLayers = complete(cold.snapshot);
  out.readOnlyStaysReadOnly = cold.card._canEdit === false
    && !(cold.card.shadowRoot || cold.card.renderRoot).querySelector('.modetab');
  out.allSubscriptionsAttempted = ['houseplan_config_updated', 'houseplan_trail_updated', 'houseplan_layout_updated']
    .every((event) => cold.calls.events[event] === 1);
  out.allowedSubscriptionAdopted = typeof cold.card._unsubLayout === 'function'
    && !cold.card._unsubCfg && !cold.card._unsubTrail;
  out.cacheWritten = !!localStorage.getItem('houseplan_card_cfg_v1');
  const beforeClick = layerSnapshot(cold.card);
  cold.card._pickSpace('home');
  await cold.card.updateComplete;
  out.activeTabClickIsNoop = JSON.stringify(layerSnapshot(cold.card)) === JSON.stringify(beforeClick);
  await sleep(700);
  out.optionalFailureNoFullRetry = cold.calls.configGets === 1;
  cold.card.remove();
  await sleep(20);
  out.successfulSubscriptionCleanedUp = cold.calls.unsubscribed.includes('houseplan_layout_updated');

  const warm = await mount('Readonly cold start');
  out.warmRemountKeepsCompleteSpace = complete(warm.snapshot) && warm.card._space === 'home';
  warm.card.remove();
  await sleep(20);

  HP._warmBootReset?.();
  const reload = await mount('Readonly simulated reload');
  out.cachedReloadKeepsCompleteSpace = complete(reload.snapshot) && reload.card._space === 'home';
  reload.card.remove();
  await sleep(20);

  HP._warmBootReset?.();
  localStorage.removeItem('houseplan_card_cfg_v1');
  localStorage.removeItem('houseplan_card_nav_v1');
  const kiosk = await mount('Readonly cold kiosk', { kiosk: true, subscriptionMode: 'reject-all' });
  const kioskRoot = kiosk.card.shadowRoot || kiosk.card.renderRoot;
  out.coldKioskCompleteWithoutHeaderAction = kiosk.card._space === 'home'
    && kiosk.snapshot.exactSpace === 'home' && kiosk.snapshot.rooms > 0
    && kiosk.snapshot.decor > 0 && kiosk.snapshot.walls > 0 && kiosk.snapshot.glow > 0
    && kiosk.snapshot.devices > 0 && getComputedStyle(kioskRoot.querySelector('.hdr')).display === 'none';
  out.kioskCacheWritten = !!localStorage.getItem('houseplan_card_cfg_v1');
  kiosk.card.remove();

  return out;
}, fixture);

checkAll(result);
await finish(browser, result);
