/** #1026: owned HA availability and real computed paint; no private product writes. */
import { launch, requirePinnedBrowser, check, checkAll, finish } from './serve.mjs';
import { installDeviceOfflineFixture, readDeviceOfflinePaint, readDeviceOfflineLeds,
  setDeviceOfflineStates, waitDeviceOfflinePaint } from './helpers/device-offline.mjs';

requirePinnedBrowser();
const { page, browser } = await launch({ width: 1440, height: 1100 }, 1);
const out = {}, observations = {};
const closeTo = (a, b) => Math.abs(a - b) < .005;
const opaque = node => !!node && closeTo(node.effective, 1);
const dim = node => !!node && closeTo(node.effective, .35);
const offline = face => /(?:^|\s)unavail(?:\s|$)/.test(face?.classes ?? '');
const badge = face => face?.badges[0];
const ids = ['offline-icon', 'offline-down', 'offline-text', 'offline-unknown', 'offline-missing',
  'offline-source', 'offline-double', 'offline-static', 'offline-controller', 'offline-exact',
  'offline-alarm', 'offline-legacy', 'offline-whole', 'offline-alarm-whole',
  'offline-led-unavailable', 'offline-led-unknown'];
const shape = face => [face?.core, face?.frame, face?.contact, badge(face)?.paint]
  .map(node => node?.rect?.slice(2));
const ledInk = led => [led?.core, led?.outline].map(node => node && [node.stroke, node.width,
  node.opacity, node.strokeOpacity, node.dash, node.filter]);
try {
  await installDeviceOfflineFixture(page);
  const start = await readDeviceOfflinePaint(page, ids); observations.initial = start;
  const f = start.faces;
  out.actualFixtureHasGlyphAndText = !!f['offline-icon']?.glyph && f['offline-text']?.value === true
    && f['offline-text'].text.includes('23.5');
  out.mediaOffIsOrdinaryNeutral = !offline(f['offline-icon']) && opaque(f['offline-icon']?.parent)
    && opaque(f['offline-icon']?.glyph);
  out.unavailableRetainsOrdinaryShell = offline(f['offline-down']) && opaque(f['offline-down']?.parent)
    && opaque(f['offline-down']?.core) && opaque(f['offline-down']?.frame)
    && opaque(f['offline-down']?.contact)
    && f['offline-down']?.core?.background === f['offline-icon']?.core?.background;
  out.onlyOfflineGlyphDims = dim(f['offline-down']?.glyph);
  out.actualTextContentDims = dim(f['offline-text']?.glyph) && opaque(f['offline-text']?.core);
  out.badgeContentHasIndependentOpacity = opaque(badge(f['offline-down'])?.paint)
    && dim(badge(f['offline-down'])?.content);
  out.unknownIsNotConfirmedOffline = !offline(f['offline-unknown']) && opaque(f['offline-unknown']?.glyph);
  out.missingOwnedStateIsNotConfirmedOffline = !offline(f['offline-missing']) && opaque(f['offline-missing']?.glyph);
  out.foreignSourceQualityDoesNotDimOwnGlyph = !offline(f['offline-source']) && opaque(f['offline-source']?.glyph)
    && opaque(badge(f['offline-source'])?.paint) && closeTo(badge(f['offline-source'])?.content?.effective, .66);
  out.twoReasonsHaveOneOfflineOpacity = offline(f['offline-double'])
    && opaque(badge(f['offline-double'])?.paint) && dim(badge(f['offline-double'])?.content);
  out.staticDisplayKeepsItsExistingGate = !offline(f['offline-static']) && opaque(f['offline-static']?.glyph)
    && f['offline-static']?.badges.length === 0;
  out.controllerFixtureReallyHasForeignControl = f['offline-controller']?.controls?.includes('light.offline_target')
    && f['offline-controller']?.own?.includes('sensor.offline_controller_battery');
  out.liveOwnControllerIgnoresOfflineForeignTarget = !offline(f['offline-controller'])
    && opaque(f['offline-controller']?.glyph);
  out.exactEntityIgnoresHealthyOwnSiblings = offline(f['offline-exact']) && dim(f['offline-exact']?.glyph);
  out.samePhysicalWholeRosterUsesItsPositiveDiagnostic = !offline(f['offline-whole'])
    && opaque(f['offline-whole']?.glyph) && f['offline-whole']?.own?.includes('sensor.offline_exact_battery');
  out.offlineKeepsBatteryIndependent = opaque(f['offline-exact']?.battery);
  out.confirmedAlarmCoexistsWithOwnOffline = offline(f['offline-alarm'])
    && /(?:^|\s)alarm(?:\s|$)/.test(f['offline-alarm']?.classes ?? '')
    && dim(f['offline-alarm']?.glyph) && opaque(f['offline-alarm']?.core);
  out.liveLegacyMetricsUseRealContentWrapper = f['offline-legacy']?.badges.length === 2
    && f['offline-legacy'].badges.every(item => opaque(item.paint) && opaque(item.content));

  const leds = await readDeviceOfflineLeds(page); observations.leds = leds;
  out.allLedFixturesAreActualSvg = Object.values(leds).every(led => led?.core?.d && led?.outline?.d && led?.hit?.d);
  out.ledUnknownAndUnavailableUseOrdinaryOffInk = JSON.stringify(ledInk(leds.off)) === JSON.stringify(ledInk(leds.unavailable))
    && JSON.stringify(ledInk(leds.off)) === JSON.stringify(ledInk(leds.unknown));
  out.ordinaryOffLedUsesApprovedWhiteCutout = leds.off?.core?.stroke === 'rgb(255, 255, 255)'
    && leds.off?.outline?.stroke === 'rgb(56, 56, 56)' && closeTo(Number(leds.off?.core?.strokeOpacity), .7)
    && leds.off?.core?.dash === 'none' && leds.off?.outline?.dash === 'none'
    && leds.off?.bodyMask?.startsWith('url(#hp-led-off-')
    && closeTo(parseFloat(leds.off?.outline?.width), parseFloat(leds.off?.core?.width) * 2);
  out.ledNeverInventsUnavailablePaint = Object.values(leds).every(led => led?.state === 'off'
    && !led.classes.includes('unavailable') && ['none', '0px'].includes(led.core.dash));
  out.ledWithoutBadgeHasNoOfflineIcon = await page.evaluate(() => !window.__card.renderRoot
    .querySelector('.dev[data-id="offline-led-off"]'));
  out.ledBadgeContentOnlyDimsWhenConfirmed = opaque(f['offline-led-unavailable']?.parent)
    && dim(badge(f['offline-led-unavailable'])?.content) && opaque(badge(f['offline-led-unknown'])?.content);

  await setDeviceOfflineStates(page, { 'media_player.offline_down': 'off', 'switch.offline_text': 'on' });
  const recovered = await readDeviceOfflinePaint(page, ['offline-down', 'offline-text']); observations.recovered = recovered;
  out.ownedRecoveryRemovesOfflineWithoutReload = ['offline-down', 'offline-text'].every(id =>
    !offline(recovered.faces[id]) && opaque(recovered.faces[id]?.glyph) && opaque(badge(recovered.faces[id])?.content));
  out.ownedRecoveryKeepsShellGeometry = ['offline-down', 'offline-text'].every(id =>
    JSON.stringify(shape(f[id])) === JSON.stringify(shape(recovered.faces[id])));
  await setDeviceOfflineStates(page, { 'media_player.offline_down': 'unavailable', 'switch.offline_text': 'unavailable' });
  const returned = await readDeviceOfflinePaint(page, ['offline-down', 'offline-text']);
  out.repeatedOfflineReturnsFromFreshHassRows = ['offline-down', 'offline-text'].every(id =>
    offline(returned.faces[id]) && dim(returned.faces[id]?.glyph));

  // Positive own evidence wins; unknown/missing evidence never proves all-own offline.
  await setDeviceOfflineStates(page, { 'sensor.offline_controller_battery': 'unavailable' });
  const partial = await readDeviceOfflinePaint(page, ['offline-controller']);
  out.unknownPlusUnavailableOwnRowsStayUnknown = !offline(partial.faces['offline-controller']);
  await setDeviceOfflineStates(page, { 'event.offline_controller': 'unavailable' });
  const allDown = await readDeviceOfflinePaint(page, ['offline-controller']);
  out.everyOwnedRowUnavailableConfirmsOffline = offline(allDown.faces['offline-controller'])
    && dim(allDown.faces['offline-controller']?.glyph);
  await setDeviceOfflineStates(page, { 'event.offline_controller': null });
  const absent = await readDeviceOfflinePaint(page, ['offline-controller']);
  out.missingOneOwnedRowRevokesOfflineProof = !offline(absent.faces['offline-controller']);
  await setDeviceOfflineStates(page, { 'sensor.offline_controller_battery': '100', 'event.offline_controller': 'unknown' });
  await setDeviceOfflineStates(page, { 'switch.offline_alarm_power': 'off' });
  const liveAlarm = (await readDeviceOfflinePaint(page, ['offline-alarm'])).faces['offline-alarm'];
  observations.liveAlarm = liveAlarm;
  out.ownRecoveryKeepsConfirmedAlarmColorAndFrame = !offline(liveAlarm) && opaque(liveAlarm?.glyph)
    && /(?:^|\s)alarm(?:\s|$)/.test(liveAlarm?.classes ?? '')
    && liveAlarm?.core?.background === f['offline-alarm']?.core?.background
    && liveAlarm?.frame?.border === f['offline-alarm']?.frame?.border;
  await setDeviceOfflineStates(page, { 'switch.offline_alarm_power': 'unavailable' });

  // Real input to the normal marker editor exposes the shared preview renderer.
  await page.evaluate(async () => { await window.__hpTest.setMode('devices'); await window.__hpTest.openMarkerDialog('offline-down'); });
  await page.waitForFunction(() => window.__card.renderRoot.querySelector('hp-device-preview')?.shadowRoot?.querySelector('.dev'));
  await waitDeviceOfflinePaint(page);
  const preview = await readDeviceOfflinePaint(page, ['offline-down'], 'preview'); observations.preview = preview;
  out.previewUsesSameContentOnlyOfflinePaint = offline(preview.faces['offline-down'])
    && opaque(preview.faces['offline-down']?.parent) && dim(preview.faces['offline-down']?.glyph)
    && opaque(badge(preview.faces['offline-down'])?.paint) && dim(badge(preview.faces['offline-down'])?.content);
  await setDeviceOfflineStates(page, { 'media_player.offline_down': 'off' });
  const previewLive = await readDeviceOfflinePaint(page, ['offline-down'], 'preview');
  out.openPreviewTracksOwnRecovery = !offline(previewLive.faces['offline-down']) && opaque(previewLive.faces['offline-down']?.glyph);
  await page.evaluate(async () => { await window.__hpTest.close(undefined, { via: 'cancel' }); await window.__hpTest.setMode('view'); });
  await setDeviceOfflineStates(page, { 'media_player.offline_down': 'unavailable' });

  // A separate actual static card gets the same public HA and accepted backend data.
  await page.evaluate(async () => {
    const full = window.__card, space = document.createElement('houseplan-space-card');
    space.setConfig({ type: 'custom:houseplan-space-card', space: full._space, live_states: true, show_button: false });
    space.hass = full.hass; document.body.append(space);
  });
  await page.waitForFunction(() => document.querySelector('houseplan-space-card')?.shadowRoot
    ?.querySelector('.dev[data-id="offline-down"] .device-core'));
  await waitDeviceOfflinePaint(page);
  const staticPaint = await readDeviceOfflinePaint(page,
    ['offline-down', 'offline-text', 'offline-led-unavailable', 'offline-led-unknown'], 'space'); observations.space = staticPaint;
  out.staticCardSharesOfflineGlyphAndTextPolicy = ['offline-down', 'offline-text'].every(id =>
    offline(staticPaint.faces[id]) && opaque(staticPaint.faces[id]?.parent) && dim(staticPaint.faces[id]?.glyph));
  out.staticCardLedBadgeUsesOwnedOfflineContentOnly = offline(staticPaint.faces['offline-led-unavailable'])
    && opaque(staticPaint.faces['offline-led-unavailable']?.parent)
    && opaque(badge(staticPaint.faces['offline-led-unavailable'])?.paint)
    && dim(badge(staticPaint.faces['offline-led-unavailable'])?.content)
    && opaque(badge(staticPaint.faces['offline-led-unknown'])?.content);
  await setDeviceOfflineStates(page, { 'light.offline_led_unavailable': 'unknown' });
  const staticLedUnknown = await readDeviceOfflinePaint(page, ['offline-led-unavailable'], 'space');
  out.staticCardLedUnknownRevokesConfirmedOffline = !offline(staticLedUnknown.faces['offline-led-unavailable'])
    && opaque(badge(staticLedUnknown.faces['offline-led-unavailable'])?.content);
  await setDeviceOfflineStates(page, { 'light.offline_led_unavailable': 'unavailable' });
  await setDeviceOfflineStates(page, { 'media_player.offline_down': 'off' });
  const staticLive = await readDeviceOfflinePaint(page, ['offline-down'], 'space');
  out.staticCardTracksOwnRecovery = !offline(staticLive.faces['offline-down']) && opaque(staticLive.faces['offline-down']?.glyph);
  await setDeviceOfflineStates(page, { 'media_player.offline_down': 'unavailable' });
  await page.evaluate(() => {
    const full = window.__card, space = document.querySelector('houseplan-space-card');
    space.setConfig({ type: 'custom:houseplan-space-card', space: full._space, live_states: false, show_button: false });
  });
  await waitDeviceOfflinePaint(page);
  const staticPaused = await readDeviceOfflinePaint(page, ['offline-down'], 'space');
  out.staticCardLiveStatesFalseKeepsExistingGate = !offline(staticPaused.faces['offline-down'])
    && opaque(staticPaused.faces['offline-down']?.glyph);
  await page.evaluate(() => document.querySelector('houseplan-space-card').remove());
  await setDeviceOfflineStates(page, { 'media_player.offline_down': 'unavailable' });

  for (const profile of ['dark', 'custom', 'iso']) {
    await page.evaluate(async profile => {
      const card = window.__card;
      card.hass = { ...card.hass, themes: { ...card.hass.themes, darkMode: true } };
      card.style.setProperty('--card-background-color', profile === 'custom' ? '#442c4f' : '#202126');
      card.style.setProperty('--primary-text-color', '#ece4da');
      if (profile === 'iso') await window.__hpTest.setVolumetricView(true);
    }, profile);
    await waitDeviceOfflinePaint(page);
    const paint = await readDeviceOfflinePaint(page, ['offline-down', 'offline-icon']);
    observations[profile] = paint;
    out[`contentOnlyPolicy_${profile}`] = opaque(paint.faces['offline-down']?.parent)
      && dim(paint.faces['offline-down']?.glyph) && opaque(badge(paint.faces['offline-down'])?.paint)
      && paint.faces['offline-down']?.core?.background === paint.faces['offline-icon']?.core?.background;
    if (profile === 'iso') out.isoShadowKeepsOrdinaryPaint = await page.evaluate(() => {
      const root = window.__card.renderRoot;
      const shadow = id => root.querySelector(`.iso-tile-shadow[data-shadow-of="${id}"]`);
      const down = shadow('offline-down'), normal = shadow('offline-icon');
      return !!down && !!normal && Number(getComputedStyle(down).opacity) === 1
        && getComputedStyle(down).boxShadow === getComputedStyle(normal).boxShadow;
    });
  }
  const final = await readDeviceOfflinePaint(page, ['offline-down']);
  out.haUpdatesAndCancelledPreviewHaveNoWriters = final.writes === 0 && final.services === 0;
  const highDpi = await launch({ width: 1100, height: 950 }, 2);
  try {
    await installDeviceOfflineFixture(highDpi.page);
    const paint = await readDeviceOfflinePaint(highDpi.page, ['offline-down', 'offline-text']);
    observations.dpr2 = paint;
    out.highDpiUsesSameContentPolicy = await highDpi.page.evaluate(() => devicePixelRatio === 2)
      && ['offline-down', 'offline-text'].every(id => opaque(paint.faces[id]?.parent)
        && dim(paint.faces[id]?.glyph) && opaque(badge(paint.faces[id])?.paint));
  } finally { await highDpi.browser.close(); }
  checkAll(out);
} catch (error) {
  check('deviceOfflineSmokeCompleted', false);
  observations.error = String(error?.stack || error);
}
await finish(browser, { checks: out, observations });
