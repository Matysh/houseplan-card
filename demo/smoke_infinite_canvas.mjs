// Infinite canvas (docs/CANVAS.md): a plan drawn far past the old unit square
// renders whole, devices can be placed and saved out there, the opening view
// follows the content, one far stray neither breaks the view nor hides itself,
// zoom-out stops at 3x the content and the icons keep their proportion to it.
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { launch, check, checkAll, finish } from './serve.mjs';

const SHOTS = process.env.HP_SHOTS || '';
const { page, browser } = await launch({ width: 900, height: 820 }, 1);
const out = {};
const raf = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

// A hand-drawn plan whose rooms live at 1.5..3.0 — entirely outside the old
// canvas. Before the infinite canvas the -25%..125% envelope threw every one
// of these vertices away and the card framed empty space.
const FAR_CFG = {
  spaces: [{
    id: 'f1', title: 'Ground floor', view_box: [0, 0, 1, 1], plan_url: null, plan_aspect: null,
    rooms: [
      { id: 'r1', name: 'Living room', area: 'living_room',
        poly: [[1.5, 1.5], [2.2, 1.5], [2.2, 2.2], [1.5, 2.2]] },
      { id: 'r2', name: 'Kitchen', area: 'kitchen',
        poly: [[2.2, 1.5], [3.0, 1.5], [3.0, 2.0], [2.2, 2.0]] },
      { id: 'r3', name: 'Bedroom', area: 'bedroom',
        poly: [[2.2, 2.0], [3.0, 2.0], [3.0, 2.6], [2.2, 2.6]] },
      { id: 'r4', name: 'Hallway', area: 'hallway',
        poly: [[1.5, 2.2], [2.2, 2.2], [2.2, 2.6], [1.5, 2.6]] },
    ],
    openings: [{ id: 'o1', type: 'window', x: 1.8, y: 1.5, angle: 0, length: 0.15 }],
    decor: [{ id: 'd1', kind: 'line', x1: 1.4, y1: 2.7, x2: 3.1, y2: 2.7, color: '#8899aa' }],
  }, {
    id: 'garden', title: 'Garden', view_box: [0, 0, 1, 1],
    rooms: [{ id: 'g1', name: 'Garden', area: 'garden',
      poly: [[0.03, 0.178], [0.97, 0.178], [0.97, 0.822], [0.03, 0.822]] }],
  }],
  markers: [], settings: {},
};
const FAR_LAYOUT = {
  d_light1: { s: 'f1', x: 1.7, y: 1.7 }, d_lamp: { s: 'f1', x: 2.0, y: 1.9 },
  d_tv: { s: 'f1', x: 1.6, y: 2.1 }, d_temp: { s: 'f1', x: 1.9, y: 1.6 },
  d_kettle: { s: 'f1', x: 2.5, y: 1.7 }, d_leak: { s: 'f1', x: 2.9, y: 1.8 },
  d_bedlight: { s: 'f1', x: 2.6, y: 2.3 }, d_window: { s: 'f1', x: 2.9, y: 2.5 },
  d_lock: { s: 'f1', x: 1.6, y: 2.5 }, d_motion: { s: 'f1', x: 2.0, y: 2.4 },
};

const loadFar = (cfg, layout) => page.evaluate(async ([c2, l2]) => {
  const c = window.__card;
  c._serverCfg = JSON.parse(JSON.stringify(c2));
  c._layout = JSON.parse(JSON.stringify(l2));
  c._modelCache = null;
  c._frame = null;
  c._showFar = false;
  c._space = 'f1';
  c._maybeRebuildDevices?.();
  c._defPos = c._defaultPositions();
  c._view = null;
  c._zoom = 1;
  c.requestUpdate();
  await c.updateComplete;
  c._resetZoom();
  await c.updateComplete;
}, [cfg, layout]);

await loadFar(FAR_CFG, FAR_LAYOUT);
await raf();

// ---- (b) the plan past the old square renders WHOLE ----------------------
Object.assign(out, await page.evaluate(() => {
  const c = window.__card;
  const o = {};
  const b = c._baseVb();
  // the content is 1500..3000 x 1500..2700 render units, plus decor/openings
  o.frameHoldsFarPlan = b[0] < 1450 && b[0] + b[2] > 3050 && b[1] < 1450 && b[1] + b[3] > 2750;
  o.frameIsNotTheOldSquare = b[0] > 1000; // nothing is framed at the origin any more
  const v = c._viewOr(b);
  o.viewShowsFarPlan = v.x <= 1500 && v.x + v.w >= 3000;
  // every room polygon is inside the painted viewBox
  const sr = c.shadowRoot || c.renderRoot;
  const polys = [...sr.querySelectorAll('polygon.room')];
  o.allRoomsDrawn = polys.length === 4;
  const st = sr.querySelector('.stage').getBoundingClientRect();
  o.roomsOnScreen = polys.every((p) => {
    const r = p.getBoundingClientRect();
    return r.width > 4 && r.height > 4 && r.left >= st.left - 2 && r.right <= st.right + 2
      && r.top >= st.top - 2 && r.bottom <= st.bottom + 2;
  });
  // and the markers landed on the plan, not in a corner of a phantom canvas
  const devs = [...sr.querySelectorAll('.devlayer .dev')];
  o.markersOnPlan = devs.length >= 10 && devs.every((d) => {
    const r = d.getBoundingClientRect();
    return r.left >= st.left - 2 && r.right <= st.right + 2 && r.top >= st.top - 2 && r.bottom <= st.bottom + 2;
  });
  return o;
}));

// ---- a device can be PLACED past the old square, and it saves -------------
const ws = await page.evaluate(async () => {
  const c = window.__card;
  const sent = [];
  const base = c.hass.callWS;
  c.hass = { ...c.hass, callWS: async (m) => { sent.push(m); return base(m); } };
  // drop a virtual marker at 3.4 / 2.9 — a long way outside the old canvas
  const far = { s: 'f1', x: 3.4, y: 2.9 };
  c._layout = { ...c._layout, d_gate: far };
  c._dirtyPos.add('d_gate');
  await c._persistLayout?.();
  // and a room extended even further out, saved through the config writer
  const cfg = JSON.parse(JSON.stringify(c._serverCfg));
  cfg.spaces[0].rooms.push({ id: 'r5', name: 'Workshop',
    poly: [[3.1, 2.0], [3.8, 2.0], [3.8, 2.6], [3.1, 2.6]] });
  c._serverCfg = cfg; c._modelCache = null; c._frame = null;
  await c._saveConfig?.();
  await new Promise((r) => setTimeout(r, 700));
  return { sent: JSON.parse(JSON.stringify(sent)), layout: JSON.parse(JSON.stringify(c._layout)) };
});
out.farDeviceSaved = ws.layout.d_gate.x === 3.4 && ws.layout.d_gate.y === 2.9;
const cfgMsg = ws.sent.filter((m) => m.type === 'houseplan/config/set').pop();
const layMsg = ws.sent.filter((m) => m.type === 'houseplan/layout/update').pop();
out.wsCarriedFarGeometry = !!cfgMsg
  && JSON.stringify(cfgMsg.config).includes('3.8');
out.wsCarriedFarPosition = !!layMsg && JSON.stringify(layMsg).includes('3.4');

// the payload the card sends must pass the REAL backend schema (docs/CANVAS.md
// §3: ±5000). Skipped, not failed, where voluptuous is not installed.
out.backendAcceptsFarPayload = (() => {
  if (!cfgMsg) return false;
  const directory = mkdtempSync(resolve(tmpdir(), 'hp-infinite-'));
  const f = resolve(directory, 'payload.json');
  writeFileSync(f, JSON.stringify({ config: cfgMsg.config, layout: (layMsg || {}).layout || ws.layout }));
  try {
    try {
      execFileSync('python3', ['-c', 'import voluptuous'], { stdio: 'ignore' });
    } catch {
      console.log('(voluptuous absent — backend schema check skipped)');
      return true;
    }
    const code = [
      'import json,sys',
      'sys.path.insert(0, "custom_components/houseplan")',
      'import validation as v',
      `d=json.load(open(${JSON.stringify(f)}))`,
      'v.CONFIG_SCHEMA(d["config"]); v.LAYOUT_SCHEMA(d["layout"])',
      'print("VALID")',
    ].join('\n');
    try {
      return execFileSync('python3', ['-c', code], { encoding: 'utf8' }).includes('VALID');
    } catch (e) {
      console.log('backend refused the payload:', String(e.stdout || e.message).slice(-400));
      return false;
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
})();

// ---- an OUTLIER: the view ignores it, the hint offers it ------------------
await loadFar({
  ...FAR_CFG,
  spaces: FAR_CFG.spaces.map((s) => (s.id === 'f1' ? { ...s } : s)),
}, { ...FAR_LAYOUT, d_motion: { s: 'f1', x: 90, y: 90 } });
await raf();
Object.assign(out, await page.evaluate(() => {
  const c = window.__card;
  const o = {};
  o.outlierReported = c._outliers === 1;
  const b = c._baseVb();
  o.outlierDoesNotCommandView = b[2] < 4000 && b[0] + b[2] < 5000; // still the house, not 90 canvases
  o.outlierViewStillHoldsPlan = b[0] < 1500 && b[0] + b[2] > 3000;
  const sr = c.shadowRoot || c.renderRoot;
  const hint = sr.querySelector('.farhint');
  o.hintShown = !!hint && !!hint.querySelector('button');
  o.hintIsNotAModal = !sr.querySelector('hp-dialog');
  return o;
}));

// «Показать» / «Вписать всё» takes the stray in
Object.assign(out, await page.evaluate(async () => {
  const c = window.__card;
  const sr = c.shadowRoot || c.renderRoot;
  sr.querySelector('.farhint button').click();
  await c.updateComplete;
  const o = {};
  const v = c._viewOr(c._baseVb());
  o.fitAllReachesTheStray = v.x + v.w > 90000 && v.y + v.h > 90000;
  o.fitAllStillHoldsPlan = v.x <= 1500 && v.y <= 1500;
  await c.updateComplete;
  o.hintGoneAfterShow = !sr.querySelector('.farhint');
  return o;
}));

// ---- zoom-out stops at 3x, zoom-in unchanged -----------------------------
await loadFar(FAR_CFG, FAR_LAYOUT);
await raf();
Object.assign(out, await page.evaluate(() => {
  const c = window.__card;
  const o = {};
  c._resetZoom();
  const fit = { ...c._viewOr(c._baseVb()) };
  c._applyView(0.001);
  o.zoomOutStopsAtThree = Math.abs(c._zoom - 1 / 3) < 1e-9
    && Math.abs(c._view.w - fit.w * 3) < fit.w * 0.02;
  c._applyView(50);
  o.zoomInUnchanged = c._zoom === 8;
  c._resetZoom();
  return o;
}));

// ---- pan has slack, and "home is that way" brings you back ---------------
Object.assign(out, await page.evaluate(async () => {
  const c = window.__card;
  const sr = c.shadowRoot || c.renderRoot;
  const o = {};
  c._resetZoom(); await c.updateComplete;
  const fit = { ...c._view };
  // pan most of a screen to the right: nothing pins the content over the scene
  c._view = c._clampView({ ...fit, x: fit.x + fit.w * 0.9 }, fit);
  o.panPastContentAllowed = c._view.x > fit.x + fit.w * 0.5;
  // walk right off the plan: the frame is entirely outside the view now
  c._view = { ...fit, x: fit.x + fit.w * 1.6 };
  c.requestUpdate(); await c.updateComplete;
  const arrow = sr.querySelector('.homearrow');
  o.homeArrowAppears = !!arrow;
  if (arrow) {
    arrow.click();
    await c.updateComplete;
    o.homeArrowFitsBack = Math.abs(c._view.x - fit.x) < 2 && Math.abs(c._view.w - fit.w) < 2;
    await c.updateComplete;
    o.homeArrowGone = !sr.querySelector('.homearrow');
  }
  // and it is NOT there while the plan is on screen
  c._resetZoom(); c.requestUpdate(); await c.updateComplete;
  o.noHomeArrowWhenVisible = !sr.querySelector('.homearrow');
  return o;
}));

// ---- icons scale WITH THE PLAN across zooms (docs/CANVAS.md §6) ----------
// The infinite canvas briefly made --icon-size a percentage of the viewport,
// so a marker kept its pixel size at every zoom. The owner looked at it and
// asked for the original contract back (2026-08-03): an icon is a percentage
// of the PLAN, it grows when you zoom in and shrinks when you zoom out, like
// everything else drawn on the plan. What the infinite canvas contributes is
// only the base unit the percentage is taken OF: `iconUnit` instead of the
// stored `vb.w`, checked right below on this very plan — which is drawn
// entirely outside the old square.
const farIcon = await page.evaluate(async () => {
  const c = window.__card;
  const sr = c.shadowRoot || c.renderRoot;
  // Measure the package core: shell stroke/shadow are decoration, while the
  // saved icon geometry must still scale with the plan.
  const size = () => {
    const el = sr.querySelector('.devlayer .dev .device-core');
    return Math.round(el.getBoundingClientRect().width * 100) / 100;
  };
  const o = {};
  c._resetZoom(); await c.updateComplete;
  const at1 = size();
  c._applyView(4); await c.updateComplete;
  const at4 = size();
  c._applyView(1 / 3); await c.updateComplete;
  const atOut = size();
  c._resetZoom(); await c.updateComplete;
  o.iconGrowsWithZoomIn = at1 > 4 && Math.abs(at4 / at1 - 4) < 0.05;
  o.iconShrinksWithZoomOut = Math.abs(atOut / at1 - 1 / 3) < 0.02;
  if (!o.iconGrowsWithZoomIn || !o.iconShrinksWithZoomOut) console.log('icon px', at1, at4, atOut);
  return { o, at1 };
});
Object.assign(out, farIcon.o);

// ---- an OLD plan (small, with a view_box) opens exactly as before ---------
Object.assign(out, await page.evaluate(async () => {
  const c = window.__card;
  const o = {};
  const cfg = {
    spaces: [{ id: 'f1', title: 'Old', view_box: [0, 0, 1, 1], plan_url: null, plan_aspect: null,
      rooms: [{ id: 'r1', name: 'Living', area: 'living_room',
        poly: [[0.04, 0.14], [0.55, 0.14], [0.55, 0.58], [0.04, 0.58]] },
      { id: 'r2', name: 'Kitchen', area: 'kitchen',
        poly: [[0.55, 0.14], [0.96, 0.14], [0.96, 0.46], [0.55, 0.46]] }] }],
    markers: [], settings: {},
  };
  c._serverCfg = cfg; c._layout = { d_light1: { s: 'f1', x: 0.22, y: 0.22 } };
  c._modelCache = null; c._frame = null; c._showFar = false; c._view = null;
  c._maybeRebuildDevices?.();
  c._defPos = c._defaultPositions(); // the auto grid follows the new rooms
  c.requestUpdate(); await c.updateComplete;
  c._resetZoom(); await c.updateComplete;
  const b = c._baseVb();
  // identical to what contentBounds produced before: the content bbox
  // (40..960 x 140..580) plus 5% of the longer side (920 -> 46)
  o.legacyFrameUnchanged = Math.abs(b[0] - -6) < 1 && Math.abs(b[1] - 94) < 1
    && Math.abs(b[2] - 1012) < 1 && Math.abs(b[3] - 532) < 1;
  o.legacyNoHint = c._outliers === 0;
  // an EMPTY space falls back to the stored view_box hint (§4)
  c._serverCfg = { spaces: [{ id: 'f1', title: 'E', view_box: [0.1, 0.2, 0.5, 0.4], rooms: [] }],
    markers: [], settings: {} };
  // a space with NOTHING in it at all — not even a marker parked in it
  c._layout = {}; c._modelCache = null; c._frame = null;
  c._devices = [];
  c.requestUpdate(); await c.updateComplete;
  const e = c._baseVb();
  o.emptySpaceUsesViewBoxHint = JSON.stringify(e.map(Math.round)) === '[100,200,500,400]';
  return o;
}));

// ---- and the icon does not DEGENERATE on the runaway plan ----------------
// The catch of "a percentage of the plan" on an unbounded canvas: keep the
// old fixed numerator (vb.w = NORM_W) and a plan drawn 2.3 canvases wide
// divides it by a 2.5-canvas-wide frame — the marker shrinks by that factor
// and keeps shrinking the further out the plan is drawn. `iconUnit` grows
// with the plan, so the marker on the far plan measured above is the same
// number of pixels as on this ordinary 0..1 one.
out.farIconNotDegenerate = await page.evaluate(async (farPx) => {
  const c = window.__card;
  const sr = c.shadowRoot || c.renderRoot;
  // the small plan from the block above, with its devices back
  c._serverCfg = { spaces: [{ id: 'f1', title: 'Old', view_box: [0, 0, 1, 1], plan_url: null, plan_aspect: null,
    rooms: [{ id: 'r1', name: 'Living', area: 'living_room',
      poly: [[0.04, 0.14], [0.55, 0.14], [0.55, 0.58], [0.04, 0.58]] },
    { id: 'r2', name: 'Kitchen', area: 'kitchen',
      poly: [[0.55, 0.14], [0.96, 0.14], [0.96, 0.46], [0.55, 0.46]] }] }],
    markers: [], settings: {} };
  c._layout = { d_light1: { s: 'f1', x: 0.22, y: 0.22 } };
  c._modelCache = null; c._frame = null; c._showFar = false; c._view = null;
  c._maybeRebuildDevices?.();
  c._defPos = c._defaultPositions();
  c.requestUpdate(); await c.updateComplete;
  c._resetZoom(); await c.updateComplete;
  const el = sr.querySelector('.devlayer .dev');
  const px = el.getBoundingClientRect().width - 2;
  if (!(px > 4 && Math.abs(px / farPx - 1) < 0.3)) console.log('icon px near/far', px, farPx);
  return px > 4 && Math.abs(px / farPx - 1) < 0.3;
}, farIcon.at1);

// ---- screenshots ---------------------------------------------------------
if (SHOTS) {
  mkdirSync(SHOTS, { recursive: true });
  await loadFar(FAR_CFG, FAR_LAYOUT);
  await raf();
  await page.screenshot({ path: `${SHOTS}/canvas_far_plan.png` });
  // fit-all with a stray far away
  await loadFar(FAR_CFG, { ...FAR_LAYOUT, d_motion: { s: 'f1', x: 90, y: 90 } });
  await raf();
  await page.screenshot({ path: `${SHOTS}/canvas_far_hint.png` });
  await page.evaluate(async () => {
    const c = window.__card;
    (c.shadowRoot || c.renderRoot).querySelector('.farhint button').click();
    await c.updateComplete;
  });
  await raf();
  await page.screenshot({ path: `${SHOTS}/canvas_fit_all.png` });
  // adaptive grid, zoomed far out in the plan editor
  await loadFar(FAR_CFG, FAR_LAYOUT);
  await page.evaluate(async () => {
    const c = window.__card;
    c._setMode('plan'); await c.updateComplete;
    c._resetZoom(); c._applyView(1 / 3); await c.updateComplete;
  });
  await raf();
  await page.screenshot({ path: `${SHOTS}/canvas_grid_far.png` });
  await page.evaluate(async () => {
    const c = window.__card;
    c._resetZoom(); c._applyView(4); await c.updateComplete;
  });
  await raf();
  await page.screenshot({ path: `${SHOTS}/canvas_grid_near.png` });
  await page.evaluate(async () => { window.__card._setMode('view'); });
}

await finish(browser, checkAll(out));
