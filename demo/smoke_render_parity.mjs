// HP-1454-07: статическая карточка строит модель другой функцией, и room.settings
// в неё не переносились — переопределение заливки на уровне комнаты она
// игнорировала и красила комнату, которую полная карточка оставляет прозрачной.
// Плюс HP-1454-08: layout-события должны доходить до статической карточки без
// перезагрузки страницы.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 900 }, 1);
const res = await page.evaluate(async () => {
  const out = {};
  await customElements.whenDefined('houseplan-space-card');
  const main = window.__card;

  // заливка по свету на пространстве, у первой комнаты — переопределение "none"
  const cfg = JSON.parse(JSON.stringify(main._serverCfg));
  const f1 = cfg.spaces.find((s) => s.id === 'f1');
  f1.settings = { ...(f1.settings || {}), show_borders: true, show_names: true, fill_mode: 'light' };
  f1.rooms[0].settings = { fill_mode: 'none' };
  const hass = { ...main.hass, callWS: async (m) => {
    if (m.type === 'houseplan/config/get') return { config: cfg, rev: 1 };
    if (m.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
    return { ok: true };
  } };

  main._serverCfg = cfg;
  main._cfgEpoch++;
  main.requestUpdate(); await main.updateComplete;

  const host = document.createElement('div');
  document.body.appendChild(host);
  const card = document.createElement('houseplan-space-card');
  card.setConfig({ type: 'custom:houseplan-space-card', space: 'f1' });
  card.hass = hass;
  host.appendChild(card);
  const t0 = Date.now();
  while (!card.renderRoot?.querySelector('.hp-static-stage') && Date.now() - t0 < 6000) {
    await new Promise((r) => setTimeout(r, 60));
  }
  await card.updateComplete;

  const overridden = (root) => {
    const rooms = [...root.querySelectorAll('.room')];
    return rooms.length ? ((rooms[0].getAttribute('style') || '').match(/--room-fill:([^;]+)/) || [])[1] || null : 'missing';
  };

  out.fullCardRoom0 = overridden(main.shadowRoot || main.renderRoot);
  out.staticCardRoom0 = overridden(card.renderRoot);
  out.parity = out.fullCardRoom0 === out.staticCardRoom0;
  out.overrideRespected = out.staticCardRoom0 === 'transparent';

  // Owner 2026-08-04: «углы границ комнат всё ещё с зубцами» — a miter join
  // spikes far past a sharp corner (and bevels it flat once past the miter
  // limit). Room borders join ROUND now, and BOTH renderers share the rule:
  // the styles live in one cardStyles, and this is the smoke that keeps it so.
  const joins = (root) => [...root.querySelectorAll('.room')]
    .map((el) => getComputedStyle(el).strokeLinejoin);
  const fullJoins = joins(main.shadowRoot || main.renderRoot);
  const staticJoins = joins(card.renderRoot);
  out.fullCardBordersRound = fullJoins.length > 0 && fullJoins.every((j) => j === 'round');
  out.staticCardBordersRound = staticJoins.length > 0 && staticJoins.every((j) => j === 'round');
  // the trimmed outline of a room with open boundaries is a set of separate
  // subpaths: its CAPS are the corners, so they must be round as well
  const f1cfg = cfg.spaces.find((s) => s.id === 'f1');
  f1cfg.rooms[0].open_to = [f1cfg.rooms[1].id];
  main._cfgEpoch++;
  main.requestUpdate(); await main.updateComplete;
  const outlines = [...(main.shadowRoot || main.renderRoot).querySelectorAll('.room-outline')];
  out.trimmedOutlineDrawn = outlines.length > 0;
  out.trimmedOutlineRound = outlines.every((el) => {
    const cs = getComputedStyle(el);
    return cs.strokeLinejoin === 'round' && cs.strokeLinecap === 'round';
  });

  return out;
});
// зафиксировано прогоном на v1.46.0 и сверено с кодом
checkAll(res, {
  fullCardRoom0: 'transparent',
  staticCardRoom0: 'transparent',
  parity: true,
  overrideRespected: true,
});
await finish(browser);
