// #1050: real View input and the existing content-hashed editor loader.
// Public HA/config/layout inputs only; private card fields are observations.
import { readFileSync, writeFileSync } from 'node:fs';
import { launchColdView, check, finish, requirePinnedBrowser } from './serve.mjs';
import { installBatteryFixture, patchBatteryMarker } from './helpers/device-battery-fixture.mjs';

requirePinnedBrowser('smoke_device_settings_action');
const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json', 'utf8'));
const runtime = manifest.files.map(file => file.path)
  .find(path => /houseplan-editor-runtime-[^/]+\.js$/.test(path));
if (!runtime) throw new Error('editor runtime absent from actual manifest');
const runtimeName = runtime.split('/').at(-1), runtimePattern = `**/${runtimeName}*`;
const DENIED = 'Device settings require House Plan edit permission and are unavailable in kiosk mode.';
const DENIED_RU = 'Настройки устройства доступны пользователю с правом редактирования вне режима киоска.';
const out = { material: { source: process.env.HP_NATIVE_SOURCE_SHA || null, fingerprint: manifest.fingerprint } };
const marker = (page, id = 'd_temp') => page.locator(`[data-hp="device"][data-id="${id}"]`);
const dialog = page => page.locator('hp-dialog[data-kind="marker"]');
const settled = page => page.evaluate(() => window.__hpTest.settled());
const ready = page => page.waitForFunction(() => window.__card._loadOk
  && !window.__card._modeTransitionBusy && !window.__card._modeTransitionPreparing);

async function open({ touch = false } = {}) {
  const session = await launchColdView({ width: 1200, height: 900 }, 1, [], { hasTouch: touch });
  const { page } = session;
  session.requests = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.endsWith(`/${runtimeName}`)) session.requests.push(request.url());
  });
  await installBatteryFixture(page);
  await page.evaluate(async () => {
    await window.__hpTest.setServerConfig(cfg => ({ ...cfg, markers: cfg.markers.map(row =>
      ['d_temp', 'd_light1'].includes(row.id) ? { ...row, tap_action: 'settings', tap_confirm: true } : row) }));
    const card = window.__card, ws = card.hass.callWS, service = card.hass.callService;
    const state = window.__settingsAction = { writer: true, writes: [], services: [], moreInfo: [], events: [], originalEvents: [] };
    document.addEventListener('hass-more-info', event => state.moreInfo.push(event.detail));
    for (const type of ['click', 'keydown', 'contextmenu', 'pointerup']) card.renderRoot.addEventListener(type, event => {
      if (!event.composedPath().some(node => node instanceof Element && node.matches('[data-hp="device"]'))) return;
      const receipt = { type, trusted: event.isTrusted, key: event.key, pointerType: event.pointerType };
      state.events.push(receipt); state.originalEvents.push(event);
    }, true);
    // Observe the real wire boundary, and deliver can_write as a server reply.
    card.hass = { ...card.hass, callWS: async message => {
      if (/\/(set|update|delete|copy|toggle)$/.test(message.type)) state.writes.push(structuredClone(message));
      const reply = await ws(message);
      return message.type === 'houseplan/config/get' ? { ...reply, can_write: state.writer } : reply;
    }, callService: async (...args) => { state.services.push(args); return service(...args); } };
    window.__settingsBase = { config: structuredClone(card._serverCfg), layout: structuredClone(card._layout),
      options: structuredClone(card._config), hass: card.hass, host: card.parentNode, path: location.pathname };
  });
  await ready(page);
  check('fixture:spaceAndRebindingTargetExist', await page.evaluate(() => window.__card._serverCfg.spaces
    .some(space => space.id === 'garden') && !!window.__card.hass.entities['sensor.living_temp']
    && !!window.__card.hass.states['sensor.living_temp']));
  check('fixture:coldViewHasNoEditor', await page.evaluate(() => !window.__card._editorRuntime));
  check('fixture:noEditorResourceBeforeIntent', await page.evaluate(name => !performance.getEntriesByType('resource')
    .some(entry => new URL(entry.name).pathname.endsWith(`/${name}`)), runtimeName));
  return session;
}

async function input(page, kind, id = 'd_temp') {
  const target = marker(page, id);
  if (kind === 'Enter' || kind === 'Space') {
    await target.focus(); await page.keyboard.press(kind);
  } else if (kind === 'touch') await target.locator('.device-core').tap();
  else await target.locator('.device-core').click(kind === 'right' ? { button: 'right' } : {});
  await settled(page);
}
async function receipt(page) {
  return page.evaluate(() => {
    const card = window.__card, state = window.__settingsAction;
    return { target: card._markerDialog?.devId ?? null, visible: !!card.renderRoot.querySelector('hp-dialog[data-kind="marker"]:not([inert])'),
      mode: card._mode, other: !!(card._infoCard || card._tapConfirm), feedback: card._devicePressAnimations.size,
      writes: state.writes.length, services: state.services.length, moreInfo: state.moreInfo.length,
      writeMessages: structuredClone(state.writes), events: state.events.map((event, index) => ({
        ...event, prevented: state.originalEvents[index].defaultPrevented })),
      toast: window.__hpTest.toast()?.textContent?.trim() || '' };
  });
}
async function current(page, name, id = 'd_temp', writes = 0) {
  await page.waitForFunction(id => window.__card._markerDialog?.devId === id
    && !!window.__card.renderRoot.querySelector('hp-dialog[data-kind="marker"]:not([inert])'), id);
  const state = await receipt(page);
  out[name] = state;
  check(`${name}:exactTargetAndOnlySettings`, state.target === id && state.visible && state.mode === 'view' && !state.other);
  check(`${name}:noServiceWriteMoreInfoOrPressFeedback`, state.writes === writes && state.services + state.moreInfo + state.feedback === 0);
}
async function close(page) {
  await page.keyboard.press('Escape'); await settled(page);
  await dialog(page).waitFor({ state: 'detached' });
}
async function writer(page, value) {
  await page.evaluate(async value => {
    window.__settingsAction.writer = value;
    await window.__hpTest.setServerConfig(cfg => cfg);
  }, value);
  await page.waitForFunction(value => window.__card._canEdit === value, value);
}

try {
// Ordinary native entries, first cold and then warm, in both actual projections.
{
  const session = await open(), { page, browser } = session;
  try {
    for (const iso of [false, true]) {
      await page.evaluate(iso => window.__hpTest.setVolumetricView(iso), iso);
      for (const kind of ['tap', 'Enter', 'Space']) {
        await input(page, kind); await current(page, `${iso ? 'iso' : 'flat'}/${kind}`);
        check('form:settingsPersistedSelectorIsOffered', await dialog(page).locator('#marker-tap-action option[value="settings"]').count(), 1);
        await close(page);
      }
      await patchBatteryMarker(page, { tap_action: 'none' });
      await input(page, 'tap');
      check('none:shortTapRemainsNoOp', !(await receipt(page)).visible && !(await receipt(page)).other);
      await input(page, 'right'); await current(page, `${iso ? 'iso' : 'flat'}/rightSavedNone`); await close(page);
      await patchBatteryMarker(page, { tap_action: 'settings' });
    }
    const events = (await receipt(page)).events;
    check('native:trustedMouseClick', events.some(event => event.type === 'click' && event.trusted));
    for (const key of ['Enter', ' ']) check(`native:trustedKey/${key}`, events.some(event => event.type === 'keydown' && event.key === key && event.trusted));
    check('native:trustedConsumedContextMenu', events.some(event => event.type === 'contextmenu' && event.trusted && event.prevented));
    check('loader:oneRuntimeForColdAndWarmEntries', session.requests.length, 1);
    // AC1: edit the real selector, Save through its existing writer, close and
    // reopen. A fixture-provided settings value alone is not persistence proof.
    await patchBatteryMarker(page, { tap_action: 'info' });
    await input(page, 'right');
    await dialog(page).locator('[data-section-target="actions"]').click();
    await dialog(page).locator('hp-settings-select:has(#marker-tap-action) button').click();
    await dialog(page).getByRole('option', { name: 'Device settings', exact: true }).click();
    await dialog(page).locator('[data-hp="dialog-confirm"]').click();
    await dialog(page).waitFor({ state: 'detached' });
    await page.evaluate(() => window.__hpTest.waitForWrites());
    const saved = await page.evaluate(async () => {
      const card = window.__card, reply = await card.hass.callWS({ type: 'houseplan/config/get' });
      return { marker: reply.config.markers.find(row => row.id === 'd_temp'),
        writes: structuredClone(window.__settingsAction.writes) };
    });
    check('selector:SavePersistsSettingsWithoutTouchingConfirmation', saved.marker.tap_action === 'settings' && saved.marker.tap_confirm === true);
    check('selector:oneExistingConfigWriter', saved.writes.length === 1 && saved.writes[0].type === 'houseplan/config/set');
    await input(page, 'tap');
    await dialog(page).waitFor({ state: 'visible' });
    check('selector:reopenTargetsSameDeviceAndSavedValue', await page.evaluate(() => window.__card._markerDialog?.devId === 'd_temp')
      && await dialog(page).locator('#marker-tap-action').inputValue() === 'settings');
    check('selector:SaveAndReopenNeverCallHAServiceOrMoreInfo', await page.evaluate(() => window.__settingsAction.services.length
      + window.__settingsAction.moreInfo.length), 0);
    await close(page);
    await page.evaluate(async () => {
      const card = window.__card;
      card.hass = { ...card.hass, user: { ...card.hass.user, is_admin: false } };
      await window.__hpTest.settled();
    });
    await ready(page); await input(page, 'tap'); await current(page, 'writer:nonAdminStillAllowed', 'd_temp', 1); await close(page);
  } finally { await browser.close(); }
}
{
  const session = await open({ touch: true }), { page, browser } = session;
  try {
    for (const iso of [false, true]) {
      await page.evaluate(iso => window.__hpTest.setVolumetricView(iso), iso);
      await input(page, 'touch'); await current(page, `touch/${iso ? 'iso' : 'flat'}`); await close(page);
    }
    check('native:trustedTouch', (await receipt(page)).events.some(event => event.type === 'pointerup' && event.pointerType === 'touch' && event.trusted));
  } finally { await browser.close(); }
}

// Owner variant 2: BOTH entries deny before lazy work, even for an HA admin.
for (const denial of ['no-write', 'kiosk', 'unloaded']) {
  const session = await open(), { page, browser } = session;
  try {
    if (denial === 'no-write') await writer(page, false);
    if (denial === 'kiosk') await page.evaluate(async () => {
      window.__card.setConfig({ ...window.__settingsBase.options, kiosk: true, cycle: 0 });
      await window.__hpTest.settled();
    });
    if (denial === 'unloaded') {
      await page.evaluate(() => {
        const card = window.__card, original = card.hass;
        const gate = new Promise(resolve => { window.__settingsReleaseLoad = resolve; });
        card.hass = { ...original, connection: { ...original.connection }, callWS: async message => {
          if (message.type === 'houseplan/config/get') await gate;
          return original.callWS(message);
        } };
      });
      await page.waitForFunction(() => !window.__card._loadOk);
    }
    // A foreign unloaded context quarantines the old markers completely. There
    // is no native target to click; do not fabricate a detached/private action.
    if (denial === 'unloaded') {
      check('denied/unloaded:oldNativeTargetIsQuarantined', await marker(page).count(), 0);
      const state = await receipt(page); out['denied/unloaded'] = state;
      check('denied/unloaded:noSettingsOrOtherAction', !state.visible && !state.other
        && state.writes + state.services + state.moreInfo + state.feedback === 0);
    } else for (const language of ['en', 'ru']) {
      await page.evaluate(async ({ language, denial }) => {
        window.__card.setConfig({ ...window.__settingsBase.options, language, kiosk: denial === 'kiosk', cycle: 0 });
        await window.__hpTest.settled();
      }, { language, denial });
      for (const kind of ['tap', 'right']) {
        await input(page, kind);
        const text = language === 'ru' ? DENIED_RU : DENIED;
        await page.waitForFunction(text => window.__hpTest.toast()?.textContent?.trim() === text, text);
        const state = await receipt(page); out[`denied/${denial}/${language}/${kind}`] = state;
        check(`denied/${denial}/${language}/${kind}:exactToastNoOtherAction`, state.toast === text && !state.visible && !state.other
          && state.writes + state.services + state.moreInfo + state.feedback === 0);
      }
    }
    check(`denied/${denial}:noLazyRequestOrRuntime`, session.requests.length === 0
      && await page.evaluate(() => !window.__card._editorRuntime));
    check(`denied/${denial}:adminDoesNotOverrideHousePlanPermission`, await page.evaluate(() => window.__card.hass.user.is_admin));
  } finally { await page.evaluate(() => window.__settingsReleaseLoad?.()); await browser.close(); }
}

// Ordinary no-intent control: rebinding advances existing Area provenance. Its
// exact wire document is the independent baseline, not an allowed extra write
// by a retired settings request.
let rebindControl;
{
  const session = await open(), { page, browser } = session;
  try {
    await patchBatteryMarker(page, { binding: 'entity:sensor.living_temp' });
    await page.evaluate(() => window.__hpTest.waitForWrites());
    rebindControl = await receipt(page); out.rebindWithoutSettingsIntent = rebindControl;
    check('rebindControl:onlyExistingAreaProvenanceWrite', rebindControl.writes === 1
      && rebindControl.writeMessages[0].type === 'houseplan/config/set'
      && rebindControl.writeMessages[0].config.settings.marker_area_snapshot.d_temp.binding === 'entity:sensor.living_temp'
      && rebindControl.writeMessages[0].config.markers.find(row => row.id === 'd_temp').binding === 'entity:sensor.living_temp');
    check('rebindControl:noEditorIntentOrOtherAction', !rebindControl.visible && !rebindControl.other
      && rebindControl.services + rebindControl.moreInfo + session.requests.length === 0);
  } finally { await browser.close(); }
}

// Each case starts with the actual cold import held, including hashed retry
// URLs. Inputs retire owners; no product method or state is replaced.
const retirementCases = ['connection', 'user', 'ABA', 'route', 'mode', 'space', 'hidden',
  'delete', 'move', 'rebind', 'permission', 'detach', 'newest'];
for (const kind of retirementCases) {
  const session = await open(), { page, browser } = session;
  const entry = ['user', 'route', 'hidden', 'move', 'permission', 'detach'].includes(kind) ? 'right' : 'tap';
  if (entry === 'right') await patchBatteryMarker(page, { tap_action: 'none' });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(runtimePattern, async route => { await gate; await route.fallback(); });
  try {
    const intercepted = page.waitForRequest(request => new URL(request.url()).pathname.endsWith(`/${runtimeName}`));
    await input(page, entry); await intercepted;
    check(`held/${kind}:importActuallyPending`, session.requests.length === 1
      && await page.evaluate(() => !window.__card._editorRuntime && !window.__card._markerDialog));
    const timeline = kind === 'rebind' ? out.rebindTimeline = {} : null;
    const record = async stage => { if (timeline) timeline[stage] = { at: Date.now(), ...await receipt(page) }; };
    await record('beforeSetup');
    if (['connection', 'user', 'ABA'].includes(kind)) {
      await page.evaluate(async kind => {
        const card = window.__card, original = card.hass;
        card.hass = { ...original,
          connection: kind === 'user' ? original.connection : { ...original.connection },
          user: kind === 'user' ? { ...original.user, id: `${original.user.id}-settings-new` } : original.user };
        if (kind === 'ABA') card.hass = original; // Same-frame public HA ABA, not a private generation edit.
        await window.__hpTest.settled();
      }, kind);
      await ready(page);
    } else if (kind === 'route') {
      await page.evaluate(() => {
        history.pushState(null, '', '/settings-away'); window.dispatchEvent(new Event('location-changed'));
      });
    } else if (kind === 'mode') await page.locator('[data-hp="mode-tab"][data-mode="plan"]').click();
    else if (kind === 'space') await page.evaluate(() => window.__hpTest.switchSpace('garden'));
    else if (kind === 'hidden') await patchBatteryMarker(page, { hidden: true });
    else if (kind === 'delete') await page.evaluate(() => window.__hpTest.setServerConfig(cfg => ({
      ...cfg, markers: cfg.markers.filter(row => row.id !== 'd_temp') })));
    else if (kind === 'move') await page.evaluate(() => window.__hpTest.setLayout(layout => ({
      ...layout, d_temp: { ...layout.d_temp, x: 0.48 } })));
    else if (kind === 'rebind') {
      await patchBatteryMarker(page, { binding: 'entity:sensor.living_temp' });
      await page.evaluate(() => window.__hpTest.waitForWrites());
      await record('afterPublicRebind');
    }
    else if (kind === 'permission') await writer(page, false);
    else if (kind === 'detach') await page.evaluate(() => window.__card.remove());
    else if (kind === 'newest') await input(page, 'tap', 'd_light1');
    release();
    await page.waitForFunction(() => window.__card._editorRuntimeLoader.state === 'ready');
    await settled(page);
    await record('afterOldImportRelease');
    if (kind === 'newest') await current(page, 'held/newest:onlyLatestWins', 'd_light1');
    else check(`held/${kind}:oldIntentDoesNotOpen`, !(await receipt(page)).visible);
    if (kind === 'newest') await close(page);
    // Deliberate fresh input after retirement must still work. Restore only
    // public setup, never replay the old event or call a private dialog method.
    await page.evaluate(async kind => {
      const card = window.__card, base = window.__settingsBase;
      if (!card.isConnected) base.host.appendChild(card);
      if (kind === 'route') {
        history.pushState(null, '', base.path); window.dispatchEvent(new Event('location-changed'));
        card.hass = { ...card.hass, connection: { ...card.hass.connection } };
      }
      await window.__hpTest.settled();
    }, kind);
    await ready(page);
    if (kind === 'mode') await page.evaluate(() => window.__hpTest.setMode('view'));
    if (kind === 'space') await page.evaluate(() => window.__hpTest.switchSpace('f1'));
    if (['hidden', 'delete', 'rebind'].includes(kind)) await page.evaluate(() => window.__hpTest.setServerConfig(window.__settingsBase.config));
    if (kind === 'permission') await writer(page, true);
    if (entry === 'right') await patchBatteryMarker(page, { tap_action: 'settings' });
    await record('beforeFreshInput');
    if (kind === 'rebind') check('held/rebind:noWriteFromRetiredIntent', JSON.stringify(timeline.afterOldImportRelease.writeMessages)
      === JSON.stringify(rebindControl.writeMessages));
    await input(page, 'tap'); await current(page, `held/${kind}:freshCurrentIntent`, 'd_temp', kind === 'rebind' ? rebindControl.writes : 0);
    await record('afterFreshInput');
    if (kind === 'rebind') check('held/rebind:freshInputDoesNotAddWrite', JSON.stringify(timeline.afterFreshInput.writeMessages)
      === JSON.stringify(rebindControl.writeMessages));
    await close(page);
  } finally { release(); await browser.close(); }
}

// A failed first fetch uses the loader's actual hashed retry and the current
// intent; this is network delivery, not substituted module bytes or methods.
{
  const session = await open(), { page, browser } = session;
  let attempts = 0;
  try {
    await page.route(runtimePattern, route => ++attempts === 1 ? route.abort('failed') : route.fallback());
    await input(page, 'tap'); await current(page, 'retry:currentRequest');
    check('retry:onePlainAndOneActualHashedRetry', attempts === 2 && session.requests.length === 2
      && !new URL(session.requests[0]).search && new URL(session.requests[1]).searchParams.has('hp_retry'));
    await close(page);
  } finally { await browser.close(); }
}
} catch (error) {
  out.error = error.stack || String(error);
  check('execution:allScenariosCompleted', false);
} finally {
  if (process.env.HP_DEVICE_SETTINGS_REPORT) writeFileSync(process.env.HP_DEVICE_SETTINGS_REPORT, JSON.stringify(out, null, 2) + '\n');
  await finish(null, out);
}
