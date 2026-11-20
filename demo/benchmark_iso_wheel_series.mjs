// #1485 wheel comparison on the synthetic ISO paint fixture.
// Collect trace events separately from the uninstrumented comparison run.
import { writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { beginDaycycleLayers } from './helpers/daycycle-diagnostics.mjs';
import { finish } from './serve.mjs';
import { settleIsoPaint, startIsoPaintScene } from './helpers/iso-paint-scene.mjs';

const widths = process.env.HP_WHEEL_SIZE === 'owner'
  ? { width: 1408, height: 952, dpr: 2 } : { width: 1920, height: 1080, dpr: 1 };
const referenceRoot = process.env.HP_ISO_PAINT_REFERENCE;
const executablePath = process.env.HP_WHEEL_BROWSER;
const ownerWindow = process.env.HP_WHEEL_HEADED === '1';
if (ownerWindow && !executablePath) throw Error('Set HP_WHEEL_BROWSER for a headed owner run');
const { browser, page, provenance } = await startIsoPaintScene({
  ...widths, referenceRoot, reducedMotion: 'no-preference',
  ...(executablePath ? { launchOptions: { executablePath, headless: !ownerWindow }, browserArgs: ['--enable-gpu'] } : {}),
});

const wheel = (size, direction) => Array(size).fill(direction);
const runs = [
  ['8-in-8-out', [...wheel(8, -1), ...wheel(8, 1)]],
  ['12-in', wheel(12, -1)],
  ['12-out', wheel(12, 1)],
];
const result = [];
const tracePath = process.env.HP_WHEEL_TRACE;
const traceEvidence = [];
const cdp = tracePath ? await page.context().newCDPSession(page) : null;

async function gpuEvidence() {
  if (!ownerWindow) return null;
  const session = await browser.newBrowserCDPSession();
  try {
    const { gpu } = await session.send('SystemInfo.getInfo');
    return { renderer: gpu.auxAttributes?.glRenderer, compositing: gpu.featureStatus?.gpu_compositing,
      devices: gpu.devices.map(({ vendorString, deviceString, driverVersion }) => ({ vendorString, deviceString, driverVersion })),
      visibility: await page.evaluate(() => document.visibilityState) };
  } finally {
    await session.detach();
  }
}

async function traceSeries(name) {
  if (!cdp) return null;
  const { result } = await cdp.send('Runtime.evaluate', {
    expression: "window.__isoPaint.renderRoot.querySelector('.iso-scene-surface > svg[data-projection=iso]')",
  });
  const { node } = await cdp.send('DOM.describeNode', { objectId: result.objectId });
  const { node: surface } = await cdp.send('DOM.describeNode', {
    objectId: (await cdp.send('Runtime.evaluate', {
      expression: "window.__isoPaint.renderRoot.querySelector('.iso-scene-surface')",
    })).result.objectId,
  });
  const layers = await beginDaycycleLayers(cdp);
  const events = [];
  const collect = ({ value }) => events.push(...value);
  cdp.on('Tracing.dataCollected', collect);
  await cdp.send('Tracing.start', {
    traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing'] },
    transferMode: 'ReportEvents',
  });
  return async () => {
    const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.end');
    await complete;
    cdp.off('Tracing.dataCollected', collect);
    const filtered = events.filter(event => ['RasterTask', 'Paint', 'Layerize'].includes(event.name) ||
      event.name.startsWith('hp-wheel-trace-'));
    const layersReport = await layers.stop();
    const sceneLayers = new Set(layersReport.events.flatMap(event => (event.layers ?? [])
      .filter(layer => [node.backendNodeId, surface.backendNodeId].includes(layer.backendNodeId))
      .map(layer => Number(layer.layerId))));
    const begin = filtered.find(event => event.name === 'hp-wheel-trace-' + name + '-begin')?.ts;
    const end = filtered.find(event => event.name === 'hp-wheel-trace-' + name + '-end')?.ts;
    traceEvidence.push({ name, sceneNode: node.backendNodeId, surfaceNode: surface.backendNodeId,
      sceneLayerIds: [...sceneLayers], begin, end, layers: layersReport, events: filtered });
  };
}

async function fit() {
  await page.locator('houseplan-card [data-hp="zoom-fit"]').click();
  await settleIsoPaint(page);
}

try {
  const gpu = await gpuEvidence();
  if (ownerWindow && (gpu.compositing !== 'enabled' || gpu.visibility !== 'visible')) {
    throw Error('The headed comparison requires a visible GPU-composited window: ' + JSON.stringify(gpu));
  }
  for (const [name, steps] of runs) {
    if (name !== '12-out') await fit();
    // The three timings start with a settled and prepared scene. Give the
    // same idle interval to the comparison build, which has no warm bitmap.
    if (!referenceRoot) {
      await page.waitForFunction(() => performance.getEntriesByName('houseplan.iso.raster.ready').length > 0);
    }
    await page.waitForTimeout(1000);
    const endTrace = await traceSeries(name);
    const row = await page.evaluate(async ({ name, steps, trace }) => {
      const card = window.__isoPaint;
      const stage = card.renderRoot.querySelector('.stage');
      const initial = card.renderRoot.querySelector('.iso-scene-surface > svg[data-projection="iso"]');
      if (!initial) throw Error('2.5D fixture has no vector scene');
      const target = stage.querySelector('.zoomwrap');
      const { left, top, width, height } = stage.getBoundingClientRect();
      const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
      const start = await frame();
      const traceOffset = performance.now() - start;
      if (trace) performance.mark('hp-wheel-trace-' + name + '-begin');
      const viewBox = [], events = [], intervals = [], commits = [];
      const accepted = [], markers = [], density = [];
      const vectorSurface = initial.parentElement;
      const readScale = node => {
        const scale = node.style.transform.match(/\bscale\(([^)]+)\)/);
        return scale ? Math.max(...scale[1].split(',').map(Number)) : 1;
      };
      let markerWrites = 0;
      const observer = new MutationObserver(records => {
        for (const { target, attributeName, oldValue } of records) {
          if (attributeName === 'viewBox' && target === initial) viewBox.push(performance.now() - start);
          if (attributeName === 'style' && target.matches('[data-hp-live-layer="camera"] > [style], .iso-room-label-plane > .roomlabel')) {
            if (/\b(left|top)\s*:\s*-?[\d.]+%/.test(oldValue || '')) markerWrites++;
          }
        }
      });
      observer.observe(stage, { attributes: true, attributeFilter: ['viewBox', 'style'], attributeOldValue: true, subtree: true });
      const updated = card.updated;
      card.updated = function (changed) {
        updated.call(this, changed);
        commits.push(performance.now() - start);
      };
      let previous = start, time = start, index = 0;
      let sharpAt = null, zoomPeak = card._zoom;
      const firstZoom = card._zoom;
      const deadline = start + steps.length * 140 + 2500;
      try {
        while (time < deadline) {
          const elapsed = time - start;
          while (index < steps.length && elapsed >= index * 140) {
            const event = new WheelEvent('wheel', {
              deltaY: steps[index++] * 100, deltaMode: 0,
              clientX: left + width / 2, clientY: top + height / 2,
              bubbles: true, composed: true, cancelable: true,
            });
            const before = card._cameraTransition.state?.token;
            const ms = performance.now() - start;
            target.dispatchEvent(event);
            const next = card._cameraTransition.state;
            events.push(ms);
            if (next?.token !== undefined && next.token !== before) accepted.push({ ms, zoom: next.to.zoom });
          }
          if (markerWrites) {
            markers.push({ ms: time - start, writes: markerWrites });
            markerWrites = 0;
          }
          zoomPeak = Math.max(zoomPeak, card._zoom);
          if (card._cameraTransition.active) {
            const image = stage.querySelector('.hp-iso-gesture-image');
            density.push({ ms: time - start, zoom: card._zoom,
              value: image ? 1 / (devicePixelRatio * readScale(image)) : 1 / readScale(vectorSurface) });
          }
          if (index === steps.length && !card._cameraTransition.active) {
            await card.updateComplete;
            const t = await frame();
            sharpAt = t - start;
            break;
          }
          time = await frame();
          intervals.push({ at: time - start, ms: time - previous });
          previous = time;
        }
      } finally {
        observer.disconnect();
        card.updated = updated;
      }
      if (trace) performance.mark('hp-wheel-trace-' + name + '-end');
      if (!accepted.length) throw Error('No test wheel events reached the camera');
      const firstInput = accepted[0].ms;
      const lastInput = accepted.at(-1).ms;
      const during = intervals.filter(({ at }) => at > firstInput && at <= lastInput + 140);
      const sorted = during.map(({ ms }) => ms).sort((a, b) => a - b);
      const long = during.filter(({ ms }) => ms > 50);
      const sum = during.reduce((total, { ms }) => total + ms, 0);
      let lowSince = null, longestBelowHalfDensityMs = 0;
      for (const { ms, value } of [...density, { ms: sharpAt ?? time - start, value: 1 }]) {
        if (value < .5) lowSince ??= ms;
        else if (lowSince !== null) {
          longestBelowHalfDensityMs = Math.max(longestBelowHalfDensityMs, ms - lowSince);
          lowSince = null;
        }
      }
      return {
        stage: { width, height, dpr: devicePixelRatio },
        firstZoom, zoomPeak, lastZoom: card._zoom, wheelTimes: events, accepted, viewBox, commits, markers, intervals, density, longestBelowHalfDensityMs, traceOffset,
        firstInput, lastInput, p95Ms: sorted[Math.ceil(sorted.length * .95) - 1],
        settledByRafMs: sharpAt === null ? null : sharpAt - lastInput,
        fps: sum ? during.length * 1000 / sum : null,
        longFrames: long.length, longMs: long.reduce((total, { ms }) => total + ms, 0),
        raster: performance.getEntriesByType('mark')
          .filter(mark => mark.startTime >= start && mark.name.startsWith('houseplan.iso.raster.'))
          .map(({ name, startTime, detail }) => ({ name, ms: startTime - start, detail })),
      };
    }, { name, steps, trace: Boolean(cdp) });
    await endTrace?.();
    const trace = traceEvidence.at(-1);
    const commit = row.commits.at(-1);
    const vectorRasterTasks = trace && trace.sceneLayerIds.length && Number.isFinite(trace.begin) && Number.isFinite(commit)
      ? trace.events.filter(event => event.name === 'RasterTask' && event.ph === 'X' &&
        event.ts >= trace.begin && event.ts < trace.begin + (commit - row.traceOffset) * 1000 &&
        trace.sceneLayerIds.includes(event.args?.tileData?.layerId)).length : null;
    result.push({ name, ...row, vectorRasterTasks });
  }
  if (tracePath) await writeFile(tracePath, JSON.stringify(traceEvidence));
  console.log(JSON.stringify({ provenance: { ...provenance, availableLogicalCpus: availableParallelism() }, gpu, result }, null, 2));
} finally {
  await finish(browser);
}
