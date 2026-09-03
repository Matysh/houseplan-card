import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateMarkerRoutes, effectiveRoutes, legacyRouteId, resolveRoute, adoptLegacyRun,
  normalizeRouteMatrix, isEntityIdLike, VAC_ROUTE_LIMIT, VAC_ROUTE_ERROR,
  observedMapIds, runRoute, planVacuumOverlay, routeWarningKey,
} from '../test-build/vacuum-routes.js';
import {
  newRouteId, addRoute, removeRoute, changeRouteSpace, saveRouteCalibration, convertLegacyRoutes,
  writeVacuumMatrix, planVacuumFit, calibrationTarget, beginVacuumRouteDraft,
  chooseVacuumRouteSpace, commitVacuumRouteDraft,
} from '../test-build/vacuum-route-edit.js';

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

test('explicit empty routes remain authoritative over legacy calibration', () => {
  const legacy = { source: 'camera.robot', calibration: { m1: IDENTITY } };
  assert.equal(effectiveRoutes('mk', legacy, 'floor1').length, 1, 'absent keeps legacy');
  assert.equal(
    effectiveRoutes('mk', { ...legacy, map_routes: null }, 'floor1').length,
    1,
    'null keeps legacy compatibility',
  );
  assert.deepEqual(
    effectiveRoutes('mk', { ...legacy, map_routes: [] }, 'floor1'),
    [],
    'an explicit empty array disables every legacy route',
  );
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

const M1 = [1, 0, 0, 0, 1, 0];
const M2 = [2, 0, 0, 0, 2, 0];
const twoFloors = [
  { id: 'r1', source: 'camera.robot', map_id: 'm1', space: 'floor1', calibration: M1 },
  { id: 'r2', source: 'camera.robot', map_id: 'm2', space: 'floor2', calibration: M2 },
];
const ready = (mapId) => resolveRoute({
  routes: twoFloors, observed: { 'camera.robot': mapId }, spaceIds: spaces('floor1', 'floor2'),
});

test('телеметрия читается по всем источникам маршрутов плюс discovery', () => {
  const seen = [];
  const observed = observedMapIds(twoFloors, ['camera.extra', null, ''], (source) => {
    seen.push(source);
    return source === 'camera.robot' ? 'm2' : undefined;
  });
  assert.deepEqual(seen, ['camera.extra', 'camera.robot']);
  assert.deepEqual(observed, { 'camera.robot': 'm2' });
});

test('run опознаётся своим route_id, а без него — усыновлением', () => {
  assert.equal(runRoute({ route_id: 'r2', map_id: 'm1' }, twoFloors, 'camera.robot').id, 'r2');
  assert.equal(runRoute({ route_id: 'нет такого' }, twoFloors, 'camera.robot'), null);
  assert.equal(runRoute({ map_id: 'm1' }, twoFloors, 'camera.robot').id, 'r1');
  assert.equal(runRoute(null, twoFloors, 'camera.robot'), null);
});

test('док остаётся на первом этаже, живой оверлей уезжает на второй (AC2)', () => {
  const resolution = ready('m2');
  const onFloor2 = planVacuumOverlay({
    resolution, routes: twoFloors, renderSpace: 'floor2', explicitRoutes: true,
  });
  assert.deepEqual(onFloor2.live, M2);
  const onFloor1 = planVacuumOverlay({
    resolution, routes: twoFloors, renderSpace: 'floor1', explicitRoutes: true,
  });
  assert.equal(onFloor1.live, null, 'на этаже дока живого робота нет');
});

test('возврат на первую карту возвращает оверлей без правки маршрутов (AC3)', () => {
  const back = planVacuumOverlay({
    resolution: ready('m1'), routes: twoFloors, renderSpace: 'floor1', explicitRoutes: true,
  });
  assert.deepEqual(back.live, M1);
  assert.deepEqual(twoFloors[0].calibration, M1, 'маршруты не переписаны');
});

test('неоднозначность и незакалиброванный маршрут не рисуют ничего', () => {
  for (const resolution of [
    { kind: 'ambiguous', routeIds: ['r1', 'r2'] },
    { kind: 'needs_calibration', route: twoFloors[0] },
    { kind: 'unmapped', source: 'camera.robot', mapId: 'm9' },
    { kind: 'missing_space', route: twoFloors[1] },
    { kind: 'none' },
  ]) {
    for (const renderSpace of ['floor1', 'floor2']) {
      const plan = planVacuumOverlay({ resolution, routes: twoFloors, renderSpace, explicitRoutes: true });
      assert.equal(plan.live, null, `${resolution.kind} / ${renderSpace}`);
      assert.equal(plan.currentRunMatches, false, resolution.kind);
    }
  }
});

test('прошлый прогон остаётся в пространстве своего маршрута (AC10)', () => {
  const plan = planVacuumOverlay({
    resolution: ready('m2'), routes: twoFloors, renderSpace: 'floor1', explicitRoutes: true,
    rootSource: 'camera.robot',
    serverPrevious: { route_id: 'r1', map_id: 'm1', points: [] },
  });
  assert.deepEqual(plan.previous, M1, 'прошлый прогон виден на своём этаже');
  assert.equal(plan.live, null, 'а робот при этом здесь не рисуется');
});

test('текущий серверный прогон принимается только от активного маршрута', () => {
  const base = {
    resolution: ready('m2'), routes: twoFloors, renderSpace: 'floor2',
    explicitRoutes: true, rootSource: 'camera.robot',
  };
  assert.equal(planVacuumOverlay({ ...base, serverCurrent: { route_id: 'r2' } }).currentRunMatches, true);
  assert.equal(planVacuumOverlay({ ...base, serverCurrent: { route_id: 'r1' } }).currentRunMatches, false);
  assert.equal(planVacuumOverlay({ ...base, serverCurrent: { map_id: 'm1' } }).currentRunMatches, false);
  assert.equal(planVacuumOverlay({ ...base, serverCurrent: { map_id: 'm2' } }).currentRunMatches, true);
});

test('легаси-конфиг сохраняет прежнее правило прошлого прогона (AC13)', () => {
  const marker = { source: 'camera.robot', calibration: { m1: M1, m2: M2 } };
  const routes = effectiveRoutes('mk', marker, 'floor1');
  const resolution = resolveRoute({
    routes, observed: { 'camera.robot': 'm2' }, spaceIds: spaces('floor1'),
  });
  const legacy = planVacuumOverlay({
    resolution, routes, renderSpace: 'floor1', explicitRoutes: false,
    rootSource: 'camera.robot', serverPrevious: { map_id: 'm1' },
  });
  assert.equal(legacy.previous, null, 'прошлый прогон другой карты по-прежнему скрыт');
  const same = planVacuumOverlay({
    resolution, routes, renderSpace: 'floor1', explicitRoutes: false,
    rootSource: 'camera.robot', serverPrevious: { map_id: 'm2' },
  });
  assert.deepEqual(same.previous, M2, 'прогон активной карты виден, как и раньше');
});

test('новый id маршрута не сталкивается с существующими', () => {
  const values = [0.5, 0.5, 0.9];
  let i = 0;
  const first = newRouteId([], () => values[i++]);
  const second = newRouteId([first], () => values[i++]);
  assert.match(first, /^vr_/);
  assert.notEqual(second, first, 'занятый id пропускается');
});

test('смена пространства — это новая идентичность без калибровки', () => {
  const before = [
    { id: 'r1', source: 'camera.robot', map_id: 'm1', space: 'floor1', calibration: M1 },
    { id: 'r2', source: 'camera.robot', map_id: 'm2', space: 'floor2', calibration: M2 },
  ];
  const after = changeRouteSpace(before, 'r1', 'floor3', 'vr_new');
  assert.deepEqual(after[0], {
    id: 'vr_new', source: 'camera.robot', map_id: 'm1', space: 'floor3', calibration: null,
  });
  assert.deepEqual(after[1], before[1], 'соседний маршрут не тронут');
  assert.deepEqual(before[0].calibration, M1, 'вход не мутирован');
});

test('добавление, удаление и запись матрицы маршрута', () => {
  const added = addRoute([], { source: 'camera.robot', map_id: 'm1', space: 'floor1' }, 'r1');
  assert.deepEqual(added, [{ id: 'r1', source: 'camera.robot', map_id: 'm1', space: 'floor1', calibration: null }]);
  const calibrated = saveRouteCalibration(added, 'r1', M2);
  assert.deepEqual(calibrated[0].calibration, M2);
  assert.deepEqual(added[0].calibration, null, 'вход не мутирован');
  assert.deepEqual(removeRoute(calibrated, 'r1'), []);
  assert.deepEqual(removeRoute(calibrated, 'нет такого'), calibrated);
});

test('новый маршрут живёт в черновике до выбора этажа (#441 AC1)', () => {
  const existing = [route()];
  const first = beginVacuumRouteDraft('mk', [], 'floor1', 'camera.robot', 'm1');
  const second = beginVacuumRouteDraft('mk', existing, 'floor1', 'camera.robot', 'm2');
  assert.equal(first.space, 'floor1', 'первый маршрут наследует этаж дока');
  assert.equal(second.space, '', 'второй маршрут не угадывает этаж');
  assert.equal(commitVacuumRouteDraft(existing, second, spaces('floor1', 'floor2'), 'r2'), null);
  assert.equal(existing.length, 1, 'черновик не меняет маршруты');
});

test('черновик материализует ровно один валидный маршрут (#441 AC2)', () => {
  const existing = [route()];
  const draft = beginVacuumRouteDraft('mk', existing, 'floor1', 'camera.robot', 'm2');
  const unknown = chooseVacuumRouteSpace(draft, 'gone', spaces('floor1', 'floor2'));
  assert.equal(unknown.space, '');
  const chosen = chooseVacuumRouteSpace(draft, 'floor2', spaces('floor1', 'floor2'));
  const committed = commitVacuumRouteDraft(existing, chosen, spaces('floor1', 'floor2'), 'r2');
  assert.deepEqual(committed, [existing[0], {
    id: 'r2', source: 'camera.robot', map_id: 'm2', space: 'floor2', calibration: null,
  }]);
  assert.equal(commitVacuumRouteDraft(committed, chosen, spaces('floor1', 'floor2'), 'r3'), null,
    'одну карту нельзя добавить дважды');
});

test('конверсия легаси переносит ВСЕ матрицы или ничего (AC13)', () => {
  const marker = { source: 'camera.robot', calibration: { m1: M1, m2: M2, bad: [1, 2] } };
  let n = 0;
  const routes = convertLegacyRoutes(marker, 'floor1', 'camera.robot', () => `vr_${n++}`);
  assert.equal(routes.length, 2, 'обе валидные карты');
  assert.deepEqual(routes.map((r) => r.map_id), ['m1', 'm2']);
  assert.ok(routes.every((r) => r.space === 'floor1' && r.source === 'camera.robot'));
  assert.deepEqual(routes.map((r) => r.calibration), [M1, M2]);
  assert.equal(convertLegacyRoutes(marker, 'floor1', '', () => 'vr'), null, 'без источника конверсии нет');
  assert.equal(convertLegacyRoutes({ calibration: {} }, 'floor1', 'camera.robot', () => 'vr'), null);
});

test('док предупреждает только о движущемся роботе, которому некуда рисоваться', () => {
  const cases = {
    unmapped: { kind: 'unmapped', source: 'camera.robot', mapId: 'm9' },
    needs_calibration: { kind: 'needs_calibration', route: twoFloors[0] },
    ambiguous: { kind: 'ambiguous', routeIds: ['r1', 'r2'] },
    missing_space: { kind: 'missing_space', route: twoFloors[0] },
  };
  for (const [expected, resolution] of Object.entries(cases)) {
    assert.equal(routeWarningKey(resolution, true), expected);
    assert.equal(routeWarningKey(resolution, false), null, 'док молчит, пока робот стоит');
  }
  assert.equal(routeWarningKey({ kind: 'ready', route: twoFloors[0] }, true), null);
  assert.equal(routeWarningKey({ kind: 'none' }, true), null);
  assert.equal(routeWarningKey(null, true), null);
});

test('калибровка решается против пространства маршрута, а не дока (AC8)', () => {
  const vacuum = { map_routes: twoFloors };
  assert.deepEqual(calibrationTarget('mk', vacuum, 'floor1', 'camera.robot', 'm2'),
    { space: 'floor2', routeId: 'r2' });
  assert.deepEqual(calibrationTarget('mk', vacuum, 'floor1', 'camera.robot', 'm1'),
    { space: 'floor1', routeId: 'r1' });
  // несопоставленная карта калибруется в пространстве дока, как и раньше
  assert.deepEqual(calibrationTarget('mk', vacuum, 'floor1', 'camera.robot', 'm9'),
    { space: 'floor1', routeId: '' });
  assert.deepEqual(calibrationTarget('mk', null, 'floor1', 'camera.robot', 'm1'),
    { space: 'floor1', routeId: '' });
});

test('ручная подгонка открывается на этаже маршрута и берёт его матрицу', () => {
  const vb = { floor1: [0, 0, 1000, 1000], floor2: [0, 0, 2000, 2000] };
  const plan = planVacuumFit('mk', { map_routes: twoFloors }, {
    source: 'camera.robot', mapId: 'm2', dockSpace: 'floor1', rooms: [],
    viewBoxOf: (id) => vb[id] || null,
  });
  assert.equal(plan.space, 'floor2');
  assert.equal(plan.routeId, 'r2');
  const legacy = planVacuumFit('mk', { source: 'camera.robot', calibration: { m1: M1 } }, {
    source: 'camera.robot', mapId: 'm1', dockSpace: 'floor1', rooms: [],
    viewBoxOf: (id) => vb[id] || null,
  });
  assert.equal(legacy.space, 'floor1', 'легаси-калибровка живёт в пространстве дока');
  assert.equal(planVacuumFit('mk', null, {
    source: 'camera.robot', mapId: 'm1', dockSpace: 'нет', rooms: [], viewBoxOf: () => null,
  }), null, 'без геометрии пространства подгонка не открывается');
});

test('матрица пишется в маршрут, а без маршрутов — в легаси-словарь', () => {
  const routed = writeVacuumMatrix({ map_routes: twoFloors },
    { source: 'camera.robot', mapId: 'm2', matrix: [3, 0, 0, 0, 3, 0] });
  assert.deepEqual(routed.map_routes[1].calibration, [3, 0, 0, 0, 3, 0]);
  assert.deepEqual(routed.map_routes[0].calibration, M1, 'соседний маршрут не тронут');
  const legacy = writeVacuumMatrix({ source: 'camera.robot' },
    { source: 'camera.robot', mapId: 'm1', matrix: [1 / 3, 0, 0, 0, 1 / 3, 0] });
  assert.deepEqual(legacy.calibration.m1, [0.333333, 0, 0, 0, 0.333333, 0]);
  // карта без маршрута не теряет только что решённую калибровку
  const unmapped = writeVacuumMatrix({ map_routes: twoFloors },
    { source: 'camera.robot', mapId: 'm9', matrix: [4, 0, 0, 0, 4, 0] });
  assert.deepEqual(unmapped.calibration.m9, [4, 0, 0, 0, 4, 0]);
  assert.equal(unmapped.map_routes.length, 2);
});

test('два робота не смешивают маршруты, прогоны и предупреждения (AC12)', () => {
  const first = [{ id: 'a1', source: 'camera.one', map_id: 'm1', space: 'floor1', calibration: M1 }];
  const second = [{ id: 'b1', source: 'camera.two', map_id: 'm1', space: 'floor2', calibration: M2 }];
  const observed = { 'camera.one': 'm1', 'camera.two': 'm1' };
  const spaceIds = spaces('floor1', 'floor2');
  assert.equal(resolveRoute({ routes: first, observed, spaceIds }).route.id, 'a1');
  assert.equal(resolveRoute({ routes: second, observed, spaceIds }).route.id, 'b1');
  assert.deepEqual(adoptLegacyRun({ map_id: 'm1' }, first, 'camera.one'),
    { kind: 'adopted', route: first[0] });
  assert.equal(adoptLegacyRun({ map_id: 'm1' }, first, 'camera.two').kind, 'orphan_run');
});
