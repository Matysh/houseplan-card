// #1485: drag and pinch must keep their sharp vector reserve through real input.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { check, finish } from './serve.mjs';
import { settleIsoPaint, startIsoPaintScene, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const executablePath = process.env.HP_WHEEL_BROWSER;
const referenceRoot = process.env.HP_ISO_PAINT_REFERENCE;
const output = process.env.HP_ISO_DIRECT_CAPTURE;
const manual = Boolean(executablePath);
const { browser, page, provenance } = await startIsoPaintScene({
  width: 1408, height: 952, dpr: 2, referenceRoot, reducedMotion: 'no-preference',
  ...(manual ? { launchOptions: { executablePath, headless: false }, browserArgs: ['--enable-gpu'] } : {}),
});
const stage = page.locator('houseplan-card .stage');
const session = await page.context().newCDPSession(page);
const touch = (type, x, y, radius) => session.send('Input.dispatchTouchEvent', {
  type,
  touchPoints: type === 'touchEnd' ? [] : [{ x: x - radius, y, id: 1 }, { x: x + radius, y, id: 2 }],
});

async function measure(gesture) {
  await zoomIsoPaint(page, 3);
  if (!referenceRoot) await page.waitForFunction(() =>
    performance.getEntriesByName('houseplan.iso.raster.ready').length > 0);
  if (manual) await setTimeout(500);
  const { x, y, width, height } = await stage.boundingBox();
  const startX = x + width * .34, cy = y + height * .65;
  const centre = x + width * .55, radius = width * .079;
  const duration = manual ? 2500 : 380;
  const steps = manual ? 90 : 12;
  const pinch = gesture === 'pinch';
  await page.evaluate(gesture => {
    const card = window.__isoPaint, root = card.renderRoot;
    const svg = root.querySelector('.iso-scene-surface > svg');
    const markers = root.querySelector('[data-hp-live-marker-clip]');
    const box = svg.getAttribute('viewBox');
    const initial = { ...card._viewOr(card._baseVb()) };
    const result = { initial, gaps: [], activeFrames: 0, vectorWrites: 0, usedUnderlay: false, usedRaster: false, usedBlur: false };
    let previous, current = box, frame;
    const sample = time => {
      if (gesture === 'pinch' ? card._pinchStart : card._panLock === 'pan') {
        result.activeFrames++;
        if (previous !== undefined) result.gaps.push(time - previous);
        previous = time;
        const next = svg.getAttribute('viewBox');
        if (next !== current) result.vectorWrites++;
        current = next;
        result.usedUnderlay ||= Boolean(root.querySelector('.hp-iso-gesture-underlay'));
        result.usedRaster ||= Boolean(root.querySelector('.hp-iso-gesture-image'));
        result.usedBlur ||= Boolean(markers?.style.filter || svg.parentElement.style.getPropertyValue('--hp-iso-gesture-blur'));
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
    step = Math.min(steps + 1, Math.max(step + 1, Math.floor((performance.now() - start) / duration * steps) + 1));
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
    const exact = card._presentationView(view, card._zoom);
    const svg = card.renderRoot.querySelector('.iso-scene-surface > svg');
    const box = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    return { view, exact: [exact.x, exact.y, exact.w, exact.h].every((value, index) => Math.abs(value - box[index]) < 1e-5) };
  });
  const moved = view => pinch ? view.w < result.initial.w * .8 :
    result.initial.x - view.x > result.initial.w * .2;
  const restored = settled.exact && moved(settled.view);
  const durationMs = result.gaps.reduce((sum, gap) => sum + gap, 0);
  check(gesture + ' activates through browser input', result.activeFrames > 2);
  check(gesture + ' changes the camera', moved(result.presented));
  check(gesture + ' keeps the vector anchor', result.vectorWrites, 0);
  check(gesture + ' preserves sharp coverage', !result.usedUnderlay && !result.usedRaster && !result.usedBlur);
  check(gesture + ' keeps the exact end pose', restored);
  check(gesture + ' releases the gesture surfaces', await stage.locator('.hp-iso-raster').count(), 0);
  return { gesture, delivered, activeFrames: result.activeFrames, vectorWrites: result.vectorWrites,
    fps: Math.round(10000 * result.gaps.length / durationMs) / 10,
    longFrames: result.gaps.filter(gap => gap > 50).length, longestMs: Math.max(0, ...result.gaps),
    usedUnderlay: result.usedUnderlay, usedRaster: result.usedRaster, usedBlur: result.usedBlur, restored };
}

try {
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
