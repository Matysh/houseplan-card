import { makeDeviceOfflineFixture } from '../fixtures/device-offline.mjs';

/** Native data inputs through the same registry and accepted-response harness as HA. */
export async function installDeviceOfflineFixture(page) {
  const space = await page.evaluate(() => window.__card._space);
  const fixture = makeDeviceOfflineFixture(space);
  await page.evaluate(async fixture => {
    const card = window.__card;
    const area = card._spaceModel().rooms.find(room => room.area)?.area ?? null;
    for (const device of Object.values(fixture.devices)) window.__addRegistryDevice(
      device.id, device.name, device.model, area, { ...device, area_id: area });
    for (const [id, row] of Object.entries(fixture.entities)) {
      const state = fixture.states[id];
      window.__addRegistryEntity(id, null, state?.state ?? 'unknown', row.platform, row, state?.attributes ?? {});
    }
    const states = { ...window.__mkHass().states };
    for (const id of Object.keys(fixture.entities)) if (!fixture.states[id]) delete states[id];
    card.hass = { ...window.__mkHass(), states };
    await window.__hpTest.settled();
    const bindings = new Set(fixture.config.markers.map(marker => marker.binding));
    const existing = card._devices.filter(device => !bindings.has(device.marker?.binding
      ?? (device.bindingKind === 'virtual' ? 'virtual' : `${device.bindingKind}:${device.bindingRef}`)));
    await window.__hpTest.setServerConfig(config => {
      config.markers = [...existing.map(device => ({ ...device.marker, id: device.id,
        binding: device.marker?.binding ?? (device.bindingKind === 'virtual' ? 'virtual' : `${device.bindingKind}:${device.bindingRef}`), hidden: true })),
        ...fixture.config.markers];
      const space = config.spaces.find(item => item.id === fixture.config.spaces[0].id);
      space.led_strips = fixture.config.spaces[0].led_strips;
      config.settings = { ...config.settings, filter_seeded: true, known_devices: [], new_device_ids: [],
        marker_area_snapshot: { ...config.settings?.marker_area_snapshot,
          ...Object.fromEntries(fixture.config.markers.map(marker => [marker.id, { binding: marker.binding, area }])) } };
      return config;
    });
    await window.__hpTest.setLayout(layout => ({ ...layout, ...fixture.layout }));
    window.__offlineWrites = [];
    const callWS = card.hass.callWS;
    card.hass = { ...card.hass, callWS: async message => {
      if (/\/(?:set|update|copy|node_delete|node_move)$/.test(message.type)) window.__offlineWrites.push(structuredClone(message));
      return callWS(message);
    } };
    await window.__hpTest.settled();
  }, fixture);
  await waitDeviceOfflinePaint(page);
  return fixture;
}

/** Lit settles before native CSS transitions. Wait their real finite terminal, never disable them. */
export async function waitDeviceOfflinePaint(page) {
  await page.evaluate(async () => {
    await window.__hpTest.settled();
    const roots = [window.__card.renderRoot,
      document.querySelector('houseplan-space-card')?.renderRoot,
      window.__card.renderRoot.querySelector('hp-device-preview')?.renderRoot].filter(Boolean);
    const animations = roots.flatMap(root => [...root.querySelectorAll('.dev[data-id^=offline-],.dev')])
      .flatMap(node => node.getAnimations({ subtree: true }))
      .filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime));
    await Promise.allSettled(animations.map(animation => animation.finished));
  });
}

export async function setDeviceOfflineStates(page, updates) {
  await page.evaluate(updates => {
    const card = window.__card, states = { ...card.hass.states };
    for (const [id, state] of Object.entries(updates)) {
      if (state === null) delete states[id];
      else states[id] = { ...states[id], entity_id: id, state };
    }
    card.hass = { ...card.hass, states };
    const space = document.querySelector('houseplan-space-card');
    if (space) space.hass = card.hass;
  }, updates);
  await waitDeviceOfflinePaint(page);
}

/** The actual SVG LED ink, including ordinary off geometry and passive hit area. */
export async function readDeviceOfflineLeds(page) {
  return page.evaluate(() => Object.fromEntries(['off', 'unavailable', 'unknown'].map(key => {
    const root = window.__card.renderRoot.querySelector(`.led-strip[data-marker="offline-led-${key}"]`);
    if (!root) return [key, null];
    const path = selector => {
      const node = root.querySelector(selector); if (!node) return null;
      const style = getComputedStyle(node);
      return { d: node.getAttribute('d'), stroke: style.stroke, width: style.strokeWidth,
        opacity: style.opacity, strokeOpacity: style.strokeOpacity,
        dash: style.strokeDasharray, filter: style.filter };
    };
    return [key, { state: root.dataset.state, classes: root.getAttribute('class'),
      core: path('.led-core'), outline: path('.led-outline'), hit: path('.led-hit'),
      bodyMask: root.querySelector('.led-body')?.getAttribute('mask') }];
  })));
}

/** One independent computed-paint reader for full, static and preview surface oracles. */
export async function readDeviceOfflinePaint(page, ids, surface = 'full') {
  return page.evaluate(({ ids, surface }) => {
    const card = window.__card;
    const owner = surface === 'space' ? document.querySelector('houseplan-space-card')
      : surface === 'preview' ? card.renderRoot.querySelector('hp-device-preview') : card;
    const root = owner?.renderRoot ?? owner?.shadowRoot;
    if (!root) throw new Error(`offline fixture surface missing: ${surface}`);
    const result = {};
    for (const id of ids) {
      const marker = surface === 'preview' ? root.querySelector('.dev')
        : root.querySelector(`.dev[data-id="${id}"],.dev[data-led-badge="${id}"]`);
      if (!marker) { result[id] = null; continue; }
      const paint = node => {
        if (!node) return null;
        const style = getComputedStyle(node), rect = node.getBoundingClientRect();
        let effective = 1;
        for (let at = node; at; at = at.parentElement) {
          effective *= Number(getComputedStyle(at).opacity); if (at === marker) break;
        }
        return { opacity: Number(style.opacity), effective, color: style.color,
          background: style.backgroundColor, border: style.borderColor, shadow: style.boxShadow,
          visibility: style.visibility, rect: [rect.x, rect.y, rect.width, rect.height] };
      };
      const node = selector => marker.querySelector(selector);
      result[id] = { classes: marker.className, state: marker.dataset.state,
        parent: paint(marker), core: paint(node('.device-core')),
        glyph: paint(node('.device-core > ha-icon,.device-core > .valtext')), value: !!node('.device-core > .valtext'),
        badges: [...marker.querySelectorAll('.value-badge')].map(badge => ({ paint: paint(badge),
          content: paint(badge.querySelector('.value-badge-content')), text: badge.textContent.trim() })),
        frame: paint(node('.device-shell-frame')), contact: paint(node('.device-contact-ink')),
        battery: paint(node('.device-battery')), lqi: paint(node('.lqi')),
        own: card._devices.find(device => device.id === id)?.entities,
        controls: card._devices.find(device => device.id === id)?.controls,
        text: marker.textContent.replace(/\s+/g, ' ').trim() };
    }
    return { faces: result, writes: window.__offlineWrites.length, services: window.__serviceCalls.length };
  }, { ids, surface });
}
