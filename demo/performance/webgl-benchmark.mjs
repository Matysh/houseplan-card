import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { launchColdView, reportPageErrors } from '../serve.mjs';
import { assertFreshDemoBundle } from '../bundle-freshness.mjs';
import { makeLargeHouseFixture } from '../fixtures/large-house.mjs';
import { makeIsometricStage3DenseFixture } from './isometric-stage3-dense-fixture.mjs';
import { readWebglCandidate } from './card-contract.mjs';
import { testSurfaceReady } from '../helpers/test-surface-ready.mjs';
import { summarizeTimings } from './evaluate.mjs';

export async function runWebglBenchmark({ profile, samples, warmups, iterations, output, targetRoot }) {
  const fixture = profile === 'isometric-stage3-dense-v1' ? makeIsometricStage3DenseFixture() : makeLargeHouseFixture();
  for (const space of fixture.config.spaces) space.decor.push(
    { id: 'perf-3d-sofa-' + space.id, kind: 'furniture', symbol: 'sofa', x: .3, y: .3, w: .08, h: .04, angle: 0 },
    { id: 'perf-3d-fridge-' + space.id, kind: 'furniture', symbol: 'fridge', x: .5, y: .5, w: .04, h: .04, angle: 0 });
  fixture.counts = { ...fixture.counts, webglFurniture: fixture.config.spaces.length * 2 };
  fixture.config.settings = { ...fixture.config.settings, volumetric_view: true };
  if (profile.endsWith('backdrop-v1')) for (const space of fixture.config.spaces) {
    space.plan_url = `/assets/f1.svg?${space.id}`; space.plan_aspect = 1;
  }
  const viewport = { width: 1440, height: 1000 };
  const { page, browser } = await launchColdView(viewport, 1,
    ['--enable-precise-memory-info', '--js-flags=--expose-gc'], {}, resolve(targetRoot, 'demo/srv'), targetRoot);
  const rows = [];
  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addScriptTag({ content: `window.__hpReadWebgl=${readWebglCandidate.toString()}; window.__hpSurfaceReady=${testSurfaceReady.toString()};` });
    const fingerprint = await assertFreshDemoBundle(page, targetRoot);
    for (const sample of iterations) {
      const row = await page.evaluate(async ({ fixture, sample, profile }) => {
        const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
        const until = async (predicate, label, timeout = 30000) => {
          const start = performance.now();
          while (!predicate()) { if (performance.now() - start > timeout) throw Error(profile + ': timeout: ' + label); await frame(); }
        };
        window.__card?.remove();
        localStorage.clear();
        localStorage.setItem('houseplan_card_view_v1', JSON.stringify(Object.fromEntries(fixture.config.spaces.map(space => [space.id, 'iso']))));
        const card = document.createElement('houseplan-card');
        card.setConfig({ type: 'custom:houseplan-card', title: 'WebGL benchmark', icon_size: 3.4 });
        const hassBase = {
          language: 'en', locale: { language: 'en' }, user: { id: 'perf', name: 'Synthetic benchmark', is_admin: true },
          devices: fixture.devices, entities: fixture.entities, areas: fixture.areas,
          config: { unit_system: { length: 'km' } },
          connection: { subscribeEvents: async () => () => {}, subscribeMessage: async () => () => {} },
          localize: () => null, formatEntityState: state => state.state, callService: async () => {},
          callWS: async message => {
            if (message.type === 'houseplan/config/get') return { config: structuredClone(fixture.config), rev: 1, can_write: true };
            if (message.type === 'houseplan/layout/get') return { layout: structuredClone(fixture.layout), rev: 1 };
            if (message.type === 'config/device_registry/list') return Object.values(fixture.devices);
            if (message.type === 'config/entity_registry/list') return Object.values(fixture.entities);
            if (message.type === 'config_entries/get') return [{ entry_id: 'perf_entry', domain: 'houseplan_perf', title: 'Synthetic fixture' }];
            if (message.type === 'manifest/list') return [{ domain: 'houseplan_perf', name: 'Performance' }];
            return { ok: true };
          },
        };
        const started = performance.now();
        document.getElementById('host').replaceChildren(card);
        card.hass = { ...hassBase, states: fixture.states };
        const ready = async () => {
          let geometry;
          await until(() => {
            if (!window.__hpSurfaceReady(card)) return false;
            try { geometry = window.__hpReadWebgl(card, profile); return true; }
            catch { return false; }
          }, 'presented 3D canvas');
          await frame();
          return geometry;
        };
        const initial = await ready();
        const firstStable3dMs = performance.now() - started;
        const switchStarted = performance.now();
        card._pickSpace('perf-floor-2'); await card.updateComplete; await ready();
        const spaceSwitch3dMs = performance.now() - switchStarted;
        if (card._space !== 'perf-floor-2') throw Error('3D floor switch did not adopt target');
        const host = () => card._plan3dHost;
        const renderer = host().viewport.output.renderer;
        const gl = renderer.getContext();
        const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        const originalRender = renderer.render;
        let drawCount = 0, activeQuery = null, queries = [];
        renderer.render = function (...args) {
          const query = activeQuery && timer ? gl.createQuery() : null;
          if (query) gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
          try { return originalRender.apply(this, args); }
          finally { if (query) { gl.endQuery(timer.TIME_ELAPSED_EXT); queries.push(query); } drawCount++; }
        };
        const duration = async (action, label, gpu = false) => {
          const before = drawCount; const start = performance.now(); activeQuery = gpu;
          await action(); await ready(); activeQuery = null;
          if (drawCount <= before) throw Error(profile + ': no WebGL draw for ' + label);
          return performance.now() - start;
        };
        const stage = card.renderRoot.querySelector('.stage');
        const rect = stage.getBoundingClientRect();
        const cropBefore = { ...host().crop };
        const zoom3dMs = await duration(async () => {
          stage.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2, bubbles: true, cancelable: true }));
          await card.updateComplete;
        }, 'zoom', true);
        if (host().crop.w === cropBefore.w) throw Error(profile + ': wheel did not change 3D camera');
        const panBefore = { ...host().crop };
        const pan3dMs = await duration(async () => {
          const x = rect.left + rect.width * .8, y = rect.top + rect.height * .8;
          stage.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 91, button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true }));
          stage.dispatchEvent(new PointerEvent('pointermove', { pointerId: 91, buttons: 1, clientX: x + 40, clientY: y + 30, bubbles: true }));
          stage.dispatchEvent(new PointerEvent('pointerup', { pointerId: 91, button: 0, clientX: x + 40, clientY: y + 30, bubbles: true }));
          await card.updateComplete;
        }, 'pan', true);
        if (host().crop.x === panBefore.x && host().crop.y === panBefore.y) throw Error(profile + ': pointer did not pan 3D camera');
        const deviceIds = new Set(Object.entries(fixture.layout).filter(([, point]) => point.s === card._space).map(([id]) => id));
        const entityId = Object.keys(fixture.states).find(id => id.startsWith('light.') && deviceIds.has(fixture.entities[id]?.device_id));
        if (!entityId) throw Error('No on-floor light in benchmark fixture');
        let fadeObserved = false;
        const state = fixture.states[entityId];
        const stateUpdate3dMs = await duration(async () => {
          card.hass = { ...hassBase, states: { ...fixture.states, [entityId]: { ...state, state: state.state === 'on' ? 'off' : 'on' } } };
          await card.updateComplete;
          await until(() => { fadeObserved ||= host().light.blends.size > 0; return fadeObserved; }, 'light fade starts');
        }, 'light state');
        const fadeStart = performance.now();
        await until(() => host().light.blends.size === 0 && !host().animate, 'light fade completion');
        await ready();
        const lightFade3dMs = performance.now() - fadeStart + stateUpdate3dMs;
        const gpuValues = [];
        let gpuReason = timer ? null : 'EXT_disjoint_timer_query_webgl2 unavailable';
        if (timer) {
          for (const query of queries) {
            const wait = performance.now();
            while (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) && performance.now() - wait < 2000) await frame();
            if (gl.getParameter(timer.GPU_DISJOINT_EXT)) gpuReason = 'GPU disjoint';
            else if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) gpuReason = 'GPU query timeout';
            else gpuValues.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
            gl.deleteQuery(query);
          }
        }
        if (typeof globalThis.gc === 'function') { globalThis.gc(); await frame(); }
        const result = { sample, firstStable3dMs, spaceSwitch3dMs, zoom3dMs, pan3dMs, stateUpdate3dMs, lightFade3dMs,
          heapBytes: performance.memory?.usedJSHeapSize ?? null, preciseGc: typeof globalThis.gc === 'function', fadeObserved,
          gpu: { supported: !!timer && !gpuReason && gpuValues.length > 0, samplesMs: gpuReason ? [] : gpuValues, reason: gpuReason },
          initial, geometry: window.__hpReadWebgl(card, profile) };
        renderer.render = originalRender;
        card.remove(); await frame();
        return result;
      }, { fixture, sample, profile });
      if (sample >= 0) rows.push(row);
    }
    if (await reportPageErrors()) throw Error('Uncaught browser error during WebGL benchmark');
    const report = { schema: 3, profile, rendererProtocol: 'plan3d-webgl-v1', diagnostic: true,
      sourceSha: execFileSync('git', ['-C', targetRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      buildFingerprint: fingerprint, generatedAt: new Date().toISOString(), fixture: fixture.counts, samples, warmups,
      runtime: { node: process.version, chromium: await browser.version(), platform: process.platform, arch: process.arch,
        viewport, deviceScaleFactor: 1, reducedMotion: false, renderer: rows[0].geometry.renderer, rendering: rows[0].geometry.rendering },
      summary: summarizeTimings(rows, ['firstStable3dMs', 'spaceSwitch3dMs', 'zoom3dMs', 'pan3dMs', 'stateUpdate3dMs', 'lightFade3dMs', 'heapBytes']), rows,
      note: 'Объёмный вид: ' + (rows[0].geometry.rendering === 'software' ? 'программный рендер' : rows[0].geometry.rendering) + '; диагностический профиль. Нужен парный прогон в одинаковых условиях; сравнения с ноутбуком владельца нет.' };
    const text = JSON.stringify(report, null, 2) + '\n';
    if (output) { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, text); console.log(output); }
    else console.log(text);
    return report;
  } finally { await browser.close(); }
}
