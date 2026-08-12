// Правило владельца (2026-08-01, вариант «б»): «движение = разовая вспышка
// в момент обнаружения; cool-down не пульсирует; присутствие = статичное
// кольцо пока обитаемо». Датчик ДВИЖЕНИЯ (device_class motion) при переходе
// off→on получает activity-event — три последовательные волны
// (hp-pulse-short, ~3.3 c), после чего эффект снимается, ДАЖЕ если сущность всё ещё
// висит в on (это cool-down датчика, а не движение). Новый цикл off→on —
// новая вспышка. Датчики ПРИСУТСТВИЯ (occupancy/presence) при on несут
// activity-presence — статичное кольцо без анимации (opacity 0.4). Жёлтая
// заливка .dev.on в обоих случаях не участвует; ghost — без кольца
// (призрак — конфигурация, не статус).
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // Fresh-card baseline: the marker is built while motion is off and no
  // unrelated hass tick is allowed to establish runtime later by accident.
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'binary_sensor.hall_motion': { entity_id: 'binary_sensor.hall_motion', state: 'off',
      attributes: { friendly_name: 'Motion', device_class: 'motion', linkquality: 64 } } } };
  await c.updateComplete;
  c._activityRt.clear();
  // Activity is an explicit presentation: opt this fixture into it.
  const motionDevice = c._devices.find((x) => x.entities.includes('binary_sensor.hall_motion'));
  c._serverCfg.markers = (c._serverCfg.markers || [])
    .filter((m) => m.binding !== 'device:' + motionDevice.bindingRef);
  c._serverCfg.markers.push({
    id: motionDevice.id,
    binding: 'device:' + motionDevice.bindingRef,
    display: 'icon_ripple',
  });
  c._cfgEpoch++; c._regSignature = '';
  c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  const setMotion = async (state, device_class) => {
    c.hass = { ...c.hass, states: { ...c.hass.states,
      'binary_sensor.hall_motion': { entity_id: 'binary_sensor.hall_motion', state,
        attributes: { friendly_name: 'Motion', device_class, linkquality: 64 } } } };
    await c.updateComplete;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // --- первое событие сразу после build не теряется как baseline ----------
  await setMotion('on', 'motion');
  out.firstTripAfterBuildFlashes = sr().querySelectorAll('.dev.activity-event').length === 1;
  await setMotion('off', 'motion');
  c._activityRt.clear(); c._syncActivityRuntime(); c.requestUpdate(); await c.updateComplete;

  // --- motion off→on: event, 3 волны, подложка НЕ жёлтая -------------------
  await setMotion('off', 'motion');
  out.offNoFlash = sr().querySelectorAll('.dev.activity-event, .dev.activity-presence').length === 0;
  await setMotion('on', 'motion');
  const flashEl = sr().querySelector('.dev.activity-event');
  out.motionTripFlashes = !!flashEl;
  out.flashIsNotOn = !!flashEl && !flashEl.classList.contains('on') && !flashEl.classList.contains('open');
  const waves = flashEl ? [...flashEl.querySelectorAll('.device-pulse.short.event i')] : [];
  const firstWave = waves[0] ? getComputedStyle(waves[0]) : null;
  out.flashAnimated = !!firstWave && firstWave.animationName.startsWith('hp-pulse-short');
  out.flashFinite = waves.length === 3
    && waves.every((w) => getComputedStyle(w).animationIterationCount === '1');
  // подложка нейтральная — как у обычного .dev, не как у .dev.on
  const neutral = [...sr().querySelectorAll('.dev')].find((e) =>
    !e.classList.contains('activity-event') && !e.classList.contains('activity-presence')
    && !e.classList.contains('on') && !e.classList.contains('open')
    && !e.classList.contains('alarm') && !e.classList.contains('unavail') && !e.classList.contains('valonly'));
  const bg = flashEl ? getComputedStyle(flashEl).backgroundColor : '';
  out.flashBgNeutral = !!neutral && bg === getComputedStyle(neutral).backgroundColor;
  out.flashBgNotYellow = bg !== '' && bg !== 'rgb(255, 212, 92)'; // --hp-on

  // --- КЛЮЧЕВОЙ ассерт: вспышка гаснет, хотя state всё ещё on -------------
  // (cool-down датчика — не движение: класс обязан уйти сам по таймеру)
  await sleep(3600);
  await c.updateComplete;
  out.stateStillOn = c.hass.states['binary_sensor.hall_motion'].state === 'on';
  out.flashEndsWhileOn = sr().querySelectorAll('.dev.activity-event').length === 0;

  // --- повторный цикл off→on: новая вспышка --------------------------------
  await setMotion('off', 'motion');
  await setMotion('on', 'motion');
  out.retripFlashesAgain = sr().querySelectorAll('.dev.activity-event').length === 1;

  // --- HP-1543-02: быстрый повторный off→on ДО конца текущей вспышки ------
  // обязан ПЕРЕЗАПУСТИТЬ анимацию (новый timeline). Раньше класс event
  // не снимался и animation-name не менялся — браузер продолжал старый
  // timeline, и после его конца (base opacity 0) второй trip был невидим.
  await sleep(3600); await c.updateComplete;   // дать текущей вспышке догореть
  const senseAnim = (el) => el && el.getAnimations({ subtree: true })
    .find((a) => a.animationName && a.animationName.startsWith('hp-pulse-short') && a.playState === 'running');
  await setMotion('off', 'motion');
  await setMotion('on', 'motion');             // trip №1
  out.rapidFirstTripFlashes = sr().querySelectorAll('.dev.activity-event').length === 1;
  await sleep(1200);                           // середина первой вспышки (< 3.3s)
  const a1 = senseAnim(sr().querySelector('.dev.activity-event'));
  out.rapidFirstAnimMidway = !!a1 && a1.currentTime > 900 && a1.currentTime < 3300;
  await setMotion('off', 'motion');
  await setMotion('on', 'motion');             // trip №2 — retrip до конца вспышки
  out.rapidRetripKeepsFlash = sr().querySelectorAll('.dev.activity-event').length === 1;
  const a2 = senseAnim(sr().querySelector('.dev.activity-event'));
  // новый timeline: currentTime у начала (старый уже был ~1.2s и продолжал бы расти)
  out.rapidRetripRestartsAnim = !!a2 && a2.currentTime != null && a2.currentTime < 300;
  // кольцо реально играет ПОСЛЕ момента, где закончилась бы первая анимация:
  // ~2.3s после trip №2 = ~3.5s после trip №1 (старый timeline уже отыграл бы)
  await sleep(2300);
  const el3 = sr().querySelector('.dev.activity-event');
  const a3 = senseAnim(el3);
  out.rapidSecondFlashStillPlays = !!a3 && a3.playState === 'running';
  out.rapidRingVisibleAfterFirstWindow = !!el3
    && [...el3.querySelectorAll('.device-pulse.short.event i')]
      .some((w) => parseFloat(getComputedStyle(w).opacity) > 0.03);
  // и класс уходит через полные ~3.3s после ВТОРОГО trip (flashTs/таймер обновлены)
  await sleep(1400); await c.updateComplete;
  out.rapidFlashEndsAfterSecondWindow = sr().querySelectorAll('.dev.activity-event').length === 0;

  // --- occupancy: continuous presence pulse --------------------------------
  await setMotion('on', 'occupancy');
  const holdEl = sr().querySelector('.dev.activity-presence');
  out.occupancyHolds = !!holdEl;
  const holdRing = holdEl?.querySelector('.device-pulse.continuous.presence i:first-child');
  const hAfter = holdRing ? getComputedStyle(holdRing) : null;
  out.holdAnimated = !!hAfter && hAfter.animationName === 'hp-pulse-continuous';
  out.holdAnimationCalm = !!hAfter && hAfter.animationDuration === '2.4s';
  out.holdBgNeutral = !!holdEl && !!neutral
    && getComputedStyle(holdEl).backgroundColor === getComputedStyle(neutral).backgroundColor;
  out.holdNoFlashClass = !!holdEl && !holdEl.classList.contains('activity-event');
  await setMotion('off', 'occupancy');
  out.occupancyOffClears = sr().querySelectorAll('.dev.activity-presence').length === 0;

  // --- presence аналогично -------------------------------------------------
  await setMotion('on', 'presence');
  out.presenceHolds = sr().querySelectorAll('.dev.activity-presence').length === 1;
  // и это именно sense-состояние, не тревога и не «открыто»
  out.noAlarmNoOpen = !sr().querySelector('.dev.activity-presence.alarm') && !sr().querySelector('.dev.activity-presence.open');

  // --- смена effective source синхронно снимает старую вспышку ------------
  await setMotion('off', 'motion');
  await setMotion('on', 'motion');
  const liveMarker = c._serverCfg.markers.find((m) => m.id === motionDevice.id);
  liveMarker.controls = ['switch.kettle'];
  c._regSignature = ''; c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  out.rebindDropsOldFlashWithoutHassTick = !sr().querySelector('.dev.activity-event');
  delete liveMarker.controls;
  c._regSignature = ''; c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;

  // --- ghost не рисует ничего (призрак — конфигурация, не статус) ---------
  await setMotion('off', 'motion');
  await setMotion('on', 'motion');
  const d = c._devices.find((x) => x.entities.includes('binary_sensor.hall_motion'));
  c._serverCfg.markers = (c._serverCfg.markers || [])
    .filter((m) => m.binding !== 'device:' + d.bindingRef);
  c._serverCfg.markers.push({ id: d.id, binding: 'device:' + d.bindingRef, display: 'icon_ripple', hidden: true });
  c._cfgEpoch++; c._regSignature = '';
  c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  out.hiddenNotInView = sr().querySelectorAll('.dev.activity-event, .dev.activity-presence').length === 0;
  c._showHidden = true; c._setMode('devices'); c.requestUpdate(); await c.updateComplete;
  const ghost = sr().querySelector('.dev.ghost');
  out.ghostNoSense = !!ghost && !ghost.classList.contains('activity-event') && !ghost.classList.contains('activity-presence')
    && !ghost.querySelector('.device-pulse');
  return out;
});
checkAll(res, {});
await finish(browser, res);
