import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { coherentGridScaleStaticPatch } from '../demo/grid-scale-static-fixture.mjs';

test('grid-scale static fixture keeps config and layout in one isolated snapshot', () => {
  const config = { spaces: [{ id: 'fixture', cell_cm: 1, view_box: [0, 0, 5, 5] }] };
  const layout = { device: { s: 'fixture', x: 1.2, y: 2.4 } };
  const patch = coherentGridScaleStaticPatch({ config, layout, revision: 42 });

  assert.deepEqual(patch.config, config);
  assert.deepEqual(patch.layout, layout);
  assert.notEqual(patch.config, config);
  assert.notEqual(patch.layout, layout);
  assert.equal(patch.configFingerprint, 'grid-scale-fixture:42:config');
  assert.equal(patch.layoutFingerprint, 'grid-scale-fixture:42:layout');

  config.spaces[0].cell_cm = 5;
  layout.device.x = 99;
  assert.equal(patch.config.spaces[0].cell_cm, 1);
  assert.equal(patch.layout.device.x, 1.2);
});

test('grid-scale smoke uses the coherent static snapshot without weakening raster limits', () => {
  const source = readFileSync(new URL('../demo/smoke_grid_scale_invariance.mjs', import.meta.url), 'utf8');
  assert.match(source, /coherentGridScaleStaticPatch\(source\)/);
  assert.match(source, /compact\._snap = \{ \.\.\.compact\._snap, \.\.\.nextPatch \}/);
  assert.match(source, /firstSize: \[first\.width, first\.height\]/);
  assert.match(source, /secondSize: \[second\.width, second\.height\]/);
  assert.match(source, /diff\.changed <= 150 && diff\.maxDelta <= 40 && diff\.meanDelta <= 0\.05/);
});

test('grid-scale static fixture rejects partial inputs', () => {
  assert.throws(() => coherentGridScaleStaticPatch({}), /complete config/);
  assert.throws(() => coherentGridScaleStaticPatch({ config: {}, layout: {} }), /complete config/);
  assert.throws(() => coherentGridScaleStaticPatch({
    config: { spaces: [] }, layout: [],
  }), /complete layout/);
});
