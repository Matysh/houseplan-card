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
checkAll(out);

// Тот же класс бага для СПУТНИКОВ значка (репорт владельца, 2026-08-01):
// бейдж значения (display:value) и temp-плашка считались от базового
// --icon-size и оставались маленькими при size=2. Всё, что визуально
// принадлежит устройству, обязано расти вместе с --dev-scale.
const out2 = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const devEl = () => {
    const idx = c._devices.filter((x) => x.space === c._space).findIndex((x) => x.id === 'd_temp');
    return sr().querySelectorAll('.dev')[idx];
  };
  const setMarker = async (extra) => {
    c._serverCfg.markers = (c._serverCfg.markers || []).filter((m) => m.id !== 'd_temp');
    c._serverCfg.markers.push({ id: 'd_temp', binding: 'device:d_temp', ...extra });
    c._cfgEpoch++; c._regSignature = '';
    c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
    await new Promise((r) => setTimeout(r, 80));
  };
  const fs = (el) => parseFloat(getComputedStyle(el).fontSize);
  // базовый --icon-size в px: ширина немасштабированного бейджа минус рамка 1px×2
  const plain = [...sr().querySelectorAll('.dev')].find(
    (e) => !e.classList.contains('ghost') && !e.classList.contains('valonly') && !(e.getAttribute('style') || '').includes('--dev-scale'));
  const iconPx = plain.getBoundingClientRect().width - 2;

  // --- бейдж значения (valonly) ---
  await setMarker({ display: 'value', size: 1 });
  const v1 = devEl().getBoundingClientRect();
  const vf1 = fs(devEl().querySelector('.valtext'));
  // при size=1 дефолт не изменился: шрифт ровно прежние 0.45 * icon-size
  o.valDefaultKept = Math.abs(vf1 - iconPx * 0.45) < 0.75;
  await setMarker({ display: 'value', size: 2 });
  const v2 = devEl().getBoundingClientRect();
  const vf2 = fs(devEl().querySelector('.valtext'));
  o.valFontScales = vf2 / vf1 > 1.8 && vf2 / vf1 < 2.2;
  o.valPlateScales = (v2.height - 2) / (v1.height - 2) > 1.8 && (v2.height - 2) / (v1.height - 2) < 2.2
    && v2.width / v1.width > 1.6 && v2.width / v1.width < 2.4;

  // --- temp-плашка (.tval) рядом со значком ---
  await setMarker({ size: 1 });
  const t1 = devEl().querySelector('.value-badge').getBoundingClientRect();
  const tf1 = fs(devEl().querySelector('.value-badge'));
  // дефолт: line-height 0.68 * icon-size + рамка 1px×2
  o.tvalDefaultKept = Math.abs(t1.height - (iconPx * 0.68 + 2)) < 1;
  await setMarker({ size: 2 });
  const t2 = devEl().querySelector('.value-badge').getBoundingClientRect();
  const tf2 = fs(devEl().querySelector('.value-badge'));
  o.tvalScales = (t2.height - 2) / (t1.height - 2) > 1.8 && (t2.height - 2) / (t1.height - 2) < 2.2
    && tf2 / tf1 > 1.8 && tf2 / tf1 < 2.2;

  c._serverCfg.markers = c._serverCfg.markers.filter((m) => m.id !== 'd_temp');
  c._cfgEpoch++; c._regSignature = ''; c._maybeRebuildDevices();
  return o;
});
await finish(browser, checkAll(out2));
