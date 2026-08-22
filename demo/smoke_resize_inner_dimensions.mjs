/**
 * Issue #233: resize labels measure between wall faces, not between centrelines.
 *
 * Before the fix one bubble carried two conventions at once — lengths along the
 * centreline next to an area computed from the floor — so «3.00 × 4.00 · 11.0 m²»
 * described a room that no tape measure would confirm.
 *
 * The room below is 300×400 cm centre-to-centre with 15 cm walls on all four
 * sides, so every clear span is exactly 15 cm shorter than the axis it sits on:
 * 285 and 385 cm. Thickness is set through the card's own dialog path
 * (`_wallThickClick` → `_wallThickApply(true)`), and both label producers are
 * then called as the drag handlers call them. What is deliberately NOT covered:
 * the pointer sequence itself — `_rszEdgeDown`/`_rszMove` are unchanged by #233.
 */
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();

const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const upd = async () => { c._cfgEpoch++; c.requestUpdate(); await c.updateComplete; };
  // First number of a label: both formatters emit a dot, so this is locale-safe.
  const num = (text) => Number((String(text).match(/-?\d+(?:\.\d+)?/) || [])[0]);

  c._setMode('plan');
  await upd();
  const space = c._curSpaceCfg;
  const saved = {
    rooms: JSON.parse(JSON.stringify(space.rooms || [])),
    walls: space.walls ? JSON.parse(JSON.stringify(space.walls)) : null,
    partitions: JSON.parse(JSON.stringify(space.partitions || [])),
    cell: space.cell_cm,
  };

  // 5 cm to a grid cell, so 300×400 cm is 60×80 cells of the plan.
  space.cell_cm = 5;
  space.partitions = [];
  delete space.walls;
  const g = c._gridPitch;
  const x0 = 20 * g, y0 = 20 * g;
  const render = [
    [x0, y0], [x0 + 60 * g, y0], [x0 + 60 * g, y0 + 80 * g], [x0, y0 + 80 * g],
  ];
  space.rooms = [{ id: 'r233', name: 'r233', poly: render.map((p) => [p[0] / 1000, p[1] / 1000]) }];
  await upd();
  out.roomBuilt = !!c._spaceModel()?.rooms?.some((r) => r.id === 'r233');

  // 15 cm on every side, applied the way the Thickness tool applies it.
  c._tool = 'wallthick';
  await upd();
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  c._wallThickClick(mid(render[0], render[1]));
  await upd();
  out.thicknessDialogOpened = !!c._wallDialog && c._wallDialog.roomId === 'r233';
  if (c._wallDialog) c._wallDialog = { ...c._wallDialog, value: '15' };
  c._wallThickApply(true);
  await upd();
  out.fourWallsRecorded = (c._curSpaceCfg.walls || []).length === 4;
  out.everyWallFifteen = (c._curSpaceCfg.walls || []).every((w) => Math.abs(w.cm - 15) < 0.01);

  // Wall labels: the clear span across is 285 cm, along it 385 cm.
  const spans = c._rszInnerSpanCms('r233', render, {});
  out.spansComputed = Array.isArray(spans) && spans.length === 4;
  out.spanAcrossIsInner = !!spans && Math.abs(spans[0] - 285) < 1;
  out.spanAlongIsInner = !!spans && Math.abs(spans[1] - 385) < 1;
  out.spansSymmetric = !!spans
    && Math.abs(spans[0] - spans[2]) < 1 && Math.abs(spans[1] - spans[3]) < 1;
  // The whole point of #233: no label may still read the centreline.
  out.noCentrelineSpan = !!spans
    && !spans.some((s) => Math.abs(s - 300) < 0.5 || Math.abs(s - 400) < 0.5);

  // The dragged-edge bubble, called the way `_rszLive` calls it.
  c._rszSel = 'r233';
  c._rszDrag = { rooms: c._spaceModel().rooms.map((r) => ({ id: r.id, poly: r.poly })) };
  await upd();
  const drag = c._rszEdgeLabels({ polys: { r233: render } }, { roomId: 'r233', edge: 0 });
  const dragLens = drag.filter((l) => !l.area).map((l) => num(l.text));
  out.dragLabelsThreeEdges = dragLens.length === 3;
  out.dragLabelsInner = dragLens.every((v) => Math.abs(v - 2.85) < 0.02 || Math.abs(v - 3.85) < 0.02);
  out.dragLabelsNotCentreline = !dragLens.some((v) => Math.abs(v - 3) < 0.005 || Math.abs(v - 4) < 0.005);
  const dragArea = drag.find((l) => l.area);
  out.dragAreaStillInner = !!dragArea && Math.abs(num(dragArea.text) - 11) < 0.06;

  // The corner frame: same convention as the area beside it.
  const labels = c._rszScaleLabels(render);
  const size = labels.find((l) => !l.area);
  const area = labels.find((l) => l.area);
  out.frameLabelsPresent = !!size && !!area;
  // Compare against the card's own formatter so the check survives a change of
  // units: inner is 57×77 cells, the centreline it replaced was 60×80.
  const fmt = (wCells, hCells) =>
    `${c._fmtLen([0, 0], [wCells * g, 0])} × ${c._fmtLen([0, 0], [hCells * g, 0])}`;
  out.frameIsInner = size?.text === fmt(57, 77);
  out.frameIsNotCentreline = size?.text !== fmt(60, 80);
  // 2.85 × 3.85 = 10.97 m² → «11.0»; the centreline rectangle would say «12.0».
  out.frameAreaAgreesWithSize = Math.abs(num(area?.text) - 11) < 0.06;

  c._rszDrag = null;
  c._rszSel = null;
  c._tool = null;
  // Re-read: `_wallThickApply` saves, and a save may hand back a fresh config
  // object, which would leave the reference captured above pointing at nothing.
  const cur = c._curSpaceCfg;
  cur.rooms = saved.rooms;
  cur.partitions = saved.partitions;
  cur.cell_cm = saved.cell;
  if (saved.walls) cur.walls = saved.walls; else delete cur.walls;
  await upd();
  return out;
});

checkAll(res);
await finish(browser);
