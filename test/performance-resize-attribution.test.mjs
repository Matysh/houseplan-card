import test from 'node:test';
import assert from 'node:assert/strict';
import { attributeResizeLongTask } from '../demo/performance/resize-attribution.mjs';

// #778: the shape of a real CI sample (Validate 36910217188, attempt 1,
// sample 0: 135 ms, physical preflight 94.6 ms) on a page clock starting at 1000.
const span = (name, startMs, endMs) => ({ name, startMs, endMs });
const moveSpans = (offset = 0) => [
  span('move', 1000.6 + offset, 1134.4 + offset),
  span('project', 1000.8 + offset, 1100.0 + offset),
  span('preflight', 1001.2 + offset, 1095.8 + offset),
  span('publish', 1100.0 + offset, 1101.5 + offset),
  span('labels', 1101.5 + offset, 1134.0 + offset),
];
const frame = (duration, renderStart, scripts) => ({ startTime: 1000, duration, renderStart, scripts });
const partsSum = (result) => ['preflightMs', 'projectOtherMs', 'publishMs', 'labelsMs',
  'moveOtherMs', 'updateMs', 'otherMs'].reduce((sum, key) => sum + result[key], 0);

test('the judged move task is split into its phases and the parts add up (#778)', () => {
  const result = attributeResizeLongTask({
    longTasks: [{ startTime: 1000, duration: 135 }],
    spans: [
      // pointerdown's work finished before the window: not this task.
      span('preflight', 990, 995),
      ...moveSpans(),
      // the cancel's settled render lands in a later, short task.
      span('update', 1300, 1305),
    ],
    frames: [frame(141, 1135.2, [
      { startTime: 1000, duration: 135, forcedStyleAndLayoutDuration: 0 },
      { startTime: 1135.3, duration: 4.5, forcedStyleAndLayoutDuration: 0.8 },
    ])],
  });
  assert.deepEqual(result, {
    supported: true,
    longTaskMs: 135,
    geometryMoves: 1,
    preflightMs: 94.6,
    projectOtherMs: 4.6,
    publishMs: 1.5,
    labelsMs: 32.5,
    moveOtherMs: 0.6,
    updateMs: 0,
    otherMs: 1.2,
    frameRenderMs: 5.8,
    forcedStyleLayoutMs: 0,
  });
  assert.equal(Number(partsSum(result).toFixed(1)), result.longTaskMs);
});

test('a judged task without the move never borrows the move phases (#778)', () => {
  // Negative witness: the move task is 120 ms, but a later 160 ms task (here
  // a settled render) is the longest one, so it is the task the gate judged.
  const result = attributeResizeLongTask({
    longTasks: [{ startTime: 1000, duration: 120 }, { startTime: 2000, duration: 160 }],
    spans: [...moveSpans(), span('update', 2001, 2150)],
    frames: null,
  });
  assert.equal(result.longTaskMs, 160);
  assert.equal(result.geometryMoves, 0);
  assert.equal(result.preflightMs, 0);
  assert.equal(result.labelsMs, 0);
  assert.equal(result.updateMs, 149);
  assert.equal(result.otherMs, 11);
  assert.equal(result.frameRenderMs, null);
  assert.equal(result.forcedStyleLayoutMs, null);
});

test('a stall outside the timed calls is reported as other, not as product work (#778)', () => {
  // The 163 ms CI sample had a normal preflight and +25 ms elsewhere; this is
  // how such a task reads when the extra time is outside every timed call.
  const result = attributeResizeLongTask({
    longTasks: [{ startTime: 1000, duration: 160 }],
    spans: moveSpans(25),
    frames: [],
  });
  assert.equal(result.geometryMoves, 1);
  assert.equal(result.preflightMs, 94.6);
  assert.equal(result.labelsMs, 32.5);
  assert.equal(result.otherMs, 26.2);
  assert.equal(result.frameRenderMs, null, 'no frame holds the task: unknown, not zero');
  assert.equal(Number(partsSum(result).toFixed(1)), result.longTaskMs);
});

test('missing browser support is reported instead of zero shares (#778)', () => {
  assert.deepEqual(
    attributeResizeLongTask({ longTasks: null, spans: moveSpans() }),
    { supported: false, reason: 'no Long Task entries' },
  );
  assert.deepEqual(
    attributeResizeLongTask({ longTasks: [], spans: null }),
    { supported: false, reason: 'no resize phase spans' },
  );
  // A fast runner without any Long Task has nothing to split: the phases are
  // unknown (null), not an invented zero split of a task that does not exist.
  const quiet = attributeResizeLongTask({ longTasks: [], spans: moveSpans() });
  assert.equal(quiet.supported, true);
  assert.equal(quiet.longTaskMs, 0);
  assert.equal(quiet.preflightMs, null);
  assert.equal(quiet.otherMs, null);
});
