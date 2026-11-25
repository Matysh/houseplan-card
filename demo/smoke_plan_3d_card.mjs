import assert from 'node:assert/strict';
import { startIsoPaintScene, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const { page, browser } = await startIsoPaintScene({ initScript: () => {
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
    const context = getContext.call(this, kind, ...args);
    if (kind === 'webgl2' && context) {
      window.__hpTestPlanGpu = context;
      (window.__hpTestGpuContexts ??= new Set()).add(context);
    }
    return context;
  };
} });
try {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const present = () => page.waitForFunction(() => {
    const root = window.__isoPaint.renderRoot;
    return !!root.querySelector('[data-hp-plan-3d-ready]') && !!root.querySelector('.dev[data-hp-3d-native]');
  });
  const facts = () => page.evaluate(() => {
    const card = window.__isoPaint, root = card.renderRoot;
    const canvas = root.querySelector('[data-hp-plan-3d]');
    const bounds = canvas.getBoundingClientRect();
    const markers = [...root.querySelectorAll('.dev[data-hp-3d-native]')];
    const centers = markers.flatMap(element => {
      const core = element.querySelector('.device-core').getBoundingClientRect();
      const x = core.x + core.width / 2, y = core.y + core.height / 2;
      return x > bounds.left && x < bounds.right && y > bounds.top && y < bounds.bottom ? [[x, y]] : [];
    });
    const ids = new Set(markers.map(element => element.dataset.id));
    // The large-house fixture intentionally shares positions. Sample each
    // distinct position only once instead of demanding hits on buried disks.
    const unique = new Map(centers.map(([x, y]) => [`${Math.round(x)},${Math.round(y)}`, [x, y]]));
    const hitCount = [...unique.values()].filter(([x, y]) => ids.has(card._plan3dHost.pick(x, y))).length;
    return { expected: root.querySelectorAll('.dev[data-hp-3d-device]').length, markers: markers.length,
      hitCount, anchorCount: unique.size, view: root.querySelector('.plan-svg').getAttribute('viewBox'),
      saved: card._serverCfg.settings.volumetric_view, writes: window.__isoPaintWrites };
  });
  await present();
  const initial = await facts();
  assert.equal(initial.markers, initial.expected);
  assert.ok(initial.hitCount >= initial.anchorCount * .85 && initial.anchorCount > 12, JSON.stringify(initial));
  await zoomIsoPaint(page, 1.35);
  const zoom = await facts();
  assert.notEqual(zoom.view, initial.view);
  assert.equal(zoom.markers, initial.markers);

  await page.evaluate(() => window.__hpTestPlanGpu.getExtension('WEBGL_lose_context').loseContext());
  await page.locator('houseplan-card .plan-3d-fallback').waitFor();
  assert.equal(await page.locator('houseplan-card canvas[data-hp-plan-3d]').count(), 0);
  assert.equal(await page.evaluate(() => window.__isoPaint._serverCfg.settings.volumetric_view), true);
  await page.locator('houseplan-card .plan-3d-fallback button').click();
  await present();
  const recovered = await facts();
  assert.equal(recovered.markers, initial.markers);
  assert.equal(recovered.saved, true);
  assert.deepEqual(recovered.writes, []);
  const beforeDashboard = await page.evaluate(() => window.__hpTestGpuContexts.size);
  await page.evaluate(() => {
    const primary = window.__isoPaint, host = primary.parentElement;
    host.style.display = 'grid';
    host.style.gridTemplateColumns = 'repeat(3,minmax(0,1fr))';
    for (const rotation of [45, 90, 135, 180, 225]) {
      const card = document.createElement('houseplan-card');
      card.setConfig({ type: 'custom:houseplan-card', view: 'iso', plan_rotation: rotation, icon_size: 2.5 });
      card.hass = primary.hass;
      host.append(card);
    }
  });
  const cards = page.locator('#host > houseplan-card');
  assert.equal(await cards.count(), 6);
  const images = new Set();
  for (const card of await cards.all()) {
    await card.locator('.stage').scrollIntoViewIfNeeded();
    const canvas = card.locator('canvas[data-hp-plan-3d-ready]');
    try {
      await canvas.waitFor({ state: 'attached' });
    } catch (error) {
      const fact = await card.evaluate(node => ({ projection: node._renderProjection, desired: node._desiredProjection,
        angle: node._rotation, stage: node._stageEl?.getBoundingClientRect().toJSON(), failure: node._plan3dFailure?.key,
        loading: node._plan3dHost?.world.loading, canvas: !!node.renderRoot.querySelector('canvas[data-hp-plan-3d]'),
        pending: node._floorPreparation?.pending, deviceCount: node._renderDevices?.length }));
      throw new Error(JSON.stringify(fact), { cause: error });
    }
    const painted = await canvas.evaluate(node => node.toDataURL());
    assert.ok(painted.length > 3000);
    images.add(painted);
  }
  assert.equal(images.size, 6, 'each card must receive its own scene and projection');
  assert.equal(await page.evaluate(() => window.__hpTestGpuContexts.size), beforeDashboard, 'all six cards use the existing context');
  assert.deepEqual(errors, []);
  console.log(`OK: ${initial.markers} production marker bodies, ${initial.hitCount}/${initial.anchorCount} sampled hit positions, zoom, 2D and recovery`);
} finally {
  await browser.close();
}
