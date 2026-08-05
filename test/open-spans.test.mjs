import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampToEdgeEnds, snapOpenPoint, resolveOpenCuts, hitSharedWall, hitOuterWall,
  clearThicknessUnderSpan, thicknessOnClose, purgeOpeningsOnSpan, pointOnOpenCut,
  spanToEntry, entryToSeg, syncOpenToFromCuts, removeCut, hitOpenSpan,
} from '../test-build/open-spans.js';
import { wallKey, setWallThickness, DRAW_WALL_DEFAULT_CM } from '../test-build/wall-thickness.js';

const pitch = 0.01;
const scale = 1000;
const eps = 0.02;

describe('open-spans', () => {
  it('clampToEdgeEnds keeps point on the edge', () => {
    const edge = [0, 0, 10, 0];
    const q = clampToEdgeEnds([5, 3], edge);
    assert.equal(q[0], 5);
    assert.equal(q[1], 0);
    const past = clampToEdgeEnds([20, 1], edge);
    assert.equal(past[0], 10);
  });

  it('snapOpenPoint prefers a joint over the grid', () => {
    const edge = [0, 0, 10, 0];
    const joints = [[0, 0], [10, 0], [4, 0]];
    const p = snapOpenPoint([4.1, 0.2], edge, joints, 1, 0.5);
    assert.ok(Math.abs(p[0] - 4) < 1e-9);
  });

  it('resolveOpenCuts: legacy open_to expands to full shared boundary', () => {
    const rooms = [
      { id: 'a', poly: [[0, 0], [5, 0], [5, 4], [0, 4]] },
      { id: 'b', poly: [[5, 0], [10, 0], [10, 4], [5, 4]], open_to: ['a'] },
    ];
    rooms[0].open_to = ['b'];
    const cuts = resolveOpenCuts(rooms, null, 1, eps);
    assert.equal(cuts.length, 1);
    assert.ok(Math.abs(cuts[0][0] - 5) < 1e-6);
  });

  it('resolveOpenCuts: explicit spans win over legacy', () => {
    const rooms = [
      { id: 'a', poly: [[0, 0], [5, 0], [5, 4], [0, 4]], open_to: ['b'] },
      { id: 'b', poly: [[5, 0], [10, 0], [10, 4], [5, 4]], open_to: ['a'] },
    ];
    const spans = [spanToEntry([5, 0], [5, 2], 1)];
    const cuts = resolveOpenCuts(rooms, spans, 1, eps);
    assert.equal(cuts.length, 1);
    assert.ok(Math.abs(cuts[0][3] - 2) < 1e-6);
  });

  it('hitSharedWall vs hitOuterWall', () => {
    const rooms = [
      { id: 'a', poly: [[0, 0], [5, 0], [5, 4], [0, 4]] },
      { id: 'b', poly: [[5, 0], [10, 0], [10, 4], [5, 4]] },
    ];
    const sh = hitSharedWall([5, 2], rooms, 0.5, eps);
    assert.ok(sh);
    assert.equal(sh.a.id, 'a');
    const outer = hitOuterWall([0, 2], rooms, 0.5, eps);
    assert.ok(outer);
    assert.equal(outer.room.id, 'a');
    assert.equal(hitSharedWall([0, 2], rooms, 0.5, eps), null);
  });

  it('clearThicknessUnderSpan drops matching wall keys', () => {
    const key = wallKey([5, 0], [5, 4], pitch);
    let walls = [{ key, cm: 20 }];
    walls = clearThicknessUnderSpan(walls, [5, 1], [5, 2], pitch, 1);
    assert.equal(walls.length, 0);
  });

  it('thicknessOnClose uses neighbour cm else default', () => {
    const neighKey = wallKey([5, 2], [5, 4], pitch);
    const walls = [{ key: neighKey, cm: 25 }];
    const cm = thicknessOnClose(
      walls, [5, 0, 5, 2],
      [[5, 2, 5, 4]],
      pitch, 1, DRAW_WALL_DEFAULT_CM,
    );
    assert.equal(cm, 25);
    const def = thicknessOnClose([], [5, 0, 5, 4], [], pitch, 1, DRAW_WALL_DEFAULT_CM);
    assert.equal(def, DRAW_WALL_DEFAULT_CM);
  });

  it('purgeOpeningsOnSpan removes openings on the stretch', () => {
    const openings = [
      { id: '1', x: 0.005, y: 0.002, angle: 90 }, // on x=5 if scale=1000 → wait normalised
      { id: '2', x: 0.9, y: 0.9, angle: 0 },
    ];
    // span in render: x=5, y=0..4 with scale 1000 → norm a=[0.005,0], b=[0.005,0.004]
    const span = [5, 0, 5, 4];
    const left = purgeOpeningsOnSpan(
      [{ id: '1', x: 5 / 1000, y: 2 / 1000, angle: 90 }, { id: '2', x: 0.9, y: 0.9, angle: 0 }],
      span, 1000, 0.5,
    );
    assert.equal(left.length, 1);
    assert.equal(left[0].id, '2');
  });

  it('pointOnOpenCut detects placement on virtual', () => {
    assert.equal(pointOnOpenCut(5, 2, 90, [[5, 0, 5, 4]], 0.5), true);
    assert.equal(pointOnOpenCut(0, 2, 90, [[5, 0, 5, 4]], 0.5), false);
  });

  it('syncOpenToFromCuts links rooms that share a cut', () => {
    const cfg = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    const model = [
      { id: 'a', poly: [[0, 0], [5, 0], [5, 4], [0, 4]] },
      { id: 'b', poly: [[5, 0], [10, 0], [10, 4], [5, 4]] },
    ];
    syncOpenToFromCuts(cfg, model, [[5, 0, 5, 2]], eps);
    assert.ok(cfg[0].open_to.includes('b'));
    assert.ok(cfg[1].open_to.includes('a'));
    syncOpenToFromCuts(cfg, model, [], eps);
    assert.equal(cfg[0].open_to, undefined);
  });

  it('removeCut / hitOpenSpan', () => {
    const cuts = [[5, 0, 5, 2], [5, 2, 5, 4]];
    assert.ok(hitOpenSpan([5, 1], cuts, 0.5));
    const next = removeCut(cuts, [5, 0, 5, 2], eps);
    assert.equal(next.length, 1);
  });

  it('entry round-trip', () => {
    const e = spanToEntry([100, 200], [100, 400], scale);
    const sg = entryToSeg(e, scale);
    assert.ok(Math.abs(sg[1] - 200) < 1e-6);
    assert.ok(Math.abs(sg[3] - 400) < 1e-6);
  });

  it('setWallThickness still works with cleared list', () => {
    let w = setWallThickness([], [0, 0], [1, 0], 15, pitch, 1);
    assert.equal(w.length, 1);
    w = clearThicknessUnderSpan(w, [0, 0], [1, 0], pitch, 1);
    assert.equal(w.length, 0);
  });
});
