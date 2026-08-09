#!/usr/bin/env node
/** Reproducible browser benchmark and report producer for HP-PERF-01. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { launch } from './serve.mjs';
import { LARGE_HOUSE_COUNTS, makeLargeHouseFixture } from './fixtures/large-house.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';
import { summarizeLongTasks, summarizeTimings } from './performance/evaluate.mjs';

const valueArg = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const samples = Math.max(1, Math.min(20, Number(valueArg('samples')) || 7));
const warmups = Math.max(0, Math.min(5, Number(valueArg('warmups')) || 1));
const output = valueArg('output') ? resolve(valueArg('output')) : null;
const targetRoot = resolve(valueArg('target-root') ?? '.');
const fixture = makeLargeHouseFixture();
const viewport = { width: 1440, height: 1000 };

const { page, browser } = await launch(
  viewport,
  1,
  ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
  {},
  resolve(targetRoot, 'demo/srv'),
);
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.addStyleTag({
  content: '*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}',
});
const chromium = await browser.version();
let buildFingerprint;
try {
  buildFingerprint = await assertFreshDemoBundle(page, targetRoot);
} catch (error) {
  await browser.close();
  throw error;
}

const rows = [];
try {
  for (let iteration = 0; iteration < warmups + samples; iteration++) {
    const measuredSample = iteration - warmups;
    const row = await page.evaluate(async ({ fixture, sample }) => {
      const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const until = async (predicate, timeout = 10000) => {
        const started = performance.now();
        while (!predicate()) {
          if (performance.now() - started > timeout) throw new Error('large-house benchmark timed out');
          await new Promise((done) => setTimeout(done, 10));
        }
      };
      const startLongTaskWindow = () => {
        const entries = [];
        if (!PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
          return { stop: async () => ({ supported: false, count: 0, maxMs: 0, totalMs: 0 }) };
        }
        const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
        observer.observe({ type: 'longtask', buffered: false });
        return {
          stop: async () => {
            await new Promise((done) => setTimeout(done, 0));
            entries.push(...observer.takeRecords());
            observer.disconnect();
            const durations = entries.map((entry) => entry.duration);
            return {
              supported: true,
              count: durations.length,
              maxMs: Number((durations.length ? Math.max(...durations) : 0).toFixed(2)),
              totalMs: Number(durations.reduce((sum, value) => sum + value, 0).toFixed(2)),
            };
          },
        };
      };
      const duration = async (action) => {
        const longTasks = startLongTaskWindow();
        const started = performance.now();
        await action();
        await frame();
        return {
          ms: Number((performance.now() - started).toFixed(2)),
          longTasks: await longTasks.stop(),
        };
      };
      const forceGc = async () => {
        if (typeof globalThis.gc !== 'function') return false;
        globalThis.gc();
        await frame();
        globalThis.gc();
        await frame();
        return true;
      };
      const cacheSnapshot = (card) => ({
        cleanFloor: card._cleanFloorCache?.size ?? 0,
        glowClip: card._glowClipCache?.size ?? 0,
        wallUnion: card._wallUnionCache ? 1 : 0,
        openingTunnel: card._openingTunnelCache ? 1 : 0,
        openingWallIndex: card._openingWallIndexCache ? 1 : 0,
      });

      window.__card?.remove?.();
      localStorage.clear();
      const host = document.getElementById('host');
      const card = document.createElement('houseplan-card');
      card.setConfig({
        type: 'custom:houseplan-card', title: `Performance baseline ${sample}`, icon_size: 3.4,
      });
      const connection = {
        subscribeEvents: async () => () => undefined,
        subscribeMessage: async () => () => undefined,
      };
      const hassFor = (states) => ({
        language: 'en', locale: { language: 'en' },
        user: { id: 'perf', name: 'Performance fixture', is_admin: true },
        devices: fixture.devices, entities: fixture.entities, areas: fixture.areas, states,
        floors: {
          one: { floor_id: 'one', name: 'One', level: 0 },
          two: { floor_id: 'two', name: 'Two', level: 1 },
          three: { floor_id: 'three', name: 'Three', level: 2 },
        },
        callWS: async (message) => {
          if (message.type === 'houseplan/config/get')
            return { config: structuredClone(fixture.config), rev: 1, can_write: true };
          if (message.type === 'houseplan/layout/get')
            return { layout: structuredClone(fixture.layout), rev: 1 };
          if (message.type === 'config/device_registry/list') return Object.values(fixture.devices);
          if (message.type === 'config/entity_registry/list') return Object.values(fixture.entities);
          if (message.type === 'config_entries/get')
            return [{ entry_id: 'perf_entry', domain: 'houseplan_perf', title: 'Synthetic performance fixture' }];
          if (message.type === 'manifest/list') return [{ domain: 'houseplan_perf', name: 'House Plan Performance' }];
          return { ok: true };
        },
        callService: async () => undefined,
        connection,
        localize: () => null,
        formatEntityState: (state) => state.state,
        config: { unit_system: { length: 'km' } },
      });

      const loadLongTasks = startLongTaskWindow();
      const loadStarted = performance.now();
      host.replaceChildren(card);
      card.hass = hassFor(fixture.states);
      await until(() => card._loadOk && card._model?.length === fixture.counts.floors);
      await card.updateComplete;
      await frame();
      const modelReadyMs = Number((performance.now() - loadStarted).toFixed(2));
      await until(() => card._booting === false);
      await frame();
      const firstStableRenderMs = Number((performance.now() - loadStarted).toFixed(2));
      const loadLongTaskResult = await loadLongTasks.stop();
      const spaceSwitch = await duration(async () => {
        card._pickSpace('perf-floor-2');
        await card.updateComplete;
      });

      const firstEntity = Object.keys(fixture.states)[0];
      const nextStates = {
        ...fixture.states,
        [firstEntity]: { ...fixture.states[firstEntity], state: fixture.states[firstEntity].state === 'on' ? 'off' : 'on' },
      };
      const stateUpdate = await duration(async () => {
        card.hass = hassFor(nextStates);
        await card.updateComplete;
      });

      const resizePreview = await duration(async () => {
        card._setMode('plan');
        card._tool = 'resize';
        await card.updateComplete;
        const room = card._rszRooms()[0];
        const pointerId = 777;
        const quietEvent = {
          pointerId,
          stopPropagation: () => undefined,
          preventDefault: () => undefined,
          target: null,
        };
        card._rszEdgeDown(quietEvent, room.id, 1);
        const plan = card._rszDrag?.plan;
        if (!plan) throw new Error('large-house resize plan was not created');
        const target = [
          plan.a[0] + plan.n[0] * card._gridPitch,
          plan.a[1] + plan.n[1] * card._gridPitch,
        ];
        const stage = card.renderRoot.querySelector('.stage');
        const rect = stage.getBoundingClientRect();
        const view = card._viewOr(card._baseVb());
        card._rszMove({
          ...quietEvent,
          clientX: rect.left + ((target[0] - view.x) / view.w) * rect.width,
          clientY: rect.top + ((target[1] - view.y) / view.h) * rect.height,
        });
        await card.updateComplete;
        card._rszCancelDrag();
        card._setMode('view');
        await card.updateComplete;
      });

      const stage = card.renderRoot.querySelector('.stage');
      const rect = stage.getBoundingClientRect();
      const panZoom = await duration(async () => {
        stage.dispatchEvent(new WheelEvent('wheel', {
          deltaY: -120, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
          bubbles: true, cancelable: true,
        }));
        await card.updateComplete;
      });

      const settingsDialog = await duration(async () => {
        card._openSettingsDialog();
        await card.updateComplete;
      });
      card._settingsDialog = null;
      await card.updateComplete;

      const switchCycle = await duration(async () => {
        for (let index = 0; index < 12; index++) {
          card._pickSpace(`perf-floor-${(index % fixture.counts.floors) + 1}`);
          await card.updateComplete;
          // A user cannot produce twelve tab clicks in one JavaScript task.
          // Yield between interactions so Long Task entries describe one
          // switch, while switchCycleMs still measures the complete cycle.
          await new Promise((done) => setTimeout(done, 0));
        }
      });

      await forceGc();
      const cacheBefore = cacheSnapshot(card);
      const heapBefore = performance.memory?.usedJSHeapSize ?? null;
      for (let round = 0; round < 4; round++) {
        for (let index = 0; index < 12; index++) {
          card._pickSpace(`perf-floor-${(index % fixture.counts.floors) + 1}`);
          await card.updateComplete;
          await new Promise((done) => setTimeout(done, 0));
        }
        await forceGc();
      }
      const cacheEntries = cacheSnapshot(card);
      const heapAfter = performance.memory?.usedJSHeapSize ?? null;
      const cacheGrowth = Object.fromEntries(
        Object.keys(cacheEntries).map((key) => [key, cacheEntries[key] - cacheBefore[key]]),
      );

      const result = {
        sample,
        modelReadyMs,
        firstStableRenderMs,
        spaceSwitchMs: spaceSwitch.ms,
        stateUpdateMs: stateUpdate.ms,
        resizePreviewMs: resizePreview.ms,
        panZoomMs: panZoom.ms,
        settingsDialogMs: settingsDialog.ms,
        switchCycleMs: switchCycle.ms,
        longTasks: {
          load: loadLongTaskResult,
          spaceSwitch: spaceSwitch.longTasks,
          stateUpdate: stateUpdate.longTasks,
          resizePreview: resizePreview.longTasks,
          panZoom: panZoom.longTasks,
          settingsDialog: settingsDialog.longTasks,
          switchCycle: switchCycle.longTasks,
        },
        cacheEntries,
        cacheGrowth,
        heapGrowthBytes: heapBefore == null || heapAfter == null ? null : heapAfter - heapBefore,
        preciseGc: typeof globalThis.gc === 'function',
        renderedDevices: card._devices?.length ?? 0,
      };
      card.remove();
      await frame();
      return result;
    }, { fixture, sample: measuredSample });
    if (measuredSample >= 0) rows.push(row);
  }
} finally {
  await browser.close();
}

const metricNames = [
  'modelReadyMs', 'firstStableRenderMs', 'spaceSwitchMs', 'stateUpdateMs',
  'resizePreviewMs', 'panZoomMs', 'settingsDialogMs', 'switchCycleMs',
];
const report = {
  schema: 2,
  profile: 'large-house-v1',
  generatedAt: new Date().toISOString(),
  buildFingerprint,
  runtime: {
    node: process.version,
    chromium,
    platform: process.platform,
    arch: process.arch,
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: true,
  },
  fixture: LARGE_HOUSE_COUNTS,
  samples,
  warmups,
  summary: summarizeTimings(rows, metricNames),
  longTasks: summarizeLongTasks(rows),
  rows,
  note: 'Compare with a base-SHA report captured by the same runner and evaluate demo/performance/budgets.json.',
};

const text = `${JSON.stringify(report, null, 2)}\n`;
if (output) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, text, 'utf8');
  console.log(output);
} else {
  process.stdout.write(text);
}
