import test from 'node:test';
import assert from 'node:assert/strict';

import { checkWallRecordsPreserved } from '../test-build/wall-record-preservation.js';

const walls = (...cms) => cms.map((cm) => ({ cm }));

test('#264 broad audit preserves its historical presence semantics', () => {
  assert.deepEqual(checkWallRecordsPreserved(walls(15, 15, 30), walls(15, 30)), []);
  assert.equal(checkWallRecordsPreserved(walls(15, 30), walls(15))[0]?.kind, 'lost');
  assert.deepEqual(checkWallRecordsPreserved(walls(15), [], { allowClear: true }), []);
  assert.deepEqual(checkWallRecordsPreserved(walls(0, NaN, Infinity), []), []);
});

test('#264 exact fixed-topology profile includes zero and multiplicity', () => {
  assert.deepEqual(checkWallRecordsPreserved(
    walls(0, 15, 15), walls(15, 0, 15), { exactMultiplicity: true },
  ), []);
  assert.equal(checkWallRecordsPreserved(
    walls(0, 15, 15), walls(0, 15), { exactMultiplicity: true },
  )[0]?.kind, 'count');
  assert.equal(checkWallRecordsPreserved(
    walls(0, 15), walls(0, 15, 30), { exactMultiplicity: true },
  )[0]?.reference, 'было 0, стало 1');
});

