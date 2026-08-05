import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const stage = () => sr().querySelector('.stage');
  c._setMode('plan'); c._tool = 'openwall'; await c.updateComplete;
  const H = 1000;
  // 1) idle: crosshair (draw-like), no preview
  c._cursorPt = null; c.requestUpdate(); await c.updateComplete;
  out.idleCursor = getComputedStyle(stage()).cursor === 'crosshair';
  out.noPreview = !sr().querySelector('.openwall-preview');
  // 2) hover shared solid wall: still NO full-edge preview (click target must stay clear)
  c._cursorPt = [550, 0.25 * H]; c.requestUpdate(); await c.updateComplete;
  out.hoverNoFullEdge = !sr().querySelector('.openwall-preview');
  out.hoverCursor = getComputedStyle(stage()).cursor === 'crosshair';
  // 3) two-click open, then hover the virtual: willclose preview on that span only
  c._openWallClick([550, 140]);
  c._openWallClick([550, 460]);
  await c.updateComplete;
  c._cursorPt = [550, 300]; c.requestUpdate(); await c.updateComplete;
  const prev = sr().querySelector('.openwall-preview');
  out.willclose = prev?.classList.contains('willclose') === true;
  // 4) with anchor set: rubber-band preview appears
  c._openWallClick([550, 300]); // close first
  await c.updateComplete;
  c._openWallClick([550, 200]);
  c._cursorPt = [550, 400]; c.requestUpdate(); await c.updateComplete;
  const band = sr().querySelector('.openwall-preview');
  out.anchorPreview = !!band && !band.classList.contains('willclose');
  c._openWallAnchor = null;
  return out;
});
checkAll(res);
await finish(browser, res);
