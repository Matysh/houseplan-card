import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPdfPage } from '../test-build/pdf/pdf-scene.js';
import { pdfCommandBounds, pdfSceneFits } from '../test-build/pdf/pdf-layout.js';
import {
  dedupeOppositeDimensionEdges, dimensionEpsilonUnits, stableDimensionEdges,
} from '../test-build/pdf/pdf-dimensions.js';
import { makeLargeHouseFixture } from '../demo/fixtures/large-house.mjs';
import { fixtureWallKey } from '../demo/fixtures/wall-key.mjs';
import { floorMinusBodies, geometryArea, physicalBodyParts } from '../test-build/physical-geometry.js';
import {
  geometryOpenings, geometryPartitionOpeningCuts, geometryRoomOpeningInputs,
} from '../test-build/plan-geometry-preflight.js';
import { spaceModels, GRID_PITCH, GRID_STEP_N, NORM_W } from '../test-build/space-geometry.js';
import { innerContourForRoom, wallBodiesGeometry } from '../test-build/wall-thickness.js';
import { resolveZeroWalls } from '../test-build/zero-walls.js';

const MM = 72 / 25.4;
const WALL_FILL = [127 / 255, 127 / 255, 127 / 255];
const PDF_SCALES = [20, 25, 50, 75, 100, 150, 200, 250, 500];

const rawSpace = {
  id: 'ground', title: 'Первый этаж', cell_cm: 5, view_box: [0, 0, 1, 1],
  rooms: [{ id: 'room', name: 'Кухня', area: null,
    poly: [[0.1, 0.1], [0.8, 0.1], [0.8, 0.7], [0.1, 0.7]],
    wall_ids: ['top', 'right', 'bottom', 'left'] }],
  walls: [],
  wall_segments: [
    { id: 'top', a: [0.1, 0.1], b: [0.8, 0.1], cm: 0 },
    { id: 'right', a: [0.8, 0.1], b: [0.8, 0.7], cm: 0 },
    { id: 'bottom', a: [0.8, 0.7], b: [0.1, 0.7], cm: 0 },
    { id: 'left', a: [0.1, 0.7], b: [0.1, 0.1], cm: 0 },
  ],
  partitions: [], wall_columns: [], decor: [], settings: {},
  openings: [{ id: 'door', type: 'door', x: 0.45, y: 0.1, angle: 0, length: 0.12 }],
};
const config = { model_version: 9, spaces: [rawSpace], markers: [], settings: {} };
const space = spaceModels(config)[0];
const t = (key, vars) => key === 'pdf.scale' ? `Scale 1:${vars.n}` : key;

const page = (options) => buildPdfPage({
  config, rawSpace, space, layout: {}, options, imperial: false,
  cardTitle: 'House', version: 'test', now: new Date('2026-09-07T00:00:00Z'), t,
});

const sharedRaw = (() => {
  const segments = [
    { id: 'tl', a: [0.1, 0.1], b: [0.5, 0.1], cm: 15 },
    { id: 'mid', a: [0.5, 0.1], b: [0.5, 0.8], cm: 15 },
    { id: 'bl', a: [0.5, 0.8], b: [0.1, 0.8], cm: 15 },
    { id: 'left', a: [0.1, 0.8], b: [0.1, 0.1], cm: 15 },
    { id: 'tr', a: [0.5, 0.1], b: [0.9, 0.1], cm: 15 },
    { id: 'right', a: [0.9, 0.1], b: [0.9, 0.8], cm: 15 },
    { id: 'br', a: [0.9, 0.8], b: [0.5, 0.8], cm: 15 },
  ];
  return {
    id: 'shared', title: 'Shared wall', cell_cm: 5, view_box: [0, 0, 1, 1],
    rooms: [
      { id: 'left-room', name: 'Left', area: null,
        poly: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.8], [0.1, 0.8]],
        wall_ids: ['tl', 'mid', 'bl', 'left'] },
      { id: 'right-room', name: 'Right', area: null,
        poly: [[0.5, 0.1], [0.9, 0.1], [0.9, 0.8], [0.5, 0.8]],
        wall_ids: ['tr', 'right', 'br', 'mid'] },
    ],
    wall_segments: segments,
    walls: segments.map((segment) => ({
      key: fixtureWallKey(segment.a, segment.b), cm: segment.cm,
      a: segment.a, b: segment.b,
    })),
    openings: [], partitions: [], wall_columns: [], decor: [], settings: {},
  };
})();

const sharedPage = (options, extra = {}) => {
  const sharedConfig = {
    model_version: 10, spaces: [sharedRaw],
    markers: [{ id: 'secret-device-marker', binding: 'entity:light.secret' }], settings: {},
  };
  return buildPdfPage({
    config: sharedConfig, rawSpace: sharedRaw, space: spaceModels(sharedConfig)[0], layout: {},
    options, imperial: false, cardTitle: 'House', version: 'test',
    now: new Date('2026-09-07T00:00:00Z'), t, ...extra,
  });
};

const buildRawPage = (raw, options, {
  settings = {}, translator = t, layout = {}, ...extra
} = {}) => {
  const localConfig = { model_version: 10, spaces: [raw], markers: [], settings };
  return buildPdfPage({
    config: localConfig, rawSpace: raw, space: spaceModels(localConfig)[0], layout,
    options, imperial: false, cardTitle: 'House', version: 'test',
    now: new Date('2026-09-07T00:00:00Z'), t: translator, ...extra,
  });
};

const commandBox = (command) => command.rings.flat().reduce((box, [x, y]) => ({
  minX: Math.min(box.minX, x), minY: Math.min(box.minY, y),
  maxX: Math.max(box.maxX, x), maxY: Math.max(box.maxY, y),
}), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

const pointInRing = ([x, y], ring) => {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

const pointInEvenOddPath = (point, rings) => rings.reduce(
  (inside, ring) => inside !== pointInRing(point, ring), false,
);

const assertFitsAndIsCentered = (output) => {
  const tolerance = 0.5 * MM + 1e-8;
  assert.ok(output.sceneBounds.minX >= output.planField.minX - tolerance);
  assert.ok(output.sceneBounds.minY >= output.planField.minY - tolerance);
  assert.ok(output.sceneBounds.maxX <= output.planField.maxX + tolerance);
  assert.ok(output.sceneBounds.maxY <= output.planField.maxY + tolerance);
  const sceneCenterX = (output.sceneBounds.minX + output.sceneBounds.maxX) / 2;
  const sceneCenterY = (output.sceneBounds.minY + output.sceneBounds.maxY) / 2;
  const fieldCenterX = (output.planField.minX + output.planField.maxX) / 2;
  const fieldCenterY = (output.planField.minY + output.planField.maxY) / 2;
  assert.ok(Math.abs(sceneCenterX - fieldCenterX) <= tolerance,
    'the complete scene is horizontally centered in the plan field');
  assert.ok(Math.abs(sceneCenterY - fieldCenterY) <= tolerance,
    'the complete scene is vertically centered in the plan field');
};

const boxesOverlap = (a, b) => a.minX < b.maxX && a.maxX > b.minX
  && a.minY < b.maxY && a.maxY > b.minY;

const polygonRaw = (id, poly, { cellCm = 5, wallCm = 15, name = id } = {}) => {
  const wallSegments = poly.map((a, index) => ({
    id: `${id}-wall-${index}`, a, b: poly[(index + 1) % poly.length], cm: wallCm,
  }));
  return {
    id, title: id, cell_cm: cellCm, view_box: [0, 0, 2, 2],
    rooms: [{ id: `${id}-room`, name, area: null, poly,
      wall_ids: wallSegments.map((wall) => wall.id) }],
    walls: wallSegments.map((wall) => ({
      key: fixtureWallKey(wall.a, wall.b), cm: wall.cm, a: wall.a, b: wall.b,
    })),
    wall_segments: wallSegments, openings: [], partitions: [],
    wall_columns: [], decor: [], settings: {},
  };
};

test('PDF scene includes architecture and respects names/dimensions switches', () => {
  const full = page({ dimensions: true, roomNames: true, decor: false, backdrop: false });
  const minimal = page({ dimensions: false, roomNames: false, decor: false, backdrop: false });
  const fullText = full.commands.filter((command) => command.kind === 'text').map((command) => command.text);
  const minimalText = minimal.commands.filter((command) => command.kind === 'text').map((command) => command.text);
  assert.ok(fullText.includes('Кухня'));
  assert.ok(fullText.some((value) => /m²/.test(value)));
  assert.ok(!minimalText.includes('Кухня'));
  assert.ok(!minimalText.some((value) => /m²/.test(value)));
  assert.ok(!minimalText.some((value) => value !== '1 m'
    && /^[-+]?\d+(?:[.,]\d+)?\s(?:m|cm|ft|in)$/.test(value)));
  assert.ok(full.commands.some((command) => command.kind === 'line' && command.dash),
    'zero-thickness walls stay dashed');
  assert.ok(!full.commands.some((command) => command.kind === 'path'),
    'a valid zero-wall-only space does not receive a second solid contour fallback');
  assert.ok(full.commands.some((command) => command.kind === 'line' && !command.dash),
    'door leaf/arc is represented by vector lines');
});

test('shared wall architecture is emitted once and devices never enter the PDF scene', () => {
  const output = sharedPage({ dimensions: false, roomNames: false, decor: false, backdrop: false });
  const architecture = output.commands.filter((command) => command.kind === 'path');
  assert.equal(architecture.length, 1);
  assert.ok(!output.commands.some((command) => command.kind === 'text'
    && command.text.includes('secret-device-marker')));
});

test('dimensions switch removes the external chain from physical walls', () => {
  const texts = (dimensions) => sharedPage({
    dimensions, roomNames: false, decor: false, backdrop: false,
  }).commands.filter((command) => command.kind === 'text').map((command) => command.text)
    .filter((value) => value !== '1 m' && /^[-+]?\d+(?:[.,]\d+)?\s(?:m|cm|ft|in)$/.test(value));
  assert.ok(texts(true).length > 0, 'the thick outer wall has a dimension chain');
  assert.deepEqual(texts(false), [], 'the option removes every dimension value');
});

test('stepped exterior keeps the complete reconstructable dimension chain', () => {
  const step = [
    [0.1, 0.1], [0.7, 0.1], [0.7, 0.3], [0.8, 0.3],
    [0.8, 0.6], [0.7, 0.6], [0.7, 0.9], [0.1, 0.9],
  ];
  const externalLabels = (poly) => {
    const raw = polygonRaw('stepped', poly, { cellCm: 5, wallCm: 15, name: '' });
    const output = buildRawPage(raw,
      { dimensions: true, roomNames: false, decor: false, backdrop: false });
    const architecture = output.commands.find((command) => command.kind === 'path' && command.fill);
    assert.ok(architecture, 'the stepped physical wall body reaches the PDF scene');
    const box = commandBox(architecture);
    const inPlanField = (command) => command.x >= output.planField.minX
      && command.x <= output.planField.maxX && command.y >= output.planField.minY
      && command.y <= output.planField.maxY;
    const outsideWallBox = (command) => command.x < box.minX || command.x > box.maxX
      || command.y < box.minY || command.y > box.maxY;
    return output.commands.filter((command) => command.kind === 'text'
      && /^\d+(?:[.,]\d+)?\s*(?:m|cm)$/.test(command.text)
      && inPlanField(command) && outsideWallBox(command));
  };

  for (const poly of [step, [...step].reverse()]) {
    const labels = externalLabels(poly);
    const values = labels.map((command) => command.text);
    for (const required of ['1.20 m', '2.40 m', '3.60 m', '3.75 m']) {
      assert.ok(values.includes(required),
        `${required} remains in the reconstructable protrusion chain`);
    }
    assert.equal(values.filter((value) => value === '1.20 m').length, 1,
      'the equal upper/lower protrusion depths are locally deduplicated');
    assert.equal(values.length, 6,
      'the four protrusion dimensions coexist with the overall width and height');
    assert.ok(labels.every((command) => Math.abs(command.angle % 90) < 1e-8),
      'the exterior chain contains no diagonal labels');
  }
});

test('backdrop is below physical architecture and disappears with its option', () => {
  const raster = {
    id: 'backdrop', bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    width: 1, height: 1, x: 0, y: 0, drawWidth: 1000, drawHeight: 1000,
    opacity: 0.6,
  };
  const visible = sharedPage(
    { dimensions: false, roomNames: false, decor: false, backdrop: true },
    { rasters: [raster] },
  );
  const imageIndex = visible.commands.findIndex((command) => command.kind === 'image');
  const wallIndex = visible.commands.findIndex((command) => command.kind === 'path');
  assert.ok(imageIndex >= 0 && wallIndex > imageIndex);
  assert.ok(!sharedPage({ dimensions: false, roomNames: false, decor: false, backdrop: false })
    .commands.some((command) => command.kind === 'image'));
});

test('physical bodies use exact grey, page-anchored 45 degree hatch and leave zero walls unfilled', () => {
  const materialRaw = structuredClone(sharedRaw);
  materialRaw.id = 'materials';
  materialRaw.title = 'Materials';
  materialRaw.view_box = [0, 0, 3, 1];
  materialRaw.partitions = [{ id: 'partition', a: [1.1, 0.2], b: [1.5, 0.2], cm: 12 }];
  materialRaw.wall_columns = [
    { id: 'square-column', shape: 'square', center: [1.9, 0.3], cm: 35, angle: 30 },
    { id: 'round-column', shape: 'circle', center: [2.3, 0.3], cm: 40 },
  ];
  const zeroPoly = [[2.55, 0.1], [2.8, 0.1], [2.8, 0.4], [2.55, 0.4]];
  const zeroWalls = zeroPoly.map((a, index) => ({
    id: `zero-${index}`, a, b: zeroPoly[(index + 1) % zeroPoly.length], cm: 0,
  }));
  materialRaw.rooms.push({
    id: 'zero-room', name: 'Zero', area: null, poly: zeroPoly,
    wall_ids: zeroWalls.map((wall) => wall.id),
  });
  materialRaw.wall_segments.push(...zeroWalls);

  const output = buildRawPage(materialRaw,
    { dimensions: false, roomNames: false, decor: false, backdrop: false });
  const materialPaths = output.commands.filter((command) => command.kind === 'path' && command.fill);
  assert.ok(materialPaths.length > 0, 'walls, partition and both column shapes form physical bodies');
  for (const command of materialPaths) {
    assert.deepEqual(command.fill, WALL_FILL);
    assert.ok(command.hatch, 'every physical body has hatch metadata');
    assert.ok(Math.abs(command.hatch.width - 0.18 * MM) < 1e-10);
    assert.ok(command.hatch.lines.length > 2);
    for (const [a, b] of command.hatch.lines) {
      assert.ok(Math.abs((b[0] - a[0]) - (b[1] - a[1])) < 1e-8,
        'hatch lines stay at 45 degrees in paper coordinates');
      assert.equal(a[1], 0, 'hatch phase is anchored at the page top, not each body');
      assert.equal(b[1], output.height, 'hatch spans the complete page before clipping');
    }
    const hatchStep = command.hatch.lines[1][0][0] - command.hatch.lines[0][0][0];
    assert.ok(Math.abs(hatchStep - 3 * MM * Math.SQRT2) < 1e-8,
      'perpendicular hatch spacing is exactly 3 mm');
  }
  const zeroLines = output.commands.filter((command) => command.kind === 'line' && command.dash);
  assert.equal(zeroLines.length, 4, 'the zero-thickness room remains four dashed lines');
});

test('wall fill and even-odd hatch clipping preserve a clean opening tunnel', () => {
  const closed = sharedPage({ dimensions: false, roomNames: false, decor: false, backdrop: false });
  const openedRaw = structuredClone(sharedRaw);
  openedRaw.openings = [{
    id: 'middle-door', type: 'door', x: 0.5, y: 0.45, angle: 90, length: 0.2,
  }];
  const opened = buildRawPage(openedRaw,
    { dimensions: false, roomNames: false, decor: false, backdrop: false });
  const closedWall = closed.commands.find((command) => command.kind === 'path' && command.fill);
  const openedWall = opened.commands.find((command) => command.kind === 'path' && command.fill);
  assert.ok(closedWall && openedWall);
  const openedBox = commandBox(openedWall);
  const tunnelCenter = [
    (openedBox.minX + openedBox.maxX) / 2,
    (openedBox.minY + openedBox.maxY) / 2,
  ];
  assert.equal(pointInEvenOddPath(tunnelCenter, closedWall.rings), true,
    'the shared wall is solid before an opening is projected');
  assert.equal(pointInEvenOddPath(tunnelCenter, openedWall.rings), false,
    'the opening is a real even-odd hole, so neither fill nor clipped hatch enters the tunnel');
});

test('dimension dedupe is local: opposite sides collapse but equal dimensions in both rooms survive', () => {
  const output = sharedPage({ dimensions: true, roomNames: false, decor: false, backdrop: false });
  const counts = new Map();
  for (const command of output.commands.filter((candidate) => candidate.kind === 'text')) {
    counts.set(command.text, (counts.get(command.text) || 0) + 1);
  }
  assert.equal(counts.get('8.55 m'), 1, 'one exterior vertical dimension remains');
  assert.equal(counts.get('9.75 m'), 1, 'one exterior horizontal dimension remains');
  assert.equal(counts.get('8.25 m'), 2, 'equal vertical values in separate rooms are not globally deduped');
  assert.equal(counts.get('4.65 m'), 2, 'equal horizontal values in separate rooms are not globally deduped');
});

test('whole dimension lane keeps grouped labels centered with 1 mm clearance and no tangent jitter', () => {
  const laneRaw = polygonRaw('lane', [
    [0.1, 0.1], [0.9, 0.1], [0.9, 0.3],
    [0.5, 0.3], [0.5, 0.9], [0.1, 0.9],
  ], { wallCm: 0, name: 'COLLISION LABEL' });
  const options = { dimensions: true, roomNames: true, decor: false, backdrop: false };
  const build = (y) => buildRawPage(laneRaw, options, {
    layout: { 'rl_lane-room': { s: 'lane', x: 0.7, y } },
  });
  const control = build(0.20);
  const collision = build(0.27);

  const placements = (output) => {
    const labels = output.commands.filter((command) => command.kind === 'text'
      && command.text === '4.80 m').sort((a, b) => a.x - b.x);
    const walls = output.commands.filter((command) => command.kind === 'line' && command.dash
      && Math.abs(command.points[0][1] - command.points.at(-1)[1]) < 1e-8);
    assert.equal(labels.length, 2, 'both equal-length horizontal edges remain dimensioned');
    return labels.map((label) => {
      const wall = walls.reduce((nearest, candidate) => {
        const midpoint = (candidate.points[0][0] + candidate.points.at(-1)[0]) / 2;
        const distance = Math.abs(midpoint - label.x);
        return !nearest || distance < nearest.distance ? { candidate, distance } : nearest;
      }, null);
      assert.ok(wall && wall.distance < 1e-8,
        'the dimension label stays centered on its own edge without tangent drift');
      const box = pdfCommandBounds([label]);
      return {
        label,
        box,
        clearance: wall.candidate.points[0][1] - box.maxY,
      };
    });
  };

  const controlPlacements = placements(control);
  const collisionPlacements = placements(collision);
  const laneMoves = collisionPlacements.map((entry, index) =>
    entry.clearance - controlPlacements[index].clearance);
  assert.ok(laneMoves[0] >= 3 * MM - 1e-8, 'the collision advances the shared lane');
  assert.ok(Math.abs(laneMoves[0] - laneMoves[1]) < 1e-8,
    'one collision moves every label in the normal group by the same whole-lane amount');
  for (const entry of collisionPlacements) {
    assert.ok(entry.clearance >= MM - 1e-8,
      'every moved label preserves at least 1 mm clearance from its wall');
  }

  const occupied = collision.commands.filter((command) => command.kind === 'text'
    && (command.text === 'COLLISION LABEL' || /m²$/.test(command.text)))
    .map((command) => pdfCommandBounds([command]));
  assert.ok(occupied.length >= 2, 'the fixture includes the room name and area obstacle');
  for (const entry of collisionPlacements) {
    assert.ok(occupied.every((box) => !boxesOverlap(entry.box, box)),
      'the whole-lane move clears room labels without introducing a text collision');
  }
});

test('vertical internal dimension uses the rendered font box and preserves 1 mm wall clearance', () => {
  const verticalRaw = polygonRaw('vertical-clearance', [
    [0.1, 0.1], [0.5, 0.1], [0.5, 0.9], [0.1, 0.9],
  ], { wallCm: 0, name: '' });
  const output = buildRawPage(verticalRaw,
    { dimensions: true, roomNames: false, decor: false, backdrop: false });
  const areaIndex = output.commands.findIndex((command) => command.kind === 'text'
    && /m²$/.test(command.text));
  const label = output.commands.slice(areaIndex + 1).find((command) => command.kind === 'text'
    && command.angle === 90 && /^\d+(?:[.,]\d+)?\sm$/.test(command.text));
  assert.ok(label, 'the fixture emits an internal vertical dimension');
  const walls = output.commands.filter((command) => command.kind === 'line' && command.dash
    && Math.abs(command.points[0][0] - command.points.at(-1)[0]) < 1e-8);
  const wall = walls.reduce((nearest, candidate) => {
    const midpoint = (candidate.points[0][1] + candidate.points.at(-1)[1]) / 2;
    const distance = Math.abs(midpoint - label.y);
    return !nearest || distance < nearest.distance ? { candidate, distance } : nearest;
  }, null);
  assert.ok(wall && wall.distance < 1e-8,
    'the vertical label remains centred on the tangent of its own wall');
  const wallX = wall.candidate.points[0][0];
  const bounds = pdfCommandBounds([label]);
  const clearance = label.x > wallX ? bounds.minX - wallX : wallX - bounds.maxX;
  assert.ok(clearance >= MM - 1e-8,
    `the full ascent/descent box keeps 1 mm from the wall (got ${clearance / MM} mm)`);
});

test('blocked rectangular dimension is omitted instead of using an unsafe text fallback', () => {
  const narrowRaw = polygonRaw('blocked-rectangle', [
    [0.1, 0.1], [0.105, 0.1], [0.105, 0.9], [0.1, 0.9],
  ], { wallCm: 0, name: '' });
  const output = buildRawPage(narrowRaw,
    { dimensions: true, roomNames: false, decor: false, backdrop: false });
  const dimensionValues = output.commands.filter((command) => command.kind === 'text')
    .map((command) => command.text)
    .filter((value) => /^[-+]?\d+(?:[.,]\d+)?\s(?:m|cm|ft|in)$/.test(value));
  assert.ok(!dimensionValues.includes('9.60 m'),
    'a label that cannot fit between the two walls is never printed through them');
  assert.ok(!output.commands.some((command) => command.kind === 'text' && /^R\d+$/.test(command.text)),
    'a rectangle does not invent an ambiguous numbered callout');
});

test('scene dimensions include a near-axis edge but omit true diagonals', () => {
  // The first edge is 0.2456 degrees from horizontal (inside the 0.25 degree
  // contract); the other two edges are genuine diagonals.
  const nearAxisTriangle = polygonRaw('near-axis', [[0.1, 0.1], [0.8, 0.103], [0.5, 0.7]],
    { wallCm: 0 });
  const output = buildRawPage(nearAxisTriangle,
    { dimensions: true, roomNames: false, decor: false, backdrop: false });
  const dimensionLabels = output.commands.filter((command) => command.kind === 'text'
    && command.text !== '1 m' && /^\d+(?:[.,]\d+)?\sm$/.test(command.text));
  assert.deepEqual(dimensionLabels.map(({ text, angle }) => ({ text, angle })),
    [{ text: '8.40 m', angle: 0 }]);
  assert.equal(output.commands.filter((command) => command.kind === 'line' && command.dash).length, 3,
    'all three physical zero-wall edges are still rendered even though diagonals are not dimensioned');
});

test('thick near-axis outer face retains its projected external dimension', () => {
  const thickNearAxis = polygonRaw('thick-near-axis', [
    [0.1, 0.1], [0.8, 0.103], [0.5, 0.7],
  ], { wallCm: 15, name: '' });
  const output = buildRawPage(thickNearAxis,
    { dimensions: true, roomNames: false, decor: false, backdrop: false });
  const values = output.commands.filter((command) => command.kind === 'text')
    .map((command) => command.text);
  assert.ok(values.includes('8.66 m'),
    'the near-axis physical outer face keeps its mandatory projected dimension');
});

test('opposite dedupe keeps the thick near-axis side with a safe external lane', () => {
  const pairedNearAxis = polygonRaw('paired-near-axis', [
    [0.1, 0.1], [0.9, 0.103], [0.9, 0.8], [0.1, 0.8],
  ], { wallCm: 15, name: '' });
  pairedNearAxis.view_box = [0, -0.1, 1, 1];
  pairedNearAxis.wall_columns = [{
    id: 'near-top-obstacle', shape: 'square', center: [0.5, 0.05], cm: 100, angle: 0,
  }];
  const output = buildRawPage(pairedNearAxis,
    { dimensions: true, roomNames: false, decor: false, backdrop: false });
  const external = output.commands.find((command) => command.kind === 'text'
    && command.text === '9.75 m');
  assert.ok(external, 'the paired physical outer face keeps one external dimension');
  assert.ok(external.y > (output.planField.minY + output.planField.maxY) / 2,
    'the side with a clear base lane wins instead of pushing the blocked side far away');
});

test('actual annotated scene bbox selects portrait/landscape, fits and centers at standard scale', () => {
  const wide = polygonRaw('wide', [[0.05, 0.05], [1.85, 0.05], [1.85, 0.15], [0.05, 0.15]],
    { name: 'Wide' });
  const tall = polygonRaw('tall', [[0.05, 0.05], [0.15, 0.05], [0.15, 1.85], [0.05, 1.85]],
    { name: 'Tall' });
  const squareWithFixedAnnotations = polygonRaw('square',
    [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]],
    { wallCm: 0, name: 'Square' });
  const options = { dimensions: true, roomNames: true, decor: false, backdrop: false };
  const widePage = buildRawPage(wide, options);
  const tallPage = buildRawPage(tall, options);
  const squarePage = buildRawPage(squareWithFixedAnnotations, options);

  assert.ok(widePage.width > widePage.height, 'wide annotated scene selects landscape A4');
  assert.ok(tallPage.height > tallPage.width, 'tall annotated scene selects portrait A4');
  assert.ok(squarePage.width > squarePage.height,
    'actual fixed-size annotations break a raw square tie in favour of the better-filled field');
  assert.equal(widePage.scale, 100, 'wide fixture keeps the largest fitting standard scale');
  assert.equal(tallPage.scale, 100, 'tall fixture keeps the largest fitting standard scale');
  assert.ok(PDF_SCALES.includes(widePage.scale) && PDF_SCALES.includes(tallPage.scale));
  assert.ok(widePage.commands.some((command) => command.kind === 'text'
    && command.text === 'Wide'));
  assert.ok(tallPage.commands.some((command) => command.kind === 'text'
    && command.text === 'Tall'));
  assertFitsAndIsCentered(widePage);
  assertFitsAndIsCentered(tallPage);
  assertFitsAndIsCentered(squarePage);
});

// #530 заменяет прежний «unprintable fixed callouts fail closed»: у страницы
// больше нет фиксированного блока, который мог не поместиться. Отказ остаётся
// только там, где не помещается сама архитектура (#53, тест ниже), а подпись,
// которой не хватает места, просто не печатается.
test('#530: a label that cannot fit is dropped, and the page is still produced', () => {
  const dense = polygonRaw('fixed-callout-overflow', [
    [0.1, 0.1], [0.14, 0.1], [0.14, 0.9], [0.128, 0.9],
    [0.128, 0.3], [0.112, 0.3], [0.112, 0.9], [0.1, 0.9],
  ], { wallCm: 0, name: 'X'.repeat(1000) });
  const built = buildRawPage(dense,
    { dimensions: true, roomNames: true, decor: false, backdrop: false });
  const texts = built.commands.filter((command) => command.kind === 'text')
    .map((command) => command.text);
  assert.ok(!texts.some((value) => value.includes('X'.repeat(50))),
    'a name that does not fit inside the room is omitted, not printed through the walls');
  assert.ok(!texts.some((value) => /^R\d+/.test(value)),
    'no numbered callout survives anywhere');
  assert.ok(pdfSceneFits(built.sceneBounds, built.planField, 0.5 * MM),
    'the page still fits its field');
});

test('oversized architecture brackets a larger printable scale and still returns a fitted page', () => {
  const oversized = polygonRaw('fallback-scale', [
    [0, 0], [50, 0], [50, 1], [0, 1],
  ], { wallCm: 0, name: '' });
  const output = buildRawPage(oversized,
    { dimensions: false, roomNames: false, decor: false, backdrop: false });
  assert.ok(output.scale > 500, 'the unbounded-space path selects a larger denominator');
  assert.equal(output.scale % 50, 0, 'fallback denominators retain the established 50-step contract');
  assertFitsAndIsCentered(output);
});

// #530 убрал единственный блок постоянного размера, который мог не поместиться
// на лист. Отказ при этом не исчез: архитектура сама может не влезть ни на одном
// представимом знаменателе — это последний случай, когда листа не будет вовсе.
test('#530: architecture too large for any denominator still fails closed', () => {
  const impossible = polygonRaw('impossible-scale', [
    [0, 0], [50000, 0], [50000, 1], [0, 1],
  ], { wallCm: 0, name: '' });
  assert.throws(() => buildRawPage(impossible,
    { dimensions: false, roomNames: false, decor: false, backdrop: false }),
  /pdf\.failed/, 'a plan that fits at no denominator is refused, not returned clipped');
});

test('rotated raster bounds do not reject the tighter fitting page orientation', () => {
  const rasterRaw = polygonRaw('rotated-raster', [
    [0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.2],
  ], { wallCm: 0, name: '' });
  const raster = {
    id: 'tall-after-rotation', bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    width: 1, height: 1, x: 0, y: 0, drawWidth: 4000, drawHeight: 100, angle: 90,
  };
  const output = buildRawPage(rasterRaw,
    { dimensions: false, roomNames: false, decor: false, backdrop: true },
    { rasters: [raster] });
  assert.ok(output.height > output.width,
    'the 90-degree raster is evaluated as tall and selects portrait A4');
  assert.equal(output.scale, 250,
    'rotated architecture prefilter keeps the tight standard 1:250 candidate');
  assertFitsAndIsCentered(output);
});

test('PDF scene integrates the vector compass and never restores the architectural legend', () => {
  const translationCalls = [];
  const translator = (key, vars) => {
    translationCalls.push(key);
    return key === 'pdf.scale' ? `Scale 1:${vars.n}` : key;
  };
  const options = { dimensions: true, roomNames: true, decor: false, backdrop: false };
  const withoutNorth = buildRawPage(sharedRaw, options, { translator });
  const withNorth = buildRawPage(sharedRaw, options, {
    settings: { north_deg: 90 }, translator,
  });
  assert.equal(withoutNorth.commands.filter((command) => command.kind === 'vector').length, 0);
  const compass = withNorth.commands.filter((command) => command.kind === 'vector');
  assert.equal(compass.length, 1);
  assert.deepEqual(compass[0].fill, [0.08, 0.08, 0.08]);
  assert.equal(compass[0].fillRule, 'evenodd');
  assert.ok(compass[0].ops.filter((operation) => operation.op === 'M').length >= 2,
    'both canonical compass paths reach the scene');
  const texts = withNorth.commands.filter((command) => command.kind === 'text')
    .map((command) => command.text);
  assert.ok(texts.includes('pdf.north'));
  assert.ok(texts.some((value) => value === '2026-09-07 · House Plan vtest'));
  assert.ok(texts.some((value) => value.startsWith('Scale 1:')));
  assert.ok(!texts.some((value) => value.startsWith('pdf.legend.')
    || value.toLowerCase().includes('wall · door · window')));
  assert.ok(!translationCalls.some((key) => key.startsWith('pdf.legend.')),
    'removed legend translations are never requested');
});

// #530. Прежняя редакция требовала обратного: каждое неукороченное ребро
// обязано было сохранить значение — прямо на плане или строкой нумерованного
// столбца сбоку. Столбец стоил целого шага масштаба (124 pt ширины поля) и
// переворачивал лист, а читался отдельно от чертежа; владелец отказался от
// него сознательно. Теперь контракт такой: печатается то, что помещается,
// каждое значение печатается один раз, столбца и меток нет вовсе.
test('#530: dense non-rectangular rooms print what fits, with no callout column', () => {
  const denseRaw = structuredClone(rawSpace);
  denseRaw.id = 'dense';
  denseRaw.title = 'Dense';
  denseRaw.rooms[0].id = 'dense-room';
  denseRaw.rooms[0].name = 'A';
  denseRaw.rooms[0].poly = [
    [0.1, 0.1], [0.14, 0.1], [0.14, 0.9], [0.128, 0.9],
    [0.128, 0.3], [0.112, 0.3], [0.112, 0.9], [0.1, 0.9],
  ];
  denseRaw.wall_segments = denseRaw.rooms[0].poly.map((a, index, ring) => ({
    id: `dense-${index}`, a, b: ring[(index + 1) % ring.length], cm: 0,
  }));
  denseRaw.rooms[0].wall_ids = denseRaw.wall_segments.map((wall) => wall.id);
  denseRaw.openings = [];
  const denseConfig = { model_version: 9, spaces: [denseRaw], markers: [], settings: {} };
  const output = buildPdfPage({
    config: denseConfig, rawSpace: denseRaw, space: spaceModels(denseConfig)[0], layout: {},
    options: { dimensions: true, roomNames: true, decor: false, backdrop: false },
    imperial: false, cardTitle: 'House', version: 'test',
    now: new Date('2026-09-07T00:00:00Z'), t,
  });
  const texts = output.commands.filter((command) => command.kind === 'text')
    .map((command) => command.text);
  assert.ok(!texts.includes('pdf.internal_dimensions'), 'no callout section title');
  assert.ok(!texts.some((value) => /^R\d+$/.test(value)), 'no callout marks on the plan');
  assert.ok(!texts.some((value) => /^R\d+ .+: .+/.test(value)), 'no callout rows');
  const printed = texts.filter((value) => value !== '1 m' && /^\d+(?:[.,]\d+)?\sm$/.test(value));
  assert.ok(printed.length >= 1, 'the dimensions that fit are still printed');
  assert.equal(new Set(printed).size, printed.length,
    'a value is printed once: what used to go to the column is not duplicated on the plan');
});

// #530, свидетель случая владельца: квадратный дом ≈11 м, восемь комнат, три
// непрямоугольные. До правки такой дом печатался 1:100 на альбомном листе с
// десятью метками `R…` и столбцом сбоку — план занимал четверть поля. Тест
// держит три числа разом: масштаб, ориентацию и то, что подписей на плане
// стало БОЛЬШЕ, а не меньше, хотя столбец убрали.
const dachaRaw = (() => {
  const seg = (id, a, b, cm = 15) => ({ id, a, b, cm });
  const segs = [
    seg('n', [0.05, 0.05], [0.95, 0.05]), seg('e', [0.95, 0.05], [0.95, 0.95]),
    seg('s', [0.95, 0.95], [0.05, 0.95]), seg('w', [0.05, 0.95], [0.05, 0.05]),
    seg('h1', [0.05, 0.45], [0.62, 0.45]), seg('v1', [0.62, 0.30], [0.62, 0.95]),
    seg('h2', [0.62, 0.30], [0.95, 0.30]), seg('v2', [0.20, 0.45], [0.20, 0.95]),
    seg('v3', [0.38, 0.45], [0.38, 0.75]), seg('h3', [0.20, 0.75], [0.38, 0.75]),
    seg('h4', [0.62, 0.62], [0.95, 0.62]), seg('v4', [0.78, 0.30], [0.78, 0.62]),
  ];
  return {
    id: 'dacha', title: 'Ground floor', cell_cm: 5, view_box: [0, 0, 1, 1],
    rooms: [
      { id: 'r1', name: 'Kitchen-living room', area: null,
        poly: [[0.05, 0.05], [0.95, 0.05], [0.95, 0.30], [0.62, 0.30], [0.62, 0.45], [0.05, 0.45]],
        wall_ids: ['n', 'e', 'h2', 'v1', 'h1', 'w'] },
      { id: 'r2', name: 'Sauna', area: null,
        poly: [[0.05, 0.45], [0.20, 0.45], [0.20, 0.95], [0.05, 0.95]],
        wall_ids: ['h1', 'v2', 's', 'w'] },
      { id: 'r3', name: 'Guest bathroom', area: null,
        poly: [[0.20, 0.45], [0.38, 0.45], [0.38, 0.75], [0.20, 0.75]],
        wall_ids: ['h1', 'v3', 'h3', 'v2'] },
      { id: 'r4', name: 'Boiler room', area: null,
        poly: [[0.20, 0.75], [0.38, 0.75], [0.38, 0.95], [0.20, 0.95]],
        wall_ids: ['h3', 'v3', 's', 'v2'] },
      { id: 'r5', name: 'Hallway', area: null,
        poly: [[0.38, 0.45], [0.62, 0.45], [0.62, 0.95], [0.38, 0.95]],
        wall_ids: ['h1', 'v1', 's', 'v3'] },
      { id: 'r6', name: 'Under-stair storage closet', area: null,
        poly: [[0.62, 0.30], [0.78, 0.30], [0.78, 0.46], [0.70, 0.46], [0.70, 0.62], [0.62, 0.62]],
        wall_ids: ['h2', 'v4', 'h4', 'v1'] },
      { id: 'r7', name: 'Guest bedroom', area: null,
        poly: [[0.62, 0.62], [0.95, 0.62], [0.95, 0.95], [0.75, 0.95], [0.75, 0.86], [0.62, 0.86]],
        wall_ids: ['h4', 'e', 's', 'v1'] },
      { id: 'r8', name: 'Pantry', area: null,
        poly: [[0.78, 0.30], [0.95, 0.30], [0.95, 0.62], [0.90, 0.62], [0.90, 0.55],
          [0.86, 0.55], [0.86, 0.48], [0.82, 0.48], [0.82, 0.40], [0.78, 0.40]],
        wall_ids: ['h2', 'e', 'h4', 'v4'] },
    ],
    walls: segs.map((wall) => ({
      key: fixtureWallKey(wall.a, wall.b), a: wall.a, b: wall.b, cm: wall.cm,
    })),
    wall_segments: segs, partitions: [], wall_columns: [], decor: [], settings: {},
    openings: [
      { id: 'd1', type: 'door', x: 0.5, y: 0.05, angle: 0, length: 0.06 },
      { id: 'd2', type: 'door', x: 0.5, y: 0.45, angle: 0, length: 0.06 },
      { id: 'w1', type: 'window', x: 0.95, y: 0.75, angle: 90, length: 0.08 },
    ],
  };
})();

test('#530: a square house fills the sheet at the next standard scale, upright', () => {
  const dachaConfig = { model_version: 9, spaces: [dachaRaw], markers: [], settings: {} };
  const output = buildPdfPage({
    config: dachaConfig, rawSpace: dachaRaw, space: spaceModels(dachaConfig)[0], layout: {},
    options: { dimensions: true, roomNames: true, decor: false, backdrop: false },
    imperial: false, cardTitle: 'House', version: 'test',
    now: new Date('2026-09-11T00:00:00Z'), t,
  });
  assert.equal(output.scale, 75, 'the plan is drawn one standard step larger than before (#530)');
  assert.ok(output.width < output.height, 'a square plan goes on an upright sheet');
  const texts = output.commands.filter((command) => command.kind === 'text');
  const values = texts.map((command) => command.text)
    .filter((value) => value !== '1 m' && /^\d+(?:[.,]\d+)?\sm$/.test(value));
  // Замер: 37 значений после правки против 35 до неё, при том что десять из
  // прежних уезжали в столбец. Порог держит «не меньше, чем было».
  assert.ok(values.length >= 36,
    `every value that fits is printed on the drawing itself: ${values.length}`);
  assert.ok(!texts.some((command) => /^R\d+/.test(command.text)), 'no callouts survive');
  // Кегли: внутри плана уменьшены на четверть, хром страницы не тронут.
  const sizes = [...new Set(texts.map((command) => command.size))].sort((a, b) => a - b);
  assert.deepEqual(sizes, [5.25, 6, 6.75, 7, 8, 10, 14],
    'in-plan labels are 5.25/6/6.75, page chrome stays 7/8/10/14');
});

test('decor toggle uses the canonical designer furniture vector path', () => {
  const decorated = structuredClone(rawSpace);
  decorated.decor = [{
    id: 'sofa', kind: 'furniture', symbol: 'sofa',
    x: 0.2, y: 0.3, w: 0.3, h: 0.15, angle: 30, width_cm: 2,
  }];
  const decoratedConfig = { model_version: 9, spaces: [decorated], markers: [], settings: {} };
  const make = (decor) => buildPdfPage({
    config: decoratedConfig, rawSpace: decorated, space: spaceModels(decoratedConfig)[0], layout: {},
    options: { dimensions: false, roomNames: false, decor, backdrop: false },
    imperial: false, cardTitle: 'House', version: 'test',
    now: new Date('2026-09-07T00:00:00Z'), t,
  });
  assert.ok(make(true).commands.some((command) => command.kind === 'vector'
    && command.ops.some((operation) => operation.op === 'C')));
  assert.ok(!make(false).commands.some((command) => command.kind === 'vector'));
});

test('current 20-room large-house space builds from the visible geometry cache under 200 ms', () => {
  const fixture = makeLargeHouseFixture();
  const largeConfig = { ...fixture.config, model_version: 9 };
  const largeRaw = largeConfig.spaces[0];
  const largeSpace = spaceModels(largeConfig)[0];
  assert.equal(largeSpace.rooms.length, 20);
  const cellCm = largeRaw.cell_cm;
  const zero = resolveZeroWalls(largeRaw, largeSpace, NORM_W, GRID_PITCH * 0.02);
  const openings = geometryOpenings(largeRaw, largeSpace, cellCm, GRID_PITCH, NORM_W);
  const cuts = geometryPartitionOpeningCuts(openings);
  const extras = physicalBodyParts(
    largeSpace, cellCm, GRID_PITCH, GRID_PITCH * 0.0002, cuts,
  ).all;
  const roomOpenings = geometryRoomOpeningInputs(
    openings, largeSpace, largeRaw.walls, zero.contour,
    GRID_STEP_N, cellCm, GRID_PITCH, NORM_W,
  );
  const sharedWallGeometry = wallBodiesGeometry(
    largeSpace.rooms, largeRaw.walls, zero.contour, roomOpenings,
    GRID_STEP_N, cellCm, GRID_PITCH, NORM_W, extras,
  );
  const innerContours = new Map(largeSpace.rooms.map((room) => [room.id, innerContourForRoom(
    largeSpace.rooms, room.id, largeRaw.walls, zero.contour, GRID_STEP_N,
    cellCm, GRID_PITCH, NORM_W, sharedWallGeometry.roomGeom, sharedWallGeometry.multiWallNodes,
  )]));
  const roomAreas = new Map(largeSpace.rooms.map((room) => {
    const contour = innerContours.get(room.id);
    const cleaned = extras.length ? floorMinusBodies(contour, extras) : null;
    const area = cleaned ? geometryArea(cleaned) : Math.abs(contour.reduce((sum, point, index) => {
      const next = contour[(index + 1) % contour.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2);
    return [room.id, area];
  }));
  // The full suite runs test files concurrently on CI. Wall time counts periods when
  // this worker is descheduled, while process.cpuUsage() also includes background
  // V8 threads in this test-file process. Measure only the current JS worker thread
  // so the agreed 200 ms product budget is neither weakened nor made dependent on
  // unrelated parallel work.
  const started = process.threadCpuUsage();
  let contourCacheReads = 0;
  let areaCacheReads = 0;
  buildPdfPage({
    config: largeConfig, rawSpace: largeRaw, space: largeSpace, layout: fixture.layout,
    sharedWallGeometry,
    resolveInnerContour: (roomId) => {
      contourCacheReads++;
      return innerContours.get(roomId);
    },
    resolveRoomArea: (roomId) => {
      areaCacheReads++;
      return roomAreas.get(roomId);
    },
    options: { dimensions: true, roomNames: true, decor: true, backdrop: false },
    imperial: false, cardTitle: 'House', version: 'test',
    now: new Date('2026-09-07T00:00:00Z'), t,
  });
  const elapsed = process.threadCpuUsage(started);
  const elapsedMs = (elapsed.user + elapsed.system) / 1000;
  assert.equal(contourCacheReads, largeSpace.rooms.length);
  assert.equal(areaCacheReads, largeSpace.rooms.length);
  assert.ok(elapsedMs < 200, `PDF scene build used ${elapsedMs.toFixed(1)} ms of CPU`);
});
