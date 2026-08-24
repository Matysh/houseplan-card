import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkCoordinateWriteBarriers } from '../scripts/coordinate-write-barrier-guard.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

test('all frontend and backend coordinate writers converge on one boundary (#291)', () => {
  assert.deepEqual(checkCoordinateWriteBarriers(repoRoot), []);
});
