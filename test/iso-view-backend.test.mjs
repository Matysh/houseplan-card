import assert from 'node:assert/strict';
import test from 'node:test';
import { real3dViewOf, volumetricViewOf } from '../test-build/logic.js';

test('#1472 the two installation preferences are interpreted independently and strictly', () => {
  for (const settings of [null, {}, { real_3d: 'true' }, { real_3d: 1 }, { real_3d: false }]) {
    assert.equal(real3dViewOf(settings), false);
  }
  assert.equal(real3dViewOf({ real_3d: true, volumetric_view: false }), true);
  assert.equal(volumetricViewOf({ real_3d: true }), false);
  assert.equal(volumetricViewOf({ volumetric_view: true, real_3d: false }), true);
});
