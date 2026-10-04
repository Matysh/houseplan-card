#!/usr/bin/env node
/**
 * #780 ТЗ §13.2: the `led-strips-v1` performance profile.
 *
 * The `large-house-v1` fixture (200 devices, 3 floors, 60 rooms, 100
 * openings) with 10 or 50 of each floor's existing devices shown as LED
 * strips that are on: `--size=10x5` (10 strips × 5 points) or `--size=50x50`
 * (50 strips × 50 points); `--size=none` is the same build and plan without
 * strips. No icon is added: the converted devices keep their ids, only their
 * entity becomes a light. Light radius 30 cm (the strip default), Glow on,
 * viewport 1440×1000, DPR 1, reduced motion. `--warmups` (≥1) samples are
 * discarded, then `--samples` (≥7) are judged. Every sample is cold: a new
 * browser with an empty cache mounts a new card; the warm metrics run in the
 * same page after the module has loaded.
 *
 * Metrics (judged on median AND p95 against budgets-led-strips.json):
 * firstStableRenderMs (mount → stripes and fields of every visible strip,
 * cold import included), warmSpaceReadyMs (space switch with the module
 * loaded → stable LED frame), stateUpdateMs (the interaction profile's method:
 * hass update → every stripe in its new state), panZoomMs (the interaction
 * profile's camera scenario, benchmark_large_house.mjs) and the longest Long
 * Task of the camera — the scenario and the 100-step series, retained heap
 * after 20 A→B→C→A cycles over a warm cycle (same GC protocol).
 * #789 additionally observes cameraFullCycleLongTaskMaxMs continuously through
 * full-quality restoration, immediate restart and a 500 ms tail, with the same
 * camera ceiling. Historical camera windows remain unchanged; each row retains
 * raw full-cycle Long Tasks and phase boundaries for audit.
 *
 * Counters (exact, every sample): geometry/visibility recomputes over 100
 * unrelated HA ticks, 100 pan/zoom steps and a colour-only change (0); the
 * three LED caches of the shown space — shapes ≤ 50, visibility ≤ 50,
 * compact visibility paths ≤ 2500 and retained path text ≤ 4 Mi characters
 * (≤ 8 MiB UTF-16) — identical after every cycle (growth 0). The true fan
 * count remains diagnostic: #788 removed lossy endpoint/vertex thinning;
 * after disconnect 0 retained entries and 0 live LED timers/observers; a
 * late import after disconnect restores nothing (one extra cold run with the
 * runtime response delayed); LED chunk requests (none without strips, never
 * the editor chunk in the View).
 *
 * `--merge=a.json,b.json` judges the rows of several partial reports of the
 * same size as one run — the samples are the same cold samples, only the
 * process that collected them differs (a runner with a short step limit);
 * `--warmup-only` collects the discarded warm-up of such a run.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { launch } from './serve.mjs';
import { makeLedStripsFixture } from './performance/led-strips-fixture.mjs';
import { ledChunkRequestName } from './performance/led-chunk-request.mjs';
import { cameraCycleFailures, cameraCycleSampleFailures, finishLedCameraCycle } from './performance/led-camera-cycle.mjs';

const valueArg = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const warmupOnly = process.argv.includes('--warmup-only');
const samples = warmupOnly ? 0 : Math.max(1, Math.min(20, Number(valueArg('samples')) || 7));
const warmups = warmupOnly ? 1 : Math.max(0, Math.min(5, Number(valueArg('warmups') ?? 1)));
const size = valueArg('size') ?? '10x5';
const output = valueArg('output') ? resolve(valueArg('output')) : null;
const merge = valueArg('merge')?.split(',').filter(Boolean).map((file) => resolve(file)) ?? null;
const skipLateImport = process.argv.includes('--no-late-import');
const SIZES = { '10x5': [10, 5], '50x50': [50, 50], none: [0, 0] };
if (!SIZES[size]) throw new Error(`unknown size: ${size}`);
const [STRIPS, POINTS] = SIZES[size];
const PROFILE = 'led-strips-v1';
const CYCLES = Math.max(1, Math.min(20, Number(valueArg('cycles')) || 20));
const MIN_SAMPLES = 7;

const fixture = makeLedStripsFixture(STRIPS, POINTS);
const sourceSha = (() => {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; }
})();
const budgets = JSON.parse(readFileSync(new URL('./performance/budgets-led-strips.json', import.meta.url), 'utf8'));

/**
 * Installed in the page before the card mounts anything: timers, frames and
 * observers created from an LED chunk (its file name is in the creation
 * stack) are tracked until they fire, are cleared or disconnected.
 */
function installLedLifecycleTracker() {
  if (window.__ledLive) return;
  const live = { timers: new Set(), frames: new Set(), observers: new Set() };
  window.__ledLive = live;
  const fromLed = () => /led-strip-/.test(new Error().stack || '');
  const nativeTimeout = window.setTimeout, nativeClearTimeout = window.clearTimeout;
  window.setTimeout = function setTimeout(fn, ms, ...rest) {
    const mine = fromLed();
    let id = 0;
    id = nativeTimeout.call(window, typeof fn === 'function'
      ? (...args) => { live.timers.delete(id); return fn(...args); } : fn, ms, ...rest);
    if (mine) live.timers.add(id);
    return id;
  };
  window.clearTimeout = function clearTimeout(id) { live.timers.delete(id); return nativeClearTimeout.call(window, id); };
  const nativeInterval = window.setInterval, nativeClearInterval = window.clearInterval;
  window.setInterval = function setInterval(fn, ms, ...rest) {
    const id = nativeInterval.call(window, fn, ms, ...rest);
    if (fromLed()) live.timers.add(id);
    return id;
  };
  window.clearInterval = function clearInterval(id) { live.timers.delete(id); return nativeClearInterval.call(window, id); };
  const nativeFrame = window.requestAnimationFrame, nativeCancelFrame = window.cancelAnimationFrame;
  window.requestAnimationFrame = function requestAnimationFrame(fn) {
    const mine = fromLed();
    let id = 0;
    id = nativeFrame.call(window, (time) => { live.frames.delete(id); return fn(time); });
    if (mine) live.frames.add(id);
    return id;
  };
  window.cancelAnimationFrame = function cancelAnimationFrame(id) { live.frames.delete(id); return nativeCancelFrame.call(window, id); };
  for (const name of ['ResizeObserver', 'MutationObserver', 'IntersectionObserver']) {
    const Native = window[name];
    if (!Native) continue;
    window[name] = class extends Native {
      constructor(callback) {
        super(callback);
        if (fromLed()) live.observers.add(this);
      }
      disconnect() { live.observers.delete(this); return super.disconnect(); }
    };
  }
}

/** The page side of one mount: the same fixture host as before, shared by the sample and the late-import run. */
function pageHost() {
  return `
    window.__finishLedCameraCycle = ${finishLedCameraCycle.toString()};
    window.__ledHost = (fixture) => {
      const card = document.createElement('houseplan-card');
      card.setConfig({ type: 'custom:houseplan-card', title: 'LED strips', icon_size: 3.4 });
      let states = fixture.states;
      const hassBase = {
        language: 'en', locale: { language: 'en' },
        user: { id: 'perf', name: 'Performance fixture', is_admin: true },
        devices: fixture.devices, entities: fixture.entities, areas: fixture.areas,
        callWS: async (message) => {
          if (message.type === 'houseplan/config/get') return { config: structuredClone(fixture.config), rev: 1, can_write: true };
          if (message.type === 'houseplan/layout/get') return { layout: structuredClone(fixture.layout), rev: 1 };
          if (message.type === 'config/device_registry/list') return Object.values(fixture.devices);
          if (message.type === 'config/entity_registry/list') return Object.values(fixture.entities);
          return { ok: true };
        },
        callService: async () => undefined,
        connection: { subscribeEvents: async () => () => undefined, subscribeMessage: async () => () => undefined },
        localize: () => null,
        formatEntityState: (state) => state.state,
        config: { unit_system: { length: 'km' } },
      };
      return {
        card,
        get states() { return states; },
        setStates(next) { states = next; card.hass = { ...hassBase, states }; },
      };
    };
    window.__ledStats = async (card) => {
      const url = performance.getEntriesByType('resource').map((entry) => entry.name)
        .find((name) => /led-strip-runtime-[^/]+\\.js/.test(name));
      if (!url) return { shapes: 0, visibility: 0, sources: 0, visibilityPaths: 0, pathChars: 0, recomputes: 0, loaded: false };
      const runtime = await import(url);
      return { ...runtime.ledStats(card), loaded: true };
    };
    window.__ledLiveCounts = () => ({
      timers: window.__ledLive.timers.size, frames: window.__ledLive.frames.size,
      observers: window.__ledLive.observers.size,
    });
  `;
}

async function sample() {
  const { page, browser } = await launch({ width: 1440, height: 1000 }, 1,
    ['--enable-precise-memory-info', '--js-flags=--expose-gc']);
  const chromium = await browser.version();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const requests = [];
  page.on('request', (request) => {
    const name = ledChunkRequestName(request.url());
    if (name) requests.push(name);
  });
  try {
    await page.evaluate(installLedLifecycleTracker);
    await page.evaluate(pageHost());
    const row = await page.evaluate(async ({ fixture, strips, cycles }) => {
      const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
      const until = async (predicate, timeout = 30000) => {
        const started = performance.now();
        while (!predicate()) {
          if (performance.now() - started > timeout) throw new Error('led-strips-v1 timed out');
          await sleep(5);
        }
      };
      const longTasks = (onEntries) => {
        const entries = [];
        const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
        observer.observe({ type: 'longtask', buffered: false });
        return async () => {
          await sleep(0);
          entries.push(...observer.takeRecords());
          observer.disconnect();
          onEntries?.(entries.map(({ startTime, duration }) => ({ startTime, duration })));
          return Number(Math.max(0, ...entries.map((entry) => entry.duration)).toFixed(2));
        };
      };
      const gc = async () => { if (globalThis.gc) { globalThis.gc(); await frame(); globalThis.gc(); await frame(); } };
      window.__card?.remove?.();
      localStorage.clear();
      const host = window.__ledHost(fixture);
      const { card } = host;
      const root = () => card.renderRoot;
      const count = (selector) => root()?.querySelectorAll(selector).length ?? 0;
      const ledStable = (state = 'on') => count(`[data-led-strip][data-state="${state}"]`) === strips
        && (state !== 'on' || count('.led-fields [data-led-field]') === strips);
      const stats = () => window.__ledStats(card);

      const started = performance.now();
      document.getElementById('host').replaceChildren(card);
      host.setStates(host.states);
      await until(() => card._loadOk && card._model?.length === 3);
      if (strips) await until(() => ledStable());
      else { await until(() => card._booting === false); await frame(); }
      await frame();
      const firstStableRenderMs = Number((performance.now() - started).toFixed(2));

      const warm = performance.now();
      card._pickSpace('perf-floor-2');
      await card.updateComplete;
      if (strips) await until(() => ledStable());
      await frame();
      const warmSpaceReadyMs = Number((performance.now() - warm).toFixed(2));

      const states = host.states;
      const floorLights = Object.keys(states).filter((id) => id.startsWith('light.perf_led_1_'));
      const stateStarted = performance.now();
      host.setStates({ ...states, ...Object.fromEntries(floorLights.map((id) => [id, { ...states[id], state: 'off' }])) });
      await card.updateComplete;
      if (strips) await until(() => ledStable('off'));
      await frame();
      const stateUpdateMs = Number((performance.now() - stateStarted).toFixed(2));
      host.setStates({ ...states, ...Object.fromEntries(floorLights.map((id) => [id, { ...states[id], state: 'on' }])) });
      await card.updateComplete;
      if (strips) await until(() => ledStable());
      await frame();

      const before = await stats();
      // 100 unrelated HA ticks.
      const sensor = Object.keys(host.states).find((id) => id.startsWith('sensor.'));
      for (let tick = 0; tick < 100; tick++) {
        host.setStates({ ...host.states, [sensor]: { ...host.states[sensor], state: String(20 + (tick % 10) / 10) } });
        await card.updateComplete;
      }
      await frame();
      const afterTicks = await stats();
      // The camera: the interaction profile's scenario (one wheel step, its
      // render and frame — benchmark_large_house.mjs), then 100 steps whose
      // Long Tasks are judged too and whose recomputes are counted.
      const stage = root().querySelector('.stage');
      const rect = stage.getBoundingClientRect();
      const wheel = (deltaY) => stage.dispatchEvent(new WheelEvent('wheel', {
        deltaY, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, bubbles: true, cancelable: true,
      }));
      // Keep the old pan/series windows intact. This separate observer also
      // covers the first quality switch, both restores and the quick restart.
      const cameraFullCycle = { startTime: performance.now(), entries: [], phases: {} };
      const stopFullCycle = longTasks(entries => { cameraFullCycle.entries = entries; });
      const stopPan = longTasks();
      const panStarted = performance.now();
      wheel(-120);
      await card.updateComplete;
      await frame();
      const panZoomMs = Number((performance.now() - panStarted).toFixed(2));
      const panZoomLongTaskMaxMs = await stopPan();
      const stopSeries = longTasks();
      // One wheel step per frame, as a real wheel or trackpad delivers them.
      for (let step = 0; step < 100; step++) {
        wheel(step % 2 ? 60 : -60);
        await card.updateComplete;
        await frame();
      }
      await frame();
      const cameraSeriesLongTaskMaxMs = await stopSeries();
      cameraFullCycle.phases.seriesEnd = performance.now();
      Object.assign(cameraFullCycle.phases, await window.__finishLedCameraCycle({
        fullQuality: () => !card.hasAttribute('data-led-zoom-quality'),
        input: async () => { wheel(-60); await card.updateComplete; },
        frame, now: () => performance.now(), sleep,
      }));
      const cameraFullCycleLongTaskMaxMs = await stopFullCycle();
      cameraFullCycle.endTime = performance.now();
      const afterCamera = await stats();
      // A colour-only change rebuilds no geometry or visibility.
      host.setStates({ ...host.states, ...Object.fromEntries(floorLights.map((id) => [id,
        { ...host.states[id], attributes: { ...host.states[id].attributes, rgb_color: [255, 120, 80] } }])) });
      await card.updateComplete;
      await frame();
      const afterColour = await stats();

      // 20 cycles A→B→C→A after one warm cycle; the three caches identical after each.
      const cycle = async () => {
        for (const id of ['perf-floor-1', 'perf-floor-2', 'perf-floor-3', 'perf-floor-1']) {
          card._pickSpace(id);
          await card.updateComplete;
          if (strips) await until(() => ledStable());
        }
        await frame();
        const { shapes, visibility, sources, visibilityPaths, pathChars } = await stats();
        return { shapes, visibility, sources, visibilityPaths, pathChars };
      };
      await cycle();
      await gc();
      const heapBefore = performance.memory?.usedJSHeapSize ?? null;
      const cycleStats = [];
      for (let index = 0; index < cycles; index++) cycleStats.push(await cycle());
      await gc();
      const heapAfter = performance.memory?.usedJSHeapSize ?? null;
      const liveBeforeDisconnect = window.__ledLiveCounts();
      card.remove();
      await frame();
      await sleep(600);
      const afterDisconnect = await stats();
      const liveAfterDisconnect = window.__ledLiveCounts();
      const key = (entry) => `${entry.shapes}/${entry.visibility}/${entry.sources}/${entry.visibilityPaths}/${entry.pathChars}`;
      return {
        firstStableRenderMs, warmSpaceReadyMs, stateUpdateMs, panZoomMs, panZoomLongTaskMaxMs, cameraSeriesLongTaskMaxMs,
        cameraFullCycleLongTaskMaxMs, cameraFullCycle,
        retainedHeapBytes: heapBefore == null || heapAfter == null ? null : Math.max(0, heapAfter - heapBefore),
        counters: strips ? {
          recomputesOnHaTicks: afterTicks.recomputes - before.recomputes,
          recomputesOnCamera: afterCamera.recomputes - afterTicks.recomputes,
          recomputesOnColour: afterColour.recomputes - afterCamera.recomputes,
          shapes: Math.max(...cycleStats.map((entry) => entry.shapes)),
          visibility: Math.max(...cycleStats.map((entry) => entry.visibility)),
          sources: Math.max(...cycleStats.map((entry) => entry.sources)),
          visibilityPaths: Math.max(...cycleStats.map((entry) => entry.visibilityPaths)),
          pathChars: Math.max(...cycleStats.map((entry) => entry.pathChars)),
          cacheGrowthOverCycles: new Set(cycleStats.map(key)).size - 1,
        } : null,
        disconnect: {
          retained: afterDisconnect.shapes + afterDisconnect.visibility + afterDisconnect.sources
            + afterDisconnect.visibilityPaths + afterDisconnect.pathChars,
          liveBefore: liveBeforeDisconnect,
          live: liveAfterDisconnect.timers + liveAfterDisconnect.frames + liveAfterDisconnect.observers,
        },
      };
    }, { fixture, strips: STRIPS, cycles: CYCLES });
    row.ledRequests = [...new Set(requests)].sort();
    return { row, chromium };
  } finally {
    await browser.close();
  }
}

/**
 * The late import: the card is removed while the runtime chunk is still on
 * the wire (its response is held back); when it lands nothing is rendered,
 * cached or scheduled for the gone card.
 */
async function lateImport() {
  const { page, browser } = await launch({ width: 1440, height: 1000 }, 1, []);
  try {
    let held = false;
    let runtimeUrl = null;
    await page.route(/led-strip-runtime-[^/]+\.js/, async (route) => {
      held = true;
      runtimeUrl = route.request().url();
      await new Promise((done) => setTimeout(done, 1500));
      await route.fallback();
    });
    await page.evaluate(installLedLifecycleTracker);
    await page.evaluate(pageHost());
    const result = await page.evaluate(async ({ fixture }) => {
      const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
      window.__card?.remove?.();
      const host = window.__ledHost(fixture);
      const { card } = host;
      document.getElementById('host').replaceChildren(card);
      host.setStates(host.states);
      const started = performance.now();
      while (!(card._loadOk && card._model?.length === 3) && performance.now() - started < 20000) await sleep(10);
      await sleep(300);
      const before = card.renderRoot.querySelectorAll('[data-led-strip]').length;
      card.remove();
      window.__lateCard = card;
      await sleep(3000);
      return { stripesBeforeLoad: before, stripesAfterLoad: card.renderRoot.querySelectorAll('[data-led-strip]').length };
    }, { fixture });
    // The chunk the card asked for, by its URL: the same module instance.
    const late = await page.evaluate(async (url) => {
      const runtime = url ? await import(url) : null;
      return { stats: runtime ? { ...runtime.ledStats(window.__lateCard), loaded: true } : { shapes: 0, visibility: 0, sources: 0, visibilityPaths: 0, pathChars: 0, loaded: false },
        live: window.__ledLiveCounts() };
    }, runtimeUrl);
    return { ...result, ...late, held };
  } finally {
    await browser.close();
  }
}

let rows = [];
let chromium = null;
let late = null;
let discarded = 0;
if (merge) {
  for (const file of merge) {
    const part = JSON.parse(readFileSync(file, 'utf8'));
    if (part.profile !== PROFILE || part.size !== size) throw new Error(`${file} is not ${PROFILE} ${size}`);
    rows.push(...part.rows);
    discarded += part.warmups;
    chromium ??= part.chromium;
    late ??= part.lateImport ?? null;
  }
} else {
  for (let iteration = 0; iteration < warmups + samples; iteration++) {
    const result = await sample();
    chromium ??= result.chromium;
    if (iteration >= warmups) rows.push(result.row);
  }
  discarded = warmups;
  if (STRIPS && !skipLateImport && !warmupOnly) late = await lateImport();
}
if (warmupOnly) {
  // A discarded warm-up sample for a later --merge: nothing is judged here.
  const text = `${JSON.stringify({ profile: PROFILE, size, sourceSha, chromium, samples: 0, warmups: 1, rows: [], partial: true }, null, 2)}\n`;
  if (output) { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, text); }
  console.log(text);
  process.exit(0);
}

const metric = (name) => {
  const values = rows.map((row) => row[name]).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  const at = (q) => values[Math.min(values.length - 1, Math.ceil(q * values.length) - 1)];
  return { median: values.length ? at(0.5) : null, p95: values.length ? at(0.95) : null, samples: values };
};
const METRICS = ['firstStableRenderMs', 'warmSpaceReadyMs', 'stateUpdateMs', 'panZoomMs', 'panZoomLongTaskMaxMs',
  'cameraSeriesLongTaskMaxMs', 'cameraFullCycleLongTaskMaxMs', 'retainedHeapBytes'];
const report = {
  profile: PROFILE, size, strips: STRIPS, points: POINTS, sourceSha, chromium,
  samples: rows.length, warmups: discarded, cycles: CYCLES, viewport: { width: 1440, height: 1000 }, dpr: 1,
  merged: merge ? merge.length : undefined,
  metrics: Object.fromEntries(METRICS.map((name) => [name, metric(name)])),
  counters: rows[0]?.counters ?? null,
  counterSamples: rows.map((row) => row.counters),
  disconnectSamples: rows.map((row) => row.disconnect),
  lateImport: late,
  ledRequests: [...new Set(rows.flatMap((row) => row.ledRequests))].sort(),
  rows,
};
const failures = [];
const partial = !merge && (samples < MIN_SAMPLES || warmups < 1);
if (!partial && (report.samples < MIN_SAMPLES || report.warmups < 1)) {
  failures.push(`${report.samples} samples after ${report.warmups} warmups: the profile needs ≥ ${MIN_SAMPLES} after ≥ 1`);
}
const limits = budgets.sizes[size] || {};
failures.push(...cameraCycleSampleFailures(rows));
failures.push(...cameraCycleFailures(report.metrics.cameraFullCycleLongTaskMaxMs, limits.cameraSeriesLongTaskMaxMs));
for (const [name, limit] of Object.entries(limits)) {
  for (const stat of ['median', 'p95']) {
    const value = report.metrics[name]?.[stat];
    if (value == null) { if (name !== 'retainedHeapBytes') failures.push(`${name} ${stat} missing`); continue; }
    if (value > limit) failures.push(`${name} ${stat} ${value} > ${limit}`);
  }
}
for (const [index, disconnect] of report.disconnectSamples.entries()) {
  if (disconnect.retained !== 0) failures.push(`sample ${index}: ${disconnect.retained} LED cache entries retained after disconnect`);
  if (disconnect.live !== 0) failures.push(`sample ${index}: ${disconnect.live} LED timers/frames/observers alive after disconnect`);
}
if (STRIPS) {
  const caches = budgets.caches;
  for (const counters of report.counterSamples) {
    for (const key of ['recomputesOnHaTicks', 'recomputesOnCamera', 'recomputesOnColour', 'cacheGrowthOverCycles']) {
      if (counters[key] !== 0) failures.push(`${key} = ${counters[key]}, expected 0`);
    }
    for (const key of ['shapes', 'visibility', 'visibilityPaths', 'pathChars']) {
      if (!Number.isFinite(counters[key])) failures.push(`${key} cache metric missing`);
      else if (counters[key] > caches[key]) failures.push(`${key} cache ${counters[key]} > ${caches[key]}`);
    }
  }
  if (late) {
    if (!late.held || !late.stats.loaded) failures.push('late import: the runtime response was never held or never landed');
    if (late.stripesAfterLoad !== late.stripesBeforeLoad) failures.push('late import rendered the gone card');
    const retained = late.stats.shapes + late.stats.visibility + late.stats.sources
      + late.stats.visibilityPaths + late.stats.pathChars;
    if (retained) failures.push(`late import restored ${retained} cache entries`);
    if (late.live.timers + late.live.frames + late.live.observers) failures.push('late import left LED timers/observers');
  } else if (!skipLateImport) failures.push('late import not measured');
  if (!report.ledRequests.includes('led-strip-runtime') || !report.ledRequests.includes('led-strip-field'))
    failures.push(`LED chunks not loaded: ${report.ledRequests.join(', ')}`);
} else if (report.ledRequests.length) failures.push(`no strips but LED chunks requested: ${report.ledRequests.join(', ')}`);
if (report.ledRequests.includes('led-strip-editor')) failures.push('the View loaded the LED editor chunk');
report.failures = failures;
report.partial = partial || undefined;
const text = `${JSON.stringify(report, null, 2)}\n`;
if (output) { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, text); }
console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
if (failures.length) { console.error(`led-strips-v1 ${size}: ${failures.length} failure(s)`); process.exit(1); }
