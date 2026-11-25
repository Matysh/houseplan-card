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
    host: 'test-build/plan-3d-host.js',
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
    const { Plan3dHost } = await import('http://plan-3d.test/host.js');
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
    const largeRadius = await lightFrame([{ ...lamp, radius: 2_000,
      visible: ['M 0 -100 L 100 -100 L 100 100 L 0 100 Z'],
      floorClip: ['M -100 -100 L 40 -100 L 40 100 L -100 100 Z', 'M -40 -100 L 100 -100 L 100 100 L -40 100 Z'],
    }]);
    const wallLighting = await (async () => {
      const w = new Plan3dWorld(document, .005);
      const physical = { ...input.physical, walls: [[[[-8,-50],[0,-50],[0,50],[-8,50]]]] };
      const p = new T.OrthographicCamera(-70,70,70,-70,1,500);
      const wallLight = { ...lamp, points: [[30,0]], height: 190, radius: 90, color: '#ff8800',
        visible: ['M 3 -70 H 85 V 70 H 3 Z'], wallVisible: ['M 0 -70 H 85 V 70 H 0 Z'] };
      const wallRibbon = { ...wallLight, points: [[0,-30],[0,30]], height: 2, radius: 32, ribbon: true };
      async function frame(lights, facing = true) {
        p.position.set(facing ? 145 : -145, 130, 50);
        p.lookAt(0, 33, 0); p.updateMatrixWorld(true);
        w.present({ ...input, physical, lights });
        await new Promise(resolve => { painted = resolve; lit.present({ scene: w.scene, camera: p }); });
        const px = (x, y, z) => {
          const v = new T.Vector3(x,y,z).project(p);
          return pixel(canvas, Math.floor((v.x + 1) * 100), Math.floor((1 - v.y) * 100));
        };
        return [px(facing ? 0 : -8, 12, 0), px(facing ? 0 : -8, 47, 0), px(facing ? 22 : -22, 0, 0)];
      }
      try {
        return {
          baseline: await frame([]), lamp: await frame([wallLight]), ribbon: await frame([wallRibbon]),
          disabled: await frame([{ ...wallLight, wallClip: [], floorClip: [] }]),
          back: await frame([], false), blocked: await frame([wallLight, wallRibbon], false),
        };
      } finally { w.dispose(); }
    })();
    const restoredLight = await (async () => {
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;top:220px;right:0';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '-100 -100 200 200');
      svg.style.display = 'none';
      document.body.append(canvas, svg);
      const bounds = { x: -100, y: -100, w: 200, h: 200 };
      const preset = { rotDeg: 35, tiltDeg: 50, xyScale: 1, zScale: 1, origin: [0, 0], floorScaleY: Math.sin(40 * Math.PI / 180) };
      let paints = 0;
      const host = new Plan3dHost(canvas, svg, .005, () => { throw new Error('3D light resume failed'); }, () => paints++);
      const ticks = async (count = 3) => {
        for (let i = 0; i < count; i++) await new Promise(resolve => requestAnimationFrame(resolve));
      };
      const setHidden = hidden => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
        document.dispatchEvent(new Event('visibilitychange'));
      };
      const present = (intensity, animateLights = true) => host.present({ world: { ...input, lights: [{ ...lamp, id: 'lamp', intensity }] },
        bounds, content: bounds, preset, sectionHeight: 50, lightScope: 'visibility-test', animateLights }, bounds);
      try {
        present(1, false);
        await ticks(6);
        const expectedOn = canvas.toDataURL();
        present(0, false);
        await ticks(6);
        const initialPaints = paints, off = canvas.toDataURL();
        setHidden(true);
        present(1);
        await ticks();
        const held = paints === initialPaints;
        setHidden(false);
        await new Promise(resolve => setTimeout(resolve, 600));
        await ticks();
        const on = canvas.toDataURL();
        setHidden(true);
        present(0);
        await new Promise(resolve => setTimeout(resolve, 550));
        setHidden(false);
        await ticks();
        return { initialPaints, held, litWitness: expectedOn !== off, turnedOn: on === expectedOn,
          turnedOff: canvas.toDataURL() === off };
      } finally {
        delete document.hidden;
        host.dispose();
        canvas.remove();
        svg.remove();
      }
    })();
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
    world.present({ ...input, lights: [], stairs, backdrop: { ...backdrop, opacity: 0 } });
    await new Promise(resolve => { painted = resolve; lit.present({ scene: world.scene, camera }); });
    const stairWithoutBackdrop = pixel(canvas, 65, 65);
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
    const fullPixels = canvas.width * canvas.height;
    lit.drawMs = 100;
    lit.present({ scene: world.scene, camera, motion: true }, true);
    const motionPixels = canvas.width * canvas.height, motionHit = lit.pick(.75, .725);
    lit.present({ scene: world.scene, camera }, true);
    const settledPixels = canvas.width * canvas.height;
    world.presentMarkers([{ ...marker, faces: [{ ...marker.faces[0], foreground: '#ff0000' }] }], 1);
    await new Promise(resolve => { painted = resolve; lit.present({ scene: world.scene, camera }); });
    const markerChanged = pixel(canvas, 150, 145);
    const glyphPixels = async glyph => {
      world.presentMarkers([{ ...marker, faces: [{ ...marker.faces[0], glyph }] }], 1);
      await new Promise(resolve => { painted = resolve; lit.present({ scene: world.scene, camera }); });
      const pixels = canvas.getContext('2d').getImageData(140, 135, 20, 20).data;
      let coverage = 0, ink = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const [r, g, b] = pixels.subarray(i, i + 3);
        if (r > 248 && g > 248 && b > 248) ink++;
        if (r > 36 && r < 245 && g > r + 2 && Math.abs(r - b) < 3) coverage++;
      }
      return { coverage, ink, center: pixel(canvas, 150, 145), hit: lit.pick(.75, .725) };
    };
    const hollowIcon = await glyphPixels({ ...marker.faces[0].glyph,
      paths: [{ d: 'M0 0H24V24H0Z M7.8 7.8V16.2H16.2V7.8Z', rule: 'evenodd' }] });
    const valueInk = await glyphPixels({ kind: 'text', value: '80%', font: 'sans-serif', fraction: .55 });
    const upper = { ...marker, id: 'upper', faces: [{ ...marker.faces[0],
      glyph: { kind: 'text', value: '80%', font: 'sans-serif', fraction: .55 } }] };
    const lower = { ...marker, id: 'lower', faces: [{ ...marker.faces[0], foreground: '#ff4050' }] };
    const stack = async markers => {
      world.presentMarkers(markers, 1);
      lit.present({ scene: world.scene, camera }, true);
      return { pixels: canvas.getContext('2d').getImageData(130, 125, 40, 40).data, hit: lit.pick(.75, .725) };
    };
    const onlyUpper = await stack([upper]), onlyLower = await stack([lower]);
    const both = await stack([lower, upper]), reversed = await stack([upper, lower]);
    const equality = (left, right) => left.pixels.every((value, i) => value === right.pixels[i]);
    const coincident = { upperOnly: equality(both, onlyUpper), lowerOnly: equality(reversed, onlyLower),
      upperHit: both.hit, lowerHit: reversed.hit };
    const atlas = (() => {
      const crop = camera.clone();
      const layout = [
        ...Array.from({length: 10}, (_, i) => ({ ...marker, id: 'noise-' + i, center: [42 + i, 45] })),
        { ...marker, id: 'near-a', center: [0,0] },
        { ...marker, id: 'near-b', center: [300,0] },
      ];
      const paint = () => world.presentMarkers(layout, 16, { camera: crop, width: 3200, height: 3200 });
      const cell = id => world.markers.markers.get(id + ':0').cell.page.cell;
      const bytes = () => world.markers.atlas.pages.filter(page => page.cell > 128)
        .reduce((total,page) => total + page.bytes.length, 0);
      paint();
      const before = [cell('near-a'), cell('near-b'), bytes()];
      crop.position.x = 300; crop.lookAt(300,0,0); crop.updateMatrixWorld(true);
      paint();
      return { before, after: [cell('near-a'), cell('near-b'), bytes()] };
    })();
    world.presentMarkers([], 1);
    world.present({ ...input, lights: [], rooms: [{ id: 'room', color: '#a07832', opacity: 1,
      geometry: [[[[-95, -95], [-95, 95], [95, 95], [95, -95]]]] }],
      ribbons: [{ id: 'strip-1', owner: 'switch-1', path: { points: [[-25, 30], [45, 30]], closed: false }, width: 8,
        depth: 1, outline: '#222222', color: '#ffff00', opacity: 1 }] });
    await new Promise(resolve => { painted = resolve; lit.present({ scene: world.scene, camera }); });
    const roomColor = pixel(canvas, 90, 100), ribbonColor = pixel(canvas, 110, 130), ribbonHit = lit.pick(.55, .65);
    world.present({ ...input, lights: [] });
    const outline = { id: 'outline', members: ['outline'], outline: 'M -40 0 L 40 0', diameter: 45 };
    const paintedRim = async virtual => {
      world.presentOutlines([{ ...outline, virtual }], 25);
      await new Promise(resolve => { painted = resolve; lit.present({ scene: world.scene, camera }); });
      return Array.from({ length: 76 }, (_, i) => [99, 100].some(y => pixel(canvas, 62 + i, y)[0] > 45));
    };
    const solidRim = await paintedRim(false), dashedRim = await paintedRim(true);
    world.presentOutlines([], 25);
    world.present({ ...input, paper: '#dddddd', lights: [] });
    await new Promise(resolve => { painted = resolve; lit.present({ scene: world.scene, camera }); });
    const unshadowed = [pixel(canvas, 100, 100), pixel(canvas, 132, 100)];
    world.presentContacts(input.physical.floor, { x: -100, y: -100, w: 200, h: 200 }, [], [[0, 0, 40, 32, .3]]);
    await new Promise(resolve => { painted = resolve; lit.present({ scene: world.scene, camera }); });
    const shadowed = [pixel(canvas, 100, 100), pixel(canvas, 132, 100)];
    lit.dispose();
    world.dispose();

    gpu.getExtension('WEBGL_lose_context').loseContext();
    const deadline = performance.now() + 2000;
    while (cards.some(card => !card.failures()) && performance.now() < deadline)
      await new Promise(resolve => requestAnimationFrame(resolve));
    return { contexts, pixels, picking, frames, largeRadius, wallLighting, restoredLight, staticSize, backdropReady, backdropPixel,
      invalidBackdropReady, stairPixel, stairWithoutBackdrop, stairHit, markerIcon, markerBody, markerHit, markerChanged, unshadowed, shadowed,
      fullPixels, motionPixels, motionHit, settledPixels, hollowIcon, valueInk, coincident, atlas,
      roomColor, ribbonColor, ribbonHit, solidRim, dashedRim, fading, settled, belowThreshold, withLamp, darkSun, risingSun, disabledSun,
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
  assert.ok(evidence.stairWithoutBackdrop[1] > 50, 'the pale tread has visible fill');
  assert.ok(evidence.stairPixel[2] - evidence.stairWithoutBackdrop[2] > 65, 'the stair transmits what is behind its tread');
  assert.equal(evidence.stairHit, 'stair:stairs');
  assert.deepEqual(evidence.markerIcon, [255, 255, 255, 255]);
  assert.deepEqual(evidence.markerBody, [32, 80, 32, 255]);
  assert.equal(evidence.markerHit, 'thermometer');
  assert.ok(evidence.motionPixels < evidence.fullPixels, 'slow motion reduces raster work, not camera coverage');
  assert.equal(evidence.motionHit, evidence.markerHit, 'the smaller raster retains native picking');
  assert.equal(evidence.settledPixels, evidence.fullPixels);
  assert.deepEqual(evidence.markerChanged, [255, 0, 0, 255]);
  assert.deepEqual(evidence.hollowIcon.center, evidence.markerBody, 'the icon retains the hole in its silhouette');
  assert.ok(evidence.hollowIcon.ink > 25 && evidence.hollowIcon.coverage > 8,
    'icon edges blend with the coloured face: ' + JSON.stringify(evidence.hollowIcon));
  assert.ok(evidence.valueInk.ink > 5 && evidence.valueInk.coverage > 8,
    'value text has both solid ink and antialiasing: ' + JSON.stringify(evidence.valueInk));
  assert.equal(evidence.hollowIcon.hit, 'thermometer');
  assert.equal(evidence.valueInk.hit, 'thermometer');
  assert.deepEqual(evidence.coincident, { upperOnly: true, lowerOnly: true, upperHit: 'upper', lowerHit: 'lower' },
    'coincident devices show and pick exactly one cap with its own glyph, never a blend of both');
  assert.deepEqual(evidence.atlas.before, [1024,64,16 * 1024 * 1024], 'high density favors the centered cap under the atlas budget');
  assert.deepEqual(evidence.atlas.after, [64,1024,4 * 1024 * 1024], 'panning at fixed zoom moves high density to the new crop');
  assert.deepEqual(evidence.roomColor, [160, 120, 50, 255]);
  assert.deepEqual(evidence.ribbonColor, [255, 255, 0, 255]);
  assert.equal(evidence.ribbonHit, 'switch-1');
  assert.ok(evidence.unshadowed[0][0] - evidence.shadowed[0][0] > 25, 'the contact shadow softens the floor under the anchor');
  assert.deepEqual(evidence.shadowed[1], evidence.unshadowed[1], 'the contact shadow stays local');
  assert.ok(evidence.solidRim.every(Boolean), 'a physical device draws a continuous rim');
  const gaps = evidence.dashedRim.filter((ink, i, samples) => !ink && samples[i - 1]).length;
  assert.ok(gaps >= 5 && evidence.dashedRim.filter(Boolean).length >= 25, 'a virtual device paints distinct dashes and gaps');
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
  const { baseline, lamp, ribbon, disabled, back, blocked } = evidence.wallLighting;
  assert.ok(lamp[0][0] > baseline[0][0] + 20 && lamp[2][0] > baseline[2][0] + 20,
    'a lamp reaches the wall and floor: ' + JSON.stringify(evidence.wallLighting));
  assert.ok(ribbon[0][0] > baseline[0][0] + 20 && ribbon[2][0] > baseline[2][0] + 20,
    'an LED touching the wall lights both receivers: ' + JSON.stringify(evidence.wallLighting));
  assert.deepEqual(ribbon[1], baseline[1], 'the LED wall wash is localized near its level');
  assert.deepEqual(disabled, baseline, 'disabled room receivers stay dark');
  assert.deepEqual(blocked, back, 'opaque wall blocks both sources');
  assert.ok(evidence.largeRadius[0][0] > 100, 'the near side of a closed opening remains lit at a large radius');
  assert.deepEqual(evidence.largeRadius[1], unlit[1], 'a large radius must not smear the optical mask across the opening');
  assert.ok(evidence.restoredLight.initialPaints > 0, 'the initial dark floor is painted');
  assert.equal(evidence.restoredLight.litWitness, true, 'the reference lamp visibly lights the floor');
  assert.equal(evidence.restoredLight.held, true, 'hidden light changes do not paint');
  assert.equal(evidence.restoredLight.turnedOn, true, 'returning before the fade ends resumes it with no new state updates');
  assert.equal(evidence.restoredLight.turnedOff, true, 'returning after the fade ends paints the final dark floor');
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
