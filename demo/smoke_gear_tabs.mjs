import { launch, check, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const gears = () => sr().querySelectorAll('.tab .tabedit').length;
  // шестерёнки видны во всех трёх режимах
  out.viewGears = gears() > 0;
  c._setMode('plan'); await c.updateComplete;
  out.planGears = gears() > 0;
  c._setMode('devices'); await c.updateComplete;
  out.devGears = gears() > 0;
  c._setMode('view'); await c.updateComplete;
  // выравнивание: центр иконки ~ центру текста таба
  const tab = sr().querySelector('.tab');
  const icon = tab.querySelector('.tabedit');
  const tb = tab.getBoundingClientRect(), ib = icon.getBoundingClientRect();
  const tabMid = tb.top + tb.height / 2, iconMid = ib.top + ib.height / 2;
  out.alignDelta = Math.abs(tabMid - iconMid);
  out.aligned = out.alignDelta <= 1.5;
  // клик по шестерёнке в Просмотре открывает диалог пространства и не переключает таб
  const cur = c._space;
  icon.click(); await c.updateComplete;
  out.dialogOpens = !!c._spaceDialog;
  out.tabNotSwitched = c._space === cur;
  c._spaceDialog = null; await c.updateComplete;
  // «+» — навигационное действие, а не инструмент редактора плана
  // (владелец 2026-08-04): кнопка есть во ВСЕХ режимах и кликабельна.
  const addBtn = () => sr().querySelector('.tab.tabadd');
  const hittable = () => {
    const b = addBtn();
    if (!b) return 'нет кнопки';
    const r = b.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return `кнопка ${r.width}x${r.height}px`;
    const hit = sr().elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit && hit.closest && hit.closest('.tab.tabadd') === b ? true : 'перекрыта';
  };
  out.addInView = hittable();
  for (const m of ['plan', 'devices', 'decor']) {
    c._setMode(m); await c.updateComplete;
    out['addIn_' + m] = hittable();
  }
  c._setMode('view'); await c.updateComplete;
  // …и открывает именно диалог СОЗДАНИЯ
  const b0 = addBtn();
  if (b0) { b0.click(); await c.updateComplete; }
  out.addOpensCreate = !!c._spaceDialog && c._spaceDialog.mode === 'create';
  c._spaceDialog = null; await c.updateComplete;
  return out;
});
// значения зафиксированы прогоном на v1.43.1 и сверены с кодом (audit T1)
checkAll(res, {
  "alignDelta": 0,
});

// киоск — витрина: редактирование недоступно, кнопки «+» нет ВООБЩЕ
// (display:none у .hdr не считается: скрытый в DOM узел всё ещё кликабелен
// программно и всё ещё ловится автотестами как «есть»)
const kio = await page.evaluate(async () => {
  const out = {};
  const c = document.createElement('houseplan-card');
  c.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0 });
  c.hass = window.__mkHass();
  c.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:700px;z-index:99';
  document.body.appendChild(c);
  await new Promise((r) => setTimeout(r, 350));
  c.hass = { ...c.hass }; await c.updateComplete;
  const sr = c.shadowRoot || c.renderRoot;
  out.kioskNoAddButton = !sr.querySelector('.tab.tabadd');
  c.remove();
  return out;
});
for (const [k, v] of Object.entries(kio)) check(k, v);

// мобильный вид: ряд вкладок переносится, а не выезжает за карточку
await page.setViewportSize({ width: 390, height: 760 });
const narrow = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  await new Promise((r) => setTimeout(r, 250));
  c.requestUpdate(); await c.updateComplete;
  const sr = c.shadowRoot || c.renderRoot;
  const head = sr.querySelector('.head');
  const btn = sr.querySelector('.tab.tabadd');
  out.narrowAddPresent = !!btn;
  out.narrowNoHOverflow = head.scrollWidth <= head.clientWidth + 1
    ? true : `scrollW=${head.scrollWidth} > clientW=${head.clientWidth}`;
  const cr = sr.querySelector('ha-card').getBoundingClientRect();
  const br = btn ? btn.getBoundingClientRect() : null;
  out.narrowAddInsideCard = !br ? 'нет кнопки'
    : br.right <= cr.right + 1 && br.left >= cr.left - 1 ? true
    : `btn ${Math.round(br.left)}..${Math.round(br.right)} vs card ${Math.round(cr.left)}..${Math.round(cr.right)}`;
  out.narrowAddHittable = !br ? 'нет кнопки' : (() => {
    const hit = sr.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
    return hit && hit.closest && hit.closest('.tab.tabadd') === btn ? true : 'перекрыта';
  })();
  return out;
});
for (const [k, v] of Object.entries(narrow)) check(k, v);

await finish(browser, { ...res, ...kio, ...narrow });
