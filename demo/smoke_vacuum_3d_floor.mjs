import assert from 'node:assert/strict';
import { startIsoPaintScene, settleIsoPaint } from './helpers/iso-paint-scene.mjs';
import { reportPageErrors } from './serve.mjs';

const robot = 'vacuum.floor_test', source = 'camera.floor_test';
const { page, browser } = await startIsoPaintScene({
  width: 1150, height: 880, hasTouch: true,
  referenceRoot: process.env.HP_VACUUM_3D_REFERENCE,
  configureFixture(fixture) {
    const space = fixture.config.spaces[0];
    Object.assign(space, { view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: [{ id: 'robot-room', name: 'Robot room', poly: [[.1,.1],[.9,.1],[.9,.9],[.1,.9]] }],
      openings: [], partitions: [], decor: [], led_strips: [] });
    fixture.devices = { robot: { id: 'robot', name: 'Robot' } };
    fixture.entities = {
      [robot]: { entity_id: robot, device_id: 'robot', platform: 'tasshack' },
      [source]: { entity_id: source, device_id: 'robot', platform: 'tasshack' },
    };
    fixture.states = {
      [robot]: { entity_id: robot, state: 'cleaning', attributes: { friendly_name: 'Robot' } },
      [source]: { entity_id: source, state: 'idle', attributes: {
        vacuum_position: { x: 480, y: 520 }, map_name: 'test',
        path: { path: [{x: 400,y: 490}, {x: 440,y: 495}, {x: 480,y: 520}] },
      } },
    };
    Object.assign(fixture.config.settings, { known_devices: ['robot'], marker_area_snapshot: {} });
    fixture.config.markers = [{
      id: 'robot', binding: 'device:robot', name: 'Robot', icon: 'mdi:robot-vacuum', space: space.id, height_cm: 100,
      vacuum: { source, trail_mode: 'always', map_routes: [
        { id: 'route', source, map_id: 'test', space: space.id, calibration: [1,0,0,0,1,0] },
      ] },
    }];
    fixture.layout = { robot: { s: space.id, x: .27, y: .46 } };
  },
});

const marker = page.locator('houseplan-card [data-hp="vacuum-puck"][data-mid="robot"]');
const margin = (actual, expected, tolerance = 1.1) => assert.ok(Math.abs(actual - expected) < tolerance, actual + ' vs ' + expected);
const update = (state, x, y) => page.evaluate(({ robot, source, state, x, y }) => {
  const card = window.__isoPaint, states = card.hass.states;
  card.hass = { ...card.hass, states: { ...states, [robot]: { ...states[robot], state },
    [source]: { ...states[source], attributes: { ...states[source].attributes, vacuum_position: { x, y } } } } };
}, { robot, source, state, x, y });
const sample = () => page.evaluate(() => {
  const card = window.__isoPaint, host = card._plan3dHost, root = card.renderRoot;
  const painted = host?.viewport.painted;
  const node = root.querySelector('[data-hp="vacuum-puck"][data-mid="robot"]');
  const body = host?.world.markers.group.children.find(mesh => mesh.userData.plan3dPick?.id?.endsWith('vacuum:robot'));
  const dock = host?.world.markers.group.children.find(mesh => mesh.userData.plan3dPick?.id === 'robot');
  if (!body || !dock || !painted || !node) return null;
  const { camera } = painted, box = host.canvas.getBoundingClientRect(), units = card._gridPitch / card._cellCm;
  const screen = (x, z, y) => {
    const q = camera.position.clone().set(x, z, y).project(camera);
    return [box.left + (q.x + 1) * box.width / 2, box.top + (1 - q.y) * box.height / 2];
  };
  body.geometry.computeBoundingBox();
  dock.geometry.computeBoundingBox();
  const [x, z, y] = body.position.toArray(), hitPoint = screen(x, z, y), floorPoint = screen(x, 0, y);
  const floorProxy = node.getBoundingClientRect();
  return { x, y, hitPoint, hit: host.pick(...hitPoint), height: z / units,
    bottom: (z + body.geometry.boundingBox.min.y) / units,
    thickness: -body.geometry.boundingBox.min.y / units,
    dock: dock.position.toArray(), dockBottom: (dock.position.y + dock.geometry.boundingBox.min.y) / units,
    floorError: Math.hypot(floorProxy.left + floorProxy.width / 2 - floorPoint[0], floorProxy.top + floorProxy.height / 2 - floorPoint[1]),
    native: getComputedStyle(node).opacity === '0' && getComputedStyle(node).pointerEvents === 'none',
    trail: root.querySelector('[data-kind="current"][data-vacuum-owner="robot"]')?.getAttribute('d'),
    rotation: card._rotation };
});
const switchToFlat = () => page.evaluate(() => {
  const card = window.__isoPaint;
  card.setConfig({ ...card._config, view: 'flat' });
});
const flatAnchor = () => marker.evaluate(node => {
  const root = node.getRootNode(), box = node.getBoundingClientRect();
  const plane = root.querySelector('.vactrail [data-hp-plan-rotation-frame]');
  const inverse = plane.getScreenCTM().inverse();
  const point = new DOMPoint(box.left + box.width / 2, box.top + box.height / 2).matrixTransform(inverse);
  const style = getComputedStyle(node);
  return { x: point.x, y: point.y, pointerEvents: style.pointerEvents, opacity: style.opacity,
    native: node.hasAttribute('data-hp-3d-native') };
});

try {
  await marker.waitFor();
  await page.locator('houseplan-card canvas[data-hp-plan-3d-ready]').waitFor();
  await settleIsoPaint(page);
  const before = await sample();
  if (process.env.HP_VACUUM_3D_REFERENCE && !before) {
    await switchToFlat();
    await settleIsoPaint(page);
    console.log('Flat reference:', await flatAnchor());
  }
  assert.ok(before, 'moving puck must have an actual WebGL prism separate from the dock');
  assert.ok(before.native && before.hit?.endsWith('vacuum:robot'));
  assert.ok(before.trail?.startsWith('M '), 'the existing current path stays visible');
  margin(before.x, 480); margin(before.y, 520); margin(before.bottom, 0, 1e-5);
  margin(before.dockBottom, 100, 1e-5); margin(before.floorError, 0);
  assert.ok(before.thickness > 0, '0 cm is the base of a solid puck');

  await page.evaluate(() => { window.__vacuumHits = [];
    window.__isoPaint.addEventListener('hass-more-info', event => window.__vacuumHits.push(event.detail.entityId)); });
  await page.mouse.click(...before.hitPoint);
  assert.deepEqual(await page.evaluate(() => window.__vacuumHits), [robot]);
  await page.waitForTimeout(380); // Wait past the shared delayed room-tap window.
  assert.equal(await page.evaluate(() => window.__isoPaint._roomFocus), null, 'robot hit is not a room fit');
  await update('cleaning', 550, 540);
  await page.waitForFunction(() => {
    const card = window.__isoPaint, body = card._plan3dHost?.world.markers.group.children
      .find(mesh => mesh.userData.plan3dPick?.id?.endsWith('vacuum:robot'));
    return body && body.position.x > 484 && body.position.x < 546;
  });
  await page.waitForFunction(() => window.__isoPaint._plan3dHost?.world.markers.group.children
    .some(mesh => mesh.userData.plan3dPick?.id?.endsWith('vacuum:robot') && Math.abs(mesh.position.x - 550) < 1));
  const moved = await sample();
  margin(moved.x, 550); margin(moved.y, 540); margin(moved.bottom, 0, 1e-5);
  assert.deepEqual(moved.dock, before.dock);
  assert.equal(moved.trail, before.trail);

  await page.locator('houseplan-card [data-hp="rotate-right"]').click();
  await page.waitForFunction(angle => window.__isoPaint._rotation !== angle, before.rotation);
  await settleIsoPaint(page);
  await update('returning', 590, 550);
  await page.waitForFunction(() => window.__isoPaint._plan3dHost?.world.markers.group.children
    .some(mesh => mesh.userData.plan3dPick?.id?.endsWith('vacuum:robot') && Math.abs(mesh.position.x - 590) < 1));
  const returning = await sample();
  assert.equal((returning.rotation - before.rotation + 360) % 360, 45);
  margin(returning.x, 590); margin(returning.y, 550); margin(returning.bottom, 0, 1e-5);
  margin(returning.thickness, before.thickness, 1e-6); margin(returning.floorError, 0);
  assert.deepEqual(returning.dock, before.dock);
  await page.touchscreen.tap(...returning.hitPoint);
  assert.deepEqual(await page.evaluate(() => window.__vacuumHits), [robot, robot]);
  await update('docked', 590, 550);
  await page.waitForFunction(() => !window.__isoPaint.renderRoot.querySelector('.vacpuck')
    && !window.__isoPaint._plan3dHost?.world.markers.group.children
      .some(mesh => mesh.userData.plan3dPick?.id?.endsWith('vacuum:robot')));
  assert.ok(await page.locator('houseplan-card .dev[data-id="robot"]').count());

  await switchToFlat();
  await update('cleaning', 480, 520);
  await marker.waitFor();
  await settleIsoPaint(page);
  assert.equal(await marker.evaluate(node => node.hasAttribute('data-hp-3d-vacuum')), false);
  assert.equal(await page.locator('houseplan-card canvas[data-hp-plan-3d]').count(), 0);
  assert.equal(await page.locator('houseplan-card [data-kind="current"][data-vacuum-owner="robot"]').getAttribute('d'), before.trail);
  const flat = await flatAnchor();
  margin(flat.x, 480); margin(flat.y, 520);
  assert.equal(flat.native, false);
  assert.equal(flat.opacity, '1');
  // The 2D wrapper has its own existing pointer-policy; #1612 doesn't change
  // that policy. Check the unchanged DOM callback, not a physical 2D hit.
  await marker.dispatchEvent('click');
  assert.deepEqual(await page.evaluate(() => window.__vacuumHits), [robot, robot, robot]);
  assert.deepEqual(await page.evaluate(() => window.__isoPaintWrites), []);
  assert.equal(await reportPageErrors(), false);
  console.log('3D vacuum follows its floor anchor at 0 cm, preserves depth/pick/dock, and leaves Flat unchanged');
} finally {
  await browser.close();
}
