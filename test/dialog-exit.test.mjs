import assert from 'node:assert/strict';
import test from 'node:test';
import { DialogExitController } from '../test-build/dialog-exit.js';

function fixture() {
  const timers = [];
  const controller = new DialogExitController((callback, delay) => {
    const timer = { callback, delay, cancelled: false };
    timers.push(timer);
    return () => { timer.cancelled = true; };
  });
  return { controller, timers };
}

test('#976 repeated accepted exit shares one terminal and clears its bounded timer', async () => {
  const { controller, timers } = fixture();
  const first = controller.begin(400);
  assert.equal(controller.begin(400), first);
  assert.equal(timers.length, 1);
  let completions = 0;
  first.finished.then(() => completions++);
  first.complete(); first.complete(); timers[0].callback();
  await first.finished;
  assert.equal(completions, 1);
  assert.equal(timers[0].cancelled, true);
  assert.equal(controller.current, null);
});

test('#976 cancelled old animation/deadline cannot complete a reopened dialog exit', async () => {
  const { controller, timers } = fixture();
  const old = controller.begin(400);
  controller.cancel();
  await old.finished;
  const current = controller.begin(400);
  let completed = false;
  current.finished.then(() => { completed = true; });
  old.complete(); timers[0].callback();
  await Promise.resolve();
  assert.equal(completed, false);
  assert.equal(controller.current, current);
  timers[1].callback();
  await current.finished;
  assert.equal(completed, true);
});

test('#976 missing completion event has a finite deadline; zero-motion exit schedules nothing', async () => {
  const { controller, timers } = fixture();
  const run = controller.begin(400);
  assert.equal(timers[0].delay, 400);
  timers[0].callback();
  await run.finished;
  await controller.begin(0).finished;
  assert.equal(timers.length, 1);
  assert.equal(controller.current, null);
});
