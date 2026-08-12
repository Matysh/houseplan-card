// UX modes shell (v1.25.0): view is display-only; plan/devices gate the tools.
import { launch, checkAll, finish } from './serve.mjs';
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
    // The last bar stays mounted for the exit animation; only an open chrome
    // is an active/visible editor bar.
    markupBar: !!sr.querySelector('.editorchrome.open .editbar'),
    // hpsettle is the transient post-boot grace (AUD-1552-02), not a mode class
    stageClass: sr.querySelector('.stage').className.replace(/ ?\bhpsettle\b/, ''),
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
await page.waitForFunction(() => window.__card._modeTransitionBusy === false);
out.plan = await st();
out.planIconsHidden = await page.evaluate(() => {
  const sr = window.__card.shadowRoot || window.__card.renderRoot;
  const dev = sr.querySelector('.dev');
  return dev ? getComputedStyle(dev).display === 'none' : 'no-dev';
});
// 4) режим Устройства: drag работает, клик открывает редактор
await page.evaluate(() => window.__card._setMode('devices'));
await page.waitForFunction(() => window.__card._modeTransitionBusy === false);
out.devices = await st();
out.devDragWorks = await page.evaluate(async () => {
  const c = window.__card;
  const d = c._devices.find((x) => x.space === 'f1');
  const before = { ...c._pos(d) };
  c._pointerDown({ preventDefault(){}, clientX: 10, clientY: 10, target: { setPointerCapture(){} }, pointerId: 3 }, d);
  c._pointerMove({ clientX: 100, clientY: 70 }, d);
  c._pointerUp({}, d);
  await c.updateComplete;
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
await page.waitForFunction(() => window.__card._modeTransitionBusy === false);
out.backToView = (await st()).mode;
// значения зафиксированы прогоном на v1.43.1 и сверены с кодом (audit T1)
checkAll(out, {
  "start": {"mode": "view", "modeTabs": 3, "editBtns": 1, "gears": 2, "markupBar": false, "stageClass": "stage    mode-view"},
  "viewDragMoved": false,
  "plan": {"mode": "plan", "modeTabs": 3, "active": "Plan editor", "editBtns": 1, "gears": 2, "markupBar": true, "stageClass": "stage markup tool-draw   mode-plan"},
  "devices": {"mode": "devices", "modeTabs": 3, "active": "Device editor", "editBtns": 1, "gears": 2, "markupBar": true, "stageClass": "stage    mode-devices"},
  "backToView": "view",
});
await finish(browser, out);
