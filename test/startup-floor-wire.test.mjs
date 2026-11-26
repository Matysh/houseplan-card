import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { decodeStartupGeometry, encodeStartupGeometry, startupGeometryImage, validStartupGeometry } from '../test-build/startup-floor-wire.js';
import { decodeStartupRaster, encodeStartupRaster, startupRasterRect } from '../test-build/startup-floor-wire.js';
import { plan3dCamera, plan3dPaintBounds } from '../test-build/plan-3d-camera.js';
import { isoCameraFor } from '../test-build/iso-projection.js';
import { Box3, Vector3 } from 'three';
import { isoDeviceFitInputs } from '../test-build/iso-overlay-fit-inputs.js';

const rect = { x: 0, y: 0, w: 1000, h: 500 };
const fit = { base: [0, 0, 1000, 500], display: rect,
  frame: { rect, all: rect, hasContent: true, outliers: 0 }, projection: 'iso', rotation: 45 };
const address = { projection: 'iso', rotation: 45 };
const nodes = [['g', { transform: 'matrix(1 0 0 1 0 0)' }, [['path', {d:'M 0 0 L 5 10 Z', fill:'#112233'}, []]]]];
const valid = { version: 1, fit, nodes };
const signal = new AbortController().signal;

test('#1574 full 3D paint uses one inert raster and a projected rectangle across viewports', async () => {
  const webp = 'UklGRmgAAABXRUJQVlA4WAoAAAAQAAAABAAAAgAAQUxQSBAAAAABDzD/ERFCIYAA'
    + 'KGgi+h8PVlA4IDIAAADwAQCdASoFAAMAAQAcJYwC7DBAPJVCAAAA/vRRAsO/t+RUYWEsvRePv3xh7C4GFgAAAA==';
  const image = new Blob([Buffer.from(webp, 'base64')], { type: 'image/webp' });
  const scene = { version: 3, fit, rect, image };
  const encoded = await encodeStartupRaster(scene, signal);
  const decoded = await decodeStartupRaster(encoded, address, signal);
  assert.deepEqual({ ...decoded, image: undefined }, { ...scene, image: undefined });
  assert.deepEqual(await decoded.image.arrayBuffer(), await image.arrayBuffer());
  assert.equal(await decodeStartupRaster(encoded, { ...address, rotation: 0 }, signal), null);
  assert.equal(await decodeStartupRaster(encoded, { ...address, projection: 'flat' }, signal), null);
  const bad = await encodeStartupRaster({ ...scene, rect: { ...rect, w: 0 } }, signal);
  assert.equal(await decodeStartupRaster(bad, address, signal), null);
  assert.deepEqual(startupRasterRect(rect, { x: -100, y: -50, w: 1200, h: 600 }, [1440, 720]),
    { x: 120, y: 60, w: 1200, h: 600 });
  const phone = startupRasterRect(rect, { x: -100, y: -950, w: 1200, h: 2400 }, [400, 800]);
  assert.ok(phone);
  for (const [axis, work] of Object.entries({ x: 100, y: 950, w: 1000, h: 500 }))
    assert.ok(Math.abs(phone[axis] - work / 3) < 1e-9);
  assert.equal(startupRasterRect(rect, { x: 1100, y: 0, w: 1200, h: 600 }, [1440, 720]), null);
});

test('#1574 the neutral crop keeps off-screen furniture and uses the same lens at any viewport', () => {
  const bounds = { x: 0, y: 0, w: 1000, h: 750 };
  const desktop = { x: 0, y: 0, w: 1000, h: 450 };
  const phone = { x: 200, y: -550, w: 650, h: 1300 };
  const boxes = [
    new Box3(new Vector3(110, 0, 120), new Vector3(700, 240, 490)),
    new Box3(new Vector3(950, 10, 620), new Vector3(1010, 100, 790)),
  ];
  for (const turn of [0, 45, 180]) {
    const camera = view => plan3dCamera(isoCameraFor(turn), bounds, bounds, 260, view);
    const whole = plan3dPaintBounds(camera(desktop), desktop, boxes);
    const other = plan3dPaintBounds(camera(phone), phone, boxes);
    assert.ok(whole && other);
    for (const axis of ['x', 'y', 'w', 'h']) assert.ok(Math.abs(whole[axis] - other[axis]) < 1e-8);
    const atlas = camera(whole);
    for (const physical of boxes.flatMap(box => [box.min, box.max])) {
      const pt = physical.clone().project(atlas);
      assert.ok(Math.abs(pt.x) < 1 && Math.abs(pt.y) < 1);
      const independent = physical.clone().project(camera(phone));
      const [ax,ay] = [whole.x+(pt.x+1)*whole.w/2,whole.y+(1-pt.y)*whole.h/2];
      assert.ok(Math.abs((ax-phone.x)/phone.w-(independent.x+1)/2)<1e-8);
      assert.ok(Math.abs((ay-phone.y)/phone.h-(1-independent.y)/2)<1e-8);
    }
  }
});

test('#1522 compressed static coordinates round trip without a saved viewport', async () => {
  const encoded = await encodeStartupGeometry(valid, signal);
  assert.deepEqual(await decodeStartupGeometry(encoded, address, signal), valid);
  assert.equal(await decodeStartupGeometry(encoded, { ...address, rotation: 0 }, signal), null);
  assert.equal(validStartupGeometry({ ...valid, viewBox: rect }, address), false);
});

test('#1522 only the closed inert vector schema is accepted', async () => {
  for (const wrong of [['image', {href:'data:image/png;base64,a'}, []],
    ['rect', {x:'1e309'}, []], ['path', {d:'M NaN Infinity'}, []],
    ['g', {style:'fill: red'}, []], ['use', {href:'https://outside.invalid/path'}, []],
    ['g', {filter:'url(https://outside.invalid/a)'}, []]]) {
    const wire = await encodeStartupGeometry({ ...valid, nodes: [wrong] }, signal);
    assert.equal(await decodeStartupGeometry(wire, address, signal), null, JSON.stringify(wrong));
  }
  const expanded = gzipSync(JSON.stringify({ ...valid, nodes: [], padding: 'x'.repeat(2 * 1024 ** 2) })).toString('base64');
  await assert.rejects(decodeStartupGeometry(expanded, address, signal), /vector-size/);
});

test('#1522 repeated furniture paths stay under the wire bound without allowing unbounded paint expansion', async () => {
  const path = ['path', {d:'M0 1 L2 3 '.repeat(4000)}, []];
  const room = { ...valid, nodes: Array.from({length:70}, () => path) };
  const encoded = await encodeStartupGeometry(room, signal);
  assert.ok(encoded.length < 4000);
  assert.deepEqual(await decodeStartupGeometry(encoded, address, signal), room);
  const oversized = await encodeStartupGeometry({ ...room, nodes: Array.from({length:600}, () => path) }, signal);
  assert.equal(await decodeStartupGeometry(oversized,address,signal),null);
});

test('#1522 the same geometry uses the receiver’s stroke and wall-hatch policy', async () => {
  const styled = { ...valid, nodes: [
    ['path', {d:'M 1 1 L 2 2', 'hp-stroke-units':'2', 'vector-effect':'non-scaling-stroke'}, []],
    ['path', {d:'M 0 0 L 3 0 Z', 'hp-wall-depth':'8', 'hp-hatch-step':'8'}, []],
  ] };
  const packet = await decodeStartupGeometry(await encodeStartupGeometry(styled, signal), address, signal);
  const wide = await startupGeometryImage(packet,[1000,500],rect).text();
  const narrow = await startupGeometryImage(packet,[250,125],rect).text();
  assert.match(wide, /stroke-width="2"/);
  assert.match(narrow, /stroke-width="0\.5"/);
  assert.match(wide, /fill="url\(#hp-wall-hatch\)"/);
  assert.match(narrow, /fill="none"/);
  assert.doesNotMatch(wide+narrow, /hp-(stroke-units|wall-depth|hatch-step)=/);
});

test('#1522 use the live numeric footprint for badges, LQI and pulse, never the values', () => {
  const p = { valueText: null, valueBadge: {text:'42', position:'bottom'}, pulse:{animated:false}, lqiText:'27' };
  const saved = isoDeviceFitInputs(p);
  assert.deepEqual(isoDeviceFitInputs({ ...p, valueBadge:{...p.valueBadge, text:'73'}, lqiText:'66' }), saved);
  assert.notDeepEqual(isoDeviceFitInputs({ ...p, valueBadge:{...p.valueBadge, text:'123456'} }), saved);
  assert.notDeepEqual(isoDeviceFitInputs({ ...p, lqiText:'255' }), saved);
  assert.notDeepEqual(isoDeviceFitInputs({ ...p, pulse:{animated:true, diameterScale:2} }), saved);
});
