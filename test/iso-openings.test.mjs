import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ISO_OPENING_FRAME_THICKNESS_RATIO, ISO_OPENING_LEAF_THICKNESS_RATIO,
  buildIsoOpeningBasis, isoOpeningBounds, projectIsoOpening,
  projectIsoOpeningStructure, resolveIsoDecoration,
} from '../test-build/iso-openings.js';
import { openingAmount } from '../test-build/logic.js';
import { projectPlanPoint } from '../test-build/iso-projection.js';

const opening = (patch = {}) => ({
  id: 'op-1', sourceIndex: 0, type: 'door', x: 100, y: 80,
  angle: 0, length: 60, flipH: false, flipV: false,
  face: { ox: 0, oy: 5, cm: 20, side: 1 }, ...patch,
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

test('Stage 3 basis freezes the real axis, physical face depth and jamb endpoints', () => {
  const basis = buildIsoOpeningBasis(opening());
  assert.equal(Object.isFrozen(basis), true);
  assert.equal(Object.isFrozen(basis.axis), true);
  assert.equal(Object.isFrozen(basis.face), true);
  assert.equal(Object.isFrozen(basis.reveals), true);
  assert.equal(Object.isFrozen(basis.axis.start), true);
  assert.deepEqual(basis.axis, {
    center: [100, 80],
    tangent: [1, 0],
    normal: [0, 1],
    start: [70, 80],
    end: [130, 80],
  });
  assert.deepEqual(basis.face, {
    side: 1,
    cm: 20,
    depth: 10,
    offset: [0, 5],
    selectedStart: [70, 85],
    selectedEnd: [130, 85],
    oppositeStart: [70, 75],
    oppositeEnd: [130, 75],
  });
  assert.deepEqual(basis.reveals, [
    { jamb: 0, center: [70, 80], selected: [70, 85], opposite: [70, 75] },
    { jamb: 1, center: [130, 80], selected: [130, 85], opposite: [130, 75] },
  ]);
  assert.equal(basis.leafThickness, 64 * ISO_OPENING_LEAF_THICKNESS_RATIO);
  assert.equal(basis.frameThickness, 64 * ISO_OPENING_FRAME_THICKNESS_RATIO);

  const rotated = buildIsoOpeningBasis(opening({
    angle: 90,
    face: { ox: -5, oy: 0, cm: 20, side: 1 },
  }));
  assert.ok(Math.abs(rotated.axis.start[0] - 100) < 1e-9);
  assert.ok(Math.abs(rotated.axis.start[1] - 50) < 1e-9);
  assert.ok(Math.abs(rotated.axis.end[0] - 100) < 1e-9);
  assert.ok(Math.abs(rotated.axis.end[1] - 110) < 1e-9);
  assert.equal(rotated.face.depth, 10);
});

test('door and gate expose matte fixed-thickness leaf prisms plus real jamb reveals', () => {
  for (const type of ['door', 'gate']) {
    const basis = buildIsoOpeningBasis(opening({ type }));
    const structure = projectIsoOpeningStructure(basis);
    assert.equal(Object.isFrozen(structure), true);
    assert.equal(structure.filter((surface) => surface.kind === 'jamb-reveal').length, 2);
    assert.equal(structure.every((surface) => surface.material === 'reveal'), true);
    assert.deepEqual(
      structure.filter((surface) => surface.kind === 'jamb-reveal')
        .map((surface) => surface.jamb).sort(),
      [0, 1],
    );

    const panels = projectIsoOpening(basis, 0.5);
    assert.equal(panels.length, type === 'gate' ? 2 : 1);
    for (const panel of panels) {
      assert.equal(panel.material, 'matte-leaf');
      assert.equal(panel.thickness, basis.leafThickness);
      assert.equal(Object.isFrozen(panel), true);
      assert.equal(Object.isFrozen(panel.surfaces), true);
      assert.equal(panel.surfaces.filter((surface) => surface.kind === 'leaf-front').length, 1);
      assert.equal(panel.surfaces.filter((surface) => surface.kind === 'leaf-back').length, 1);
      assert.deepEqual(
        panel.surfaces.filter((surface) => surface.kind === 'leaf-edge')
          .map((surface) => surface.edge).sort(),
        ['hinge', 'tip'],
      );
      assert.equal(panel.surfaces.filter((surface) => surface.kind === 'leaf-top').length, 1);
      assert.equal(panel.surfaces.every((surface) => surface.material === 'matte-leaf'), true);
    }
  }
});

test('window has only light inserts, frame and sill surfaces and no dark glass material', () => {
  const basis = buildIsoOpeningBasis(opening({ type: 'window' }));
  const structure = projectIsoOpeningStructure(basis);
  assert.equal(structure.filter((surface) => surface.kind === 'jamb-reveal').length, 2);
  assert.equal(structure.filter((surface) => surface.kind === 'window-frame-side').length, 4);
  assert.equal(structure.filter((surface) => surface.kind === 'window-frame-top').length, 2);
  assert.equal(structure.filter((surface) => surface.kind === 'window-sill').length, 1);
  assert.equal(structure.some((surface) => /glass|dark/i.test(surface.material)), false);
  assert.equal(structure.filter((surface) => surface.kind.startsWith('window-'))
    .every((surface) => ['light-frame', 'light-sill'].includes(surface.material)), true);

  const panels = projectIsoOpening(basis, 0.5);
  assert.equal(panels.length, 2);
  assert.equal(panels.every((panel) => panel.material === 'light-window'
    && panel.thickness === 0
    && panel.surfaces.length === 1
    && panel.surfaces[0].kind === 'window-insert'
    && panel.surfaces[0].material === 'light-window'), true);
});

test('live projection is O(leaves)-only and cannot mutate the structural Stage 3 basis', () => {
  const basis = buildIsoOpeningBasis(opening({ type: 'gate', flipV: true }));
  const snapshot = structuredClone(basis);
  const structure = projectIsoOpeningStructure(basis);
  const closed = projectIsoOpening(basis, 0);
  const open = projectIsoOpening(basis, 1);
  assert.notDeepEqual(open.map((panel) => panel.surfaces), closed.map((panel) => panel.surfaces));
  assert.deepEqual(projectIsoOpeningStructure(basis), structure);
  assert.deepEqual(basis, snapshot);
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
  assert.deepEqual(passageBasis.reveals, []);
  assert.deepEqual(projectIsoOpening(passageBasis, 0), []);
  assert.deepEqual(projectIsoOpening(passageBasis, 1), []);
  assert.deepEqual(projectIsoOpeningStructure(passageBasis), []);
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

test('flipH and flipV independently mirror their exact structural axes', () => {
  const normal = buildIsoOpeningBasis(opening());
  const horizontal = buildIsoOpeningBasis(opening({ flipH: true }));
  const vertical = buildIsoOpeningBasis(opening({ flipV: true }));
  const both = buildIsoOpeningBasis(opening({ flipH: true, flipV: true }));
  const signature = (basis) => {
    const leaf = basis.leaves[0];
    const clean = (point) => point.map((value) => Math.abs(value) < 1e-9 ? 0 : value);
    return {
      hinge: clean(leaf.hinge),
      closedVector: clean(leaf.closedVector),
      quarterVector: clean(leaf.quarterVector),
    };
  };
  assert.deepEqual(signature(normal), {
    hinge: [70, 80], closedVector: [60, 0], quarterVector: [0, 60],
  });
  assert.deepEqual(signature(horizontal), {
    hinge: [130, 80], closedVector: [-60, 0], quarterVector: [0, 60],
  });
  assert.deepEqual(signature(vertical), {
    hinge: [70, 80], closedVector: [60, 0], quarterVector: [0, -60],
  });
  assert.deepEqual(signature(both), {
    hinge: [130, 80], closedVector: [-60, 0], quarterVector: [0, -60],
  });
});

test('HA state changes only projected leaves', () => {
  const normal = buildIsoOpeningBasis(opening());
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
    structural: true, panels: true, shadows: false, materialNuance: false, floorSymbols: false,
  });
  assert.deepEqual(resolveIsoDecoration({
    showBorders: true, hideOpenings: false, filtersSupported: true, forcedColors: true,
  }), {
    structural: true, panels: true, shadows: false, materialNuance: false, floorSymbols: false,
  });
  assert.deepEqual(resolveIsoDecoration({
    showBorders: false, hideOpenings: false, filtersSupported: true, forcedColors: false,
  }), {
    structural: false, panels: false, shadows: false, materialNuance: false, floorSymbols: true,
  });
  assert.deepEqual(resolveIsoDecoration({
    showBorders: true, hideOpenings: true, filtersSupported: true, forcedColors: false,
  }), {
    structural: true, panels: false, shadows: true, materialNuance: true, floorSymbols: false,
  });
});
