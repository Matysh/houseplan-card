// #1485/#1566: real drag and pinch at DPR2 keep the presented perspective camera in sync.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { check, finish } from './serve.mjs';
import { settleIsoPaint, startIsoPaintScene, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const executablePath = process.env.HP_WHEEL_BROWSER;
const output = process.env.HP_ISO_DIRECT_CAPTURE;
const manual = Boolean(executablePath);
const { browser, page, provenance } = await startIsoPaintScene({
  width: 1100, height: 760, dpr: 2, hasTouch: true, reducedMotion: 'no-preference',
  browserArgs: manual ? ['--enable-gpu'] : ['--enable-unsafe-swiftshader'],
  ...(manual ? { launchOptions: { executablePath, headless: false } } : {}),
});
const stage = page.locator('houseplan-card .stage');
const session = await page.context().newCDPSession(page);
const touch = (type, x, y, radius) => session.send('Input.dispatchTouchEvent', {
  type,
  touchPoints: type === 'touchEnd' ? [] : [{ x: x - radius, y, id: 1 }, { x: x + radius, y, id: 2 }],
});

async function measure(gesture) {
  await zoomIsoPaint(page, 3);
  if (manual) await setTimeout(500);
  const { x, y, width, height } = await stage.boundingBox();
  const startX = x + width * .34, cy = y + height * .65;
  const centre = x + width * .55, radius = width * .079;
  const duration = manual ? 2500 : 380;
  const steps = manual ? 90 : 6;
  const pinch = gesture === 'pinch';
  await page.evaluate(gesture => {
    const card = window.__isoPaint, root = card.renderRoot;
    const host = card._plan3dHost;
    const label = root.querySelector('.roomlabel[data-hp-iso-visual]');
    const room = card._spaceModel().rooms.find(room => room.id === label.dataset.id);
    const point = card._labelPos(room, card._space);
    const model = host.world.structure.children[0].geometry;
    const initial = { ...card._viewOr(card._baseVb()) };
    const result = { initial, gaps: [], activeFrames: 0, errorPx: 0, reused: true };
    let previous, frame;
    const sample = time => {
      if (gesture === 'pinch' ? card._pinchStart : card._panLock === 'pan') {
        result.activeFrames++;
        if (previous !== undefined) result.gaps.push(time - previous);
        previous = time;
        const camera = host.viewport.painted.camera;
        const gpu = camera.position.clone().set(point.x, host.presentation.sectionHeight, point.y).project(camera);
        const box = host.canvas.getBoundingClientRect(), layer = label.offsetParent.getBoundingClientRect();
        const dx = box.x + (gpu.x + 1) * box.width / 2 - layer.x - layer.width * parseFloat(label.style.left) / 100;
        const dy = box.y + (1 - gpu.y) * box.height / 2 - layer.y - layer.height * parseFloat(label.style.top) / 100;
        result.errorPx = Math.max(result.errorPx, Math.hypot(dx, dy));
        result.reused &&= host.world.structure.children[0].geometry === model;
      }
      frame = requestAnimationFrame(sample);
    };
    frame = requestAnimationFrame(sample);
    window.__stopIsoDirectInput = () => {
      cancelAnimationFrame(frame);
      return { ...result, presented: { ...card._viewOr(card._baseVb()) } };
    };
  }, gesture);

  if (pinch) await touch('touchStart', centre, cy, radius);
  else {
    await page.mouse.move(startX, cy);
    await page.mouse.down();
  }
  const start = performance.now();
  let delivered = 0;
  for (let step = 1; step <= steps;) {
    await setTimeout(Math.max(0, start + step * duration / steps - performance.now()));
    const fraction = step / steps;
    if (pinch) await touch('touchMove', centre, cy, radius * (1 + .57 * fraction));
    else await page.mouse.move(startX + width * .32 * fraction, cy + height * .06 * fraction);
    delivered++;
    if (!manual) await page.evaluate(() => new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))));
    step = manual ? Math.min(steps + 1, Math.max(step + 1, Math.floor((performance.now() - start) / duration * steps) + 1)) : step + 1;
    if (step > steps && fraction !== 1) step = steps;
  }
  const result = await page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return window.__stopIsoDirectInput();
  });
  if (output && !pinch) await stage.screenshot({ path: join(output, 'drag-held.png') });
  if (pinch) await touch('touchEnd');
  else {
    await page.mouse.up();
    await page.mouse.move(4, 4);
  }
  await settleIsoPaint(page);
  if (output && !pinch) await stage.screenshot({ path: join(output, 'drag-settled.png') });
  const settled = await page.evaluate(() => {
    const card = window.__isoPaint;
    const view = card._viewOr(card._baseVb());
    const host = card._plan3dHost, box = host.canvas.getBoundingClientRect();
    const fullDensity = Math.abs(host.canvas.width - box.width * devicePixelRatio) <= 1;
    const exact = ['x', 'y', 'w', 'h'].every(key => Math.abs(view[key] - host.crop[key]) < 1e-5);
    return { view, exact, fullDensity };
  });
  const moved = view => pinch ? view.w < result.initial.w * .8 :
    result.initial.x - view.x > result.initial.w * .2;
  const restored = settled.exact && moved(settled.view);
  const durationMs = result.gaps.reduce((sum, gap) => sum + gap, 0);
  check(gesture + ' activates through browser input', result.activeFrames > 2);
  check(gesture + ' changes the camera', moved(result.presented));
  check(gesture + ' paints WebGL and the DOM together', result.errorPx <= 1);
  check(gesture + ' retains geometry', result.reused);
  check(gesture + ' keeps the exact end pose', restored);
  check(gesture + ' restores full density at rest', settled.fullDensity);
  return { gesture, delivered, activeFrames: result.activeFrames, errorPx: result.errorPx,
    fps: Math.round(10000 * result.gaps.length / durationMs) / 10,
    longFrames: result.gaps.filter(gap => gap > 50).length, longestMs: Math.max(0, ...result.gaps),
    reused: result.reused, restored };
}

try {
  await stage.locator('canvas[data-hp-plan-3d-ready]').waitFor();
  await page.locator('houseplan-card [data-hp="rotate-right"]').click();
  await page.waitForFunction(() => window.__isoPaint._plan3dHost?.presentation?.preset?.rotation === 45
    || window.__isoPaint._rotation === 45);
  await settleIsoPaint(page);
  if (output) await mkdir(output, { recursive: true });
  let renderer;
  if (manual) {
    const cdp = await browser.newBrowserCDPSession();
    const { gpu } = await cdp.send('SystemInfo.getInfo');
    renderer = gpu.auxAttributes.glRenderer;
    if (gpu.featureStatus.gpu_compositing !== 'enabled' ||
      await page.evaluate(() => document.visibilityState) !== 'visible') throw Error('Expected a visible GPU-composited window');
    await cdp.detach();
  }
  const results = [await measure('drag'), await measure('pinch')];
  console.log(JSON.stringify({ provenance, renderer, results }));
} finally {
  await session.detach();
  await finish(browser);
}
