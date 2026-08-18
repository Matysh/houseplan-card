import test from 'node:test';
import assert from 'node:assert/strict';
import {
  atomizeWallSegments,
  buildWallFaceGraph,
  findNewWallFaces,
  findNewWallFacesInGraphs,
  normalizeUnifiedWallTool,
  wallChainSegments,
} from '../test-build/wall-face-graph.js';

const edge = (key, a, b) => ({ key, a, b });
const rectangle = [
  edge('top', [0, 0], [100, 0]),
  edge('right', [100, 0], [100, 100]),
  edge('bottom', [100, 100], [0, 100]),
  edge('left', [0, 100], [0, 0]),
];

test('legacy Partition token becomes Walls without mutating other tools', () => {
  assert.equal(normalizeUnifiedWallTool('partition'), 'draw');
  assert.equal(normalizeUnifiedWallTool('split'), 'split');
  assert.equal(normalizeUnifiedWallTool(null), null);
});

test('open chain converts endpoints and per-segment thickness without mutation', () => {
  const path = [[0, 0], [100, 0], [100, 50]];
  const before = JSON.stringify(path);
  assert.deepEqual(wallChainSegments(path, [0, 25], 15), [
    { a: [0, 0], b: [100, 0], cm: 0 },
    { a: [100, 0], b: [100, 50], cm: 25 },
  ]);
  assert.equal(JSON.stringify(path), before);
  assert.deepEqual(wallChainSegments([[0, 0]], [], 15), []);
});

test('atomizes endpoint, T, proper X and collinear overlap with provenance', () => {
  const sources = [
    edge('horizontal', [0, 0], [100, 0]),
    edge('t', [50, 0], [50, 50]),
    edge('x', [75, -50], [75, 50]),
    edge('overlap', [25, 0], [100, 0]),
  ];
  const before = JSON.stringify(sources);
  const atoms = atomizeWallSegments(sources);
  assert.equal(atoms.filter((atom) => atom.a[1] === 0 && atom.b[1] === 0).length, 4);
  assert.ok(atoms.some((atom) => atom.sourceKeys.includes('horizontal')
    && atom.sourceKeys.includes('overlap')));
  assert.ok(atoms.some((atom) => atom.a[0] === 50 && atom.b[0] === 50));
  assert.ok(atoms.some((atom) => atom.a[0] === 75 && atom.b[0] === 75));
  assert.equal(JSON.stringify(sources), before);
});

test('returns the bounded face but never the exterior or a compound cycle', () => {
  const graph = buildWallFaceGraph(rectangle);
  assert.equal(graph.faces.length, 1);
  assert.equal(graph.faces[0].area, 10000);

  const divided = buildWallFaceGraph([
    ...rectangle,
    edge('middle', [50, 0], [50, 100]),
  ]);
  assert.deepEqual(divided.faces.map((face) => face.area), [5000, 5000]);
});

test('face identity and order ignore record order and endpoint direction', () => {
  const first = buildWallFaceGraph(rectangle).faces;
  const second = buildWallFaceGraph([...rectangle].reverse().map((item) => ({
    ...item, a: item.b, b: item.a,
  }))).faces;
  assert.deepEqual(second.map((face) => face.key), first.map((face) => face.key));
  assert.deepEqual(second.map((face) => face.area), first.map((face) => face.area));
});

test('delta only returns faces introduced by and containing the accepted segment', () => {
  const open = rectangle.slice(0, -1);
  assert.deepEqual(findNewWallFaces(open, rectangle, 'left').map((face) => face.area), [10000]);
  assert.deepEqual(findNewWallFacesInGraphs(
    buildWallFaceGraph(open), buildWallFaceGraph(rectangle), 'left',
  ).map((face) => face.area), [10000]);
  assert.equal(findNewWallFaces(rectangle, [
    ...rectangle,
    edge('unrelated', [200, 0], [250, 0]),
  ], 'unrelated').length, 0);
});

test('one segment may create several faces in stable area order', () => {
  const before = rectangle.map((item) => ({
    ...item,
    a: [item.a[0] * 2, item.a[1]],
    b: [item.b[0] * 2, item.b[1]],
  }));
  const divider = edge('divider', [80, 0], [80, 100]);
  assert.deepEqual(findNewWallFaces(before, [...before, divider], 'divider')
    .map((face) => face.area), [8000, 12000]);

  const equalDivider = edge('equal-divider', [100, 0], [100, 100]);
  const first = findNewWallFaces(before, [...before, equalDivider], 'equal-divider');
  const second = findNewWallFaces([...before].reverse(), [equalDivider, ...before].reverse(), 'equal-divider');
  assert.deepEqual(first.map((face) => face.key), second.map((face) => face.key));
});

test('a large sparse plan stays deterministic without pairwise topology explosion', () => {
  const sparse = Array.from({ length: 2000 }, (_, index) =>
    edge(`s${index}`, [index * 10, 0], [index * 10 + 5, 0]));
  const first = buildWallFaceGraph(sparse);
  const second = buildWallFaceGraph([...sparse].reverse());
  assert.equal(first.atoms.length, 2000);
  assert.equal(first.faces.length, 0);
  assert.deepEqual(second.atoms.map((atom) => atom.key), first.atoms.map((atom) => atom.key));
});

test('near misses, gaps and malformed sources do not invent a face', () => {
  const nearMiss = [
    ...rectangle.slice(0, -1),
    edge('miss', [0, 100], [0, 0.01]),
    edge('zero', [10, 10], [10, 10]),
    edge('bad', [Number.NaN, 0], [0, 0]),
  ];
  assert.equal(buildWallFaceGraph(nearMiss, 0.001).faces.length, 0);
  assert.equal(buildWallFaceGraph([
    ...rectangle.slice(1),
    edge('top-a', [0, 0], [40, 0]),
    edge('top-b', [60, 0], [100, 0]),
  ]).faces.length, 0);
});

test('coincident axes deduplicate atoms while retaining every owner', () => {
  const graph = buildWallFaceGraph([
    ...rectangle,
    edge('top-copy', [100, 0], [0, 0]),
  ]);
  assert.equal(graph.faces.length, 1);
  const top = graph.atoms.find((atom) => atom.sourceKeys.includes('top'));
  assert.deepEqual(top.sourceKeys, ['top', 'top-copy']);
});
