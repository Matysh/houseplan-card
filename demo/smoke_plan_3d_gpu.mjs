import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { enforcePinnedBrowser, requirePinnedBrowser } from '../scripts/browser-attestation.mjs';
import { reportPageErrors, watchPage } from './serve.mjs';

const bundle = await rollup({
  input: {
    engine: 'node_modules/three/build/three.module.js',
    viewport: 'test-build/plan-3d-viewport.js',
    world: 'test-build/plan-3d-world.js',
    motion: 'test-build/plan-3d-light-motion.js',
  },
  plugins: [nodeResolve()],
});

let browser;
try {
  const { output } = await bundle.generate({ format: 'es', entryFileNames: '[name].js' });
  const modules = new Map(output.filter(entry => entry.type === 'chunk').map(entry => ['/' + entry.fileName, entry.code]));
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  if (requirePinnedBrowser()) await enforcePinnedBrowser(browser, chromium);
  const page = watchPage(await browser.newPage());
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('http://plan-3d.test/**', async route => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/') {
      await route.fulfill({ contentType: 'text/html', body: '<!doctype html><style>canvas{width:200px;height:200px}</style>' });
      return;
    }
    const javascript = modules.get(pathname);
    await route.fulfill(javascript ? { contentType: 'text/javascript', body: javascript } : { status: 404 });
  });
  await page.goto('http://plan-3d.test/');
  const evidence = await page.evaluate(async () => {
    const T = await import('http://plan-3d.test/engine.js');
    const { Plan3dViewport } = await import('http://plan-3d.test/viewport.js');
    const { Plan3dWorld } = await import('http://plan-3d.test/world.js');
    const { Plan3dLightMotion } = await import('http://plan-3d.test/motion.js');
    const getContext = HTMLCanvasElement.prototype.getContext;
    let contexts = 0;
    let gpu;
    HTMLCanvasElement.prototype.getContext = function (kind, ...options) {
      const context = getContext.call(this, kind, ...options);
      if (context && kind === 'webgl2') { contexts++; gpu = context; }
      return context;
    };

    const cards = Array.from({ length: 6 }, (_, index) => {
      let failures = 0;
      let paint;
      const canvas = document.createElement('canvas');
      document.body.append(canvas);
      const viewport = new Plan3dViewport(canvas, () => failures++, () => paint());
      const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 10);
      camera.position.z = 5;
      const scene = new T.Scene();
      const marker = new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ color: index ? 0x00ff00 : 0xff0000 }));
      marker.userData.plan3dPick = { id: 'card-' + index };
      const wall = new T.Mesh(new T.PlaneGeometry(1, 2), new T.MeshBasicMaterial({ color: 0 }));
      wall.position.set(-.5, 0, 1);
      scene.add(wall, marker);
      const painted = new Promise(resolve => { paint = resolve; viewport.present({ camera, scene }); });
      return { viewport, canvas, painted, failures: () => failures };
    });
    await Promise.all(cards.map(card => card.painted));
    const pixel = (canvas, x, y) => Array.from(canvas.getContext('2d').getImageData(x, y, 1, 1).data);
    const pixels = cards.map(card => pixel(card.canvas, 150, 100));
    const picking = cards.map(card => [card.viewport.pick(.25, .5) ?? null, card.viewport.pick(.75, .5) ?? null]);

    const world = new Plan3dWorld(document, .005);
    const input = {
      physical: { walls: [], floor: [[[[-100, -100], [100, -100], [100, 100], [-100, 100]]]], openings: [], openingSurfaces: [] },
      display: { color: '#888888', opacity: 1, wallFill: { c: '#888888', a: 1 } },
      paper: '#101010', rooms: [], panels: [], furniture: [], cellCm: 5, visualScale: 1, decorWidth: 1000, decorHeight: 1000,
    };
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;right:0';
    document.body.append(canvas);
    const camera = new T.OrthographicCamera(-100, 100, 100, -100, 1, 300);
    camera.position.y = 150;
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    let painted;
    const lit = new Plan3dViewport(canvas, () => { throw new Error('3D lighting view failed'); }, () => painted());
    async function lightFrame(lights) {
      world.present({ ...input, lights });
      await new Promise(resolve => { painted = resolve; lit.present({ scene: world.scene, camera }); });
      return [[102, 100], [98, 100], [124, 100], [133, 100], [122, 135]].map(([x, y]) => pixel(canvas, x, y));
    }
    const visible = ['M 0 -100 H 100 V 100 H 0 Z'];
    const lamp = { points: [[8, 0]], height: 250, radius: 25, color: '#ff0000', intensity: 1, visible };
    const led = { points: [[15, 20], [15, 50]], height: 2, radius: 10, color: '#00ff00', intensity: 1, visible };
    const frames = [await lightFrame([]), await lightFrame([lamp, led]), await lightFrame([{ ...lamp, color: '#0000ff' }, led])];
    const motion = new Plan3dLightMotion();
    const solar = { ...lamp, id: 'window', intensity: .4, sun: { inward: [1, 0], depth: 10, tilt: .5 } };
    motion.set([{ ...lamp, id: 'lamp' }, solar], 'scene-a', 10, true);
    motion.set([solar], 'scene-a', 20, true);
    const fading = motion.frame(270);
    const settled = motion.frame(520);
    const fallingSun = { ...solar, intensity: 0, radius: 100 };
    motion.set([fallingSun], 'scene-a', 600, true);
    const belowThreshold = motion.frame(1100).sources.find(light => light.sun);
    motion.set([fallingSun, { ...lamp, id: 'lamp' }], 'scene-a', 1100, true);
    const withLamp = motion.frame(1100).sources.find(light => light.sun);
    const darkSun = motion.frame(2600).sources.find(light => light.sun);
    motion.set([{ ...solar, radius: 40 }], 'scene-a', 2800, true);
    const risingSun = motion.frame(3800).sources.find(light => light.sun);
    motion.set([], 'scene-a', 3800, true);
    const disabledSun = motion.frame(3800).sources.find(light => light.sun);
    const snapshot = await lit.snapshot({ scene: world.scene, camera }, { width: 200, height: 200 });
    if (!snapshot) throw new Error('Static WebP was not encoded');
    const bitmap = await createImageBitmap(snapshot);
    const staticSize = [bitmap.width, bitmap.height];
    bitmap.close();
    const image = document.createElement('canvas');
    image.width = image.height = 16;
    const ctx = image.getContext('2d');
    ctx.fillStyle = '#1234fe';
    ctx.fillRect(0, 0, 16, 16);
    const backdrop = { url: image.toDataURL(), x: -75, y: -75, w: 150, h: 150, angle: 0, opacity: 1 };
    const stairs = [{ id: 'stairs', color: '#008000', volume: {
      footprint: [[-50, -50], [-15, -50], [-15, -15], [-50, -15]], height: 20, steps: 1,
      faces: [{ name: 'tread', cap: true, vertices: [[-50, -50, 20], [-15, -50, 20], [-15, -15, 20], [-50, -15, 20]] }],
    } }];
    world.present({ ...input, lights: [], stairs, backdrop });
    const backdropReady = await world.ready();
    await new Promise(resolve => { painted = resolve; lit.present({ scene: world.scene, camera }); });
    const backdropPixel = pixel(canvas, 140, 140);
    const stairPixel = pixel(canvas, 65, 65);
    const stairHit = lit.pick(.325, .325);
    world.present({ ...input, lights: [], backdrop: { ...backdrop, url: 'data:image/png;base64,AAAA' } });
    const invalidBackdropReady = await world.ready();
    const marker = { id: 'thermometer', center: [50, 45], diameter: 36, height: 20, faces: [{
      left: -.5, right: .5, top: -.5, bottom: .5, rx: .5, ry: .5, color: '#205020', edge: '#032003', foreground: '#ffffff',
      glyph: { kind: 'icon', bounds: [0, 0, 24, 24], angle: 0, fraction: .6,
        paths: [{ d: 'M 0 0 H 24 V 24 H 0 Z', rule: 'nonzero' }] },
    }] };
    world.presentMarkers([marker], 1);
    await new Promise(resolve => { painted = resolve; lit.present({ scene: world.scene, camera }); });
    const markerIcon = pixel(canvas, 150, 145), markerBody = pixel(canvas, 136, 145);
    const markerHit = lit.pick(.75, .725);
    world.presentMarkers([{ ...marker, faces: [{ ...marker.faces[0], foreground: '#ff0000' }] }], 1);
    await new Promise(resolve => { painted = resolve; lit.present({ scene: world.scene, camera }); });
    const markerChanged = pixel(canvas, 150, 145);
    world.presentMarkers([], 1);
    world.present({ ...input, lights: [], rooms: [{ id: 'room', color: '#a07832', opacity: 1,
      geometry: [[[[-95, -95], [-95, 95], [95, 95], [95, -95]]]] }],
      ribbons: [{ id: 'strip-1', owner: 'switch-1', path: { points: [[-25, 30], [45, 30]], closed: false }, width: 8,
        depth: 1, outline: '#222222', color: '#ffff00', opacity: 1 }] });
    await new Promise(resolve => { painted = resolve; lit.present({ scene: world.scene, camera }); });
    const roomColor = pixel(canvas, 90, 100), ribbonColor = pixel(canvas, 110, 130), ribbonHit = lit.pick(.55, .65);
    lit.dispose();
    world.dispose();

    gpu.getExtension('WEBGL_lose_context').loseContext();
    const deadline = performance.now() + 2000;
    while (cards.some(card => !card.failures()) && performance.now() < deadline)
      await new Promise(resolve => requestAnimationFrame(resolve));
    return { contexts, pixels, picking, frames, staticSize, backdropReady, backdropPixel,
      invalidBackdropReady, stairPixel, stairHit, markerIcon, markerBody, markerHit, markerChanged,
      roomColor, ribbonColor, ribbonHit, fading, settled, belowThreshold, withLamp, darkSun, risingSun, disabledSun,
      failures: cards.map(card => card.failures()) };
  });
  assert.deepEqual(errors, []);
  assert.equal(evidence.contexts, 1);
  assert.deepEqual(evidence.picking, Array.from({ length: 6 }, (_, i) => [null, 'card-' + i]));
  assert.deepEqual(evidence.pixels, [[255, 0, 0, 255], ...Array.from({ length: 5 }, () => [0, 255, 0, 255])]);
  assert.deepEqual(evidence.failures, [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(evidence.staticSize, [200, 200]);
  assert.equal(evidence.backdropReady, true);
  assert.deepEqual(evidence.backdropPixel, [18, 52, 254, 255]);
  assert.equal(evidence.invalidBackdropReady, false);
  assert.deepEqual(evidence.stairPixel, [0, 128, 0, 255]);
  assert.equal(evidence.stairHit, 'stair:stairs');
  assert.deepEqual(evidence.markerIcon, [255, 255, 255, 255]);
  assert.deepEqual(evidence.markerBody, [32, 80, 32, 255]);
  assert.equal(evidence.markerHit, 'thermometer');
  assert.deepEqual(evidence.markerChanged, [255, 0, 0, 255]);
  assert.deepEqual(evidence.roomColor, [160, 120, 50, 255]);
  assert.deepEqual(evidence.ribbonColor, [255, 255, 0, 255]);
  assert.equal(evidence.ribbonHit, 'switch-1');
  assert.equal(evidence.fading.active, true);
  assert.deepEqual(evidence.fading.sources.map(({ id, intensity }) => [id, intensity]), [['lamp', .5], ['window', .4]]);
  assert.equal(evidence.settled.active, false);
  assert.deepEqual(evidence.settled.sources.map(({ id, intensity }) => [id, intensity]), [['window', .4]]);
  assert.ok(Math.abs(evidence.belowThreshold.intensity - .3) < 1e-9);
  assert.equal(evidence.belowThreshold.radius, 25, 'the previous solar footprint fades when crossing the threshold');
  assert.deepEqual(evidence.withLamp, evidence.belowThreshold, 'a lamp change never restarts the solar fade');
  assert.equal(evidence.darkSun.intensity, 0);
  assert.equal(evidence.risingSun.intensity, .2);
  assert.equal(evidence.risingSun.radius, 40, 'the new footprint appears with a smooth intensity change');
  assert.equal(evidence.disabledSun, undefined, 'night and disabled gates clear solar light immediately');
  const [unlit, red, blue] = evidence.frames;
  assert.deepEqual(red[1], unlit[1], 'the optical mask keeps the adjacent room dark');
  assert.ok(red[2][0] > 100, 'a short radius still reaches the floor below a high lamp');
  assert.deepEqual(red[3], unlit[3], 'the saved radius bounds the floor footprint');
  assert.ok(red[4][1] > 100, 'the LED lights the floor along its path');
  assert.ok(blue[0][2] > 160 && blue[0][0] === unlit[0][0], 'changing the state recolors the lit area');
  if (await reportPageErrors()) throw new Error('Uncaught browser exception in the GPU scene');
  console.log('OK: shared WebGL2 output, covered picking, stairs, backdrop, context loss, and world-space lamp/LED light');
} finally {
  await browser?.close();
  await bundle.close();
}
