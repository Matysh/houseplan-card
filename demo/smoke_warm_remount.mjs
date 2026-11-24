// DEV-B703-01: Lovelace re-creates card elements when the websocket reconnects
// after a long-backgrounded tab; the fresh instance used to run the whole
// first-open boot (veil + 700 ms + quiescence) — the owner's «план
// перезагружается при возврате на вкладку». Within one loaded page a repeat
// instance must open WARM: no veil, no wait, not a single frame at a stale
// stage height or a default zoom. A window resize between instances
// invalidates the memo → the full protective boot is back.
// FAILS on the build before DEV-B703-01 (every instance booted cold).
import { launch, check, finish } from './serve.mjs';
import { evaluateRetainedAction } from './helpers/retained-page-action.mjs';

const { page, browser } = await launch({ width: 820, height: 760 });

const res = await evaluateRetainedAction(page, async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  customElements.get('houseplan-card')?._warmBootReset?.(); // deterministic: the page starts cold
  localStorage.setItem('houseplan_card_zoom_v1', JSON.stringify({ f1: 1.8 }));
  localStorage.removeItem('houseplan_card_nav_v1');

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:0;top:0;width:800px;z-index:99;background:#000';
  document.body.appendChild(wrap);
  const mk = () => {
    const c = document.createElement('houseplan-card');
    c.setConfig({ type: 'custom:houseplan-card' });
    c.hass = window.__mkHass();
    wrap.appendChild(c);
    return c;
  };

  // ---- cold boot: the first instance pays the full protective window ----
  const c1 = mk();
  out.coldBoots = c1._booting === true;
  const t0 = performance.now();
  let statusSeen = false;
  while (c1._booting && performance.now() - t0 < 2500) {
    if ((c1.shadowRoot || c1.renderRoot).querySelector('.floor-preparation-status')) statusSeen = true;
    await sleep(30);
  }
  out.coldStatusSeen = statusSeen;
  out.coldSettled = c1._booting === false;
  await sleep(300); // fade out + soft grace start
  const stage1 = (c1.shadowRoot || c1.renderRoot).querySelector('.stage');
  const hFinal = stage1.clientHeight;
  const zoomSaved = c1._zoom;
  const sourceLayout = { stageH: hFinal, hdrH: c1._hdrH,
    memo: c1._warmSlot ? [c1._warmSlot.hdrH, c1._warmSlot.stageH] : null };
  out.zoomArmed = Math.abs(zoomSaved - 1.8) < 0.01;
  c1.remove(); // Lovelace throws the old element away…
  await sleep(30);

  // ---- …and creates a new one: same page, same viewport → WARM mount ----
  const c2 = mk();
  out.warmNoBootFlag = c2._booting === false; // decided synchronously in setConfig
  const sr2 = () => c2.shadowRoot || c2.renderRoot;
  const frames = [];
  const t1 = performance.now();
  await new Promise((done) => {
    const sample = () => {
      const stage = sr2().querySelector('.stage');
      if (stage) {
        const zw = stage.querySelector(':scope > .zoomwrap');
        frames.push({
          t: Math.round(performance.now() - t1),
          reveal: !!sr2().querySelector('[data-hp-startup-pending], [data-hp-startup-finish]'),
          planVisible: !!zw && getComputedStyle(zw).visibility === 'visible',
          rooms: stage.querySelectorAll('.room').length,
          previewShapes: stage.querySelector('[data-hp-cache-preview]')?.querySelectorAll('path, polygon, polyline, rect, circle, ellipse, line, image').length || 0,
          previewPassive: stage.dataset.hpFloorCache === 'preview'
            && !!zw?.hasAttribute('inert')
            && stage.querySelector('[data-hp-cache-preview]')?.getAttribute('aria-hidden') === 'true'
            && !stage.querySelector('[data-hp="device"], [data-hp="opening"], .roomlabel'),
          preparation: stage.dataset.hpFloorCache || '',
          stageH: stage.clientHeight,
          hdrH: c2._hdrH,
          memo: c2._warmSlot ? [c2._warmSlot.hdrH, c2._warmSlot.stageH] : null,
          zoom: c2._zoom,
        });
      }
      if (performance.now() - t1 < 900) requestAnimationFrame(sample);
      else done();
    };
    requestAnimationFrame(sample);
  });
  out.framesSampled = frames.length > 20;
  out.warmNoStartupReveal = !frames.some((f) => f.reveal);
  out.warmPlanVisibleEveryFrame = frames.length > 0 && frames.every((f) => f.planVisible)
    ? true : 'a frame hid the plan';
  const badH = frames.filter((f) => Math.abs(f.stageH - hFinal) > 2);
  out.warmNoStaleHeightFrame = badH.length === 0
    ? true : `source=${JSON.stringify(sourceLayout)}; frame=${JSON.stringify(badH[0])}; final=${JSON.stringify(frames.at(-1))}`;
  out.warmZoomEveryFrame = frames.every((f) => Math.abs(f.zoom - zoomSaved) < 0.01)
    ? true : 'a frame at a non-saved zoom';
  // the server config reload on a warm mount must not blank the plan
  // L1 uses plain architectural SVG, not interactive `.room` DOM. It is a
  // valid painted plan only when populated and strictly passive; an empty
  // preparation SVG still fails the original no-blank-frame guarantee.
  const hasPlan = f => f.rooms > 0 || f.previewShapes > 0 && f.previewPassive;
  out.warmNeverEmptyPlan = frames.every(hasPlan) ? true
    : `a frame rendered no architecture: ${JSON.stringify(frames.filter(f => !hasPlan(f)).slice(0, 4))}`;
  out.warmPreviewNeverExposesLiveLayers = frames.filter(f => f.previewShapes > 0).every(f => f.previewPassive);
  c2.remove();
  wrap.remove();
  return out;
}, 'cold and warm remount frames');
for (const [k, v] of Object.entries(res)) check(k, v);

// ---- a window resize between instances → memo stale → the full boot ----
await page.setViewportSize({ width: 900, height: 680 });
// #1160: retain the CDP action itself through a handle until result transfer.
// A window-owned inner promise does not retain CDP's pending evaluation.
const rez = await evaluateRetainedAction(page, async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const c = document.createElement('houseplan-card');
  c.setConfig({ type: 'custom:houseplan-card' });
  c.hass = window.__mkHass();
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:0;top:0;width:800px;z-index:99;background:#000';
  wrap.appendChild(c);
  document.body.appendChild(wrap);
  out.resizedBootsCold = c._booting === true;
  const sr = () => c.shadowRoot || c.renderRoot;
  const t0 = performance.now();
  let veil = false;
  while (c._booting && performance.now() - t0 < 2500) {
    if (sr().querySelector('.floor-preparation-status')) veil = true;
    await sleep(30);
  }
  out.resizedStatusShown = veil;
  out.resizedSettles = c._booting === false;
  wrap.remove();
  return out;
}, 'resized remount cold boot');
for (const [k, v] of Object.entries(rez)) check(k, v);

await finish(browser, { ...res, ...rez });
