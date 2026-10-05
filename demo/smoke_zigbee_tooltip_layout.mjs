// #802: real pointer + public HA/config inputs. No private card writes: the
// fixture delivers registry events and the integration's normal topology feed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, checkAll, finish } from './serve.mjs';

const artifacts = new URL('../artifacts/zigbee-topology-802/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
const out = {};
const evidence = [];
const ieee = (n) => `00124b000000000${n}`;
const remoteName = 'Landing <router> & "night light"';
const nodes = [
  ['d_light1', 1, 1, 'Router'], ['d_lamp', 2, 0, 'Coordinator'],
  ['d_mower', 3, 3, 'EndDevice'], ['d_temp', 4, 4, 'EndDevice'],
  ['not_on_plan', 6, 6, 'Router'], ['d_kettle', 7, 7, 'EndDevice'],
];
const z2m = {
  nodes: nodes.map(([id, n, nwk, type]) => ({ ieeeAddr: ieee(n), networkAddress: nwk, type,
    friendlyName: id === 'not_on_plan' ? 'Unplaced <router> & target' : 'Provider target' })),
  links: [
    { source: ieee(2), target: ieee(1), linkquality: 130, routes: [
      { destinationAddress: 0, nextHopAddress: 0, status: 'ACTIVE' },
    ] },
    { source: ieee(1), target: ieee(3), relationship: 'Parent', linkquality: 140 },
    { source: ieee(6), target: ieee(4), relationship: 'Parent', linkquality: 90 },
    { source: ieee(2), target: ieee(6), linkquality: 110, routes: [
      { destinationAddress: 0, nextHopAddress: 0, status: 'ACTIVE' },
    ] },
  ],
};
const zha = nodes.map(([id, n, nwk, type]) => ({ ieee: ieee(n), nwk, device_reg_id: id,
  device_type: type, name: id === 'not_on_plan' ? 'Unplaced <router> & target' : 'Provider target',
  neighbors: n === 3 ? [{ ieee: ieee(1), relationship: 'Parent', lqi: 140 }]
    : n === 4 ? [{ ieee: ieee(6), relationship: 'Parent', lqi: 90 }] : [],
  ...(n === 1 || n === 6 ? { routes: [{ dest_nwk: 0, next_hop: 0, route_status: 'Active' }] } : {}),
}));

for (const provider of ['z2m', 'zha']) {
  const { page, browser } = await launch({ width: 1100, height: 900 });
  const root = page.locator('#host > houseplan-card');
  const marker = (id) => root.locator(`[data-hp="device"][data-id="${id}"]`);
  const bubble = root.locator('[data-hp="zigbee-topology-parent-bubble"]');
  const settle = () => page.evaluate(() => window.__hpTest.settled());
  let pointer;
  const hover = async (id, vertical = 0.5) => {
    await page.mouse.move(2, 2);
    const box = await marker(id).boundingBox();
    if (!box) throw new Error(`missing marker ${id}`);
    pointer = { x: box.x + box.width / 2, y: box.y + box.height * vertical };
    await page.mouse.move(pointer.x, pointer.y);
    await settle();
  };
  const sample = async (id) => page.evaluate((id) => {
    const card = window.__card;
    const root = card.shadowRoot;
    const topology = root.querySelector('hp-zigbee-topology-overlay');
    const tip = root.querySelector('[data-hp-live-tip]');
    const rect = (element) => {
      const r = element.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const visible = (element) => !!element && !element.hidden && element.getBoundingClientRect().width > 0
      && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden';
    const stage = rect(root.querySelector('.stage'));
    const bounds = { left: Math.max(stage.left, 0), top: Math.max(stage.top, 0),
      right: Math.min(stage.right, innerWidth), bottom: Math.min(stage.bottom, innerHeight) };
    const source = rect(root.querySelector(`[data-hp="device"][data-id="${id}"]`));
    const badges = [...(topology?.shadowRoot?.querySelectorAll('.parent-bubble,.remote,.route-status') || [])]
      .filter(visible).map((element) => ({ rect: rect(element), text: element.textContent.trim(),
        kind: element.className, pointerEvents: getComputedStyle(element).pointerEvents }));
    const tipRect = tip ? rect(tip) : null;
    const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const tipVisible = visible(tip);
    const badgesDisjoint = badges.every((badge, i) => badges.slice(i + 1)
      .every((other) => overlap(badge.rect, other.rect) < 0.5));
    const inside = (r) => r.left >= bounds.left - 1 && r.top >= bounds.top - 1
      && r.right <= bounds.right + 1 && r.bottom <= bounds.bottom + 1;
    const sourceElement = root.querySelector(`[data-hp="device"][data-id="${id}"]`);
    const floor = sourceElement.getAttribute('data-hp-iso-floor')?.split(',').map(Number);
    const visual = sourceElement.getAttribute('data-hp-iso-visual')?.split(',').map(Number);
    return { source, bounds, badges, tip: tipRect, tipVisible,
      projectionIso: root.querySelector('.stage').classList.contains('projection-iso'),
      isoWalls: !!root.querySelector('[data-hp="iso-walls"]'),
      sourceRaised: floor?.length === 2 && visual?.length === 2
        && Math.hypot(floor[0] - visual[0], floor[1] - visual[1]) > 0.1,
      tipText: tip?.textContent || '', badgesDisjoint,
      clean: tipVisible && badges.length > 0 && badges.every((badge) => overlap(tipRect, badge.rect) < 0.5)
        && overlap(tipRect, source) < 0.5 && inside(tipRect),
      badgeInside: badges.every((badge) => inside(badge.rect)),
      pointerTransparent: !!topology && getComputedStyle(topology).pointerEvents === 'none'
        && badges.every((badge) => badge.pointerEvents === 'none'),
      safeText: !topology?.shadowRoot?.querySelector('router,img,script'),
      endpoint: root.querySelector(`[data-hp="device"][data-id="${id}"]`)?.hasAttribute('data-hp-zigbee-topology-endpoint'),
      lines: [...(topology?.shadowRoot?.querySelectorAll('line,polygon') || [])].map((element) =>
        ['x1', 'x2', 'y1', 'y2', 'points'].map((name) => element.getAttribute(name)).join(',')),
      calls: { ...window.__tooltipFixture.calls },
    };
  }, id);
  const witness = async (name, id, { hidden = false } = {}) => {
    const value = await sample(id);
    evidence.push({ provider, name, ...value });
    out[`${provider}_${name}`] = value.badgesDisjoint
      && (hidden ? !value.tipVisible && value.badges.length > 0 : value.clean);
    return value;
  };
  const deliver = async (options = {}) => page.evaluate((options) => {
    const fixture = window.__tooltipFixture;
    if (options.name !== undefined) {
      fixture.devices.d_light1 = { ...fixture.devices.d_light1,
        name_by_user: options.name, name: options.registryName ?? '' };
      window.__card.hass = { ...window.__card.hass, devices: { ...fixture.devices } };
      for (const callback of fixture.registryCallbacks) callback({ action: 'update', device_id: 'd_light1' });
    }
    if (options.clear) fixture.result = null;
    else if (options.restore) fixture.result = fixture.originalResult;
    if (options.providerName !== undefined && fixture.result) {
      fixture.result = structuredClone(fixture.result);
      fixture.result.nodes[0].friendlyName = options.providerName;
    }
    fixture.phase = options.phase || 'ready';
    fixture.stale = options.stale === true;
    for (const callback of fixture.callbacks) callback(fixture.event());
  }, options);
  try {
    // A delayed overlay chunk makes the first hover occur before upgrade. The
    // source pointer stays still while the public backend reset supplies data.
    let releaseOverlay;
    let overlayWasDelayed = false;
    const overlayReady = new Promise((resolve) => { releaseOverlay = resolve; });
    if (provider === 'z2m') await page.route('**/*hp-zigbee-topology-overlay*.js', async (route) => {
      overlayWasDelayed = true;
      await overlayReady; await route.fallback();
    });
    await page.evaluate(async ({ provider, nodes, z2m, zha, remoteName }) => {
      const card = window.__card;
      const original = card.hass;
      const fixture = { devices: structuredClone(original.devices), callbacks: new Set(), registryCallbacks: new Set(),
        calls: { zha: 0, start: 0, subscriptions: 0 }, revision: 0, phase: 'ready', stale: false,
        result: provider === 'z2m' ? z2m : null, originalResult: z2m, zha };
      for (const [id, n] of nodes) if (fixture.devices[id]) fixture.devices[id].identifiers = [['zha', `00124b000000000${n}`]];
      fixture.devices.d_light1 = { ...fixture.devices.d_light1, name_by_user: remoteName };
      fixture.event = () => fixture.result ? {
        kind: 'state', session_id: 'tooltip-802', revision: ++fixture.revision,
        provider: { topic: 'zigbee2mqtt', job_id: 'fixture', phase: fixture.phase, elapsed_ms: 1200,
          obtained_at: Date.now() - (fixture.stale ? 360000 : 0), stale: fixture.stale,
          ...(fixture.phase === 'error' ? { error: 'provider' } : {}), result: fixture.result },
      } : { kind: 'removed', session_id: 'tooltip-802', revision: ++fixture.revision, topic: 'zigbee2mqtt' };
      const connection = { ...original.connection,
        subscribeEvents: async (callback, type) => {
          if (type === 'device_registry_updated') fixture.registryCallbacks.add(callback);
          const release = await original.connection.subscribeEvents(callback, type);
          return () => { fixture.registryCallbacks.delete(callback); release(); };
        },
        subscribeMessage: async (callback, message) => {
          if (message.type !== 'houseplan/zigbee/subscribe') return original.connection.subscribeMessage(callback, message);
          fixture.calls.subscriptions++;
          fixture.callbacks.add(callback);
          callback({ kind: 'reset', session_id: 'tooltip-802', revision: fixture.revision,
            topics: fixture.result ? ['zigbee2mqtt'] : [] });
          if (fixture.result) callback(fixture.event());
          return () => fixture.callbacks.delete(callback);
        },
      };
      card.hass = { ...original, devices: fixture.devices, connection,
        callWS: async (message) => {
          if (message.type === 'config/device_registry/list') return Object.values(fixture.devices);
          if (message.type === 'zha/devices') { fixture.calls.zha++; return fixture.zha; }
          if (message.type === 'houseplan/zigbee/start') { fixture.calls.start++; return fixture.event(); }
          const response = await original.callWS(message);
          return message.type === 'houseplan/config/get' ? { ...response, zigbee_scan_api: 1 } : response;
        },
      };
      window.__tooltipFixture = fixture;
      document.getElementById('host').style.width = '900px';
      await window.__hpTest.setServerConfig((cfg) => {
        cfg.settings = { ...cfg.settings, zigbee_topology: { enabled: true, z2m_base_topics: ['zigbee2mqtt'] } };
        cfg.spaces = cfg.spaces.map((space) => ({ ...space,
          settings: { ...space.settings, show_borders: true, show_names: true },
        }));
        return cfg;
      });
      await window.__hpTest.setLayout((layout) => ({ ...layout,
        d_kettle: { s: 'f1', x: 0.50, y: 0.40 }, d_temp: { s: 'f1', x: 0.22, y: 0.62 },
        d_light1: { s: 'f1', x: 0.25, y: 0.27 }, d_mower: { s: 'garden', x: 0.50, y: 0.48 },
      }));
    }, { provider, nodes, z2m, zha, remoteName });
    if (provider === 'zha') {
      await page.evaluate(() => window.__hpTest.setMode('plan'));
      await root.locator('[data-hp="settings"]').click();
      await root.locator('hp-zigbee-topology-settings').getByRole('button', { name: /Read ZHA/ }).click();
      await page.waitForFunction(() => window.__tooltipFixture.calls.zha === 1);
      await page.evaluate(() => window.__hpTest.close());
      await page.evaluate(() => window.__hpTest.setMode('view'));
    }
    await page.evaluate(() => window.__hpTest.switchSpace('garden'));
    await hover('d_mower');
    if (provider === 'z2m') out.mouseReallyPrecedesLazyUpgrade = overlayWasDelayed && await page.evaluate(() =>
      !customElements.get('hp-zigbee-topology-overlay')
      && !window.__card.shadowRoot.querySelector('[data-hp-live-tip]').hidden);
    releaseOverlay();
    await bubble.waitFor({ state: 'visible' });
    await settle();
    out[`${provider}_remoteCaption`] = (await bubble.innerText()).trim() === `Ground floor (${remoteName})`;
    const remote = await witness(provider === 'z2m' ? 'firstHoverAfterLazyUpgrade' : 'firstMouseHover', 'd_mower');
    out[`${provider}_safeTextAndPointerTransparent`] = remote.safeText && remote.pointerTransparent;
    await page.screenshot({ path: fileURLToPath(new URL(`${provider}-remote-caption.png`, artifacts)) });

    if (provider === 'z2m') {
      for (const [name, registryName, providerName, expected] of [
        [' ', 'Registry target', 'Provider target', 'Ground floor (Registry target)'],
        [' ', ' ', 'Provider target', 'Ground floor (Provider target)'],
        [' ', ' ', ' ', 'Ground floor'],
      ]) {
        await deliver({ name, registryName, providerName });
        await page.waitForTimeout(300);
        await hover('d_mower');
        await page.waitForFunction((expected) => window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay')
          ?.shadowRoot?.querySelector('.parent-bubble')?.textContent.trim() === expected, expected);
        out[`${provider}_nameFallback_${expected}`] = (await bubble.innerText()).trim() === expected;
      }
      await deliver({ name: remoteName });
      await page.evaluate(() => window.__hpTest.setServerConfig((cfg) => {
        cfg.spaces.find((space) => space.id === 'f1').title = ''; return cfg;
      }));
      await hover('d_mower');
      out.z2m_missingSpaceTitle = (await bubble.innerText()).trim() === `another space (${remoteName})`;
      await page.evaluate(() => window.__hpTest.setServerConfig((cfg) => {
        cfg.spaces.find((space) => space.id === 'f1').title = 'Ground floor'; return cfg;
      }));

      for (const iso of [false, true]) for (const theme of ['light', 'dark']) {
        await page.evaluate(async ({ iso, theme }) => {
          await window.__hpTest.setVolumetricView(iso);
          const card = window.__card;
          card.hass = { ...card.hass, themes: { ...card.hass.themes, darkMode: theme === 'dark' } };
          for (const [key, value] of Object.entries(theme === 'light' ? {
            '--card-background-color': '#ffffff', '--ha-card-background': '#ffffff',
            '--primary-text-color': '#202020', '--secondary-text-color': '#606060',
          } : { '--card-background-color': '#1c2530', '--ha-card-background': '#1c2530',
            '--primary-text-color': '#e1e1e1', '--secondary-text-color': '#9aa4ad' })) card.style.setProperty(key, value);
        }, { iso, theme });
        await page.evaluate(() => window.__hpTest.switchSpace('f1'));
        for (const [id, name] of [['d_temp', 'unplaced'], ['d_light1', 'remote-count'], ['d_kettle', 'status-only']]) {
          await hover(id, 0.25);
          await root.locator('.route-status').waitFor({ state: 'visible' });
          const value = await witness(`${iso ? 'iso' : 'flat'}_${theme}_${name}`, id);
          out[`actualProjection_${iso}_${theme}_${name}`] = value.projectionIso === iso
            && (!iso || (value.isoWalls && value.sourceRaised));
          if (name === 'remote-count') out[`remoteCount_${iso}_${theme}`] = value.badges.some((badge) => /1/.test(badge.text) && badge.kind === 'remote');
          if (name === 'status-only') {
            out[`statusOnlyHasNoEndpoint_${iso}_${theme}`] = !value.endpoint && value.lines.length === 0
              && value.badges.some((badge) => /No route data/.test(badge.text));
            await page.screenshot({ path: fileURLToPath(new URL(`status-only-${iso ? 'iso' : 'flat'}-${theme}.png`, artifacts)) });
            if (!iso && theme === 'light') {
              // Recreate only the old display position, not product state. The
              // same intersection oracle must reject the original defect.
              const negative = await page.evaluate(({ x, y }) => {
                const tip = window.__card.shadowRoot.querySelector('[data-hp-live-tip]');
                const before = tip.getAttribute('style');
                tip.style.left = `${Math.min(innerWidth - tip.offsetWidth - 8, x + 12)}px`;
                tip.style.top = `${Math.min(innerHeight - tip.offsetHeight - 8, y + 12)}px`;
                return before;
              }, pointer);
              const oldPlacement = await sample(id);
              evidence.push({ provider, name: 'negative-control-cursor-plus-12', ...oldPlacement });
              out.oldPlacementNegativeControlFails = !oldPlacement.clean && oldPlacement.tipVisible
                && oldPlacement.badges.some(({ rect }) => Math.max(0, Math.min(rect.right, oldPlacement.tip.right)
                  - Math.max(rect.left, oldPlacement.tip.left)) * Math.max(0, Math.min(rect.bottom, oldPlacement.tip.bottom)
                    - Math.max(rect.top, oldPlacement.tip.top)) > 10);
              await page.screenshot({ path: fileURLToPath(new URL('negative-control-old-placement.png', artifacts)) });
              await root.locator('[data-hp-live-tip]').evaluate((tip, style) => tip.setAttribute('style', style), negative);
            }
          }
        }
      }
      // Live provider status arrives while the mouse remains stationary.
      await deliver({ phase: 'error', stale: true });
      await page.waitForFunction(() => /Stale data/i.test(window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay')
        ?.shadowRoot?.querySelector('.route-status')?.textContent || ''));
      await settle();
      const changed = await witness('runtimeErrorStaleNoPointerMove', 'd_kettle');
      out.runtimeIncludesPartialStaleError = changed.badges.some((badge) => /Incomplete data/.test(badge.text)
        && /Stale data/i.test(badge.text) && /could not be loaded/i.test(badge.text));
      await deliver();
      await page.evaluate(() => window.__hpTest.setVolumetricView(false));
      await page.evaluate(() => window.__hpTest.switchSpace('garden'));
      const longName = ('Long landing router <safe> & ' + 'north corridor diagnostic lighting '.repeat(5)).trim();
      await deliver({ name: longName });
      await page.waitForTimeout(300);
      await hover('d_mower');
      const long = await witness('longName', 'd_mower');
      out.longNameWrapsInsideStage = long.badgeInside && long.safeText
        && long.badges.some((badge) => badge.text.includes(longName) && badge.rect.height > 25);
      await page.screenshot({ path: fileURLToPath(new URL('long-remote-caption.png', artifacts)) });
      // Freeze the fixture header/stage height so horizontal container resize
      // cannot move the marker away and create an unrelated native pointerout.
      await deliver({ name: remoteName });
      await page.evaluate(() => {
        const style = document.createElement('style');
        style.textContent = '.head{height:100px!important;min-height:100px!important;max-height:100px!important;overflow:hidden}.stage{height:400px!important;min-height:400px!important;max-height:400px!important}';
        window.__card.shadowRoot.append(style);
      });
      await page.waitForTimeout(150);
      await hover('d_mower');
      const beforeResize = await sample('d_mower');
      await page.evaluate(() => { document.getElementById('host').style.width = '95px'; });
      await page.waitForTimeout(150);
      await witness('narrowHidesOnlyOrdinaryTip', 'd_mower', { hidden: true });
      await page.screenshot({ path: fileURLToPath(new URL('narrow-priority.png', artifacts)) });
      await deliver({ clear: true }); await settle();
      const narrowWithoutBadges = await sample('d_mower');
      out.removingBadgesRestoresHiddenTipWithoutNewHover = narrowWithoutBadges.tipVisible
        && narrowWithoutBadges.badges.length === 0;
      await deliver({ restore: true }); await settle();
      await witness('returningBadgesReappliesNarrowFallback', 'd_mower', { hidden: true });
      await page.evaluate(() => { document.getElementById('host').style.width = '900px'; });
      await page.waitForTimeout(150);
      const restored = await witness('resizeRestoresWithoutNewHover', 'd_mower');
      out.resizePreservesSourceAndRoute = JSON.stringify(restored.source) === JSON.stringify(beforeResize.source)
        && JSON.stringify(restored.lines) === JSON.stringify(beforeResize.lines);
      await deliver({ clear: true });
      await settle();
      const removed = await sample('d_mower');
      out.removingDiagnosticsRestoresOrdinaryTip = removed.tipVisible && removed.badges.length === 0;
      await deliver({ restore: true, name: remoteName });
      await hover('d_mower');
      const networkBefore = JSON.stringify((await sample('d_mower')).calls);
      for (let i = 0; i < 12; i++) await page.mouse.move(pointer.x + i % 3, pointer.y + i % 2);
      out.pointerMotionNeverFetches = JSON.stringify((await sample('d_mower')).calls) === networkBefore;
      await page.mouse.move(2, 2); await settle();
      const left = await sample('d_mower');
      out.pointerLeaveClearsBoth = !left.tipVisible && left.badges.length === 0;
      await page.evaluate(() => window.__hpTest.switchSpace('f1'));
      await hover('d_tv');
      const ordinary = await sample('d_tv');
      out.nonZigbeeRetainsOrdinaryTooltip = ordinary.tipVisible && ordinary.badges.length === 0;
      await page.evaluate(() => window.__hpTest.switchSpace('garden'));
      await page.evaluate(() => window.__hpTest.setLayout((layout) => ({ ...layout,
        d_mower: { s: 'garden', x: 0.94, y: 0.12 },
      })));
      await hover('d_mower');
      const edge = await witness('edgeCaption', 'd_mower');
      out.edgeCaptionInsideWorkingArea = edge.badgeInside;
      await page.mouse.wheel(0, -180);
      await page.waitForTimeout(450);
      const zoomed = await witness('cameraZoomWithoutNewHover', 'd_mower');
      out.cameraActuallyChangesGeometry = Math.abs(edge.source.width - zoomed.source.width) > 0.1
        || Math.abs(edge.source.left - zoomed.source.left) > 0.1;
      await page.screenshot({ path: fileURLToPath(new URL('edge-zoom.png', artifacts)) });
      // A second production card shares the HA connection/runtime but owns its
      // own pointer/focus tip and layout observers.
      await page.evaluate(() => {
        const second = document.createElement('houseplan-card');
        second.id = 'second-tooltip-card';
        second.setConfig({ type: 'custom:houseplan-card', icon_size: 3.4 });
        second.hass = window.__card.hass;
        second.style.cssText = 'position:fixed;left:5px;top:5px;width:350px;z-index:100';
        document.body.append(second);
      });
      const second = page.locator('#second-tooltip-card');
      await second.locator('[data-hp="device"]').first().waitFor({ state: 'visible' });
      await second.locator('[data-hp="device"]').first().focus();
      await page.keyboard.press('Tab');
      await settle();
      out.secondCardKeyboardTipDoesNotActivateTopology = await second.evaluate((card) => {
        const root = card.shadowRoot;
        return root.activeElement?.matches('[data-hp="device"]:focus-visible')
          && !root.querySelector('[data-hp-live-tip]').hidden
          && !root.querySelector('hp-zigbee-topology-overlay')?.shadowRoot?.querySelector('.parent-bubble,.remote,.route-status');
      });
      await hover('d_mower');
      const firstWithSecond = await sample('d_mower');
      await second.evaluate((card) => card.remove());
      await settle();
      const afterSecondRemoved = await sample('d_mower');
      out.secondCardUnmountDoesNotClearFirstHover = firstWithSecond.clean && afterSecondRemoved.clean
        && JSON.stringify(firstWithSecond.badges) === JSON.stringify(afterSecondRemoved.badges);
      for (const pointerType of ['touch', 'pen']) {
        await marker('d_mower').dispatchEvent('pointerdown', { pointerType, pointerId: 82,
          bubbles: true, composed: true, clientX: pointer.x, clientY: pointer.y });
        await settle();
        const cleared = await sample('d_mower');
        out[`${pointerType}ClearsTooltipAndTopology`] = !cleared.tipVisible && cleared.badges.length === 0;
        await hover('d_mower');
        await witness(`mouseRestoresAfter_${pointerType}`, 'd_mower');
      }
      await page.mouse.move(2, 2);
      await page.keyboard.press('Tab');
      await marker('d_mower').focus();
      await settle();
      const keyboardOnly = await sample('d_mower');
      out.focusAloneShowsOrdinaryTipWithoutTopology = keyboardOnly.tipVisible && keyboardOnly.badges.length === 0
        && await marker('d_mower').evaluate((element) => element.matches(':focus-visible'));
      await hover('d_mower');
      await witness('focusedDeviceMouseDiagnostics', 'd_mower');
      await page.mouse.move(2, 2); await settle();
      const focusRestored = await sample('d_mower');
      out.pointerLeaveRestoresKeyboardTipAfterDiagnostics = focusRestored.tipVisible
        && focusRestored.tipText === keyboardOnly.tipText && focusRestored.badges.length === 0;
      await marker('d_mower').evaluate((element) => element.blur());
    }
  } catch (error) {
    out[`${provider}_completed`] = false;
    console.error(error);
    await page.screenshot({ path: fileURLToPath(new URL(`${provider}-failure.png`, artifacts)) });
  } finally {
    // Keep the shared smoke page-error guard authoritative for both browsers.
    await finish(browser);
  }
}
writeFileSync(new URL('layout-evidence.json', artifacts), JSON.stringify({ out, evidence }, null, 2));
checkAll(out);
await finish(null, out);
