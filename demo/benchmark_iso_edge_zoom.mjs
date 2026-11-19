/** #1478 native edge zoom baseline. Timings and controlled PNGs use separate
 * browser runs. The approved-product assertions belong to the candidate run,
 * while the baseline records dropped/coalesced input and blank frames. */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { controlledCompositor } from './helpers/controlled-compositor.mjs';
import { settleIsoPaint, startIsoPaintScene, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const viewportWidth = Number(process.env.HP_EDGE_WIDTH || 1920);
const viewportHeight = viewportWidth === 3840 ? 2160 : 1080;
const capture = process.env.HP_EDGE_CAPTURE === '1';
const requireRaster = process.env.HP_EDGE_REQUIRE_RASTER === '1';
const enableGpu = process.env.HP_EDGE_GPU === '1';
const output = process.env.HP_EDGE_OUTPUT || 'artifacts/1478/edge';
const referenceRoot = process.env.HP_ISO_PAINT_REFERENCE;
const compositor = capture ? controlledCompositor() : null;
const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
const { browser, page, provenance } = await startIsoPaintScene({
  width: viewportWidth, height: viewportHeight, referenceRoot,
  browserArgs: [...(compositor?.browserArgs ?? []), ...(enableGpu ? ['--enable-gpu'] : [])],
  createPage: compositor?.createPage,
});

const interval = 140, steps = 14, stepScale = 1.15;
const rows = [];

function wallPixels(bytes) {
  const { data } = PNG.sync.read(bytes);
  let pixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] >= 250 && data[i + 1] <= 5 && Math.abs(data[i + 2] - 181) <= 5) pixels++;
  }
  return pixels;
}

function samePaint(first, second) {
  const a = PNG.sync.read(first), b = PNG.sync.read(second);
  if (a.width !== b.width || a.height !== b.height) return false;
  for (let i = 0; i < a.data.length; i++) {
    if (Math.abs(a.data[i] - b.data[i]) > 1) return false;
  }
  return true;
}

async function exactReference() {
  compositor.capture();
  await page.evaluate(async () => {
    const card = window.__isoPaint, view = card._view;
    card._applyView(card._zoom, view.x + view.w / 2, view.y + view.h / 2);
    card.requestUpdate();
    await card.updateComplete;
  });
  await settleIsoPaint(page);
  // Wait for the controlled browser to emit the reference after the Lit frame.
  await delay(100);
  return (await compositor.take()).findLast(frame => frame.png)?.png;
}

async function installWitness() {
  await page.evaluate(() => {
    const root = window.__isoPaint.renderRoot;
    const walls = root.querySelector('[data-hp="iso-walls"]:has(.iso-wall-side)');
    if (!walls) throw Error('Fixture has no painted wall faces');
    const style = document.createElement('style');
    style.textContent = '[data-hp="iso-walls"] :is(.iso-wall-side,.iso-wall-top)'
      + '{fill:#ff00b5!important;fill-opacity:1!important}';
    root.append(style);
  });
}

async function verifySingleFrameControl() {
  compositor.capture();
  await page.evaluate(async () => {
    const walls = window.__isoPaint.renderRoot.querySelector('[data-hp="iso-walls"]:has(.iso-wall-side)');
    await new Promise(resolve => requestAnimationFrame(() => {
      walls.style.visibility = 'hidden';
      requestAnimationFrame(() => {
        walls.style.removeProperty('visibility');
        requestAnimationFrame(resolve);
      });
    }));
  });
  const changed = (await compositor.take()).filter(frame => frame.changed);
  const ink = changed.map(frame => wallPixels(frame.png));
  if (ink.filter(pixels => pixels === 0).length !== 1 || !ink.some(pixels => pixels > 1000)) {
    throw Error('The visual witness could not distinguish a one-frame wall loss');
  }
}

async function startMeasurement(notifyDelivery) {
  await page.evaluate(notifyDelivery => {
    const card = window.__isoPaint, root = card.renderRoot, stage = root.querySelector('.stage');
    const wheel = [], gaps = [], anchorWrites = [], commits = [], saves = [];
    const baseGeometry = card._isoStructuralBuildCount;
    const markStart = performance.now();
    const onWheel = event => {
      if (event.isTrusted) {
        wheel.push({ eventAt: event.timeStamp, receivedAt: performance.now(), delta: event.deltaY });
        if (notifyDelivery) window.__hpEdgeWheelDelivered('wheel');
      }
    };
    stage.addEventListener('wheel', onWheel, { capture: true, passive: true });
    const observer = new MutationObserver(records => anchorWrites.push({
      at: performance.now(), zoom: card._zoom, count: records.length,
    }));
    for (const svg of root.querySelectorAll('svg[data-hp-live-viewbox]')) {
      observer.observe(svg, { attributes: true, attributeFilter: ['viewBox'] });
    }
    const update = card.updated, save = card._saveZoom;
    card.updated = function (changed) {
      update.call(this, changed);
      commits.push(performance.now());
    };
    card._saveZoom = function () {
      save.call(this);
      saves.push(performance.now());
    };
    let previous, raf;
    const frame = time => {
      if (previous !== undefined) gaps.push({ at: time, gap: time - previous });
      previous = time;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    window.__finishIsoEdgeMeasurement = () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      stage.removeEventListener('wheel', onWheel, true);
      card.updated = update;
      card._saveZoom = save;
      delete window.__finishIsoEdgeMeasurement;
      return { wheel, gaps, anchorWrites, commits, saves, timeOrigin: performance.timeOrigin,
        raster: performance.getEntriesByType('mark').filter(mark =>
          mark.startTime >= markStart && mark.name.startsWith('houseplan.iso.raster.'))
          .map(({ name, startTime, detail }) => ({ event: name.split('.').at(-1), at: startTime, detail })),
        rasterRemaining: root.querySelectorAll('[data-hp-iso-raster]').length,
        zoom: card._zoom, view: { ...card._view },
        structuralBuilds: card._isoStructuralBuildCount - baseGeometry, writes: window.__isoPaintWrites.length };
    };
  }, notifyDelivery);
}

function nextWheelDelivery(cdp) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cdp.off('Runtime.bindingCalled', delivered);
      reject(Error('The controlled browser did not deliver the wheel event'));
    }, 10_000);
    function delivered(event) {
      if (event.name !== '__hpEdgeWheelDelivered') return;
      clearTimeout(timer);
      cdp.off('Runtime.bindingCalled', delivered);
      resolve();
    }
    cdp.on('Runtime.bindingCalled', delivered);
  });
}

try {
  await mkdir(output, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const stage = await page.locator('houseplan-card .stage').first().boundingBox();
  if (!stage) throw Error('Fixture stage is absent');
  const x = stage.x + stage.width * .88, y = stage.y + stage.height * .66;
  if (compositor) {
    await zoomIsoPaint(page, 6);
    await installWitness();
    await verifySingleFrameControl();
  }
  const cdp = await page.context().newCDPSession(page);
  if (capture) await cdp.send('Runtime.addBinding', { name: '__hpEdgeWheelDelivered' });
  for (const direction of ['in', 'out']) {
    const zoom = direction === 'in' ? 1.1 : 6;
    const step = direction === 'in' ? 1 : -1;
    await zoomIsoPaint(page, zoom);
    await page.mouse.move(x, y);
    await delay(250);
    await startMeasurement(capture);
    compositor?.capture();
    const sent = [];
    const start = performance.now();
    for (let i = 0; i < steps; i++) {
      if (i > 0) await delay(Math.max(0, start + i * interval - performance.now()));
      const delivered = capture ? nextWheelDelivery(cdp) : null;
      const request = cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: -step * 80 });
      sent.push(request);
      // Serialise the delivered events, independently of compositor acks
      // that can be delayed by the full-size PNG capture.
      if (delivered) await Promise.race([delivered, request.then(() => delivered)]);
    }
    await Promise.all(sent);
    await settleIsoPaint(page);
    await delay(450);
    const measurements = await page.evaluate(() => window.__finishIsoEdgeMeasurement());
    const frames = await compositor?.take();
    if (capture && (measurements.wheel.length !== steps || Math.abs(measurements.zoom - zoom * stepScale ** (steps * step)) > 1e-6)) {
      throw Error('Controlled capture must reach the full zoom range with 14 delivered steps');
    }
    const firstInput = measurements.wheel[0]?.receivedAt, lastInput = measurements.wheel.at(-1)?.receivedAt;
    if (!Number.isFinite(lastInput) || measurements.structuralBuilds || measurements.writes) {
      throw Error('The fixture received no wheel or mutated the plan');
    }
    const commit = measurements.commits.at(-1) ?? lastInput;
    const gaps = measurements.gaps.filter(({ at }) => at >= firstInput && at <= Math.max(lastInput, commit))
      .map(({ gap }) => gap).sort((a, b) => a - b);
    const pixels = frames?.map(frame => ({ sequence: frame.sequence, readyAt: frame.readyAt,
      changed: frame.changed, pixels: frame.png ? wallPixels(frame.png) : null }));
    const lastInputUtc = measurements.timeOrigin + measurements.wheel.at(-1).eventAt;
    let equalFrame;
    if (compositor) {
      const reference = await exactReference();
      if (!reference) throw Error('No exact reference PNG was emitted');
      await writeFile(output + '/' + direction + '-exact.png', reference);
      equalFrame = frames.find(frame => frame.png && frame.readyAt >= lastInputUtc && samePaint(frame.png, reference));
    }
    const result = {
      direction, sentSteps: steps, receivedEvents: measurements.wheel.length,
      receivedDelta: measurements.wheel.reduce((sum, event) => sum + event.delta, 0),
      nominalZoom: zoom * stepScale ** (steps * step), finalZoom: measurements.zoom,
      viewBoxWrites: measurements.anchorWrites.reduce((sum, entry) => sum + entry.count, 0),
      commits: measurements.commits.length, saves: measurements.saves.length,
      lastCommitAfterInputMs: commit - lastInput,
      rafP95Ms: capture ? null : gaps[Math.ceil(gaps.length * .95) - 1],
      rafMaxMs: capture ? null : gaps.at(-1),
      capturedFrames: pixels?.length ?? null, emptyWallFrames: pixels?.filter(f => f.pixels === 0).length ?? null,
      exactPngFrame: equalFrame?.sequence ?? null,
      exactPngReadyAfterInputMs: equalFrame ? equalFrame.readyAt - lastInputUtc : null,
      rasterSwaps: measurements.raster.filter(mark => mark.event === 'swap').length,
      rasterEvents: measurements.raster.map(mark => mark.event).join(','),
    };
    console.log(JSON.stringify(result));
    for (const frame of pixels?.filter(entry => entry.pixels === 0) ?? []) {
      await writeFile(output + '/' + direction + '-' + frame.sequence + '.png',
        frames.find(entry => entry.sequence === frame.sequence).png);
    }
    rows.push({ ...result, measurements, pixels });
  }
  await cdp.detach();
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: referenceRoot ?? process.cwd(), encoding: 'utf8',
  }).trim();
  const mode = capture ? 'pixels' : 'timing';
  await writeFile(output + '/' + viewportWidth + '-' + mode + '.json',
    JSON.stringify({ revision, provenance, mode, enableGpu, stage, rows }, null, 2));
  if (requireRaster && rows.some(row => row.rasterSwaps < 2 || row.measurements.rasterRemaining ||
      (capture && (row.emptyWallFrames || !row.exactPngFrame)))) {
    throw Error('The raster cache must replace at least two frames, preserve walls and release to the exact camera');
  }
} finally {
  await compositor?.stop();
  await browser.close();
}
