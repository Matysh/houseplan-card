import test from 'node:test';
import assert from 'node:assert/strict';
import {
  atomizeWallSegments,
  buildWallFaceGraph,
  findNewWallFaces,
  findNewWallFacesInGraphs,
  findWallFaceAtPoint,
  normalizeUnifiedWallTool,
  wallChainSegments,
  chainSegmentCms,
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

test('face hit chooses the smallest containing face and excludes its boundary', () => {
  const graph = buildWallFaceGraph([
    { a: [0, 0], b: [100, 0], key: 'top' },
    { a: [100, 0], b: [100, 100], key: 'right' },
    { a: [100, 100], b: [0, 100], key: 'bottom' },
    { a: [0, 100], b: [0, 0], key: 'left' },
    { a: [50, 0], b: [50, 100], key: 'divider' },
  ]);
  assert.equal(findWallFaceAtPoint(graph, [25, 50])?.area, 5000);
  assert.equal(findWallFaceAtPoint(graph, [50, 50]), null);
  assert.equal(findWallFaceAtPoint(graph, [120, 50]), null);
});

test('open chain converts endpoints and per-segment thickness without mutation', () => {
  // Толщины приходят уже разрешёнными (#234): своего fallback у функции нет.
  const path = [[0, 0], [100, 0], [100, 50]];
  const before = JSON.stringify(path);
  assert.deepEqual(wallChainSegments(path, [30, 25]), [
    { a: [0, 0], b: [100, 0], cm: 30 },
    { a: [100, 0], b: [100, 50], cm: 25 },
  ]);
  assert.equal(JSON.stringify(path), before);
  assert.deepEqual(wallChainSegments([[0, 0]], []), []);
});

test('chainSegmentCms fills a gap from the previous segment, then the field (#234)', () => {
  // Симптом задачи: цепочка нарисована 30 см, запись последнего отрезка
  // потеряна. Раньше запись давала 15, превью — 30; теперь ответ один.
  assert.deepEqual(chainSegmentCms(3, [30, 30], 30, 15), [30, 30, 30]);
  // Дырка в середине наследует предыдущий, а не следующий и не дефолт.
  assert.deepEqual(chainSegmentCms(3, [30, undefined, 20], 12, 15), [30, 30, 20]);
  // Нет ни одной записи — текущее поле.
  assert.deepEqual(chainSegmentCms(2, [], 22, 15), [22, 22]);
  // Нет и поля — дефолт вызывающего.
  assert.deepEqual(chainSegmentCms(2, [], null, 15), [15, 15]);
});

test('chainSegmentCms gives the live rubber-band the current field value (#234)', () => {
  // The last missing record is not historical damage: it is the segment under
  // the cursor. A field change between clicks must be visible before commit.
  assert.deepEqual(chainSegmentCms(2, [12], 24, 15), [12, 24]);
  // With no active field, a missing tail remains a historical gap and inherits.
  assert.deepEqual(chainSegmentCms(3, [30, undefined], null, 15), [30, 30, 30]);
});

test('chainSegmentCms treats only strictly positive records as valid (#234)', () => {
  // Прежняя wallChainSegments считала записанный 0 валидным; через UI ноль
  // недостижим (1..100 см), но в старом черновике лежать может.
  assert.deepEqual(chainSegmentCms(3, [0, 30, 0], 25, 15), [25, 30, 25]);
  assert.deepEqual(chainSegmentCms(4, [NaN, -5, null, 'x'], 18, 15), [18, 18, 18, 18]);
  assert.deepEqual(chainSegmentCms(2, [Infinity, 40], 18, 15), [18, 40]);
});

test('chainSegmentCms always returns exactly segmentCount positive numbers (#234)', () => {
  // Инвариант: длина результата равна числу отрезков при любом входе — именно
  // его отсутствие и позволяло массиву разъехаться с путём.
  for (const count of [0, 1, 5]) {
    for (const recorded of [[], [30], [30, 30, 30, 30, 30, 30, 30], [null, 0, NaN]]) {
      const out = chainSegmentCms(count, recorded, 20, 15);
      assert.equal(out.length, count);
      assert.ok(out.every((cm) => typeof cm === 'number' && cm > 0), JSON.stringify(out));
    }
  }
  // Мусор в самих аргументах длины и дефолта не роняет резолвер.
  assert.deepEqual(chainSegmentCms(-1, [30], 20, 15), []);
  assert.deepEqual(chainSegmentCms(2, [30], null, NaN), [30, 30]);
  assert.deepEqual(chainSegmentCms(2, null, null, null), [1, 1]);
});

test('wallChainSegments owns no fallback of its own (#234)', () => {
  // Свойство, а не курьёз: единственный источник значения — резолвер. Если у
  // этой функции появится собственный дефолт, вернётся ровно та ситуация, из
  // которой выросла задача — две формулы для одного смысла. Поэтому пропуск
  // здесь обязан остаться пропуском, а не превратиться в 15 см.
  const path = [[0, 0], [100, 0], [100, 50]];
  const out = wallChainSegments(path, [30]);
  assert.equal(out.length, 2);
  assert.equal(out[0].cm, 30);
  assert.equal(out[1].cm, undefined);
});

test('the preview and the writers cannot disagree, because the source is one (#234)', () => {
  // Это ядро задачи, поэтому проверяется как свойство, а не как пример:
  // вектор для превью и вектор для записи строятся одним вызовом.
  const path = [[0, 0], [100, 0], [100, 60], [0, 60]];
  const recorded = [30, 30];
  const field = 30;
  const resolved = chainSegmentCms(path.length - 1, recorded, field, 15);
  const written = wallChainSegments(path, resolved).map((segment) => segment.cm);
  assert.deepEqual(written, resolved);
  // И то, что раньше расходилось: последний отрезок больше не 15.
  assert.equal(written[written.length - 1], 30);
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
