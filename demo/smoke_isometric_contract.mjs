// #122/#160 Stage 3: alpha lifecycle, structural composition and flat editor boundary.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 850 });
const out = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.renderRoot;
  const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const isoRuntimeRequests = () => [...performance.getEntriesByType('resource')]
    .filter((entry) => /\/iso-scene-render-[^/]+\.js(?:$|\?)/.test(entry.name)).length;
  const ensureIsoRuntime = async () => {
    if (typeof card._ensureIsoSceneRuntime !== 'function'
        || !(await card._ensureIsoSceneRuntime())) {
      throw new Error('isometric smoke runtime did not load');
    }
    await card.updateComplete;
    await frame();
  };
  const center = (element) => {
    const rect = element.getBoundingClientRect();
    return [rect.left + rect.width / 2, rect.top + rect.height / 2];
  };
  const inside = (outer, element, tolerance = 1) => {
    const a = outer.getBoundingClientRect(), b = element.getBoundingClientRect();
    return b.left >= a.left - tolerance && b.top >= a.top - tolerance
      && b.right <= a.right + tolerance && b.bottom <= a.bottom + tolerance;
  };
  const sceneToClient = (point) => {
    const svg = root().querySelector('.iso-overlays-svg');
    if (!svg) return [NaN, NaN];
    const rect = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    const scale = Math.min(rect.width / vb.width, rect.height / vb.height);
    return [rect.left + (rect.width - vb.width * scale) / 2 + (point[0] - vb.x) * scale,
      rect.top + (rect.height - vb.height * scale) / 2 + (point[1] - vb.y) * scale];
  };
  const owns44 = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect(), c = center(element);
    const pseudo = getComputedStyle(element, '::before');
    const width = Math.max(rect.width, Number.parseFloat(pseudo.width) || 0);
    const height = Math.max(rect.height, Number.parseFloat(pseudo.height) || 0);
    if (width < 44 || height < 44) return false;
    return [[0, 0], [-21, 0], [21, 0], [0, -21], [0, 21]].every(([dx, dy]) => {
      const hit = root().elementFromPoint(c[0] + dx, c[1] + dy);
      return hit === element || !!hit && element.contains(hit);
    });
  };
  const enable = async () => {
    history.replaceState(null, '', '#space=f1&hp_alpha=1');
    dispatchEvent(new HashChangeEvent('hashchange'));
    await card.updateComplete;
    await ensureIsoRuntime();
    await frame();
  };
  const result = {};
  result.cleanProfileStartsOff = window.__hpAlpha === false
    && JSON.stringify(window.__hpLabs) === '[]'
    && !root().querySelector('[data-hp="projection-toggle"]')
    && ![...root().querySelector('.stage').classList]
      .some((name) => name.startsWith('projection-'));
  result.cleanAlphaOffSkipsIsoRuntimeRequest = isoRuntimeRequests() === 0;
  const configSpace = card._serverCfg.spaces.find((space) => space.id === 'f1');
  configSpace.settings = {
    ...(configSpace.settings || {}), show_borders: true, show_names: true,
  };
  configSpace.partitions = [{
    id: 'iso-smoke-wall', a: [0.15, 0.12], b: [0.85, 0.12], cm: 15,
  }];
  configSpace.openings = [
    { id: 'iso-centred-door', type: 'door', x: 0.325, y: 0.12, angle: 0, length: 0.08,
      lock: 'lock.front_door',
      host: { kind: 'partition', id: 'iso-smoke-wall', t: 0.25 } },
    { id: 'iso-flipped-window', type: 'window', x: 0.5, y: 0.12, angle: 0, length: 0.08,
      flip_v: true, host: { kind: 'partition', id: 'iso-smoke-wall', t: 0.5 } },
    { id: 'iso-centred-gate', type: 'gate', x: 0.605, y: 0.12, angle: 0, length: 0.08,
      flip_v: false, host: { kind: 'partition', id: 'iso-smoke-wall', t: 0.65 } },
    { id: 'iso-flipped-gate', type: 'gate', x: 0.745, y: 0.12, angle: 0, length: 0.08,
      flip_v: true, host: { kind: 'partition', id: 'iso-smoke-wall', t: 0.85 } },
  ];
  card._cfgEpoch++;
  card.requestUpdate();
  await card.updateComplete;
  await enable();
  result.alphaOnLoadsIsoRuntimeOnce = isoRuntimeRequests() === 1;
  const openingBases = card._isoSource()?.build().openings || [];
  const basis = (id) => openingBases.find((opening) => opening.id === id);
  const centredDoor = basis('iso-centred-door');
  const flippedWindow = basis('iso-flipped-window');
  const centredGate = basis('iso-centred-gate');
  const flippedGate = basis('iso-flipped-gate');
  const wallAxisY = 0.12 * 1000;
  result.isoOpeningDefaultCentred = centredDoor?.leaves.length === 1
    && centredDoor.leaves.every((leaf) => Math.abs(leaf.hinge[1] - wallAxisY) < 1e-6);
  result.isoWindowFlipStaysCentred = flippedWindow?.leaves.length === 2
    && flippedWindow.leaves.every(
      (leaf) => Math.abs(leaf.hinge[1] - wallAxisY) < 1e-6,
    );
  result.isoGateFlipKeepsCentredOrigin = centredGate?.leaves.length === 2
    && centredGate.leaves.every((leaf) => Math.abs(leaf.hinge[1] - wallAxisY) < 1e-6)
    && flippedGate?.leaves.length === 2
    && flippedGate.leaves.every((leaf) => Math.abs(leaf.hinge[1] - wallAxisY) < 1e-6)
    && centredGate.leaves.every((leaf) => Math.abs(leaf.turnDeg) === 10)
    && flippedGate.leaves.every((leaf) => Math.abs(leaf.turnDeg) === 10);
  result.isoGateFlipReversesTurn = centredGate?.leaves[0]?.turnDeg
    === -flippedGate?.leaves[0]?.turnDeg;
  const toggle = root().querySelector('[data-hp="projection-toggle"]');
  result.alphaSnapshotFrozen = window.__hpAlpha === true && Object.isFrozen(window.__hpLabs)
    && JSON.stringify(window.__hpLabs) === '["iso"]';
  result.alphaStored = localStorage.getItem('houseplan_card_alpha_v1') === '1';
  result.toggleShown = !!toggle;
  result.toggleMinHitTarget = toggle && toggle.getBoundingClientRect().width >= 44
    && toggle.getBoundingClientRect().height >= 44;
  result.flatDefault = toggle?.getAttribute('aria-pressed') === 'false'
    && !root().querySelector('[data-hp="iso-walls"]');

  toggle?.click();
  await ensureIsoRuntime();
  await card.updateComplete;
  await frame();
  const isoToggle = root().querySelector('[data-hp="projection-toggle"]');
  const device = root().querySelector('[data-hp="device"]');
  const roomLabel = root().querySelector('[data-hp="room-label"]');
  const openingLock = root().querySelector('.oplock');
  const stage = root().querySelector('.stage');
  result.isoRendered = isoToggle?.getAttribute('aria-pressed') === 'true'
    && !!root().querySelector('[data-hp="iso-underlay"] .iso-floor-side')
    && !!root().querySelector('[data-hp="iso-walls"] .iso-wall-top');
  result.stage3RevisionAdvertised = stage?.getAttribute('data-hp-iso-stage') === '3';
  result.sharedProjectionSnapshot = [
    '.iso-underlay-svg', '.plan-svg', '.iso-shadows-svg', '.iso-walls-svg', '.iso-overlays-svg',
  ]
    .map((selector) => root().querySelector(selector)?.getAttribute('viewBox'))
    .every((value, _index, values) => !!value && value === values[0]);
  const materialDefs = [...root().querySelectorAll('[data-hp-iso-material-def]')];
  const requiredDefs = [
    'hp-iso-wall-side', 'hp-iso-wall-top', 'hp-iso-wall-texture',
    'hp-iso-floor-texture', 'hp-iso-ambient-shadow', 'hp-iso-contact-shadow',
    'hp-iso-leaf-shadow', 'hp-iso-overlay-ground', 'hp-iso-overlay-texture',
  ];
  result.stage3DefinitionsBounded = materialDefs.length >= requiredDefs.length
    && materialDefs.length <= 16
    && new Set(materialDefs.map((node) => node.id)).size === materialDefs.length
    && requiredDefs.every((id) => materialDefs.some((node) => node.id === id));
  const shadowNodes = [...root().querySelectorAll(
    '.iso-ambient-shadow, .iso-contact-shadow, .iso-leaf-shadow, .iso-overlay-ground',
  )];
  const fixedLightTransform = card._isoSceneRuntime.isoFixedLightTransform(card._cellCm);
  result.fixedLightVectorShared = shadowNodes.some((node) => node.matches('.iso-overlay-ground'))
    && ['iso-ambient-shadow', 'iso-contact-shadow', 'iso-leaf-shadow', 'iso-overlay-ground']
      .every((name) => shadowNodes.some((node) => node.classList.contains(name)))
    && shadowNodes.every((node) => node.getAttribute('transform') === fixedLightTransform);
  const hasOpeningSurface = (id, surface, material) => !!root().querySelector(
    `[data-hp="iso-openings"] [data-id="${id}"][data-surface="${surface}"].iso-material-${material}`,
  );
  result.stage3OpeningMaterials = [
    ['iso-centred-door', 'jamb-reveal', 'reveal'],
    ['iso-centred-door', 'leaf-front', 'matte-leaf'],
    ['iso-centred-door', 'leaf-back', 'matte-leaf'],
    ['iso-centred-door', 'leaf-edge', 'matte-leaf'],
    ['iso-centred-door', 'leaf-top', 'matte-leaf'],
    ['iso-flipped-window', 'window-insert', 'light-window'],
    ['iso-flipped-window', 'window-frame-side', 'light-frame'],
    ['iso-flipped-window', 'window-frame-top', 'light-frame'],
    ['iso-flipped-window', 'window-sill', 'light-sill'],
    ['iso-centred-gate', 'jamb-reveal', 'reveal'],
    ['iso-centred-gate', 'leaf-front', 'matte-leaf'],
  ].every(([id, surface, material]) => hasOpeningSurface(id, surface, material))
    && !root().querySelector(
      '[data-hp="iso-openings"] [data-surface*="glass"],'
      + '[data-hp="iso-openings"] .iso-material-dark-glass',
    );
  const raisedRoot = (node, kind) => node?.getAttribute('data-hp-iso-overlay-kind') === kind
    && node.getAttribute('data-hp-iso-raised') === 'true'
    && node.getAttribute('data-hp-iso-floor')
    && node.getAttribute('data-hp-iso-visual')
    && node.getAttribute('data-hp-iso-floor') !== node.getAttribute('data-hp-iso-visual');
  result.stage3RaisesExactInteractiveRoots = raisedRoot(device, 'device')
    && raisedRoot(roomLabel, 'room-label')
    && raisedRoot(openingLock, 'opening-lock')
    && ['device', 'room-label', 'opening-lock'].every((kind) => root().querySelector(
      `[data-hp="iso-raised-overlays"] [data-hp-iso-overlay-kind="${kind}"]`
      + '[data-hp-iso-raised="true"]',
    ));
  result.preferenceStored = JSON.parse(localStorage.getItem('houseplan_card_view_v1') || '{}').f1 === 'iso';
  result.anchorsFinite = [device, roomLabel, openingLock].every((node) => node
    && center(node).every((value) => Number.isFinite(value)));
  card._fitAll();
  for (let guard = 0; card._cameraTransition.active && guard < 90; guard++) await frame();
  const raisedNodes = [...root().querySelectorAll('[data-hp-iso-raised="true"]')]
    .filter((node) => node.closest('.devlayer'));
  const raisedGeometryMatches = (node) => {
    const kind = node.getAttribute('data-hp-iso-overlay-kind');
    const id = node.getAttribute('data-id');
    const suffix = id ? `[data-id="${CSS.escape(id)}"]` : '';
    const group = root().querySelector(
      `[data-hp="iso-raised-overlays"] .iso-overlay-plates > [data-hp-iso-overlay-kind="${kind}"]${suffix}`,
    ) || root().querySelector(
      `[data-hp="iso-raised-overlays"] .iso-overlay-plates > [data-hp-iso-overlay-kind="${kind}"]`,
    );
    const plate = group?.querySelector('.iso-overlay-plate');
    const points = (plate?.getAttribute('points') || '').trim().split(/\s+/)
      .map((pair) => pair.split(',').map(Number));
    const visual = (node.getAttribute('data-hp-iso-visual') || '').split(',').map(Number);
    const floorPoint = (node.getAttribute('data-hp-iso-floor') || '').split(',').map(Number);
    if (!group || points.length !== 4 || visual.length !== 2 || floorPoint.length !== 2) return false;
    const centroid = [points.reduce((sum, point) => sum + point[0], 0) / 4,
      points.reduce((sum, point) => sum + point[1], 0) / 4];
    const expected = sceneToClient(visual), actual = center(node);
    const ground = root().querySelector(
      `[data-hp="iso-overlay-grounds"] [data-hp-iso-overlay-kind="${kind}"]${suffix}`,
    ) || root().querySelector(
      `[data-hp="iso-overlay-grounds"] [data-hp-iso-overlay-kind="${kind}"]`,
    );
    const tether = root().querySelector(
      `[data-hp="iso-raised-overlays"] .iso-overlay-tether[data-hp-iso-overlay-kind="${kind}"]${suffix}`,
    ) || root().querySelector(
      `[data-hp="iso-raised-overlays"] .iso-overlay-tether[data-hp-iso-overlay-kind="${kind}"]`,
    );
    return Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) <= 1
      && Math.hypot(centroid[0] - visual[0], centroid[1] - visual[1]) <= 1e-6
      && !!ground && Math.hypot(Number(ground.getAttribute('cx')) - floorPoint[0],
        Number(ground.getAttribute('cy')) - floorPoint[1]) <= 1e-6
      && (group.getAttribute('data-hp-iso-nudged') !== 'true' || !!tether);
  };
  result.globalFitContainsRaisedFootprints = raisedNodes.length >= 3
    && raisedNodes.every((node) => inside(root().querySelector('.stage'), node));
  result.raisedGeometryTracksHtml = raisedNodes.every(raisedGeometryMatches);
  result.raisedTargetsOwn44Pixels = ['device', 'room-label', 'opening-lock'].every((kind) =>
    raisedNodes.filter((node) => node.getAttribute('data-hp-iso-overlay-kind') === kind).some(owns44));
  const deviceBefore = device ? center(device) : null;
  const fingerprintBeforeLive = root().querySelector('[data-hp="iso-walls"]')?.dataset.fingerprint;
  const geometryBeforeLive = card._isoGeometryCache.get(fingerprintBeforeLive)?.geometry;
  const buildsBeforeLive = Number(stage?.getAttribute('data-hp-iso-structural-builds'));
  const sourceMethod = card._isoSource;
  const sceneMethod = card._isoScene;
  let sourceCalls = 0;
  let sceneCalls = 0;
  card._isoSource = (...args) => { sourceCalls++; return sourceMethod.apply(card, args); };
  card._isoScene = (...args) => { sceneCalls++; return sceneMethod.apply(card, args); };
  card.hass = { ...card.hass, states: { ...card.hass.states } };
  card.requestUpdate();
  await card.updateComplete;
  result.oneStructuralResolvePerFrame = sourceCalls === 1 && sceneCalls === 1
    && Number(root().querySelector('.stage')?.getAttribute('data-hp-iso-structural-builds'))
      === buildsBeforeLive;
  card._isoSource = sourceMethod;
  card._isoScene = sceneMethod;
  const deviceAfter = root().querySelector('[data-hp="device"]');
  result.haUpdateKeepsGeometry = root().querySelector('[data-hp="iso-walls"]')?.dataset.fingerprint
    && card._isoGeometryCache.size === 1;
  result.haUpdateKeepsAnchor = !!deviceBefore && !!deviceAfter
    && Math.hypot(...center(deviceAfter).map((value, index) => value - deviceBefore[index])) <= 1;
  const room = card._spaceModel('f1')?.rooms?.[0];
  card._hoverRoom = room ? { space: 'f1', room } : null;
  card.requestUpdate();
  await card.updateComplete;
  await frame();
  const fingerprintAfterHover = root().querySelector('[data-hp="iso-walls"]')?.dataset.fingerprint;
  const buildsAfterHover = Number(root().querySelector('.stage')
    ?.getAttribute('data-hp-iso-structural-builds'));
  result.haAndHoverReuseStructuralScene = !!fingerprintBeforeLive
    && fingerprintAfterHover === fingerprintBeforeLive
    && Number.isFinite(buildsBeforeLive) && buildsAfterHover === buildsBeforeLive
    && card._isoGeometryCache.get(fingerprintBeforeLive)?.geometry === geometryBeforeLive
    && card._isoGeometryCache.size === 1;
  card._hoverRoom = null;
  card.requestUpdate();
  await card.updateComplete;

  const originalRoomConfig = configSpace.rooms[0];
  const roomSourceBeforePresentation = card._isoSource();
  const roomGeometryBeforePresentation = card._isoGeometryCache
    .get(roomSourceBeforePresentation.key)?.geometry;
  const buildsBeforeRoomPresentation = Number(root().querySelector('.stage')
    ?.getAttribute('data-hp-iso-structural-builds'));
  const presentationRoomConfig = {
    ...originalRoomConfig,
    name: `${originalRoomConfig.name} presentation only`,
    area: 'presentation_only_area',
    settings: {
      ...(originalRoomConfig.settings || {}),
      fill_mode: 'custom', custom_fill: { c: '#123456', a: 0.4 },
      glow: false, name_scale: 1.7, label_scale: 0.8,
    },
  };
  configSpace.rooms[0] = presentationRoomConfig;
  card._cfgEpoch++;
  card.requestUpdate();
  await card.updateComplete;
  await frame();
  const roomSourceAfterPresentation = card._isoSource();
  const buildsAfterRoomPresentation = Number(root().querySelector('.stage')
    ?.getAttribute('data-hp-iso-structural-builds'));
  result.presentationRoomUpdateKeepsStructuralCache =
    roomSourceAfterPresentation.key === roomSourceBeforePresentation.key
    && buildsAfterRoomPresentation === buildsBeforeRoomPresentation
    && card._isoGeometryCache.get(roomSourceAfterPresentation.key)?.geometry
      === roomGeometryBeforePresentation;

  const geometryRoomConfig = {
    ...presentationRoomConfig,
    poly: presentationRoomConfig.poly.map((point, index) =>
      index === 1 ? [point[0] + 0.01, point[1]] : [...point]),
  };
  configSpace.rooms[0] = geometryRoomConfig;
  card._cfgEpoch++;
  card.requestUpdate();
  await card.updateComplete;
  await frame();
  const roomSourceAfterGeometry = card._isoSource();
  const buildsAfterRoomGeometry = Number(root().querySelector('.stage')
    ?.getAttribute('data-hp-iso-structural-builds'));
  result.roomGeometryUpdateInvalidatesStructuralCache =
    roomSourceAfterGeometry.key !== roomSourceAfterPresentation.key
    && buildsAfterRoomGeometry === buildsAfterRoomPresentation + 1
    && card._isoGeometryCache.get(roomSourceAfterGeometry.key)?.geometry
      !== roomGeometryBeforePresentation;
  configSpace.rooms[0] = originalRoomConfig;
  card._cfgEpoch++;
  card.requestUpdate();
  await card.updateComplete;
  await frame();

  const roomFitLabel = root().querySelector('.roomlabel[data-id="r1"]');
  roomFitLabel?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter', bubbles: true, composed: true,
  }));
  for (let guard = 0; card._cameraTransition.active && guard < 90; guard++) await frame();
  await card.updateComplete;
  const ownedEntries = (card._renderIsoScene?.overlayFitEntries || [])
    .filter((entry) => entry.placement.owner?.id === 'r1');
  const ownedRoots = ownedEntries.map((entry) => entry.kind === 'device'
    ? root().querySelector(`.dev[data-id="${CSS.escape(entry.id)}"]`)
    : entry.kind === 'room-label'
      ? root().querySelector(`.roomlabel[data-id="${CSS.escape(entry.id)}"]`)
      : root().querySelector('.oplock')).filter(Boolean);
  result.roomFitContainsOwnedRaisedFootprints = ownedEntries.length >= 2
    && ownedRoots.length === ownedEntries.length
    && ownedRoots.every((node) => inside(root().querySelector('.stage'), node));
  card._fitAll();
  for (let guard = 0; card._cameraTransition.active && guard < 90; guard++) await frame();
  const originalMoreInfo = card._openMoreInfo;
  let moreInfoCalls = 0;
  card._openMoreInfo = () => { moreInfoCalls++; };
  const sensorDevice = root().querySelector('.dev[data-id="d_temp"]');
  sensorDevice?.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true, composed: true, button: 2,
  }));
  sensorDevice?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter', bubbles: true, composed: true,
  }));
  const keyboardOpenedDeviceCard = card._infoCard?.id === 'd_temp';
  card._closeInfoCard();
  card._openMoreInfo = originalMoreInfo;
  const areaLink = root().querySelector('.roomlabel[data-id="r1"] .rlgo');
  areaLink?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  const areaPath = location.pathname;
  history.replaceState(null, '', '/#space=f1&hp_alpha=1');
  const lockRoot = root().querySelector('.oplock');
  lockRoot?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  result.raisedActionsRemainOwned = moreInfoCalls === 1 && keyboardOpenedDeviceCard
    && areaPath === '/config/areas/area/living_room'
    && card._openingInfo?.id === 'iso-centred-door';
  card._openingInfo = null;

  card._setMode('plan');
  await card.updateComplete;
  while (card._modeTransitionBusy) await frame();
  result.editorIsFlat = card._mode === 'plan'
    && !root().querySelector('[data-hp="projection-toggle"]')
    && !root().querySelector('[data-hp="iso-walls"]')
    && ![...root().querySelector('.stage').classList]
      .some((name) => name.startsWith('projection-'));
  card._setMode('view');
  await card.updateComplete;
  while (card._modeTransitionBusy) await frame();
  result.viewRestoresIso = root().querySelector('[data-hp="projection-toggle"]')?.getAttribute('aria-pressed') === 'true'
    && !!root().querySelector('[data-hp="iso-walls"]');

  const nativeCssSupports = CSS.supports;
  const fallbackCountBeforeCapabilityProbe = card._isoFallback.size;
  CSS.supports = () => { throw new Error('injected decoration capability failure'); };
  card.requestUpdate();
  await card.updateComplete;
  await frame();
  result.throwingCapabilityProbeStaysSolidIso = card._effectiveProjection() === 'iso'
    && card._isoFallback.size === fallbackCountBeforeCapabilityProbe
    && !!root().querySelector('[data-hp="iso-walls"] .iso-wall-top')
    && !!root().querySelector('[data-hp="iso-openings"] .iso-opening-panel')
    && !!root().querySelector('[data-hp="iso-raised-overlays"] .iso-overlay-plate')
    && !!root().querySelector('[data-hp="iso-raised-overlays"] .iso-overlay-tether')
    && !root().querySelector('[data-hp-iso-material-def]')
    && !root().querySelector('.iso-ambient-shadow, .iso-contact-shadow,'
      + ' .iso-leaf-shadow, .iso-overlay-ground');
  CSS.supports = nativeCssSupports;
  card.requestUpdate();
  await card.updateComplete;
  await frame();
  result.capabilityProbeRecoveryRestoresNuance = card._effectiveProjection() === 'iso'
    && !!root().querySelector('[data-hp-iso-material-def]')
    && card._isoFallback.size === fallbackCountBeforeCapabilityProbe;

  const healthySource = card._isoSource;
  let invalidAttempts = 0;
  card._view = { x: 123456, y: 234567, w: 3456, h: 4567 };
  card._viewModeSnap = { mode: 'view', viewBox: { ...card._view }, zoom: 1 };
  card._isoSource = () => {
    invalidAttempts++;
    throw new Error('invalid source sentinel sensor.private_identifier https://secret.invalid');
  };
  const firstInvalidKey = card._isoInvalidKey();
  card.requestUpdate();
  await card.updateComplete;
  card.hass = { ...card.hass, states: { ...card.hass.states } };
  await card.updateComplete;
  const flatView = (root().querySelector('[data-hp-live-viewbox="floor"]')
    ?.getAttribute('viewBox') || '').split(/\s+/).map(Number);
  result.invalidSourceFallbackLatchedAndRefit = invalidAttempts === 1
    && card._isoFallback.has(firstInvalidKey) && card._viewModeSnap === null
    && flatView.length === 4 && flatView.every((value) => Number.isFinite(value) && Math.abs(value) < 10000);
  const fallbackFlatCamera = { x: 80, y: 90, w: 700, h: 620 };
  card._view = { ...fallbackFlatCamera };
  card.requestUpdate();
  await card.updateComplete;
  result.latchedFallbackKeepsFlatCamera = JSON.stringify(card._view) === JSON.stringify(fallbackFlatCamera);
  card._isoSource = healthySource;
  card._setProjection('iso');
  await card.updateComplete;
  result.invalidSourceExplicitRetryRestoresIso = !card._isoFallback.has(firstInvalidKey)
    && !!root().querySelector('[data-hp="iso-walls"]');

  const sourceKeyBeforeEpochRecovery = card._isoSource()?.key;
  const originalSmokeWall = configSpace.partitions[0];
  card._isoSource = () => {
    invalidAttempts++;
    throw new Error('second invalid source must recover after geometry changes');
  };
  const epochInvalidKey = card._isoInvalidKey();
  card.requestUpdate();
  await card.updateComplete;
  card.hass = { ...card.hass, states: { ...card.hass.states } };
  await card.updateComplete;
  card._isoSource = healthySource;
  configSpace.partitions[0] = { ...originalSmokeWall, cm: originalSmokeWall.cm + 1 };
  card._cfgEpoch++;
  const nextEpochInvalidKey = card._isoInvalidKey();
  card.requestUpdate();
  await card.updateComplete;
  await frame();
  const sourceKeyAfterEpochRecovery = card._isoSource()?.key;
  result.invalidSourceNewFingerprintRestoresIso = invalidAttempts === 2
    && sourceKeyAfterEpochRecovery !== sourceKeyBeforeEpochRecovery
    && !card._isoFallback.has(epochInvalidKey)
    && !card._isoFallback.has(nextEpochInvalidKey)
    && card._effectiveProjection() === 'iso'
    && !!root().querySelector('[data-hp="iso-walls"]');
  configSpace.partitions[0] = originalSmokeWall;
  card._cfgEpoch++;
  card.requestUpdate();
  await card.updateComplete;

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
      return { walls: [], floor: [], openings: [], openingSurfaces: [] };
    },
  });
  card._view = { x: 123456, y: 234567, w: 3456, h: 4567 };
  card._viewModeSnap = { mode: 'view', viewBox: { ...card._view }, zoom: 1 };
  card.requestUpdate();
  await card.updateComplete;
  card.hass = { ...card.hass, states: { ...card.hass.states } };
  await card.updateComplete;
  result.fallbackLatched = attempts === 1
    && card._viewModeSnap === null
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

  const runtime = card._isoSceneRuntime;
  const warning = console.warn;
  let lateAttempts = 0;
  const fallbackWarnings = [];
  const isoDiagnostics = [];
  const diagnosticText = (args) => args.map((value) => {
    if (value instanceof Error) return `${value.name}:${value.message}:${value.stack}`;
    if (value && typeof value === 'object') return JSON.stringify(value, (_key, item) =>
      item instanceof Error ? { name: item.name, message: item.message, stack: item.stack } : item);
    return String(value);
  }).join(' ');
  console.warn = (...args) => {
    if (/HOUSEPLAN ISO FALLBACK|hidden isometric runtime diagnostic/.test(String(args[0]))) {
      const text = diagnosticText(args);
      isoDiagnostics.push(text);
      if (String(args[0]).includes('HOUSEPLAN ISO FALLBACK')) fallbackWarnings.push(text);
    }
    else warning(...args);
  };
  const privateSpace = 'space.private_identifier';
  const privateAsset = 'https://private.invalid/iso.js?token=private-query';
  const currentSpace = card._space;
  card._space = privateSpace;
  const privateKey = `${privateSpace}|${privateAsset}`;
  card._latchIsoFallback(privateKey, new Error(`sensor.private_identifier ${privateAsset}`));
  card._space = currentSpace;
  card._isoFallback.delete(privateKey);
  card._isoSceneRuntimeLoader.options.failed(
    new Error(`${privateAsset}\nprivate stack sensor.private_identifier`), { terminal: false },
  );
  await card.updateComplete;
  result.isoDiagnosticsAreRedacted = isoDiagnostics.length === 2
    && isoDiagnostics.every((text) => /"kind":|kind=/.test(text)
      && /"fingerprint":|fingerprint=/.test(text) && /"terminal":|terminal=/.test(text))
    && !isoDiagnostics.some((text) => /private_identifier|private\.invalid|sensor\.|token=|stack/i.test(text));
  isoDiagnostics.length = 0;
  fallbackWarnings.length = 0;
  card._stepZoom(1);
  const lateTransitionStarted = card._cameraTransition.active;
  card._viewModeSnap = { mode: 'view', viewBox: { ...card._view }, zoom: card._zoom };
  card._isoSceneRuntime = {
    ...runtime,
    buildIsoOverlayRenderScene: () => {
      lateAttempts++;
      throw new Error('entity sensor.private_identifier must not reach diagnostics');
    },
  };
  card.requestUpdate();
  await card.updateComplete;
  card.hass = { ...card.hass, states: { ...card.hass.states } };
  await card.updateComplete;
  result.lateFailureIsRedactedAndLatched = lateTransitionStarted && !card._cameraTransition.active
    && card._viewModeSnap === null && lateAttempts === 1 && fallbackWarnings.length === 1
    && /"kind":"structural"/.test(fallbackWarnings[0])
    && /"fingerprint":"[a-z0-9]+"/.test(fallbackWarnings[0])
    && /"terminal":true/.test(fallbackWarnings[0])
    && !/(private_identifier|sensor\.|https?:|token=|stack)/i.test(fallbackWarnings[0])
    && !root().querySelector('[data-hp="iso-walls"]')
    && JSON.parse(localStorage.getItem('houseplan_card_view_v1') || '{}').f1 === 'iso';
  card._isoSceneRuntime = runtime;
  card._setProjection('iso');
  await card.updateComplete;
  result.lateFailureExplicitRetryRestoresIso = !!root().querySelector('[data-hp="iso-walls"]');
  console.warn = warning;

  history.replaceState(null, '', '#space=f1&hp_alpha=0');
  dispatchEvent(new HashChangeEvent('hashchange'));
  await card.updateComplete;
  await frame();
  result.removalIsImmediateFlat = window.__hpAlpha === false
    && localStorage.getItem('houseplan_card_alpha_v1') === '0'
    && JSON.stringify(window.__hpLabs) === '[]'
    && !root().querySelector('[data-hp="projection-toggle"]')
    && !root().querySelector('[data-hp="iso-walls"]')
    && !root().querySelector('[id^="hp-iso-"]')
    && ![...root().querySelector('.stage').classList]
      .some((name) => name.startsWith('projection-'));
  await enable();
  result.reenableRestoresPreference = window.__hpAlpha === true
    && root().querySelector('[data-hp="projection-toggle"]')?.getAttribute('aria-pressed') === 'true'
    && !!root().querySelector('[data-hp="iso-walls"]');
  return result;
});

checkAll(out);
await finish(browser, out);
