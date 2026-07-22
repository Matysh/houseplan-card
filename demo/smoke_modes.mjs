// UX modes shell (v1.25.0): view is display-only; plan/devices gate the tools.
import { launch } from './serve.mjs';
const { page, browser } = await launch();
const out = {};
const q = (sel) => page.evaluate((s) => (window.__card.shadowRoot || window.__card.renderRoot).querySelectorAll(s).length, sel);
const st = () => page.evaluate(() => {
  const c = window.__card;
  const sr = c.shadowRoot || c.renderRoot;
  return {
    mode: c._mode,
    modeTabs: sr.querySelectorAll('.modetab').length,
    active: sr.querySelector('.modetab.active')?.textContent.trim(),
    editBtns: sr.querySelectorAll('.head .btn:not(.zb)').length,
    gears: sr.querySelectorAll('.tabedit').length,
    markupBar: !!sr.querySelector('.editbar'),
    stageClass: sr.querySelector('.stage').className,
  };
});
// 1) старт: view, чистая шапка
out.start = await st();
// 2) drag в view ничего не двигает и не мешает пану
await page.evaluate(() => {
  const c = window.__card;
  const d = c._devices.find((x) => x.space === 'f1');
  const before = { ...c._pos(d) };
  c._pointerDown({ preventDefault(){}, clientX: 10, clientY: 10, target: { setPointerCapture(){} }, pointerId: 1 }, d);
  c._pointerMove({ clientX: 90, clientY: 60 }, d);
  c._pointerUp({}, d);
  const after = { ...c._pos(d) };
  window.__viewDragMoved = Math.abs(after.x - before.x) + Math.abs(after.y - before.y) > 0.5;
  clearTimeout(c._holdTimer);
});
out.viewDragMoved = await page.evaluate(() => window.__viewDragMoved);
// long-press в view открывает инфо
await page.evaluate(async () => {
  const c = window.__card;
  const d = c._devices.find((x) => x.space === 'f1');
  c._pointerDown({ preventDefault(){}, clientX: 10, clientY: 10, target: { setPointerCapture(){} }, pointerId: 2 }, d);
  await new Promise((r) => setTimeout(r, 700));
});
out.viewHoldInfo = await page.evaluate(() => { const r = !!window.__card._infoCard; window.__card._infoCard = null; window.__card._holdFired = false; return r; });
// 3) режим План
await page.evaluate(() => window.__card._setMode('plan'));
await page.waitForTimeout(200);
out.plan = await st();
out.planIconsHidden = await page.evaluate(() => {
  const sr = window.__card.shadowRoot || window.__card.renderRoot;
  const dev = sr.querySelector('.dev');
  return dev ? getComputedStyle(dev).display === 'none' : 'no-dev';
});
// 4) режим Устройства: drag работает, клик открывает редактор
await page.evaluate(() => window.__card._setMode('devices'));
await page.waitForTimeout(200);
out.devices = await st();
out.devDragWorks = await page.evaluate(() => {
  const c = window.__card;
  const d = c._devices.find((x) => x.space === 'f1');
  const before = { ...c._pos(d) };
  c._pointerDown({ preventDefault(){}, clientX: 10, clientY: 10, target: { setPointerCapture(){} }, pointerId: 3 }, d);
  c._pointerMove({ clientX: 100, clientY: 70 }, d);
  c._pointerUp({}, d);
  const after = { ...c._pos(d) };
  return Math.abs(after.x - before.x) + Math.abs(after.y - before.y) > 0.5;
});
out.devClickOpensEditor = await page.evaluate(async () => {
  const c = window.__card;
  c._drag = null;
  const d = c._devices.find((x) => x.space === 'f1');
  c._clickDevice({ stopPropagation(){} }, d);
  await c.updateComplete;
  const r = !!c._markerDialog;
  c._markerDialog = null;
  return r;
});
// 5) назад в view
await page.evaluate(() => window.__card._setMode('view'));
out.backToView = (await st()).mode;
console.log(JSON.stringify(out, null, 1));
await browser.close();
