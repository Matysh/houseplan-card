// #972: real user input into the info card, accepted HA updates and read-only source navigation.
import { launchColdView, check, finish, requirePinnedBrowser } from './serve.mjs';
import { makeDeviceIssuesFixture, maintenanceSource } from './fixtures/device-issues.mjs';
requirePinnedBrowser('device issue warning and explanation');
const { page, browser } = await launchColdView({ width: 1000, height: 850 }, 1, [], { hasTouch: true });
const out = {};
try {
  await page.evaluate(async fixture => {
    const card = window.__card;
    for (const [eid, row] of Object.entries(fixture.entities)) {
      window.__addRegistryEntity(eid, null, fixture.states[eid].state);
      Object.assign(card.hass.entities[eid], row, { device_id: 'd_kettle' });
    }
    for (const [eid, value, attributes] of [
      ['sensor.appliance_battery', '80', { device_class: 'battery', unit_of_measurement: '%' }],
      ['sensor.appliance_linkquality', '200', { unit_of_measurement: 'lqi' }],
    ]) {
      window.__addRegistryEntity(eid, null, value);
      Object.assign(card.hass.entities[eid], { device_id: 'd_kettle', entity_category: 'diagnostic' });
      fixture.states[eid] = { entity_id: eid, state: value, attributes };
    }
    window.__setRegistryArea('entity', 'switch.appliance_power', null);
    window.__972Calls = []; window.__972MoreInfo = [];
    card.addEventListener('hass-more-info', e => window.__972MoreInfo.push(e.detail.entityId));
    card.hass = { ...card.hass, states: { ...card.hass.states, ...fixture.states,
      'switch.kettle': { ...card.hass.states['switch.kettle'], state: 'off' } },
      callService: (...args) => { window.__972Calls.push(args); return Promise.resolve(); } };
    card.setConfig({ type: 'custom:houseplan-card', language: 'ru', icon_size: 5, show_signal: true });
    await window.__hpTest.setServerConfig(cfg => ({ ...cfg, markers: [
      ...Object.keys(card.hass.devices).filter(id => id !== 'd_kettle').map(id => ({ id, binding: `device:${id}`, hidden: true })),
      { id: 'd_kettle', binding: 'device:d_kettle', space: 'f1', name: 'Dishwasher', display: 'icon_ripple', tap_action: 'info' },
    ] }));
  }, makeDeviceIssuesFixture());
  const marker = page.locator('[data-hp="device"][data-id="d_kettle"]');
  const info = page.locator('hp-dialog[data-kind="info"]');
  const patch = async change => page.evaluate(change => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
    markers: cfg.markers.map(m => m.id === 'd_kettle' ? { ...m, ...change } : m),
  })), change);
  const state = async (eid, value) => page.evaluate(async ({ eid, value }) => {
    const card = window.__card;
    card.hass = { ...card.hass, states: { ...card.hass.states, [eid]: { ...card.hass.states[eid], state: value } } };
    await window.__hpTest.settled();
  }, { eid, value });
  await marker.locator('.device-maintenance').waitFor();
  check('off appliance has passive warning and no alarm pulse', await marker.evaluate(node =>
    !node.classList.contains('alarm') && !node.querySelector('.device-pulse')
    && getComputedStyle(node.querySelector('.device-maintenance')).pointerEvents === 'none'));
  for (const position of ['left', 'right', 'top', 'bottom']) {
    await patch({ value_badge: { enabled: true, source: { kind: 'entity_state', entity_id: 'sensor.appliance_start_count' }, position } });
    check(`warning avoids battery value and LQI at ${position}`, await marker.evaluate(node => {
      const warning = node.querySelector('.device-maintenance').getBoundingClientRect();
      const rects = ['.device-battery', '.value-badge', '.lqi'].map(selector => node.querySelector(selector)?.getBoundingClientRect()).filter(Boolean);
      const hit = document.elementFromPoint(warning.x + warning.width / 2, warning.y + warning.height / 2);
      return rects.length >= 2 && rects.every(r => warning.right <= r.left || warning.left >= r.right
        || warning.bottom <= r.top || warning.top >= r.bottom)
        && !hit?.closest?.('[data-hp="device"]');
    }));
  }
  await patch({ value_badge: { enabled: false } });
  await marker.click();
  await info.locator('.device-issue').waitFor();
  check('service reason visible at top of info', (await info.locator('.device-issues h3').innerText()).trim(), 'Требуется обслуживание');
  check('exact diagnostic sibling has its explanation', await info.locator('.device-issue').getAttribute('data-source'), maintenanceSource);
  await info.locator('summary').focus(); await page.keyboard.press('Enter');
  await info.locator('.device-issue button').focus(); await page.keyboard.press('Enter');
  check('keyboard opens exact cause in HA', await page.evaluate(() => window.__972MoreInfo), [maintenanceSource]);
  await state('binary_sensor.appliance_aquastop_occurred', 'on');
  await info.locator('.device-issues.alarm').waitFor();
  check('alarm and service both remain visible', await info.locator('.device-issue').count(), 2);
  check('true fault keeps alarm priority', await marker.evaluate(node => node.classList.contains('alarm') && !!node.querySelector('.device-pulse.alarm') && !node.querySelector('.device-maintenance')));
  await state('binary_sensor.appliance_aquastop_occurred', 'off');
  await marker.locator('.device-maintenance').waitFor();
  await state(maintenanceSource, 'off');
  check('last cleared issue removes all explanations', await info.locator('.device-issue').count(), 0);
  await state('binary_sensor.appliance_aquastop_occurred', 'on');
  await info.locator('.device-issues.alarm').waitFor();
  check('a new alarm appears in the still-open card after all causes cleared',
    await info.locator('.device-issue').getAttribute('data-source'), 'binary_sensor.appliance_aquastop_occurred');
  await state('binary_sensor.appliance_aquastop_occurred', 'off');
  await state(maintenanceSource, 'on');
  await info.locator('.device-issue').waitFor();
  await page.keyboard.press('Escape');
  for (const display of ['static_icon', 'value_static_icon']) {
    await patch({ display }); await marker.click(); await info.locator('.device-issue').waitFor();
    check(`${display} explains service without painting a warning`, await marker.locator('.device-maintenance').count(), 0);
    await page.keyboard.press('Escape');
  }
  await patch({ display: 'icon_ripple' });
  for (const [language, title] of [['en', 'Maintenance required'], ['de', 'Wartung erforderlich'],
    ['fr', 'Entretien nécessaire'], ['ru', 'Требуется обслуживание']]) {
    await page.evaluate(language => window.__card.setConfig({ type: 'custom:houseplan-card', language }), language);
    await marker.click(); await info.getByRole('heading', { name: title, exact: true }).waitFor();
    check(`${language} translates service reason`, !(await info.locator('.device-issue').innerText()).includes('device.issues.'));
    await page.keyboard.press('Escape');
  }
  await marker.click(); await info.getByRole('button', { name: 'Редактировать', exact: true }).click();
  await page.locator('[data-section-target="appearance"]').click();
  const preview = page.locator('hp-device-preview');
  await preview.locator('.device-issue').waitFor();
  check('settings preview shares the exact actual issue', await preview.locator('.device-issue').getAttribute('data-source'), maintenanceSource);
  check('preview camera contains the warning frame', await preview.evaluate(node => {
    const warning = node.shadowRoot.querySelector('.device-maintenance').getBoundingClientRect();
    const stage = node.shadowRoot.querySelector('.previewstage').getBoundingClientRect();
    return warning.width > 0 && warning.left >= stage.left && warning.right <= stage.right
      && warning.top >= stage.top && warning.bottom <= stage.bottom;
  }));
  await preview.locator('.previewdemo').first().click();
  check('demo pulse adds no invented issue', await preview.locator('.device-issue').count(), 1);
  await page.keyboard.press('Escape');
  // Normal user and kiosk both retain the same read-only explanation, touch needs no hover.
  await page.evaluate(async () => {
    const card = window.__card, original = card.hass;
    card.hass = { ...original, user: { ...original.user, id: '972-reader', is_admin: false },
      callWS: async message => {
        const response = await original.callWS(message);
        return message.type === 'houseplan/config/get' ? { ...response, can_write: false } : response;
      } };
    card.setConfig({ type: 'custom:houseplan-card', language: 'en', kiosk: true, cycle: 0 });
    await window.__hpTest.settled();
  });
  await marker.tap(); await info.locator('.device-issue').waitFor();
  check('ordinary kiosk user sees service reason on touch', (await info.locator('.device-issues h3').innerText()).trim(), 'Maintenance required');
  await info.locator('summary').tap(); await info.locator('.device-issue button').tap();
  check('touch opens exact source without a service call', await page.evaluate(() => ({
    calls: window.__972Calls, eid: window.__972MoreInfo.at(-1),
  })), { calls: [], eid: maintenanceSource });
  await page.setViewportSize({ width: 390, height: 844 });
  check('narrow touch card wraps long technical source without overflow', await info.evaluate(node => {
    const cause = node.querySelector('.device-issues');
    return cause.scrollWidth <= cause.clientWidth + 1;
  }));
  out.acceptedTransitions = 'maintenance → alarm+maintenance → maintenance → none → new alarm → maintenance';
} finally { await finish(browser, out); }
