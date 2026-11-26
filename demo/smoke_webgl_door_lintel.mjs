import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { launch, reportPageErrors } from './serve.mjs';
import { prepareGoldenScenario } from './golden/harness.mjs';
import { GOLDEN_SCENARIOS } from './golden/matrix.mjs';

const root = resolve(process.argv[2] ?? '.');
const output = resolve(process.argv[3] ?? 'artifacts/process-next/webgl-light-edge');
mkdirSync(output, { recursive: true });
const viewport = { width: 1000, height: 900 };
const base = GOLDEN_SCENARIOS.find(scene => scene.id === 'lighting-opaque-glow-two-doorways-dark');
const { page, browser } = await launch(viewport, 1, ['--force-color-profile=srgb'],
  { reducedMotion: 'reduce', colorScheme: 'dark', locale: 'en-US' }, resolve(root, 'demo/srv'), root);
try {
  const samplePair = async (name, door, led = false, back = false) => {
    const images = [];
    for (const active of [false, true]) {
      const initial = door == null;
      await prepareGoldenScenario(page, { ...base, panelHost: true, projection: 'iso',
        extraOpenings: [], warmPixelRegion: undefined, showNames: false,
        zoom: initial ? 3.5 : 1.4, zoomCenter: [505, 482],
        ...(back ? { rotation: 180, decorOverride: [{ id: 'rotation-witness',
          kind: 'line', x1: .13, y1: .19, x2: .26, y2: .19, width_cm: 1,
          color: '#71808c', opacity: .5 }] } : {}),
        layoutOverrides: { 'golden-light-three': { s: 'golden-lighting',
          x: initial ? .60 : .78, y: .54 } },
        stateOverrides: {
          'light.golden_light_three': { state: active ? 'on' : 'off',
            attributes: { rgb_color: [255,196,112], brightness: 255, color_mode: 'rgb', supported_color_modes: ['rgb'] } },
          ...(!initial ? { 'cover.golden_door_half': { state: door ? 'open' : 'closed',
            attributes: { current_position: door } } } : {}),
        },
      }, (fixture, scenario) => {
        if (initial) return;
        const space = fixture.config.spaces.find(space => space.id === scenario.space);
        space.wall_columns = [];
        space.partitions = [{ id: 'far-wall-receiver', a: [.32,.37], b: [.32,.78], cm: 18 }];
        space.openings.find(opening => opening.id === 'light-door').contact = 'cover.golden_door_half';
        fixture.config.settings.glow_radius_cm = 1000;
        if (led) {
          space.led_strips = [{ id: 'wall-wash', marker: 'golden-light-three', points: [[.53,.65],[.53,.75]] }];
          fixture.config.markers.push({ id: 'golden-light-three', binding: 'device:golden-light-three', space: space.id });
        }
      });
    await page.waitForFunction(active => {
      const card = window.__goldenCard;
      return !!card._plan3dHost?.viewport.painted && !!card._plan3dPresentation.world.lights.length === active;
    }, active);
    const result = await page.evaluate(async (back) => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const card = window.__goldenCard, h = card._plan3dHost, { canvas } = h;
      const { camera } = h.viewport.painted;
      const dep = h.presentation.world.physical.openings.find(o => o.id === 'light-door');
      const { axis: { center, tangent, normal, start, end }, face, apertureTop, wallHeight } = dep;
      const project = (matrix, [x,y,z,w]) => [0,1,2,3].map(i =>
        matrix[i]*x + matrix[i+4]*y + matrix[i+8]*z + matrix[i+12]*w);
      const pixel = (x, y, z) => {
        const eye = project(camera.matrixWorldInverse.elements, [x, z, y, 1]);
        const [sx,sy,,w] = project(camera.projectionMatrix.elements, eye);
        return [Math.round((sx/w+1)*canvas.width/2), Math.round((1-sy/w)*canvas.height/2)];
      };
      const ctx = canvas.getContext('2d');
      const sample = (...p) => {
        const coords = pixel(...p);
        return { p, coords, rgb: [...ctx.getImageData(...coords,1,1).data].slice(0,3) };
      };
      const span = Math.hypot(end[0] - start[0], end[1] - start[1]) / 2;
      const side = Math.sign(face.offset[0] * normal[0] + face.offset[1] * normal[1]) * (back ? -1 : 1);
      const receiver = (offset, height) => sample(
        center[0] + tangent[0] * offset + side * face.depth / 2 * normal[0],
        center[1] + tangent[1] * offset + side * face.depth / 2 * normal[1], height);
      const z = (wallHeight + apertureTop) / 2;
      return { center, start, end, tangent, face: face.offset, wallHeight, camera: camera.position.toArray(),
        lights: h.presentation.world.lights.map(({ id, points, height, ribbon }) => ({ id, points, height, ribbon })),
        lintel: [-span-16,-span-12,-span-7,-span-4,-span+1,-span+20,-28,0,28,
          span-20,span-1,span+4,span+7,span+12,span+16].map(offset => receiver(offset,z)),
        floor: [[520,540],[480,540],[458,564],[390,615],[390,653],[380,699]]
          .map(([x,y]) => sample(x,y,0)),
        // The separate far wall has its face 9 cm from its 320-unit axis.
        opposite: [sample(327.5,540,12), sample(327.5,540,87), sample(327.5,620,12)],
        wallWash: [receiver(145,10), receiver(160,10), receiver(175,10)],
      };
      }, back);
      images.push(result);
      await page.screenshot({path: resolve(output, `${name}-${active ? 'on' : 'off'}.png`)});
    }
    const [off, on] = images;
    assert.equal(await reportPageErrors(), false, 'no uncaught errors while rendering the lintel');
    assert.equal(on.lights.length, 1, 'exactly one warm source faces the wall');
    assert.equal(on.lights[0].ribbon, led, 'the expected kind of source reached the shader');
    const cast = ({ rgb: [r, , b] }) => r - b;
    const delta = key => on[key].map((sample, i) => cast(sample) - cast(off[key][i]));
    const result = { name, lintel: delta('lintel'), floor: delta('floor'),
      opposite: delta('opposite'), wallWash: delta('wallWash') };
    console.log(JSON.stringify(result));
    return result;
  };
  const initial = await samplePair('lintel', null);
  const open = await samplePair('open', 100), partial = await samplePair('partial', 50), closed = await samplePair('closed', 0);
  const led = await samplePair('led-front', 0, true), ledBack = await samplePair('led-back', 0, true, true);
  const { lintel, floor } = initial;
  assert.ok(lintel[7] > 24, 'the light is still visible on the masonry');
  assert.ok(Math.abs(lintel[3] - lintel[4]) <= 2 && Math.abs(lintel[10] - lintel[11]) <= 2,
    `sharp glow boundary at the jamb projected onto the lintel: ${lintel}`);
  assert.ok(floor[0] > 70 && floor[1] > 70 && floor.at(-1) <= 6,
    `keep the bright passage and dark side behind masonry: ${floor}`);
  assert.ok(open.opposite[0] > 8 && open.opposite[1] <= 4 && open.opposite[2] > 6,
    `fully open: light must reach the far wall below the head, not through it: ${open.opposite}`);
  assert.ok(partial.opposite[0] > 8 && partial.opposite[1] <= 4 && partial.opposite[2] <= 4,
    `half open: centre remains lit below the head, not the obstructed edge: ${partial.opposite}`);
  assert.ok(closed.opposite.every(value => value <= 4), `closed leaf must stop the light: ${closed.opposite}`);
  assert.ok(led.wallWash.every(value => value > 12) && ledBack.wallWash.every(value => value <= 4),
    `adjacent LED washes its own face, not the back: ${led.wallWash} / ${ledBack.wallWash}`);
} finally { await browser.close(); }
import assert from 'node:assert/strict';
