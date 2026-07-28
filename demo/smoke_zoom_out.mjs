// v1.49.x: zoom goes below the base fit, the editor does not shift the plan.
// - the stage height follows the MEASURED header, not a hard-coded 118px, so
//   entering an editor keeps the plan inside the viewport;
// - zoom < 1 centres the content instead of pinning it to a corner;
// - the content frame (default zoom) includes devices standing outside rooms.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = {};

// -- editor entry keeps the stage inside the viewport --------------------
const stageBox = () => page.evaluate(() => {
  const sr = window.__card.shadowRoot || window.__card.renderRoot;
  const b = sr.querySelector('.stage').getBoundingClientRect();
  return { top: Math.round(b.top), bottom: Math.round(b.bottom) };
});
const vh = await page.evaluate(() => window.innerHeight);
const inView = await stageBox();
await page.evaluate(() => window.__card._setMode('plan'));
await page.waitForTimeout(400);
const inPlan = await stageBox();
out.viewFitsViewport = inView.bottom <= vh + 2;
out.editorFitsViewport = inPlan.bottom <= vh + 2; // used to overflow by ~90px
out.editorStageShrinks = inPlan.top > inView.top && inPlan.bottom <= inView.bottom + 2;
await page.evaluate(() => window.__card._setMode('view'));
await page.waitForTimeout(300);

// -- zoom out below the base fit -----------------------------------------
out.zoomOut = await page.evaluate(() => {
  const c = window.__card;
  c._resetZoom();
  const fit = { ...c._viewOr(c._baseVb()) };
  const stage = (c.shadowRoot || c.renderRoot).querySelector('.stage');
  c._zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 0.5);
  const v = { ...c._view };
  const base = c._baseVb();
  const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
  return {
    zoom: c._zoom,
    wider: v.w > fit.w * 1.9,                                   // actually zoomed out
    centredX: Math.abs(cx - (base[0] + base[2] / 2)) < 1,       // not pinned to a corner
    centredY: Math.abs(cy - (base[1] + base[3] / 2)) < 1,
  };
});
out.zoomOutWorks = out.zoomOut.zoom === 0.5 && out.zoomOut.wider
  && out.zoomOut.centredX && out.zoomOut.centredY;
delete out.zoomOut;
out.floorIsHalf = await page.evaluate(() => { window.__card._resetZoom(); const c = window.__card;
  c._applyView(0.1); return c._zoom; }) === 0.4; // clamped at the floor
await page.evaluate(() => window.__card._resetZoom());

// -- devices outside rooms stretch the default frame ---------------------
out.devicesStretchFrame = await page.evaluate(() => {
  const c = window.__card;
  const cfg = JSON.parse(JSON.stringify(c._serverCfg));
  cfg.spaces[0].plan_url = null; cfg.spaces[0].plan_aspect = null;
  c._serverCfg = cfg; c._model = null;
  const before = c._baseVb();
  // walk one lamp far outside every room
  c._layout = { ...c._layout, d_lamp: { s: 'f1', x: 0.99, y: 0.5 } };
  const after = c._baseVb();
  return after[0] + after[2] > before[0] + before[2] + 20; // right edge follows the lamp
});

await finish(browser, checkAll(out));
