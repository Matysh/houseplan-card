#!/usr/bin/env node
/**
 * Reproducible browser baseline for HP-PERF-01.
 *
 * This is a benchmark, not a pass/fail test. It intentionally records data
 * before budgets are approved; using an arbitrary local number as a CI gate
 * would make the result less trustworthy, not more.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { launch } from './serve.mjs';
import { LARGE_HOUSE_COUNTS, makeLargeHouseFixture } from './fixtures/large-house.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';

const sampleArg = process.argv.find((arg) => arg.startsWith('--samples='));
const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
const samples = Math.max(1, Math.min(20, Number(sampleArg?.split('=')[1]) || 3));
const output = outputArg ? resolve(outputArg.slice('--output='.length)) : null;
const fixture = makeLargeHouseFixture();

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))];
};

const { page, browser } = await launch(
  { width: 1440, height: 1000 },
  1,
  ['--enable-precise-memory-info'],
);
await page.emulateMedia({ reducedMotion: 'reduce' });
const chromium = await browser.version();
let buildFingerprint;
try {
  buildFingerprint = await assertFreshDemoBundle(page);
} catch (error) {
  await browser.close();
  throw error;
}

const rows = [];
try {
  for (let sample = 0; sample < samples; sample++) {
    rows.push(await page.evaluate(async ({ fixture, sample }) => {
    const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const until = async (predicate, timeout = 10000) => {
      const started = performance.now();
      while (!predicate()) {
        if (performance.now() - started > timeout) throw new Error('large-house benchmark timed out');
        await new Promise((done) => setTimeout(done, 10));
      }
    };
    const duration = async (action) => {
      const started = performance.now();
      await action();
      await frame();
      return Number((performance.now() - started).toFixed(2));
    };

    window.__card?.remove?.();
    localStorage.clear();
    const host = document.getElementById('host');
    const card = document.createElement('houseplan-card');
    card.setConfig({
      type: 'custom:houseplan-card', title: `Performance baseline ${sample}`, icon_size: 3.4,
    });
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
      connection: { subscribeEvents: async () => () => undefined, subscribeMessage: async () => () => undefined },
      localize: () => null,
      formatEntityState: (state) => state.state,
      config: { unit_system: { length: 'km' } },
    });

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
    const steadyHeap = performance.memory?.usedJSHeapSize ?? null;
    if (card._openingTunnelCache === undefined || card._openingWallIndexCache === undefined) {
      throw new Error('loaded bundle does not expose the expected opening geometry caches');
    }

    const spaceSwitchMs = await duration(async () => {
      card._pickSpace('perf-floor-2');
      await card.updateComplete;
    });

    const firstEntity = Object.keys(fixture.states)[0];
    const nextStates = {
      ...fixture.states,
      [firstEntity]: { ...fixture.states[firstEntity], state: fixture.states[firstEntity].state === 'on' ? 'off' : 'on' },
    };
    const stateUpdateMs = await duration(async () => {
      card.hass = hassFor(nextStates);
      await card.updateComplete;
    });

    const stage = card.renderRoot.querySelector('.stage');
    const rect = stage.getBoundingClientRect();
    const panZoomMs = await duration(async () => {
      stage.dispatchEvent(new WheelEvent('wheel', {
        deltaY: -120, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
        bubbles: true, cancelable: true,
      }));
      await card.updateComplete;
    });

    const settingsDialogMs = await duration(async () => {
      card._openSettingsDialog();
      await card.updateComplete;
    });
    card._settingsDialog = null;
    await card.updateComplete;

    const switchCycleMs = await duration(async () => {
      for (let index = 0; index < 12; index++) {
        card._pickSpace(`perf-floor-${(index % fixture.counts.floors) + 1}`);
        await card.updateComplete;
      }
    });

    const result = {
      sample,
      modelReadyMs,
      firstStableRenderMs,
      spaceSwitchMs,
      stateUpdateMs,
      panZoomMs,
      settingsDialogMs,
      switchCycleMs,
      cacheEntries: {
        cleanFloor: card._cleanFloorCache?.size ?? 0,
        glowClip: card._glowClipCache?.size ?? 0,
        wallUnion: card._wallUnionCache ? 1 : 0,
        openingTunnel: card._openingTunnelCache ? 1 : 0,
        openingWallIndex: card._openingWallIndexCache ? 1 : 0,
      },
      heapGrowthBytes: steadyHeap == null ? null : performance.memory.usedJSHeapSize - steadyHeap,
      renderedDevices: card._devices?.length ?? 0,
    };
    card.remove();
    await frame();
    return result;
    }, { fixture, sample }));
  }
} finally {
  await browser.close();
}

const metricNames = [
  'modelReadyMs', 'firstStableRenderMs', 'spaceSwitchMs', 'stateUpdateMs',
  'panZoomMs', 'settingsDialogMs', 'switchCycleMs',
];
const summary = Object.fromEntries(metricNames.map((metric) => {
  const values = rows.map((row) => row[metric]);
  return [metric, {
    median: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    min: Math.min(...values),
    max: Math.max(...values),
  }];
}));
const report = {
  schema: 1,
  generatedAt: new Date().toISOString(),
  buildFingerprint,
  runtime: { node: process.version, chromium, platform: process.platform, arch: process.arch },
  fixture: LARGE_HOUSE_COUNTS,
  samples,
  summary,
  rows,
  note: 'Baseline only. Budgets must be approved from repeated CI-profile measurements.',
};

const text = `${JSON.stringify(report, null, 2)}\n`;
if (output) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, text, 'utf8');
  console.log(output);
} else {
  process.stdout.write(text);
}
