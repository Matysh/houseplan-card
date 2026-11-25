// #1533/#1566: a real HA state change fades the existing WebGL world, not the DOM.
import assert from 'node:assert/strict';
import { finish } from './serve.mjs';
import { clickHeaderAction } from './helpers/header-actions.mjs';
import { settleIsoPaint, startIsoPaintScene } from './helpers/iso-paint-scene.mjs';

const { browser, page } = await startIsoPaintScene({
  width: 900, height: 660, reducedMotion: 'no-preference', browserArgs: ['--enable-unsafe-swiftshader'],
});
const card = page.locator('houseplan-card');

async function toggle(reducedMotion = false, zoomDuringFade = false) {
  const frames = await card.evaluate(async (card, reducedMotion) => {
    const host = card._plan3dHost;
    const eid = Object.keys(card.hass.states).find(id => id.startsWith('light.'));
    const normalClock = host.now;
    let clock = normalClock.call(host);
    host.now = () => clock;
    const previous = card.hass.states[eid];
    const state = previous.state === 'on' ? 'off' : 'on';
    card.hass = { ...card.hass, states: { ...card.hass.states, [eid]: { ...previous, state } } };
    await card.updateComplete;
    const changes = [...host.light.blends.keys()];
    const sample = ms => {
      clock += ms;
      host.updateLights();
      host.viewport.present({ ...host.frame }, true);
      const { width, height } = host.canvas;
      const pixels = host.canvas.getContext('2d').getImageData(0, 0, width, height).data;
      return { pixels, active: host.light.blends.size > 0 };
    };
    const difference = (a, b) => {
      let sum = 0;
      for (let i = 0; i < a.length; i += 16)
        sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      return sum;
    };
    try {
      const start = sample(0), middle = sample(250), end = sample(250);
      const result = { rotation: card._rotation, changes, state,
        active: [start.active, middle.active, end.active],
        first: difference(start.pixels, middle.pixels),
        second: difference(middle.pixels, end.pixels),
        total: difference(start.pixels, end.pixels) };
      if (reducedMotion) result.animateLights = host.presentation.animateLights;
      return result;
    } finally { host.now = normalClock; }
  }, reducedMotion);
  if (reducedMotion) {
    assert.deepEqual(frames.active, [false, false, false]);
    assert.equal(frames.animateLights, false);
    assert.equal(frames.total, 0, 'reduced motion has no intermediate GPU frame');
  } else {
    assert.ok(frames.changes.length > 0, 'HA state retargets a real light');
    assert.deepEqual(frames.active, [true, true, false]);
    assert.ok(frames.total > 300 && frames.first > 150 && frames.second > 150,
      'actual world pixels change at both ends of the fade: ' + JSON.stringify(frames));
  }
  if (zoomDuringFade) {
    const stage = card.locator('.stage'), box = await stage.boundingBox();
    const before = await card.evaluate(c => c._plan3dHost.crop.w);
    // Start the reverse transition on the live clock, then move the same world
    // by browser input. Do not rely on SwiftShader to finish within 500 ms.
    await card.evaluate(async c => {
      const host = c._plan3dHost;
      const clock = host.now();
      window.__hpLightClock = host.now;
      host.now = () => clock + 150;
      const eid = Object.keys(c.hass.states).find(id => id.startsWith('light.'));
      const previous = c.hass.states[eid];
      c.hass = { ...c.hass, states: { ...c.hass.states,
        [eid]: { ...previous, state: previous.state === 'on' ? 'off' : 'on' } } };
      await c.updateComplete;
      host.now = () => clock + 400;
    });
    await page.mouse.move(box.x + box.width * .66, box.y + box.height * .60);
    await page.mouse.wheel(0, -120);
    await settleIsoPaint(page);
    const after = await card.evaluate(c => {
      const host = c._plan3dHost;
      const result = { width: host.crop.w, fading: host.light.blends.size > 0,
        sameCamera: host.viewport.painted.camera === host.frame.camera };
      host.now = window.__hpLightClock;
      return result;
    });
    assert.notEqual(after.width, before);
    assert.ok(after.fading && after.sameCamera, 'animated light stays on the current camera');
    await page.waitForFunction(() => window.__isoPaint._plan3dHost.light.blends.size === 0);
  }
  console.log(JSON.stringify(frames));
}

try {
  await card.locator('canvas[data-hp-plan-3d-ready]').waitFor();
  await toggle();
  await toggle();
  await clickHeaderAction(card, 'rotate-right');
  await page.waitForFunction(() => window.__isoPaint._rotation === 45);
  await settleIsoPaint(page);
  await toggle();
  await toggle(false, true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.__isoPaint._reducedMotion);
  await toggle(true);
  assert.deepEqual(await page.evaluate(() => window.__isoPaintWrites), []);
  await finish(browser);
} catch (error) {
  await browser.close();
  throw error;
}
