import test from 'node:test';
import assert from 'node:assert/strict';
import { readWebglCandidate } from '../../demo/performance/card-contract.mjs';
import { compareMeasurements, frozenBaseline, renderMetrics } from '../lib/metrics.mjs';

function candidate() {
  const mesh = { isMesh: true, geometry: { getAttribute: () => ({ count: 3 }) }, material: { isMaterial: true, uuid: 'm' } };
  const group = { traverseVisible: callback => callback(mesh) };
  const scene = { isScene: true, ...group };
  const frame = {};
  const context = { drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4096).fill(255) }) };
  const canvas = { width: 100, height: 100, hasAttribute: () => true,
    ownerDocument: { createElement: () => ({ getContext: () => context }) } };
  const renderer = { isWebGLRenderer: true, info: { render: { calls: 4, triangles: 8 }, memory: { geometries: 4, textures: 1 } },
    getContext: () => ({ getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 1 }), getParameter: () => 'ANGLE SwiftShader software' }) };
  return { _effectiveProjection: () => 'iso', _plan3dHost: { canvas,
    world: { scene, structure: group, openings: group, furniture: group, markers: { group } },
    viewport: { frame, painted: frame, output: { renderer } } } };
}

test('performance WebGL oracle accepts painted meshes and reports software renderer honestly', () => {
  const result = readWebglCandidate(candidate());
  assert.equal(result.drawCalls, 4);
  assert.equal(result.meshes.devices, 1);
  assert.equal(result.rendering, 'software');
  assert.equal(result.comparableToOwnerLaptop, false);
});
test('performance WebGL candidate rejects Flat fallback, unpainted frame, missing objects and empty canvas', () => {
  const flat = candidate(); flat._effectiveProjection = () => 'flat';
  assert.throws(() => readWebglCandidate(flat), /3D не отрисовано.*Flat fallback/);
  const unpainted = candidate(); unpainted._plan3dHost.viewport.painted = {};
  assert.throws(() => readWebglCandidate(unpainted), /no presented WebGL frame/);
  const empty = candidate(); empty._plan3dHost.world.furniture = null;
  assert.throws(() => readWebglCandidate(empty), /missing wall.*furniture/);
  const blank = candidate(); blank._plan3dHost.canvas.ownerDocument.createElement = () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8Array(4096) }) }) });
  assert.throws(() => readWebglCandidate(blank), /empty presented canvas/);
});
test('performance WebGL diagnostics survive measurement comparison and never enter primary policy', () => {
  const base = frozenBaseline(), measured = structuredClone(base);
  measured.webgl_diagnostics = { status: 'measured', runtime: { rendering: 'software', renderer: 'SwiftShader' },
    rows: [{ firstStable3dMs: 900000, geometry: readWebglCandidate(candidate()), gpu: { supported: false, reason: 'unavailable' } }] };
  const report = compareMeasurements(measured, base, base);
  assert.equal(report.requiresDecision, false);
  assert.ok(report.primary.every(row => !row.key.includes('3d')));
  assert.match(renderMetrics(report), /Объёмный вид/);
  assert.match(renderMetrics(report), /Программный рендер/);
  assert.match(renderMetrics(report), /900000/);
});
