// #1477: measure the painted free corner of an enlarged device against a real
// wall face, with and without a standard-size neighbour in the same contact.
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1200, height: 900 });
const readings = [];
try {
  for (const iso of [false, true]) {
    await page.evaluate(async (iso) => {
      const space = window.__card._space;
      await window.__hpTest.setServerConfig((cfg) => {
        cfg.settings = { ...cfg.settings, filter_seeded: true, volumetric_view: iso };
        cfg.spaces = [{ id: space, title: 'Mixed device sizes', cell_cm: 5, view_box: [0, 0, 1, 1],
          rooms: [{ id: 'room', name: 'Room', polygon: [[.2,.2],[.8,.2],[.8,.8],[.2,.8]] }],
          walls: [], wall_segments: [], openings: [],
          partitions: [{ id: 'wall', a: [.5, .2], b: [.5, .8], cm: 36 }],
          settings: { show_names: false, show_borders: true } }];
        cfg.markers = [['large', 2, 'mdi:television'], ['standard', 1, 'mdi:light-switch']]
          .map(([id, size, icon]) => ({ id, size, icon, binding: 'virtual', space,
            display: 'static_icon', value_badge: { enabled: false } }));
        return cfg;
      });
      await window.__hpTest.setLayout({ large: { s: space, x: .65, y: .42 },
        standard: { s: space, x: .7, y: .62 } });
    }, iso);
    await page.waitForFunction((iso) => {
      const card = window.__card;
      const scene = card._deviceContacts?.scene;
      return scene?.shapes.has('large') && scene.shapes.has('standard') &&
        (card._renderProjection === 'iso') === iso && scene.walls.some(wall => wall.normal?.[0] > .99);
    }, iso);
    for (const grouped of [false, true]) {
      const expected = await page.evaluate(async (grouped) => {
        const card = window.__card;
        const scene = card._deviceContacts.scene;
        const wall = scene.walls.find(wall => wall.normal?.[0] > .99);
        const large = scene.shapes.get('large').marker;
        const standard = scene.shapes.get('standard').marker;
        const extent = (marker) => (marker.box.bottom - marker.box.top) / 2 + marker.diameter * .009375;
        const largeRadius = extent(large), standardRadius = extent(standard);
        const overlap = standard.diameter * 13 / 80;
        const y = 420;
        const atWall = (marker) => (wall.a[0] - marker.box.left + marker.diameter * .009375) / 1000;
        await window.__hpTest.setLayout({
          large: { s: card._space, x: atWall(large), y: y / 1000 },
          standard: { s: card._space, x: grouped ? atWall(standard) : .7,
            y: (grouped ? y + largeRadius + standardRadius - overlap : 620) / 1000 },
        });
        return { radius: largeRadius,
          standardRadius: standardRadius - overlap / 2, wall: wall.id };
      }, grouped);
      await page.waitForFunction(({ expected, grouped }) => {
        const scene = window.__card._deviceContacts?.scene;
        return scene?.shapes.get('large')?.walls.left === expected.wall &&
          scene.component('large').length === (grouped ? 2 : 1);
      }, { expected, grouped });
      for (const zoomed of [false, true]) {
        if (zoomed) {
          const before = await page.evaluate(() => window.__card._zoom);
          const stage = await page.locator('houseplan-card .stage').first().boundingBox();
          await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
          await page.mouse.wheel(0, -120);
          await page.waitForFunction((before) => window.__card._zoom > before, before);
        }
        const measured = await page.evaluate(({ iso, grouped, expected }) => {
          const card = window.__card;
          const scene = card._deviceContacts.scene;
          const large = scene.shapes.get('large'), standard = scene.shapes.get('standard');
          const device = (id) => card.renderRoot.querySelector('[data-hp="device"][data-id="' + id + '"]');
          const owner = device(device('large').dataset.hpDeviceComponent ?? 'large');
          const top = owner.querySelector(iso ? '.iso-marker-glass.front .glass-rim.upper' : '.device-contact-contour');
          const bottom = owner.querySelector('.iso-marker-glass.rear .glass-rim.lower');
          const cornerX = large.marker.x + large.box.right, cornerY = large.marker.y + large.box.top;
          // A quarter-circle of radius r clears its original corner by r(√2−1).
          // Sample SVG path geometry in its native coordinates in both views.
          const radius = (stroke, x, y) => {
            const length = stroke?.getTotalLength();
            if (!length) throw new Error('No painted contact outline');
            let clearance = Infinity;
            for (let i = 0; i <= 256; i++) {
              const p = stroke.getPointAtLength(i * length / 256);
              clearance = Math.min(clearance, Math.hypot(p.x - x, p.y - y));
            }
            return clearance / (Math.SQRT2 - 1);
          };
          const result = {
            upperRadius: radius(top, cornerX, cornerY),
            hitRadius: radius(device('large').querySelector('.device-contact-hit'), cornerX, cornerY),
            standardRadius: grouped ? radius(top, standard.marker.x + standard.box.right,
              standard.marker.y + standard.box.bottom) : null,
            sizes: large.marker.diameter / standard.marker.diameter,
            wallContact: large.walls.left === expected.wall && (!grouped || standard.walls.left === expected.wall),
            dashed: getComputedStyle(top).stroke !== 'none' && top.getAttribute('stroke-dasharray') === (iso ? '6 5' : '4 3'),
          };
          if (iso) {
            const [a, b, c, d] = card._isoFloorMarkerPlane;
            const depth = large.marker.diameter * .24 / (a * d - b * c);
            result.lowerRadius = radius(bottom, cornerX - c * depth, cornerY + a * depth);
          }
          return result;
        }, { iso, grouped, expected });
        const name = (iso ? '2.5D' : '2D') + (grouped ? ' mixed group' : ' wall singleton') +
          (zoomed ? ' after zoom in' : '');
        readings.push({ name, ...measured, expectedRadius: expected.radius });
        check(name + ' paints a dashed wall contour at 2× size', measured.wallContact && measured.dashed &&
          Math.abs(measured.sizes - 2) < .001);
        check(name + ' rounds the enlarged icon', Math.abs(measured.upperRadius - expected.radius) < .25);
        check(name + ' rounds the hit path', Math.abs(measured.hitRadius - expected.radius) < .25);
        if (iso) check(name + ' rounds the lower rim', Math.abs(measured.lowerRadius - expected.radius) < .25);
        if (grouped) check(name + ' rounds the standard icon', Math.abs(measured.standardRadius - expected.standardRadius) < .25);
      }
    }
  }
} finally {
  await finish(browser, readings);
}
