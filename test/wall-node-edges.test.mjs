import test from 'node:test';
import assert from 'node:assert/strict';
import { union, difference, intersection } from 'polyclip-ts';
import { unionNodeEdgeBodies } from '../test-build/wall-node-edges.js';
import { intersectLocalWallGeometry, unionLocalWallGeometry } from '../test-build/wall-local-boolean.js';
import { wallQuadCovered } from '../test-build/wall-quad-coverage.js';
import { withWallBooleanBaseline } from '../test-build/wall-boolean-cache.js';

const quad = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const closed = q => [[...q, q[0]]];
const rect = (...args) => closed(quad(...args));
const operations = { union, difference, intersection };
const sameRegions = (a, b) => {
  assert.deepEqual(difference(a, b), [], 'no extra material or filled hole');
  assert.deepEqual(difference(b, a), [], 'no missing strip or changed hole ownership');
};
const sequential = (body, quads, centre) => {
  let current = body;
  for (const q of quads) {
    if (current && wallQuadCovered(q, current)) continue;
    try {
      const piece = intersectLocalWallGeometry(closed(q), centre);
      current = current ? unionLocalWallGeometry(current, piece) : piece;
    } catch { /* Historical per-edge isolation. */ }
  }
  return current;
};

test('864 grouped edge clipping preserves holes, bays, islands, touching and separate components', () => {
  const body = union(difference(rect(0, 0, 20, 20), rect(2, 2, 16, 16)), rect(7, 7, 2, 2));
  const centre = union(difference(rect(-1, -1, 40, 22), rect(22, 4, 10, 10)), rect(60, 0, 10, 10));
  const quads = [quad(-3, 0, 10, 2), quad(18, 0, 20, 2), quad(20, 0, 2, 20),
    quad(37, 0, 5, 20), quad(20, 18, 18, 2), quad(59, 1, 4, 2), quad(90, 0, 4, 4)];
  const frozen = structuredClone([body, quads, centre]);
  for (const subject of [body, null]) {
    const actual = unionNodeEdgeBodies(subject, quads, centre);
    sameRegions(actual, sequential(subject, quads, centre));
    assert.deepEqual(intersection(actual, rect(22, 4, 10, 10)), [], 'centre hole stays empty');
    assert.deepEqual(intersection(actual, rect(39, -3, 5, 20)), [], 'strips outside facade are clipped');
    assert.deepEqual(intersection(actual, rect(90, 0, 4, 4)), [], 'disconnected exterior strip is not masonry');
  }
  assert.deepEqual([body, quads, centre], frozen);
  assert.strictEqual(unionNodeEdgeBodies(body, [], centre), body);
  assert.strictEqual(unionNodeEdgeBodies(body, [quad(0, 0, 10, 1)], centre), body);
  assert.equal(unionNodeEdgeBodies(null, [], centre), null);
  sameRegions(unionNodeEdgeBodies(null, [quad(59, 1, 4, 2)], centre), intersection(rect(59, 1, 4, 2), centre));
});

test('864 edge batch uses three real sweeps rather than repeatedly sweeping the growing body', () => {
  const body = union(rect(0, 0, 1, 20)), centre = union(rect(0, 0, 100, 20));
  const quads = Array.from({ length: 8 }, (_, i) => quad(i * 10, 0, 11, 2));
  const run = callback => {
    const calls = [];
    const scope = { apply(kind, operands) { calls.push({ kind, arity: operands.length }); return operations[kind](...operands); } };
    return { result: withWallBooleanBaseline(scope, false, callback), calls };
  };
  const batch = run(() => unionNodeEdgeBodies(body, quads, centre));
  const old = run(() => sequential(body, quads, centre));
  sameRegions(batch.result, old.result);
  assert.deepEqual(batch.calls, [{ kind: 'union', arity: 8 }, { kind: 'intersection', arity: 2 }, { kind: 'union', arity: 2 }]);
  assert.ok(old.calls.length > batch.calls.length, 'counted delegates execute the original geometry, not callback stubs');
});

test('864 every grouped edge failure replays the whole original coverage clipping and union phase', () => {
  const body = union(rect(0, 0, 2, 10)), centre = union(rect(0, 0, 20, 20));
  const quads = [quad(1, 0, 4, 2), quad(4, 0, 4, 2), quad(7, 0, 4, 2)];
  const frozen = structuredClone([body, quads, centre]);
  const expected = sequential(body, quads, centre);
  for (const failedCall of [1, 2, 3]) {
    let count = 0;
    const scope = { apply(kind, operands) {
      if (++count === failedCall) throw new Error(`failed grouped stage ${failedCall}`);
      return operations[kind](...operands);
    } };
    sameRegions(withWallBooleanBaseline(scope, false, () => unionNodeEdgeBodies(body, quads, centre)), expected);
    assert.ok(count > 3, 'historical delegates run after failure, not an accepted incomplete body');
  }
  assert.deepEqual([body, quads, centre], frozen);
});

test('864 fallback isolates an individual failed edge and still merges the following edge', () => {
  const body = union(rect(0, 0, 2, 10)), centre = union(rect(0, 0, 20, 20));
  const quads = [quad(1, 0, 4, 2), quad(4, 0, 4, 2), quad(4, 1, 7, 2)];
  const trace = [];
  let groupedFailed = false, isolatedFailed = false;
  const isolated = union(closed(quads[1]));
  const scope = { apply(kind, operands) {
    trace.push({ kind, operands: structuredClone(operands) });
    if (!groupedFailed) { groupedFailed = true; throw new Error('grouped union failed'); }
    if (!isolatedFailed && kind === 'union' && operands.length === 2 && JSON.stringify(operands[1]) === JSON.stringify(isolated)) {
      isolatedFailed = true; throw new Error('second individual union failed');
    }
    return operations[kind](...operands);
  } };
  const actual = withWallBooleanBaseline(scope, false, () => unionNodeEdgeBodies(body, quads, centre));
  assert.equal(isolatedFailed, true, 'the individual optional merge really failed');
  sameRegions(actual, union(body, rect(1, 0, 4, 2), rect(4, 1, 7, 2)));
  const replay = trace.slice(1).filter(entry => entry.operands.length > 1);
  assert.deepEqual(replay.map(entry => entry.kind), ['intersection', 'union', 'intersection', 'union', 'intersection', 'union']);
  assert.deepEqual(replay[4].operands[0], union(closed(quads[2])), 'following edge still clips after the failed optional merge');
  const malformed = [[NaN, 0], [2, 0], [2, 2], [0, 2]];
  sameRegions(unionNodeEdgeBodies(body, [malformed, ...quads], centre), sequential(body, quads, centre));
});
