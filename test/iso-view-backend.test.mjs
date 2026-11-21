import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveViewBackend } from '../test-build/iso-view-backend.js';
import { real3dViewOf, volumetricViewOf } from '../test-build/logic.js';

function resolve(patch = {}) {
  return resolveViewBackend({
    surface: 'view', showBorders: true, fallbackRequested: false, real3dRequested: false,
    fallbackReady: false, real3dReady: false, ...patch,
  });
}

test('#1472 the two installation preferences are interpreted independently and strictly', () => {
  for (const settings of [null, {}, { real_3d: 'true' }, { real_3d: 1 }, { real_3d: false }]) {
    assert.equal(real3dViewOf(settings), false);
  }
  assert.equal(real3dViewOf({ real_3d: true, volumetric_view: false }), true);
  assert.equal(volumetricViewOf({ real_3d: true }), false);
  assert.equal(volumetricViewOf({ volumetric_view: true, real_3d: false }), true);
});

test('#1472 stale readiness never enables an unrequested volume backend', () => {
  assert.deepEqual(resolve({ fallbackReady: true, real3dReady: true }),
    { requested: 'flat', presented: 'flat', projection: 'flat' });
  assert.deepEqual(resolve({ fallbackRequested: true, fallbackReady: true, real3dReady: true }),
    { requested: '2.5d', presented: '2.5d', projection: 'iso' });
});

test('#1472 Real 3D takes precedence without relying on a 2.5D preference', () => {
  for (const fallbackRequested of [false, true]) {
    assert.deepEqual(resolve({ real3dRequested: true, real3dReady: true, fallbackRequested, fallbackReady: true }),
      { requested: 'real-3d', presented: 'real-3d', projection: 'iso' });
  }
});

test('#1472 pending or unavailable graphics present only a coherent allowed fallback frame', () => {
  const withFallback = { real3dRequested: true, fallbackRequested: true, fallbackReady: true };
  assert.deepEqual(resolve(withFallback), { requested: 'real-3d', presented: '2.5d', projection: 'iso' });
  for (const patch of [{ fallbackRequested: false }, { fallbackReady: false }]) {
    assert.deepEqual(resolve({ ...withFallback, ...patch }), { requested: 'real-3d', presented: 'flat', projection: 'flat' });
  }
});

test('#1472 editors, static cards and plans with hidden borders never request WebGL', () => {
  const allReady = { real3dRequested: true, fallbackRequested: true, real3dReady: true, fallbackReady: true };
  for (const patch of [{ surface: 'editor' }, { surface: 'static' }, { showBorders: false }]) {
    assert.deepEqual(resolve({ ...allReady, ...patch }), { requested: 'flat', presented: 'flat', projection: 'flat' });
  }
});
