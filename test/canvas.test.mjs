// Infinite canvas — pure geometry (docs/CANVAS.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NORM_W, CANVAS_LIMIT, SANE_LIMIT, MIN_ZOOM, OUTLIER_K, MIN_VOTERS,
  spaceModels, contentItems, contentFrame, contentBounds, spaceFrame, spaceCenter,
  iconUnit, iconCqw, gridLevels, itemOf, roomItem, defaultPositions,
  expandItem, itemOfGeometry, resolveSpaceCardFit, structuralFrame,
} from '../test-build/space-geometry.js';

const model = (space) => spaceModels({ spaces: [{ view_box: [0, 0, 1, 1], rooms: [], ...space }], markers: [] })[0];
const pt = (x, y) => ({ minX: x, minY: y, maxX: x, maxY: y });
const box = (x0, y0, x1, y1) => ({ minX: x0, minY: y0, maxX: x1, maxY: y1 });
const r = (o) => [o.x, o.y, o.w, o.h].map((n) => Math.round(n));

// ---------------------------------------------------------------- constants
test('canvas limits mirror the backend and the spec', () => {
  assert.equal(CANVAS_LIMIT, 5000);
  assert.equal(SANE_LIMIT, 5000 * NORM_W);
  assert.ok(Math.abs(MIN_ZOOM - 1 / 3) < 1e-12, 'zoom out stops at 3x the content');
  assert.equal(OUTLIER_K, 10);
});

// ------------------------------------------------------- the ordinary plan
test('typical small plan: the frame is exactly what is drawn (unchanged behaviour)', () => {
  const m = model({ id: 's', rooms: [{ id: 'r', poly: [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]] }] });
  assert.deepEqual(contentBounds(m), { x: 390, y: 390, w: 220, h: 220 });
  // the stored view_box has no say once there IS content
  const withVb = model({ id: 's', view_box: [0.2, 0.2, 0.1, 0.1],
    rooms: [{ id: 'r', poly: [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]] }] });
  assert.deepEqual(contentBounds(withVb), { x: 390, y: 390, w: 220, h: 220 });
});

test('per-edge frame padding can remove only the top inset', () => {
  const m = model({ id: 's', rooms: [{
    id: 'r', poly: [[0.2, 0.3], [0.8, 0.3], [0.8, 0.7], [0.2, 0.7]],
  }] });
  const regular = spaceFrame(m);
  const compact = spaceFrame(m, undefined, { top: 0, right: 0.05, bottom: 0.05, left: 0.05 });
  assert.deepEqual(regular, { x: 170, y: 270, w: 660, h: 460 });
  assert.deepEqual(compact, { x: 170, y: 300, w: 660, h: 430 });
  assert.equal(compact.x, regular.x, 'left edge stays padded');
  assert.equal(compact.x + compact.w, regular.x + regular.w, 'right edge stays padded');
  assert.equal(compact.y + compact.h, regular.y + regular.h, 'bottom edge stays padded');
});

test('static-card fit literals fail closed and content keeps its exact frame', () => {
  const m = model({ id: 's', rooms: [{
    id: 'r', poly: [[0.2, 0.3], [0.8, 0.3], [0.8, 0.7], [0.2, 0.7]],
  }] });
  for (const value of [undefined, null, '', 'content', 'cover', 1]) {
    assert.equal(resolveSpaceCardFit(value), 'content');
  }
  assert.equal(resolveSpaceCardFit('house'), 'house');
  assert.deepEqual(spaceFrame(m), { x: 170, y: 270, w: 660, h: 460 });
});

test('tight structural frame keeps every sane component with zero padding', () => {
  const room = expandItem(box(100, 200, 500, 600), 2);
  const wall = itemOfGeometry([[[[80, 180], [520, 180], [520, 620], [80, 620], [80, 180]]]]);
  const detachedWing = box(5000, 300, 5300, 700);
  const frame = structuralFrame([room, wall, detachedWing]);
  assert.deepEqual(frame, { x: 80, y: 180, w: 5220, h: 520 });
  assert.equal(structuralFrame([box(Infinity, 0, Infinity, 1)]), null);
});

test('tight structural frame protects a collinear house axis from a zero viewBox', () => {
  const frame = structuralFrame([box(100, 250, 900, 250)]);
  assert.ok(frame && frame.w === 800 && frame.h > 0);
  assert.ok(Number.isFinite(frame.x) && Number.isFinite(frame.y));
});

test('per-edge padding keeps frame fallback and degenerate protection', () => {
  const pad = { top: 0, right: 0.05, bottom: 0.05, left: 0.05 };
  const empty = model({ id: 's', view_box: [0.1, 0.2, 0.5, 0.4] });
  assert.deepEqual(spaceFrame(empty, undefined, pad), { x: 100, y: 200, w: 500, h: 400 });
  const lone = spaceFrame(model({ id: 's' }), [[2500, 2500]], pad);
  assert.ok(Number.isFinite(lone.x) && Number.isFinite(lone.y));
  assert.ok(lone.w > 0 && lone.h > 0, 'a point still produces a valid viewBox');
});

// --------------------------------------------- (b) the plan PAST the square
test('a plan drawn far outside the old unit square is framed whole', () => {
  // rooms at normalised 1.5 .. 3.0 — the case that used to break: the old
  // -25%..125% envelope threw every one of these points away and the frame
  // collapsed onto whatever happened to be near the origin.
  const m = model({ id: 's', rooms: [
    { id: 'a', poly: [[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]] },
    { id: 'b', poly: [[2.0, 1.5], [3.0, 1.5], [3.0, 2.4], [2.0, 2.4]] },
  ] });
  const b = contentBounds(m);
  assert.deepEqual(r(b), [1425, 1425, 1650, 1050]);
  assert.ok(b.x < 1500 && b.x + b.w > 3000, 'both far rooms are inside the frame');
  // and a device placed even further out still counts as content
  const withDev = contentBounds(m, 0.05, [[3500, 2000]]);
  assert.ok(withDev.x + withDev.w > 3500);
});

test('a plan past the square keeps its icon spacing in proportion', () => {
  const small = model({ id: 's', rooms: [{ id: 'r', area: 'a', poly: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]] }] });
  const big = model({ id: 's', rooms: [{ id: 'r', area: 'a', poly: [[1.0, 1.0], [3.0, 1.0], [3.0, 3.0], [1.0, 3.0]] }] });
  assert.equal(iconUnit(small), NORM_W, 'anything inside the old square is unchanged');
  assert.equal(iconUnit(big), 2000, 'a 2-canvas-wide plan scales the spacing with it');
  // the auto grid still lands inside the room in both cases
  const devs = [0, 1, 2, 3].map((i) => ({ id: 'd' + i, space: 's', area: 'a', entities: [] }));
  for (const [mm, lo, hi] of [[small, 100, 500], [big, 1000, 3000]]) {
    const pos = defaultPositions(devs, mm, 2.5);
    for (const k of Object.keys(pos)) {
      assert.ok(pos[k].x >= lo && pos[k].x <= hi && pos[k].y >= lo && pos[k].y <= hi, 'inside the room');
    }
  }
});

// ------------------------------------------------------------- icon size
test('icon size: a percentage of the PLAN, exactly as before the canvas', () => {
  // The pre-infinite-canvas card rendered `--icon-size: iconPct * vb.w / view.w`
  // and the editor only ever wrote view_box [0,0,1,1], i.e. vb.w === NORM_W.
  // iconCqw must reproduce that number to the last digit on such a plan.
  const small = model({ id: 's', rooms: [{ id: 'r', poly: [[0.04, 0.14], [0.96, 0.14], [0.96, 0.86], [0.04, 0.86]] }] });
  const legacy = (pct, viewW) => (pct * NORM_W) / viewW;
  for (const viewW of [1000, 1100, 1093.969144460028, 550, 275, 137.5]) {
    assert.equal(iconCqw(3.4, small, viewW), legacy(3.4, viewW));
  }
  // and that number IS "scales with the plan": half the view, twice the icon
  assert.equal(iconCqw(2.5, small, 500) / iconCqw(2.5, small, 1000), 2);
  assert.equal(iconCqw(2.5, small, 8000) / iconCqw(2.5, small, 1000), 0.125);
  // the kiosk icon multiplier is a plain factor, as it was
  assert.equal(iconCqw(2.5, small, 1000, 2), 2 * iconCqw(2.5, small, 1000));
});

test('icon size is invariant for physically equivalent plans at different grid scales', () => {
  const coarse = model({
    id: 'coarse', cell_cm: 5,
    rooms: [{ id: 'r', poly: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.88], [0.1, 0.88]] }],
  });
  const fine = model({
    id: 'fine', cell_cm: 1, view_box: [0, 0, 5, 5],
    rooms: [{ id: 'r', poly: [[0.5, 0.5], [4.5, 0.5], [4.5, 4.4], [0.5, 4.4]] }],
  });
  assert.equal(iconUnit(coarse), NORM_W);
  assert.equal(iconUnit(fine), 5 * NORM_W);
  assert.equal(iconCqw(2.5, coarse, spaceFrame(coarse).w), iconCqw(2.5, fine, spaceFrame(fine).w));
});

test('a legacy space without cell_cm keeps the historical five-centimetre read fallback', () => {
  assert.equal(model({ id: 'legacy' }).cellCm, 5);
});

test('icon size: a plan drawn past the old square keeps its markers', () => {
  // rooms at 1.0..3.0 — 2 canvases wide, framed by ~2.2 canvases once the
  // frame is the content. With the old fixed NORM_W numerator the marker
  // would be 2.2x smaller than on an ordinary plan, and 55x smaller on a
  // plan 50 canvases wide: the reason the numerator is iconUnit.
  const big = model({ id: 's', rooms: [{ id: 'r', poly: [[1, 1], [3, 1], [3, 3], [1, 3]] }] });
  const small = model({ id: 's', rooms: [{ id: 'r', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] }] });
  const frame = (m) => { const f = spaceFrame(m); return f.w; }; // content + 5%
  assert.equal(frame(small), NORM_W * 1.1);
  assert.equal(frame(big), 2 * NORM_W * 1.1);
  // same percentage of the frame on both plans — the marker did not degenerate
  assert.equal(iconCqw(2.5, big, frame(big)), iconCqw(2.5, small, frame(small)));
  assert.ok(iconCqw(2.5, big, frame(big)) > 2, 'and it is a real size, not a dot');
  // the degenerate alternative, for the record
  assert.ok((2.5 * NORM_W) / frame(big) < iconCqw(2.5, big, frame(big)) / 1.9);
  // the size unit and the auto-placement spacing are the same unit
  assert.equal(iconUnit(big), 2 * NORM_W);
});

test('icon size: no view yet is a plain percentage, never NaN', () => {
  const m = model({ id: 's', rooms: [{ id: 'r', poly: [[0.1, 0.1], [0.5, 0.5]] }] });
  for (const bad of [0, -1, NaN, Infinity, null, undefined]) {
    assert.equal(iconCqw(2.5, m, bad), 2.5);
  }
  assert.equal(iconCqw(2.5, m, 0, 1.5), 3.75);
});

// DEV-2C947-03: what is out of the frame is out of the icon unit
test('a room-outlier is excluded from the frame AND from the icon unit', () => {
  // three rooms in the core, a fourth one dragged 90 canvases out — MIN_VOTERS
  // is exactly met, so the vote runs and the frame rejects the stray.
  const rooms = [
    { id: 'a', poly: [[0.10, 0.10], [0.30, 0.10], [0.30, 0.30], [0.10, 0.30]] },
    { id: 'b', poly: [[0.30, 0.10], [0.55, 0.10], [0.55, 0.35], [0.30, 0.35]] },
    { id: 'c', poly: [[0.10, 0.30], [0.35, 0.30], [0.35, 0.55], [0.10, 0.55]] },
    { id: 'far', poly: [[90, 90], [91, 90], [91, 91], [90, 91]] },
  ];
  const m = model({ id: 's', rooms });
  const f = contentFrame(contentItems(m));
  assert.equal(f.outliers, 1, 'the far room is rejected from the frame');
  assert.ok(f.core.w < 1000, 'the opening view is the house');
  // ...and the icon unit agrees: it used to be boxOf(ALL rooms) = 91000 units,
  // which made every marker of the ordinary plan ~91x too big while the frame
  // stayed correct (audit dev@2c947f4).
  assert.equal(iconUnit(m), NORM_W, 'the stray does not stretch the icon unit');
  const houseOnly = model({ id: 's', rooms: rooms.slice(0, 3) });
  assert.equal(iconUnit(m), iconUnit(houseOnly), 'same unit as the plan without it');
  // one shared notion of "the plan": the unit follows the frame's core
  assert.ok(iconCqw(2.5, m, 1000) < 3, 'the marker is a marker, not a wall');
  assert.equal(iconCqw(2.5, m, 1000), iconCqw(2.5, houseOnly, 1000));
  // a genuinely wide plan still scales — no vote, no rejection
  const wide = model({ id: 's', rooms: [
    { id: 'a', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    { id: 'b', poly: [[1, 0], [2, 0], [2, 1], [1, 1]] },
    { id: 'c', poly: [[0, 1], [1, 1], [1, 2], [0, 2]] },
    { id: 'd', poly: [[1, 1], [2, 1], [2, 2], [1, 2]] },
  ] });
  assert.equal(iconUnit(wide), 2 * NORM_W);
});

// ------------------------------------------------------------- the outlier
test('an outlier does not command the frame, but "show all" reaches it', () => {
  const items = [
    box(400, 400, 500, 500), box(500, 400, 620, 520), box(400, 500, 520, 640),
    box(520, 520, 640, 660), pt(450, 450), pt(600, 600),
    pt(90000, 90000), // one marker an order of magnitude away
  ];
  const f = contentFrame(items);
  assert.equal(f.outliers, 1);
  assert.ok(f.core.x + f.core.w < 1000, 'the stray is outside the opening view');
  assert.ok(f.all.x + f.all.w > 90000, 'but the fit-everything box holds it');
  assert.ok(f.all.w > f.core.w * 50);
});

test('an outlier vote needs a majority to be far FROM', () => {
  // three objects: no vote at all (MIN_VOTERS), so the far one still counts
  const few = contentFrame([box(400, 400, 500, 500), box(500, 500, 600, 600), pt(90000, 90000)]);
  assert.equal(few.outliers, 0);
  assert.deepEqual(few.core, few.all);
  assert.ok(MIN_VOTERS === 4);
  // a genuinely spread-out plan (detached buildings) is not a pile of strays:
  // no object is an order of magnitude further than the 75th percentile
  const spread = contentFrame([pt(0, 0), pt(3000, 0), pt(0, 3000), pt(3000, 3000), pt(1500, 1500)]);
  assert.equal(spread.outliers, 0);
  assert.deepEqual(spread.core, spread.all);
  // majority veto: half the objects "far" means the plan is wide, not stray
  const half = contentFrame([pt(0, 0), pt(10, 0), pt(0, 10), pt(90000, 0), pt(90000, 10), pt(90010, 0)]);
  assert.equal(half.outliers, 0);
});

test('a tight cluster does not call its own neighbour an outlier (MIN_SPREAD)', () => {
  // five markers within one room; the "furthest" is 60 units away — with a
  // percentile-only scale that would be 10x the p75 and get thrown out.
  const f = contentFrame([pt(500, 500), pt(502, 501), pt(499, 503), pt(501, 498), pt(560, 500)]);
  assert.equal(f.outliers, 0);
  assert.ok(f.core.x + f.core.w > 560);
});

test('corruption is dropped outright, not shown by "show all"', () => {
  const f = contentFrame([box(400, 400, 500, 500), box(500, 500, 600, 600),
    box(400, 500, 500, 600), box(500, 400, 600, 500), pt(1e100, 1e100)]);
  assert.equal(f.outliers, 0, 'not an outlier — not content at all');
  assert.ok(f.all.w < 1000, 'the fit-everything box does not chase 1e100');
  // exactly at the sane limit it is still content
  const edge = contentFrame([pt(0, 0), pt(1, 1), pt(2, 2), pt(SANE_LIMIT, SANE_LIMIT)]);
  assert.ok(edge.all.x + edge.all.w >= SANE_LIMIT);
  assert.equal(contentFrame([pt(NaN, 0), pt(0, Infinity)]).core, null);
});

// ---------------------------------------------------- degenerate and empty
test('empty space: no frame, the caller falls back to the view_box hint', () => {
  const empty = model({ id: 's', view_box: [0.1, 0.2, 0.5, 0.4] });
  assert.equal(contentBounds(empty), null);
  assert.deepEqual(spaceFrame(empty), { x: 100, y: 200, w: 500, h: 400 });
  // a broken stored hint falls back to the legacy square
  const broken = model({ id: 's', view_box: [0, 0, 0, 0] });
  assert.deepEqual(spaceFrame(broken), { x: 0, y: 0, w: 1000, h: 1000 });
});

test('one room, one marker: the frame never has a zero axis', () => {
  const one = model({ id: 's', rooms: [{ id: 'r', poly: [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]] }] });
  const b = contentBounds(one);
  assert.ok(b.w > 0 && b.h > 0);
  const lone = contentBounds(model({ id: 's' }), 0.05, [[2500, 2500]]);
  assert.ok(lone.w >= 200 && lone.h >= 200, 'a lone marker far out still frames some canvas');
  assert.ok(Math.abs(lone.x + lone.w / 2 - 2500) < 1, 'centred on it');
  // a real thin corridor keeps its tight frame (only DEGENERATE is inflated)
  const corridor = contentBounds(model({ id: 's', rooms: [{ id: 'r', x: 0.1, y: 0.4, w: 0.6, h: 0.1 }] }));
  assert.equal(Math.round(corridor.h), 160);
});

// ------------------------------------------------------------ image plans
test('with a backdrop the image still sets the extent', () => {
  const m = model({ id: 's', plan_url: '/p.svg', plan_aspect: 2,
    rooms: [{ id: 'r', poly: [[0.4, 0.4], [0.5, 0.4], [0.5, 0.5], [0.4, 0.5]] }] });
  const items = contentItems(m);
  assert.equal(items.length, 2);
  const b = contentBounds(m);
  assert.ok(b.x <= 0 && b.x + b.w >= 1000, 'the whole image width is framed');
  assert.ok(b.y <= 250 && b.y + b.h >= 750, 'the whole image height is framed');
  // and content drawn OUTSIDE the image widens the frame further
  const past = contentBounds(m, 0.05, [[2000, 500]]);
  assert.ok(past.x + past.w > 2000);
});

test('spaceCenter is the middle of the content', () => {
  const m = model({ id: 's', rooms: [{ id: 'r', poly: [[2.0, 2.0], [3.0, 2.0], [3.0, 3.0], [2.0, 3.0]] }] });
  const c = spaceCenter(m);
  assert.ok(Math.abs(c.x - 2500) < 1 && Math.abs(c.y - 2500) < 1);
});

// ------------------------------------------------------------ helper units
test('itemOf / roomItem', () => {
  assert.deepEqual(itemOf([[1, 2], [5, 0]]), { minX: 1, minY: 0, maxX: 5, maxY: 2 });
  assert.equal(itemOf([]), null);
  assert.deepEqual(roomItem({ x: 10, y: 20, w: 30, h: 40 }), { minX: 10, minY: 20, maxX: 40, maxY: 60 });
  assert.deepEqual(roomItem({ poly: [[0, 0], [4, 9]] }), { minX: 0, minY: 0, maxX: 4, maxY: 9 });
  assert.equal(roomItem({ name: 'no geometry' }), null);
});

// ------------------------------------------------------------ adaptive grid
test('gridLevels: fine dots vanish before they merge, every 5th stays', () => {
  const pitch = NORM_W / 240; // ~4.167 render units, the drawing grid
  // zoomed in / normal: 1 px per unit — the base grid is legible
  assert.deepEqual(gridLevels(pitch, 2), { fine: 1, coarse: 5 });
  // zoomed out 4x: the base step is ~1 px, so every 2nd survives, accent 10th
  assert.deepEqual(gridLevels(pitch, 0.9), { fine: 2, coarse: 10 });
  // far out: only every 20th, accent every 100th
  assert.deepEqual(gridLevels(pitch, 0.09), { fine: 20, coarse: 100 });
  // monotone: zooming out never makes the grid finer
  let prev = 0;
  for (const s of [4, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01]) {
    const g = gridLevels(pitch, s);
    if (!g) break;
    assert.ok(g.fine >= prev, 'never finer as we zoom out');
    assert.ok(g.coarse >= g.fine * 5, 'the accent step is at least every 5th');
    assert.ok(pitch * g.fine * s >= 7, 'and it is still legible');
    prev = g.fine;
  }
  // absurdly far out: no grid at all rather than a grey fog
  assert.equal(gridLevels(pitch, 1e-6), null);
  assert.equal(gridLevels(0, 1), null);
  assert.equal(gridLevels(pitch, 0), null);
  assert.equal(gridLevels(pitch, NaN), null);
});
