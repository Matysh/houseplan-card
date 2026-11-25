import assert from 'node:assert/strict';
import { clickHeaderAction } from './helpers/header-actions.mjs';
import { startIsoPaintScene, settleIsoPaint, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';
import { reportPageErrors } from './serve.mjs';

const twoFrames = page => page.evaluate(() => new Promise(resolve =>
  requestAnimationFrame(() => requestAnimationFrame(resolve))));
const start = async mobile => {
  const size = mobile ? { width: 520, height: 820 } : { width: 1280, height: 900 };
  const env = await startIsoPaintScene({ ...size, browserArgs: ['--enable-unsafe-swiftshader'],
    reducedMotion: 'no-preference', hasTouch: mobile, isMobile: mobile,
  });
  await env.page.locator('houseplan-card canvas[data-hp-plan-3d-ready]').waitFor();
  return env;
};

async function startTrace(page) {
  await page.evaluate(delay => {
    const c = window.__isoPaint, host = c._plan3dHost;
    const root = c.renderRoot;
    const label = [...root.querySelectorAll('.roomlabel[data-hp-iso-visual]')]
      .find(element => element.textContent.includes('Room 1.3'));
    if (!label) throw new Error('Fixture room label is missing');
    const room = c._spaceModel().rooms.find(room => room.id === label.dataset.id);
    const p = c._labelPos(room, c._space);
    const mesh = host.world.structure.children[0].geometry;
    const sample = () => {
      const camera = host.viewport.painted?.camera;
      if (!camera) return;
      const layer = label.offsetParent.getBoundingClientRect(), box = host.canvas.getBoundingClientRect();
      // DOM-owned CSS percentages include the actual live transformation.
      // The GPU side uses the matrix that drew the pixels and an independent
      // known model point, not the desired view or the pending GPU frame.
      const html = [layer.left + layer.width * parseFloat(label.style.left) / 100,
        layer.top + layer.height * parseFloat(label.style.top) / 100];
      const point = camera.position.clone().set(p.x, host.presentation.sectionHeight, p.y).project(camera);
      const gpu = [box.left + (point.x + 1) * box.width / 2, box.top + (1 - point.y) * box.height / 2];
      const floor = camera.position.clone().set(p.x, 0, p.y).project(camera);
      const cx = box.left + (floor.x + 1) * box.width / 2, cy = box.top + (1 - floor.y) * box.height / 2;
      const inFrame = cx > box.left + 2 && cx < box.right - 2 && cy > box.top + 2 && cy < box.bottom - 2;
      // In the direct view the empty anchor SVG is not the input surface.
      // Ask the browser for the actual interactive floor path instead.
      const hit = inFrame && root.elementsFromPoint(cx, cy).find(el => el.matches('[data-hp-room-hit]'));
      return { time: performance.now(), html, mismatch: Math.hypot(html[0] - gpu[0], html[1] - gpu[1]),
        floorHit: hit ? hit.dataset.id === label.dataset.id : null,
        reused: host.world.structure.children[0].geometry === mesh };
    };
    if (delay && !host.delayWitness) {
      const paint = host.paintCamera.bind(host);
      host.paintCamera = view => requestAnimationFrame(() => paint(view));
      host.delayWitness = true;
    }
    window.hpCameraTrace = [];
    window.hpStopCameraTrace?.();
    let tick;
    const trace = () => {
      const fact = sample();
      if (fact) window.hpCameraTrace.push(fact);
      tick = requestAnimationFrame(trace);
    };
    trace();
    window.hpStopCameraTrace = () => cancelAnimationFrame(tick);
  }, process.env.HP_1566_DELAY_WEBGL === '1');
}

async function finishTrace(page, label, { fast = false, minimum = 3 } = {}) {
  const samples = await page.evaluate(() => {
    window.hpStopCameraTrace();
    return window.hpCameraTrace;
  });
  assert.ok(samples.length >= 3, `${label}: no in-flight samples`);
  let consecutive = 0, fastSamples = 0, moving = 0;
  const delays = [];
  for (let i = 1; i < samples.length; i++) {
    const [a, b] = [samples[i - 1].html, samples[i].html];
    const motion = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (motion < 1) continue;
    moving++;
    delays.push(samples[i].time - samples[i - 1].time);
    consecutive = motion >= 10 ? consecutive + 1 : 0;
    fastSamples = Math.max(fastSamples, consecutive);
  }
  assert.ok(moving >= minimum, `${label}: only ${moving} moving frames`);
  if (fast) assert.ok(fastSamples >= 3, `${label}: witness must expose a one-frame lag`);
  const error = Math.max(...samples.map(fact => fact.mismatch));
  assert.ok(error <= 2, `${label}: GPU/DOM diverged by ${error.toFixed(2)} CSS px`);
  assert.ok(!samples.some(fact => fact.floorHit === false), `${label}: floor hit belongs to a different room`);
  assert.ok(samples.every(fact => fact.reused), `${label}: motion rebuilt the world mesh`);
  delays.sort((a, b) => a - b);
  const p95 = delays[Math.ceil(delays.length * .95) - 1];
  console.log(`${label}: ${moving} moving frames; maximum error ${error.toFixed(3)} px`
    + (p95 === undefined ? '' : `; local frame interval p95 ${p95.toFixed(1)} ms`));
}

const { page, browser } = await start(false);
try {
  const card = page.locator('#host > houseplan-card');
  const stage = card.locator('.stage');
  await zoomIsoPaint(page, 1.8);
  const rect = await stage.boundingBox();
  const x = rect.x + rect.width * .20, y = rect.y + rect.height * .69;
  await startTrace(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 6; step++) {
    await page.mouse.move(x + step * 22, y + step * 8);
    await twoFrames(page);
  }
  await finishTrace(page, 'held pan', { fast: true });
  const lastHeld = await page.evaluate(() => window.hpCameraTrace.at(-1).html);
  await page.mouse.up();
  const pickedImmediately = await card.evaluate(c => [...c.renderRoot.querySelectorAll('.dev[data-hp-3d-native]')]
    .some(element => {
      const bounds = element.querySelector('.device-core').getBoundingClientRect();
      return c._plan3dHost.pick(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2) === element.dataset.id;
    }));
  assert.ok(pickedImmediately, 'native pick is available after releasing pan without waiting for a redraw');
  await settleIsoPaint(page);
  await startTrace(page);
  await twoFrames(page);
  await finishTrace(page, 'pan terminal', { minimum: 0 });
  const terminal = await page.evaluate(() => window.hpCameraTrace.at(-1).html);
  assert.ok(Math.hypot(lastHeld[0] - terminal[0], lastHeld[1] - terminal[1]) <= 2, 'terminal pan must not jump');

  const wheel = async (name, delta, anchor) => {
    await page.mouse.move(rect.x + anchor * rect.width, rect.y + rect.height * .55);
    await startTrace(page);
    for (let i = 0; i < 7; i++) {
      await page.mouse.wheel(0, delta);
      await twoFrames(page);
    }
    await settleIsoPaint(page);
    await finishTrace(page, name);
  };
  await wheel('wheel in near center', -40, .55);
  await wheel('wheel out near edge', 40, .85);
  await clickHeaderAction(card, 'rotate-right');
  await page.waitForFunction(() => window.__isoPaint._rotation === 45);
  await settleIsoPaint(page);
  await wheel('perspective wheel near edge', 39, .82);

  await clickHeaderAction(card, 'zoom-fit');
  await settleIsoPaint(page);
  await startTrace(page);
  await clickHeaderAction(card, 'zoom-in');
  await settleIsoPaint(page);
  await finishTrace(page, 'zoom button');
  await clickHeaderAction(card, 'zoom-fit');
  await settleIsoPaint(page);
  const hits = await card.evaluate(c => [...c.renderRoot.querySelectorAll('.dev[data-hp-3d-native]')]
    .filter(element => {
      const rect = element.querySelector('.device-core').getBoundingClientRect();
      return c._plan3dHost.pick(rect.x + rect.width / 2, rect.y + rect.height / 2) === element.dataset.id;
    }).length);
  assert.ok(hits >= 8, `the visible frame must receive its device hits, saw ${hits}`);
  await startTrace(page);
  await card.locator('.roomlabel .rlfit', { hasText: 'Room 1.3' }).press('Enter');
  await page.waitForFunction(() => Boolean(window.__isoPaint._roomFocus));
  await settleIsoPaint(page);
  await finishTrace(page, 'room focus');
  await page.setViewportSize({ width: 1060, height: 800 });
  await settleIsoPaint(page);
  await startTrace(page);
  await twoFrames(page);
  await finishTrace(page, 'resized perspective viewport', { minimum: 0 });
  const idle = await card.evaluate(async c => {
    const snapshot = c._plan3dHost.viewport.painted;
    for (let i = 0; i < 10; i++) await new Promise(resolve => requestAnimationFrame(resolve));
    return c._plan3dHost.viewport.painted === snapshot;
  });
  assert.ok(idle, 'a settled camera must not keep drawing');
} finally {
  await browser.close();
}

const touch = await start(true);
try {
  await zoomIsoPaint(touch.page, 1.5);
  const rect = await touch.page.locator('#host > houseplan-card .stage').boundingBox();
  const x = rect.x + rect.width * .47, y = rect.y + rect.height * .52;
  const session = await touch.page.context().newCDPSession(touch.page);
  const spread = (type, radius) => session.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ id: 0, x: x - radius, y }, { id: 1, x: x + radius, y }],
  });
  await startTrace(touch.page);
  await spread('touchStart', 39);
  for (const r of [51, 65, 80, 98, 113]) {
    await spread('touchMove', r);
    await twoFrames(touch.page);
  }
  await finishTrace(touch.page, 'held mobile pinch');
  await spread('touchEnd', 0);
  await settleIsoPaint(touch.page);
  if (await reportPageErrors()) throw new Error('Uncaught browser error while moving the camera');
} finally {
  await touch.browser.close();
}
