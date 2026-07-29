// Множитель «размер значка» обязан масштабировать ГЛИФ вместе с подложкой:
// --mdc-icon-size считался от базового --icon-size, и «увеличенный» значок
// был пустой рамкой вокруг дефолтной иконки (репорт пользователя, 2026-07-29).
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const d = c._devices.find((x) => x.space === 'f1' && x.bindingKind === 'device');
  const glyphW = () => {
    const el = [...sr().querySelectorAll('.dev')].find((e) => !e.classList.contains('ghost'));
    const ic = el?.querySelector('ha-icon');
    return ic ? ic.getBoundingClientRect().width : 0;
  };
  const badgeW = () => {
    const el = [...sr().querySelectorAll('.dev')].find((e) => !e.classList.contains('ghost'));
    return el ? el.getBoundingClientRect().width : 0;
  };
  // базовый размер
  const g1 = glyphW(), b1 = badgeW();
  // множитель ×3 на всех авто-устройствах через маркер первого
  c._serverCfg.markers = (c._serverCfg.markers || []).filter((m) => m.id !== d.id);
  c._serverCfg.markers.push({ id: d.id, binding: 'device:' + d.bindingRef, size: 3 });
  c._cfgEpoch++; c._regSignature = '';
  c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  await new Promise((r) => setTimeout(r, 100));
  const scaled = [...sr().querySelectorAll('.dev')].find((e) => (e.getAttribute('style') || '').includes('--dev-scale:3'));
  const g3 = scaled?.querySelector('ha-icon')?.getBoundingClientRect().width || 0;
  const b3 = scaled?.getBoundingClientRect().width || 0;
  o.badgeScales = b3 > b1 * 2.5;
  o.glyphScalesWithBadge = g3 > g1 * 2.5; // раньше глиф оставался базовым
  o.glyphFillsBadge = g3 / b3 > 0.45 && g3 / b3 < 0.8; // пропорция сохранена
  c._serverCfg.markers = c._serverCfg.markers.filter((m) => m.id !== d.id);
  c._cfgEpoch++; c._regSignature = ''; c._maybeRebuildDevices();
  return o;
});
await finish(browser, checkAll(out));
