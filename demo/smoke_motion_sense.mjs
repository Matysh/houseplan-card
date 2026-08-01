// Правило владельца (2026-08-01): «жёлтая подложка = включено; срабатывание
// сенсора = лёгкая жёлтая пульсация». Датчик движения/присутствия при state=on
// получает класс 'sense' — мягкое жёлтое пульсирующее кольцо (::after,
// hp-sense), но НЕ жёлтую заливку .dev.on. off → без класса; ghost — без
// пульсации (призрак — конфигурация, не статус).
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

  // --- motion on: класс sense, кольцо анимировано, подложка НЕ жёлтая ----
  await setMotion('on', 'motion');
  const senseEl = sr().querySelector('.dev.sense');
  out.motionOnHasSense = !!senseEl;
  out.senseIsNotOn = !!senseEl && !senseEl.classList.contains('on') && !senseEl.classList.contains('open');
  const after = senseEl ? getComputedStyle(senseEl, '::after') : null;
  out.ringAnimated = !!after && after.animationName === 'hp-sense' && after.animationDuration === '2.4s';
  // подложка нейтральная — как у обычного .dev, не как у .dev.on
  const neutral = [...sr().querySelectorAll('.dev')].find((e) =>
    !e.classList.contains('sense') && !e.classList.contains('on') && !e.classList.contains('open')
    && !e.classList.contains('alarm') && !e.classList.contains('unavail') && !e.classList.contains('valonly'));
  const bg = senseEl ? getComputedStyle(senseEl).backgroundColor : '';
  out.bgIsNeutral = !!neutral && bg === getComputedStyle(neutral).backgroundColor;
  out.bgNotYellow = bg !== '' && bg !== 'rgb(255, 212, 92)'; // --hp-on

  // --- off: класс уходит ---------------------------------------------------
  await setMotion('off', 'motion');
  out.offClearsSense = sr().querySelectorAll('.dev.sense').length === 0;

  // --- occupancy / presence аналогично ------------------------------------
  await setMotion('on', 'occupancy');
  out.occupancySenses = sr().querySelectorAll('.dev.sense').length === 1;
  await setMotion('on', 'presence');
  out.presenceSenses = sr().querySelectorAll('.dev.sense').length === 1;
  // и это именно sense, не тревога и не «открыто»
  out.noAlarmNoOpen = !sr().querySelector('.dev.sense.alarm') && !sr().querySelector('.dev.sense.open');

  // --- ghost не пульсирует (призрак — конфигурация, не статус) ------------
  await setMotion('on', 'motion');
  const d = c._devices.find((x) => x.entities.includes('binary_sensor.hall_motion'));
  c._serverCfg.markers = c._serverCfg.markers || [];
  c._serverCfg.markers.push({ id: d.id, binding: 'device:' + d.bindingRef, hidden: true });
  c._cfgEpoch++; c._regSignature = '';
  c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  out.hiddenNotInView = sr().querySelectorAll('.dev.sense').length === 0;
  c._showHidden = true; c._setMode('devices'); c.requestUpdate(); await c.updateComplete;
  const ghost = sr().querySelector('.dev.ghost');
  out.ghostNoSense = !!ghost && !ghost.classList.contains('sense')
    && getComputedStyle(ghost, '::after').animationName !== 'hp-sense';
  return out;
});
checkAll(res, {});
await finish(browser, res);
