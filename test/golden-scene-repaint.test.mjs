import assert from 'node:assert/strict';
import test from 'node:test';
import { captureGoldenFrame } from '../demo/golden/scene-repaint.mjs';
import { GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';

const target = GOLDEN_SCENARIOS.find(({ id }) => id === 'device-battery-zigbee-overlap-dark');
const optedIds = ['device-battery-zigbee-overlap-dark', 'opening-placement-door-thick-wall-dark',
  'opening-placement-passage-thick-wall-dark', 'opening-placement-passage-thick-wall-light',
  'plan-snap-line-gaps-dark'];

// Execute the very callback sent to Chromium. The fake frame scheduler records
// what would be painted at each frame, not a regex over the implementation.
async function withPage({ value = '#11151b', priority = '', failFrame = 0,
  background = 'rgb(17, 21, 27)', failScreenshot = false } = {}, check) {
  const saved = Object.fromEntries(['document', 'getComputedStyle', 'requestAnimationFrame']
    .map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const frames = [];
  let inlineValue = value, inlinePriority = priority, evaluations = 0, screenshots = 0;
  const style = {
    getPropertyValue: () => inlineValue,
    getPropertyPriority: () => inlinePriority,
    setProperty(property, next, nextPriority) {
      assert.equal(property, '--hp-golden-page-bg');
      inlineValue = next;
      inlinePriority = nextPriority;
    },
    removeProperty(property) {
      assert.equal(property, '--hp-golden-page-bg');
      inlineValue = inlinePriority = '';
    },
  };
  const options = { clip: { x: 4, y: 8, width: 120, height: 70 }, scale: 'css',
    animations: 'disabled', caret: 'hide' };
  const png = Buffer.from('unchanged screenshot result');
  globalThis.document = { documentElement: { style }, body: {} };
  globalThis.getComputedStyle = () => ({ backgroundColor: background });
  globalThis.requestAnimationFrame = (done) => {
    frames.push([inlineValue, inlinePriority]);
    if (frames.length === failFrame) throw new Error('frame failed');
    queueMicrotask(done);
  };
  const page = {
    async evaluate(callback) { evaluations++; return callback(); },
    async screenshot(actualOptions) {
      screenshots++;
      assert.strictEqual(actualOptions, options);
      assert.deepEqual([inlineValue, inlinePriority], [value, priority]);
      if (failScreenshot) throw new Error('screenshot failed');
      return png;
    },
  };
  try {
    await check({ page, options, png, frames,
      state: () => ({ inlineValue, inlinePriority, evaluations, screenshots }) });
  } finally {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

test('each proven opted-in scene restores the original paint before the unchanged capture', async () => {
  for (const id of optedIds) {
    const scenario = GOLDEN_SCENARIOS.find((entry) => entry.id === id);
    assert.ok(scenario, id);
    await withPage({}, async ({ page, options, png, frames, state }) => {
      assert.strictEqual(await captureGoldenFrame(page, scenario, options), png);
      assert.deepEqual(frames, [
        ['rgb(1, 2, 3)', 'important'], ['rgb(1, 2, 3)', 'important'],
        ['#11151b', ''], ['#11151b', ''],
      ]);
      assert.equal(state().evaluations, 1);
      assert.equal(state().screenshots, 1);
    });
  }
});

test('every other matrix scene keeps the original screenshot path without evaluate or repaint', async () => {
  await withPage({}, async ({ page, options, png, frames, state }) => {
    const otherScenes = GOLDEN_SCENARIOS.filter(({ id }) => !optedIds.includes(id));
    assert.equal(otherScenes.length, GOLDEN_SCENARIOS.length - optedIds.length);
    for (const scenario of otherScenes)
      assert.strictEqual(await captureGoldenFrame(page, scenario, options), png);
    assert.deepEqual(frames, []);
    assert.equal(state().evaluations, 0);
    assert.equal(state().screenshots, otherScenes.length);
  });
});

test('repaint restores important inline values and absent properties, even on a frame error', async () => {
  for (const initial of [{ value: '#aabbcc', priority: 'important' }, { value: '', priority: '' }]) {
    for (const failFrame of [0, 1, 2, 3, 4]) {
      await withPage({ ...initial, failFrame }, async ({ page, options, state }) => {
        if (failFrame) await assert.rejects(captureGoldenFrame(page, target, options), /frame failed/);
        else await captureGoldenFrame(page, target, options);
        assert.deepEqual([state().inlineValue, state().inlinePriority], [initial.value, initial.priority]);
        assert.equal(state().screenshots, failFrame ? 0 : 1);
      });
    }
  }
});

test('temporary paint differs from an already matching background and does not leak on capture failure', async () => {
  await withPage({ background: 'rgb(1, 2, 3)', failScreenshot: true },
    async ({ page, options, frames, state }) => {
      await assert.rejects(captureGoldenFrame(page, target, options), /screenshot failed/);
      assert.deepEqual(frames.slice(0, 2), [
        ['rgb(3, 2, 1)', 'important'], ['rgb(3, 2, 1)', 'important'],
      ]);
      assert.deepEqual([state().inlineValue, state().inlinePriority], ['#11151b', '']);
    });
});
