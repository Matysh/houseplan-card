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
await finish(browser, checkAll(out));
