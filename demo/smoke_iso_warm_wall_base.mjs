import assert from 'node:assert/strict';
import { finish } from './serve.mjs';
import { startIsoPaintScene } from './helpers/iso-paint-scene.mjs';
import { makeLargeHouseFixture } from './fixtures/large-house.mjs';

const { page, browser } = await startIsoPaintScene({
  width: 1280, height: 900, reducedMotion: 'no-preference',
  configureFixture(fixture) {
    Object.assign(fixture, makeLargeHouseFixture({ floors: 2, roomsPerFloor: 2, devices: 0,
      openings: 0, partitions: 0, columns: 0, decor: 0, stairs: 0 }));
    fixture.config.settings = { ...fixture.config.settings, bg_mode: 'static', volumetric_view: true,
      filter_seeded: true, known_devices: [], new_device_ids: [], marker_area_snapshot: {} };
    for (const [index, floor] of fixture.config.spaces.entries()) {
      floor.partitions = [{ id: 'sample-wall', a: [.065, .16], b: [.38, .16], cm: 32 }];
      floor.decor = [{ id: 'floor-line', kind: 'line', x1: .08, y1: .06, x2: .12, y2: .06,
        width_cm: 1, color: '#555555' }];
      floor.settings = { ...floor.settings, show_names: false, transparent_walls_3d: index === 1,
        room_color: '#193c52', room_opacity: .16, wall_fill: { c: '#214358', a: .35 } };
    }
  },
});

try {
  const floors = await page.evaluate(() => window.__isoPaint._serverCfg.spaces.map(f => f.id));
  const ready = id => page.waitForFunction(id => {
    const c = window.__isoPaint;
    return c._space === id && c._presentedFloors.get(id) === c._floorPreparation?.preparedGeometryKey
      && !c._floorPreparation?.pending && !c._floorSwitch && !c._slide && c._plan3dHost?.viewport.painted
      && !c._plan3dHost.world.loading && c._plan3dPaintedFloor === c._floorPaintKey();
  }, id);
  const tab = id => page.locator(`#host > houseplan-card [data-hp="space-tab"][data-id="${id}"]`);
  await ready(floors[0]);
  await tab(floors[1]).click();
  await ready(floors[1]);
  await tab(floors[0]).click();
  await ready(floors[0]);
  await tab(floors[1]).click();
  await ready(floors[1]);

  // Sample the same physical points in the displayed canvas. The DOM slide moves
  // the canvas on screen, so a fixed screenshot coordinate would cross the wall.
  await page.evaluate(() => {
    window.__sampleWallBase = () => {
      const { viewport, canvas } = window.__isoPaint._plan3dHost;
      const { camera } = viewport.painted;
      const ctx = canvas.getContext('2d');
      const colors = [];
      for (let x = 85; x <= 365; x += 4) {
        const p = camera.position.clone().set(x, 0, 160).project(camera);
        const px = Math.floor((1 + p.x) * canvas.width / 2);
        const py = Math.floor((1 - p.y) * canvas.height / 2);
        const [r, g, b, a] = ctx.getImageData(px, py, 1, 1).data;
        if (a !== 255) throw Error('Sample outside the painted wall at ' + x);
        colors.push([r, g, b]);
      }
      return colors;
    };
  });

  async function checkSwitch(target, reduced) {
    const first = await tab(target).evaluate(async node => {
      node.click();
      const card = window.__isoPaint;
      await card.updateComplete;
      const wrap = card.renderRoot.querySelector('.zoomwrap');
      const animation = wrap.getAnimations().find(a => a.animationName?.startsWith('hp-slide-'));
      if (animation) {
        animation.pause();
        animation.currentTime = 0;
      }
      const opacity = Number(getComputedStyle(wrap).opacity);
      animation?.play();
      return { animated: !!animation, floor: card._space, opacity, pixels: window.__sampleWallBase() };
    });
    await ready(target);
    const settled = await page.evaluate(() => window.__sampleWallBase());
    assert.equal(first.floor, target);
    assert.equal(first.animated, !reduced, 'The directional slide must respect reduced motion');
    if (target === floors[1]) {
      assert.equal(first.opacity, 1, 'The slide must not fade the translucent wall against the stage');
      assert.ok(settled.some(([r]) => r < 95), 'The sampled footprint must contain the dark wall ink');
    }
    const differences = settled.map((rgb, i) => Math.max(...rgb.map((v, channel) => Math.abs(v - first.pixels[i][channel]))));
    console.log(target, 'wall samples:', differences.length, 'maximum channel difference:', Math.max(...differences),
      'first / settled middle pixel:', first.pixels[35], settled[35]);
    assert.ok(differences.every(d => d <= 1), 'The first wall-base paint must match the settled floor');
  }
  for (const reduced of [false, true]) {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    for (const target of floors) await checkSwitch(target, reduced);
  }
  await finish(browser);
} catch (error) {
  await browser.close();
  throw error;
}
