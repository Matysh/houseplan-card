import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const stage = () => sr().querySelector('.stage');
  c._setMode('plan'); c._tool = 'boundary'; await c.updateComplete;
  const H = 1000;
  // A pure touch tap has no hover/pointermove. P1 must still be visible, and a
  // pen uses the same coarse tolerances as touch.
  c._boundaryPointerType = 'touch';
  c._cursorPt = null;
  c._boundaryClick([550, 200]); await c.updateComplete;
  out.touchTapShowsAnchor = !!c._openWallAnchor && !!sr().querySelector('.boundary-point');
  c._openWallAnchor = null;
  c._boundaryPointerType = 'pen';
  out.penUsesCoarseTolerance = Math.abs(c._boundaryTolerances().hit - c._cssPxToRender(22)) < 1e-6;
  c._boundaryPointerType = 'mouse';
  // The semantic hit width remains exactly 12 CSS px at both view scales.
  const sp = c._curSpaceCfg;
  const originalWalls = sp.walls;
  delete sp.walls;
  c._cfgEpoch++; c._boundaryTargetMemo = null;
  const originalView = c._view ? { ...c._view } : null;
  const baseView = c._viewOr(c._baseVb());
  const atCssOffset = (px) => c._boundaryTargetAt([
    550 + px * c._cssPxToRender(1), 300,
  ]).kind;
  const fineAtBase = [atCssOffset(11), atCssOffset(13)];
  c._view = {
    x: baseView.x + baseView.w / 4, y: baseView.y + baseView.h / 4,
    w: baseView.w / 2, h: baseView.h / 2,
  };
  const fineAtZoom = [atCssOffset(11), atCssOffset(13)];
  out.cssPixelToleranceSurvivesZoom = fineAtBase[0] === 'shared' && fineAtBase[1] === 'none'
    && fineAtZoom[0] === 'shared' && fineAtZoom[1] === 'none';
  c._view = originalView;
  if (originalWalls) sp.walls = originalWalls;
  else delete sp.walls;
  c._cfgEpoch++; c._boundaryTargetMemo = null;
  // Independent masonry is neutral away from room boundaries, but blocks a
  // shared boundary directly below it.
  const originalPartitions = sp.partitions;
  sp.partitions = [...(originalPartitions || []),
    { id: 'smoke-center-partition', a: [0.2, 0.3], b: [0.4, 0.3], cm: 15 }];
  c._cfgEpoch++; c._modelCache = null; c._boundaryTargetMemo = null;
  out.barePartitionIsNeutral = c._boundaryTargetAt([300, 300]).kind === 'none';
  c._toast = '';
  c._boundaryClick([300, 300]);
  out.barePartitionUsesBoundaryMessage = c._toast === c._t('toast.openwall_pick');
  sp.partitions = [...(originalPartitions || []),
    { id: 'smoke-boundary-partition', a: [0.55, 0.14], b: [0.55, 0.46], cm: 15 }];
  c._cfgEpoch++; c._modelCache = null; c._boundaryTargetMemo = null;
  out.partitionAboveBoundaryBlocks = c._boundaryTargetAt([550, 300]).kind === 'blocked';
  if (originalPartitions) sp.partitions = originalPartitions;
  else delete sp.partitions;
  c._cfgEpoch++; c._modelCache = null; c._boundaryTargetMemo = null;
  // 1) idle: neutral until a semantic target is under the pointer
  c._cursorPt = null; c.requestUpdate(); await c.updateComplete;
  out.idleCursor = getComputedStyle(stage()).cursor === 'default';
  out.noPreview = !sr().querySelector('.openwall-preview');
  // 2) solid shared wall: local anchor marker, never a full-edge preview
  c._cursorPt = [550, 0.25 * H]; c.requestUpdate(); await c.updateComplete;
  out.hoverLocalMarker = !!sr().querySelector('.boundary-point') && !sr().querySelector('.openwall-preview');
  out.hoverCursor = getComputedStyle(stage()).cursor === 'crosshair';
  // 3) The same tool predicts the full body that one click will restore.
  c._boundaryClick([550, 140]);
  c._boundaryClick([550, 460]);
  await c.updateComplete;
  c._cursorPt = [550, 300]; c.requestUpdate(); await c.updateComplete;
  const prev = sr().querySelector('.openwall-preview');
  out.sameToolWillRestore = prev?.classList.contains('boundary-restore') === true;
  out.restoreCursor = getComputedStyle(stage()).cursor === 'pointer';
  const planClosedOpenSpan = c._planClosedOpenSpan.bind(c);
  let previewPlans = 0;
  c._planClosedOpenSpan = (...args) => { previewPlans++; return planClosedOpenSpan(...args); };
  c._boundaryPreviewMemo = null;
  void c._boundaryPreview; void c._boundaryPreview; void c._boundaryPreview;
  c._planClosedOpenSpan = planClosedOpenSpan;
  out.restorePreviewIsMemoized = previewPlans === 1;
  // 4) with anchor set: rubber-band preview appears
  c._boundaryClick([550, 300]);
  await c.updateComplete;
  c._boundaryClick([550, 300]);
  out.samePlaceSecondTapDoesNotRearm = !c._openWallAnchor;
  c._boundaryClick([550, 200]);
  c._cursorPt = [550, 400]; c.requestUpdate(); await c.updateComplete;
  const band = sr().querySelector('.openwall-preview');
  out.anchorPreview = !!band && band.classList.contains('boundary-range');
  c._openWallAnchor = null;
  return out;
});
checkAll(res);
await finish(browser, res);
