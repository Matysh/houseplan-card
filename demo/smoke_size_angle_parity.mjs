// HP-1513-01: один и тот же маркер (size 3, angle 37) обязан выглядеть
// одинаково на полной и статичной карточках — статичная игнорировала и
// множитель размера, и поворот.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 900 }, 1);
const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  await customElements.whenDefined('houseplan-space-card');
  const d = c._devices.find((x) => x.space === 'f1' && x.bindingKind === 'device');
  const cfg = JSON.parse(JSON.stringify(c._serverCfg));
  cfg.markers = (cfg.markers || []).filter((m) => m.id !== d.id);
  cfg.markers.push({ id: d.id, binding: 'device:' + d.bindingRef, size: 3, angle: 37 });
  c._serverCfg = cfg; c._cfgEpoch++; c._regSignature = '';
  c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  await new Promise((r) => setTimeout(r, 100));
  const pick = (root) => [...root.querySelectorAll('.dev')]
    .find((e) => (e.getAttribute('style') || '').includes('--dev-scale:3'));
  const full = pick(c.shadowRoot || c.renderRoot);
  const fW = full?.getBoundingClientRect().width || 0;
  const fT = full ? getComputedStyle(full.querySelector('ha-icon')).transform : 'none';

  window.__hpInvalidate?.();
  const hass = { ...c.hass, callWS: async (m) => {
    if (m.type === 'houseplan/config/get') return { config: cfg, rev: 83 };
    if (m.type === 'houseplan/layout/get') return { layout: c._layout, rev: 83 };
    return { ok: true };
  }, connection: { subscribeEvents: async (cb) => { window.__hpInvalidate = cb; return () => {}; } } };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const card = document.createElement('houseplan-space-card');
  card.setConfig({ type: 'custom:houseplan-space-card', space: 'f1' });
  card.hass = hass;
  host.appendChild(card);
  const t0 = Date.now();
  while (!pick(card.renderRoot || { querySelectorAll: () => [] }) && Date.now() - t0 < 6000) {
    await new Promise((r) => setTimeout(r, 60));
  }
  const st = pick(card.renderRoot);
  const sW = st?.getBoundingClientRect().width || 0;
  const sT = st ? getComputedStyle(st.querySelector('ha-icon')).transform : 'none';
  o.staticCarriesScale = sW > 0;
  // абсолютные px несравнимы (разные контейнеры/letterbox) — контракт в том,
  // что множитель РАБОТАЕТ на обеих карточках: базовый значок той же карточки
  // втрое меньше масштабированного
  const stBase = [...card.renderRoot.querySelectorAll('.dev')]
    .find((e) => !(e.getAttribute('style') || '').includes('--dev-scale'));
  const sBaseW = stBase?.getBoundingClientRect().width || 0;
  o.staticRatioIs3 = sBaseW > 0 && Math.abs(sW / sBaseW - 3) < 0.35;
  const fBase = [...(c.shadowRoot || c.renderRoot).querySelectorAll('.dev')]
    .find((e) => !(e.getAttribute('style') || '').includes('--dev-scale') && !e.classList.contains('ghost'));
  const fBaseW = fBase?.getBoundingClientRect().width || 0;
  o.fullRatioIs3 = fBaseW > 0 && Math.abs(fW / fBaseW - 3) < 0.35;
  o.bothRotated = fT !== 'none' && sT !== 'none' && fT.startsWith('matrix') && sT.startsWith('matrix');
  if (!o.staticRatioIs3) console.log('static', sW, sBaseW);
  host.remove();
  c._serverCfg.markers = c._serverCfg.markers.filter((m) => m.id !== d.id);
  c._cfgEpoch++; c._regSignature = ''; c._maybeRebuildDevices();
  return o;
});
checkAll(out);

// Шаг угла в диалоге устройства — 5°, а не 10° (владелец, 2026-08-03):
// значок часто надо выровнять по стене, которая не лежит на сетке в 10°.
const out3 = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  c._setMode('devices'); await c.updateComplete;
  const dev = c._devices.find((d) => d.space === 'f1');
  c._openMarkerDialog(dev); await c.updateComplete;
  // строка «размер · угол»: два ползунка, второй — угол
  const rows = [...sr().querySelectorAll('hp-dialog .colorrow')];
  const row = rows.find((r) => r.textContent.includes('°'));
  const ctl = [...row.querySelectorAll('ha-slider, input[type=range]')];
  const stepOf = (el) => Number(el.step ?? el.getAttribute('step'));
  const maxOf = (el) => Number(el.max ?? el.getAttribute('max'));
  o.angleStepIs5 = ctl.length === 2 && stepOf(ctl[1]) === 5;
  o.angleReaches355 = maxOf(ctl[1]) === 355;
  o.sizeStepUnchanged = stepOf(ctl[0]) === 0.1;
  // и значение реально ложится на 5°
  ctl[1].value = 35;
  ctl[1].dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await c.updateComplete;
  o.angle35Applied = c._markerDialog.angle === 35;
  c._markerDialog = null; await c.updateComplete;
  c._setMode('view'); await c.updateComplete;
  return o;
});
await finish(browser, checkAll(out3));
