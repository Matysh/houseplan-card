// HP-1551: opening the card with a saved per-space zoom must NOT paint even a
// single frame at the default fit ("the plan flashes and re-scales"). Repro of
// the field report: LS holds the config cache (instant render) and a saved
// zoom of 1.8, the server config arrives ~350 ms later like a real HA
// websocket round-trip. Every rAF frame from the first possible moment is
// sampled: a frame where the stage is visible AND the viewBox is at the
// default scale is the flash.
import { launch, watchPage, check, finish } from './serve.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url)) + '/srv';
const CT = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const ZOOM = 1.8;

// ---- phase 1: prime the config cache exactly the way production does ------
const { page, browser } = await launch();
await page.waitForFunction(() => !!localStorage.getItem('houseplan_card_cfg_v1'), null, { timeout: 9000 });
const cfgCaches = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage)
  .filter(key => key === 'houseplan_card_cfg_v1' || key.startsWith('houseplan_scoped_hint_v1:'))
  .map(key => [key, localStorage.getItem(key)])));
if (!Object.keys(cfgCaches).some(key => key.startsWith('houseplan_scoped_hint_v1:')))
  throw Error('Saved zoom fixture did not produce a trusted scoped hint');
// default fit width at zoom 1 (clean LS): the yardstick for "default scale"
const defaultFitW = await page.evaluate(() => window.__card._view.w);
await page.close();

// ---- phase 2: cold open with a saved zoom and a slow server ----------------
const ctx = await browser.newContext({ viewport: { width: 820, height: 760 } });
await ctx.route('**/*', (r) => {
  const u = new URL(r.request().url());
  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/demo.html';
  const f = ROOT + p;
  existsSync(f)
    ? r.fulfill({ status: 200, headers: { 'content-type': CT[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream' }, body: readFileSync(f) })
    : r.fulfill({ status: 404, body: 'nf' });
});
await ctx.addInitScript(([caches, zoom, targetW]) => {
  for (const [key, value] of Object.entries(caches)) localStorage.setItem(key, value);
  localStorage.setItem('houseplan_card_zoom_v1', JSON.stringify({ f1: zoom }));
  localStorage.removeItem('houseplan_card_nav_v1');
  window.__frames = [];
  const origCreate = Document.prototype.createElement;
  Document.prototype.createElement = function (tag, ...a) {
    const el = origCreate.call(this, tag, ...a);
    if (String(tag).toLowerCase() !== 'houseplan-card' || window.__hooked) return el;
    window.__hooked = true;
    // model the HA websocket latency: the config cache renders instantly,
    // the live config lands 350 ms later
    let proto = Object.getPrototypeOf(el), desc = null;
    while (proto && !desc) { desc = Object.getOwnPropertyDescriptor(proto, 'hass'); proto = Object.getPrototypeOf(proto); }
    if (desc?.set) {
      Object.defineProperty(el, 'hass', {
        configurable: true,
        get() { return desc.get.call(this); },
        set(v) {
          if (v && typeof v.callWS === 'function' && !v.__slow) {
            const orig = v.callWS.bind(v);
            v.__slow = true;
            v.callWS = (m) => (m && m.type === 'houseplan/config/get')
              ? new Promise((res) => setTimeout(() => res(orig(m)), 350))
              : orig(m);
          }
          desc.set.call(this, v);
        },
      });
    }
    // rAF sampling from the first possible moment (before the first paint)
    let measured = 0, settled = 0;
    const sample = () => {
      const sr = el.shadowRoot || el.renderRoot;
      const stage = sr && sr.querySelector('.stage');
      const svgEl = stage && stage.querySelector('.zoomwrap svg.plan-svg');
      if (stage && svgEl) {
        const r = stage.getBoundingClientRect();
        const vb = (svgEl.getAttribute('viewBox') || '').split(/\s+/).map(Number);
        let hidden = false;
        for (let node = svgEl; node && node !== stage.parentElement; node = node.parentElement) {
          const css = getComputedStyle(node);
          if (css.opacity === '0' || css.visibility === 'hidden' || css.display === 'none') { hidden = true; break; }
        }
        const painted = !!svgEl.querySelector('path, polygon, polyline, rect, circle, ellipse, line, image');
        const visible = painted && !hidden && r.width > 1 && r.height > 1;
        window.__frames.push({ visible, vbW: vb[2] || 0, zoom: el._zoom });
        measured++;
        settled = visible && Math.abs(vb[2] - targetW) < targetW * .02 ? settled + 1 : 0;
      } else {
        window.__frames.push(null);
        settled = 0;
      }
      // Keep every frame from creation while the actual boot settles, even on
      // a loaded runner. Neither hiding the scene nor an empty SVG can PASS.
      if (window.__frames.length < 360 && (window.__frames.length < 75 || measured <= 30 || settled < 5)) requestAnimationFrame(sample);
      else window.__framesDone = true;
    };
    requestAnimationFrame(sample);
    return el;
  };
}, [cfgCaches, ZOOM, defaultFitW / ZOOM]);

// #404: своя подписка печатала EXC2 мимо счётчика — страница считалась
// проверенной, а её исключения не видел никто. Теперь через общий гард.
const p2 = watchPage(await ctx.newPage());
await p2.goto('http://demo.local/demo.html', { waitUntil: 'domcontentloaded' });
await p2.waitForFunction(() => window.__framesDone === true, null, { timeout: 15000 });

const frames = await p2.evaluate(() => window.__frames);
const targetW = defaultFitW / ZOOM;
const seen = frames.filter(Boolean);
// the flash: stage visible while the viewBox is still at the default scale
// (clearly wider than the saved-zoom view; the default fit is 1.8x wider)
const flashFrames = seen.filter((f) => f.visible && f.vbW > targetW * 1.35);
const last = seen[seen.length - 1];
const goodFrames = seen.filter((f) => f.visible && Math.abs(f.vbW - targetW) < targetW * 0.02);

check('sampledFrames', seen.length > 30);
check('noDefaultScaleFlash', flashFrames.length === 0 ? true
  : `flash: ${flashFrames.length} visible frame(s) at default scale, e.g. vbW=${flashFrames[0].vbW.toFixed(3)} vs target ${targetW.toFixed(3)}`);
check('settledAtSavedZoom', !!last && last.visible && Math.abs(last.zoom - ZOOM) < 0.01
  && Math.abs(last.vbW - targetW) < targetW * 0.02);
check('planActuallyShown', goodFrames.length >= 5); // the fix must not just hide the plan forever
await finish(browser);
