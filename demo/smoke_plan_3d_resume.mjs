import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { launchColdView, reportPageErrors, requirePinnedBrowser } from './serve.mjs';
import { fixture, mountResumeFixture } from './helpers/plan-3d-resume-fixture.mjs';

requirePinnedBrowser('#1609 frame sequence');
const entry = readFileSync(new URL('./srv/demo.html', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('./srv/assets/houseplan-assets.json', import.meta.url), 'utf8'));
const runtimePath = manifest.files.find(file => /(?:^|\/)plan-3d-runtime-[^/]+\.js$/.test(file.path))?.path;
assert.ok(runtimePath);

const { browser, page } = await launchColdView(
  { width: 1000, height: 760 }, 1, [],
  { reducedMotion: 'reduce' }, undefined, undefined, '/demo.html?panel-cold=1', false,
);
let phase = 'setup';
const deadline = setTimeout(() => {
  console.error('Timed out:', phase);
  void browser.close();
}, 70_000);
try {
  await page.route('**/houseplan?panel-cold=1', route => route.fulfill({ contentType: 'text/html', body: entry }));
  await page.addInitScript(() => {
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      const result = context.call(this, kind, ...args);
      if (kind === 'webgl2' && result) window.__resumeGpu = result;
      return result;
    };
  });
  const open = (path = '/houseplan') => page.goto('http://demo.local' + path + '?panel-cold=1', { waitUntil: 'domcontentloaded' });
  const loadFixture = async (deferGpu = false) => {
    await page.evaluate(async ({ gpuModule, deferGpu }) => {
      await import('/assets/houseplan-panel.js');
      if (deferGpu) window.__ResumeHost = (await import('/assets/' + gpuModule)).Plan3dHost;
    }, { gpuModule: runtimePath, deferGpu });
    await page.evaluate(({ source }) => {
      window.__mountResumeFixture = (new Function('return (' + source + ')'))();
    }, { source: mountResumeFixture.toString() });
  };
  const mount = (deferGpu = false) => page.evaluate(
    ({ data, deferGpu }) => window.__mountResumeFixture({ data, deferGpu, Host: window.__ResumeHost }),
    { data: fixture, deferGpu },
  );
  await open();
  await loadFixture();
  await mount();

  const panel = page.locator('houseplan-panel houseplan-card');
  const stage = panel.locator('.stage');
  const wait = (predicate, arg) => page.waitForFunction(predicate, arg, { timeout: 12000 });
  const complete = () => wait(() => {
    const card = window.__tabResume.card(), stage = card?.renderRoot.querySelector('.stage');
    return !!stage && !stage.inert && !card._booting && !card._bootFading && !card._floorSwitch
      && card._continuity.hasCompleteFrame && card._continuity.state === 'steady'
      && stage.querySelector('canvas[data-hp-plan-3d-ready]') && stage.querySelector('.dev[data-hp-3d-native]');
  });
  await complete();
  phase = 'first WebGL loss';
  await page.evaluate(() => {
    const audit = window.__tabResume;
    const card = audit.card();
    const original = Object.getPrototypeOf(card._plan3dHost.viewport).paint;
    const proto = Object.getPrototypeOf(card._plan3dHost.viewport);
    proto.paint = function () {
      if (audit.block) { audit.attempts = (audit.attempts || 0) + 1; return; }
      return original.call(this);
    };
    audit.originalCanvas = card._plan3dHost.canvas;
    audit.extension = window.__resumeGpu.getExtension('WEBGL_lose_context');
    audit.sample = () => {
      const current = audit.card(), root = current.renderRoot;
      const stage = root.querySelector('.stage'), canvas = stage?.querySelector('canvas[data-hp-plan-3d]');
      const wrap = stage?.querySelector('.zoomwrap');
      const core = wrap?.querySelector('.dev[data-hp-3d-native]');
      const xy = core?.getBoundingClientRect();
      return {
        scope: current._space,
        projection: current._renderProjection,
        retained: canvas === audit.originalCanvas,
        view: stage?.querySelector('svg[data-hp=stage]')?.getAttribute('viewBox'),
        hidden: !wrap || getComputedStyle(wrap).visibility === 'hidden',
        inert: !!stage?.inert,
        labels: wrap?.querySelectorAll('.roomlabel, .room-label, [data-hp="room-label"]').length ?? 0,
        markers: wrap?.querySelectorAll('.dev[data-hp-3d-native]').length ?? 0,
        ink: canvas?.toDataURL(),
        blockedPick: !xy || !current._plan3dHost?.pick(xy.x + xy.width / 2, xy.y + xy.height / 2),
        fallback: !!stage?.querySelector('.plan-3d-fallback'),
        status: !!stage?.querySelector('.floor-preparation-status'),
      };
    };
    audit.afterFrames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });

  const sample = () => page.evaluate(() => window.__tabResume.sample());
  const before = await sample();
  assert.equal(before.projection, 'iso');
  assert.ok(before.ink?.length > 3000 && before.markers > 0 && before.labels > 0);
  const loss = await page.evaluate(async () => {
    const audit = window.__tabResume;
    const event = new Promise(resolve => window.__resumeGpu.canvas.addEventListener('webglcontextlost',
      e => resolve(e.isTrusted), { once: true }));
    audit.extension.loseContext();
    return event;
  });
  assert.equal(loss, true, 'loss must be delivered by Chromium, not dispatched by the test');
  const held = await sample();
  assert.deepEqual([held.retained, held.hidden, held.inert, held.blockedPick, held.fallback], [true, false, true, true, false]);
  assert.equal(held.ink, before.ink);
  assert.equal(held.view, before.view);
  assert.equal(held.markers, before.markers);
  assert.equal(held.labels, before.labels);

  phase = 'first WebGL restore';
  const restored = await page.evaluate(async () => {
    const audit = window.__tabResume;
    audit.block = true; audit.attempts = 0;
    const event = new Promise(resolve => window.__resumeGpu.canvas.addEventListener('webglcontextrestored',
      e => resolve(e.isTrusted), { once: true }));
    audit.extension.restoreContext();
    return event;
  });
  assert.equal(restored, true);
  await wait(() => window.__tabResume.attempts > 0);
  const beforeCopy = await sample();
  assert.equal(beforeCopy.ink, before.ink);
  assert.equal(beforeCopy.inert, true);
  assert.equal(beforeCopy.hidden, false);
  await page.evaluate(() => {
    const audit = window.__tabResume;
    audit.block = false;
    audit.card()._plan3dHost.viewport.paint();
  });
  await complete();
  const after = await sample();
  assert.equal(after.retained, true);
  assert.equal(after.scope, before.scope);
  assert.equal(after.view, before.view);
  assert.equal(after.ink, before.ink);

  phase = 'Canvas2D loss';
  const canvasLossFrames = await page.evaluate(async () => {
    const audit = window.__tabResume;
    const canvas = audit.card()._plan3dHost.canvas;
    const context = canvas.getContext('2d');
    audit.block = true;
    // There is no Canvas2D equivalent of WEBGL_lose_context. Simulate the
    // observable 2D failure separately and explicitly delete old pixels.
    Object.defineProperty(context, 'isContextLost', { configurable: true, value: () => true });
    context.clearRect(0, 0, canvas.width, canvas.height);
    canvas.dispatchEvent(new Event('contextlost'));
    const samples = [audit.sample()];
    await audit.afterFrames();
    samples.push(audit.sample());
    delete context.isContextLost;
    canvas.dispatchEvent(new Event('contextrestored'));
    await audit.afterFrames();
    samples.push(audit.sample());
    return samples;
  });
  assert.ok(canvasLossFrames.every(frame => frame.hidden && frame.inert && frame.blockedPick && !frame.fallback),
    JSON.stringify(canvasLossFrames.map(({ hidden, inert, blockedPick, fallback }) => [hidden, inert, blockedPick, fallback])));
  await stage.locator('.floor-preparation-status').waitFor();
  await page.evaluate(() => {
    const audit = window.__tabResume;
    audit.block = false;
    audit.card()._plan3dHost.viewport.paint();
  });
  await complete();
  const afterCanvas = await sample();
  assert.equal(afterCanvas.ink, before.ink);
  assert.equal(afterCanvas.scope, before.scope);
  assert.equal(afterCanvas.view, before.view);

  phase = 'visibility and delayed reconnect';
  const returnFacts = await page.evaluate(async () => {
    const audit = window.__tabResume;
    const ctx = audit.originalCanvas.getContext('2d');
    const drawImage = ctx.drawImage;
    let blits = 0;
    ctx.drawImage = function (...args) { blits++; return drawImage.apply(this, args); };
    const actualNow = Date.now;
    let hidden = false, elapsed = 0;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Date.now = () => actualNow() + elapsed;
    const visible = async (value, hiddenTime = 0) => {
      hidden = !value; elapsed += hiddenTime;
      document.dispatchEvent(new Event('visibilitychange'));
      await audit.afterFrames();
    };
    const callCount = () => audit.calls.filter(type => type === 'houseplan/config/get' || type === 'houseplan/layout/get').length;
    try {
      const start = callCount(), beforeHidden = blits;
      await visible(false);
      const hiddenBlits = blits - beforeHidden;
      await visible(true);
      const quick = audit.sample(), quickReads = callCount() - start;

      audit.gate.reads = new Promise(resolve => { audit.gate.release = resolve; });
      const retainedCalls = audit.calls.length;
      await visible(false);
      audit.connection.connected = false;
      audit.connection.dispatchEvent(new Event('disconnected'));
      audit.connection.connected = true;
      audit.connection.dispatchEvent(new Event('ready'));
      await visible(true, 16_000);
      // A second wake signal must not launch another concurrent pair.
      document.dispatchEvent(new Event('visibilitychange'));
      await audit.afterFrames();
      const long = audit.sample();
      audit.gate.release();
      return { hiddenBlits, quick, quickReads, long, wakeCalls: audit.calls.slice(retainedCalls) };
    } finally {
      audit.gate.release?.();
      delete document.visibilityState; delete document.hidden; Date.now = actualNow;
      ctx.drawImage = drawImage;
    }
  });
  assert.equal(returnFacts.hiddenBlits, 0);
  assert.equal(returnFacts.quickReads, 0);
  // Config can also be read independently by existing host capability
  // intake. Only the authoritative config/layout recovery reads layout.
  assert.equal(returnFacts.wakeCalls.filter(call => call === 'houseplan/layout/get').length, 1);
  assert.ok(returnFacts.wakeCalls.includes('houseplan/config/get'));
  for (const frame of [returnFacts.quick, returnFacts.long]) {
    assert.equal(frame.retained, true);
    assert.equal(frame.hidden, false);
    assert.equal(frame.status, false);
    assert.equal(frame.fallback, false);
    assert.equal(frame.projection, 'iso');
    assert.equal(frame.view, before.view);
    assert.equal(frame.ink, before.ink);
  }
  await complete();

  phase = 'live device state after reconnection';
  const changedLight = Object.values(fixture.entities).find(entity => entity.entity_id.startsWith('light.')
    && fixture.layout[entity.device_id]?.s === before.scope);
  assert.ok(changedLight, 'fixture has a light on the current floor');
  await page.evaluate(entity => {
    const { panel } = window.__tabResume;
    const hass = panel.hass, state = hass.states[entity];
    panel.hass = { ...hass, states: { ...hass.states, [entity]: {
      ...state, state: state.state === 'on' ? 'off' : 'on',
      attributes: { ...state.attributes, rgb_color: [64, 161, 255], brightness: 233 },
    } } };
  }, changedLight.entity_id);
  await wait(ink => window.__tabResume.sample().ink !== ink, before.ink);
  const live = await sample();
  assert.equal(live.projection, 'iso');
  assert.equal(live.view, before.view);
  assert.equal(live.retained, true);

  phase = 'floor switch while GPU is lost';
  const targetFloor = await page.evaluate(async () => {
    const audit = window.__tabResume;
    const gpu = window.__resumeGpu;
    audit.extension = gpu.getExtension('WEBGL_lose_context');
    const lost = new Promise(resolve => gpu.canvas.addEventListener('webglcontextlost', resolve, { once: true }));
    audit.extension.loseContext();
    await lost;
    audit.block = true;
    audit.lostGpu = gpu;
    return audit.floors[1];
  });
  const compactFloors = panel.locator('[data-hp="space-select-value"]');
  if (await compactFloors.count()) await compactFloors.selectOption(targetFloor);
  else await panel.locator(`[data-hp="space-tab"][data-id="${targetFloor}"]`).click({ timeout: 5000 });
  await wait(floor => window.__tabResume.card()._space === floor, targetFloor);
  const waitingFloor = await sample();
  assert.equal(waitingFloor.scope, targetFloor);
  assert.equal(waitingFloor.hidden, true, 'the old floor cannot be visible while its successor has no GPU frame');
  await page.evaluate(() => {
    const audit = window.__tabResume;
    audit.block = false;
    if (audit.lostGpu === window.__resumeGpu && audit.lostGpu.isContextLost()) audit.extension.restoreContext();
    audit.card()._plan3dHost?.viewport.paint();
  });
  await complete();
  const presentedFloor = await sample();
  assert.equal(presentedFloor.scope, targetFloor);
  assert.notEqual(presentedFloor.ink, before.ink);

  phase = 'authority change during WebGL loss';
  const revoked = await page.evaluate(async () => {
    const audit = window.__tabResume;
    const gpu = window.__resumeGpu;
    const lost = new Promise(resolve => gpu.canvas.addEventListener('webglcontextlost', resolve, { once: true }));
    gpu.getExtension('WEBGL_lose_context').loseContext();
    await lost;
    const before = audit.sample();
    audit.panel.hass = { ...audit.panel.hass, user: { id: 'other-fixture-user', is_admin: false } };
    return { before, after: audit.sample() };
  });
  assert.equal(revoked.before.hidden, false, 'a same-authority frame was eligible for keeping');
  assert.equal(revoked.after.hidden, true, 'user change must synchronously hide retained pixels');
  assert.equal(revoked.after.blockedPick, true);
  assert.equal(await page.evaluate(() => window.__tabResume.writes.length), 0);

  phase = 'discard branch';
  // The real Chromium discard is a separate headed check. Here inject only
  // the browser's read-only signal, at document creation, to regress all
  // three route and remount paths under the deterministic headless profile.
  await page.addInitScript(() => Object.defineProperty(document, 'wasDiscarded', { value: true }));
  await open();
  await loadFixture(true);
  await mount(true);
  await wait(() => window.__tabResume.card()?.houseplanContinuityTrace().some(item => item.event === '3d-discard'));
  await stage.locator('.floor-preparation-status').waitFor();
  const discardWaiting = await page.evaluate(() => {
    const stage = window.__tabResume.card().renderRoot.querySelector('.stage');
    const wrap = stage?.querySelector('.zoomwrap');
    return { noPreview: !stage?.querySelector('.hp-startup-view'), notRevealed: !wrap || getComputedStyle(wrap).visibility === 'hidden',
      inert: !wrap || stage.inert, noCopy: !stage?.querySelector('canvas[data-hp-plan-3d-ready]') };
  });
  assert.deepEqual(discardWaiting, { noPreview: true, notRevealed: true, inert: true, noCopy: true });
  await page.evaluate(() => window.__tabResume.releaseOpeningGpu());
  await complete();
  assert.equal(await stage.getAttribute('data-hp-3d-recovery-entering'), null);
  phase = 'discarded document same-route remount';
  await page.evaluate(() => { window.__tabResume.panel.remove(); });
  await mount();
  await complete();
  assert.equal(await page.evaluate(() => window.__tabResume.card().houseplanContinuityTrace()
    .some(item => item.event === '3d-discard')), false, 'SPA remount did not consume the discarded document twice');

  phase = 'discard on another route';
  await open('/demo.html');
  await page.evaluate(() => history.pushState({}, '', '/houseplan?panel-cold=1'));
  await loadFixture();
  await mount();
  await complete();
  assert.equal(await page.evaluate(() => window.__tabResume.card().houseplanContinuityTrace()
    .some(item => item.event === '3d-discard')), false, 'a document discarded on a different route uses the ordinary start');

  assert.equal(await reportPageErrors(), false);
  console.log('OK: full panel WebGL and Canvas2D recovery, delayed reconnect, floor and authority fences, discard route exclusions');
} finally {
  clearTimeout(deadline);
  await browser.close();
}
