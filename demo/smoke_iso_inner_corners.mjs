/** #1560/#1566: depth-tested vertical edges in the actual WebGL image. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { finish } from './serve.mjs';
import { startIsoPaintScene, settleIsoPaint, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const { config: lab } = JSON.parse(readFileSync(new URL('./ui-lab/default-plan/fixture.json', import.meta.url), 'utf8'));
const reviewDir = process.env.HP_INNER_CORNERS_REVIEW_DIR;
if (reviewDir) await mkdir(reviewDir, { recursive: true });
const { page, browser } = await startIsoPaintScene({
  width: 860, height: 640, dpr: 2, browserArgs: ['--enable-unsafe-swiftshader'],
  configureFixture(fixture) {
    fixture.config.model_version = lab.model_version;
    fixture.config.spaces = lab.spaces.map(space => space.id !== 'lab_ground' ? space : {
      ...space, settings: { ...space.settings, show_names: false, transparent_walls_3d: true,
        room_opacity: .38, wall_fill: { c: '#7d98a8', a: .36 }, glow_enabled: false },
    });
  },
});

const stage = page.locator('houseplan-card .stage');

try {
  await stage.locator('canvas[data-hp-plan-3d-ready]').waitFor();
  const angles = [];
  for (let i = 0; i < 8; i++) {
    const observed = await page.evaluate(() => {
      const card = window.__isoPaint, host = card._plan3dHost;
      const sideInk = host.world.architecture.children[1];
      const { geometry, material } = sideInk;
      const positions = geometry.getAttribute('position');
      const height = host.presentation.sectionHeight;
      const vertical = [];
      for (let j = 0; j < positions.count; j += 2) {
        if (positions.getY(j) !== positions.getY(j + 1)) vertical.push(j);
      }
      // Wall-base lines are followed by the true vertical corner segments.
      const first = vertical[0];
      const corners = vertical.every((j, k) => j === first + k * 2
        && positions.getX(j) === positions.getX(j + 1) && positions.getZ(j) === positions.getZ(j + 1)
        && positions.getY(j) >= 0 && positions.getY(j + 1) > positions.getY(j)
        && positions.getY(j + 1) <= height + .01);
      const intact = vertical.some(j => positions.getY(j) === 0 && Math.abs(positions.getY(j + 1) - height) < .01);
      const read = () => host.canvas.getContext('2d').getImageData(0, 0, host.canvas.width, host.canvas.height).data;
      const paint = () => host.viewport.present({ ...host.frame }, true);
      paint();
      const withEdges = read();
      geometry.setDrawRange(0, first);
      try {
        paint();
        const withoutEdges = read();
        let pixels = 0;
        for (let j = 0; j < withEdges.length; j += 4) {
          if (Math.abs(withEdges[j] - withoutEdges[j]) + Math.abs(withEdges[j + 1] - withoutEdges[j + 1])
            + Math.abs(withEdges[j + 2] - withoutEdges[j + 2]) > 3) pixels++;
        }
        return { rotation: card._rotation, vertical: vertical.length, corners, intact, pixels,
          depth: material.depthTest && !material.depthWrite,
          translucent: material.opacity > 0 && material.opacity < .5 };
      } finally {
        geometry.setDrawRange(0, Infinity);
        paint();
      }
    });
    assert.ok(observed.vertical > 0 && observed.corners && observed.intact && observed.depth && observed.translucent,
      'vertical ink follows real corners and respects depth: ' + JSON.stringify(observed));
    assert.ok(observed.pixels > 12, 'vertical ink contributes visible pixels: ' + JSON.stringify(observed));
    angles.push(observed);
    if (reviewDir) await stage.screenshot({
      path: join(reviewDir, 'ground-' + observed.rotation + '.png'), animations: 'disabled',
    });
    if (i === 7) break;
    await page.locator('houseplan-card [data-hp="rotate-right"]').click();
    await page.waitForFunction(rotation => window.__isoPaint._rotation === rotation, (observed.rotation + 45) % 360);
    await settleIsoPaint(page);
  }
  assert.equal(new Set(angles.map(row => row.rotation)).size, 8);
  await zoomIsoPaint(page, 2);
  const before = await page.evaluate(() => {
    const host = window.__isoPaint._plan3dHost;
    window.__hpCornerLine = host.world.architecture.children[1].geometry;
    const camera = host.viewport.painted.camera;
    return [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements];
  });
  const bounds = await stage.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * .52, bounds.y + bounds.height * .46);
  await page.mouse.wheel(0, -160);
  await settleIsoPaint(page);
  const after = await page.evaluate(() => {
    const host = window.__isoPaint._plan3dHost;
    const camera = host.viewport.painted.camera;
    return { camera: [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements],
      sameInk: host.world.architecture.children[1].geometry === window.__hpCornerLine,
      dpr: devicePixelRatio, writes: window.__isoPaintWrites };
  });
  assert.notDeepEqual(after.camera, before, 'wheel moves the actual painted camera');
  assert.equal(after.sameInk, true, 'world-space corner geometry stays in place during camera changes');
  assert.equal(after.dpr, 2);
  assert.deepEqual(after.writes, []);
  await finish(browser, { angles });
} catch (error) {
  await browser.close();
  throw error;
}
