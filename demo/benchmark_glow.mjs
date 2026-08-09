#!/usr/bin/env node
/** Isolated 1/10/30/60-pool performance profiles for #19 and #55. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { launch } from './serve.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';
import { summarizeLongTasks, summarizeTimings } from './performance/evaluate.mjs';
import { makeLargeHouseFixture } from './fixtures/large-house.mjs';

const valueArg = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const profile = valueArg('profile') || 'large-light-blend-v1';
if (!['large-light-blend-v1', 'large-house-glow-overlay-v1'].includes(profile))
  throw new Error(`unknown Glow profile: ${profile}`);
const parsedSamples = Number(valueArg('samples'));
const parsedWarmups = Number(valueArg('warmups'));
const samples = Math.max(1, Math.min(20, Number.isFinite(parsedSamples) && parsedSamples > 0 ? parsedSamples : 7));
const warmups = Math.max(0, Math.min(5, Number.isFinite(parsedWarmups) && parsedWarmups >= 0 ? parsedWarmups : 1));
const output = valueArg('output') ? resolve(valueArg('output')) : null;
const targetRoot = resolve(valueArg('target-root') ?? '.');
const additiveFixture = JSON.parse(readFileSync(
  new URL('../test/fixtures/glow/additive-pools.json', import.meta.url), 'utf8',
));
additiveFixture.sourceIds = Object.keys(additiveFixture.ha.states)
  .filter((entityId) => entityId.startsWith('light.'));
additiveFixture.roomCount = additiveFixture.config.spaces
  .reduce((sum, space) => sum + space.rooms.length, 0);
additiveFixture.deviceCount = Object.keys(additiveFixture.ha.devices).length;

const makeOverlayFixture = () => {
  const large = makeLargeHouseFixture();
  const firstSpace = large.config.spaces[0].id;
  const sourceDeviceIds = Object.entries(large.layout)
    .filter(([, position]) => position.s === firstSpace)
    .slice(0, 60)
    .map(([deviceId]) => deviceId);
  const sourceIds = [];
  sourceDeviceIds.forEach((deviceId, index) => {
    for (const [entityId, entity] of Object.entries(large.entities)) {
      if (entity.device_id !== deviceId) continue;
      delete large.entities[entityId];
      delete large.states[entityId];
    }
    const entityId = `light.glow_overlay_${String(index + 1).padStart(3, '0')}`;
    large.entities[entityId] = {
      entity_id: entityId, device_id: deviceId, platform: 'houseplan_perf',
      config_entry_id: 'perf_entry', disabled_by: null,
    };
    large.states[entityId] = {
      entity_id: entityId, state: 'on',
      attributes: {
        friendly_name: `Overlay light ${index + 1}`,
        brightness: 96 + (index % 5) * 32,
        rgb_color: index % 2 ? [255, 154, 72] : [92, 156, 255],
      },
    };
    sourceIds.push(entityId);
  });
  // The shared large-house fixture already contains a few ordinary lights.
  // Keep them as devices but turn them off so the profile's pool cardinality
  // is exactly the declared 1/10/30/60, not N plus an unrelated background lamp.
  for (const [entityId, state] of Object.entries(large.states)) {
    if (entityId.startsWith('light.') && !sourceIds.includes(entityId)) {
      large.states[entityId] = { ...state, state: 'off' };
    }
  }
  for (const space of large.config.spaces) {
    space.settings = { ...(space.settings || {}), fill_mode: 'temp', glow_enabled: true };
  }
  return {
    fixture: 'large-house-glow-overlay-v1', variants: [1, 10, 30, 60],
    config: large.config, layout: large.layout,
    ha: { devices: large.devices, entities: large.entities, areas: large.areas, states: large.states },
    sourceIds,
    roomCount: large.counts.rooms,
    deviceCount: large.counts.devices,
  };
};
const fixture = profile === 'large-light-blend-v1' ? additiveFixture : makeOverlayFixture();
const viewport = { width: 1280, height: 900 };

const { page, browser } = await launch(
  viewport, 1,
  ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
  {}, resolve(targetRoot, 'demo/srv'),
);
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
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
    const sample = iteration - warmups;
    const row = await page.evaluate(async ({ fixture, profile, sample }) => {
      const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const until = async (predicate, timeout = 10000) => {
        const started = performance.now();
        while (!predicate()) {
          if (performance.now() - started > timeout) throw new Error('Glow benchmark timed out');
          await new Promise((done) => setTimeout(done, 10));
        }
      };
      const observeLongTasks = () => {
        const entries = [];
        if (!PerformanceObserver.supportedEntryTypes?.includes('longtask'))
          return { stop: async () => ({ supported: false, count: 0, maxMs: 0, totalMs: 0 }) };
        const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
        observer.observe({ type: 'longtask', buffered: false });
        return { stop: async () => {
          await new Promise((done) => setTimeout(done, 0));
          entries.push(...observer.takeRecords());
          observer.disconnect();
          const values = entries.map((entry) => entry.duration);
          return {
            supported: true,
            count: values.length,
            maxMs: Number((values.length ? Math.max(...values) : 0).toFixed(2)),
            totalMs: Number(values.reduce((sum, value) => sum + value, 0).toFixed(2)),
          };
        }};
      };
      const forceGc = async () => {
        if (typeof globalThis.gc !== 'function') return false;
        globalThis.gc(); await frame(); globalThis.gc(); await frame();
        return true;
      };
      const configFor = () => {
        const config = structuredClone(fixture.config);
        if (profile === 'large-light-blend-v1') {
          const settings = config.spaces[0].settings;
          settings.fill_mode = 'glow';
          delete settings.glow_enabled;
        }
        return config;
      };
      const statesFor = (count, brightnessDelta = 0) => {
        const active = new Set(fixture.sourceIds.slice(0, count));
        const sources = new Set(fixture.sourceIds);
        return Object.fromEntries(Object.entries(fixture.ha.states).map(([entityId, state]) => {
          if (!sources.has(entityId)) return [entityId, state];
          return [entityId, {
            ...state,
            state: active.has(entityId) ? 'on' : 'off',
            attributes: {
              ...state.attributes,
              brightness: Math.max(1, Math.min(255, Number(state.attributes.brightness) + brightnessDelta)),
            },
          }];
        }));
      };
      const connection = {
        subscribeEvents: async () => () => undefined,
        subscribeMessage: async () => () => undefined,
      };
      const hassFor = (states) => ({
        language: 'en', locale: { language: 'en' },
        user: { id: 'glow-perf', name: 'Glow performance', is_admin: true },
        devices: fixture.ha.devices, entities: fixture.ha.entities,
        areas: fixture.ha.areas, states, floors: {}, connection,
        callWS: async (message) => {
          if (message.type === 'houseplan/config/get')
            return { config: configFor(), rev: 1, can_write: true };
          if (message.type === 'houseplan/layout/get')
            return { layout: structuredClone(fixture.layout), rev: 1 };
          if (message.type === 'config/device_registry/list') return Object.values(fixture.ha.devices);
          if (message.type === 'config/entity_registry/list') return Object.values(fixture.ha.entities);
          if (message.type === 'config_entries/get')
            return [{ entry_id: 'glow_fixture', domain: 'houseplan_fixture', title: 'Glow fixture' }];
          if (message.type === 'manifest/list')
            return [{ domain: 'houseplan_fixture', name: 'House Plan Glow Fixture' }];
          return { ok: true };
        },
        callService: async () => undefined,
        localize: () => null,
        formatEntityState: (state) => state.state,
        config: { unit_system: { length: 'km' } },
      });
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
      const result = { sample, longTasks: {}, renderCounts: {}, poolCounts: {} };
      const card = document.createElement('houseplan-card');
      card.setConfig({ type: 'custom:houseplan-card', title: `Glow ${profile}`, icon_size: 2.4 });
      host.replaceChildren(card);
      card.hass = hassFor(statesFor(1));
      await until(() => card._loadOk && card._devices?.length === fixture.deviceCount);
      if ('_glowScreenBlend' in card) {
        const probeDeadline = performance.now() + 2500;
        while (!card._glowScreenBlend && performance.now() < probeDeadline)
          await new Promise((done) => setTimeout(done, 10));
      }
      await card.updateComplete;
      await frame();
      for (const count of fixture.variants) {
        // Mount cost is not part of this profile. Prime each source-count
        // state on the same full plan, then measure only the following HA tick.
        card.hass = hassFor(statesFor(count));
        await card.updateComplete;
        await frame();
        let renders = 0;
        const originalUpdate = card.performUpdate.bind(card);
        card.performUpdate = () => { renders++; return originalUpdate(); };
        const longTasks = observeLongTasks();
        const started = performance.now();
        card.hass = hassFor(statesFor(count, 1));
        await card.updateComplete;
        await frame();
        result[`stateUpdate${count}Ms`] = Number((performance.now() - started).toFixed(2));
        result.longTasks[`stateUpdate${count}`] = await longTasks.stop();
        result.renderCounts[count] = renders;
        result.poolCounts[count] = card.renderRoot.querySelectorAll('.glow-pool, .glowlayer circle').length;
      }
      window.__card = card;
      await forceGc();
      const cacheBefore = cacheSnapshot(card);
      const heapBefore = performance.memory?.usedJSHeapSize ?? null;
      for (let index = 0; index < 5; index++) {
        card.hass = hassFor(statesFor(60, index % 2));
        await card.updateComplete;
        await frame();
      }
      await forceGc();
      const cacheEntries = cacheSnapshot(card);
      const heapAfter = performance.memory?.usedJSHeapSize ?? null;
      result.cacheEntries = cacheEntries;
      result.cacheGrowth = Object.fromEntries(
        Object.keys(cacheEntries).map((key) => [key, cacheEntries[key] - cacheBefore[key]]),
      );
      result.heapGrowthBytes = heapBefore == null || heapAfter == null ? null : heapAfter - heapBefore;
      result.preciseGc = typeof globalThis.gc === 'function';
      result.renderedDevices = card._devices?.length ?? 0;
      result.screenBlend = card._glowScreenBlend === true;
      return result;
    }, { fixture, profile, sample });
    const captureStarted = performance.now();
    await page.screenshot({ type: 'png' });
    row.screenshotCaptureMs = Number((performance.now() - captureStarted).toFixed(2));
    if (sample >= 0) rows.push(row);
  }
} finally {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => undefined);
  await browser.close();
}

const metricNames = [
  'stateUpdate1Ms', 'stateUpdate10Ms', 'stateUpdate30Ms', 'stateUpdate60Ms', 'screenshotCaptureMs',
];
const report = {
  schema: 2,
  profile,
  generatedAt: new Date().toISOString(),
  buildFingerprint,
  runtime: {
    node: process.version, chromium, platform: process.platform, arch: process.arch,
    viewport, deviceScaleFactor: 1, cpuThrottleRate: 4, reducedMotion: true,
  },
  fixture: {
    id: fixture.fixture, variants: fixture.variants,
    rooms: fixture.roomCount, devices: fixture.deviceCount,
  },
  samples,
  warmups,
  summary: summarizeTimings(rows, metricNames),
  longTasks: summarizeLongTasks(rows),
  rows,
};
const text = `${JSON.stringify(report, null, 2)}\n`;
if (output) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, text, 'utf8');
  console.log(output);
} else process.stdout.write(text);
