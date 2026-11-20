import test from 'node:test';
import assert from 'node:assert/strict';
import { GOLDEN_SCENARIOS, STAGE6_ACCEPTANCE_SCENARIOS } from '../../demo/golden/matrix.mjs';
import { goldenBrowserSurfaceKey, goldenRunSelection } from '../catalog/golden-selection.mjs';

test('golden surfaces preserve shared hosts, Static isolation and DPR separation', () => {
  assert.equal(goldenBrowserSurfaceKey({ id: 'first' }), 'interactive:1');
  assert.equal(goldenBrowserSurfaceKey({ id: 'second', panelHost: true }), 'interactive:1');
  assert.equal(goldenBrowserSurfaceKey({ staticWallOpenings: true }), 'static:1');
  assert.equal(goldenBrowserSurfaceKey({ deviceScaleFactor: 2 }), 'interactive:2');
  assert.equal(goldenBrowserSurfaceKey({ staticWallOpenings: true, deviceScaleFactor: 2 }), 'static:2');
});

test('isolated captures cannot share a browser with another scene or DPR', () => {
  const scene = { id: 'hover', isolatedCapture: true };
  assert.equal(goldenBrowserSurfaceKey(scene), 'isolated:hover:1');
  assert.notEqual(goldenBrowserSurfaceKey(scene), goldenBrowserSurfaceKey({ id: 'hover' }));
  assert.notEqual(goldenBrowserSurfaceKey(scene), goldenBrowserSurfaceKey({ ...scene, id: 'other' }));
  assert.notEqual(goldenBrowserSurfaceKey(scene), goldenBrowserSurfaceKey({ ...scene, deviceScaleFactor: 2 }));
});

test('native panel rotations keep all four badge scenes off the shared page', () => {
  const { scenarios } = goldenRunSelection(GOLDEN_SCENARIOS, ['--selection=rest']);
  const rotated = scenarios.filter(scene => scene.panelHost && scene.isoBadgeDepth);
  assert.deepEqual(rotated.map(scene => scene.rotation), [0, 90, 180, 270]);
  assert.deepEqual(rotated.map(goldenBrowserSurfaceKey),
    rotated.map(scene => `isolated:${scene.id}:1`));
  assert.equal(goldenBrowserSurfaceKey({ id: 'card-turn', rotation: 270 }), 'interactive:1');
});

test('beta keeps all 78 scenes and isolates only the reviewed hover raster fixture', () => {
  const { scenarios } = goldenRunSelection(GOLDEN_SCENARIOS, ['--selection=beta']);
  assert.equal(scenarios.length, 78);
  const isolated = scenarios.filter(scene => scene.isolatedCapture);
  assert.deepEqual(isolated.map(scene => scene.id), ['panel-isometric-stage6-hover-light']);
  assert.equal(goldenBrowserSurfaceKey(isolated[0]), 'isolated:panel-isometric-stage6-hover-light:1');
  assert.equal(isolated[0].sourceSceneId, 'isometric-stage6-hover-light');
});


test('stable 2.5D material comparisons use independent browser surfaces', () => {
  const { scenarios } = goldenRunSelection(GOLDEN_SCENARIOS, ['--selection=rest']);
  const materialIds = STAGE6_ACCEPTANCE_SCENARIOS
    .filter(scene => !scene.hoverDevice).map(scene => scene.id);
  assert.equal(materialIds.length, 4);
  assert.deepEqual(scenarios.filter(scene => materialIds.includes(scene.id)).map(goldenBrowserSurfaceKey),
    materialIds.map(id => `isolated:${id}:1`));
});
