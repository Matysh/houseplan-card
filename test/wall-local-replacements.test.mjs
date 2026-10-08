import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { union, difference } from 'polyclip-ts';
import { applyWallLocalReplacements } from '../test-build/wall-local-replacements.js';
import { buildNodePreview } from '../test-build/wall-node-preview.js';
import { wallBodiesGeometry } from '../test-build/wall-thickness.js';
import { GRID_STEP_N, GRID_PITCH, NORM_W } from '../test-build/space-geometry.js';
import { applyNodeMove, prepareNodeMove, structuralWallNodes } from '../test-build/wall-node-move.js';
import { canonicalizeConfigGeometryInPlace } from '../test-build/coordinate-canonicalization.js';

const rect = (x, y, w, h) => [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]];
const sequential = (body, replacements, restore) => {
  let current = body;
  for (const { cuts, pieces } of replacements) {
    for (const cut of cuts) current = difference(current, cut);
    for (const piece of pieces) current = union(current, piece);
  }
  return restore ? union(current, restore) : current;
};

test('834 local replacement composition preserves ordered overlapping masks, holes and protected restoration', () => {
  const body = difference(rect(0, 0, 30, 30), rect(10, 10, 10, 10));
  const replacements = [
    { cuts: [rect(2, 2, 10, 10)], pieces: [rect(3, 3, 8, 6)] },
    { cuts: [rect(6, 4, 10, 4), rect(0, 0, 1, 30)], pieces: [rect(6, 5, 2, 2)] },
    { cuts: [rect(5, 5, 1, 7)], pieces: [rect(35, 0, 2, 2)] },
  ];
  const restore = rect(0, 0, 1, 5), frozen = structuredClone([body, replacements, restore]);
  const actual = applyWallLocalReplacements(body, replacements, restore);
  const expected = sequential(body, replacements, restore);
  assert.deepEqual(difference(actual, expected), []);
  assert.deepEqual(difference(expected, actual), []);
  assert.notDeepEqual(actual, sequential(body, [...replacements].reverse(), restore), 'negative control: order matters');
  assert.deepEqual([body, replacements, restore], frozen);
  assert.equal(actual.length, expected.length, 'component count matches the ordered reference');
  assert.deepEqual(difference(rect(35, 0, 2, 2), actual), [], 'independent retained material survives');
});

const area = geometry => geometry.reduce((sum, polygon) => sum + polygon.reduce((total, ring, index) => {
  const [ox, oy] = ring[0];
  const twice = ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + (p[0] - ox) * (q[1] - oy) - (q[0] - ox) * (p[1] - oy);
  }, 0);
  return total + (index ? -1 : 1) * Math.abs(twice) / 2;
}, 0), 0);

test('834 real short-support trims match the historical fallback after an injected composition failure', () => {
  const space = JSON.parse(readFileSync(new URL('./fixtures/834-node-connected.json', import.meta.url))).spaces[0];
  const point = [-401 / 240, 928 / 240], nodes = structuralWallNodes(space);
  const node = nodes.find(n => n.point.every((v, i) => Math.abs(v - point[i]) < 1e-8));
  const plan = prepareNodeMove(space, node, nodes, {});
  for (const offset of [1, 53, 54, 59, 60, 100]) {
    const candidate = applyNodeMove(plan, [point[0], point[1] + offset / 240], null);
    assert.ok(candidate.ok);
    canonicalizeConfigGeometryInPlace({ spaces: [candidate.space] });
    const { model, input, geometry: actual } = buildNodePreview(candidate.space);
    let fallbacks = 0;
    const expected = wallBodiesGeometry(model.rooms, input.walls, input.openCuts, input.roomOpenings,
      GRID_STEP_N, input.cellCm, GRID_PITCH, NORM_W, input.physicalBodies, {
        composeLocalReplacements: () => { fallbacks++; throw new Error('injected local composition failure'); },
      });
    assert.ok(fallbacks > 0, 'the real fixture has targeted short-support trims');
    assert.equal(actual.status, 'ok');
    assert.equal(expected.status, 'ok', 'a failed optimization retains the proven historical geometry');
    for (const key of ['geom', 'roomGeom', 'paperGeom']) {
      const a = actual[key], b = expected[key];
      assert.deepEqual(a.map(p => p.length).sort((x, y) => x - y), b.map(p => p.length).sort((x, y) => x - y), `${offset}: ${key} topology`);
      assert.ok(Math.abs(area(a) - area(b)) <= Math.max(1, area(b)) * 1e-9, `${offset}: ${key} area`);
    }
  }
});
