import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { buildPdfPage } from '../test-build/pdf/pdf-scene.js';
import { stableDimensionEdges } from '../test-build/pdf/pdf-dimensions.js';
import { makeLargeHouseFixture } from '../demo/fixtures/large-house.mjs';
import { fixtureWallKey } from '../demo/fixtures/wall-key.mjs';
import { physicalBodyParts } from '../test-build/physical-geometry.js';
import {
  geometryOpenings, geometryPartitionOpeningCuts, geometryRoomOpeningInputs,
} from '../test-build/plan-geometry-preflight.js';
import { spaceModels, GRID_PITCH, GRID_STEP_N, NORM_W } from '../test-build/space-geometry.js';
import { wallBodiesGeometry } from '../test-build/wall-thickness.js';
import { resolveZeroWalls } from '../test-build/zero-walls.js';

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

test('PDF scene chooses one A4 orientation and a standard scale', () => {
  const output = page({ dimensions: false, roomNames: false, decor: false, backdrop: false });
  assert.ok(output.width === 595.2755905511812 || output.height === 595.2755905511812);
  assert.ok([20, 25, 50, 75, 100, 150, 200, 250, 500].includes(output.scale));
});

test('dense non-rectangular rooms keep mandatory dimensions in stable callouts', () => {
  const denseRaw = structuredClone(rawSpace);
  denseRaw.id = 'dense';
  denseRaw.title = 'Dense';
  denseRaw.rooms[0].id = 'dense-room';
  denseRaw.rooms[0].name = 'Комната с выступом';
  denseRaw.rooms[0].poly = [
    [0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.55, 0.9],
    [0.55, 0.84], [0.45, 0.84], [0.45, 0.9], [0.1, 0.9],
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
  assert.ok(texts.includes('pdf.internal_dimensions'));
  assert.ok(texts.some((value) => /^R\d+$/.test(value)));
  assert.ok(texts.some((value) => /^R\d+ .+: .+/.test(value)));
  const expectedValues = stableDimensionEdges(
    denseRaw.rooms[0].poly.map(([x, y]) => [x * NORM_W, y * NORM_W]), 5 / GRID_PITCH, false,
  ).filter((edge) => !edge.short).length;
  assert.equal(texts.filter((value) => value !== '1 m' && /(?:^|:\s)\d+(?:[.,]\d+)?\sm$/.test(value)).length,
    expectedValues, 'every non-short clean-contour edge keeps one reconstructable value');
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
  const started = performance.now();
  buildPdfPage({
    config: largeConfig, rawSpace: largeRaw, space: largeSpace, layout: fixture.layout,
    sharedWallGeometry,
    options: { dimensions: true, roomNames: true, decor: true, backdrop: false },
    imperial: false, cardTitle: 'House', version: 'test',
    now: new Date('2026-09-07T00:00:00Z'), t,
  });
  assert.ok(performance.now() - started < 200);
});
