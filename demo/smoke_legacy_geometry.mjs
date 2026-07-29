// HP-1503-01: один и тот же повреждённый store обязан рендериться одинаково в
// ОБЕИХ карточках. Полная карточка строила модель рукописной копией
// spaceModels и прошла мимо safeViewBox/normRect: статическая показывала
// восстановленный план, полная — viewBox="0 0 0 0" и rect с отрицательной
// шириной. Вектор аудита исполняется через обе модели и оба DOM-дерева.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 900 }, 1);
const res = await page.evaluate(async () => {
  const out = {};
  await customElements.whenDefined('houseplan-space-card');
  const main = window.__card;

  // ровно вектор из отчёта: нулевой viewport + отрицательный legacy-rect
  const cfg = JSON.parse(JSON.stringify(main._serverCfg));
  const f1 = cfg.spaces.find((s) => s.id === 'f1');
  f1.plan_url = null; f1.plan_aspect = null;
  f1.view_box = [0, 0, 0, 0];
  f1.rooms = [{ id: 'r1', name: 'R', area: 'living_room', x: 0.6, y: 0.7, w: -0.2, h: -0.3 }];
  f1.settings = { ...(f1.settings || {}), show_borders: true };
  const hass = { ...main.hass, callWS: async (m) => {
    if (m.type === 'houseplan/config/get') return { config: cfg, rev: 1 };
    if (m.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
    return { ok: true };
  } };

  main._serverCfg = cfg;
  main._cfgEpoch++;
  main._view = null;
  main.requestUpdate(); await main.updateComplete;
  await new Promise((r) => setTimeout(r, 150));

  // модель полной карточки: fallback на весь холст + нормализованный rect
  const m = main._spaceModel('f1');
  out.fullVbFallsBack = JSON.stringify(m.vb) === JSON.stringify([0, 0, 1000, 1000]);
  const r = m.rooms[0];
  out.fullRectNormalised =
    Math.round(r.x) === 400 && Math.round(r.y) === 400
    && Math.round(r.w) === 200 && Math.round(r.h) === 300;

  // DOM полной карточки: конечный положительный viewBox, никаких минусов в rect
  const svg = (main.shadowRoot || main.renderRoot).querySelector('.stage svg');
  const vbAttr = (svg?.getAttribute('viewBox') || '').split(/\s+/).map(Number);
  out.fullDomViewBoxSane = vbAttr.length === 4 && vbAttr[2] > 0 && vbAttr[3] > 0;
  const rect = (main.shadowRoot || main.renderRoot).querySelector('.stage svg rect.room, .stage svg .room rect, .stage svg rect[width]');
  out.fullDomRectSane = !rect || (Number(rect.getAttribute('width')) >= 0 && Number(rect.getAttribute('height')) >= 0);

  // статическая карточка того же store — паритет
  const host = document.createElement('div');
  document.body.appendChild(host);
  const card = document.createElement('houseplan-space-card');
  card.setConfig({ type: 'custom:houseplan-space-card', space: 'f1' });
  card.hass = hass;
  host.appendChild(card);
  const t0 = Date.now();
  while (!card.renderRoot?.querySelector('svg') && Date.now() - t0 < 6000) {
    await new Promise((r2) => setTimeout(r2, 60));
  }
  await card.updateComplete;
  const svb = (card.renderRoot.querySelector('svg')?.getAttribute('viewBox') || '').split(/\s+/).map(Number);
  out.staticDomViewBoxSane = svb.length === 4 && svb[2] > 0 && svb[3] > 0;
  out.parity = JSON.stringify(vbAttr.length === 4 && svb.length === 4
    ? [vbAttr[2] > 0, vbAttr[3] > 0] : null) === JSON.stringify([svb[2] > 0, svb[3] > 0]);
  return out;
});
await finish(browser, checkAll(res));
