import test from 'node:test';
import assert from 'node:assert/strict';
import { difference, intersection, union } from 'polyclip-ts';
import { subtractNodeOpeningCuts } from '../test-build/wall-node-openings.js';
import { withWallBooleanBaseline } from '../test-build/wall-boolean-cache.js';
import { WallBooleanBaseline } from '../test-build/wall-boolean-baseline.js';

const rect = (x, y, w, h) => [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]];
const equalMaterial = (actual, expected) => {
  assert.deepEqual(difference(actual, expected), [], 'no extra masonry over any opening');
  assert.deepEqual(difference(expected, actual), [], 'no missing jambs or filled room holes');
};

test('834 one canonical opening mask preserves overlapping slots, jambs, room holes and remote components', () => {
  const body = union(difference(rect(0, 0, 100, 100), rect(10, 10, 80, 80)), rect(130, 20, 8, 8));
  const cuts = Array.from({ length: 14 }, (_, i) => rect(3 + i * 6, -4, 2, 20));
  cuts.push(rect(3, -4, 3, 20), rect(132, 18, 2, 12), rect(200, 0, 2, 2));
  const original = structuredClone([body, cuts]);
  equalMaterial(subtractNodeOpeningCuts(body, cuts), cuts.reduce((current, cut) => difference(current, cut), body));
  assert.strictEqual(subtractNodeOpeningCuts(body, []), body);
  equalMaterial(subtractNodeOpeningCuts(body, [cuts[0]]), difference(body, cuts[0]));
  assert.deepEqual([body, cuts], original);
});

test('834 opening mask reuses the frozen baseline while a different body is independently cut', () => {
  const first = union(rect(0, 0, 10, 10)), next = union(rect(0, 0, 12, 10));
  const cuts = [rect(1, -1, 1, 3), rect(5, -1, 1, 3)], baseline = new WallBooleanBaseline();
  withWallBooleanBaseline(baseline, true, () => subtractNodeOpeningCuts(first, cuts));
  const hits = baseline.counts.hits;
  const result = withWallBooleanBaseline(baseline, false, () => subtractNodeOpeningCuts(next, cuts));
  assert.equal(baseline.counts.hits - hits, 1, 'only the exact unchanged mask is reused, not the changed body subtraction');
  equalMaterial(result, difference(next, ...cuts));
});

test('834 any mask-stage failure replays all mandatory cuts; malformed cuts still refuse', () => {
  const body = union(rect(0, 0, 10, 10)), cuts = [rect(1, -1, 1, 3), rect(5, -1, 1, 3)];
  const operations = { union, difference, intersection };
  for (const failedCall of [1, 2]) {
    let calls = 0;
    const scope = { apply(kind, operands) {
      if (++calls === failedCall) throw new Error('mask operation failed');
      return operations[kind](...operands);
    } };
    const actual = withWallBooleanBaseline(scope, false, () => subtractNodeOpeningCuts(body, cuts));
    equalMaterial(actual, difference(body, ...cuts));
    assert.ok(calls > failedCall, 'the existing mandatory cut path actually executes');
  }
  const malformed = [[[Number.NaN, 0], [2, 0], [2, 2], [Number.NaN, 0]]];
  assert.throws(() => subtractNodeOpeningCuts(body, [...cuts, malformed]));
  assert.deepEqual(body, union(rect(0, 0, 10, 10)), 'refusal leaves the previous body intact');
});
