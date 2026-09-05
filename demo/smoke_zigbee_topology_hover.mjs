import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const result = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const wait = (predicate, label, timeout = 5000) => new Promise((resolve, reject) => {
    const started = performance.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (performance.now() - started > timeout) return reject(new Error(`topology smoke timeout: ${label}`));
      setTimeout(tick, 20);
    };
    tick();
  });
  const mouse = (type, relatedTarget = null) => new PointerEvent(type, {
    pointerType: 'mouse', bubbles: true, composed: true, clientX: 200, clientY: 200, relatedTarget,
  });
  const out = {};

  await card.updateComplete;
  out.defaultOff = !root().querySelector('hp-zigbee-topology-overlay');
  out.offHasNoLazyChunk = !performance.getEntriesByType('resource')
    .some((entry) => /zigbee-topology-runtime|hp-zigbee-topology-overlay/.test(entry.name));

  let zhaCalls = 0;
  const originalHass = card.hass;
  card.hass = { ...originalHass, callWS: async (message) => {
    if (message.type !== 'zha/devices') return originalHass.callWS(message);
    zhaCalls++;
    return [
      { ieee: '00124b0000000001', device_reg_id: 'd_light1', device_type: 'Router', neighbors: [
        { ieee: '00124b0000000002', relationship: 'Parent' },
        { ieee: '00124b0000000003', lqi: 80, relationship: 'Child' },
        { ieee: '00124b0000000005', lqi: 125, relationship: 'Sibling' },
      ] },
      { ieee: '00124b0000000002', device_reg_id: 'd_lamp', device_type: 'Coordinator', neighbors: [
        { ieee: '00124b0000000001', lqi: 170, relationship: 'Child' },
        { ieee: '00124b0000000006', lqi: 140, relationship: 'Child' },
      ] },
      { ieee: '00124b0000000003', device_reg_id: 'd_mower', device_type: 'EndDevice', neighbors: [
        { ieee: '00124b0000000001', lqi: 75, relationship: 'Parent' },
      ] },
      { ieee: '00124b0000000004', device_reg_id: 'd_temp', device_type: 'EndDevice', neighbors: [
        { ieee: '00124b0000000006', lqi: 20, relationship: 'Parent' },
      ] },
      { ieee: '00124b0000000005', device_reg_id: 'd_tv', device_type: 'EndDevice', neighbors: [
        { ieee: '00124b0000000001', lqi: 120, relationship: 'Sibling' },
      ] },
      { ieee: '00124b0000000006', device_reg_id: 'not_on_plan', device_type: 'Router', neighbors: [
        { ieee: '00124b0000000002', lqi: 130, relationship: 'Parent' },
        { ieee: '00124b0000000004', lqi: 25, relationship: 'Child' },
      ] },
    ];
  } };
  await card._ensureEditorRuntime();
  card._openSettingsDialog();
  await card.updateComplete;
  let settings = root().querySelector('hp-zigbee-topology-settings');
  await wait(() => !!settings?.shadowRoot, 'settings mounted');
  settings._emit({ enabled: true, z2mBaseTopics: [] });
  await card.updateComplete;
  await card._saveSettingsDialog();
  await card.updateComplete;
  await wait(() => !!root().querySelector('hp-zigbee-topology-overlay'), 'overlay mounted');
  out.settingPersists = card._serverCfg.settings.zigbee_topology?.enabled === true;
  out.enableDoesNotFetch = zhaCalls === 0;

  card._openSettingsDialog();
  await card.updateComplete;
  settings = root().querySelector('hp-zigbee-topology-settings');
  await wait(() => !!settings?.shadowRoot?.querySelector('button'), 'settings button');
  await settings._readZha();
  await wait(() => settings._snapshot?.states?.zha?.phase === 'ready', 'ZHA ready');
  out.explicitZhaRead = zhaCalls === 1;
  card._settingsDialog = null;
  card.requestUpdate();
  await card.updateComplete;

  const frame = () => new Promise((resolve) => requestAnimationFrame(() =>
    requestAnimationFrame(resolve)));
  const centre = (element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const isoTopologyGeometry = async () => {
    const sourceMarker = root().querySelector('.dev[data-id="d_light1"]');
    const neighborMarker = root().querySelector('.dev[data-id="d_lamp"]');
    sourceMarker.dispatchEvent(mouse('pointerover'));
    await wait(() => root().querySelector('hp-zigbee-topology-overlay')?.shadowRoot
      ?.querySelector('line[data-direction="toward-neighbor"]'), 'Iso local route');
    const topology = root().querySelector('hp-zigbee-topology-overlay');
    await topology.updateComplete;
    await frame();
    const svg = topology.shadowRoot.querySelector('[data-hp="zigbee-topology-lines"]');
    const line = topology.shadowRoot.querySelector('line[data-direction="toward-neighbor"]');
    const halo = topology.shadowRoot.querySelector('[data-hp="zigbee-topology-neighbor"]');
    const matrix = svg?.getScreenCTM();
    const projected = (x, y) => new DOMPoint(Number(x), Number(y)).matrixTransform(matrix);
    const lineStart = projected(line?.getAttribute('x1'), line?.getAttribute('y1'));
    const lineEnd = projected(line?.getAttribute('x2'), line?.getAttribute('y2'));
    const sourceCentre = centre(sourceMarker);
    const neighborCentre = centre(neighborMarker);
    const haloCentre = centre(halo);
    const raised = [sourceMarker, neighborMarker].every((marker) => {
      const floor = marker.getAttribute('data-hp-iso-floor')?.split(',').map(Number);
      const visual = marker.getAttribute('data-hp-iso-visual')?.split(',').map(Number);
      return marker.getAttribute('data-hp-iso-overlay-kind') === 'device'
        && floor?.length === 2 && visual?.length === 2
        && floor.every(Number.isFinite) && visual.every(Number.isFinite)
        && Math.hypot(floor[0] - visual[0], floor[1] - visual[1]) > 0.1;
    });
    return {
      sourceCentre, neighborCentre, raised,
      aligned: !!matrix && distance(lineStart, sourceCentre) <= 1
        && distance(lineEnd, neighborCentre) <= 1
        && distance(haloCentre, neighborCentre) <= 1,
    };
  };

  const isoConfigSpace = card._serverCfg.spaces.find((space) => space.id === 'f1');
  isoConfigSpace.settings = {
    ...(isoConfigSpace.settings || {}), show_borders: true, show_names: true,
  };
  card._cfgEpoch++;
  card.requestUpdate();
  await card.updateComplete;
  history.replaceState(null, '', '#space=f1&hp_alpha=1');
  dispatchEvent(new HashChangeEvent('hashchange'));
  await wait(() => card._labsIso === true, 'alpha enabled');
  card._setProjection('iso');
  await window.__hpEnsureHarnessIsoRuntime(card);
  await wait(() => !!root().querySelector('[data-hp="iso-walls"]'), 'Iso walls');
  const isoBeforePanZoom = await isoTopologyGeometry();
  out.isoMarkersRaised = isoBeforePanZoom.raised;
  out.isoTopologyUsesRaisedDomCentres = isoBeforePanZoom.aligned;

  card._applyView(Math.min(2, Math.max(1.25, card._zoom * 1.45)), 0.24, 0.72);
  card.requestUpdate();
  await card.updateComplete;
  await frame();
  const currentSource = root().querySelector('.dev[data-id="d_light1"]');
  currentSource.dispatchEvent(mouse('pointerout', root().querySelector('.stage')));
  await wait(() => !root().querySelector('hp-zigbee-topology-overlay')?.shadowRoot
    ?.querySelector('line'), 'Iso route cleared after pan/zoom');
  const isoAfterPanZoom = await isoTopologyGeometry();
  out.isoTopologyTracksRaisedDomCentresAfterPanZoom = isoAfterPanZoom.aligned;
  out.isoPanZoomActuallyMovesMarker = distance(
    isoBeforePanZoom.sourceCentre, isoAfterPanZoom.sourceCentre,
  ) > 1;

  currentSource.dispatchEvent(mouse('pointerout', root().querySelector('.stage')));
  card._setProjection('flat');
  await card.updateComplete;
  await frame();

  const source = root().querySelector('.dev[data-id="d_light1"]');
  const unknownNeighbor = root().querySelector('.dev[data-id="d_lamp"]');
  const knownNeighbor = root().querySelector('.dev[data-id="d_tv"]');
  const unrelated = root().querySelector('.dev[data-id="d_temp"]');
  const roomLabel = root().querySelector('.roomlabel');
  source.style.left = '20%'; source.style.top = '36%';
  unknownNeighbor.style.left = '80%'; unknownNeighbor.style.top = '36%';
  knownNeighbor.style.left = '80%'; knownNeighbor.style.top = '68%';
  unrelated.style.left = '50%'; unrelated.style.top = '36%';
  if (roomLabel) { roomLabel.style.left = '65%'; roomLabel.style.top = '36%'; }
  source.dispatchEvent(mouse('pointerover'));
  await wait(() => root().querySelector('hp-zigbee-topology-overlay')?.shadowRoot
    ?.querySelector('[data-hp="zigbee-topology-lines"]'), 'local route');
  const overlay = root().querySelector('hp-zigbee-topology-overlay');
  await overlay.updateComplete;
  const devlayer = root().querySelector('.devlayer');
  const endpoints = [...devlayer.querySelectorAll('[data-hp-zigbee-topology-endpoint]')]
    .map((marker) => marker.dataset.id).sort();
  out.incidentOnly = overlay.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-line"]').length === 2
    && overlay.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-neighbor"]').length === 2;
  out.layerContract = overlay.parentElement === devlayer
    && !overlay.hasAttribute('data-hp-live-layer')
    && Number.parseInt(getComputedStyle(overlay).zIndex, 10) > Number.parseInt(getComputedStyle(unrelated).zIndex, 10)
    && Number.parseInt(getComputedStyle(source).zIndex, 10) > Number.parseInt(getComputedStyle(overlay).zIndex, 10)
    && (!roomLabel || Number.parseInt(getComputedStyle(overlay).zIndex, 10)
      > Number.parseInt(getComputedStyle(roomLabel).zIndex, 10));
  out.exactEndpoints = endpoints.join(',') === 'd_lamp,d_light1,d_tv'
    && !unrelated.hasAttribute('data-hp-zigbee-topology-endpoint');
  const routeLine = overlay.shadowRoot.querySelector(
    'line[data-hp="zigbee-topology-line"][data-direction="toward-neighbor"]',
  );
  const routeArrow = overlay.shadowRoot.querySelector('[data-hp="zigbee-topology-arrow"]');
  const lineBox = routeLine?.getBoundingClientRect();
  const arrowBox = routeArrow?.getBoundingClientRect();
  out.localRouteArrow = !!routeLine && routeArrow?.getAttribute('data-direction') === 'toward-neighbor'
    && !!lineBox && !!arrowBox && arrowBox.width > 3 && arrowBox.height > 3;
  out.crossSpaceCount = overlay.shadowRoot.querySelector('[data-hp="zigbee-topology-remote"]')
    ?.textContent.trim() === '+1 in other spaces';
  out.pointerTransparent = getComputedStyle(overlay).pointerEvents === 'none'
    && [...overlay.shadowRoot.querySelectorAll('svg,line,polygon,.halo,.remote,.parent-bubble')]
      .every((node) => getComputedStyle(node).pointerEvents === 'none');
  const unrelatedRect = unrelated.getBoundingClientRect();
  const hitTarget = root().elementFromPoint(
    unrelatedRect.left + unrelatedRect.width / 2,
    unrelatedRect.top + unrelatedRect.height / 2,
  );
  let clickReachedMarker = false;
  unrelated.addEventListener('click', (event) => {
    clickReachedMarker = true;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true, once: true });
  hitTarget?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  out.pointerHitTarget = !!hitTarget && unrelated.contains(hitTarget) && clickReachedMarker;
  const casing = overlay.shadowRoot.querySelector('[data-hp="zigbee-topology-line-casing"]');
  const unknownCore = overlay.shadowRoot.querySelector(
    '[data-hp="zigbee-topology-line"][stroke-dasharray="5 5"]',
  );
  const knownCore = [...overlay.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-line"]')]
    .find((line) => !line.hasAttribute('stroke-dasharray'));
  out.unknownCasingContract = !!casing && !!unknownCore && !!knownCore
    && overlay.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-line-casing"]').length === 1
    && casing.getAttribute('stroke') === '#2e2e2e'
    && casing.getAttribute('stroke-width') === '4'
    && unknownCore.getAttribute('stroke-width') === '2'
    && casing.getAttribute('stroke-dasharray') === unknownCore.getAttribute('stroke-dasharray')
    && casing.getAttribute('stroke-dashoffset') === unknownCore.getAttribute('stroke-dashoffset')
    && casing.getAttribute('x1') === unknownCore.getAttribute('x1')
    && casing.getAttribute('y1') === unknownCore.getAttribute('y1')
    && casing.getAttribute('x2') === unknownCore.getAttribute('x2')
    && casing.getAttribute('y2') === unknownCore.getAttribute('y2')
    && getComputedStyle(casing).strokeLinecap === getComputedStyle(unknownCore).strokeLinecap
    && getComputedStyle(casing).vectorEffect === 'non-scaling-stroke';

  const oldNeighbor = unknownNeighbor;
  const replacementNeighbor = oldNeighbor.cloneNode(true);
  oldNeighbor.replaceWith(replacementNeighbor);
  await wait(() => replacementNeighbor.hasAttribute('data-hp-zigbee-topology-endpoint'),
    'endpoint ownership transferred to replacement');
  out.domReplacementTransfers = !oldNeighbor.hasAttribute('data-hp-zigbee-topology-endpoint')
    && replacementNeighbor.hasAttribute('data-hp-zigbee-topology-endpoint');
  replacementNeighbor.replaceWith(oldNeighbor);
  await wait(() => oldNeighbor.hasAttribute('data-hp-zigbee-topology-endpoint'),
    'endpoint ownership returned to original marker');

  const runtimeBeforeInvalidation = overlay._runtime;
  overlay._acceptRuntime({
    revision: runtimeBeforeInvalidation.revision + 1,
    topologies: [],
    states: runtimeBeforeInvalidation.states,
  });
  await overlay.updateComplete;
  await wait(() => !root().querySelector('[data-hp-zigbee-topology-endpoint]'),
    'runtime invalidation clears endpoint ownership');
  out.runtimeInvalidationClears = !overlay.shadowRoot.querySelector('line')
    && !root().querySelector('[data-hp-zigbee-topology-endpoint]');
  overlay._acceptRuntime(runtimeBeforeInvalidation);
  await overlay.updateComplete;
  await wait(() => overlay.shadowRoot.querySelector('line'), 'route restored after runtime invalidation');

  card._commitSpace('garden', true);
  card.requestUpdate();
  await card.updateComplete;
  await wait(() => root().querySelector('.dev[data-id="d_mower"]'), 'garden marker');
  out.spaceChangeClears = !root().querySelector('[data-hp-zigbee-topology-endpoint]');
  const remoteChild = root().querySelector('.dev[data-id="d_mower"]');
  remoteChild.dispatchEvent(mouse('pointerover'));
  await wait(() => root().querySelector('hp-zigbee-topology-overlay')?.shadowRoot
    ?.querySelector('[data-hp="zigbee-topology-parent-bubble"]'), 'remote parent bubble');
  let activeOverlay = root().querySelector('hp-zigbee-topology-overlay');
  const firstTitle = card._serverCfg.spaces.find((space) => space.id === 'f1')?.title;
  out.remoteParentBubble = activeOverlay.shadowRoot
    .querySelector('[data-hp="zigbee-topology-parent-bubble"]')?.textContent.trim() === firstTitle
    && activeOverlay.shadowRoot.querySelector('[data-hp="zigbee-topology-parent-bubble"]')
      ?.getAttribute('data-kind') === 'remote-space'
    && !!activeOverlay.shadowRoot.querySelector('[data-hp="zigbee-topology-parent-arrow"]')
    && !activeOverlay.shadowRoot.querySelector('[data-hp="zigbee-topology-remote"]');

  card._commitSpace('f1', true);
  card.requestUpdate();
  await card.updateComplete;
  await wait(() => root().querySelector('.dev[data-id="d_temp"]'), 'temperature marker');
  const temperature = root().querySelector('.dev[data-id="d_temp"]');
  temperature.dispatchEvent(mouse('pointerover'));
  await wait(() => root().querySelector('hp-zigbee-topology-overlay')?.shadowRoot
    ?.querySelector('[data-kind="unplaced-device"]'), 'unplaced device bubble');
  activeOverlay = root().querySelector('hp-zigbee-topology-overlay');
  out.unplacedDeviceBubble = activeOverlay.shadowRoot.querySelector('[data-kind="unplaced-device"]')
    ?.textContent.trim() === 'device is not on the plan';

  activeOverlay.devices = activeOverlay.devices.map((device) => (
    device.id === 'd_lamp' ? { ...device, hidden: true } : device
  ));
  await activeOverlay.updateComplete;
  const router = root().querySelector('.dev[data-id="d_light1"]');
  router.dispatchEvent(mouse('pointerover'));
  await wait(() => activeOverlay.shadowRoot.querySelector('[data-kind="unplaced-coordinator"]'),
    'unplaced coordinator bubble');
  out.unplacedCoordinatorBubble = activeOverlay.shadowRoot
    .querySelector('[data-kind="unplaced-coordinator"]')?.textContent.trim()
      === 'coordinator is not on the plan';
  out.parentRouteHasNoCasing = !!activeOverlay.shadowRoot.querySelector('line.parent-route')
    && !activeOverlay.shadowRoot.querySelector('[data-hp="zigbee-topology-line-casing"]');

  router.dispatchEvent(mouse('pointerout', root().querySelector('.stage')));
  await activeOverlay.updateComplete;
  out.leaveClears = !activeOverlay.shadowRoot.querySelector('line')
    && !root().querySelector('[data-hp-zigbee-topology-endpoint]');
  router.dispatchEvent(mouse('pointerover'));
  await wait(() => activeOverlay.shadowRoot.querySelector('line'), 'route restored');
  activeOverlay.dispatchEvent(new PointerEvent('pointerdown', {
    pointerType: 'touch', bubbles: true, composed: true, pointerId: 7,
  }));
  await wait(() => !activeOverlay.shadowRoot.querySelector('line'), 'touch clears');
  out.touchClears = !activeOverlay.shadowRoot.querySelector('line')
    && !root().querySelector('[data-hp-zigbee-topology-endpoint]');
  card.setAttribute('data-pointer-hover', '');
  router.dispatchEvent(mouse('pointerover'));
  await wait(() => activeOverlay.shadowRoot.querySelector('line'), 'route restored after touch');
  activeOverlay.dispatchEvent(new PointerEvent('pointerdown', {
    pointerType: 'pen', bubbles: true, composed: true, pointerId: 8,
  }));
  await wait(() => !activeOverlay.shadowRoot.querySelector('line'), 'pen clears');
  out.penClears = !root().querySelector('[data-hp-zigbee-topology-endpoint]');
  card.setAttribute('data-pointer-hover', '');
  router.dispatchEvent(mouse('pointerover'));
  await wait(() => activeOverlay.shadowRoot.querySelector('line'), 'route restored before hover gate loss');
  card.removeAttribute('data-pointer-hover');
  await wait(() => !activeOverlay.shadowRoot.querySelector('line'), 'hover gate clears');
  out.hoverGateClears = !root().querySelector('[data-hp-zigbee-topology-endpoint]');
  card.setAttribute('data-pointer-hover', '');

  card._setMode('plan');
  await card.updateComplete;
  out.editorHasNoOverlay = !root().querySelector('hp-zigbee-topology-overlay')
    && !root().querySelector('[data-hp-zigbee-topology-endpoint]');
  card._setMode('view');
  await card.updateComplete;
  card._serverCfg = { ...card._serverCfg, settings: {
    ...card._serverCfg.settings,
    zigbee_topology: { ...card._serverCfg.settings.zigbee_topology, enabled: false },
  } };
  card.requestUpdate();
  await card.updateComplete;
  out.settingOffClears = !root().querySelector('hp-zigbee-topology-overlay')
    && !root().querySelector('[data-hp-zigbee-topology-endpoint]');
  card._serverCfg = { ...card._serverCfg, settings: {
    ...card._serverCfg.settings,
    zigbee_topology: { ...card._serverCfg.settings.zigbee_topology, enabled: true },
  } };
  card.hass = { ...card.hass, user: { ...card.hass.user, is_admin: false } };
  await card.updateComplete;
  out.nonAdminHasNoOverlay = !root().querySelector('hp-zigbee-topology-overlay')
    && !root().querySelector('[data-hp-zigbee-topology-endpoint]') && zhaCalls === 1;
  return out;
});

for (const [aspect, viewport] of Object.entries({
  wide: { width: 1100, height: 500 },
  tall: { width: 480, height: 900 },
})) {
  await page.setViewportSize(viewport);
  for (const [zoomName, zoom] of Object.entries({ min: 1 / 3, default: 1, max: 8 })) {
    const geometry = await page.evaluate(async ({ zoom, hostWidth }) => {
      const card = window.__card;
      const root = () => card.shadowRoot || card.renderRoot;
      const wait = (predicate, timeout = 5000) => new Promise((resolve, reject) => {
        const started = performance.now();
        const tick = () => {
          if (predicate()) return resolve();
          if (performance.now() - started > timeout) return reject(new Error('topology geometry timeout'));
          setTimeout(tick, 20);
        };
        tick();
      });
      document.querySelector('#host').style.width = `${hostWidth}px`;
      card.hass = { ...card.hass, user: { ...card.hass.user, is_admin: true } };
      card._setMode('view');
      card._commitSpace('f1', true);
      card._zoom = 1;
      card._view = null;
      card.requestUpdate();
      await card.updateComplete;
      card._applyView(zoom, 0.32, 0.36);
      card.requestUpdate();
      await card.updateComplete;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const source = root().querySelector('.dev[data-id="d_light1"]');
      source.dispatchEvent(new PointerEvent('pointerover', {
        pointerType: 'mouse', bubbles: true, composed: true, clientX: 200, clientY: 200,
      }));
      await wait(() => root().querySelector('hp-zigbee-topology-overlay')?.shadowRoot
        ?.querySelector('[data-hp="zigbee-topology-arrow"]'));
      const overlay = root().querySelector('hp-zigbee-topology-overlay');
      await overlay.updateComplete;
      const svg = overlay.shadowRoot.querySelector('svg');
      const arrow = overlay.shadowRoot.querySelector('[data-hp="zigbee-topology-arrow"]');
      const line = overlay.shadowRoot.querySelector(
        'line[data-hp="zigbee-topology-line"][data-direction="toward-neighbor"]',
      );
      const points = arrow.getAttribute('points').trim().split(/\s+/).map((pair) => {
        const [x, y] = pair.split(',').map(Number);
        return new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
      });
      const tip = points[0];
      const base = new DOMPoint((points[1].x + points[2].x) / 2, (points[1].y + points[2].y) / 2);
      const length = Math.hypot(tip.x - base.x, tip.y - base.y);
      const halfWidth = Math.hypot(points[1].x - points[2].x, points[1].y - points[2].y) / 2;
      const lineVector = {
        x: Number(line.getAttribute('x2')) - Number(line.getAttribute('x1')),
        y: Number(line.getAttribute('y2')) - Number(line.getAttribute('y1')),
      };
      const arrowVector = { x: tip.x - base.x, y: tip.y - base.y };
      const alignment = (lineVector.x * arrowVector.x + lineVector.y * arrowVector.y)
        / (Math.hypot(lineVector.x, lineVector.y) * Math.hypot(arrowVector.x, arrowVector.y));
      const devlayer = root().querySelector('.devlayer');
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      devlayer.style.transformOrigin = '0 0';
      devlayer.style.transform = 'translate(7%, 5%) scale(.88)';
      const liveOverlay = root().querySelector('hp-zigbee-topology-overlay');
      const liveSvg = liveOverlay.shadowRoot.querySelector('svg');
      const liveLine = liveOverlay.shadowRoot.querySelector(
        'line[data-hp="zigbee-topology-line"][data-direction="toward-neighbor"]',
      );
      const liveSource = root().querySelector('.dev[data-id="d_light1"]');
      const sourceRect = liveSource.getBoundingClientRect();
      const originScreen = new DOMPoint(
        Number(liveLine.getAttribute('x1')), Number(liveLine.getAttribute('y1')),
      ).matrixTransform(liveSvg.getScreenCTM());
      const liveAligned = Math.hypot(
        originScreen.x - (sourceRect.left + sourceRect.width / 2),
        originScreen.y - (sourceRect.top + sourceRect.height / 2),
      ) < 1.5;
      const parentProjected = !!devlayer.style.transform;
      const overlaySharesParent = liveOverlay.parentElement === devlayer;
      const overlayHasNoProjection = !liveOverlay.hasAttribute('data-hp-live-layer')
        && !liveOverlay.style.transform;
      devlayer.style.removeProperty('transform');
      devlayer.style.removeProperty('transform-origin');
      card.requestUpdate();
      await card.updateComplete;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const settledLayer = root().querySelector('.devlayer');
      const settledOverlay = root().querySelector('hp-zigbee-topology-overlay');
      await settledOverlay.updateComplete;
      const settledSvg = settledOverlay.shadowRoot.querySelector('svg');
      const settledLine = settledOverlay.shadowRoot.querySelector(
        'line[data-hp="zigbee-topology-line"][data-direction="toward-neighbor"]',
      );
      const settledSource = root().querySelector('.dev[data-id="d_light1"]');
      const settledRect = settledSource.getBoundingClientRect();
      const settledOrigin = new DOMPoint(
        Number(settledLine.getAttribute('x1')), Number(settledLine.getAttribute('y1')),
      ).matrixTransform(settledSvg.getScreenCTM());
      const settledAligned = Math.hypot(
        settledOrigin.x - (settledRect.left + settledRect.width / 2),
        settledOrigin.y - (settledRect.top + settledRect.height / 2),
      ) < 1.5;
      return {
        arrowGeometry: length > 8.5 && length < 9.5 && halfWidth > 4 && halfWidth < 5
          && alignment > 0.999,
        pointerTransparent: getComputedStyle(overlay).pointerEvents === 'none',
        parentProjected,
        overlaySharesParent,
        overlayHasNoProjection,
        liveAligned,
        settledTransformCleared: !settledLayer.style.transform,
        settledAligned,
      };
    }, { zoom, hostWidth: Math.max(320, viewport.width - 40) });
    for (const [name, value] of Object.entries(geometry)) {
      result[`geometry_${aspect}_${zoomName}_${name}`] = value;
    }
  }
}

await page.setViewportSize({ width: 1100, height: 620 });
const rasterProbe = await page.evaluate(async () => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  const wait = (predicate, timeout = 5000) => new Promise((resolve, reject) => {
    const started = performance.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (performance.now() - started > timeout) return reject(new Error('topology raster timeout'));
      setTimeout(tick, 20);
    };
    tick();
  });
  document.querySelector('#host').style.width = '1060px';
  card.hass = { ...card.hass, user: { ...card.hass.user, is_admin: true } };
  card._setMode('view');
  card._commitSpace('f1', true);
  card._zoom = 1;
  card._view = null;
  card.requestUpdate();
  await card.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const source = root.querySelector('.dev[data-id="d_light1"]');
  const neighbor = root.querySelector('.dev[data-id="d_lamp"]');
  const known = root.querySelector('.dev[data-id="d_tv"]');
  const unrelated = root.querySelector('.dev[data-id="d_temp"]');
  let label = root.querySelector('.roomlabel');
  const event = (type, relatedTarget = null) => new PointerEvent(type, {
    pointerType: 'mouse', bubbles: true, composed: true, clientX: 200, clientY: 200, relatedTarget,
  });
  const existing = root.querySelector('hp-zigbee-topology-overlay');
  source.dispatchEvent(event('pointerout', root.querySelector('.stage')));
  await existing?.updateComplete;
  source.dispatchEvent(event('pointerover'));
  await wait(() => root.querySelector('hp-zigbee-topology-overlay')?.shadowRoot
    ?.querySelector('[data-hp="zigbee-topology-line-casing"]'));
  const overlay = root.querySelector('hp-zigbee-topology-overlay');
  await card.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const renderedLabel = root.querySelector('.roomlabel');
  label = renderedLabel?.cloneNode(true) || document.createElement('div');
  label.className = 'roomlabel';
  label.dataset.hp = 'zigbee-topology-room-label-raster-control';
  label.removeAttribute('data-id');
  source.style.left = '18%'; source.style.top = '42%';
  neighbor.style.left = '82%'; neighbor.style.top = '42%';
  known.style.left = '82%'; known.style.top = '70%';
  unrelated.style.left = '48%'; unrelated.style.top = '42%';
  if (label) {
    label.style.left = '66%'; label.style.top = '42%';
    label.style.width = '28px'; label.style.height = '28px';
    label.style.background = '#ff00ff'; label.style.fontSize = '0';
  }
  overlay.parentElement.insertBefore(label, overlay);
  overlay.viewKey = { raster: true };
  await overlay.updateComplete;
  const svg = overlay.shadowRoot.querySelector('svg');
  const line = overlay.shadowRoot.querySelector(
    '[data-hp="zigbee-topology-line"][stroke-dasharray="5 5"]',
  );
  const matrix = svg.getScreenCTM();
  const start = new DOMPoint(Number(line.getAttribute('x1')), Number(line.getAttribute('y1')))
    .matrixTransform(matrix);
  const end = new DOMPoint(Number(line.getAttribute('x2')), Number(line.getAttribute('y2')))
    .matrixTransform(matrix);
  const centre = (node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };
  const labelCentre = label ? centre(label) : null;
  return {
    dpr: devicePixelRatio,
    line: { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } },
    source: centre(source),
    neighbor: centre(neighbor),
    unrelated: centre(unrelated),
    label: labelCentre ? { x: labelCentre.x, y: start.y } : null,
    labelContainsLine: !labelCentre || Math.abs(labelCentre.y - start.y) <= 14,
  };
});
const activeRaster = await page.screenshot({ animations: 'disabled' });
await page.evaluate(() => {
  const card = window.__card;
  (card.shadowRoot || card.renderRoot).querySelector('hp-zigbee-topology-overlay').style.visibility = 'hidden';
});
const baselineRaster = await page.screenshot({ animations: 'disabled' });
await page.evaluate(() => {
  const card = window.__card;
  (card.shadowRoot || card.renderRoot).querySelector('hp-zigbee-topology-overlay').style.visibility = '';
});
const rasterEvidence = await page.evaluate(async ({ active, baseline, probe }) => {
  const decode = async (base64) => {
    const response = await fetch(`data:image/png;base64,${base64}`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, height: bitmap.height,
      data: context.getImageData(0, 0, bitmap.width, bitmap.height).data };
  };
  const a = await decode(active);
  const b = await decode(baseline);
  if (a.width !== b.width || a.height !== b.height) return {
    unrelatedAbove: false, labelAbove: false, endpointsAbove: false,
    casingInk: false, transparentGaps: false,
  };
  const changed = (x, y, threshold = 24) => {
    const px = Math.max(0, Math.min(a.width - 1, Math.round(x * probe.dpr)));
    const py = Math.max(0, Math.min(a.height - 1, Math.round(y * probe.dpr)));
    const i = (py * a.width + px) * 4;
    return Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1])
      + Math.abs(a.data[i + 2] - b.data[i + 2]) > threshold;
  };
  const changedIn = (point, rx, ry) => {
    if (!point) return 0;
    let count = 0;
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      if (changed(point.x + x, point.y + y)) count++;
    }
    return count;
  };
  const unrelatedInk = changedIn(probe.unrelated, 5, 4);
  const labelInk = changedIn(probe.label, 8, 4);
  const endpointInk = changedIn(probe.source, 3, 3) + changedIn(probe.neighbor, 3, 3);
  const dx = probe.line.end.x - probe.line.start.x;
  const dy = probe.line.end.y - probe.line.start.y;
  const length = Math.hypot(dx, dy);
  const ux = dx / length; const uy = dy / length;
  const nx = -uy; const ny = ux;
  let coreAndCasing = 0; let transparentGap = 0;
  for (let distance = 35; distance < Math.min(length - 35, length * 0.42); distance += 1) {
    const x = probe.line.start.x + ux * distance;
    const y = probe.line.start.y + uy * distance;
    const core = changed(x, y);
    const edge = changed(x + nx * 1.75, y + ny * 1.75)
      || changed(x - nx * 1.75, y - ny * 1.75);
    const quietCore = !changed(x, y, 60);
    const quietEdge = !changed(x + nx * 1.75, y + ny * 1.75, 60)
      && !changed(x - nx * 1.75, y - ny * 1.75, 60);
    if (core && edge) coreAndCasing++;
    if (quietCore && quietEdge) transparentGap++;
  }
  return {
    unrelatedAbove: unrelatedInk >= 3,
    labelAbove: labelInk >= 2,
    endpointsAbove: endpointInk <= 2,
    casingInk: coreAndCasing >= 6,
    transparentGaps: transparentGap >= 1,
  };
}, {
  active: activeRaster.toString('base64'),
  baseline: baselineRaster.toString('base64'),
  probe: rasterProbe,
});
result.rasterLabelContainsLine = rasterProbe.labelContainsLine;
for (const [name, value] of Object.entries(rasterEvidence)) {
  result[`raster_${name}`] = value;
}

const realHoverPoint = await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  const source = root.querySelector('.dev[data-id="d_light1"]');
  const rect = source.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
});
await page.mouse.move(realHoverPoint.x, realHoverPoint.y);
result.realPointerEndpointWins = await page.evaluate(async () => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  const source = root.querySelector('.dev[data-id="d_light1"]');
  const overlay = root.querySelector('hp-zigbee-topology-overlay');
  const started = performance.now();
  while ((!source.matches(':hover')
      || !source.hasAttribute('data-hp-zigbee-topology-endpoint')
      || !overlay?.shadowRoot?.querySelector('[data-hp="zigbee-topology-line"]'))
    && performance.now() - started < 5000) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return source.matches(':hover')
    && source.hasAttribute('data-hp-zigbee-topology-endpoint')
    && Number.parseInt(getComputedStyle(source).zIndex, 10)
      > Number.parseInt(getComputedStyle(overlay).zIndex, 10);
});

await page.emulateMedia({ forcedColors: 'active' });
result.forcedColorsPreserved = await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  const overlay = root.querySelector('hp-zigbee-topology-overlay');
  const casing = overlay.shadowRoot.querySelector('[data-hp="zigbee-topology-line-casing"]');
  const core = overlay.shadowRoot.querySelector(
    '[data-hp="zigbee-topology-line"][stroke-dasharray="5 5"]',
  );
  return !!casing && !!core && getComputedStyle(casing).stroke === getComputedStyle(core).stroke
    && getComputedStyle(casing).stroke !== 'rgb(46, 46, 46)';
});
await page.emulateMedia({ forcedColors: 'none' });

result.disconnectClears = await page.evaluate(async () => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  const source = root.querySelector('.dev[data-id="d_light1"]');
  const overlay = root.querySelector('hp-zigbee-topology-overlay');
  source.dispatchEvent(new PointerEvent('pointerover', {
    pointerType: 'mouse', bubbles: true, composed: true, clientX: 200, clientY: 200,
  }));
  await overlay.updateComplete;
  const owned = [...root.querySelectorAll('[data-hp-zigbee-topology-endpoint]')];
  card.remove();
  await Promise.resolve();
  return owned.length >= 2 && owned.every(
    (marker) => !marker.hasAttribute('data-hp-zigbee-topology-endpoint'),
  );
});

checkAll(result);
await finish(browser, result);
