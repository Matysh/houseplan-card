import { launch } from './serve.mjs';
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
  // кнопка "+" по-прежнему только в Плане
  out.noAddInView = !sr().querySelector('.tab.tabadd');
  c._setMode('plan'); await c.updateComplete;
  out.addInPlan = !!sr().querySelector('.tab.tabadd');
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
