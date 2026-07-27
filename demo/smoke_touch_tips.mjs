import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
// эмуляция тач-устройства: переопределяем matchMedia ДО загрузки бандла
await page.addInitScript(() => {
  const orig = window.matchMedia.bind(window);
  window.matchMedia = (q) => q.includes('hover: none')
    ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }
    : orig(q);
});
await page.reload();
await page.waitForFunction(() => window.__card && window.__card._devices?.length, null, { timeout: 15000 });
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  c._setMode('view'); await c.updateComplete;
  // "тап" по комнате → mousemove-эмуляция → тултип НЕ должен появиться
  c._showTip(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }), 'Room', 'meta');
  await c.updateComplete;
  out.noTipOnTouch = c._tip === null || c._tip === undefined || !c._tip;
  return out;
});
checkAll(res);
await finish(browser, res);
