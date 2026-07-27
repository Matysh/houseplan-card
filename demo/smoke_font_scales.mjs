import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const spId = c._space;
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== spId ? s : ({
    ...s, settings: { ...(s.settings || {}), show_names: true, label_temp: true } })) };
  c._setMode('view'); c.requestUpdate(); await c.updateComplete;
  await new Promise((r) => setTimeout(r, 100));
  const lbl = () => sr().querySelector('.roomlabel');
  const nameSize = () => parseFloat(getComputedStyle(lbl().querySelector('.rlname')).fontSize);
  const metaEl = () => lbl().querySelector('.rlmetrics');
  const n0 = nameSize();
  const m0 = metaEl() ? parseFloat(getComputedStyle(metaEl()).fontSize) : null;
  out.baseline = n0 > 0;
  // 1) пер-комнатный name_scale ×2 — имя удвоилось, подписи нет
  const room = c._curSpaceCfg.rooms.find((r) => r.name && r.area);
  room.settings = { ...(room.settings || {}), name_scale: 2 };
  c.requestUpdate(); await c.updateComplete;
  const lblR = [...sr().querySelectorAll('.roomlabel')].find((l) => l.textContent.includes(room.name));
  const n1 = parseFloat(getComputedStyle(lblR.querySelector('.rlname')).fontSize);
  out.nameDoubled = Math.abs(n1 / n0 - 2) < 0.05;
  const meta1 = lblR.querySelector('.rlmetrics');
  out.metaUntouched = meta1 ? Math.abs(parseFloat(getComputedStyle(meta1).fontSize) - m0) < 0.5 : 'no-meta';
  // 2) label_scale ×2 — подписи удвоились
  room.settings.label_scale = 2;
  c.requestUpdate(); await c.updateComplete;
  const meta2 = lblR.querySelector('.rlmetrics');
  out.metaDoubled = meta2 && m0 ? Math.abs(parseFloat(getComputedStyle(meta2).fontSize) / m0 - 2) < 0.05 : 'no-meta';
  // 3) базовый множитель пространства ×1.5 — умножает всё
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== spId ? s : ({
    ...s, settings: { ...(s.settings || {}), card_font_scale: 1.5 } })) };
  c.requestUpdate(); await c.updateComplete;
  const lblR2 = [...sr().querySelectorAll('.roomlabel')].find((l) => l.textContent.includes(room.name));
  const n2 = parseFloat(getComputedStyle(lblR2.querySelector('.rlname')).fontSize);
  out.spaceMultiplies = Math.abs(n2 / n0 - 3) < 0.1; // 2 × 1.5
  // 4) диалог комнаты: слайдеры + живой пример реагирует
  c._setMode('plan'); await c.updateComplete;
  const model = c._spaceModel().rooms.find((r) => r.id === room.id);
  c._openRoomEdit(model); await c.updateComplete;
  out.slidersPrefilled = c._roomNameScale === 2 && c._roomLabelScale === 2;
  const pv = () => sr().querySelector('.cardpreview .cpname');
  const p0 = parseFloat(pv().style.fontSize);
  c._roomNameScale = 1; c.requestUpdate(); await c.updateComplete;
  const p1 = parseFloat(pv().style.fontSize);
  out.previewLive = Math.abs(p0 / p1 - 2) < 0.05;
  c._roomDialogCancel(); await c.updateComplete;
  // 5) превью есть и в диалоге пространства
  c._openSpaceDialog('edit', spId); await c.updateComplete;
  out.spacePreview = !!sr().querySelector('.cardpreview');
  out.spaceSlider = [...sr().querySelectorAll('.dialog label')].some((l) => l.textContent === c._t('space.card_font'));
  c._spaceDialog = null; await c.updateComplete;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
