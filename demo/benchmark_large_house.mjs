#!/usr/bin/env node
/** Reproducible browser benchmark and report producer for HP-PERF-01. */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { launch } from './serve.mjs';
import { LARGE_HOUSE_COUNTS, makeLargeHouseFixture } from './fixtures/large-house.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';
import { ensureHarnessEditorRuntime } from './editor-runtime-compat.mjs';
import { summarizeLongTasks, summarizeTimings } from './performance/evaluate.mjs';
import { assertCardContract, LARGE_HOUSE_CARD_CONTRACT } from './performance/card-contract.mjs';

const valueArg = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const samples = Math.max(1, Math.min(20, Number(valueArg('samples')) || 7));
const warmups = Math.max(0, Math.min(5, Number(valueArg('warmups')) || 1));
const output = valueArg('output') ? resolve(valueArg('output')) : null;
const targetRoot = resolve(valueArg('target-root') ?? '.');
const profile = valueArg('profile') ?? 'large-house-v1';
if (!['large-house-v1', 'large-house-isometric-v1', 'large-house-plan-snap-v1', 'large-house-interaction-v1'].includes(profile))
  throw new Error(`unknown large-house profile: ${profile}`);
const isometric = profile === 'large-house-isometric-v1';
const planSnap = profile === 'large-house-plan-snap-v1';
const interaction = profile === 'large-house-interaction-v1';
const requiresIsometric = isometric && existsSync(resolve(targetRoot, 'src/iso-projection.ts'));
const requiresPlanSnap = planSnap && existsSync(resolve(targetRoot, 'src/plan-snap-overlay.ts'));
const requiresWallFace = planSnap && existsSync(resolve(targetRoot, 'src/wall-face-graph.ts'));
const requiresInteraction = interaction && existsSync(resolve(targetRoot, 'src/live-viewport.ts'));
const fixture = makeLargeHouseFixture();
if (planSnap) {
  for (const [floor, space] of fixture.config.spaces.entries()) {
    space.room_drafts = [0, 1].map((draft) => {
      const y = 0.985 + draft * 0.025;
      return {
        id: `perf-draft-${floor}-${draft}`,
        points: [[0.10, y], [0.38, y], [0.46, y + 0.035]],
        segments: [{ cm: 15 }, { cm: 20 }],
      };
    });
  }
  fixture.counts = { ...fixture.counts, drafts: 6, pointerMoves: 120 };
}
const viewport = { width: 1440, height: 1000 };

const { page, browser } = await launch(
  viewport,
  1,
  ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
  {},
  resolve(targetRoot, 'demo/srv'),
  targetRoot,
);
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.addStyleTag({
  content: '*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}',
});
await page.addScriptTag({
  content: `window.__hpAssertCardContract = ${assertCardContract.toString()};`,
});
await page.addScriptTag({
  content: `window.__hpEnsureHarnessEditorRuntime = ${ensureHarnessEditorRuntime.toString()};`,
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
    const row = await page.evaluate(async ({
      fixture, sample, cardContract, isometric, requiresIsometric, planSnap, requiresPlanSnap,
      requiresWallFace, interaction, requiresInteraction,
    }) => {
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
        isoGeometry: card._isoGeometryCache?.size ?? 0,
        planSnapGeometry: card._planSnapGeometryCache ? 1 : 0,
        wallFaceGraph: card._wallFaceGraphCache?.length ?? 0,
      });

      window.__card?.remove?.();
      localStorage.clear();
      if (isometric) {
        localStorage.setItem('houseplan_card_alpha_v1', '1');
        localStorage.setItem('houseplan_card_view_v1', JSON.stringify(Object.fromEntries(
          fixture.config.spaces.map((space) => [space.id, 'iso']),
        )));
        history.replaceState(null, '', '?hp_alpha=1');
      } else history.replaceState(null, '', location.pathname);
      const host = document.getElementById('host');
      const card = document.createElement('houseplan-card');
      card.setConfig({
        type: 'custom:houseplan-card', title: `Performance baseline ${sample}`, icon_size: 3.4,
      });
      let wsCalls = 0;
      const connection = {
        subscribeEvents: async () => () => undefined,
        subscribeMessage: async () => () => undefined,
      };
      const hassBase = {
        language: 'en', locale: { language: 'en' },
        user: { id: 'perf', name: 'Performance fixture', is_admin: true },
        devices: fixture.devices, entities: fixture.entities, areas: fixture.areas,
        floors: {
          one: { floor_id: 'one', name: 'One', level: 0 },
          two: { floor_id: 'two', name: 'Two', level: 1 },
          three: { floor_id: 'three', name: 'Three', level: 2 },
        },
        callWS: async (message) => {
          wsCalls++;
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
      };
      const hassFor = (states) => ({ ...hassBase, states });

      const loadLongTasks = startLongTaskWindow();
      const loadStarted = performance.now();
      host.replaceChildren(card);
      if (requiresIsometric && window.__hpAlpha !== true) {
        if (typeof card._onLabsSnapshot !== 'function')
          throw new Error('large-house-isometric-v1 candidate has no Labs fixture hook');
        // Comparison bundles before #448 do not understand hp_alpha. Preserve
        // the cross-version benchmark only for that base; current candidates
        // must activate through the real URL/storage contract above.
        card._onLabsSnapshot({ alpha: true, active: Object.freeze(['iso']), space: '' });
      }
      card.hass = hassFor(fixture.states);
      // launch() warms its own bootstrap card, but each measured sample creates
      // a fresh card. Current lazy bundles therefore need their own controller
      // construction; monolithic stable bundles remain immediate (#380).
      if (!await window.__hpEnsureHarnessEditorRuntime(card))
        throw new Error('large-house editor runtime did not preload');
      window.__hpAssertCardContract(card, cardContract);
      if (requiresIsometric && (typeof card._setProjection !== 'function'
          || !(card._isoGeometryCache instanceof Map))) {
        throw new Error('large-house-isometric-v1 candidate has no renderer contract');
      }
      await until(() => card._loadOk && card._model?.length === fixture.counts.floors);
      await card.updateComplete;
      await frame();
      const modelReadyMs = Number((performance.now() - loadStarted).toFixed(2));
      await until(() => card._booting === false);
      if (interaction && '_bootSoft' in card) await until(() => card._bootSoft === false);
      await frame();
      const firstStableRenderMs = Number((performance.now() - loadStarted).toFixed(2));
      const loadLongTaskResult = await loadLongTasks.stop();
      let fullRenderCount = 0;
      let diagnosticsScanCount = 0;
      const fullRenderReasons = [];
      if (interaction) {
        const renderBody = card._renderBody.bind(card);
        card._renderBody = (...args) => { fullRenderCount++; return renderBody(...args); };
        const bindingStatus = card._bindingStatus.bind(card);
        card._bindingStatus = (...args) => { diagnosticsScanCount++; return bindingStatus(...args); };
        const willUpdate = card.willUpdate.bind(card);
        card.willUpdate = (changed) => {
          fullRenderReasons.push([...changed.keys()].map(String));
          return willUpdate(changed);
        };
      }
      const viewToggle = isometric ? await duration(async () => {
        if (typeof card._setProjection === 'function') {
          card._setProjection('flat');
          await card.updateComplete;
          card._setProjection('iso');
          await card.updateComplete;
        } else {
          // Comparison SHAs before #89 intentionally ignore the Labs operation.
          card.requestUpdate();
          await card.updateComplete;
        }
      }) : null;
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

      let interactionDiagnostics = null;
      let interactionTimings = null;
      let interactionLongTasks = null;
      const interactionSeries = interaction ? await duration(async () => {
        const deltas = {};
        const timings = {};
        interactionLongTasks = {};
        const diagnosticsBefore = diagnosticsScanCount;
        const reasonsBefore = fullRenderReasons.length;
        const beforeIrrelevant = fullRenderCount;
        const intakeBefore = card._hassSequence;
        const irrelevantStarted = performance.now();
        let currentStates = nextStates;
        for (let index = 0; index < 30; index++) {
          currentStates = {
            ...currentStates,
            'sensor.performance_unrelated': {
              entity_id: 'sensor.performance_unrelated', state: `${sample}:${index}`,
            },
          };
          card.hass = hassFor(currentStates);
        }
        await card.updateComplete;
        await frame();
        timings.irrelevantHaTicksMs = performance.now() - irrelevantStarted;
        deltas.irrelevantFullRenders = fullRenderCount - beforeIrrelevant;
        deltas.irrelevantHassIntakes = card._hassSequence - intakeBefore;

        const relevantBefore = fullRenderCount;
        const relevantStarted = performance.now();
        currentStates = {
          ...currentStates,
          [firstEntity]: {
            ...currentStates[firstEntity],
            state: currentStates[firstEntity].state === 'on' ? 'off' : 'on',
          },
        };
        card.hass = hassFor(currentStates);
        await card.updateComplete;
        await frame();
        timings.relevantHaTickMs = performance.now() - relevantStarted;
        deltas.relevantOutsideGestureFullRenders = fullRenderCount - relevantBefore;

        const stage = card.renderRoot.querySelector('.stage');
        const device = card.renderRoot.querySelector('[data-hp="device"]');
        const room = card.renderRoot.querySelector('[data-hp="room"]');
        const heavy = card.renderRoot.querySelector('.wallbodies');
        if (!stage || !device || !room || !heavy)
          throw new Error('interaction profile has no stage/device/room/heavy scene');
        const rect = stage.getBoundingClientRect();
        const hoverBefore = fullRenderCount;
        const hoverLongTasks = startLongTaskWindow();
        const hoverStarted = performance.now();
        device.dispatchEvent(new PointerEvent('pointerover', {
          clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
          bubbles: true, composed: true, pointerId: 991, pointerType: 'mouse', isPrimary: true,
        }));
        for (let index = 0; index < 40; index++) {
          device.dispatchEvent(new PointerEvent('pointermove', {
            clientX: rect.left + 100 + index, clientY: rect.top + 100 + index / 2,
            bubbles: true, composed: true, pointerId: 991, pointerType: 'mouse', isPrimary: true,
          }));
          if ((index + 1) % 20 === 0) {
            await card.updateComplete;
            await frame();
          }
        }
        const liveTip = card.renderRoot.querySelector('[data-hp-live-tip]');
        deltas.tooltipVisible = !!liveTip && !liveTip.hidden && !!liveTip.textContent?.trim();
        device.dispatchEvent(new PointerEvent('pointerleave', {
          bubbles: false, composed: true, pointerId: 991, pointerType: 'mouse', isPrimary: true,
        }));
        room.dispatchEvent(new PointerEvent('pointerenter', {
          clientX: rect.left + 300, clientY: rect.top + 300,
          bubbles: false, composed: true, pointerId: 991, pointerType: 'mouse', isPrimary: true,
        }));
        for (let index = 0; index < 40; index++) {
          room.dispatchEvent(new PointerEvent('pointermove', {
            clientX: rect.left + 300 + index, clientY: rect.top + 300 + index / 2,
            bubbles: true, composed: true, pointerId: 991, pointerType: 'mouse', isPrimary: true,
          }));
          if ((index + 1) % 20 === 0) { await card.updateComplete; await frame(); }
        }
        room.dispatchEvent(new PointerEvent('pointerleave', {
          bubbles: false, composed: true, pointerId: 991, pointerType: 'mouse', isPrimary: true,
        }));
        for (let index = 0; index < 40; index++) {
          stage.dispatchEvent(new PointerEvent('pointermove', {
            clientX: rect.left + 20 + index, clientY: rect.top + 20,
            bubbles: true, composed: true, pointerId: 991, pointerType: 'mouse', isPrimary: true,
          }));
          if ((index + 1) % 20 === 0) { await card.updateComplete; await frame(); }
        }
        await card.updateComplete;
        timings.hoverSeriesMs = performance.now() - hoverStarted;
        deltas.hoverFullRenders = fullRenderCount - hoverBefore;
        deltas.hoverTargets = ['device', 'room', 'miss'];
        interactionLongTasks.hoverSeries = await hoverLongTasks.stop();

        const cameraSvg = card.renderRoot.querySelector('[data-hp-live-viewbox="camera"], [data-hp-live-viewbox="floor"], .zoomwrap > svg');
        const initialViewBox = cameraSvg?.getAttribute('viewBox') || '';
        const panLongTasks = startLongTaskWindow();
        const panStarted = performance.now();
        const panMoveRenders = [];
        const panTerminalRenders = [];
        let relevantDuringGestureFullRenders = 0;
        let relevantDuringGestureIntakes = 0;
        for (let dragIndex = 0; dragIndex < 4; dragIndex++) {
          const pointerId = 992 + dragIndex;
          stage.dispatchEvent(new PointerEvent('pointerdown', {
            clientX: rect.left + 200, clientY: rect.top + 200, button: 0, buttons: 1,
            bubbles: true, composed: true, pointerId, pointerType: 'mouse', isPrimary: true,
          }));
          await card.updateComplete;
          const panMoveBefore = fullRenderCount;
          for (let index = 0; index < 20; index++) {
            stage.dispatchEvent(new PointerEvent('pointermove', {
              clientX: rect.left + 205 + index * 3, clientY: rect.top + 202 + index,
              button: 0, buttons: 1, bubbles: true, composed: true,
              pointerId, pointerType: 'mouse', isPrimary: true,
            }));
            if (dragIndex === 0 && index === 10) {
              const deferredBefore = fullRenderCount;
              const deferredIntakeBefore = card._hassSequence;
              for (let tick = 0; tick < 3; tick++) {
                currentStates = {
                  ...currentStates,
                  [firstEntity]: { ...currentStates[firstEntity], state: `gesture-${tick}` },
                };
                card.hass = hassFor(currentStates);
              }
              await card.updateComplete;
              relevantDuringGestureFullRenders += fullRenderCount - deferredBefore;
              relevantDuringGestureIntakes += card._hassSequence - deferredIntakeBefore;
            }
            if ((index + 1) % 10 === 0) {
              await card.updateComplete;
              await frame();
            }
          }
          const beforeTerminal = fullRenderCount;
          panMoveRenders.push(beforeTerminal - panMoveBefore);
          stage.dispatchEvent(new PointerEvent('pointerup', {
            clientX: rect.left + 265, clientY: rect.top + 222, button: 0, buttons: 0,
            bubbles: true, composed: true, pointerId, pointerType: 'mouse', isPrimary: true,
          }));
          await card.updateComplete;
          await frame();
          panTerminalRenders.push(fullRenderCount - beforeTerminal);
        }
        timings.panSeriesMs = performance.now() - panStarted;
        interactionLongTasks.panSeries = await panLongTasks.stop();
        const movedViewBox = cameraSvg?.getAttribute('viewBox') || '';
        const currentView = card._viewOr(card._baseVb());
        const currentDevice = card._devices.find((item) => item.id === device.dataset.id);
        const position = currentDevice ? card._pos(currentDevice) : null;
        const scene = position ? card._scenePoint([position.x, position.y]) : null;
        const deviceRect = device.getBoundingClientRect();
        const expectedX = scene ? rect.left + ((scene[0] - currentView.x) / currentView.w) * rect.width : 0;
        const expectedY = scene ? rect.top + ((scene[1] - currentView.y) / currentView.h) * rect.height : 0;
        const overlayErrorPx = scene ? Math.hypot(
          deviceRect.left + deviceRect.width / 2 - expectedX,
          deviceRect.top + deviceRect.height / 2 - expectedY,
        ) : Infinity;

        const cameraLongTasks = startLongTaskWindow();
        const cameraStarted = performance.now();
        const cameraBefore = fullRenderCount;
        const pinchPointerA = 1001, pinchPointerB = 1002;
        stage.dispatchEvent(new PointerEvent('pointerdown', {
          clientX: rect.left + 360, clientY: rect.top + 300, button: 0, buttons: 1,
          bubbles: true, composed: true, pointerId: pinchPointerA,
          pointerType: 'touch', isPrimary: true,
        }));
        stage.dispatchEvent(new PointerEvent('pointerdown', {
          clientX: rect.left + 460, clientY: rect.top + 300, button: 0, buttons: 1,
          bubbles: true, composed: true, pointerId: pinchPointerB,
          pointerType: 'touch', isPrimary: false,
        }));
        await card.updateComplete;
        const pinchMoveBefore = fullRenderCount;
        for (let index = 0; index < 20; index++) {
          stage.dispatchEvent(new PointerEvent('pointermove', {
            clientX: rect.left + 360 - index, clientY: rect.top + 300,
            button: 0, buttons: 1, bubbles: true, composed: true,
            pointerId: pinchPointerA, pointerType: 'touch', isPrimary: true,
          }));
          stage.dispatchEvent(new PointerEvent('pointermove', {
            clientX: rect.left + 460 + index, clientY: rect.top + 300,
            button: 0, buttons: 1, bubbles: true, composed: true,
            pointerId: pinchPointerB, pointerType: 'touch', isPrimary: false,
          }));
          if ((index + 1) % 5 === 0) await frame();
        }
        const pinchTerminalBefore = fullRenderCount;
        for (const pointerId of [pinchPointerA, pinchPointerB]) {
          stage.dispatchEvent(new PointerEvent('pointerup', {
            clientX: rect.left + 410, clientY: rect.top + 300,
            button: 0, buttons: 0, bubbles: true, composed: true,
            pointerId, pointerType: 'touch', isPrimary: pointerId === pinchPointerA,
          }));
        }
        await card.updateComplete;
        await frame();
        const pinchTerminalRenders = fullRenderCount - pinchTerminalBefore;
        for (let index = 0; index < 4; index++) {
          stage.dispatchEvent(new WheelEvent('wheel', {
            deltaY: index % 2 ? 120 : -120,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            bubbles: true, cancelable: true,
          }));
        }
        await until(() => !card._cameraTransition.active);
        await card.updateComplete;
        await frame();
        timings.cameraSeriesMs = performance.now() - cameraStarted;
        interactionLongTasks.cameraSeries = await cameraLongTasks.stop();
        deltas.cameraMoveFullRenders = pinchTerminalBefore - pinchMoveBefore;
        deltas.cameraTerminalFullRenders = pinchTerminalRenders;
        deltas.cameraFullRenders = fullRenderCount - cameraBefore;

        const editorLongTasks = startLongTaskWindow();
        const editorConfigBefore = JSON.stringify(card._serverCfg);
        const editorCallsBefore = wsCalls;
        const editorPaintBefore = card._liveEditorPaintCount || 0;
        let editorElapsed = 0;
        const editorMoveRenders = [];
        const editorTerminalRenders = [];

        card._setMode('plan', false);
        card._tool = 'draw';
        card._path = [[100, 100]];
        card.requestUpdate();
        await card.updateComplete;
        await until(() => !card._modeTransitionBusy && card._continuity.state === 'steady');
        for (let index = 0; index < 5; index++) await frame();
        let editorStage = card.renderRoot.querySelector('.stage');
        let editorRect = editorStage.getBoundingClientRect();
        let editorView = card._viewOr(card._baseVb());
        const fromScene = (x, y) => ({
          clientX: editorRect.left + ((x - editorView.x) / editorView.w) * editorRect.width,
          clientY: editorRect.top + ((y - editorView.y) / editorView.h) * editorRect.height,
        });
        let partStarted = performance.now();
        let editorMoveBefore = fullRenderCount;
        for (let index = 0; index < 40; index++) {
          editorStage.dispatchEvent(new PointerEvent('pointermove', {
            ...fromScene(110 + index * 2, 110 + index),
            bubbles: true, composed: true, pointerId: 1101,
            pointerType: 'mouse', isPrimary: true,
          }));
          if ((index + 1) % 10 === 0) await frame();
        }
        let editorTerminalBefore = fullRenderCount;
        editorMoveRenders.push(editorTerminalBefore - editorMoveBefore);
        card._cursorPt = null;
        card._path = [];
        card.requestUpdate();
        await card.updateComplete;
        await frame();
        editorTerminalRenders.push(fullRenderCount - editorTerminalBefore);
        editorElapsed += performance.now() - partStarted;

        card._tool = 'resize';
        card.requestUpdate();
        await card.updateComplete;
        const resizeRoom = card._rszRooms()[0];
        const resizeEvent = {
          pointerId: 1102, stopPropagation: () => undefined,
          preventDefault: () => undefined, target: null,
        };
        card._rszEdgeDown(resizeEvent, resizeRoom.id, 1);
        const resizePlan = card._resize?.plan || card._rszDrag?.plan;
        if (!resizePlan) throw new Error('interaction resize plan was not created');
        editorStage = card.renderRoot.querySelector('.stage');
        editorRect = editorStage.getBoundingClientRect();
        editorView = card._viewOr(card._baseVb());
        partStarted = performance.now();
        editorMoveBefore = fullRenderCount;
        for (let index = 0; index < 40; index++) {
          const target = [
            resizePlan.a[0] + resizePlan.n[0] * card._gridPitch * (1 + index / 40),
            resizePlan.a[1] + resizePlan.n[1] * card._gridPitch * (1 + index / 40),
          ];
          card._rszMove({
            ...resizeEvent,
            clientX: editorRect.left + ((target[0] - editorView.x) / editorView.w) * editorRect.width,
            clientY: editorRect.top + ((target[1] - editorView.y) / editorView.h) * editorRect.height,
          });
          if ((index + 1) % 10 === 0) await frame();
        }
        editorTerminalBefore = fullRenderCount;
        editorMoveRenders.push(editorTerminalBefore - editorMoveBefore);
        card._rszCancelDrag();
        await card.updateComplete;
        await frame();
        editorTerminalRenders.push(fullRenderCount - editorTerminalBefore);
        editorElapsed += performance.now() - partStarted;

        card._setMode('decor', false);
        card._decorTool = 'select';
        const decorShape = card._decorList.find((shape) =>
          shape.kind === 'furniture' || shape.kind === 'rect' || shape.kind === 'ellipse');
        if (!decorShape) throw new Error('interaction profile has no transformable decor');
        card._decorSel = decorShape.id;
        card.requestUpdate();
        await card.updateComplete;
        await until(() => !card._modeTransitionBusy && card._continuity.state === 'steady');
        for (let index = 0; index < 5; index++) await frame();
        card._dtMeasure();
        await card.updateComplete;
        editorStage = card.renderRoot.querySelector('.stage');
        editorRect = editorStage.getBoundingClientRect();
        editorView = card._viewOr(card._baseVb());
        const box = card._decorBoxOf(decorShape);
        const cornerX = box.x + box.w, cornerY = box.y + box.h;
        const decorPointer = (x, y) => ({
          pointerId: 1103, pointerType: 'mouse', shiftKey: false,
          clientX: editorRect.left + ((x - editorView.x) / editorView.w) * editorRect.width,
          clientY: editorRect.top + ((y - editorView.y) / editorView.h) * editorRect.height,
          stopPropagation: () => undefined, preventDefault: () => undefined,
          currentTarget: null, target: null,
        });
        card._dtStart(decorPointer(cornerX, cornerY), 'scale', [1, 1]);
        await card.updateComplete;
        await frame();
        partStarted = performance.now();
        editorMoveBefore = fullRenderCount;
        for (let index = 0; index < 40; index++) {
          card._dtMove(decorPointer(cornerX + index, cornerY + index / 2));
          if ((index + 1) % 10 === 0) await frame();
        }
        editorTerminalBefore = fullRenderCount;
        editorMoveRenders.push(editorTerminalBefore - editorMoveBefore);
        card._cancelDecorGesture();
        await card.updateComplete;
        await frame();
        editorTerminalRenders.push(fullRenderCount - editorTerminalBefore);
        editorElapsed += performance.now() - partStarted;
        timings.editorSeriesMs = editorElapsed;
        interactionLongTasks.editorSeries = await editorLongTasks.stop();
        deltas.editorMoveFullRenders = editorMoveRenders;
        deltas.editorTerminalFullRenders = editorTerminalRenders;
        deltas.editorLivePaints = (card._liveEditorPaintCount || 0) - editorPaintBefore;
        deltas.editorConfigStable = JSON.stringify(card._serverCfg) === editorConfigBefore;
        deltas.editorWsWrites = wsCalls - editorCallsBefore;

        card._setMode('view', false);
        await card.updateComplete;
        await frame();
        deltas.panMoveFullRenders = panMoveRenders;
        deltas.terminalFullRenders = panTerminalRenders;
        deltas.relevantDuringGestureFullRenders = relevantDuringGestureFullRenders;
        deltas.relevantDuringGestureIntakes = relevantDuringGestureIntakes;
        deltas.viewBoxMoved = !!initialViewBox && initialViewBox !== movedViewBox;
        deltas.overlayErrorPx = Number(overlayErrorPx.toFixed(2));
        deltas.heavyNodeStable = card.renderRoot.querySelector('.wallbodies') === heavy;
        deltas.diagnosticsScans = diagnosticsScanCount - diagnosticsBefore;
        deltas.fullRenderReasons = fullRenderReasons.slice(reasonsBefore);
        interactionTimings = timings;
        interactionDiagnostics = { supported: requiresInteraction, ...deltas };
        if (requiresInteraction && (
          deltas.irrelevantFullRenders !== 0 || deltas.irrelevantHassIntakes !== 30
          || deltas.relevantOutsideGestureFullRenders !== 1 || deltas.hoverFullRenders !== 0
          || deltas.hoverTargets.join(',') !== 'device,room,miss'
          || deltas.panMoveFullRenders.some((count) => count !== 0)
          || deltas.terminalFullRenders.some((count) => count !== 1)
          || deltas.relevantDuringGestureFullRenders !== 0 || !deltas.tooltipVisible
          || deltas.relevantDuringGestureIntakes !== 3
          || deltas.cameraMoveFullRenders !== 0 || deltas.cameraTerminalFullRenders !== 1
          || deltas.editorMoveFullRenders.some((count) => count !== 0)
          || deltas.editorTerminalFullRenders.some((count) => count > 1)
          || deltas.editorLivePaints < 3 || !deltas.editorConfigStable || deltas.editorWsWrites !== 0
          || !deltas.viewBoxMoved || deltas.overlayErrorPx > 1 || !deltas.heavyNodeStable
          || deltas.diagnosticsScans !== 0
        )) throw new Error(`interaction structural contract failed: ${JSON.stringify(interactionDiagnostics)}`);
      }) : null;

      let planSnapDiagnostics = null;
      const planSnapPointer = planSnap ? await duration(async () => {
        card._setMode('plan');
        card._tool = 'draw';
        card._path = [];
        card.requestUpdate();
        await card.updateComplete;
        await frame();
        const stage = card.renderRoot.querySelector('.stage');
        const overlay = card.renderRoot.querySelector('[data-hp="plan-snap-overlay"]');
        if (requiresPlanSnap && !overlay) throw new Error('plan-snap candidate has no overlay');
        const staticLines = overlay?.querySelectorAll('.plan-snap-line').length ?? 0;
        const staticNodes = overlay?.querySelectorAll('.plan-snap-node[data-kind="endpoint"]').length ?? 0;
        const cacheValue = card._planSnapGeometryCache?.value ?? null;
        const configBefore = JSON.stringify(card._serverCfg);
        const callsBefore = wsCalls;
        const wallFaceCacheBeforePointer = card._wallFaceGraphCache?.length ?? 0;
        const view = card._viewOr(card._baseVb());
        const rect = stage.getBoundingClientRect();
        const fromPlan = (x, y) => ({
          clientX: rect.left + ((x - view.x) / view.w) * rect.width,
          clientY: rect.top + ((y - view.y) / view.h) * rect.height,
        });
        const firstEndpoint = overlay?.querySelector('.plan-snap-node[data-kind="endpoint"]');
        const longLine = [...(overlay?.querySelectorAll('.plan-snap-line') || [])]
          .map((line) => ({
            line,
            a: [+line.getAttribute('x1'), +line.getAttribute('y1')],
            b: [+line.getAttribute('x2'), +line.getAttribute('y2')],
          }))
          .sort((a, b) => Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1])
            - Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]))[0];
        const points = [
          firstEndpoint
            ? [+firstEndpoint.getAttribute('cx'), +firstEndpoint.getAttribute('cy')]
            : [40, 40],
          longLine
            ? [(longLine.a[0] + longLine.b[0]) / 2, (longLine.a[1] + longLine.b[1]) / 2]
            : [120, 40],
          [10, 10],
        ];
        const seenKinds = new Set();
        for (let index = 0; index < 120; index++) {
          const point = points[index % points.length];
          stage.dispatchEvent(new PointerEvent('pointermove', {
            ...fromPlan(point[0], point[1]),
            bubbles: true, composed: true, pointerId: 880, pointerType: 'mouse',
          }));
          await card.updateComplete;
          const active = card.renderRoot.querySelector(
            '[data-hp="plan-snap-overlay"] .plan-snap-node[data-active="true"]',
          );
          if (active) seenKinds.add(active.getAttribute('data-kind'));
          if (requiresPlanSnap && card.renderRoot.querySelectorAll(
            '[data-hp="plan-snap-overlay"] .plan-snap-node[data-active="true"]',
          ).length > 1) throw new Error('plan-snap rendered more than one active candidate');
        }
        const finalOverlay = card.renderRoot.querySelector('[data-hp="plan-snap-overlay"]');
        planSnapDiagnostics = {
          supported: requiresPlanSnap,
          staticLines,
          staticNodes,
          activeKinds: [...seenKinds].sort(),
          cacheStable: cacheValue != null && card._planSnapGeometryCache?.value === cacheValue,
          domStable: (finalOverlay?.querySelectorAll('.plan-snap-line').length ?? 0) === staticLines
            && (finalOverlay?.querySelectorAll('.plan-snap-node[data-kind="endpoint"]').length ?? 0)
              === staticNodes,
          configStable: JSON.stringify(card._serverCfg) === configBefore,
          wsWrites: wsCalls - callsBefore,
          wallFaceCacheStableOnPointer:
            (card._wallFaceGraphCache?.length ?? 0) === wallFaceCacheBeforePointer,
        };
        if (requiresPlanSnap && (
          staticLines < fixture.counts.rooms || staticNodes < fixture.counts.rooms
          || !planSnapDiagnostics.cacheStable || !planSnapDiagnostics.domStable
          || !planSnapDiagnostics.configStable || planSnapDiagnostics.wsWrites !== 0
          || !planSnapDiagnostics.wallFaceCacheStableOnPointer
          || !seenKinds.has('endpoint') || !seenKinds.has('line')
        )) throw new Error(`plan-snap structural contract failed: ${JSON.stringify(planSnapDiagnostics)}`);
        if (requiresWallFace) {
          const oldPath = card._path;
          const oldDraftId = card._activeDraftId;
          const oldCms = card._draftSegmentCms;
          const beforePath = [[10, 10]];
          card._path = [[10, 10], [20, 10]];
          card._activeDraftId = 'perf-face-draft';
          card._draftSegmentCms = [15];
          const acceptedStarted = performance.now();
          card._offerWallFaces(beforePath);
          planSnapDiagnostics.wallFaceAcceptedClickMs = performance.now() - acceptedStarted;
          planSnapDiagnostics.wallFaceCacheEntries = card._wallFaceGraphCache?.length ?? 0;
          card._wallFaceBatch = null;
          card._roomDialog = false;
          card._path = oldPath;
          card._activeDraftId = oldDraftId;
          card._draftSegmentCms = oldCms;
          if (planSnapDiagnostics.wallFaceAcceptedClickMs > 1000
              || planSnapDiagnostics.wallFaceCacheEntries < 1
              || planSnapDiagnostics.wallFaceCacheEntries > 4) {
            throw new Error(`wall-face accepted-click contract failed: ${JSON.stringify(planSnapDiagnostics)}`);
          }
        }
        card._setMode('view');
        await card.updateComplete;
      }) : null;

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
        // #380: the previous stable owns the active session directly; current
        // candidates own it through ResizeController. The explicit contract
        // above requires one of these shapes before measurements begin.
        const plan = card._resize?.plan || card._rszDrag?.plan;
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
        ...(viewToggle ? { viewToggleMs: viewToggle.ms } : {}),
        ...(planSnapPointer ? {
          planSnapPointerMs: planSnapPointer.ms,
          planSnapDiagnostics,
        } : {}),
        ...(interactionSeries ? {
          interactionSeriesMs: interactionSeries.ms,
          ...interactionTimings,
          interactionDiagnostics,
        } : {}),
        spaceSwitchMs: spaceSwitch.ms,
        stateUpdateMs: stateUpdate.ms,
        resizePreviewMs: resizePreview.ms,
        panZoomMs: panZoom.ms,
        settingsDialogMs: settingsDialog.ms,
        switchCycleMs: switchCycle.ms,
        longTasks: {
          load: loadLongTaskResult,
          ...(viewToggle ? { viewToggle: viewToggle.longTasks } : {}),
          ...(planSnapPointer ? { planSnapPointer: planSnapPointer.longTasks } : {}),
          ...(interactionSeries ? interactionLongTasks || {} : {}),
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
    }, {
      fixture, sample: measuredSample, cardContract: LARGE_HOUSE_CARD_CONTRACT,
      isometric, requiresIsometric, planSnap, requiresPlanSnap, requiresWallFace,
      interaction, requiresInteraction,
    });
    if (measuredSample >= 0) rows.push(row);
  }
} finally {
  await browser.close();
}

const metricNames = [
  'modelReadyMs', 'firstStableRenderMs', 'spaceSwitchMs', 'stateUpdateMs',
  'resizePreviewMs', 'panZoomMs', 'settingsDialogMs', 'switchCycleMs',
];
if (isometric) metricNames.splice(2, 0, 'viewToggleMs');
if (planSnap) metricNames.splice(2, 0, 'planSnapPointerMs');
if (interaction) metricNames.splice(2, 0,
  'interactionSeriesMs', 'hoverSeriesMs', 'panSeriesMs', 'cameraSeriesMs',
  'editorSeriesMs', 'irrelevantHaTicksMs', 'relevantHaTickMs');
const report = {
  schema: 2,
  profile,
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
  note: `Compare with a base-SHA report captured by the same runner and evaluate the ${profile} budget.`,
};

const text = `${JSON.stringify(report, null, 2)}\n`;
if (output) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, text, 'utf8');
  console.log(output);
} else {
  process.stdout.write(text);
}
