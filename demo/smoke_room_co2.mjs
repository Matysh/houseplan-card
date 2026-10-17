// #920: real settings controls, live HA states, Flat/2.5D/kiosk and an
// independent static card. No writes to private product state.
import { mkdirSync } from 'node:fs';
import { launch, checkAll, finish } from './serve.mjs';
import { requirePinnedBrowser } from '../scripts/browser-attestation.mjs';

requirePinnedBrowser('smoke_room_co2');
const { page, browser } = await launch({ width: 1280, height: 900 });
page.setDefaultTimeout(12000);
const out = {};
const card = page.locator('houseplan-card');
const room = card.locator('[data-hp="room-label"][data-id="r1"]');
const metric = room.locator('.rlm:has(ha-icon[icon="mdi:molecule-co2"])');
const spaceDialog = card.locator('hp-dialog[data-kind="space"]');
const roomDialog = card.locator('hp-dialog[data-kind="room"]');
const save = (dialog) => dialog.locator('.dialog-action-commit [data-hp="dialog-confirm"]');
const settle = () => page.evaluate(() => window.__hpTest.settled());
const barrier = () => page.evaluate(() => window.__hpTest.waitForWrites());
const sourceState = async (id, state) => {
  await page.evaluate(({ id, state }) => {
    const c = window.__card;
    c.hass = { ...c.hass, states: { ...c.hass.states, [id]: { ...c.hass.states[id], state } } };
  }, { id, state });
  await settle();
};
const waitText = (selector, text) => page.waitForFunction(({ selector, text }) => {
  const root = window.__card.renderRoot;
  return root.querySelector(selector)?.textContent.trim() === text;
}, { selector, text });
const closeDiscard = async (dialog) => {
  await dialog.locator('.dialog-action-secondary [data-hp="dialog-cancel"], .dialog-action-cancel, button[data-hp="dialog-cancel"]').last().click();
  const confirm = card.locator('hp-dialog[data-kind="confirm"]');
  if (await confirm.count()) await confirm.locator('[data-hp="dialog-confirm"]').last().click();
  await dialog.waitFor({ state: 'detached' });
};
const openSpace = () => page.evaluate(() => window.__hpTest.openSpaceDialog('edit', 'f1').then(() => null));
const openRoom = () => page.evaluate(() => window.__hpTest.openRoomEdit('r1').then(() => null));
const pickSource = async (id) => {
  await roomDialog.locator('label:has(input[name="rsrc-co2"][value="pick"])').click();
  const candidate = roomDialog.locator('.hpf-cand').filter({ has: page.locator('small', { hasText: id }) });
  await candidate.click();
};

try {
  await page.evaluate(async () => {
    const c = window.__card;
    window.__addRegistryDevice('co2-room-device', 'Room air', 'Generic sensor', 'living_room');
    window.__addRegistryEntity('sensor.room_co2', 'living_room', '850', 'demo',
      { device_id: 'co2-room-device' }, { device_class: 'carbon_dioxide', unit_of_measurement: 'ppm' });
    // A manual override outside every HA Area must still be captured.
    window.__addRegistryEntity('sensor.manual_co2', null, '1234', 'demo', {},
      { device_class: 'carbon_dioxide', unit_of_measurement: 'ppm' });
    window.__addRegistryEntity('sensor.wrong_co2_unit', 'living_room', '99', 'demo', {},
      { device_class: 'carbon_dioxide', unit_of_measurement: '%' });
    window.__addRegistryEntity('sensor.voc_not_co2', 'living_room', '9999', 'demo', {},
      { device_class: 'volatile_organic_compounds', unit_of_measurement: 'ppm' });
    window.__addRegistryEntity('sensor.room_humidity', 'living_room', '45', 'demo', {},
      { device_class: 'humidity', unit_of_measurement: '%' });
    c.hass = window.__mkHass();
    const originalCallService = c.hass.callService;
    window.__co2Services = 0;
    c.hass = { ...c.hass, callService: (...args) => { window.__co2Services++; return originalCallService(...args); } };
    await window.__hpTest.waitForWrites();
    await window.__hpTest.setServerConfig(cfg => {
      cfg.settings = { ...cfg.settings, show_room_tooltip: true, volumetric_view: false };
      const floor = cfg.spaces.find(s => s.id === 'f1');
      floor.settings = { ...floor.settings, show_names: true, show_borders: true, label_temp: true,
        label_hum: true, label_lqi: true, label_light: true };
      delete floor.settings.label_co2;
    });
    await window.__hpTest.waitForWrites();
    window.__co2Geometry = JSON.stringify(c._serverCfg.spaces.map(s => [s.id, s.wall_segments, s.rooms.map(r => r.poly)]));
    window.__co2Layout = JSON.stringify(c._layout);
  });
  await settle();
  console.log('CO2 fixture adopted');
  out.defaultOff = await metric.count() === 0;
  await openSpace();
  console.log('CO2 space settings opened');
  const tile = spaceDialog.locator('#space-tile-labelCo2');
  out.tileDefaultOff = !await tile.isChecked();
  await tile.check();
  out.spaceDraftPreview = (await spaceDialog.locator('.cpco2').textContent()).trim() === '850 ppm';
  await spaceDialog.locator('#space-show-names').uncheck();
  out.namesOffDisablesAndRetains = await tile.isDisabled() && await tile.isChecked();
  await spaceDialog.locator('#space-show-names').check();
  await closeDiscard(spaceDialog);
  out.cancelDoesNotEnable = await metric.count() === 0;
  await openSpace();
  await tile.check();
  await save(spaceDialog).click();
  await spaceDialog.waitFor({ state: 'detached' });
  await barrier();
  await waitText('[data-hp="room-label"][data-id="r1"] .rlm:has(ha-icon[icon="mdi:molecule-co2"])', '850 ppm');
  out.automaticLiveValue = true;
  await openSpace();
  out.reopenedTile = await tile.isChecked();
  await closeDiscard(spaceDialog);

  await page.evaluate(() => window.__hpTest.setMode('plan'));
  await openRoom();
  await roomDialog.locator('label:has(input[name="rsrc-co2"][value="pick"])').click();
  const candidates = await roomDialog.locator('.hpf-cand').allTextContents();
  out.onlyCo2Candidates = candidates.some(s => s.includes('sensor.manual_co2'))
    && !candidates.some(s => s.includes('wrong_co2_unit') || s.includes('voc_not_co2'));
  await roomDialog.locator('.hpf-cand').filter({ has: page.locator('small', { hasText: 'sensor.manual_co2' }) }).click();
  out.roomDraftPreview = (await roomDialog.locator('.cpco2').textContent()).trim() === '1234 ppm';
  await closeDiscard(roomDialog);
  out.roomCancelKeepsAutomatic = (await metric.textContent()).trim() === '850 ppm';
  await openRoom();
  await pickSource('sensor.manual_co2');
  // A real WS refusal must keep the exact draft and allow retry.
  await page.evaluate(() => {
    const c = window.__card, callWS = c.hass.callWS;
    let rejectOnce = true;
    c.hass = { ...c.hass, callWS: msg => {
      if (rejectOnce && msg.type === 'houseplan/config/set') {
        rejectOnce = false;
        window.__co2Refused = true;
        return Promise.reject({ code: 'not_allowed', message: 'CO2 smoke write refusal' });
      }
      return callWS(msg);
    } };
  });
  await save(roomDialog).click();
  await page.waitForFunction(() => {
    const c = window.__card;
    return window.__co2Refused && c.renderRoot.querySelector('hp-dialog[data-kind="room"] .btn.on')?.disabled === false
      && !c._serverCfg.spaces.find(s => s.id === 'f1').rooms.find(r => r.id === 'r1').settings?.co2_source;
  });
  out.refusalKeepsDraft = (await roomDialog.locator('#room-co2-source').textContent()).includes('sensor.manual_co2')
    && (await roomDialog.locator('.cpco2').textContent()).trim() === '1234 ppm';
  await save(roomDialog).click();
  await roomDialog.waitFor({ state: 'detached' });
  await barrier();
  await waitText('[data-hp="room-label"][data-id="r1"] .rlm:has(ha-icon[icon="mdi:molecule-co2"])', '1234 ppm');
  await openRoom();
  out.reopenedSource = (await roomDialog.locator('#room-co2-source').textContent()).includes('sensor.manual_co2');
  await closeDiscard(roomDialog);
  await sourceState('sensor.manual_co2', 'unavailable');
  out.manualUnavailableNoAutomaticFallback = await metric.count() === 0;
  await sourceState('sensor.manual_co2', '0');
  out.realZero = (await metric.textContent()).trim() === '0 ppm';
  await sourceState('sensor.manual_co2', '1234');
  await page.evaluate(() => window.__hpTest.setMode('view'));
  await page.waitForFunction(() => !window.__card.renderRoot.querySelector('.stage.mode-transition'));
  await card.locator('[data-hp="room"][data-id="r1"]').hover({ position: { x: 30, y: 30 }, force: true });
  const hoverBox = await card.locator('[data-hp="room"][data-id="r1"]').boundingBox();
  await page.mouse.move(hoverBox.x + 50, hoverBox.y + 65, { steps: 3 });
  await page.waitForFunction(() => window.__card.renderRoot.querySelector('.tip')?.textContent.includes('1234 ppm'));
  out.tooltipSharesValue = true;
  await sourceState('sensor.manual_co2', '1487');
  await page.waitForFunction(() => window.__card.renderRoot.querySelector('.tip')?.textContent.includes('1487 ppm'));
  out.stationaryTooltipUpdates = (await metric.textContent()).trim() === '1487 ppm';
  await page.mouse.move(5, 5);
  await page.evaluate(async () => { await window.__hpTest.setVolumetricView(true); });
  await waitText('[data-hp="room-label"][data-id="r1"] .rlm:has(ha-icon[icon="mdi:molecule-co2"])', '1487 ppm');
  out.isometricValue = true;
  out.raisedMetricPlane = await room.getAttribute('data-hp-iso-overlay-kind') === 'room-label';
  out.fiveMetrics = await room.locator('.rlm').count() === 5;
  mkdirSync('artifacts/room-co2', { recursive: true });
  await page.screenshot({ path: 'artifacts/room-co2/iso.png' });

  // Large fonts/narrow settings: the actual content must not add horizontal scrolling.
  await page.setViewportSize({ width: 820, height: 900 });
  await openSpace();
  await spaceDialog.locator('#space-card-font').fill('300');
  await spaceDialog.locator('#space-card-font').press('Tab');
  await settle();
  out.previewNoHorizontalScroll = await spaceDialog.evaluate(d => {
    const p = d.querySelector('.cardpreview'), body = d.querySelector('.body');
    return p.scrollWidth <= p.clientWidth + 1 && body.scrollWidth <= body.clientWidth + 1;
  });
  await page.screenshot({ path: 'artifacts/room-co2/space-settings.png' });
  await closeDiscard(spaceDialog);
  await barrier();
  await page.evaluate(() => window.__hpTest.setServerConfig(cfg => {
    cfg.spaces.find(s => s.id === 'f1').settings.card_font_scale = 3;
  }));
  await sourceState('sensor.manual_co2', '12345678901234567890');
  await card.locator('[data-hp="zoom-fit"]').click();
  await page.waitForFunction(() => !window.__card._cameraTransition?.active);
  out.longFiveMetricRowFits = await room.locator('.rlmetrics').evaluate(row => {
    const a = row.getBoundingClientRect(), b = row.getRootNode().querySelector('.stage').getBoundingClientRect();
    return row.querySelectorAll('.rlm').length === 5 && a.left >= b.left - 1 && a.right <= b.right + 1
      && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
  });
  await page.screenshot({ path: 'artifacts/room-co2/iso-long-metrics.png' });
  await sourceState('sensor.manual_co2', '1487');
  await page.evaluate(() => window.__hpTest.setServerConfig(cfg => {
    cfg.spaces.find(s => s.id === 'f1').settings.card_font_scale = 1;
  }));

  // Kiosk is a separate card configured through its public API, just like HA.
  out.kioskAndStatic = await page.evaluate(async () => {
    const source = window.__card, config = structuredClone(source._serverCfg);
    const hass = { ...source.hass, callWS: async msg => {
      if (msg.type === 'houseplan/config/get') return { config, rev: 920, can_write: true };
      if (msg.type === 'houseplan/layout/get') return { layout: {}, rev: 920 };
      return source.hass.callWS(msg);
    } };
    const kiosk = document.createElement('houseplan-card');
    kiosk.setConfig({ type: 'custom:houseplan-card', space: 'f1', kiosk: true });
    kiosk.hass = hass;
    document.body.appendChild(kiosk);
    await customElements.whenDefined('houseplan-space-card');
    const fixed = document.createElement('houseplan-space-card');
    fixed.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', show_button: false });
    fixed.hass = hass;
    document.body.appendChild(fixed);
    const until = Date.now() + 10000;
    while ((!kiosk.renderRoot?.querySelector('.rlm[aria-label*="1487"]')
        || !fixed.renderRoot?.querySelector('[data-hp="room"]')) && Date.now() < until)
      await new Promise(r => setTimeout(r, 50));
    const ok = kiosk.renderRoot?.querySelector('.rlm[aria-label*="1487"]')?.textContent.trim() === '1487 ppm'
      && fixed.renderRoot?.querySelectorAll('.rlmetrics, .rlm, .cpco2').length === 0;
    kiosk.remove(); fixed.remove();
    return ok;
  });
  out.noServicesOrGeometryChanges = await page.evaluate(() => {
    const c = window.__card;
    return window.__co2Services === 0
      && JSON.stringify(c._serverCfg.spaces.map(s => [s.id, s.wall_segments, s.rooms.map(r => r.poly)])) === window.__co2Geometry
      && JSON.stringify(c._layout) === window.__co2Layout;
  });
  checkAll(out, Object.fromEntries(Object.keys(out).map(key => [key, true])));
} catch (error) {
  mkdirSync('artifacts/room-co2', { recursive: true });
  await page.screenshot({ path: 'artifacts/room-co2/failure.png' }).catch(() => {});
  console.error('CO2 checks reached', out);
  console.error('CO2 live state', await page.evaluate(() => {
    const c = window.__card;
    return { mode: c._mode, tip: c._tip, hovered: c._hoverRoom?.room?.id,
      drag: !!c._drag, deviceDrag: !!c._deviceDrag,
      tipText: c.renderRoot.querySelector('[data-hp-live-tip]')?.textContent };
  }));
  throw error;
} finally {
  await finish(browser, out);
}
