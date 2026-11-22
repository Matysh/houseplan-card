import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { decodeStartupGeometry, encodeStartupGeometry, validStartupGeometry } from '../test-build/startup-floor-wire.js';
import { isoDeviceFitInputs } from '../test-build/iso-overlay-fit-inputs.js';

const rect = { x: 0, y: 0, w: 1000, h: 500 };
const fit = { base: [0, 0, 1000, 500], display: rect,
  frame: { rect, all: rect, hasContent: true, outliers: 0 }, projection: 'iso', rotation: 45 };
const address = { projection: 'iso', rotation: 45 };
const nodes = [['g', { transform: 'matrix(1 0 0 1 0 0)' }, [['path', {d:'M 0 0 L 5 10 Z', fill:'#112233'}, []]]]];
const valid = { version: 1, fit, nodes };
const signal = new AbortController().signal;

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

test('#1522 use the live numeric footprint for badges, LQI and pulse, never the values', () => {
  const p = { valueText: null, valueBadge: {text:'42', position:'bottom'}, pulse:{animated:false}, lqiText:'27' };
  const saved = isoDeviceFitInputs(p);
  assert.deepEqual(isoDeviceFitInputs({ ...p, valueBadge:{...p.valueBadge, text:'73'}, lqiText:'66' }), saved);
  assert.notDeepEqual(isoDeviceFitInputs({ ...p, valueBadge:{...p.valueBadge, text:'123456'} }), saved);
  assert.notDeepEqual(isoDeviceFitInputs({ ...p, lqiText:'255' }), saved);
  assert.notDeepEqual(isoDeviceFitInputs({ ...p, pulse:{animated:true, diameterScale:2} }), saved);
});
