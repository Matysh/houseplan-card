import test from 'node:test';
import assert from 'node:assert/strict';
import { union, difference, intersection } from 'polyclip-ts';
import { subtractNodeRoomMasonry } from '../test-build/wall-node-room-floor.js';
import { subtractLocalWallGeometry } from '../test-build/wall-local-boolean.js';
import { withWallBooleanBaseline } from '../test-build/wall-boolean-cache.js';

const rect = (x, y, w, h) => [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]];
const equivalent = (actual, expected) => {
  assert.deepEqual(difference(actual, expected), [], 'no additional floor');
  assert.deepEqual(difference(expected, actual), [], 'no lost floor or filled floor holes');
  assert.deepEqual(actual.map(p => p.length).sort(), expected.map(p => p.length).sort(), 'same components and holes');
};
const captureSubtraction = run => {
  const clips = [], operations = { union, difference, intersection };
  const result = withWallBooleanBaseline({ apply(kind, operands) {
    if (kind === 'difference') clips.push(structuredClone(operands[1]));
    return operations[kind](...operands);
  } }, false, run);
  return { result, clips };
};

test('834 Select floor locality removes only strictly remote masonry holes', () => {
  const masonry = difference(rect(-10, -10, 100, 100), rect(1, 1, 5, 5), rect(10, 2, 5, 5), rect(30, 30, 5, 5));
  const subject = rect(0, 0, 10, 10), frozen = structuredClone([subject, masonry]);
  const { result, clips } = captureSubtraction(() => subtractNodeRoomMasonry(subject, masonry));
  equivalent(result, subtractLocalWallGeometry(subject, masonry));
  assert.equal(clips[0][0].length, 3, 'outer + local hole + exactly touching hole; remote hole omitted');
  assert.deepEqual(clips[0][0][0], masonry[0][0], 'the complete outer masonry boundary is never simplified');
  assert.deepEqual([subject, masonry], frozen);
});

test('834 enclosing, concave, nested, disconnected and touching floors keep exact canonical subtraction', () => {
  const concave = [[[0, 0], [12, 0], [12, 4], [4, 4], [4, 12], [0, 12], [0, 0]]];
  const masonry = union(difference(rect(-20, -20, 100, 100), rect(-2, -2, 16, 16), rect(30, 30, 5, 5)), rect(2, 2, 2, 2));
  const subjects = [rect(0, 0, 10, 10), concave, difference(rect(0, 0, 10, 10), rect(3, 3, 3, 3)),
    union(rect(0, 0, 10, 10), rect(30, 30, 5, 5)), rect(-2, -2, 16, 16)];
  for (const subject of subjects) equivalent(subtractNodeRoomMasonry(subject, masonry), subtractLocalWallGeometry(subject, masonry));
  assert.deepEqual(subtractNodeRoomMasonry(rect(0, 0, 2, 2), []), union(rect(0, 0, 2, 2)));
  assert.deepEqual(subtractNodeRoomMasonry([], masonry), []);
});

test('834 ambiguous remote rings keep the complete historical operand and validation', () => {
  const subject = rect(0, 0, 10, 10);
  const outer = rect(-20, -20, 100, 100)[0];
  const ambiguous = [
    [[30, 30], [35, 30], [35, 35], [30, 35]], // unclosed
    [[30, 30], [35, 35], [30, 35], [35, 30], [30, 30]], // zero-area crossing
    [[30, 30], [35, 30], [30, 30]],
  ];
  for (const ring of ambiguous) {
    const clipping = [[outer, ring]], seen = [];
    const operations = { union, intersection, difference };
    const scope = { apply(kind, operands) {
      if (kind === 'difference') { seen.push(operands[1]); throw new Error('historical validator witness'); }
      return operations[kind](...operands);
    } };
    assert.throws(() => withWallBooleanBaseline(scope, false, () => subtractNodeRoomMasonry(subject, clipping)), /historical validator witness/);
    assert.deepEqual(seen[0], clipping, 'the ambiguous remote ring reaches the old validator unchanged');
  }
  const nonfinite = [[outer, [[30, 30], [35, 30], [35, Number.NaN], [30, 30]]]];
  assert.deepEqual(subtractNodeRoomMasonry(subject, nonfinite), subtractLocalWallGeometry(subject, nonfinite),
    'nonfinite input follows the historical path, never a filtered finite replacement');
});
