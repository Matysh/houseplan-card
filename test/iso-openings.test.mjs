import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIsoOpeningBasis, isoOpeningBounds, projectIsoOpening, resolveIsoDecoration,
} from '../test-build/iso-openings.js';
import { openingAmount } from '../test-build/logic.js';
import { projectPlanPoint } from '../test-build/iso-projection.js';

const opening = (patch = {}) => ({
  id: 'op-1', sourceIndex: 0, type: 'door', x: 100, y: 80,
  angle: 0, length: 60, flipH: false, flipV: false,
  face: { ox: 0, oy: 5, side: 1 }, ...patch,
});

test('door basis is immutable and live amount preserves the exact jamb anchor', () => {
  const basis = buildIsoOpeningBasis(opening());
  assert.equal(Object.isFrozen(basis.leaves), true);
  const closed = projectIsoOpening(basis, 0)[0];
  const open = projectIsoOpening(basis, 1)[0];
  const hinge = projectPlanPoint(basis.leaves[0].hinge, basis.leaves[0].bottom)
    .map((value) => Number(value.toFixed(4))).join(' ');
  assert.match(closed.d, new RegExp(`^M ${hinge.replace('.', '\\.')}`));
  assert.match(open.d, new RegExp(`^M ${hinge.replace('.', '\\.')}`));
  assert.notEqual(open.d, closed.d);
  assert.equal(basis.leaves[0].top, 64 * 0.92);
});

test('window and gate retain two leaves, fixed height bounds and gate 10 degree turn', () => {
  const windowBasis = buildIsoOpeningBasis(opening({ type: 'window' }));
  const gateBasis = buildIsoOpeningBasis(opening({ type: 'gate', flipV: true }));
  assert.equal(windowBasis.leaves.length, 2);
  assert.equal(windowBasis.leaves.every((leaf) => leaf.bottom === 64 * 0.27
    && leaf.top === 64 * 0.78), true);
  assert.deepEqual(gateBasis.leaves.map((leaf) => Math.abs(leaf.turnDeg)), [10, 10]);
  assert.equal(gateBasis.leaves.every((leaf) => leaf.top === 64 * 0.88), true);
  assert.equal(projectIsoOpening(gateBasis, 1).length, 2);
});

test('isometric symbols keep one centre while flips change only direction', () => {
  const centred = buildIsoOpeningBasis(opening());
  const oppositeResolvedFace = buildIsoOpeningBasis(opening({
    face: { ox: 0, oy: -5, side: -1 },
  }));
  assert.deepEqual(oppositeResolvedFace.leaves, centred.leaves,
    'default door ignores which physical room face was resolved');

  const flippedPositive = buildIsoOpeningBasis(opening({ flipV: true }));
  const flippedNegative = buildIsoOpeningBasis(opening({
    flipV: true, face: { ox: 0, oy: -5, side: -1 },
  }));
  assert.deepEqual(flippedNegative.leaves, flippedPositive.leaves,
    'resolved room face cannot translate or redirect the saved flip');
  assert.deepEqual(flippedPositive.leaves[0].hinge, centred.leaves[0].hinge,
    'flip keeps the exact centreline hinge');
  assert.deepEqual(flippedPositive.leaves[0].closedVector, centred.leaves[0].closedVector);
  assert.equal(
    flippedPositive.leaves[0].quarterVector[1],
    -centred.leaves[0].quarterVector[1],
    'flip mirrors the opening direction without moving its origin',
  );

  const gate = buildIsoOpeningBasis(opening({ type: 'gate' }));
  const gateFlipped = buildIsoOpeningBasis(opening({
    type: 'gate', flipV: true, face: { ox: 0, oy: -5, side: -1 },
  }));
  assert.equal(gate.leaves[0].hinge[1], 80);
  assert.equal(gateFlipped.leaves[0].hinge[1], 80);
  assert.deepEqual(gate.leaves.map((leaf) => leaf.turnDeg), [10, -10]);
  assert.deepEqual(gateFlipped.leaves.map((leaf) => leaf.turnDeg), [-10, 10]);
  assert.notDeepEqual(
    projectIsoOpening(gate, 1).map((panel) => panel.d),
    projectIsoOpening(gateFlipped, 1).map((panel) => panel.d),
    'flip changes the gate turn without translating its centred origin',
  );
});

test('passage keeps the wall cut but never creates an isometric panel', () => {
  const passageBasis = buildIsoOpeningBasis(opening({ type: 'passage' }));
  assert.deepEqual(passageBasis.leaves, []);
  assert.deepEqual(projectIsoOpening(passageBasis, 0), []);
  assert.deepEqual(projectIsoOpening(passageBasis, 1), []);
  assert.equal(isoOpeningBounds([passageBasis]), null);
});

test('state-independent opening bounds contain closed and open leaf tips', () => {
  const basis = buildIsoOpeningBasis(opening());
  const bounds = isoOpeningBounds([basis]);
  assert.ok(bounds);
  for (const amount of [0, 0.5, 1]) {
    const panel = projectIsoOpening(basis, amount)[0];
    assert.match(panel.d, /^M /);
  }
  const leaf = basis.leaves[0];
  assert.ok(bounds.x <= leaf.hinge[0] - 60 && bounds.x + bounds.w >= leaf.hinge[0] + 60);
  assert.ok(bounds.y <= leaf.hinge[1] - 60 && bounds.y + bounds.h >= leaf.hinge[1] + 60);
  assert.equal(isoOpeningBounds([]), null);
});

test('flips move structural jamb/basis while HA state changes only projected leaves', () => {
  const normal = buildIsoOpeningBasis(opening());
  const flipped = buildIsoOpeningBasis(opening({ flipH: true, flipV: true }));
  assert.notDeepEqual(flipped.leaves.map((leaf) => leaf.hinge),
    normal.leaves.map((leaf) => leaf.hinge));
  const basisSnapshot = structuredClone(normal);
  const noContact = projectIsoOpening(normal, openingAmount('door', null));
  const unavailable = projectIsoOpening(normal, openingAmount('door', 'unavailable'));
  const closed = projectIsoOpening(normal, openingAmount('door', 'off'));
  const inverted = projectIsoOpening(normal, openingAmount('door', 'off', true));
  assert.deepEqual(unavailable, noContact);
  assert.notDeepEqual(closed, inverted);
  assert.deepEqual(normal, basisSnapshot);
});

test('decoration degradation never removes structure or creates floating panels', () => {
  assert.deepEqual(resolveIsoDecoration({
    showBorders: true, hideOpenings: false, filtersSupported: true, forcedColors: false,
  }), {
    structural: true, panels: true, shadows: true, materialNuance: true, floorSymbols: false,
  });
  assert.deepEqual(resolveIsoDecoration({
    showBorders: true, hideOpenings: false, filtersSupported: false, forcedColors: false,
  }), {
    structural: true, panels: true, shadows: false, materialNuance: true, floorSymbols: false,
  });
  assert.deepEqual(resolveIsoDecoration({
    showBorders: false, hideOpenings: false, filtersSupported: true, forcedColors: false,
  }), {
    structural: false, panels: false, shadows: false, materialNuance: false, floorSymbols: true,
  });
  assert.equal(resolveIsoDecoration({
    showBorders: true, hideOpenings: true, filtersSupported: true, forcedColors: false,
  }).panels, false);
});
