// Аудит v1.49.0: HP-1490-03 (редакторы видят весь холст) и HP-1490-04
// (Save ждёт пропорции выбранного сохранённого плана, старые не наследуются).
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 1000 }, 1);
const out = {};

// ---- HP-1490-03: content-fit только в просмотре -------------------------
Object.assign(out, await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  // рукописное пространство: одна маленькая комната в центре квадрата
  const cfg = JSON.parse(JSON.stringify(c._serverCfg));
  cfg.spaces[0].plan_url = null; cfg.spaces[0].plan_aspect = null;
  cfg.spaces[0].rooms = [{ id: 'r1', name: 'One', area: 'living_room',
    poly: [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]] }];
  c._serverCfg = cfg; c._model = null; c._view = null; c.requestUpdate();
  await c.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const inView = c._baseVb();
  o.viewIsContentFit = inView[2] < 999; // меньше холста (устройства тоже содержимое)
  c._setMode('plan'); await c.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const inPlan = c._baseVb();
  // docs/CANVAS.md: холста-квадрата больше нет, поэтому «редактор видит весь
  // холст» переписано в исходное НАМЕРЕНИЕ HP-1490-03 — «в редакторе есть куда
  // рисовать наружу». Рамка теперь по содержимому и в редакторе тоже, а место
  // даёт запас панорамирования (§5) и зум-аут до 3x.
  o.editorFrameIsContent = inPlan[2] < 999 && inPlan[2] > 0;
  o.editorCanPanPastContent = (() => {
    const fit = c._viewOr(c._baseVb());
    const moved = c._clampView({ x: fit.x + fit.w * 0.9, y: fit.y, w: fit.w, h: fit.h }, fit);
    return moved.x > fit.x + fit.w * 0.5; // ушли почти на экран вправо, зажима нет
  })();
  o.editorZoomOutGivesRoom = (() => {
    c._resetZoom(); c._applyView(1 / 3);
    const wide = c._view.w; c._resetZoom();
    return wide > inPlan[2] * 2.5; // видно втрое больше, чем нарисовано
  })();
  const v = c._viewOr(c._baseVb());
  // в редакторе можно ткнуть в дальний угол холста
  o.canReachFarCorner = (() => {
    const stage = (c.shadowRoot || c.renderRoot).querySelector('.stage');
    const pt = c._screenToVb(stage.clientWidth - 1, stage.clientHeight - 1);
    return pt[0] > inPlan[0] + inPlan[2] * 0.9 || pt[1] > inPlan[1] + inPlan[3] * 0.9;
  })();
  c._setMode('view'); await c.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  const back = c._baseVb();
  o.contentFitRestored = back[2] < 999;
  return o;
}));

// ---- HP-1490-04: Save ждёт aspect --------------------------------------
Object.assign(out, await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const base = c.hass.callWS;
  let saved = null;
  let signDelay = 500; // подпись приходит поздно
  c.hass = { ...c.hass, callWS: async (m) => {
    if (m.type === 'houseplan/plans/list') return { plans: [
      { name: 'wide.svg', url: '/api/houseplan/content/plans/_/wide.svg', size: 10, modified: 1, used_by: [] },
    ] };
    if (m.type === 'houseplan/content/sign') {
      await new Promise((r) => setTimeout(r, signDelay));
      const urls = {}; for (const p of m.paths) urls[p] = '/assets/wide.svg'; return { urls };
    }
    if (m.type === 'houseplan/config/set') { saved = m.config; return { rev: (c._cfgRev || 0) + 1 }; }
    if (m.type === 'houseplan/config/get') return { config: saved || c._serverCfg, rev: c._cfgRev || 0 };
    return base(m);
  } };
  // страница отдаёт /assets/wide.svg размером 800x200 (создан рядом)
  c._openSpaceDialog('edit', 'f1'); await c.updateComplete;
  c._spaceDialog = { ...c._spaceDialog, source: 'file', planUrl: null, planFile: null };
  await c.updateComplete;
  c._useServerPlan('/api/houseplan/content/plans/_/wide.svg');
  o.oldAspectCleared = c._spaceDialog.savedAspect === undefined;
  // Save сразу, до прихода подписи
  const p = c._saveSpaceDialog();
  await p;
  o.savedUrl = saved?.spaces?.[0]?.plan_url === '/api/houseplan/content/plans/_/wide.svg';
  const a = saved?.spaces?.[0]?.plan_aspect;
  o.savedAspectIsReal = Math.abs((a || 0) - 4) < 0.01; // 800x200
  o.notTheOldAspect = a !== 1.25;
  return o;
}));

await finish(browser, checkAll(out));
