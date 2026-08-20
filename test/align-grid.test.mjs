// «Выровнять всё по сетке» (docs/CANVAS.md §9) — the batch that the general
// settings offer as an explicit action, never as a silent migration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { alignAllToGrid, snapN } from '../test-build/align-grid.js';
import { GRID_N, GRID_STEP_N } from '../test-build/space-geometry.js';

const S = GRID_STEP_N;               // 1/240 of the plan width
const onGrid = (v) => Math.abs(v * GRID_N - Math.round(v * GRID_N)) < 1e-9;

/** A plan deliberately knocked off the grid in every direction. */
const detuned = () => ({
  spaces: [{
    id: 'f1', view_box: [0, 0, 1, 1],
    rooms: [
      // a polygon a third of a step off on every vertex
      { id: 'r1', name: 'Living', area: 'a1',
        poly: [[0.2 + S / 3, 0.2], [0.5, 0.2 - S / 3], [0.5 + S / 3, 0.5], [0.2, 0.5]] },
      // a rect whose far corner is off even though its origin is not
      { id: 'r2', name: 'Kitchen', area: 'a2', x: 0.5, y: 0.2, w: 0.3 + S / 3, h: 0.3 },
    ],
    openings: [
      // just off the r1 top wall, and not at a whole number of steps along it
      { id: 'o1', type: 'window', x: 0.3 + S / 3, y: 0.2 + S / 5, angle: 0, length: 0.06 },
    ],
    decor: [
      { id: 'd1', kind: 'line', x1: 0.1 + S / 3, y1: 0.7, x2: 0.9, y2: 0.7 - S / 4 },
      { id: 'd2', kind: 'rect', x: 0.1 + S / 4, y: 0.8, w: 0.2 + S / 3, h: 0.05 },
      { id: 'd3', kind: 'text', x: 0.4 + S / 3, y: 0.9, text: 'hi' },
    ],
  }],
  markers: [], settings: {},
});
const detunedLayout = () => ({
  dev1: { s: 'f1', x: 0.3 + S / 3, y: 0.3 },
  dev2: { s: 'f1', x: 0.35, y: 0.35, k: 1.5 },         // already on a node
  rl_r1: { s: 'f1', x: 0.25 + S / 2.5, y: 0.25 },      // a room LABEL counts too
  junk: { s: 'f1' },                                    // no coordinates: skipped
});

test('snapN returns the exact nearest node and is idempotent', () => {
  const node = 12 / GRID_N;
  assert.equal(snapN(node), node);
  const canonical = 112 * S;
  const noisy = 0.46666666666666673;
  assert.notEqual(noisy, canonical);
  assert.equal(snapN(noisy), canonical, 'a one-ULP tail must not survive Optimize');
  const off = node + S / 3;
  assert.ok(Math.abs(snapN(off) - node) < 1e-12);
  assert.equal(snapN(snapN(off)), snapN(off));
});

test('near-node report counts only coordinate values actually written to the candidate', () => {
  const canonical = 112 * S;
  const noisy = 0.46666666666666673;
  const spaces = [{
    id: 'f1', rooms: [
      { id: 'poly', poly: [[noisy, 0.2], [0.6, 0.2], [0.6, 0.4], [0.2, 0.4]] },
      { id: 'rect', x: 0, y: 0.5, w: noisy, h: 0.2 },
    ],
    partitions: [
      { id: 'accepted', a: [noisy, 0.2], b: [0.6, 0.2], cm: 15 },
      { id: 'rejected', a: [noisy, 0.4], b: [0.6, 0.4], cm: 15 },
    ],
    openings: [{
      id: 'outside-host', type: 'door', x: 0.5, y: 0.4, angle: 0, length: 0.05,
      host: { kind: 'partition', id: 'rejected', t: 2 },
    }],
    wall_columns: [{ id: 'column', shape: 'circle', center: [noisy, 0.5], cm: 20 }],
    decor: [
      { id: 'line', kind: 'line', x1: noisy, y1: 0.7, x2: 0.6, y2: 0.7 },
      { id: 'box', kind: 'rect', x: 0, y: 0.8, w: noisy, h: 0.1 },
      { id: 'text', kind: 'text', x: noisy, y: 0.9, text: 'x' },
    ],
  }];
  const result = alignAllToGrid(spaces, { marker: { s: 'f1', x: noisy, y: 0.5 } });

  assert.equal(result.report.moved, 0, 'ULP cleanup is not a visible move');
  assert.equal(result.report.maxShift, 0);
  assert.equal(result.report.maxShiftCm, 0);
  assert.equal(result.report.coordsCanonicalized, 8);
  assert.equal(result.changed, true);
  assert.equal(result.spaces[0].partitions[0].a[0], canonical);
  assert.equal(result.spaces[0].partitions[1].a[0], noisy,
    'hostedFit=false keeps the rejected endpoints and must not count them');
  assert.equal(result.spaces[0].wall_columns[0].center[0], canonical);
  assert.equal(result.layout.marker.x, canonical);
});

test('ordinary off-grid movement is not duplicated in the near-node counter', () => {
  const result = alignAllToGrid([], { marker: { x: 0.2 + S / 3, y: 0.2 } });
  assert.equal(result.report.moved, 1);
  assert.equal(result.report.coordsCanonicalized, 0);
});

test('alignAllToGrid puts every grid-bound element on a node', () => {
  const { spaces, layout, report } = alignAllToGrid(detuned().spaces, detunedLayout());
  const sp = spaces[0];
  for (const p of sp.rooms[0].poly) { assert.ok(onGrid(p[0])); assert.ok(onGrid(p[1])); }
  const r2 = sp.rooms[1];
  assert.ok(onGrid(r2.x) && onGrid(r2.y));
  assert.ok(onGrid(r2.x + r2.w) && onGrid(r2.y + r2.h)); // the FAR corner, not the size
  const [l, rc, tx] = sp.decor;
  assert.ok(onGrid(l.x1) && onGrid(l.y1) && onGrid(l.x2) && onGrid(l.y2));
  assert.ok(onGrid(rc.x) && onGrid(rc.y) && onGrid(rc.x + rc.w) && onGrid(rc.y + rc.h));
  assert.ok(onGrid(tx.x) && onGrid(tx.y));
  assert.ok(onGrid(layout.dev1.x) && onGrid(layout.dev1.y));
  assert.ok(onGrid(layout.rl_r1.x) && onGrid(layout.rl_r1.y));
  assert.ok(report.moved > 0 && report.moved <= report.total);
});

test('an opening stays ON its wall — it is wall-bound, not node-bound', () => {
  const { spaces } = alignAllToGrid(detuned().spaces, {});
  const o = spaces[0].openings[0];
  const wall = spaces[0].rooms[0].poly; // the aligned r1
  // the top edge runs wall[0] → wall[1]; the opening must lie on that segment
  const [ax, ay] = wall[0], [bx, by] = wall[1];
  const t = ((o.x - ax) * (bx - ax) + (o.y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2);
  const px = ax + t * (bx - ax), py = ay + t * (by - ay);
  assert.ok(Math.hypot(o.x - px, o.y - py) < 1e-9, 'opening is off its wall');
  assert.ok(t > 0 && t < 1, 'opening slid off the end of its wall');
});

test('a hosted opening follows aligned partition identity and t', () => {
  const spaces = [{
    id: 'f1', cell_cm: 5, rooms: [],
    partitions: [{ id: 'p1', a: [0.203, 0.2], b: [0.603, 0.2], cm: 15 }],
    openings: [{
      id: 'o1', type: 'door', x: 9, y: 9, angle: 77, length: 0.1,
      host: { kind: 'partition', id: 'p1', t: 0.25 },
    }],
  }];
  const { spaces: aligned } = alignAllToGrid(spaces, {});
  const partition = aligned[0].partitions[0];
  const opening = aligned[0].openings[0];
  assert.deepEqual(opening.host, { kind: 'partition', id: 'p1', t: 0.25 });
  assert.equal(opening.x, partition.a[0] + (partition.b[0] - partition.a[0]) * 0.25);
  assert.equal(opening.y, partition.a[1] + (partition.b[1] - partition.a[1]) * 0.25);
  assert.equal(opening.angle, 0);
});

test('alignment never shortens a host past its opening interval', () => {
  const spaces = [{
    id: 'f1', cell_cm: 5, rooms: [],
    partitions: [{ id: 'p1', a: [0.0022, 0], b: [0.101, 0], cm: 15 }],
    openings: [{
      id: 'o1', type: 'door', x: 0.0516, y: 0, angle: 0, length: 0.098,
      host: { kind: 'partition', id: 'p1', t: 0.5 },
    }],
  }];
  const { spaces: aligned } = alignAllToGrid(spaces, {});
  assert.deepEqual(aligned[0].partitions[0].a, [0.0022, 0]);
  assert.deepEqual(aligned[0].partitions[0].b, [0.101, 0]);
  assert.ok(Math.abs(aligned[0].openings[0].x - 0.0516) < 1e-12);
});

test('idempotent: a second run moves nothing and changes nothing', () => {
  const first = alignAllToGrid(detuned().spaces, detunedLayout());
  const second = alignAllToGrid(first.spaces, first.layout);
  assert.equal(second.report.moved, 0);
  assert.equal(second.report.coordsCanonicalized, 0);
  assert.equal(second.changed, false);
  assert.deepEqual(second.spaces, first.spaces);
  assert.deepEqual(second.layout, first.layout);
});

test('an already-aligned plan reports nothing to do', () => {
  const clean = {
    spaces: [{ id: 'f1', rooms: [{ id: 'r1', poly: [[0.25, 0.25], [0.5, 0.25], [0.5, 0.5], [0.25, 0.5]] }] }],
  };
  const r = alignAllToGrid(clean.spaces, { d1: { s: 'f1', x: 0.25, y: 0.5 } });
  assert.equal(r.report.moved, 0);
  assert.equal(r.report.coordsCanonicalized, 0);
  assert.equal(r.changed, false);
  assert.ok(r.report.total >= 2); // it still LOOKED at everything
});

test('the report is honest: it counts what moved and the largest shift', () => {
  const r = alignAllToGrid(detuned().spaces, detunedLayout());
  // never more than half a step in each axis → at most half a step diagonally… ×√2
  assert.ok(r.report.maxShift <= S * 0.71 + 1e-12, String(r.report.maxShift / S));
  assert.ok(r.report.maxShift > 0);
  // "junk" has no coordinates and is not counted; dev2 is on a node already
  assert.equal(r.report.total, 2 /*rooms*/ + 3 /*decor*/ + 1 /*opening*/ + 3 /*layout*/);
  assert.ok(r.report.moved < r.report.total);
});

test('nothing is invented: the input objects are not mutated', () => {
  const cfg = detuned();
  const before = JSON.stringify(cfg.spaces);
  const lay = detunedLayout();
  const layBefore = JSON.stringify(lay);
  alignAllToGrid(cfg.spaces, lay);
  assert.equal(JSON.stringify(cfg.spaces), before);
  assert.equal(JSON.stringify(lay), layBefore);
});

test('a stray opening with no wall in reach is left exactly where it is', () => {
  const cfg = detuned();
  cfg.spaces[0].openings.push({ id: 'o2', type: 'door', x: 3.7, y: 4.2, angle: 0, length: 0.06 });
  const { spaces } = alignAllToGrid(cfg.spaces, {});
  const o2 = spaces[0].openings.find((o) => o.id === 'o2');
  assert.equal(o2.x, 3.7);
  assert.equal(o2.y, 4.2);
});

test('far-out coordinates align just as well as near ones (infinite canvas)', () => {
  const cfg = { spaces: [{ id: 'f1', rooms: [
    { id: 'r1', poly: [[2.5 + S / 3, 2.2], [3.0, 2.2], [3.0, 2.6], [2.5, 2.6]] }] }] };
  const { spaces, report } = alignAllToGrid(cfg.spaces, { d: { s: 'f1', x: 2.5 + S / 3, y: 2.2 } });
  for (const p of spaces[0].rooms[0].poly) { assert.ok(onGrid(p[0])); assert.ok(onGrid(p[1])); }
  assert.ok(report.moved >= 1);
});

// ---------------------------------------------------------------------------
// AUD-158B1-01 — the confirmation promises an exact maximum before an action
// with no undo, so the report must be an UPPER BOUND of what the run does.
// ---------------------------------------------------------------------------

/** What the run REALLY did, measured on the returned objects: the largest
 *  displacement of any corner / vertex / end, in the centimetres of the space
 *  it happened in. The report may never be smaller than this. */
const reallyMovedCm = (before, after, cell = {}) => {
  const cm = (sp) => (Number(sp?.cell_cm) > 0 ? Number(sp.cell_cm) : 5) * GRID_N;
  let max = 0;
  const hit = (d, sp) => { if (d * cm(sp) > max) max = d * cm(sp); };
  const box = (a, b, sp) => {
    const dx = Math.max(Math.abs(b.x - a.x), Math.abs((b.x + b.w) - (a.x + (a.w || 0))));
    const dy = Math.max(Math.abs(b.y - a.y), Math.abs((b.y + b.h) - (a.y + (a.h || 0))));
    hit(Math.hypot(dx, dy), sp);
  };
  before.forEach((sp, i) => {
    const sq = after[i];
    (sp.rooms || []).forEach((r, j) => {
      const q = sq.rooms[j];
      if (r.poly?.length) r.poly.forEach((p, k) => hit(Math.hypot(q.poly[k][0] - p[0], q.poly[k][1] - p[1]), sp));
      else if (r.x != null) box(r, q, sp);
    });
    (sp.decor || []).forEach((d, j) => {
      const q = sq.decor[j];
      if (d.kind === 'line') {
        hit(Math.hypot(q.x1 - d.x1, q.y1 - d.y1), sp);
        hit(Math.hypot(q.x2 - d.x2, q.y2 - d.y2), sp);
      } else if (d.w != null) box(d, q, sp);
      else hit(Math.hypot(q.x - d.x, q.y - d.y), sp);
    });
    (sp.openings || []).forEach((o, j) => {
      const q = sq.openings[j];
      const h = (Number(o.length) || 0) / 2, R = Math.PI / 180;
      const e = (px, py, a, s) => [px + s * Math.cos(a * R) * h, py + s * Math.sin(a * R) * h];
      const same = Math.max(
        Math.hypot(...e(q.x, q.y, q.angle, 1).map((v, k) => v - e(o.x, o.y, o.angle, 1)[k])),
        Math.hypot(...e(q.x, q.y, q.angle, -1).map((v, k) => v - e(o.x, o.y, o.angle, -1)[k])));
      const flip = Math.max(
        Math.hypot(...e(q.x, q.y, q.angle, -1).map((v, k) => v - e(o.x, o.y, o.angle, 1)[k])),
        Math.hypot(...e(q.x, q.y, q.angle, 1).map((v, k) => v - e(o.x, o.y, o.angle, -1)[k])));
      hit(Math.min(same, flip), sp);
    });
  });
  return max;
};

test('AUD-158B1-01: the maximum is converted through the scale of ITS OWN space', () => {
  const spaces = [
    { id: 'first', cell_cm: 5, rooms: [{ id: 'a', poly: [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.2]] }] },
    { id: 'second', cell_cm: 100, rooms: [{ id: 'b',
      poly: [[0.2 + S / 2, 0.2], [0.3, 0.2], [0.3, 0.3], [0.2, 0.3]] }] },
  ];
  const { report } = alignAllToGrid(spaces, {});
  // half a step of a 100 cm cell is 50 cm — NOT the 2.5 cm of the first floor
  assert.ok(Math.abs(report.maxShiftCm - 50) < 1e-9, String(report.maxShiftCm));
  assert.equal(report.maxSpace, 'second');
});

test('AUD-158B1-01: a rect thinner than one step is measured AFTER it is widened', () => {
  const spaces = [{ id: 'f1', cell_cm: 5,
    rooms: [{ id: 'r', x: 0.5, y: 0.5, w: 0.001, h: 0.001 }] }];
  const before = JSON.parse(JSON.stringify(spaces));
  const res = alignAllToGrid(spaces, {});
  const real = reallyMovedCm(before, res.spaces);
  assert.ok(res.report.maxShiftCm + 1e-9 >= real,
    `promised ${res.report.maxShiftCm} cm, moved ${real} cm`);
});

test('AUD-158B1-01: a rect whose X and Y errors land on opposite corners', () => {
  // origin off in X only, far corner off in Y only → the mixed corner moves by
  // both at once, and that diagonal is the honest maximum
  const spaces = [{ id: 'f1', cell_cm: 5,
    rooms: [{ id: 'r', x: 0.25 + S * 0.4, y: 0.25, w: 0.1 - S * 0.4, h: 0.1 + S * 0.4 }] }];
  const before = JSON.parse(JSON.stringify(spaces));
  const res = alignAllToGrid(spaces, {});
  assert.ok(Math.abs(res.report.maxShift - S * 0.4 * Math.SQRT2) < 1e-12,
    String(res.report.maxShift / S));
  assert.ok(res.report.maxShiftCm + 1e-9 >= reallyMovedCm(before, res.spaces));
});

test('AUD-158B1-01: the promise is an upper bound for the whole detuned plan', () => {
  const cfg = detuned();
  const before = JSON.parse(JSON.stringify(cfg.spaces));
  const res = alignAllToGrid(cfg.spaces, detunedLayout());
  assert.ok(res.report.maxShiftCm + 1e-9 >= reallyMovedCm(before, res.spaces),
    `promised ${res.report.maxShiftCm} cm`);
});

// ---------------------------------------------------------------------------
// AUD-158B1-02 — an opening whose only error is its angle
// ---------------------------------------------------------------------------

test('AUD-158B1-02: an angle-only correction is a change and can be applied', () => {
  const spaces = [{ id: 'f1', cell_cm: 5,
    rooms: [{ id: 'r1', poly: [[0.2, 0.2], [0.5, 0.2], [0.5, 0.5], [0.2, 0.5]] }],
    openings: [{ id: 'o', type: 'window', x: 0.35, y: 0.2, angle: 90, length: 0.1 }] }];
  const res = alignAllToGrid(spaces, {});
  const o = res.spaces[0].openings[0];
  assert.equal(o.x, 0.35);                 // the centre was already right…
  assert.equal(o.y, 0.2);
  assert.equal(o.angle, 0);                // …only the angle was wrong
  assert.equal(res.changed, true, 'output differs but changed:false');
  assert.equal(res.report.moved, 1);
  assert.equal(res.report.rotated, 1);
  assert.ok(res.report.maxShiftCm > 0);    // its ENDS really do move
});

test('AUD-158B1-02: turning an opening end over end is not a move', () => {
  // 180 apart is the same segment on the same wall: it counts as a correction
  // (the field is rewritten) but it displaces nothing
  const spaces = [{ id: 'f1', cell_cm: 5,
    rooms: [{ id: 'r1', poly: [[0.2, 0.2], [0.5, 0.2], [0.5, 0.5], [0.2, 0.5]] }],
    openings: [{ id: 'o', type: 'window', x: 0.35, y: 0.2, angle: 180, length: 0.1 }] }];
  const res = alignAllToGrid(spaces, {});
  assert.equal(res.spaces[0].openings[0].angle, 0);
  assert.equal(res.changed, true);
  assert.equal(res.report.rotated, 1);
  assert.equal(res.report.maxShiftCm, 0);
});
