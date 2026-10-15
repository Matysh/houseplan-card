// #849: genuine long-press/row/modal and Tab/Enter/Space entries. No private writes.
// HA transport/state and the public animation API are recorded, not action methods.
import { launchColdView, check, finish, requirePinnedBrowser } from './serve.mjs';

requirePinnedBrowser('849 exact information-card action and lock information');
const { page, browser } = await launchColdView({ width: 1000, height: 850 });
const out = {};
const settle = () => page.evaluate(() => window.__hpTest.settled());
await page.evaluate(async () => {
  const c = window.__card, hass = c.hass;
  window.__849Calls = []; window.__849Press = [];
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (...args) {
    if (this.matches('.device-shell')) window.__849Press.push({ frames: args[0], options: args[1] });
    return animate.apply(this, args);
  };
  c.hass = { ...hass,
    callService: (...args) => { window.__849Calls.push(structuredClone(args)); return Promise.resolve(); },
    entities: { ...hass.entities,
      'switch.row_two': { entity_id: 'switch.row_two', device_id: 'd_light1', platform: 'demo', disabled_by: null },
      'lock.front_door': { entity_id: 'lock.front_door', platform: 'demo', disabled_by: null },
      'alarm_control_panel.home': { entity_id: 'alarm_control_panel.home', platform: 'demo', disabled_by: null },
    },
    states: { ...hass.states,
      'switch.row_two': { entity_id: 'switch.row_two', state: 'off', attributes: { friendly_name: 'Row two' } },
      'lock.front_door': { entity_id: 'lock.front_door', state: 'locked', attributes: { friendly_name: 'Front door' } },
      'alarm_control_panel.home': { entity_id: 'alarm_control_panel.home', state: 'armed_away', attributes: {} },
    },
  };
  await window.__hpTest.settled();
});

async function configure(action = 'toggle', confirm = true) {
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.evaluate(async ({ action, confirm }) => {
    await window.__hpTest.setServerConfig(cfg => {
      cfg.markers = (cfg.markers || []).filter(marker => marker.id !== 'd_light1');
      cfg.markers.push({ id: 'd_light1', binding: 'device:d_light1', tap_action: action,
        tap_confirm: confirm, controls: ['light.floor_lamp'], space: 'f1' });
      return cfg;
    });
    window.__849Calls.length = 0; window.__849Press.length = 0;
  }, { action, confirm });
}
async function openInfo() {
  const target = page.locator('[data-hp="device"][data-id="d_light1"]');
  await target.hover(); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  await page.locator('hp-dialog[data-kind="info"]').waitFor();
}
const row = () => page.locator('hp-dialog[data-kind="info"] .entrow').filter({ hasText: 'Row two' }).locator('button');
const confirm = () => page.locator('hp-dialog[data-kind="confirm"] [data-hp="dialog-confirm"]');
const cancel = () => page.locator('hp-dialog[data-kind="confirm"] .row [data-hp="dialog-cancel"]');
const snapshot = () => page.evaluate(() => ({
  calls: structuredClone(window.__849Calls), press: structuredClone(window.__849Press),
  modal: !!window.__card.renderRoot.querySelector('hp-dialog[data-kind="confirm"]'),
  title: window.__card.renderRoot.querySelector('hp-dialog[data-kind="confirm"]')?.shadowRoot?.querySelector('.title-text')?.textContent || '',
  text: window.__card.renderRoot.querySelector('hp-dialog[data-kind="confirm"]')?.textContent || '',
}));

await configure(); await openInfo(); await row().click();
out.open = await snapshot();
check('rowWithEnabledVisibleConfirmAsks', out.open.modal && out.open.calls.length === 0);
check('openingConfirmHasNoSuccessfulFeedback', out.open.press.length, 0);
check('confirmationNamesExactSecondaryRow', out.open.title.includes('Row two'));
check('confirmationDescribesCurrentAndExpected', /off/i.test(out.open.text) && /on/i.test(out.open.text));
// Retain the actual DOM listener carrier, then dismiss it. A late native event
// must not call a cleared/null or subsequently replaced confirmation.
await page.evaluate(() => {
  window.__849Retired = window.__card.renderRoot.querySelector('hp-dialog[data-kind="confirm"] [data-hp="dialog-confirm"]');
});
await cancel().click();
await page.evaluate(() => window.__849Retired.click()); await settle();
out.cancel = await snapshot();
check('cancelAndLateRetainedClickHaveNoCall', out.cancel.calls.length, 0);
check('cancelHasNoSuccessfulFeedback', out.cancel.press.length, 0);

// The secondary entity is not the marker's primary or controls target.
await row().focus(); await page.keyboard.press('Enter'); await confirm().waitFor();
await page.evaluate(() => window.__849Retired.click());
check('retiredConfirmationCannotAcceptReplacement', (await snapshot()).modal
  && (await snapshot()).calls.length === 0);
await page.evaluate(() => {
  const c = window.__card;
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'switch.row_two': { ...c.hass.states['switch.row_two'], state: 'on' } } };
});
await settle();
await page.evaluate(() => {
  const button = window.__card.renderRoot.querySelector('hp-dialog[data-kind="confirm"] [data-hp="dialog-confirm"]');
  button.click(); button.click();
});
await settle(); out.accept = await snapshot();
check('doubleAcceptCallsOnce', out.accept.calls.length, 1);
check('stateReResolvedToExactRowNotControls', out.accept.calls[0],
  ['switch', 'turn_off', { entity_id: 'switch.row_two' }]);
check('dispatchOnlyFeedbackIs95Percent200ms', out.accept.press.length === 1
  && out.accept.press[0].options.duration === 200
  && out.accept.press[0].frames.some(frame => frame.scale === '0.95'));

// Availability changes do not turn a retained confirm into a bypass.
await row().click(); await confirm().waitFor();
await page.evaluate(() => {
  const c = window.__card;
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'switch.row_two': { ...c.hass.states['switch.row_two'], state: 'unavailable' } } };
});
await settle(); await confirm().click(); out.unavailable = await snapshot();
check('unavailableAtAcceptDoesNotDispatch', out.unavailable.calls.length, 1);
check('unavailableAtAcceptHasNoFeedback', out.unavailable.press.length, 1);
await page.evaluate(() => {
  const c = window.__card;
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'switch.row_two': { ...c.hass.states['switch.row_two'], state: 'off' } } };
});
await settle();

// Same marker id, changed configured membership: never inherit a stale card action.
await row().click(); await confirm().waitFor();
await page.evaluate(() => window.__hpTest.setServerConfig(cfg => {
  cfg.markers.find(marker => marker.id === 'd_light1').controls = ['light.ceiling']; return cfg;
}));
await confirm().click(); out.changed = await snapshot();
check('changedCardSetDoesNotDispatch', out.changed.calls.length, 1);
check('changedCardSetHasNoFeedback', out.changed.press.length, 1);

await row().click(); await confirm().waitFor();
await page.evaluate(() => {
  const c = window.__card;
  c.hass = { ...c.hass, entities: { ...c.hass.entities,
    'switch.row_two': { ...c.hass.entities['switch.row_two'], device_id: 'd_lamp' } } };
});
await settle(); await confirm().click();
check('rowReboundToAnotherDeviceDoesNotDispatch', (await snapshot()).calls.length, 1);
await page.evaluate(() => {
  const c = window.__card;
  c.hass = { ...c.hass, entities: { ...c.hass.entities,
    'switch.row_two': { ...c.hass.entities['switch.row_two'], device_id: 'd_light1' } } };
});
await settle();

for (const action of ['info', 'more-info', 'none']) {
  await configure(action, true); await openInfo(); await row().click();
  const result = await snapshot(); out[`hidden_${action}`] = result;
  check(`hiddenSavedConfirmIsIgnored_${action}`, !result.modal && result.calls.length === 1);
  check(`hiddenConfirmKeepsExactRow_${action}`, result.calls[0]?.[2], { entity_id: 'switch.row_two' });
}
for (const action of ['toggle', 'run']) {
  await configure(action, false); await openInfo(); await row().click();
  const result = await snapshot(); out[`disabled_${action}`] = result;
  check(`visibleDisabledConfirmActsDirectly_${action}`, !result.modal && result.calls.length === 1);
}
await configure('run', true); await openInfo(); await row().click();
out.run = await snapshot(); check('runMarkerAlsoGuardsEveryToggleRow', out.run.modal && out.run.calls.length === 0);
await cancel().click();

// Read-only kiosk retains safe View controls. No writer/editor permission is needed.
await page.keyboard.press('Escape');
await page.evaluate(async () => {
  const c = window.__card, hass = c.hass;
  c.hass = { ...hass, user: { ...hass.user, is_admin: false }, callWS: async message => {
    const result = await hass.callWS(message);
    return message.type === 'houseplan/config/get' ? { ...result, can_write: false } : result;
  } };
  c.setConfig({ ...c._config, kiosk: true });
  await window.__hpTest.setServerConfig(cfg => cfg);
  await window.__hpTest.settled();
});
check('readonlyKioskFixtureActuallyApplied', await page.evaluate(() =>
  window.__card._kiosk && !window.__card._canEdit));
await openInfo(); await row().click(); await confirm().click();
out.kiosk = await snapshot(); check('readonlyKioskStillPermitsConfirmedExactRow', out.kiosk.calls.length, 1);
await page.keyboard.press('Escape');

// Actual canonical door + badge: mouse, real Tab focus, Enter and Space only open info.
await page.evaluate(async () => {
  const c = window.__card; c.setConfig({ ...c._config, kiosk: false });
  await window.__hpTest.setServerConfig(cfg => {
    cfg.spaces.find(space => space.id === 'f1').openings = [
      { id: 'front', type: 'door', rx: 500, ry: 500, len_cm: 90, lock: 'lock.front_door' },
    ]; return cfg;
  });
  window.__849Calls.length = 0; window.__849Press.length = 0;
});
const badge = page.locator('.oplock');
out.badge = await badge.evaluate(node => {
  const rect = node.getBoundingClientRect();
  return { role: node.getAttribute('role'), label: node.getAttribute('aria-label'), width: rect.width, height: rect.height };
});
check('badgeHasInformationButtonName', out.badge.role === 'button' && /door.*lock/i.test(out.badge.label));
check('flatBadgeHitBoxNotEnlarged', out.badge.width > 0 && out.badge.width < 22 && out.badge.height < 22);
await badge.click(); await page.locator('hp-dialog[data-kind="opening"]').waitFor();
check('pointerBadgeOpensInfoWithoutService', (await snapshot()).calls.length, 0);
await page.keyboard.press('Escape');
let focused = false;
for (let i = 0; i < 80; i++) {
  await page.keyboard.press('Tab');
  focused = await badge.evaluate(node => node.matches(':focus-visible'));
  if (focused) break;
}
check('realTabReachesBadgeWithVisibleFocus', focused);
out.focus = await badge.evaluate(node => ({ width: getComputedStyle(node).outlineWidth, style: getComputedStyle(node).outlineStyle }));
check('focusRingActuallyPaints', Number.parseFloat(out.focus.width) > 0 && out.focus.style !== 'none');
await page.keyboard.press('Enter'); await page.locator('hp-dialog[data-kind="opening"]').waitFor();
check('enterOpensOnlyInformation', (await snapshot()).calls.length, 0);
await page.keyboard.press('Escape'); await badge.focus(); await page.keyboard.press('Space');
await page.locator('hp-dialog[data-kind="opening"]').waitFor();
check('spaceOpensOnlyInformation', (await snapshot()).calls.length, 0);
// The explicitly labelled unlock action retains its own danger confirmation.
await page.locator('hp-dialog[data-kind="opening"] button').filter({ hasText: 'Unlock' }).click();
await page.locator('hp-confirm').waitFor();
check('unlockStillRequiresSeparateConfirmation', (await snapshot()).calls.length, 0);
await page.keyboard.press('Escape');
check('cancelUnlockStillNoService', (await snapshot()).calls.length, 0);
check('informationAndUnlockCancelNeverPressMarker', (await snapshot()).press.length, 0);

// A real coarse-pointer sequence, not a mouse event named "touch".
const mobile = await launchColdView({ width: 390, height: 760 }, 1, [], { hasTouch: true });
await mobile.page.evaluate(async () => {
  const c = window.__card;
  window.__849TouchCalls = [];
  c.hass = { ...c.hass, callService: (...args) => {
    window.__849TouchCalls.push(structuredClone(args)); return Promise.resolve();
  } };
  await window.__hpTest.setServerConfig(cfg => {
    cfg.markers = (cfg.markers || []).filter(marker => marker.id !== 'd_light1');
    cfg.markers.push({ id: 'd_light1', binding: 'device:d_light1', tap_action: 'info',
      tap_confirm: true, space: 'f1' }); return cfg;
  });
});
const touchMarker = mobile.page.locator('[data-hp="device"][data-id="d_light1"]');
await touchMarker.tap();
await mobile.page.locator('hp-dialog[data-kind="info"]').waitFor();
// A normal remote save changes the setting while the information surface is open.
await mobile.page.evaluate(() => window.__hpTest.setServerConfig(cfg => {
  cfg.markers.find(marker => marker.id === 'd_light1').tap_action = 'toggle'; return cfg;
}));
const touchRow = mobile.page.locator('hp-dialog[data-kind="info"] .entrow').filter({ hasText: 'Ceiling light' }).locator('button');
await touchRow.tap(); await mobile.page.locator('hp-dialog[data-kind="confirm"]').waitFor();
check('touchRowWaitsForConfirmation', await mobile.page.evaluate(() => window.__849TouchCalls.length), 0);
await mobile.page.locator('hp-dialog[data-kind="confirm"] .row [data-hp="dialog-cancel"]').tap();
check('touchCancelHasNoService', await mobile.page.evaluate(() => window.__849TouchCalls.length), 0);
await touchRow.tap();
await mobile.page.locator('hp-dialog[data-kind="confirm"] [data-hp="dialog-confirm"]').tap();
check('touchAcceptDispatchesExactRowOnce', await mobile.page.evaluate(() => window.__849TouchCalls),
  [['light', 'turn_off', { entity_id: 'light.ceiling' }]]);
await mobile.browser.close();

await finish(browser, out);
