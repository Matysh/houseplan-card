import assert from 'node:assert/strict';
import { finish } from './serve.mjs';
import { startIsoPaintScene, settleIsoPaint } from './helpers/iso-paint-scene.mjs';
import { makeLargeHouseFixture } from './fixtures/large-house.mjs';

const { page, browser } = await startIsoPaintScene({
  width: 1360, height: 1000, reducedMotion: 'no-preference',
  configureFixture(fixture) {
    Object.assign(fixture, makeLargeHouseFixture({
      floors: 2, roomsPerFloor: 4, devices: 24, openings: 8, partitions: 2, columns: 0, decor: 0, stairs: 0,
    }));
    fixture.config.settings = {
      ...fixture.config.settings, bg_mode: 'static', volumetric_view: true,
      filter_seeded: true, known_devices: Object.keys(fixture.devices).sort(), new_device_ids: [],
      marker_area_snapshot: Object.fromEntries(Object.values(fixture.devices).map(device =>
        [device.id, { binding: 'device:' + device.id, area: device.area_id }])),
    };
  },
});

try {
  const card = page.locator('#host > houseplan-card');
  const stage = card.locator('.stage');
  const wrap = stage.locator('.zoomwrap');
  const status = card.locator('.floor-preparation-status');
  const [first, second] = await page.evaluate(() => window.__isoPaint._serverCfg.spaces.map(space => space.id));
  const go = id => card.locator(`[data-hp="space-tab"][data-id="${id}"]`).click();
  const wait = (predicate, arg) => page.waitForFunction(predicate, arg, { timeout: 12000 });
  const idle = () => wait(() => !window.__isoPaint._floorSwitch && !window.__isoPaint._floorPreparation?.pending);
  await stage.locator('canvas[data-hp-plan-3d-ready]').waitFor();
  await settleIsoPaint(page);
  await page.evaluate(({ first, second }) => {
    const card = window.__isoPaint;
    const audit = window.__floorSwitchTest = { target: second, blocked: 0, finished: new Set(), frames: [] };
    const prototype = Object.getPrototypeOf(card._plan3dHost.viewport);
    const paint = prototype.paint;
    prototype.paint = function () {
      if (card._plan3dHost?.viewport !== this) return paint.call(this);
      if (audit.target === card._space) {
        audit.blocked++;
        return;
      }
      const before = this.painted;
      const result = paint.call(this);
      if (before !== this.painted) audit.finished.add(card._space);
      return result;
    };
    audit.release = () => {
      audit.target = '';
      card._plan3dHost?.viewport.paint();
    };
    const root = card.renderRoot;
    const visible = el => !!el?.getClientRects().length && getComputedStyle(el).visibility === 'visible';
    audit.sample = () => {
      const stage = root.querySelector('.stage');
      const wrap = stage?.querySelector('.zoomwrap');
      return {
        floor: card._space,
        phase: card._floorSwitch?.phase,
        pending: card._floorPreparation?.pending,
        slide: wrap?.className.includes('slide-') ?? false,
        wholeScene: visible(wrap),
        pill: visible(root.querySelector('.floor-preparation-status')),
        targetPainted: audit.finished.has(card._space),
        targetDevices: [...stage?.querySelectorAll('.dev') ?? []].filter(el => el.dataset.id
          && card._renderDevices.find(d => d.id === el.dataset.id)?.space === second && visible(el)).length,
        outgoingFloor: first === card._floorCompleteSpace,
      };
    };
    let frame;
    audit.trace = () => {
      audit.frames = [];
      const tick = () => { audit.frames.push(audit.sample()); frame = requestAnimationFrame(tick); };
      frame = requestAnimationFrame(tick);
    };
    audit.stop = () => { cancelAnimationFrame(frame); return audit.frames; };
  }, { first, second });

  await page.evaluate(() => window.__floorSwitchTest.trace());
  await go(second);
  await wait(() => window.__floorSwitchTest.blocked > 0);
  await status.waitFor({ state: 'visible' });
  assert.match((await status.textContent()).trim(), /Updating plan/);
  assert.equal(await wrap.isVisible(), false);
  assert.equal(await page.evaluate(() => window.__isoPaint._floorPreparation.pending), false);
  await page.evaluate(() => window.__floorSwitchTest.release());
  await wrap.waitFor({ state: 'visible' });
  await idle();
  const cold = await page.evaluate(() => window.__floorSwitchTest.stop());
  assert.ok(cold.some(f => f.phase === 'leaving' && f.outgoingFloor));
  assert.ok(cold.some(f => f.phase === 'waiting' && f.pill && !f.wholeScene));
  assert.ok(cold.some(f => f.phase === 'entering' && f.targetPainted && f.wholeScene));
  assert.ok(cold.every(f => f.floor !== second || f.targetPainted || !f.targetDevices));
  assert.ok(cold.every(f => !f.slide));
  await status.waitFor({ state: 'hidden' });

  await go(first);
  await idle();
  await page.evaluate(() => window.__floorSwitchTest.trace());
  await go(second);
  await wait(() => window.__floorSwitchTest.frames.some(f => f.slide));
  const warm = await page.evaluate(() => window.__floorSwitchTest.stop());
  assert.ok(warm.some(f => f.floor === second && f.slide && f.wholeScene));
  assert.ok(warm.every(f => !f.pill && f.phase !== 'waiting'));

  // A cold 2D geometry job can finish during the outgoing fade. Use the
  // actual animation endpoint to make the no-flash case deterministic.
  await page.evaluate(() => {
    const card = window.__isoPaint;
    card.setConfig({ ...card._config, view: 'flat' });
  });
  await wait(() => window.__isoPaint._renderProjection === 'flat' && !window.__isoPaint._floorPreparation?.pending);
  await page.evaluate(() => {
    const card = window.__isoPaint, audit = window.__floorSwitchTest;
    const node = card.renderRoot.querySelector('.zoomwrap');
    const native = node.animate;
    node.animate = function (frames, options) {
      const result = native.call(this, frames, options);
      if (frames.at(-1)?.opacity === 0) {
        node.animate = native;
        result.pause();
        audit.exit = result;
      }
      return result;
    };
    audit.trace();
  });
  await go(first);
  await wait(() => !!window.__floorSwitchTest.exit && !window.__isoPaint._floorPreparation?.pending);
  const whileLeaving = await page.evaluate(() => window.__floorSwitchTest.sample());
  assert.equal(whileLeaving.phase, 'leaving');
  assert.equal(whileLeaving.pill, false);
  await page.evaluate(() => window.__floorSwitchTest.exit.finish());
  await idle();
  const quick = await page.evaluate(() => window.__floorSwitchTest.stop());
  assert.ok(quick.some(f => f.phase === 'entering' && f.wholeScene));
  assert.ok(quick.every(f => !f.pill));

  // Retarget a cold switch before WebGL can publish its frame.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(target => {
    const card = window.__isoPaint;
    card.setConfig({ ...card._config, view: 'iso' });
    window.__floorSwitchTest.target = target;
    window.__floorSwitchTest.blocked = 0;
  }, second);
  await stage.locator('canvas[data-hp-plan-3d-ready]').waitFor();
  // Drop the accepted geometry cache as on a newly opened page.
  await page.evaluate(() => window.__isoPaint._floorPreparation.invalidate());
  await go(second);
  await wait(() => window.__floorSwitchTest.blocked > 0);
  await status.waitFor({ state: 'visible' });
  assert.equal(await wrap.isVisible(), false);
  await go(first);
  await page.evaluate(() => window.__floorSwitchTest.release());
  await idle();
  assert.equal(await page.evaluate(() => window.__isoPaint._space), first);
  assert.equal(await status.isVisible(), false);
  assert.equal(await wrap.isVisible(), true);
  // A timed-out cold geometry job keeps partial content out of the error
  // state. The existing retry must be able to reveal the same selection.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    const card = window.__isoPaint;
    card.setConfig({ ...card._config, view: 'flat' });
  });
  await wait(() => window.__isoPaint._renderProjection === 'flat' && !window.__isoPaint._floorPreparation?.pending);
  await page.evaluate(target => {
    const runtime = window.__isoPaint._floorPreparation;
    const prepare = runtime.prepareGeometry;
    runtime.invalidate();
    runtime.memory.clear();
    runtime.prepareGeometry = function (selection, disk) {
      if (selection.input.raw.id !== target) return prepare.call(this, selection, disk);
      this.prepareGeometry = prepare;
      return Promise.resolve({ outcome: 'timeout' });
    };
  }, second);
  await go(second);
  const errorScreen = stage.locator('.floor-preparation-error');
  await errorScreen.waitFor({ state: 'visible', timeout: 5000 }).catch(async cause => {
    const diagnostic = await page.evaluate(() => {
      const c = window.__isoPaint;
      const r = c._floorPreparation;
      return { space: c._space, phase: c._floorSwitch?.phase, pending: r.pending, failed: r.failed,
        status: c._stageEl?.dataset.hpFloorCache };
    });
    throw new Error('Cold retry: ' + JSON.stringify(diagnostic), { cause });
  });
  assert.equal(await status.isVisible(), false);
  assert.equal(await wrap.isVisible(), false);
  await errorScreen.getByRole('button', { name: 'Try again' }).click();
  await idle();
  assert.equal(await page.evaluate(() => window.__isoPaint._space), second);
  assert.equal(await wrap.isVisible(), true);
  assert.equal(await errorScreen.isVisible(), false);
  assert.deepEqual(await page.evaluate(() => window.__isoPaintWrites), []);
  console.log('Cold 3D, warm slide, fast cold 2D, reduced-motion retarget and cold retry passed');
  await finish(browser);
} catch (error) {
  await browser.close();
  throw error;
}
