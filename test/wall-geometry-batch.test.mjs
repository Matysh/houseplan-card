import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { union, difference, intersection } from 'polyclip-ts';
import { unionWallCornerPieces, unionClippedWallCornersSequential, subtractWallOpeningCuts } from '../test-build/wall-geometry-batch.js';
import { unionClippedWallCorners } from '../test-build/wall-node-corners.js';
import { withWallBooleanBaseline } from '../test-build/wall-boolean-cache.js';
import { WallBooleanBaseline } from '../test-build/wall-boolean-baseline.js';
import { buildNodePreview } from '../test-build/wall-node-preview.js';
import { applyNodeMove, prepareNodeMove, structuralWallNodes } from '../test-build/wall-node-move.js';
import { canonicalizeConfigGeometryInPlace } from '../test-build/coordinate-canonicalization.js';
import { wallBodiesGeometry } from '../test-build/wall-thickness.js';
import { wallQuadCovered } from '../test-build/wall-quad-coverage.js';
import { GRID_STEP_N, GRID_PITCH, NORM_W } from '../test-build/space-geometry.js';

const rect = (x, y, w, h) => [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]];
const equalAreaAndHoles = (actual, expected) => {
  assert.deepEqual(difference(actual, expected), [], 'no extra material');
  assert.deepEqual(difference(expected, actual), [], 'no lost material or filled holes');
};

test('834 common fan clipping preserves material, holes, touching and distant components', () => {
  const body = difference(rect(0, 0, 100, 100), rect(10, 10, 80, 80));
  const bound = union(rect(-1, -1, 102, 102), rect(130, 20, 4, 4));
  const fans = Array.from({ length: 29 }, (_, i) => rect(i * 3, -2, 1, 4));
  fans.push(rect(130, 20, 8, 8), rect(150, 20, 1, 1));
  const frozen = structuredClone([body, fans, bound]);
  const expected = fans.reduce((current, fan) => union(current, intersection(fan, bound)), body);
  equalAreaAndHoles(unionClippedWallCorners(body, fans, bound), expected);
  equalAreaAndHoles(unionClippedWallCorners(null, fans, bound), intersection(union(fans[0], ...fans.slice(1)), bound));
  equalAreaAndHoles(unionClippedWallCorners(body, fans, null), union(body, ...fans));
  assert.strictEqual(unionClippedWallCorners(body, [], bound), body);
  assert.deepEqual([body, fans, bound], frozen);
});

test('834 every grouped corner failure, including final union, replays per-fan clipping', () => {
  const body = union(rect(0, 0, 10, 10));
  const pieces = [union(rect(-2, -1, 5, 3)), union(rect(8, -1, 5, 3))];
  const bound = union(rect(-1, 0, 12, 12));
  const expected = pieces.reduce((current, fan) => union(current, intersection(fan, bound)), body);
  for (const failedCall of [1, 2, 3]) {
    let calls = 0;
    const operations = { union, intersection, difference };
    const scope = { apply(kind, operands) {
      if (++calls === failedCall) throw new Error(`grouped stage ${failedCall}`);
      return operations[kind](...operands);
    } };
    const actual = withWallBooleanBaseline(scope, false, () => unionClippedWallCorners(body, pieces, bound));
    equalAreaAndHoles(actual, expected);
    assert.ok(calls > 3, 'the original per-fan operations actually run after the injected failure');
  }
  const malformed = [[[Number.NaN, 0], [2, 0], [2, 2], [Number.NaN, 0]]];
  equalAreaAndHoles(unionClippedWallCorners(body, [malformed, ...pieces], bound), expected);
});

test('834 batched exact corner unions preserve sequential material, holes and disconnected components', () => {
  const roomRing = difference(rect(0, 0, 100, 100), rect(10, 10, 80, 80));
  const fans = Array.from({ length: 29 }, (_, i) => rect(i * 3, -2, 1, 4));
  fans.push(rect(130, 20, 4, 4));
  const frozen = structuredClone([roomRing, fans]);
  const expected = fans.reduce((current, fan) => union(current, fan), roomRing);
  const actual = unionWallCornerPieces(roomRing, fans);
  equalAreaAndHoles(actual, expected);
  assert.deepEqual([roomRing, fans], frozen, 'batching never mutates the baseline or operands');
  assert.equal(actual.length, 2, 'remote independent component survives');
  assert.equal(actual[0].length, 2, 'the room interior is still a hole');
});

test('834 batched opening subtraction retains every jamb and the original room hole', () => {
  const body = difference(rect(0, 0, 100, 100), rect(10, 10, 80, 80));
  const slots = Array.from({ length: 14 }, (_, i) => rect(3 + i * 6, -4, 2, 20));
  const frozen = structuredClone([body, slots]);
  const expected = slots.reduce((current, slot) => difference(current, slot), body);
  const actual = subtractWallOpeningCuts(body, slots);
  equalAreaAndHoles(actual, expected);
  assert.deepEqual([body, slots], frozen);
  for (const slot of slots) assert.deepEqual(difference(slot, difference(slot, actual)), [], 'no masonry remains in any opening');
  assert.strictEqual(subtractWallOpeningCuts(body, []), body);
});

test('834 a malformed optional fan stays isolated, but a mandatory opening failure remains fail closed', () => {
  const body = rect(0, 0, 10, 10), good = rect(10, 0, 4, 4), malformed = [[[Number.NaN, 0], [2, 0], [2, 2], [Number.NaN, 0]]];
  equalAreaAndHoles(unionWallCornerPieces(body, [malformed, good]), union(body, good));
  assert.throws(() => subtractWallOpeningCuts(body, [good, malformed]));
});

test('834 connected floor batched corners/openings match independent sequential boolean material and topology', () => {
  const space = JSON.parse(readFileSync(new URL('./fixtures/834-node-connected.json', import.meta.url))).spaces[0];
  const point = [-401 / 240, 928 / 240], nodes = structuralWallNodes(space);
  const node = nodes.find(n => n.point.every((v, i) => Math.abs(v - point[i]) < 1e-8));
  const plan = prepareNodeMove(space, node, nodes, {});
  const area = geometry => geometry.reduce((sum, polygon) => sum + polygon.reduce((total, ring, index) => {
    const [ox, oy] = ring[0];
    const twice = ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return sum + (p[0] - ox) * (q[1] - oy) - (q[0] - ox) * (p[1] - oy);
    }, 0);
    return total + (index ? -1 : 1) * Math.abs(twice) / 2;
  }, 0), 0);
  for (const offset of [53, 54, 60]) {
    const candidate = applyNodeMove(plan, [point[0], point[1] + offset / 240], null);
    assert.ok(candidate.ok);
    canonicalizeConfigGeometryInPlace({ spaces: [candidate.space] });
    const actual = buildNodePreview(candidate.space);
    const sequential = new WallBooleanBaseline(), operation = sequential.apply.bind(sequential);
    sequential.apply = (kind, operands, record) => operands.length > 2
      ? operands.slice(1).reduce((current, operand) => operation(kind, [current, operand], record), operands[0])
      : operation(kind, operands, record);
    const { model, input } = actual;
    const expected = { geometry: withWallBooleanBaseline(sequential, false, () => wallBodiesGeometry(
      model.rooms, input.walls, input.openCuts, input.roomOpenings,
      GRID_STEP_N, input.cellCm, GRID_PITCH, NORM_W, input.physicalBodies,
      { coveredQuad: wallQuadCovered, clipCorners: unionClippedWallCornersSequential },
    )) };
    assert.equal(actual.geometry.status, 'ok');
    assert.equal(expected.geometry.status, 'ok');
    for (const key of ['geom', 'roomGeom', 'paperGeom']) {
      const a = actual.geometry[key], b = expected.geometry[key];
      assert.deepEqual(a.map(p => p.length).sort((x, y) => x - y), b.map(p => p.length).sort((x, y) => x - y), `${offset}: ${key} holes/components`);
      assert.ok(Math.abs(area(a) - area(b)) <= Math.max(1, area(b)) * 1e-9, `${offset}: ${key} physical area`);
    }
  }
});
