// Правило владельца (2026-07-29): у источников света подложка в glow-режиме
// всегда стандартная — индикатор включения это ПЯТНО; в остальных режимах
// горящий источник жёлтый, как греющая термоголовка. RGB лампы красит только
// пятно (и фолбэк цвета пульсации); окраска иконки/рамки убрана. Морф иконки
// остаётся везде. Розетка в glow-режиме остаётся жёлтой — она не источник.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const setFill = async (mode) => {
    const cfg = JSON.parse(JSON.stringify(c._serverCfg));
    const f1 = cfg.spaces.find((s) => s.id === 'f1');
    f1.settings = { ...(f1.settings || {}), fill_mode: mode };
    c._serverCfg = cfg; c._cfgEpoch++; c._regSignature = '';
    c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
    await new Promise((r) => setTimeout(r, 80));
  };
  const lamp = c._devices.find((x) => x.id === 'd_lamp');
  const kettle = c._devices.find((x) => x.id === 'd_kettle'); // розетка/чайник
  // зажигаем лампу с RGB и розетку
  c.hass = { ...c.hass, states: { ...c.hass.states,
    [lamp.primary]: { ...c.hass.states[lamp.primary], state: 'on',
      attributes: { ...(c.hass.states[lamp.primary]?.attributes || {}), rgb_color: [255, 120, 40] } },
    [kettle.primary]: { ...c.hass.states[kettle.primary], state: 'on' } } };
  const devEl = (id) => {
    // надёжнее по индексу в списке devs: ищем по позиции через _pos
    const d = c._devices.find((x) => x.id === id);
    const v = c._viewOr(c._baseVb());
    const p = c._pos(d);
    const left = (((p.x - v.x) / v.w) * 100).toFixed(0);
    return [...sr().querySelectorAll('.dev')].find((e) => Math.abs(parseFloat(e.style.left) - left) < 1.5);
  };

  // --- режим light: горящая RGB-лампа ЖЁЛТАЯ, без rgb-класса --------------
  await setFill('light');
  let le = devEl('d_lamp');
  o.litLampYellowInLightMode = !!le && le.classList.contains('on') && !le.classList.contains('rgb');
  o.morphInLightMode = le?.querySelector('ha-icon')?.getAttribute('icon')?.includes('lightbulb') ?? false;

  // --- режим glow: лампа ТЁМНАЯ (индикатор — пятно), розетка жёлтая -------
  await setFill('glow');
  le = devEl('d_lamp');
  const ke = devEl('d_kettle');
  o.litLampDarkInGlow = !!le && !le.classList.contains('on') && !le.classList.contains('rgb');
  o.glowSpotPresent = !!sr().querySelector('.stage svg radialGradient, .stage svg [id*=glow]');
  o.socketStaysYellowInGlow = !!ke && ke.classList.contains('on');
  o.morphInGlow = le?.querySelector('ha-icon')?.getAttribute('icon')?.includes('lightbulb') ?? false;

  // --- HP-1520-01: в редакторах, где glow-слой скрыт, индикатор возвращается
  // (лампа горит; в devices-редакторе слой рисуется — там лампа тёмная,
  // в plan-редакторе слоя нет — там класс on должен вернуться)
  c._setMode('devices'); c.requestUpdate(); await c.updateComplete;
  le = devEl('d_lamp');
  o.devicesEditorLampDark = !!le && !le.classList.contains('on');
  o.devicesEditorHasGlow = !!sr().querySelector('.stage svg radialGradient, .stage svg [id*=glow]');
  c._setMode('plan'); c.requestUpdate(); await c.updateComplete;
  const planLamp = [...sr().querySelectorAll('.dev')].find((e) => e.classList.contains('on'));
  o.planEditorLampYellow = !!planLamp; // слой скрыт — жёлтый вернулся
  o.planEditorNoGlow = !sr().querySelector('.stage svg radialGradient, .stage svg [id*=glow]');
  c._setMode('view'); c.requestUpdate(); await c.updateComplete;

  // --- выключенная лампа тёмная в обоих режимах ---------------------------
  c.hass = { ...c.hass, states: { ...c.hass.states,
    [lamp.primary]: { ...c.hass.states[lamp.primary], state: 'off' } } };
  c.requestUpdate(); await c.updateComplete;
  le = devEl('d_lamp');
  o.offLampDarkInGlow = !!le && !le.classList.contains('on');
  await setFill('light');
  le = devEl('d_lamp');
  o.offLampDarkInLightMode = !!le && !le.classList.contains('on');
  return o;
});
await finish(browser, checkAll(out));
