import assert from 'node:assert/strict';
import { startIsoPaintScene, settleIsoPaint, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';
import { reportPageErrors } from './serve.mjs';

const markerHeights = { automatic: undefined, floor: 0, middle: 60, cut: 133.52, ribbon: 100 };
const { page, browser } = await startIsoPaintScene({
  width: 1100, height: 860,
  configureFixture(fixture) {
    const space = fixture.config.spaces[0];
    space.view_box = [0, 0, 1, 1];
    space.cell_cm = 5;
    space.rooms = [{ id: 'test-only', name: 'Test room', poly: [[.1,.1],[.9,.1],[.9,.9],[.1,.9]] }];
    space.openings = [];
    space.partitions = [{ id: 'height-wall', a: [.34,.28], b: [.63,.28], cm: 20 }];
    space.decor = [];
    space.led_strips = [{ id: 'height-strip', marker: 'ribbon', points: [[.44,.73],[.59,.73],[.59,.78]] }];
    fixture.devices = {};
    fixture.entities = {};
    fixture.states = {};
    fixture.config.markers = Object.entries(markerHeights).map(([id, height]) => ({
      id, name: id, binding: 'virtual', icon: 'mdi:star', space: space.id,
      ...(height === undefined ? {} : { height_cm: height }),
    }));
    fixture.layout = Object.fromEntries(Object.keys(markerHeights).map((id, i) => {
      const [x,y] = [[.29,.49],[.42,.24],[.28,.65],[.76,.42],[.54,.73]][i];
      return [id, { s: space.id, x, y }];
    }));
  },
});

try {
  async function sample() {
    await page.locator('houseplan-card canvas[data-hp-plan-3d-ready]').waitFor();
    await settleIsoPaint(page);
    return page.evaluate(() => {
      const card = window.__isoPaint, root = card.renderRoot;
      const host = card._plan3dHost, { camera } = host.viewport.painted;
      const box = host.canvas.getBoundingClientRect();
      const screen = (x, y, z) => {
        const p = camera.position.clone().set(x, z, y).project(camera);
        return [box.left + (p.x + 1) * box.width / 2, box.top + (1 - p.y) * box.height / 2];
      };
      const units = card._gridPitch / card._cellCm;
      const markers = [...root.querySelectorAll('.dev[data-hp-3d-native]')].flatMap(node => {
        const id = node.dataset.id;
        const body = host.world.markers.group.children.find(mesh => mesh.userData.plan3dPick?.id === id);
        if (!body) return [];
        body.geometry.computeBoundingBox();
        const [x,z,y] = body.position.toArray();
        const here = screen(x, y, z);
        const dom = node.querySelector('.device-core').getBoundingClientRect();
        return [{ id, bottom: (z + body.geometry.boundingBox.min.y) / units, top: z / units,
          hit: host.pick(...here), oldHit: host.pick(...screen(x, y, host.presentation.sectionHeight)),
          domError: Math.hypot(here[0] - dom.left - dom.width / 2, here[1] - dom.top - dom.height / 2) }];
      });
      const ribbon = host.presentation.world.ribbons.find(item => item.owner === 'ribbon');
      const led = root.querySelector('.led-hit[data-hp="led-strip"],.led-hit');
      const ledLayer = led?.closest('[data-hp-iso-perspective-floor]');
      const [a,b] = ribbon.path.points;
      const point = screen((a[0]+b[0])/2, (a[1]+b[1])/2, ribbon.height);
      const domLed = root.elementsFromPoint(...point).some(el => el === led);
      return { rotation: card._rotation, perspective: camera.isPerspectiveCamera, markers,
        led: { bottom: (ribbon.height - ribbon.depth) / units, top: ribbon.height / units,
          hit: host.pick(...point), domLed, elevatedLayer: !!ledLayer } };
    });
  }

  const turns = [];
  for (let i = 0; i < 8; i++) {
    if (i) {
      const previous = turns.at(-1).rotation;
      await page.locator('houseplan-card [data-hp="rotate-right"]').click();
      await page.waitForFunction(angle => window.__isoPaint._rotation !== angle, previous);
    }
    const state = await sample();
    turns.push(state);
    assert.equal(state.perspective, true);
    assert.equal(state.markers.length, 4, JSON.stringify(state));
    for (const marker of state.markers) {
      assert.ok(marker.domError < .8, JSON.stringify({ turn: state.rotation, marker }));
      const target = markerHeights[marker.id];
      if (target !== undefined) assert.ok(Math.abs(marker.bottom - target) < 1e-5, JSON.stringify(marker));
      if (target === undefined || marker.id === 'cut') assert.ok(Math.abs(marker.top - 140) < 1e-5);
    }
    assert.equal(state.led.elevatedLayer, true);
    assert.ok(Math.abs(state.led.bottom - 100) < 1e-7, JSON.stringify(state));
  }
  assert.equal(new Set(turns.map(state => state.rotation)).size, 8);
  assert.ok(turns.some(state => state.markers.some(marker => marker.id === 'floor' && marker.hit === 'floor')));
  assert.ok(turns.some(state => state.markers.some(marker => marker.id === 'floor' && marker.hit !== 'floor')));
  assert.ok(turns.every(state => state.markers.every(marker => marker.id !== 'floor' || marker.oldHit !== 'floor')));
  assert.ok(turns.some(state => state.led.hit === 'ribbon' && state.led.domLed), JSON.stringify(turns));
  await zoomIsoPaint(page, 1.3);
  assert.ok((await sample()).markers.every(marker => marker.domError < .8));
  assert.deepEqual(await page.evaluate(() => window.__isoPaintWrites), []);
  assert.equal(await reportPageErrors(), false);
  console.log('3D height, depth-tested hits, SVG LED targets and eight camera presets passed');
} finally {
  await browser.close();
}
