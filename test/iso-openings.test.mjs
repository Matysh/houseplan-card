import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ISO_OPENING_FRAME_THICKNESS_RATIO, ISO_OPENING_GEOMETRY_POLICY,
  ISO_OPENING_LEAF_THICKNESS_RATIO,
  buildIsoOpeningBasis, isoOpeningBounds, projectIsoOpening,
  projectIsoOpeningStructure, resolveIsoDecoration,
} from '../test-build/iso-openings.js';
import { openingAmount } from '../test-build/logic.js';
import { ISO_WALL_HEIGHT, projectPlanPoint } from '../test-build/iso-projection.js';

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
  assert.deepEqual(basis.leaves[0].hinge, basis.face.selectedStart,
    'the derived volume pivots on the selected physical wall face, not inside masonry');
  assert.equal(basis.leaves[0].top, ISO_WALL_HEIGHT * 0.92);
  assert.equal(basis.leaves[0].turnDeg, -50);
});

test('Stage 4 basis freezes the real axis, physical face depth and jamb endpoints', () => {
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
  assert.equal(basis.leafThickness, ISO_WALL_HEIGHT * ISO_OPENING_LEAF_THICKNESS_RATIO);
  assert.equal(basis.frameThickness, ISO_WALL_HEIGHT * ISO_OPENING_FRAME_THICKNESS_RATIO);

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

test('window separates neutral fixed/sash frames from blue glass above the sill', () => {
  const basis = buildIsoOpeningBasis(opening({ type: 'window' }));
  assert.deepEqual(basis.windowProfile, {
    frameBottom: ISO_WALL_HEIGHT * 0.38,
    frameTop: ISO_WALL_HEIGHT,
    sashBottom: ISO_WALL_HEIGHT * 0.40,
    sashTop: ISO_WALL_HEIGHT * 0.98,
    glassBottom: ISO_WALL_HEIGHT * 0.45,
    glassTop: ISO_WALL_HEIGHT * 0.93,
    member: ISO_WALL_HEIGHT * 0.05,
  });
  const structure = projectIsoOpeningStructure(basis);
  assert.equal(structure.filter((surface) => surface.kind === 'jamb-reveal').length, 2);
  assert.equal(structure.filter((surface) => surface.kind === 'window-frame-side').length, 4);
  assert.equal(structure.filter((surface) => surface.kind === 'window-frame-top').length, 2);
  assert.equal(structure.filter((surface) => surface.kind === 'window-sill').length, 1);
  assert.equal(structure.filter((surface) => surface.kind.startsWith('window-'))
    .every((surface) => ['light-frame', 'light-sill'].includes(surface.material)), true);

  const panels = projectIsoOpening(basis, 0.5);
  assert.equal(panels.length, 2);
  assert.equal(panels.every((panel) => panel.material === 'light-window'
    && panel.thickness === 0
    && panel.surfaces.length === 7
    && panel.surfaces.filter((surface) => surface.material === 'light-frame').length === 4
    && panel.surfaces.filter((surface) => surface.material === 'glass-side').length === 2
    && panel.surfaces.filter((surface) => surface.material === 'glass-top').length === 1), true);
  assert.equal(panels.flatMap((panel) => panel.surfaces)
    .filter((surface) => surface.material.startsWith('glass'))
    .every((surface) => ['window-glass', 'window-glass-top'].includes(surface.kind)), true);
});

test('live projection is O(leaves)-only and cannot mutate the structural Stage 4 basis', () => {
  const basis = buildIsoOpeningBasis(opening({ type: 'gate', flipV: true }));
  const snapshot = structuredClone(basis);
  const structure = projectIsoOpeningStructure(basis);
  const closed = projectIsoOpening(basis, 0);
  const open = projectIsoOpening(basis, 1);
  assert.notDeepEqual(open.map((panel) => panel.surfaces), closed.map((panel) => panel.surfaces));
  assert.deepEqual(projectIsoOpeningStructure(basis), structure);
  assert.deepEqual(basis, snapshot);
});

test('window and gate retain two leaves with reviewed height and turn policies', () => {
  const windowBasis = buildIsoOpeningBasis(opening({ type: 'window' }));
  const gateBasis = buildIsoOpeningBasis(opening({ type: 'gate', flipV: true }));
  assert.equal(windowBasis.leaves.length, 2);
  assert.equal(ISO_OPENING_GEOMETRY_POLICY.revision, 3);
  assert.equal(windowBasis.leaves.every((leaf) => leaf.bottom === ISO_WALL_HEIGHT * 0.40
    && leaf.top === ISO_WALL_HEIGHT * 0.98 && Math.abs(leaf.turnDeg) === 65), true);
  assert.deepEqual(gateBasis.leaves.map((leaf) => Math.abs(leaf.turnDeg)), [10, 10]);
  assert.equal(gateBasis.leaves.every((leaf) => leaf.top === ISO_WALL_HEIGHT * 0.88), true);
  assert.equal(projectIsoOpening(gateBasis, 1).length, 2);
});

test('paired window leaves open toward their resolved exterior face in every orientation', () => {
  for (const angle of [0, 90, 180, 270, 37]) {
    const radians = angle * Math.PI / 180;
    const normal = [-Math.sin(radians), Math.cos(radians)];
    for (const flipV of [false, true]) for (const flipH of [false, true]) {
      const side = flipV ? 1 : -1;
      const basis = buildIsoOpeningBasis(opening({
        type: 'window', angle, flipV, flipH,
        face: { ox: normal[0] * side * 5, oy: normal[1] * side * 5, cm: 20, side },
      }));
      for (const leaf of basis.leaves) {
        const turn = leaf.turnDeg * Math.PI / 180;
        const swingNormal = (leaf.quarterVector[0] * Math.sin(turn)) * normal[0]
          + (leaf.quarterVector[1] * Math.sin(turn)) * normal[1];
        assert.ok(swingNormal * side > 0,
          `angle=${angle} flipH=${flipH} flipV=${flipV} leaf=${leaf.leaf}`);
      }
    }
  }
});

test('isometric door and gate volumes follow the selected host face without changing saved axes', () => {
  const selected = buildIsoOpeningBasis(opening());
  const oppositeResolvedFace = buildIsoOpeningBasis(opening({
    face: { ox: 0, oy: -5, side: -1 },
  }));
  assert.deepEqual(selected.axis, oppositeResolvedFace.axis,
    'the saved centreline axis remains canonical');
  assert.deepEqual(selected.leaves[0].hinge, selected.face.selectedStart);
  assert.deepEqual(oppositeResolvedFace.leaves[0].hinge,
    oppositeResolvedFace.face.selectedStart);
  assert.notDeepEqual(oppositeResolvedFace.leaves, selected.leaves,
    'the derived volume moves to the resolved physical face');

  const flippedPositive = buildIsoOpeningBasis(opening({ flipV: true }));
  const flippedNegative = buildIsoOpeningBasis(opening({
    flipV: true, face: { ox: 0, oy: -5, side: -1 },
  }));
  assert.deepEqual(flippedPositive.leaves[0].hinge, flippedPositive.face.selectedStart);
  assert.deepEqual(flippedNegative.leaves[0].hinge, flippedNegative.face.selectedStart);
  assert.deepEqual(flippedPositive.leaves[0].closedVector, selected.leaves[0].closedVector);
  assert.equal(
    flippedPositive.leaves[0].quarterVector[1],
    -selected.leaves[0].quarterVector[1],
    'flip mirrors the opening direction without moving its origin',
  );

  const gate = buildIsoOpeningBasis(opening({ type: 'gate' }));
  const gateFlipped = buildIsoOpeningBasis(opening({
    type: 'gate', flipV: true, face: { ox: 0, oy: -5, side: -1 },
  }));
  assert.equal(gate.leaves[0].hinge[1], 85);
  assert.equal(gateFlipped.leaves[0].hinge[1], 75);
  assert.deepEqual(gate.leaves.map((leaf) => leaf.turnDeg), [10, -10]);
  assert.deepEqual(gateFlipped.leaves.map((leaf) => leaf.turnDeg), [-10, 10]);
  assert.notDeepEqual(
    projectIsoOpening(gate, 1).map((panel) => panel.d),
    projectIsoOpening(gateFlipped, 1).map((panel) => panel.d),
    'flip changes both the selected face and outward turn',
  );
});

test('door and gate face matrix keeps every live state on the selected physical hinge', () => {
  for (const type of ['door', 'gate']) {
    for (const angle of [0, 90, 37]) {
      const radians = angle * Math.PI / 180;
      const normal = [-Math.sin(radians), Math.cos(radians)];
      for (const side of [-1, 1]) {
        for (const flipH of [false, true]) {
          const basis = buildIsoOpeningBasis(opening({
            type, angle, flipH,
            face: { ox: normal[0] * 5 * side, oy: normal[1] * 5 * side, side },
          }));
          for (const leaf of basis.leaves) {
            const expected = flipH
              ? leaf.leaf === 0 ? basis.face.selectedEnd : basis.face.selectedStart
              : leaf.leaf === 0 ? basis.face.selectedStart : basis.face.selectedEnd;
            assert.deepEqual(leaf.hinge, expected,
              `${type} angle=${angle} side=${side} flipH=${flipH} leaf=${leaf.leaf}`);
          }
          for (const amount of [0, 0.5, 1]) {
            const panels = projectIsoOpening(basis, amount);
            assert.equal(panels.length, basis.leaves.length);
            assert.ok(panels.every((panel) => panel.surfaces.length === 5
              && panel.surfaces.every((surface) => Number.isFinite(surface.depth)
                && Number.isFinite(surface.cameraDepth)
                && !/NaN|Infinity/.test(surface.d))),
            `${type} angle=${angle} side=${side} flipH=${flipH} amount=${amount}`);
          }
        }
      }
    }
  }
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
    hinge: [70, 85], closedVector: [60, 0], quarterVector: [0, 60],
  });
  assert.deepEqual(signature(horizontal), {
    hinge: [130, 85], closedVector: [-60, 0], quarterVector: [0, 60],
  });
  assert.deepEqual(signature(vertical), {
    hinge: [70, 85], closedVector: [60, 0], quarterVector: [0, -60],
  });
  assert.deepEqual(signature(both), {
    hinge: [130, 85], closedVector: [-60, 0], quarterVector: [0, -60],
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
