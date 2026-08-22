// #122 Stage 2: Labs lifecycle, structural composition and flat editor boundary.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 850 });
const out = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.renderRoot;
  const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const center = (element) => {
    const rect = element.getBoundingClientRect();
    return [rect.left + rect.width / 2, rect.top + rect.height / 2];
  };
  const enable = async () => {
    history.replaceState(null, '', '#space=f1&hp-labs=iso');
    dispatchEvent(new HashChangeEvent('hashchange'));
    if (typeof card._onLabsSnapshot !== 'function') throw new Error('missing Labs fixture hook');
    const active = Object.freeze(['iso']);
    // The product flag expires at 1.65.0. Keep this renderer/lifecycle smoke
    // explicit without extending the public Labs registry contract.
    card._onLabsSnapshot({ active, space: '' });
    window.__hpLabs = active;
    await card.updateComplete;
    await frame();
  };
  const result = {};
  const configSpace = card._serverCfg.spaces.find((space) => space.id === 'f1');
  configSpace.settings = {
    ...(configSpace.settings || {}), show_borders: true, show_names: true,
  };
  configSpace.partitions = [{
    id: 'iso-smoke-wall', a: [0.15, 0.12], b: [0.85, 0.12], cm: 15,
  }];
  configSpace.openings = [
    { id: 'iso-centred-door', type: 'door', x: 0.325, y: 0.12, angle: 0, length: 0.08,
      host: { kind: 'partition', id: 'iso-smoke-wall', t: 0.25 } },
    { id: 'iso-flipped-window', type: 'window', x: 0.5, y: 0.12, angle: 0, length: 0.08,
      flip_v: true, host: { kind: 'partition', id: 'iso-smoke-wall', t: 0.5 } },
    { id: 'iso-centred-gate', type: 'gate', x: 0.675, y: 0.12, angle: 0, length: 0.08,
      flip_v: true, host: { kind: 'partition', id: 'iso-smoke-wall', t: 0.75 } },
  ];
  card._cfgEpoch++;
  card.requestUpdate();
  await card.updateComplete;
  await enable();
  const openingBases = card._isoSource()?.build().openings || [];
  const basis = (id) => openingBases.find((opening) => opening.id === id);
  const centredDoor = basis('iso-centred-door');
  const flippedWindow = basis('iso-flipped-window');
  const centredGate = basis('iso-centred-gate');
  const wallAxisY = 0.12 * 1000;
  const halfDepth = (15 / card._cellCm) * card._gridPitch / 2;
  result.isoOpeningDefaultCentred = centredDoor?.leaves.length === 1
    && centredDoor.leaves.every((leaf) => Math.abs(leaf.hinge[1] - wallAxisY) < 1e-6);
  result.isoWindowFlipUsesCanonicalEdge = flippedWindow?.leaves.length === 2
    && flippedWindow.leaves.every(
      (leaf) => Math.abs(leaf.hinge[1] - wallAxisY - halfDepth) < 1e-6,
    );
  result.isoGateFlipKeepsCentredOrigin = centredGate?.leaves.length === 2
    && centredGate.leaves.every((leaf) => Math.abs(leaf.hinge[1] - wallAxisY) < 1e-6)
    && centredGate.leaves.every((leaf) => Math.abs(leaf.turnDeg) === 10);
  const toggle = root().querySelector('[data-hp="projection-toggle"]');
  result.labsSnapshotFrozen = Object.isFrozen(window.__hpLabs)
    && JSON.stringify(window.__hpLabs) === '["iso"]';
  result.toggleShown = !!toggle;
  result.toggleMinHitTarget = toggle && toggle.getBoundingClientRect().width >= 44
    && toggle.getBoundingClientRect().height >= 44;
  result.flatDefault = toggle?.getAttribute('aria-pressed') === 'false'
    && !root().querySelector('[data-hp="iso-walls"]');

  toggle?.click();
  await card.updateComplete;
  await frame();
  const isoToggle = root().querySelector('[data-hp="projection-toggle"]');
  const device = root().querySelector('[data-hp="device"]');
  const roomLabel = root().querySelector('[data-hp="room-label"]');
  result.isoRendered = isoToggle?.getAttribute('aria-pressed') === 'true'
    && !!root().querySelector('[data-hp="iso-underlay"] .iso-floor-side')
    && !!root().querySelector('[data-hp="iso-walls"] .iso-wall-top');
  result.sharedProjectionSnapshot = ['.iso-underlay-svg', '.plan-svg', '.iso-shadows-svg', '.iso-walls-svg']
    .map((selector) => root().querySelector(selector)?.getAttribute('viewBox'))
    .every((value, _index, values) => !!value && value === values[0]);
  result.stage2DefinitionsBounded = root().querySelectorAll('[id^="hp-iso-"]').length <= 5;
  result.preferenceStored = JSON.parse(localStorage.getItem('houseplan_card_view_v1') || '{}').f1 === 'iso';
  result.anchorsFinite = [device, roomLabel].every((node) => node
    && center(node).every((value) => Number.isFinite(value)));
  const deviceBefore = device ? center(device) : null;
  card.hass = { ...card.hass, states: { ...card.hass.states } };
  await card.updateComplete;
  const deviceAfter = root().querySelector('[data-hp="device"]');
  result.haUpdateKeepsGeometry = root().querySelector('[data-hp="iso-walls"]')?.dataset.fingerprint
    && card._isoGeometryCache.size === 1;
  result.haUpdateKeepsAnchor = !!deviceBefore && !!deviceAfter
    && Math.hypot(...center(deviceAfter).map((value, index) => value - deviceBefore[index])) <= 1;

  card._setMode('plan');
  await card.updateComplete;
  while (card._modeTransitionBusy) await frame();
  result.editorIsFlat = card._mode === 'plan'
    && !root().querySelector('[data-hp="projection-toggle"]')
    && !root().querySelector('[data-hp="iso-walls"]');
  card._setMode('view');
  await card.updateComplete;
  while (card._modeTransitionBusy) await frame();
  result.viewRestoresIso = root().querySelector('[data-hp="projection-toggle"]')?.getAttribute('aria-pressed') === 'true'
    && !!root().querySelector('[data-hp="iso-walls"]');

  const source = card._isoSource;
  let attempts = 0;
  let shouldFail = true;
  const fallbackKey = 'f1|injected-render-failure';
  card._isoGeometryCache.clear();
  card._isoSource = () => ({
    key: fallbackKey,
    build: () => {
      attempts++;
      if (shouldFail) throw new Error('injected isometric failure');
      return { walls: [], floor: [], openings: [] };
    },
  });
  card.requestUpdate();
  await card.updateComplete;
  card.hass = { ...card.hass, states: { ...card.hass.states } };
  await card.updateComplete;
  result.fallbackLatched = attempts === 1
    && root().querySelector('[data-hp="projection-toggle"]')?.getAttribute('aria-pressed') === 'false'
    && !root().querySelector('[data-hp="iso-walls"]')
    && JSON.parse(localStorage.getItem('houseplan_card_view_v1') || '{}').f1 === 'iso';
  shouldFail = false;
  card._setProjection('iso');
  await card.updateComplete;
  result.explicitRetryRestoresIso = attempts === 2
    && !!root().querySelector('[data-hp="iso-walls"]')
    && root().querySelector('[data-hp="projection-toggle"]')?.getAttribute('aria-pressed') === 'true';
  card._isoSource = source;
  card._isoGeometryCache.delete(fallbackKey);
  card._isoFallback.delete(fallbackKey);
  card.requestUpdate();
  await card.updateComplete;

  history.replaceState(null, '', '#space=f1&hp-labs=-iso');
  dispatchEvent(new HashChangeEvent('hashchange'));
  await card.updateComplete;
  await frame();
  result.removalIsImmediateFlat = JSON.stringify(window.__hpLabs) === '[]'
    && !root().querySelector('[data-hp="projection-toggle"]')
    && !root().querySelector('[data-hp="iso-walls"]')
    && !root().querySelector('[id^="hp-iso-"]');
  return result;
});

checkAll(out);
await finish(browser, out);
