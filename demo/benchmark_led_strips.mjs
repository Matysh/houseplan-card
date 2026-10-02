#!/usr/bin/env node
/**
 * #780 ТЗ §13.2: the `led-strips-v1` performance profile.
 *
 * The `large-house-v1` fixture (200 devices, 3 floors, 60 rooms, 100
 * openings) with 10 or 50 of each floor's existing devices shown as LED
 * strips that are on: `--size=10x5` (10 strips × 5 points) or `--size=50x50`
 * (50 strips × 50 points); `--size=none` is the same build and plan without
 * strips. No icon is added: the converted devices keep their ids, only their
 * entity becomes a light. Light radius 50 cm (the strip default), Glow on,
 * viewport 1440×1000, DPR 1, reduced motion. Every sample is cold: a new
 * browser with an empty cache mounts a new card.
 *
 * Metrics (judged on median and p95 against budgets-led-strips.json):
 * firstStableRenderMs (mount → stripes and fields of every visible strip),
 * warmSpaceReadyMs (space switch with the module loaded → stable LED frame),
 * stateUpdateMs (all strip sources switched → every stripe in its new state),
 * panZoomMs and its longest Long Task, retained heap after 20 A→B→C→A cycles.
 * Counters (must be exact): field geometry recomputes over 100 unrelated HA
 * ticks, 100 pan/zoom steps and a colour-only change (0), cache entries ≤ 50
 * and equal after every cycle, LED chunk requests (none without strips).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { launch } from './serve.mjs';
import { makeLedStripsFixture } from './performance/led-strips-fixture.mjs';

const valueArg = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const samples = Math.max(1, Math.min(20, Number(valueArg('samples')) || 7));
const warmups = Math.max(0, Math.min(5, Number(valueArg('warmups')) || 1));
const size = valueArg('size') ?? '10x5';
const output = valueArg('output') ? resolve(valueArg('output')) : null;
const SIZES = { '10x5': [10, 5], '50x50': [50, 50], none: [0, 0] };
if (!SIZES[size]) throw new Error(`unknown size: ${size}`);
const [STRIPS, POINTS] = SIZES[size];
const PROFILE = 'led-strips-v1';
const CYCLES = Math.max(1, Math.min(20, Number(valueArg('cycles')) || 20));

const fixture = makeLedStripsFixture(STRIPS, POINTS);
const sourceSha = (() => {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; }
})();
const budgets = JSON.parse(readFileSync(new URL('./performance/budgets-led-strips.json', import.meta.url), 'utf8'));

const rows = [];
let chromium = null;
for (let iteration = 0; iteration < warmups + samples; iteration++) {
  const { page, browser } = await launch({ width: 1440, height: 1000 }, 1,
    ['--enable-precise-memory-info', '--js-flags=--expose-gc']);
  chromium ??= await browser.version();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const requests = [];
  page.on('request', (request) => {
    const name = request.url().replace(/.*\//, '').replace(/\?.*$/, '');
    if (/^led-strip-(runtime|field|editor)-/.test(name)) requests.push(name.replace(/-[^-]+\.js$/, ''));
  });
  try {
    const row = await page.evaluate(async ({ fixture, strips, cycles }) => {
      const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
      const until = async (predicate, timeout = 20000) => {
        const started = performance.now();
        while (!predicate()) {
          if (performance.now() - started > timeout) throw new Error('led-strips-v1 timed out');
          await sleep(5);
        }
      };
      const longTasks = () => {
        const entries = [];
        const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
        observer.observe({ type: 'longtask', buffered: false });
        return async () => {
          await sleep(0);
          entries.push(...observer.takeRecords());
          observer.disconnect();
          return Number(Math.max(0, ...entries.map((entry) => entry.duration)).toFixed(2));
        };
      };
      const gc = async () => { if (globalThis.gc) { globalThis.gc(); await frame(); globalThis.gc(); await frame(); } };
      window.__card?.remove?.();
      localStorage.clear();
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
      const setStates = (next) => { states = next; card.hass = { ...hassBase, states }; };
      const root = () => card.renderRoot;
      const count = (selector) => root()?.querySelectorAll(selector).length ?? 0;
      const ledStable = (state = 'on') => count(`[data-led-strip][data-state="${state}"]`) === strips
        && (state !== 'on' || count('.led-fields [data-led-field]') === strips);
      const cache = () => {
        const group = root().querySelector('.led-fields');
        return group ? { size: Number(group.dataset.ledCache), recomputes: Number(group.dataset.ledRecomputes) } : null;
      };

      const started = performance.now();
      document.getElementById('host').replaceChildren(card);
      setStates(states);
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

      const floorLights = Object.keys(states).filter((id) => id.startsWith('light.perf_led_1_'));
      const stateStarted = performance.now();
      setStates({ ...states, ...Object.fromEntries(floorLights.map((id) => [id, { ...states[id], state: 'off' }])) });
      await card.updateComplete;
      if (strips) await until(() => ledStable('off'));
      await frame();
      const stateUpdateMs = Number((performance.now() - stateStarted).toFixed(2));
      setStates({ ...states, ...Object.fromEntries(floorLights.map((id) => [id, { ...states[id], state: 'on' }])) });
      await card.updateComplete;
      if (strips) await until(() => ledStable());
      await frame();

      const before = strips ? cache() : null;
      // 100 unrelated HA ticks.
      const sensor = Object.keys(states).find((id) => id.startsWith('sensor.'));
      for (let tick = 0; tick < 100; tick++) {
        setStates({ ...states, [sensor]: { ...states[sensor], state: String(20 + (tick % 10) / 10) } });
        await card.updateComplete;
      }
      await frame();
      const afterTicks = strips ? cache() : null;
      // Pan/zoom: the camera scenario, then 100 steps for the counter.
      const stage = root().querySelector('.stage');
      const rect = stage.getBoundingClientRect();
      const wheel = (deltaY) => stage.dispatchEvent(new WheelEvent('wheel', {
        deltaY, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, bubbles: true, cancelable: true,
      }));
      const stopPan = longTasks();
      const panStarted = performance.now();
      wheel(-120);
      await card.updateComplete;
      await frame();
      const panZoomMs = Number((performance.now() - panStarted).toFixed(2));
      const panZoomLongTaskMaxMs = await stopPan();
      // 100 more camera steps for the counters only (not a timing window).
      for (let step = 0; step < 100; step++) {
        wheel(step % 2 ? 60 : -60);
        await card.updateComplete;
      }
      await frame();
      const afterCamera = strips ? cache() : null;
      // A colour-only change rebuilds no geometry or visibility.
      setStates({ ...states, ...Object.fromEntries(floorLights.map((id) => [id,
        { ...states[id], attributes: { ...states[id].attributes, rgb_color: [255, 120, 80] } }])) });
      await card.updateComplete;
      await frame();
      const afterColour = strips ? cache() : null;

      // 20 cycles A→B→C→A after one warm cycle; cache size equal after each.
      const cycle = async () => {
        for (const id of ['perf-floor-1', 'perf-floor-2', 'perf-floor-3', 'perf-floor-1']) {
          card._pickSpace(id);
          await card.updateComplete;
          if (strips) await until(() => ledStable());
        }
        await frame();
        return strips ? cache().size : 0;
      };
      await cycle();
      await gc();
      const heapBefore = performance.memory?.usedJSHeapSize ?? null;
      const sizes = [];
      for (let index = 0; index < cycles; index++) sizes.push(await cycle());
      await gc();
      const heapAfter = performance.memory?.usedJSHeapSize ?? null;
      card.remove();
      await frame();
      return {
        firstStableRenderMs, warmSpaceReadyMs, stateUpdateMs, panZoomMs, panZoomLongTaskMaxMs,
        retainedHeapBytes: heapBefore == null || heapAfter == null ? null : Math.max(0, heapAfter - heapBefore),
        counters: strips ? {
          recomputesOnHaTicks: afterTicks.recomputes - before.recomputes,
          recomputesOnCamera: afterCamera.recomputes - afterTicks.recomputes,
          recomputesOnColour: afterColour.recomputes - afterCamera.recomputes,
          cacheEntries: Math.max(...sizes),
          cacheGrowthOverCycles: Math.max(...sizes) - Math.min(...sizes),
        } : null,
      };
    }, { fixture, strips: STRIPS, cycles: CYCLES });
    row.ledRequests = [...new Set(requests)].sort();
    if (iteration >= warmups) rows.push(row);
  } finally {
    await browser.close();
  }
}

const metric = (name) => {
  const values = rows.map((row) => row[name]).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  const at = (q) => values[Math.min(values.length - 1, Math.ceil(q * values.length) - 1)];
  return { median: values.length ? at(0.5) : null, p95: values.length ? at(0.95) : null, samples: values };
};
const METRICS = ['firstStableRenderMs', 'warmSpaceReadyMs', 'stateUpdateMs', 'panZoomMs', 'panZoomLongTaskMaxMs', 'retainedHeapBytes'];
const report = {
  profile: PROFILE, size, strips: STRIPS, points: POINTS, sourceSha, chromium,
  samples, warmups, cycles: CYCLES, viewport: { width: 1440, height: 1000 }, dpr: 1,
  metrics: Object.fromEntries(METRICS.map((name) => [name, metric(name)])),
  counters: rows[0]?.counters ?? null,
  counterSamples: rows.map((row) => row.counters),
  ledRequests: [...new Set(rows.flatMap((row) => row.ledRequests))].sort(),
};
const failures = [];
const limits = budgets.sizes[size] || {};
for (const [name, limit] of Object.entries(limits)) {
  for (const stat of ['median', 'p95']) {
    const value = report.metrics[name]?.[stat];
    if (value == null) { if (name !== 'retainedHeapBytes') failures.push(`${name} ${stat} missing`); continue; }
    if (value > limit) failures.push(`${name} ${stat} ${value} > ${limit}`);
  }
}
if (STRIPS) {
  for (const counters of report.counterSamples) {
    for (const key of ['recomputesOnHaTicks', 'recomputesOnCamera', 'recomputesOnColour', 'cacheGrowthOverCycles']) {
      if (counters[key] !== 0) failures.push(`${key} = ${counters[key]}, expected 0`);
    }
    if (counters.cacheEntries > budgets.cacheEntries) failures.push(`cache entries ${counters.cacheEntries} > ${budgets.cacheEntries}`);
  }
  if (!report.ledRequests.includes('led-strip-runtime') || !report.ledRequests.includes('led-strip-field'))
    failures.push(`LED chunks not loaded: ${report.ledRequests.join(', ')}`);
} else if (report.ledRequests.length) failures.push(`no strips but LED chunks requested: ${report.ledRequests.join(', ')}`);
if (report.ledRequests.includes('led-strip-editor')) failures.push('the View loaded the LED editor chunk');
report.failures = failures;
const text = `${JSON.stringify(report, null, 2)}\n`;
if (output) { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, text); }
console.log(text);
if (failures.length) { console.error(`led-strips-v1 ${size}: ${failures.length} failure(s)`); process.exit(1); }
