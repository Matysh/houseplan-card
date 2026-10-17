// #919: native display toggle, immutable stored visibility and ordinary faces.
import { launch, check, checkAll, finish } from './serve.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';
const { page, browser } = await launch({ width: 1440, height: 1000 }, 1, [], { hasTouch: true });
try {
let card = page.locator('houseplan-card').first();
const settle = async () => {
  await page.evaluate(() => window.__hpTest.settled());
  await page.waitForFunction(() => !window.__card._modeTransitionBusy && !window.__card._devicePositionBusy
    && !window.__card._cameraTransition.active && !window.__card._viewportGestureDirty);
};
const toggle = async () => { await card.locator('[data-hp="hidden-devices"]').click(); await settle(); };
const state = () => page.evaluate(() => {
  const c = window.__card, id = window.__hiddenTargets.lamp;
  const el = c.renderRoot.querySelector(`[data-hp="device"][data-id="${id}"]`);
  const core = el?.querySelector('.device-shell-frame');
  return { shown: c.renderRoot.querySelector('[data-hp="hidden-devices"]')?.getAttribute('aria-pressed'),
    exists: !!el, ghost: el?.classList.contains('ghost') ?? false, on: el?.classList.contains('on') ?? false,
    opacity: el ? getComputedStyle(el).opacity : null, border: core ? getComputedStyle(core).borderStyle : null,
    box: el ? { x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y, width: el.getBoundingClientRect().width } : null,
    view: { ...c._view }, saved: c._serverCfg.markers.find(m => m.id === id)?.hidden,
    disabled: !!c.renderRoot.querySelector(`[data-hp="device"][data-id="${window.__hiddenTargets.disabled}"]`),
    removed: !!c.renderRoot.querySelector('[data-hp="device"][data-id="hidden-removed"]'),
    key: c._hiddenDevicePreference.address };
});
const stored = () => page.evaluate(async () => {
  const c = window.__card;
  const cfg = await c.hass.callWS({ type: 'houseplan/config/get' });
  const layout = await c.hass.callWS({ type: 'houseplan/layout/get' });
  return JSON.stringify({ config: cfg.config, cr: cfg.rev, layout: layout.layout, lr: layout.rev });
});
await page.evaluate(async () => {
  const c = window.__card;
  await window.__hpTest.waitForWrites();
  const lamp = c._devices.find(d => d.space === c._space && d.bindingKind === 'device'
    && d.primary?.startsWith('light.') && c.hass.states[d.primary]?.state === 'on');
  const disabled = c._devices.find(d => d.space === c._space && d.bindingKind === 'device' && d.id !== lamp?.id);
  if (!lamp || !disabled) throw Error('hidden-device fixture needs an on HA light and another HA device');
  window.__hiddenTargets = { lamp: lamp.id, disabled: disabled.id, space: c._space };
  await window.__hpTest.setServerConfig(cfg => {
    cfg.settings = { ...cfg.settings, filter_seeded: true };
    cfg.markers = (cfg.markers || []).filter(m => ![lamp.id, disabled.id, 'hidden-removed', 'hidden-virtual', 'hidden-led'].includes(m.id));
    cfg.markers.push({ ...lamp.marker, id: lamp.id, binding: `device:${lamp.bindingRef}`, hidden: true, tap_action: 'toggle', tap_confirm: false },
      { ...disabled.marker, id: disabled.id, binding: `device:${disabled.bindingRef}`, hidden: true },
      { id: 'hidden-removed', binding: 'entity:sensor.missing_hidden', hidden: true, removed: true },
      { id: 'hidden-virtual', binding: 'virtual', name: 'Hidden ordinary virtual', space: c._space, hidden: true, icon: 'mdi:thermometer' },
      { id: 'hidden-led', binding: 'virtual', name: 'Hidden LED', space: c._space, hidden: true, is_light: true });
    const space = cfg.spaces.find(s => s.id === c._space);
    space.settings = { ...space.settings, glow_enabled: true };
    space.led_strips = [{ id: 'hidden-strip', marker: 'hidden-led', points: [[.25,.65],[.55,.65]] }];
    return cfg;
  });
  await window.__hpTest.setLayout(layout => ({ ...layout,
    [lamp.id]: { s: c._space, x: .35, y: .35 }, 'hidden-virtual': { s: c._space, x: .65, y: .35 } }));
  window.__setRegistryDisabled('device', disabled.bindingRef, 'user');
  c.hass = window.__mkHass();
  await window.__hpTest.settled();
  window.__hiddenWrites = [];
  const original = c.hass.callWS;
  c.hass = { ...c.hass, callWS: async message => {
    if (/^houseplan\//.test(message.type) && !/\/(get|list|subscribe)$/.test(message.type)) window.__hiddenWrites.push(structuredClone(message));
    return original(message);
  } };
});
await settle();
await card.locator('[data-hp="zoom-fit"]').click(); await settle();
await card.locator('[data-hp="zoom-in"]').click(); await settle();
const before = await stored();
checkAll({ defaultOff: (await state()).shown === 'false', hiddenAbsentBefore: !(await state()).exists });
const cameraBefore = await page.evaluate(() => ({ ...window.__card._view }));
const neighbourBox = () => page.evaluate(() => {
  const c = window.__card, el = [...c.renderRoot.querySelectorAll('.dev[data-id]')]
    .find(el => !['hidden-virtual', window.__hiddenTargets.lamp, window.__hiddenTargets.disabled].includes(el.dataset.id));
  if (!el) throw Error('fixture needs a visible neighbour');
  const r = el.getBoundingClientRect(); return { id: el.dataset.id, x: r.x, y: r.y, width: r.width };
});
const neighbourBefore = await neighbourBox();
await toggle();
const revealed = await state();
checkAll({ activeShowsOrdinarily: revealed.shown === 'true' && revealed.exists && !revealed.ghost && revealed.on,
  activeNotDashed: revealed.border && !revealed.border.includes('dashed'),
  savedHiddenUnchanged: revealed.saved === true,
  disabledAbsentInView: !revealed.disabled, tombstoneAbsent: !revealed.removed,
  cameraUnchanged: JSON.stringify(revealed.view) === JSON.stringify(cameraBefore),
  virtualIsOrdinary: await card.locator('[data-hp="device"][data-id="hidden-virtual"]:not(.ghost)').count() === 1 });
check('eyeKeepsVisibleNeighbourPositionAndSize', JSON.stringify(await neighbourBox()), JSON.stringify(neighbourBefore));
await page.waitForFunction(() => !!window.__card.renderRoot.querySelector('[data-led-strip="hidden-strip"][data-marker="hidden-led"]')).catch(async error => {
  console.log('missing-led', await page.evaluate(() => {
    const c = window.__card;
    return { shown: c._showHidden, mode: c._mode, space: c._space, strips: c._spaceModel()?.led_strips,
      device: c._renderDevices.find(d => d.id === 'hidden-led'),
      painted: [...c.renderRoot.querySelectorAll('[data-led-strip]')].map(el => el.outerHTML.slice(0, 200)) };
  })); throw error;
});
check('ledHasNoDuplicateIcon', await card.locator('.dev[data-hp="device"][data-id="hidden-led"]').count(), 0);
for (const mode of ['plan', 'devices', 'decor', 'view']) {
  await page.evaluate(mode => window.__hpTest.setMode(mode), mode); await settle();
  const receipt = await state();
  check(`${mode}KeepsOrdinaryReveal`, receipt.shown === 'true' && receipt.exists && !receipt.ghost);
  if (mode === 'devices') check('disabledOnlyServiceGhost', await card.locator(`[data-hp="device"][data-id="${await page.evaluate(() => window.__hiddenTargets.disabled)}"].ha-disabled.ghost`).count(), 1);
  else check(`${mode}DoesNotRevealDisabled`, !receipt.disabled);
}
const floors = await page.evaluate(() => ({ first: window.__card._space,
  other: window.__card._model.find(space => space.id !== window.__card._space)?.id }));
if (!floors.other) throw Error('fixture needs a second floor');
await page.evaluate(id => window.__hpTest.switchSpace(id), floors.other); await settle();
check('floorSwitchKeepsLocalRevealChoice', (await state()).shown, 'true');
await page.evaluate(id => window.__hpTest.switchSpace(id), floors.first); await settle();
const returned = await state();
check('floorReturnKeepsOrdinaryRevealedFace', returned.shown === 'true' && returned.exists && !returned.ghost);
check('displayAndModesDoNotWritePair', await stored(), before);
check('displayDoesNotMutateWS', await page.evaluate(() => window.__hiddenWrites.length), 0);
check('displayDoesNotCallHA', await page.evaluate(() => window.__serviceCalls.length), 0);
await card.locator(`[data-hp="device"][data-id="${await page.evaluate(() => window.__hiddenTargets.lamp)}"]`).click();
await settle();
check('revealedLightHasOrdinaryToggle', await page.evaluate(() => window.__serviceCalls.length), 1);
const viewFace = await card.locator(`[data-hp="device"][data-id="${await page.evaluate(() => window.__hiddenTargets.lamp)}"]`).boundingBox();
if (!viewFace) throw Error('revealed face missing before View pan');
await page.mouse.move(viewFace.x + viewFace.width / 2, viewFace.y + viewFace.height / 2);
await page.mouse.down();
await page.mouse.move(viewFace.x + viewFace.width / 2 + 45, viewFace.y + viewFace.height / 2 + 20, { steps: 6 });
await page.mouse.up(); await settle();
check('revealedViewPanDoesNotWritePosition', await page.evaluate(() => window.__hiddenWrites.length), 0);
check('revealedViewPanDoesNotToggleLamp', await page.evaluate(() => window.__serviceCalls.length), 1);

// The catalogue is a second surface of the same choice, not a second mode.
await page.evaluate(() => window.__hpTest.setMode('devices')); await settle();
await card.locator('[data-hp="tool"][data-tool="device-inbox"]').click();
const catalog = card.locator('[data-kind="device-inbox"]');
const checkbox = catalog.locator('.device-inbox-filter-help input[type="checkbox"]');
check('catalogAgreesWithHeader', await checkbox.isChecked());
await checkbox.uncheck(); await settle();
checkAll({ catalogOffUpdatesHeader: (await state()).shown === 'false', catalogOffHidesMarker: !(await state()).exists });
await checkbox.check(); await settle();
check('catalogOnUpdatesHeader', (await state()).shown, 'true');
await page.evaluate(() => window.__hpTest.close());
await card.locator('[data-hp="zoom-fit"]').click(); await settle();
const positionBefore = await page.evaluate(() => structuredClone(window.__card._layout[window.__hiddenTargets.lamp]));
const writerStart = await page.evaluate(() => window.__hiddenWrites.length);
const lampFace = card.locator(`[data-hp="device"][data-id="${await page.evaluate(() => window.__hiddenTargets.lamp)}"]`);
const dragBox = await lampFace.boundingBox();
if (!dragBox) throw Error('revealed face missing before drag');
await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
await page.mouse.down();
await page.mouse.move(dragBox.x + dragBox.width / 2 + 55, dragBox.y + dragBox.height / 2 + 30, { steps: 8 });
await page.mouse.up(); await settle();
await page.evaluate(() => window.__hpTest.waitForWrites());
const dragReceipt = await page.evaluate(({ writerStart, positionBefore }) => {
  const c = window.__card, id = window.__hiddenTargets.lamp;
  const writes = window.__hiddenWrites.slice(writerStart);
  return { onePositionWrite: writes.length === 1 && writes[0].type === 'houseplan/layout/update' && writes[0].device_id === id,
    moved: JSON.stringify(c._layout[id]) !== JSON.stringify(positionBefore),
    stillHidden: c._serverCfg.markers.find(m => m.id === id)?.hidden === true,
    oneUndo: c._devicePositionHistory.size === 1 };
}, { writerStart, positionBefore });
checkAll(dragReceipt);
await page.evaluate(() => window.__hpTest.setMode('view')); await settle();

// Same live state, same geometry, same ordinary light projection: saved-hide
// plus the eye must paint exactly what a permanently shown marker paints.
await page.evaluate(async () => {
  const c = window.__card, lamp = c._devices.find(d => d.id === window.__hiddenTargets.lamp), eid = lamp.primary;
  c.hass = { ...c.hass, states: { ...c.hass.states, [eid]: { ...c.hass.states[eid], state: 'on' } } };
  await window.__hpTest.settled();
});
await settle();
const lightPaint = () => page.evaluate(() => {
  const c = window.__card;
  return { glow: [...c.renderRoot.querySelectorAll('[data-glow-source]')].map(el => el.outerHTML),
    led: [...c.renderRoot.querySelectorAll('[data-led-field]')].map(el => el.outerHTML),
    rooms: [...c.renderRoot.querySelectorAll('.room')].map(el => el.getAttribute('style')) };
});
const revealedPaint = await lightPaint();
check('fixtureActuallyPaintsGlow', revealedPaint.glow.length > 0);
await page.evaluate(() => window.__hpTest.setServerConfig(cfg => {
  for (const marker of cfg.markers) if ([window.__hiddenTargets.lamp, 'hidden-led'].includes(marker.id)) marker.hidden = false;
  return cfg;
})); await settle();
check('revealedLightingEqualsPermanentVisibility', JSON.stringify(await lightPaint()), JSON.stringify(revealedPaint));
await page.evaluate(() => window.__hpTest.setServerConfig(cfg => {
  for (const marker of cfg.markers) if ([window.__hiddenTargets.lamp, 'hidden-led'].includes(marker.id)) marker.hidden = true;
  return cfg;
})); await settle();

// A second live card reads the same saved wire pair, but has a distinct display preference.
const second = await page.evaluate(async () => {
  const first = window.__card, other = document.createElement('houseplan-card');
  const container = document.createElement('div'); container.style.cssText = 'width:900px;height:700px';
  document.body.appendChild(container); container.appendChild(other);
  other.setConfig({ ...first._config }); other.hass = first.hass;
  for (let i = 0; i < 100 && (!other._model?.length || other._booting); i++) await new Promise(r => setTimeout(r, 50));
  await other.updateComplete;
  const result = { off: other.renderRoot.querySelector('[data-hp="hidden-devices"]')?.getAttribute('aria-pressed') === 'false',
    missing: !other.renderRoot.querySelector(`[data-hp="device"][data-id="${window.__hiddenTargets.lamp}"]`),
    ownKey: other._hiddenDevicePreference.address !== first._hiddenDevicePreference.address };
  container.remove(); return result;
});
checkAll(Object.fromEntries(Object.entries(second).map(([k,v]) => [`otherCard_${k}`, v])));

// Reload replaces the demo's wire server; after proving the preference restore,
// seed the same saved-hidden intent again through the authoritative fixture API.
const persistedKey = (await state()).key;
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__card?._model?.length && !window.__card._booting);
await installHpTestOnPage(page);
card = page.locator('houseplan-card').first();
check('reloadRestoresSavedChoice', await card.locator('[data-hp="hidden-devices"]').getAttribute('aria-pressed'), 'true');
check('reloadUsesSameCardAddress', await page.evaluate(() => window.__card._hiddenDevicePreference.address), persistedKey);
await page.evaluate(async () => {
  const c = window.__card, lamp = c._devices.find(d => d.space === c._space && d.primary?.startsWith('light.'));
  window.__hiddenTargets = { lamp: lamp.id, space: c._space, disabled: 'none' };
  await window.__hpTest.setServerConfig(cfg => {
    cfg.markers = [...(cfg.markers || []).filter(m => m.id !== lamp.id),
      { ...lamp.marker, id: lamp.id, binding: `device:${lamp.bindingRef}`, hidden: true }];
    return cfg;
  });
});
await settle();
check('reloadStillDisplaysSavedHiddenNormally', (await state()).exists && !(await state()).ghost && (await state()).saved);
await toggle();
checkAll({ offRemovesMarker: !(await state()).exists, offKeepsHiddenFlag: (await state()).saved === true });

// Two voters deliberately stay below outlier rejection: the distant revealed
// marker MUST enter the next explicit Fit, but not move the camera on eye click.
await page.evaluate(async () => {
  await window.__hpTest.setServerConfig(cfg => ({ ...cfg,
    spaces: [{ id: 'f1', title: 'Reveal frame', rooms: [{ id: 'frame-room', name: 'Frame room',
      poly: [[.1,.1],[.9,.1],[.9,.9],[.1,.9]] }] }],
    markers: [{ id: 'hidden-far', binding: 'virtual', space: 'f1', name: 'Distant hidden', hidden: true }],
    settings: { filter_seeded: true } }));
  await window.__hpTest.setLayout({ 'hidden-far': { s: 'f1', x: 90, y: .5 } });
}); await settle();
await card.locator('[data-hp="zoom-fit"]').click(); await settle();
const frameBefore = await page.evaluate(() => ({ ...window.__card._view }));
await toggle();
check('farRevealDoesNotMoveCamera', JSON.stringify(await page.evaluate(() => ({ ...window.__card._view }))), JSON.stringify(frameBefore));
await card.locator('[data-hp="zoom-fit"]').click(); await settle();
const fitted = await page.evaluate(() => ({ ...window.__card._view }));
check('nextFitIncludesRevealedFarMarker', fitted.w > frameBefore.w * 20);
await page.evaluate(() => window.__hpTest.setMode('devices')); await settle();
const editorFrame = await page.evaluate(() => ({ ...window.__card._frameOf(window.__card._spaceModel()).rect }));
await toggle();
check('editorFrameDoesNotShrinkOnEyeOff', JSON.stringify(await page.evaluate(() => ({ ...window.__card._frameOf(window.__card._spaceModel()).rect }))), JSON.stringify(editorFrame));

// An independent static card never inherits this full-card local choice.
await page.evaluate(() => window.__hpTest.setMode('view')); await settle(); await toggle();
const staticReceipt = await page.evaluate(async () => {
  const element = document.createElement('houseplan-space-card');
  element.setConfig({ type: 'custom:houseplan-space-card', space: 'f1' });
  document.body.appendChild(element); element.hass = window.__card.hass;
  const deadline = performance.now() + 8000;
  while (performance.now() < deadline && !element.shadowRoot?.querySelector('.hp-static-stage')) await new Promise(r => setTimeout(r, 30));
  await element.updateComplete;
  const root = element.shadowRoot;
  const receipt = { mounted: !!root?.querySelector('.hp-static-stage'), noEye: !root?.querySelector('[data-hp="hidden-devices"]'),
    hiddenStillAbsent: !root?.querySelector('[data-hp="device"][data-id="hidden-far"]') };
  element.remove(); return receipt;
});
checkAll(staticReceipt);
await page.setViewportSize({ width: 390, height: 844 });
await page.addStyleTag({ content: '#host{width:100%!important;margin:0!important;padding:0!important}' });
await settle();
const mobilePair = await stored();
const mobileServices = await page.evaluate(() => window.__serviceCalls.length);
await card.locator('[data-hp="header-menu"]').tap(); await settle();
const mobileEye = card.locator('[data-hp="header-menu-item"][data-id="hidden-devices"]');
check('touchMenuAgreesWithDesktopChoice', await mobileEye.getAttribute('aria-pressed'), 'true');
await mobileEye.tap(); await settle();
check('touchEyeClosesWithoutDeviceAction', await card.locator('#hp-header-menu').count(), 0);
check('touchEyeHidesFace', await card.locator('[data-hp="device"][data-id="hidden-far"]').count(), 0);
check('touchEyeKeepsWirePair', await stored(), mobilePair);
check('touchEyeDoesNotCallHA', await page.evaluate(() => window.__serviceCalls.length), mobileServices);
await finish(browser);
} finally { await browser.close(); }
