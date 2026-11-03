// Manual control for the legitimate refusal hidden by #172's old fixture.
// Not a new mandatory gate. Run after compiling tsconfig.test.json.
import assert from 'node:assert/strict';
import { checkNodeDistances } from '../../../../test-build/junction-limits.js';

// This is the observed candidate's straight right wall with a profile seam at
// [0.9,0.4], plus the deliberately slanted, bodyless divider from that height.
// Coordinates are normalized. cell_cm=5, pitch=1/240: one vertical step is5cm.
const rightWall = [
  { id: 'right-upper', a: [.9, .1], b: [.9, .4], cm: 15 },
  { id: 'right-lower', a: [.9, .4], b: [.9, .8], cm: 15 },
];
const inspect = steps => checkNodeDistances([...rightWall,
  { id: 'zero-divider', a: [.6, .4], b: [.9, (96 + steps) / 240], cm: 0 },
], 5, 1 / 240);
const one = inspect(1), two = inspect(2);
const expected = 5 * .3 / Math.hypot(.3, 1 / 240);
assert.equal(one.length, 1);
assert.equal(one[0].rule, 'distance');
assert.ok(Math.abs(one[0].actual - expected) < 1e-9);
assert.ok(one[0].actual < one[0].limit, 'one step legitimately violates the perpendicular clearance');
assert.equal(two.length, 0, 'two steps preserve the slant with legal clearance');
console.log(JSON.stringify({ oneStep: { expected: 'refused', actual: one[0].actual,
  minimum: one[0].limit }, twoSteps: { expected: 'allowed', violations: two.length } }));
