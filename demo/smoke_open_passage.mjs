// #157: open passage is negative architecture across editor, Full/Static and
// light transport. The pure symbol/static/iso guards have dedicated mutants;
// this browser scenario proves the assembled user flow and rendered geometry.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const c = window.__card;
  const root = () => c.shadowRoot || c.renderRoot;
  const settle = async () => {
    c._cfgEpoch++;
    c._lightBarrierCache = null;
    c.requestUpdate();
    await c.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const settleMode = async () => {
    const started = performance.now();
    do { await new Promise((resolve) => requestAnimationFrame(resolve)); }
    while (c._modeTransitionBusy && performance.now() - started < 1500);
    await settle();
  };
  const pitch = 1 / 240;
  const wallKey = (a, b) => {
    const q = (value) => Math.round(value / pitch) * pitch;
    let dx = b[0] - a[0]; let dy = b[1] - a[1];
    const length = Math.hypot(dx, dy) || 1;
    dx /= length; dy /= length;
    if (dx < -1e-12 || (Math.abs(dx) <= 1e-12 && dy < 0)) { dx = -dx; dy = -dy; }
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI;
    angle = Math.round(angle * 1800) / 1800;
    return `${q((a[0] + b[0]) / 2).toFixed(6)},${q((a[1] + b[1]) / 2).toFixed(6)}@${angle.toFixed(4)}`;
  };
  const sp = c._serverCfg.spaces.find((space) => space.id === c._space);
  sp.rooms = [
    { id: 'passage-left', name: 'Left', area: 'living',
      poly: [[0.1, 0.2], [0.5, 0.2], [0.5, 0.7], [0.1, 0.7]],
      settings: { fill_mode: 'none' } },
    { id: 'passage-right', name: 'Right', area: 'kitchen',
      poly: [[0.5, 0.2], [0.9, 0.2], [0.9, 0.7], [0.5, 0.7]],
      settings: { fill_mode: 'none' } },
  ];
  sp.walls = [{
    key: wallKey([0.5, 0.2], [0.5, 0.7]),
    a: [0.5, 0.2], b: [0.5, 0.7], cm: 20,
  }];
  sp.openings = [{
    id: 'passage-main', type: 'passage', x: 0.5, y: 0.45,
    angle: 90, length: 0.1, future_material: 'stone',
  }];
  sp.settings = { ...(sp.settings || {}), show_borders: true, hide_openings: false,
    fill_mode: 'glow', glow_enabled: true };
  c._serverCfg.settings = {
    ...(c._serverCfg.settings || {}), glow_radius_cm: 800,
  };
  const light = c._devices.find((device) => device.space === c._space
    && device.entities.some((entity) => entity.startsWith('light.') && c.hass.states[entity]?.state === 'on'));
  if (light) c._layout = { ...c._layout, [light.id]: { s: c._space, x: 0.3, y: 0.45 } };

  const litRings = () => [...root().querySelectorAll('defs clipPath[id^="hp-glowclip"] path.glow-lit')]
    .flatMap((path) => (path.getAttribute('d') || '').split('M').filter(Boolean).map((subpath) => {
      const values = (subpath.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      const ring = [];
      for (let index = 0; index + 1 < values.length; index += 2) ring.push([values[index], values[index + 1]]);
      return ring;
    }));
  const isLit = (point) => litRings().some((ring) => {
    let inside = false;
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      const [x1, y1] = ring[index]; const [x2, y2] = ring[previous];
      if ((y1 > point[1]) !== (y2 > point[1])
        && point[0] < ((x2 - x1) * (point[1] - y1)) / ((y2 - y1) || 1e-12) + x1) inside = !inside;
    }
    return inside;
  });

  c._setMode('view');
  await settleMode();
  const result = {};
  result.interiorPassageTransmitsLight = !!light && isLit([650, 450]);
  result.wallOutsidePassageStaysDark = !!light && !isLit([650, 260]);

  sp.openings[0].type = 'future-opening';
  await settle();
  await new Promise((resolve) => setTimeout(resolve, 650));
  await settle();
  result.unknownOpeningFailsDark = !isLit([650, 450]);
  sp.openings[0].type = 'passage';
  await settle();

  c._setMode('plan');
  await settleMode();
  c._activateOpeningPlacement('passage');
  await settle();
  result.passagePresetIs90cm = c._openingPreset?.type === 'passage'
    && c._openingPreset?.lengthCm === 90;
  const committed = root().querySelector('.opening[data-kind="passage"]');
  result.committedHasHitboxButNoSymbol = !!committed?.querySelector('.op-hit')
    && committed.querySelectorAll('.op-leaf,.op-arc,.op-glass,line').length === 0;

  // Cancel is a pure draft operation, including stale values hidden by the
  // passage radio. Save canonicalises those known fields but keeps extensions.
  Object.assign(sp.openings[0], {
    type: 'door', contact: 'binary_sensor.window', lock: 'lock.front_door',
    invert: true, flip_h: true, flip_v: true,
  });
  await settle();
  c._editOpening(c._openingsR.find((opening) => opening.id === 'passage-main'));
  c._openingDialog = { ...c._openingDialog, type: 'passage' };
  await settle();
  const beforeCancel = JSON.stringify(sp.openings[0]);
  result.warningIsVisibleAndAccessible = !!root().querySelector(
    '.habindingbanner[role="status"][aria-live="polite"]',
  );
  result.passageHidesBindingAndFlipControls = root().querySelectorAll(
    'hp-dialog .body select, hp-dialog .body input[type="checkbox"]',
  ).length === 0;
  c._openingDialog = null;
  await settle();
  result.cancelKeepsOriginalOpening = JSON.stringify(sp.openings[0]) === beforeCancel;

  c._editOpening(c._openingsR.find((opening) => opening.id === 'passage-main'));
  c._openingDialog = { ...c._openingDialog, type: 'passage' };
  c._saveOpening();
  await settle();
  const saved = sp.openings.find((opening) => opening.id === 'passage-main');
  result.saveIsCanonicalAndLossless = saved?.type === 'passage'
    && saved.future_material === 'stone'
    && ['contact', 'lock', 'invert', 'flip_h', 'flip_v']
      .every((field) => !Object.prototype.hasOwnProperty.call(saved, field));
  result.noPassageLockBadge = root().querySelectorAll('.oplock').length === 0;
  c._openingInfo = c._openingsR.find((opening) => opening.id === 'passage-main');
  await settle();
  result.stalePassageInfoIsInert = root().querySelectorAll('.oprow,.lockact').length === 0;
  c._openingInfo = null;

  // Exercise the actual static custom element with the same immutable snapshot.
  // #896: let the actual save settle and publish the fixture, never race its
  // pending GET with a private _snap replacement.
  await window.__hpTest.waitForWrites();
  await window.__hpTest.setServerConfig(structuredClone(c._serverCfg));
  await window.__hpTest.setLayout(structuredClone(c._layout));
  const staticCard = document.createElement('houseplan-space-card');
  staticCard.setConfig({ type: 'custom:houseplan-space-card', space: c._space, show_button: false });
  staticCard.hass = c.hass;
  document.body.append(staticCard);
  await staticCard.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 350));
  staticCard.requestUpdate();
  await staticCard.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const staticRoot = staticCard.shadowRoot || staticCard.renderRoot;
  const staticWallBodyPaths = [...staticRoot.querySelectorAll('.wallbodies path')];
  const passagePoint = new DOMPoint(500, 450);
  const solidWallPoint = new DOMPoint(500, 260);
  result.staticCutsEmptyPassageWithoutDarkness = staticWallBodyPaths.length > 0
    && staticWallBodyPaths.every((path) => !path.isPointInFill(passagePoint))
    && staticWallBodyPaths.some((path) => path.isPointInFill(solidWallPoint))
    && !staticRoot.querySelector('.static-opening-tunnels [data-kind="passage"]')
    && !staticRoot.querySelector('.glow-base-layer,.glow-base-tunnels');
  result.staticDoesNotInventPassageSymbol = staticRoot.querySelectorAll('[data-hp="opening"]').length === 0;
  staticCard.remove();

  // #943: rooms with fill:none no longer add a darkness-filled tunnel.
  // Keep a separate real data-fill witness instead of deleting tunnel coverage.
  await window.__hpTest.setServerConfig(cfg => ({ ...cfg, spaces: cfg.spaces.map(space => space.id !== c._space ? space : ({
    ...space, rooms: space.rooms.map((room, index) => ({ ...room,
      settings: { ...room.settings, fill_mode: 'custom',
        custom_fill: { c: index === 0 ? '#224466' : '#668822', a: index === 0 ? 0.42 : 0.6 } },
    })),
  })) }));
  const dataCard = document.createElement('houseplan-space-card');
  dataCard.setConfig({ type: 'custom:houseplan-space-card', space: c._space, show_button: false });
  dataCard.hass = c.hass;
  document.body.append(dataCard);
  const dataRoot = () => dataCard.shadowRoot || dataCard.renderRoot;
  const dataTunnel = () => dataRoot()?.querySelector('.static-opening-tunnels[data-layer="data"] [data-kind="passage"]');
  const started = performance.now();
  while (!dataTunnel()) {
    if (performance.now() - started > 3000) throw new Error('Static passage data fill did not load');
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  await dataCard.updateComplete;
  const colors = [...dataTunnel().querySelectorAll('stop')].map(stop => [stop.getAttribute('stop-color'), Number(stop.getAttribute('stop-opacity'))]);
  const dataWalls = [...dataRoot().querySelectorAll('.wallbodies path')];
  result.staticDataFillStillRepeatsBothRooms = colors.some(([c, a]) => c === '#224466' && a === 0.42)
    && colors.some(([c, a]) => c === '#668822' && a === 0.6)
    && dataWalls.length > 0 && dataWalls.every(path => !path.isPointInFill(passagePoint))
    && dataWalls.some(path => path.isPointInFill(solidWallPoint))
    && !dataRoot().querySelector('.glow-base-layer,.glow-base-tunnels');
  dataCard.remove();

  return result;
});

checkAll(out);
await finish(browser, out);
