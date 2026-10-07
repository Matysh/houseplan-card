// #769: the summary panel's total area is memoised per floor, by the content
// key of the floor's records (`floorRecordKeyMemo`, src/floor-geometry-key.ts),
// instead of by the global config epoch.
//
// The runtime and the metrics module are the real ones. Work is counted at two
// seams the runtime already passes through: `geometryOf` (one call per floor
// computed) and the portion generator (one yield per room or stair batch). The
// oracle is a fresh `totalCleanFloorAreaM2(config, spaceModels(config))`.
import assert from 'node:assert/strict';
import test from 'node:test';

import { LoadedSummaryPanelRuntime } from '../test-build/summary-panel-runtime-loaded.js';
import * as metrics from '../test-build/summary-panel-metrics.js';
import { spaceModels } from '../test-build/space-geometry.js';
import { floorRecordKeyMemo } from '../test-build/floor-geometry-key.js';
import { contentFingerprint } from '../test-build/visual-continuity.js';
import { fixtureWallKey } from '../demo/fixtures/wall-key.mjs';

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const wallsOf = (rooms, cm) => {
  const byKey = new Map();
  for (const room of rooms) {
    room.poly.forEach((a, index) => {
      const b = room.poly[(index + 1) % room.poly.length];
      const key = fixtureWallKey(a, b);
      if (!byKey.has(key)) byKey.set(key, { key, cm, a, b });
    });
  }
  return [...byKey.values()];
};

/** One floor: two rooms on a shared wall, wall records, a door on the shared
 * wall, a partition, a column and, on B, a straight stair. */
const floor = (id, x0, stairs = false) => {
  const rooms = [
    { id: `${id}1`, name: `${id} west`, poly: rect(x0, 0.1, x0 + 0.4, 0.5) },
    { id: `${id}2`, name: `${id} east`, poly: rect(x0 + 0.4, 0.1, x0 + 0.75, 0.5) },
  ];
  return {
    id, title: `Floor ${id}`, cell_cm: 5, view_box: [0, 0, 1, 1],
    rooms,
    walls: wallsOf(rooms, 15),
    openings: [{ id: `${id}-door`, type: 'door', x: x0 + 0.4, y: 0.3, angle: 90, length: 0.05 }],
    partitions: [{ id: `${id}-wall`, a: [x0 + 0.05, 0.3], b: [x0 + 0.25, 0.3], cm: 10 }],
    wall_columns: [{ id: `${id}-column`, shape: 'circle', center: [x0 + 0.6, 0.3], cm: 20 }],
    decor: [],
    ...(stairs ? { stairs: [{
      id: `${id}-stair`, kind: 'straight', direction: 'forward',
      x: x0 + 0.2, y: 0.42, angle: 0, length: 0.12, width: 0.045,
    }] } : {}),
  };
};
const house = () => ({
  spaces: [floor('A', 0.1), floor('B', 0.12, true), floor('C', 0.15)],
  markers: [], settings: {},
});

/** Rooms with a contour plus stair batches: the portions of one floor (#509). */
const portionsOf = (config, ids) => spaceModels(config)
  .filter((model) => ids.includes(model.id))
  .reduce((sum, model) => sum + model.rooms.filter((room) => room.id && room.poly).length
    + Math.ceil((model.stairs || []).length / 24), 0);

const fresh = (config) => metrics.totalCleanFloorAreaM2(config, spaceModels(config));

const harness = (config) => {
  const counts = { floors: [], computed: [], portions: 0, fingerprints: 0 };
  const module = {
    ...metrics,
    spaceWallGeometry: (space, prepared) => {
      counts.floors.push(space.id);
      return metrics.spaceWallGeometry(space, prepared);
    },
    cleanFloorAreaSteps: function* counted(...args) {
      const inner = metrics.cleanFloorAreaSteps(...args);
      let step = inner.next();
      while (!step.done) {
        counts.portions++;
        yield;
        step = inner.next();
      }
      return step.value;
    },
  };
  const host = {
    hass: { states: {}, config: {} }, _config: {}, requestUpdate: () => undefined,
    _mode: 'view', _space: config.spaces[0].id, _markers: [], _layoutRev: 0,
    _haRegistry: { authoritative: true, revision: 0, devices: {}, entities: {} },
    _areaToSpace: {}, _cfgEpoch: 1,
    _serverCfg: config, _renderCfg: config, _model: spaceModels(config),
  };
  const runtime = new LoadedSummaryPanelRuntime(host);
  runtime.metricsModule = module;
  runtime.areaKeys = floorRecordKeyMemo((value) => {
    counts.fingerprints++;
    return contentFingerprint(value);
  });
  // Every floor computed — a failed one included — is written to the memo once.
  const write = runtime.areaFloors.set.bind(runtime.areaFloors);
  runtime.areaFloors.set = (key, value) => {
    counts.computed.push(key.slice(0, key.indexOf('|')));
    return write(key, value);
  };
  const reset = () => {
    counts.floors = []; counts.computed = []; counts.portions = 0; counts.fingerprints = 0;
  };
  /** A new config as the card adopts it: new epoch, the model rebuilt. */
  const adopt = (next) => {
    host._serverCfg = next;
    host._renderCfg = next;
    host._model = spaceModels(next);
    host._cfgEpoch++;
    reset();
    runtime.computeMetrics();
    return {
      floors: [...counts.floors].sort(), computed: [...counts.computed].sort(),
      portions: counts.portions, value: runtime.areaMemo.value,
    };
  };
  runtime.computeMetrics();
  return { host, runtime, counts, reset, adopt };
};

const edit = (config, mutate) => {
  const next = structuredClone(config);
  mutate(next);
  return next;
};
const B = (config) => config.spaces.find((space) => space.id === 'B');

/** AC1 table: the scenario, its edit, the floors it recomputes and the floors
 * going back to the base recomputes (the memo keeps current floors only). */
const SCENARIOS = [
  ['rename a room of B', (c) => { B(c).rooms[0].name += ' renamed'; }, ['B']],
  ['colour of a room of B', (c) => { B(c).rooms[0].settings = { fill_mode: 'custom', custom_fill: '#123456' }; }, ['B']],
  ['furniture on B', (c) => { B(c).decor.push({ id: 'sofa', kind: 'furniture', symbol: 'sofa', x: 0.4, y: 0.3, w: 0.1, h: 0.05 }); }, ['B']],
  ['a vertex of a room of B', (c) => {
    const room = B(c).rooms[1];
    room.poly = room.poly.map((point, index) => (index === 1 || index === 2 ? [point[0] + 0.05, point[1]] : point));
  }, ['B']],
  ['wall thickness on B', (c) => { for (const wall of B(c).walls) wall.cm = 30; }, ['B']],
  ['an opening on B', (c) => { B(c).openings[0].y = 0.25; }, ['B']],
  ['the stair of B', (c) => { B(c).stairs[0].length = 0.2; }, ['B']],
  ['the column of B', (c) => { B(c).wall_columns[0].cm = 40; }, ['B']],
  ['cell_cm of B', (c) => { B(c).cell_cm = 7; }, ['B']],
  ['markers and settings', (c) => {
    c.markers.push({ id: 'probe', binding: 'virtual' });
    c.settings = { ...c.settings, show_device_battery: true };
  }, []],
  ['a server change of C', (c) => { c.spaces[2].rooms[0].name = 'remote'; }, ['C']],
  ['a new floor', (c) => { c.spaces.push({ ...structuredClone(B(c)), id: 'D', title: 'Floor D' }); }, ['D']],
  ['a deleted floor', (c) => { c.spaces.splice(1, 1); }, [], ['B']],
  ['floors reordered', (c) => { c.spaces.reverse(); }, []],
];

test('#769 AC1: an edit recomputes only the floors it changed, in the same portions', () => {
  const base = house();
  const { adopt } = harness(base);
  for (const [name, mutate, changed, restored = changed.filter((id) => id !== 'D')] of SCENARIOS) {
    const next = edit(base, mutate);
    const after = adopt(next);
    assert.deepEqual(after.floors, changed, `${name}: recomputed floors`);
    assert.deepEqual(after.computed, changed, `${name}: floors written to the memo`);
    assert.equal(after.portions, portionsOf(next, changed),
      `${name}: portions = rooms and stair batches of the changed floors`);
    // Back to the base: what the memo forgot is computed again, nothing else.
    const back = adopt(structuredClone(base));
    assert.deepEqual(back.computed, restored, `${name}: going back`);
  }
});

test('#769 AC2: after every edit the total equals a fresh computation', () => {
  const base = house();
  const { adopt, runtime } = harness(base);
  assert.equal(runtime.areaMemo.value, fresh(base), 'the first total is the fresh one');
  assert.ok(runtime.areaMemo.value > 0);
  let current = base;
  for (const [name, mutate] of SCENARIOS) {
    // Chained edits: each one starts from the previous result.
    const next = edit(current, mutate);
    assert.equal(adopt(next).value, fresh(next), `${name}: the total equals a fresh computation`);
    current = next;
  }
  // The geometry edits move the total: the key misses no input kind.
  for (const name of ['wall thickness on B', 'the stair of B', 'cell_cm of B', 'a vertex of a room of B']) {
    const mutate = SCENARIOS.find(([label]) => label === name)[1];
    assert.notEqual(fresh(edit(base, mutate)), fresh(base), `${name} changes the area`);
  }
});

test('#769 AC1: a floor switch recomputes nothing, before and after the next epoch', () => {
  const base = house();
  const { host, runtime, counts, reset, adopt } = harness(base);
  const value = runtime.areaMemo.value;
  reset();
  host._space = 'C';
  runtime.computeMetrics();
  assert.equal(runtime.metricsFresh(), true, 'a switch keeps the epoch');
  assert.deepEqual(counts, { floors: [], computed: [], portions: 0, fingerprints: 0 });
  // The next epoch with the same records (an edit elsewhere, e.g. a layout
  // write): a key of the shown floor (`_floorKey`) would recompute the rest.
  const after = adopt(base);
  assert.deepEqual(after.floors, [], 'the same records after a switch');
  assert.equal(after.portions, 0);
  assert.equal(after.value, value);
});

test('#769 AC2: a failing floor gives null, its fix gives the number; duplicate ids stay exact', () => {
  const base = house();
  const { adopt } = harness(base);
  const broken = edit(base, (c) => { B(c).walls = [null]; });
  assert.equal(fresh(broken), null, 'the fixture really fails the computation');
  let step = adopt(broken);
  assert.deepEqual(step.computed, ['B'], 'only the broken floor is computed');
  assert.equal(step.value, null, 'a failed floor makes the total null');
  step = adopt(edit(broken, (c) => { c.spaces[2].rooms[0].name = 'other'; }));
  assert.deepEqual(step.computed, ['C'], 'the failure is remembered by its key');
  assert.equal(step.value, null);
  step = adopt(structuredClone(base));
  assert.deepEqual(step.computed, ['B', 'C'], 'the fixed floor and the renamed one');
  assert.equal(step.value, fresh(base), 'the fix brings the number back');

  // A duplicate id: the second `B` is drawn from its own record but reads the
  // walls of the first. Its key covers both records.
  const duplicate = edit(base, (c) => { c.spaces.push({ ...structuredClone(c.spaces[2]), id: 'B', title: 'Twin' }); });
  step = adopt(duplicate);
  assert.deepEqual(step.floors, ['B']);
  assert.equal(step.value, fresh(duplicate));
  const thicker = edit(duplicate, (c) => { for (const wall of c.spaces[1].walls) wall.cm = 30; });
  step = adopt(thicker);
  assert.deepEqual(step.floors, ['B', 'B'], 'walls of the first B move the twin too');
  assert.equal(step.value, fresh(thicker));
});

test('#769 AC3: freshness checks are free; a new epoch costs one fingerprint per floor', () => {
  const base = house();
  const { host, runtime, counts, reset } = harness(base);
  const total = { id: 'v', label: 'Area', source: { type: 'system', key: 'total_area' } };
  reset();
  for (let index = 0; index < 100; index++) {
    assert.equal(runtime.metricsFresh(), true);
    assert.equal(runtime.valueState(total).kind, 'ready');
  }
  assert.deepEqual(counts, { floors: [], computed: [], portions: 0, fingerprints: 0 },
    'renders and HA ticks do no work');

  host._cfgEpoch++;
  host._serverCfg = structuredClone(base);
  host._renderCfg = host._serverCfg;
  host._model = spaceModels(host._serverCfg);
  reset();
  runtime.computeMetrics();
  assert.equal(counts.fingerprints, 3, 'one fingerprint per floor for the new epoch');
  assert.equal(counts.portions, 0, 'the same records cost no portion');
  runtime.computeMetrics();
  for (let index = 0; index < 100; index++) runtime.valueState(total);
  assert.equal(counts.fingerprints, 3, 'and only once per epoch');
});

test('#769: a lifecycle reset forgets the per-floor memo', () => {
  const base = house();
  const { runtime, counts, reset } = harness(base);
  runtime.resetLifecycle();
  reset();
  runtime.computeMetrics();
  assert.deepEqual(counts.floors, ['A', 'B', 'C'], 'after a reset every floor is computed again');
  assert.equal(runtime.areaMemo.value, fresh(base));
});
