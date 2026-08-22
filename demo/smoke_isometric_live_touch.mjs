// #122 Stage 2: live-floor preservation, vertical openings, touch and remount paths.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch(
  { width: 430, height: 820 }, 1, [], { hasTouch: true, isMobile: true },
);
const out = await page.evaluate(async () => {
  const original = window.__card;
  const root = (card) => card.renderRoot;
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  history.replaceState(null, '', '?hp-labs=iso#space=f1');
  dispatchEvent(new HashChangeEvent('hashchange'));
  if (typeof original._onLabsSnapshot !== 'function') throw new Error('missing Labs fixture hook');
  const testOnlyIso = Object.freeze(['iso']);
  // The product registry remains expired; this direct snapshot exercises the
  // dormant Stage 2 renderer and is removed by the real -iso path below.
  original._onLabsSnapshot({ active: testOnlyIso, space: '' });
  window.__hpLabs = testOnlyIso;
  await original.updateComplete;
  const configSpace = original._serverCfg.spaces.find((space) => space.id === 'f1');
  configSpace.settings = {
    ...(configSpace.settings || {}), fill_mode: 'custom',
    custom_fill: { c: '#31465f', a: 0.42 }, glow_enabled: true,
    show_borders: true, show_names: true, north_deg: 0, sun_rays: true,
  };
  configSpace.rooms[0].settings = {
    ...(configSpace.rooms[0].settings || {}), fill_mode: 'none', glow: true,
  };
  configSpace.openings = [
    { id: 'iso-window', type: 'window', x: 0.28, y: 0.14, angle: 0, length: 0.12,
      contact: 'binary_sensor.window' },
    { id: 'iso-door', type: 'door', x: 0.55, y: 0.36, angle: 90, length: 0.12,
      contact: 'binary_sensor.window', lock: 'lock.front_door' },
    { id: 'iso-gate', type: 'gate', x: 0.72, y: 0.14, angle: 0, length: 0.16,
      contact: 'binary_sensor.gate', lock: 'lock.front_door' },
  ];
  configSpace.partitions = [{
    id: 'iso-live-wall', a: [0.15, 0.12], b: [0.85, 0.12], cm: 15,
  }];
  configSpace.decor = [
    { id: 'iso-line', kind: 'line', x1: 0.12, y1: 0.7, x2: 0.45, y2: 0.7,
      color: '#667788', opacity: 0.7, width_cm: 1 },
    { id: 'iso-sofa', kind: 'furniture', symbol: 'sofa', x: 0.62, y: 0.55,
      w: 0.2, h: 0.12, color: '#667788', opacity: 0.7, width_cm: 1 },
  ];
  original._serverCfg.markers = original._serverCfg.markers || [];
  original._serverCfg.markers.push({
    id: 'iso-vacuum', binding: 'device:d_mower', space: 'f1', area: 'living_room',
    vacuum: {
      source: 'camera.static_robot_map', trail_mode: 'always',
      calibration: { m1: [0.5, 0, 0, 0, 0.5, 0] },
    },
  });
  original._layout['iso-vacuum'] = { s: 'f1', x: 0.18, y: 0.78 };
  original._hoverRoom = { space: 'f1', room: original._spaceModel('f1').rooms[0] };
  original.hass = {
    ...original.hass,
    states: {
      ...original.hass.states,
      'light.floor_lamp': {
        ...original.hass.states['light.floor_lamp'], state: 'on',
      },
      'vacuum.mower': {
        ...original.hass.states['vacuum.mower'], state: 'cleaning',
      },
      'camera.static_robot_map': {
        entity_id: 'camera.static_robot_map', state: 'idle',
        attributes: {
          map_name: 'm1', vacuum_position: { x: 650, y: 700, a: 0 },
          path: [[200, 200], [420, 440], [650, 700]],
        },
      },
      'sun.sun': {
        entity_id: 'sun.sun', state: 'above_horizon',
        attributes: { azimuth: 0, elevation: 24 },
      },
    },
  };
  original._cfgEpoch++;
  original._regSignature = '';
  original.requestUpdate();
  await original.updateComplete;
  await frame();

  const count = (selector) => root(original).querySelectorAll(selector).length;
  const layers = () => ({
    rooms: count('[data-hp="room"]'),
    roomFills: count('[data-hp="room"].filled'),
    decor: count('.decorlayer [data-hp="decor"]'),
    furniture: count('.decorlayer .dfurn'),
    backdrop: count('.hp-backdrop'),
    glowBase: count('.glow-base-layer .glow-base'),
    glowSources: count('.glowlayer [data-glow-source]'),
    sun: count('.sunlayer'),
    openings: count('[data-hp="opening"]'),
    verticalOpenings: count('[data-hp="iso-openings"] .iso-opening-panel'),
    devices: count('[data-hp="device"]'),
    hover: count('.room-hover-fill'),
    vacuumPucks: count('.vacpuck'),
    vacuumTrails: count('.vactrail .case'),
  });
  const flat = layers();
  const flatSpillParts = [...root(original).querySelectorAll('.glow-pool')]
    .map((node) => node.getAttribute('data-lit-parts'));
  root(original).querySelector('[data-hp="projection-toggle"]')?.click();
  await original.updateComplete;
  await frame();

  const before = layers();
  const beforeSpillParts = [...root(original).querySelectorAll('.glow-pool')]
    .map((node) => node.getAttribute('data-lit-parts'));
  const wallFingerprint = root(original).querySelector('[data-hp="iso-walls"]')?.dataset.fingerprint;
  const cachedGeometry = original._isoGeometryCache.get(wallFingerprint)?.geometry;
  const light = original.hass.states['light.ceiling'];
  const openingPanelBefore = root(original)
    .querySelector('[data-hp="iso-openings"] [data-id="iso-door"]')?.getAttribute('d');
  original.hass = {
    ...original.hass,
    states: {
      ...original.hass.states,
      'light.ceiling': {
        ...light, attributes: { ...light.attributes, rgb_color: [255, 64, 32] },
      },
      'binary_sensor.window': {
        ...original.hass.states['binary_sensor.window'], state: 'off',
      },
    },
  };
  await original.updateComplete;
  const after = layers();
  const afterSpillParts = [...root(original).querySelectorAll('.glow-pool')]
    .map((node) => node.getAttribute('data-lit-parts'));
  const ordered = [
    root(original).querySelector('.iso-underlay-svg'),
    root(original).querySelector('.hp-backdrop'),
    root(original).querySelector('[data-hp="room"]'),
    root(original).querySelector('.glow-base-layer'),
    root(original).querySelector('.decorlayer'),
    root(original).querySelector('.glowlayer'),
    root(original).querySelector('.sunlayer'),
    root(original).querySelector('.iso-shadows-svg'),
    root(original).querySelector('.iso-walls-svg'),
    root(original).querySelector('.vacpuck'),
  ];
  const result = {
    isoOnTouch: !!root(original).querySelector('[data-hp="iso-walls"]'),
    flatIsoLayerParity: JSON.stringify({ ...flat, openings: 0, verticalOpenings: before.verticalOpenings })
        === JSON.stringify(before)
      && JSON.stringify(flatSpillParts) === JSON.stringify(beforeSpillParts),
    liveLayersPresent: before.rooms > 0 && before.roomFills > 0 && before.decor >= 2
      && before.furniture > 0 && before.backdrop > 0 && before.glowBase > 0
      && before.glowSources >= 2 && before.sun > 0 && before.openings === 0
      && before.verticalOpenings === 5
      && before.devices > 0 && before.hover > 0 && before.vacuumPucks > 0
      && before.vacuumTrails >= 2,
    liveLayersStable: JSON.stringify(after) === JSON.stringify(before),
    spillBarrierStable: JSON.stringify(afterSpillParts) === JSON.stringify(beforeSpillParts)
      && beforeSpillParts.length >= 2 && beforeSpillParts.every((parts) => Number(parts) > 0),
    floorToOverlayOrderPreserved: ordered.every(Boolean)
      && ordered.slice(1).every((node, index) => Boolean(
        ordered[index].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING
      )),
    haColorUpdatePainted: [...root(original).querySelectorAll('radialGradient stop')]
      .some((stop) => stop.getAttribute('stop-color') === '#ff4020'),
    sameWallFingerprint: root(original).querySelector('[data-hp="iso-walls"]')?.dataset.fingerprint === wallFingerprint,
    haUpdateReusesGeometry: original._isoGeometryCache.get(wallFingerprint)?.geometry === cachedGeometry,
    contactUpdateMovesOnlyLivePanel: !!openingPanelBefore
      && root(original).querySelector('[data-hp="iso-openings"] [data-id="iso-door"]')?.getAttribute('d')
        !== openingPanelBefore
      && original._isoGeometryCache.size === 1,
    oneLightModel: !root(original).querySelector('.window-light,.iso-window-light,.iso-glow,.iso-sun'),
    oldFloorSymbolsNotDuplicated: before.openings === 0,
  };

  configSpace.settings.hide_openings = true;
  original._cfgEpoch++;
  original.requestUpdate();
  await original.updateComplete;
  result.hideOpeningsKeepsStructure = !!root(original).querySelector('[data-hp="iso-walls"]')
    && !root(original).querySelector('[data-hp="iso-openings"]')
    && !root(original).querySelector('[data-hp="opening"]')
    && root(original).querySelectorAll('.glowlayer [data-glow-source]').length >= 2;

  configSpace.settings.hide_openings = false;
  configSpace.settings.show_borders = false;
  original._cfgEpoch++;
  original.requestUpdate();
  await original.updateComplete;
  result.noBordersUsesFloorSymbols = !root(original).querySelector('[data-hp="iso-walls"]')
    && !root(original).querySelector('[data-hp="iso-underlay"]')
    && root(original).querySelectorAll('[data-hp="opening"]').length === 3;

  configSpace.settings.show_borders = true;
  original._cfgEpoch++;
  original.requestUpdate();
  await original.updateComplete;
  result.visibleBordersRestoreStage2 = !!root(original).querySelector('[data-hp="iso-openings"]')
    && original._isoGeometryCache.size === 1;

  const supports = CSS.supports;
  CSS.supports = () => false;
  original.requestUpdate();
  await original.updateComplete;
  result.unsupportedDecorationKeepsIsoStructure = !!root(original).querySelector('[data-hp="iso-walls"]')
    && !!root(original).querySelector('[data-hp="iso-openings"]')
    && !root(original).querySelector('[data-hp="iso-shadows"]');
  CSS.supports = supports;
  original.requestUpdate();
  await original.updateComplete;

  const calls = [];
  original.hass = {
    ...original.hass,
    callService: async (domain, service, data) => calls.push({ domain, service, data }),
  };
  await original.updateComplete;
  root(original).querySelector('[data-entity="light.ceiling"]')?.click();
  await frame();
  original._setProjection('flat');
  await original.updateComplete;
  root(original).querySelector('[data-entity="light.ceiling"]')?.click();
  await frame();
  result.flatIsoActionParity = calls.length === 2
    && JSON.stringify(calls[0]) === JSON.stringify(calls[1]);
  original._setProjection('iso');
  await original.updateComplete;

  const stage = root(original).querySelector('.stage');
  const stageRect = stage.getBoundingClientRect();
  const zoomBefore = original._zoom;
  const pointer = (type, id, x, y, buttons) => new PointerEvent(type, {
    bubbles: true, composed: true, pointerId: id, pointerType: 'touch',
    clientX: x, clientY: y, button: type === 'pointerdown' ? 0 : -1, buttons,
  });
  const cy = stageRect.top + stageRect.height / 2;
  stage.dispatchEvent(pointer('pointerdown', 8902, stageRect.left + 150, cy, 1));
  stage.dispatchEvent(pointer('pointerdown', 8903, stageRect.left + 270, cy, 1));
  stage.dispatchEvent(pointer('pointermove', 8902, stageRect.left + 115, cy, 1));
  stage.dispatchEvent(pointer('pointermove', 8903, stageRect.left + 305, cy, 1));
  stage.dispatchEvent(pointer('pointerup', 8902, stageRect.left + 115, cy, 0));
  stage.dispatchEvent(pointer('pointerup', 8903, stageRect.left + 305, cy, 0));
  await original.updateComplete;
  result.touchPinchKeepsIso = original._zoom > zoomBefore
    && !!root(original).querySelector('[data-hp="iso-walls"]');

  const opening = root(original).querySelector('[data-hp="opening"] .op-hit');
  opening?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  result.touchOpeningIsSafe = !original._openingDialog && !original._openingInfo
    && original._mode === 'view' && calls.length === 2;

  const device = root(original).querySelector('[data-hp="device"]');
  if (device) {
    const rect = device.getBoundingClientRect();
    device.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, composed: true, pointerId: 8901, pointerType: 'touch',
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      button: 0, buttons: 1,
    }));
    await wait(700);
    result.touchLongPressHitsDevice = !!original._infoCard;
    device.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, composed: true, pointerId: 8901, pointerType: 'touch',
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      button: 0, buttons: 0,
    }));
    original._closeInfoCard();
  } else result.touchLongPressHitsDevice = false;

  original._pickSpace('garden');
  await wait(230);
  original._setProjection('iso');
  await original.updateComplete;
  const gardenIso = original._space === 'garden'
    && root(original).querySelector('[data-hp="projection-toggle"]')?.getAttribute('aria-pressed') === 'true';
  original._pickSpace('f1');
  await wait(230);
  result.touchSpaceSwitchKeepsPerSpaceIso = gardenIso && original._space === 'f1'
    && !!root(original).querySelector('[data-hp="iso-walls"]');

  const ownVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  await original.updateComplete;
  await frame();
  const recoveryStarted = performance.now();
  while (root(original).querySelector('.recoveryoverlay')
      && performance.now() - recoveryStarted < 2000) await wait(20);
  result.backgroundForegroundKeepsIso = !!root(original).querySelector('[data-hp="iso-walls"]')
    && !root(original).querySelector('.recoveryoverlay');
  if (ownVisibilityState) Object.defineProperty(document, 'visibilityState', ownVisibilityState);
  else delete document.visibilityState;

  const host = document.getElementById('host');
  const mount = async (kiosk = false) => {
    const card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card', kiosk });
    host.replaceChildren(card);
    card._onLabsSnapshot({ active: Object.freeze(['iso']), space: '' });
    card.hass = window.__mkHass();
    const started = performance.now();
    while ((!card._loadOk || card._booting) && performance.now() - started < 9000) await wait(30);
    await card.updateComplete;
    await frame();
    return card;
  };
  original.remove();
  const warm = await mount(false);
  result.warmRemountIso = !warm._booting
    && !!root(warm).querySelector('[data-hp="iso-walls"]')
    && root(warm).querySelector('[data-hp="projection-toggle"]')?.getAttribute('aria-pressed') === 'true';
  warm.remove();
  const kiosk = await mount(true);
  result.kioskReadsPreference = !!root(kiosk).querySelector('[data-hp="iso-walls"]');
  result.kioskHasNoToggle = !root(kiosk).querySelector('[data-hp="projection-toggle"]');
  return result;
});

await page.setViewportSize({ width: 820, height: 430 });
out.orientationResizeKeepsIso = await page.evaluate(async () => {
  const card = document.querySelector('houseplan-card');
  window.dispatchEvent(new Event('resize'));
  await card.updateComplete;
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const anchor = card.renderRoot.querySelector('[data-hp="device"]')?.getBoundingClientRect();
  return !!card.renderRoot.querySelector('[data-hp="iso-walls"]')
    && !!anchor && [anchor.left, anchor.top, anchor.width, anchor.height].every(Number.isFinite);
});
out.kioskEmergencyOffIsFlat = await page.evaluate(async () => {
  const card = document.querySelector('houseplan-card');
  history.replaceState(null, '', '?hp-labs=-iso#space=f1');
  dispatchEvent(new HashChangeEvent('hashchange'));
  await card.updateComplete;
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  return !card.renderRoot.querySelector('[data-hp="iso-walls"]')
    && !card.renderRoot.querySelector('[data-hp="projection-toggle"]');
});

checkAll(out);
await finish(browser, out);
