// #1234: native warm remount camera, controls and hit-testing.
// Requires a fresh demo bundle and compiled tsconfig.test.json.
import { launch, checkAll, finish } from './serve.mjs';
import assert from 'node:assert/strict';
import { createFixtureStore } from './srv/fixture-state.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';

const config = partition => commitWallSegmentModel({ spaces: [{
  id: 'topology', title: 'Topology', view_box: [0, 0, 1, 1], rooms: [],
  partitions: [partition], zero_wall_style: 'dashed',
}], markers: [], settings: { filter_seeded: true, known_devices: [], new_device_ids: [] } }).config;
const before = config({ id: 'old', a: [.1, .1], b: [.9, .9], cm: 25 });
const after = config({ id: 'zero', a: [.2, .2], b: [.8, .2], cm: 0 });
const out = {};
async function scenario(name, sameSnapshot, fastRead) {
  const store = createFixtureStore(before, {}, () => {});
  let slowRead = false;
  const { page, browser } = await launch({ width: 1180, height: 920 });
  const ready = () => {
    const c = window.__card, s = c?._stageEl, v = c?._view;
    const painted = c?.renderRoot.querySelector('svg.plan-svg')?.viewBox.baseVal;
    if (!s?.clientWidth || !v || !painted || c._modeTransitionBusy || c._warmModeRequest || c._refitRaf) return false;
    const scale = s.clientWidth / v.w;
    return Math.abs(v.h - v.w * s.clientHeight / s.clientWidth) * scale < .5
      && ['x', 'y', 'w', 'h'].every((key, i) => Math.abs(v[key]
        - [painted.x, painted.y, painted.width, painted.height][i]) * scale < .01);
  };
  try {
    await page.exposeFunction('warmCameraWire', async message => {
      const reply = store.handle(message);
      if (message.type === 'houseplan/config/get') {
        if (slowRead) await new Promise(resolve => setTimeout(resolve, 900));
        return { ...reply, wall_node_move_api: 1 };
      }
      return reply ?? null;
    });
    const mount = async () => {
      await page.evaluate(() => {
        const old = window.__card, hass = window.__mkHass(), base = hass.callWS.bind(hass);
        hass.devices = {}; hass.entities = {}; hass.states = {};
        hass.callWS = async message => message.type.endsWith('registry/list') ? []
          : await window.warmCameraWire(message) ?? base(message);
        const card = document.createElement('houseplan-card');
        card.setConfig({ type: 'custom:houseplan-card', language: 'en' });
        old.remove(); document.getElementById('host').appendChild(card);
        window.__card = card; card.hass = hass;
      });
      await page.waitForFunction(revision => {
        const c = window.__card;
        return c?._loadOk && !c._booting && c._cfgRev === revision && c._space === 'topology';
      }, store.configRev);
      await page.evaluate(async () => {
        await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('select');
      });
      await page.waitForFunction(() => !window.__card._modeTransitionBusy);
      await page.waitForFunction(ready, undefined, { timeout: 2000 });
    };
    await mount();
    let savedCamera = null;
    if (sameSnapshot) {
      const initialZoom = await page.evaluate(() => window.__card._zoom);
      await page.locator('houseplan-card .stage').hover();
      await page.mouse.wheel(0, -160);
      await page.waitForFunction(zoom => window.__card._zoom > zoom, initialZoom);
      await page.waitForFunction(() => !window.__card._cameraTransition.active);
      await page.waitForFunction(ready);
      savedCamera = await page.evaluate(() => ({ view: { ...window.__card._view }, zoom: window.__card._zoom }));
    }
    store.pushConfig(sameSnapshot ? before : after); slowRead = !fastRead;
    await mount(); // Observe real readiness; never force a refit from the fixture.
    out[`${name}:camera-ready`] = true;
    if (sameSnapshot) out[`${name}:user-camera-preserved`] = await page.evaluate(saved => {
      const c = window.__card;
      return Math.abs(c._zoom - saved.zoom) < 1e-9
        && ['x', 'y', 'w', 'h'].every(key => Math.abs(c._view[key] - saved.view[key]) < 1e-6);
    }, savedCamera);
    out[`${name}:final-stage-is-camera-baseline`] = await page.evaluate(() => {
      const c = window.__card, s = c._stageEl;
      return c._lastValidStageSize?.[0] === s.clientWidth && c._lastValidStageSize?.[1] === s.clientHeight;
    });
    const saved = JSON.stringify(store.handle({ type: 'houseplan/config/get' }));
    // The changed snapshot has an exposed zero-wall node. The zoomed unchanged
    // control intentionally crops its diagonal endpoints, so tests preservation.
    if (!sameSnapshot) {
      const handle = page.locator('houseplan-card .hp-node-handle').first();
      await handle.hover();
      await page.mouse.down();
      assert.equal(await page.evaluate(() => window.__card._editorRuntime.nodeMove.dragging), true,
        `${name}: one native press captures the painted node`);
      await page.keyboard.press('Escape'); await page.mouse.up();
      out[`${name}:native-node-capture-cancel`] = await page.evaluate(() => !window.__card._editorRuntime.nodeMove.dragging);
    }
    out[`${name}:no-server-mutation`] = JSON.stringify(store.handle({ type: 'houseplan/config/get' })) === saved;
  } catch (error) {
    console.log(JSON.stringify(await page.evaluate(() => {
      const c = window.__card, s = c._stageEl;
      return { model: c._serverCfg.model_version, revision: c._cfgRev, mode: c._mode,
        stage: [s.clientWidth, s.clientHeight], lastSize: c._lastValidStageSize,
        view: c._view, pendingRefit: c._pendingRefitSize, refitRaf: c._refitRaf,
        modeBusy: c._modeTransitionBusy, warmModeRequest: c._warmModeRequest };
    })));
    throw error;
  } finally { await browser.close(); }

}
for (const [name, sameSnapshot, fastRead] of [['late-change', false, false], ['late-same', true, false], ['fast-change', false, true]]) {
  await scenario(name, sameSnapshot, fastRead);
}
checkAll(out); await finish(null, out);
