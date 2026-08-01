// Правило владельца (2026-08-01, вариант «б»): «движение = разовая вспышка
// в момент обнаружения; cool-down не пульсирует; присутствие = статичное
// кольцо пока обитаемо». Датчик ДВИЖЕНИЯ (device_class motion) при переходе
// off→on получает класс 'senseflash' — короткая вспышка кольца (hp-sense,
// 3 удара, ~3.3 c), после чего класс снимается, ДАЖЕ если сущность всё ещё
// висит в on (это cool-down датчика, а не движение). Новый цикл off→on —
// новая вспышка. Датчики ПРИСУТСТВИЯ (occupancy/presence) при on несут
// 'sensehold' — статичное жёлтое кольцо без анимации (opacity 0.4). Жёлтая
// заливка .dev.on в обоих случаях не участвует; ghost — без кольца
// (призрак — конфигурация, не статус).
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const setMotion = async (state, device_class) => {
    c.hass = { ...c.hass, states: { ...c.hass.states,
      'binary_sensor.hall_motion': { entity_id: 'binary_sensor.hall_motion', state,
        attributes: { friendly_name: 'Motion', device_class, linkquality: 64 } } } };
    await c.updateComplete;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // --- motion off→on: вспышка senseflash, 3 удара, подложка НЕ жёлтая -----
  await setMotion('off', 'motion');
  out.offNoFlash = sr().querySelectorAll('.dev.senseflash, .dev.sensehold').length === 0;
  await setMotion('on', 'motion');
  const flashEl = sr().querySelector('.dev.senseflash');
  out.motionTripFlashes = !!flashEl;
  out.flashIsNotOn = !!flashEl && !flashEl.classList.contains('on') && !flashEl.classList.contains('open');
  const after = flashEl ? getComputedStyle(flashEl, '::after') : null;
  out.flashAnimated = !!after && after.animationName === 'hp-sense';
  out.flashFinite = !!after && after.animationIterationCount === '3'; // не infinite!
  // подложка нейтральная — как у обычного .dev, не как у .dev.on
  const neutral = [...sr().querySelectorAll('.dev')].find((e) =>
    !e.classList.contains('senseflash') && !e.classList.contains('sensehold')
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
  out.flashEndsWhileOn = sr().querySelectorAll('.dev.senseflash').length === 0;

  // --- повторный цикл off→on: новая вспышка --------------------------------
  await setMotion('off', 'motion');
  await setMotion('on', 'motion');
  out.retripFlashesAgain = sr().querySelectorAll('.dev.senseflash').length === 1;

  // --- occupancy: статичное кольцо sensehold, без анимации ----------------
  await setMotion('on', 'occupancy');
  const holdEl = sr().querySelector('.dev.sensehold');
  out.occupancyHolds = !!holdEl;
  const hAfter = holdEl ? getComputedStyle(holdEl, '::after') : null;
  out.holdNotAnimated = !!hAfter && hAfter.animationName === 'none';
  out.holdRingFaint = !!hAfter && Math.abs(parseFloat(hAfter.opacity) - 0.4) < 0.01;
  out.holdBgNeutral = !!holdEl && !!neutral
    && getComputedStyle(holdEl).backgroundColor === getComputedStyle(neutral).backgroundColor;
  out.holdNoFlashClass = !!holdEl && !holdEl.classList.contains('senseflash');
  await setMotion('off', 'occupancy');
  out.occupancyOffClears = sr().querySelectorAll('.dev.sensehold').length === 0;

  // --- presence аналогично -------------------------------------------------
  await setMotion('on', 'presence');
  out.presenceHolds = sr().querySelectorAll('.dev.sensehold').length === 1;
  // и это именно sense-состояние, не тревога и не «открыто»
  out.noAlarmNoOpen = !sr().querySelector('.dev.sensehold.alarm') && !sr().querySelector('.dev.sensehold.open');

  // --- ghost не рисует ничего (призрак — конфигурация, не статус) ---------
  await setMotion('off', 'motion');
  await setMotion('on', 'motion');
  const d = c._devices.find((x) => x.entities.includes('binary_sensor.hall_motion'));
  c._serverCfg.markers = c._serverCfg.markers || [];
  c._serverCfg.markers.push({ id: d.id, binding: 'device:' + d.bindingRef, hidden: true });
  c._cfgEpoch++; c._regSignature = '';
  c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  out.hiddenNotInView = sr().querySelectorAll('.dev.senseflash, .dev.sensehold').length === 0;
  c._showHidden = true; c._setMode('devices'); c.requestUpdate(); await c.updateComplete;
  const ghost = sr().querySelector('.dev.ghost');
  out.ghostNoSense = !!ghost && !ghost.classList.contains('senseflash') && !ghost.classList.contains('sensehold')
    && getComputedStyle(ghost, '::after').animationName !== 'hp-sense';
  return out;
});
checkAll(res, {});
await finish(browser, res);
