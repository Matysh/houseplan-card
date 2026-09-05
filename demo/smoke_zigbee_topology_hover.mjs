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
        { ieee: '00124b0000000002', lqi: 180, relationship: 'Parent' },
        { ieee: '00124b0000000003', lqi: 80, relationship: 'Child' },
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
      { ieee: '00124b0000000005', device_reg_id: 'd_tv', device_type: 'EndDevice', neighbors: [] },
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

  const source = root().querySelector('.dev[data-id="d_light1"]');
  source.dispatchEvent(mouse('pointerover'));
  await wait(() => root().querySelector('hp-zigbee-topology-overlay')?.shadowRoot
    ?.querySelector('[data-hp="zigbee-topology-lines"]'), 'local route');
  const overlay = root().querySelector('hp-zigbee-topology-overlay');
  out.incidentOnly = overlay.shadowRoot.querySelectorAll('line').length === 1
    && overlay.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-neighbor"]').length === 1;
  const routeLine = overlay.shadowRoot.querySelector('line[data-direction="toward-neighbor"]');
  const routeArrow = overlay.shadowRoot.querySelector('[data-hp="zigbee-topology-arrow"]');
  const lineBox = routeLine?.getBoundingClientRect();
  const arrowBox = routeArrow?.getBoundingClientRect();
  out.localRouteArrow = !!routeLine && routeArrow?.getAttribute('data-direction') === 'toward-neighbor'
    && !!lineBox && !!arrowBox && arrowBox.width > 3 && arrowBox.height > 3;
  out.crossSpaceCount = overlay.shadowRoot.querySelector('[data-hp="zigbee-topology-remote"]')
    ?.textContent.trim() === '+1 in other spaces';
  out.pointerTransparent = getComputedStyle(overlay).pointerEvents === 'none'
    && getComputedStyle(overlay.shadowRoot.querySelector('[data-hp="zigbee-topology-remote"]')).pointerEvents === 'none';

  card._commitSpace('garden', true);
  card.requestUpdate();
  await card.updateComplete;
  await wait(() => root().querySelector('.dev[data-id="d_mower"]'), 'garden marker');
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

  router.dispatchEvent(mouse('pointerout', root().querySelector('.stage')));
  await activeOverlay.updateComplete;
  out.leaveClears = !activeOverlay.shadowRoot.querySelector('line');
  router.dispatchEvent(mouse('pointerover'));
  await wait(() => activeOverlay.shadowRoot.querySelector('line'), 'route restored');
  root().querySelector('.stage').dispatchEvent(new PointerEvent('pointermove', {
    pointerType: 'touch', bubbles: true, composed: true, pointerId: 7,
  }));
  await wait(() => !activeOverlay.shadowRoot.querySelector('line'), 'touch clears');
  out.touchClears = !activeOverlay.shadowRoot.querySelector('line');

  card._setMode('plan');
  await card.updateComplete;
  out.editorHasNoOverlay = !root().querySelector('hp-zigbee-topology-overlay');
  card._setMode('view');
  card.hass = { ...card.hass, user: { ...card.hass.user, is_admin: false } };
  await card.updateComplete;
  out.nonAdminHasNoOverlay = !root().querySelector('hp-zigbee-topology-overlay') && zhaCalls === 1;
  return out;
});

for (const [aspect, viewport] of Object.entries({
  wide: { width: 1100, height: 500 },
  tall: { width: 480, height: 900 },
})) {
  await page.setViewportSize(viewport);
  for (const [zoomName, zoom] of Object.entries({ min: 1 / 3, default: 1, max: 8 })) {
    result[`geometry_${aspect}_${zoomName}`] = await page.evaluate(async ({ zoom, hostWidth }) => {
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
      const line = overlay.shadowRoot.querySelector('line[data-direction="toward-neighbor"]');
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
      return length > 8.5 && length < 9.5 && halfWidth > 4 && halfWidth < 5
        && alignment > 0.999 && getComputedStyle(overlay).pointerEvents === 'none';
    }, { zoom, hostWidth: Math.max(320, viewport.width - 40) });
  }
}

checkAll(result);
await finish(browser, result);
