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
  o.editorSeesWholeCanvas = inPlan[2] === 1000 && inPlan[3] === 1000;
  const v = c._viewOr(c._baseVb());
  o.editorViewCoversCanvas = v.w >= 999; // старый cropped view не пережил смену
  // в редакторе можно ткнуть в дальний угол холста
  o.canReachFarCorner = (() => {
    const stage = (c.shadowRoot || c.renderRoot).querySelector('.stage');
    const pt = c._screenToVb(stage.clientWidth - 1, stage.clientHeight - 1);
    return pt[0] > 900 || pt[1] > 900;
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
