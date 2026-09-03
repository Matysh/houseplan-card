import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateMarkerRoutes, effectiveRoutes, legacyRouteId, resolveRoute, adoptLegacyRun,
  normalizeRouteMatrix, isEntityIdLike, VAC_ROUTE_LIMIT, VAC_ROUTE_ERROR,
} from '../test-build/vacuum-routes.js';

const fixture = (name) => JSON.parse(readFileSync(
  new URL(`./fixtures/vacuum-routes/${name}.json`, import.meta.url), 'utf8',
));

const IDENTITY = [1, 0, 0, 0, 1, 0];
const route = (over = {}) => ({
  id: 'r1', source: 'camera.robot', map_id: 'm1', space: 'floor1',
  calibration: IDENTITY, ...over,
});
const spaces = (...ids) => new Set(ids);

test('маршрут признаётся валидным только целиком', () => {
  assert.deepEqual(validateMarkerRoutes('mk', [route()], spaces('floor1')), []);
  assert.deepEqual(validateMarkerRoutes('mk', null, spaces('floor1')), []);
  assert.deepEqual(validateMarkerRoutes('mk', undefined, spaces('floor1')), []);
});

test('пустой map id валиден, а нестрочный — нет', () => {
  assert.deepEqual(validateMarkerRoutes('mk', [route({ map_id: '' })], spaces('floor1')), []);
  const bad = validateMarkerRoutes('mk', [route({ map_id: 0 })], spaces('floor1'));
  assert.deepEqual(bad.map((p) => p.reason), ['map_id']);
  assert.equal(bad[0].code, VAC_ROUTE_ERROR);
});

test('идентичность (source, map_id) уникальна внутри маркера', () => {
  const rows = [route(), route({ id: 'r2' })];
  assert.deepEqual(
    validateMarkerRoutes('mk', rows, spaces('floor1')).map((p) => p.reason),
    ['duplicate_identity'],
  );
  const other = [route(), route({ id: 'r2', source: 'camera.second' })];
  assert.deepEqual(validateMarkerRoutes('mk', other, spaces('floor1')), []);
});

test('дубль id и ссылка на несуществующее пространство ловятся отдельно', () => {
  const rows = [route(), route({ map_id: 'm2', space: 'gone' })];
  const reasons = validateMarkerRoutes('mk', rows, spaces('floor1')).map((p) => p.reason);
  assert.deepEqual(reasons.sort(), ['duplicate_id', 'unknown_space']);
  // spaceIds === null: превью импорта ещё не знает целевых пространств
  assert.deepEqual(
    validateMarkerRoutes('mk', [route({ space: 'gone' })], null),
    [],
  );
});

test('источник обязан быть похож на entity id, матрица — из шести конечных чисел', () => {
  assert.equal(isEntityIdLike('camera.robot'), true);
  assert.equal(isEntityIdLike('camera'), false);
  assert.equal(isEntityIdLike('Camera.Robot'), false);
  assert.equal(normalizeRouteMatrix([1, 0, 0, 0, 1, 0]).length, 6);
  assert.equal(normalizeRouteMatrix([1, 0, 0, 0, 1]), null);
  assert.equal(normalizeRouteMatrix([1, 0, 0, 0, 1, NaN]), null);
  assert.equal(normalizeRouteMatrix('нет'), null);
  const reasons = validateMarkerRoutes('mk', [route({ source: 'camera', calibration: [1] })], spaces('floor1'))
    .map((p) => p.reason).sort();
  assert.deepEqual(reasons, ['calibration', 'source']);
});

test('лимит маршрутов на маркер', () => {
  const many = Array.from({ length: VAC_ROUTE_LIMIT + 1 }, (_, i) => route({ id: `r${i}`, map_id: `m${i}` }));
  assert.ok(validateMarkerRoutes('mk', many, spaces('floor1')).some((p) => p.reason === 'limit'));
  const exact = many.slice(0, VAC_ROUTE_LIMIT);
  assert.deepEqual(validateMarkerRoutes('mk', exact, spaces('floor1')), []);
});

test('легаси-калибровки читаются как маршруты в пространство дока', () => {
  const marker = { source: 'camera.robot', calibration: { m1: IDENTITY, m2: [2, 0, 0, 0, 2, 0], bad: [1, 2] } };
  const routes = effectiveRoutes('mk', marker, 'floor1');
  assert.deepEqual(routes.map((r) => r.map_id).sort(), ['m1', 'm2']);
  assert.ok(routes.every((r) => r.space === 'floor1' && r.source === 'camera.robot'));
  assert.equal(routes[0].id, legacyRouteId('mk', 'camera.robot', 'm1'));
});

test('явные маршруты вытесняют легаси-калибровку целиком', () => {
  const marker = {
    source: 'camera.robot',
    calibration: { m1: IDENTITY },
    map_routes: [route({ id: 'r9', map_id: 'm9', space: 'floor2' })],
  };
  const routes = effectiveRoutes('mk', marker, 'floor1');
  assert.deepEqual(routes.map((r) => r.id), ['r9']);
  assert.equal(routes[0].space, 'floor2');
});

test('без источника легаси-маршрутов не возникает, но discovery его подставляет', () => {
  const marker = { calibration: { m1: IDENTITY } };
  assert.deepEqual(effectiveRoutes('mk', marker, 'floor1'), []);
  const found = effectiveRoutes('mk', marker, 'floor1', 'camera.found');
  assert.deepEqual(found.map((r) => r.source), ['camera.found']);
});

test('общая фикстура: разрешение маршрута', () => {
  for (const row of fixture('resolve')) {
    const got = resolveRoute({
      routes: row.routes, observed: row.observed, spaceIds: spaces(...row.spaces),
    });
    assert.equal(got.kind, row.expected.kind, row.name);
    if (row.expected.route_id) assert.equal(got.route.id, row.expected.route_id, row.name);
    if (row.expected.space) assert.equal(got.route.space, row.expected.space, row.name);
    if (row.expected.route_ids) assert.deepEqual(got.routeIds, row.expected.route_ids, row.name);
    if (row.expected.source) assert.equal(got.source, row.expected.source, row.name);
    if (row.expected.map_id !== undefined) assert.equal(got.mapId, row.expected.map_id, row.name);
  }
});

test('порядок списка маршрутов не влияет ни на один исход', () => {
  for (const row of fixture('resolve')) {
    const straight = resolveRoute({ routes: row.routes, observed: row.observed, spaceIds: spaces(...row.spaces) });
    const reversed = resolveRoute({
      routes: row.routes.slice().reverse(), observed: row.observed, spaceIds: spaces(...row.spaces),
    });
    assert.deepEqual(reversed, straight, row.name);
  }
});

test('общая фикстура: усыновление легаси-run', () => {
  for (const row of fixture('legacy-run')) {
    const got = adoptLegacyRun(row.run, row.routes, row.root_source);
    assert.equal(got.kind, row.expected.kind, row.name);
    if (row.expected.route_id) assert.equal(got.route.id, row.expected.route_id, row.name);
    if (row.expected.route_ids) assert.deepEqual(got.routeIds, row.expected.route_ids, row.name);
  }
});

test('run без map id усыновлению не подлежит', () => {
  assert.equal(adoptLegacyRun(null, [route()], 'camera.robot').kind, 'orphan_run');
  assert.equal(adoptLegacyRun({}, [route()], 'camera.robot').kind, 'orphan_run');
  assert.equal(adoptLegacyRun({ map_id: 1 }, [route()], 'camera.robot').kind, 'orphan_run');
});
