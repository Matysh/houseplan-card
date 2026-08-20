// Shared face parity for the same live light on the full plan, the marker
// editor preview and houseplan-space-card.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1100, height: 900 }, 1);
const res = await page.evaluate(async () => {
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const face = (node) => {
    if (!node) return null;
    const semantic = ['on', 'open', 'alarm', 'unavail', 'valonly', 'activity-running', 'activity-event', 'activity-presence', 'activity-transition'];
    return {
      classes: semantic.filter((name) => node.classList.contains(name)),
      icon: node.querySelector('.device-core > ha-icon')?.getAttribute('icon') || '',
      value: node.querySelector('.valtext')?.textContent?.trim() || '',
      badge: node.querySelector('.value-badge')?.textContent?.trim() || '',
      badgePosition: [...(node.querySelector('.value-badge')?.classList || [])]
        .find((name) => name.startsWith('pos-')) || '',
      scale: node.style.getPropertyValue('--dev-scale'),
      rippleScale: node.style.getPropertyValue('--ripple-scale'),
      rippleColor: node.style.getPropertyValue('--ripple-color'),
      pulse: [...(node.querySelector('.device-pulse')?.classList || [])]
        .filter((name) => ['alarm', 'short', 'continuous', 'event', 'presence', 'transition', 'running'].includes(name)),
      reducedMotionDot: !!node.querySelector('.activity-dot'),
    };
  };

  c._setMode('view');
  c.requestUpdate();
  await c.updateComplete;
  const planFace = face(sr().querySelector('.dev[data-id="d_light1"]'));

  c._setMode('devices');
  const device = c._devices.find((item) => item.id === 'd_light1');
  c._openMarkerDialog(device);
  await c.updateComplete;
  const preview = sr().querySelector('hp-device-preview');
  await preview?.updateComplete;
  preview?.dispatchEvent(new PointerEvent('pointerover', {
    pointerType: 'mouse', bubbles: true, composed: true,
  }));
  const previewHoverGatePropagates = c.hasAttribute('data-pointer-hover')
    && preview?.hasAttribute('data-pointer-hover');
  const previewFace = face(preview?.renderRoot?.querySelector('.dev'));
  const providerShown = /demo/i.test(preview?.renderRoot?.querySelector('.previewfacts')?.textContent || '');

  // Dynamic option creation must not leave a freshly mounted native select on
  // its first row when a different display/room/badge choice is persisted.
  // Unmount the dialog first: replacing one open marker can leave old option
  // nodes around and would miss the real first-open regression.
  c._markerDialog = null;
  await c.updateComplete;
  const badgeDevice = c._devices.find((item) => item.id === 'd_temp');
  c._openMarkerDialog({
    ...badgeDevice,
    marker: {
      ...(badgeDevice.marker || {}),
      display: 'value',
      value_badge: {
        enabled: true,
        source: { kind: 'derived_lqi' },
        position: 'left',
      },
    },
  });
  await c.updateComplete;
  const displaySelect = sr().querySelector('#marker-display');
  const roomSelect = sr().querySelector('#marker-room');
  const badgeSourceSelect = sr().querySelector('#marker-value-badge-source');
  const badgePositionSelect = sr().querySelector('#marker-value-badge-position');
  const savedBadgePreview = sr().querySelector('hp-device-preview');
  await savedBadgePreview?.updateComplete;
  const savedDisplaySelected = displaySelect?.value === 'value'
    && displaySelect?.selectedOptions?.[0]?.value === 'value';
  const expectedRoom = c._markerDialog?.room || '';
  const savedRoomSelected = expectedRoom !== '' && roomSelect?.value === expectedRoom
    && roomSelect?.selectedOptions?.[0]?.value === expectedRoom;
  const savedBadgeSourceSelected = badgeSourceSelect?.value === 'derived:lqi'
    && badgeSourceSelect?.selectedOptions?.[0]?.value === 'derived:lqi';
  const savedBadgePositionSelected = badgePositionSelect?.value === 'left'
    && badgePositionSelect?.selectedOptions?.[0]?.value === 'left';
  const savedBadgePreviewMatches = savedBadgePreview?.renderRoot
    ?.querySelector('.value-badge')?.textContent?.trim() === '154';
  const savedBadgeUntouched = c._markerDialog?.valueBadgeTouched === false;

  // Issue #90: every explicit anchor, including a long value and the largest
  // activity ring, stays inside the preview safe area with a real measured gap.
  c.hass.states['sensor.hp_preview_long'] = {
    entity_id: 'sensor.hp_preview_long', state: '12345678901234567890', attributes: {},
  };
  let badgeBounds = true;
  for (const position of ['right', 'bottom', 'left', 'top']) {
    c._markerDialog = {
      ...c._markerDialog,
      display: 'icon_ripple', rippleSize: 8,
      valueBadgeEnabled: true, valueBadgeTouched: true,
      valueBadgeSource: { kind: 'entity_state', entity_id: 'sensor.hp_preview_long' },
      valueBadgePosition: position,
    };
    c.requestUpdate();
    await c.updateComplete;
    const currentPreview = sr().querySelector('hp-device-preview');
    await currentPreview?.updateComplete;
    const stage = currentPreview?.renderRoot?.querySelector('.previewstage')?.getBoundingClientRect();
    const badge = currentPreview?.renderRoot?.querySelector('.value-badge')?.getBoundingClientRect();
    const gap = 3;
    badgeBounds &&= !!stage && !!badge
      && badge.left >= stage.left + gap && badge.right <= stage.right - gap
      && badge.top >= stage.top + gap && badge.bottom <= stage.bottom - gap;
  }

  // One persisted bottom badge is then projected through all three renderers.
  // It intentionally coexists with LQI to guard the vertical stack contract.
  const persistedBadge = {
    id: 'd_temp', binding: 'device:d_temp',
    value_badge: {
      enabled: true,
      source: { kind: 'entity_state', entity_id: 'sensor.living_temp' },
      position: 'bottom',
    },
  };
  c._serverCfg.markers = [
    ...(c._serverCfg.markers || []).filter((marker) => marker.id !== 'd_temp'),
    persistedBadge,
  ];
  c._regSignature = '';
  c._maybeRebuildDevices();
  c._setMode('view');
  c.requestUpdate();
  await c.updateComplete;
  const planBadgeNode = sr().querySelector('.dev[data-id="d_temp"]');
  const planBadgeFace = face(planBadgeNode);
  const planBadgeRect = planBadgeNode?.querySelector('.value-badge')?.getBoundingClientRect();
  const planLqiRect = planBadgeNode?.querySelector('.lqi')?.getBoundingClientRect();
  const bottomBadgeLqiStacked = !!planBadgeRect && !!planLqiRect
    && planLqiRect.top >= planBadgeRect.bottom - 1;

  c._openMarkerDialog(c._devices.find((item) => item.id === 'd_temp'));
  await c.updateComplete;
  const persistedPreview = sr().querySelector('hp-device-preview');
  await persistedPreview?.updateComplete;
  const persistedPreviewFace = face(persistedPreview?.renderRoot?.querySelector('.dev'));

  await customElements.whenDefined('houseplan-space-card');
  const card = document.createElement('houseplan-space-card');
  card.setConfig({ type: 'custom:houseplan-space-card', space: 'f1' });
  // A real static card reads the latest complete server/cache snapshot. Inject
  // that same revision explicitly here so this smoke compares renderers, not
  // the demo server's intentionally non-persistent websocket fixture.
  card._snap = {
    config: structuredClone(c._serverCfg),
    rev: c._cfgRev,
    configFingerprint: `fixture-${c._cfgRev}`,
    layout: structuredClone(c._layout),
    layoutRev: c._layoutRev,
    layoutFingerprint: `fixture-${c._layoutRev}`,
  };
  card._loadedOnce = true;
  card.hass = c.hass;
  document.body.appendChild(card);
  const started = Date.now();
  while (!card.renderRoot?.querySelector('.hp-static-stage') && Date.now() - started < 6000) await wait(60);
  await card.updateComplete;
  const staticNode = card.renderRoot.querySelector('.dev[data-id="d_light1"]');
  const staticFace = face(staticNode);
  const staticBadgeFace = face(card.renderRoot.querySelector('.dev[data-id="d_temp"]'));
  const visualFactorParity = [
    sr().querySelector('.dev[data-id="d_light1"]'),
    persistedPreview?.renderRoot?.querySelector('.dev'),
    staticNode,
  ].every((node) => getComputedStyle(node).getPropertyValue('--device-visual-factor').trim() === '0.9');

  return {
    allFacesPresent: !!planFace && !!previewFace && !!staticFace,
    previewHoverGatePropagates,
    planPreviewEqual: JSON.stringify(planFace) === JSON.stringify(previewFace),
    planStaticEqual: JSON.stringify(planFace) === JSON.stringify(staticFace),
    providerShown,
    savedDisplaySelected,
    savedRoomSelected,
    savedBadgeSourceSelected,
    savedBadgePositionSelected,
    savedBadgePreviewMatches,
    savedBadgeUntouched,
    badgeBounds,
    valueBadgePlanPreviewParity: JSON.stringify(planBadgeFace) === JSON.stringify(persistedPreviewFace),
    valueBadgePlanStaticParity: JSON.stringify(planBadgeFace) === JSON.stringify(staticBadgeFace),
    visualFactorParity,
    bottomBadgeLqiStacked,
    staticBindingHook: staticNode?.getAttribute('data-binding-status') === 'active',
  };
});

checkAll(res);
await finish(browser, res);
