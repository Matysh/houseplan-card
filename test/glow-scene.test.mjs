import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildLightBarrierScene, createGlowRuntimeState, disposeGlowRuntime,
  lightGeometryFingerprint, readGlowClip,
  resolveGlowCandidates, resolveLightBarrierRevision,
  transitionGlowSource, writeGlowClip,
} from '../test-build/glow-scene.js';
import { contentFingerprint } from '../test-build/visual-continuity.js';
import { wallBodiesGeometry, wallKey } from '../test-build/wall-thickness.js';

const square = (id, x0, x1) => ({
  id,
  poly: [[x0, 0], [x1, 0], [x1, 100], [x0, 100]],
});

test('light geometry excludes LED sources and decor without visiting or mutating their data', () => {
  const geometry = Object.freeze({
    id: 's', rooms: Object.freeze([square('room', 0, 100)]),
    wall_segments: [], openings: [], open_spans: [],
    wall_columns: [], wall_style: 'zero',
    future_geometry_key: { x: 1 },
  });
  const expected = contentFingerprint([geometry, 5, 20]);
  assert.equal(lightGeometryFingerprint(geometry, 5, 20), expected);
  assert.equal(lightGeometryFingerprint({ ...geometry, walls: [], partitions: [] }, 5, 20), expected,
    '#1093 empty legacy collections and their canonical absence have the same physical meaning');
  const raw = Object.freeze(Object.defineProperty({ ...geometry }, 'led_strips', {
    enumerable: true,
    get() { throw new Error('LED source data must not enter a masonry hash'); },
  }));
  assert.equal(lightGeometryFingerprint(raw, 5, 20), expected);
  const annotated = Object.freeze(Object.defineProperty({ ...geometry }, 'decor', {
    enumerable: true,
    get() { throw new Error('decor must not enter a masonry hash'); },
  }));
  assert.equal(lightGeometryFingerprint(annotated, 5, 20), expected);
  for (const decor of [[], [{id:'f',kind:'furniture',color:'#123456',opacity:.4}],
    [{id:'t',kind:'text',text:'Changed',x:.3,y:.4}]]) {
    assert.equal(lightGeometryFingerprint({ ...geometry, decor }, 5, 20), expected);
  }
  assert.equal(raw.rooms, geometry.rooms, 'the caller-owned geometry is not cloned or mutated');
  for (const led_strips of [[], [{ id: 'a', points: [[0, 0], [100, 1]] }],
    [{ id: 'b', active: false, entity: 'light.changed', points: [[0, 1]] }]]) {
    assert.equal(lightGeometryFingerprint({ ...geometry, led_strips }, 5, 20), expected);
  }
  for (const key of Object.keys(geometry)) {
    assert.notEqual(lightGeometryFingerprint({ ...geometry, [key]: ['changed'] }, 5, 20), expected,
      `all non-annotation/source raw keys still invalidate, including ${key}`);
  }
  assert.notEqual(lightGeometryFingerprint(geometry, 10, 20), expected);
  assert.notEqual(lightGeometryFingerprint(geometry, 5, 40), expected);
  for (const invalid of [null, undefined, false, 0, 's', [], [{ led_strips: [1] }]]) {
    assert.equal(lightGeometryFingerprint(invalid, 5, 20), contentFingerprint([invalid, 5, 20]),
      'non-object and array inputs keep their prior fingerprint semantics');
  }
  const mutable = { rooms: [square('room', 0, 100)], led_strips: [] };
  const before = lightGeometryFingerprint(mutable, 5, 20);
  mutable.rooms[0].poly[0][0] = 1;
  assert.notEqual(lightGeometryFingerprint(mutable, 5, 20), before,
    'in-place architectural edits must not reuse stale masonry');
});

test('LED-only edits retain the aligned shared-masonry recut fast path', () => {
  const space = {
    id: 's', rooms: [square('left', 0, 100), square('right', 100, 200)],
    partitions: [], room_drafts: [], wall_columns: [],
  };
  const unique = new Map();
  for (const room of space.rooms) for (let index = 0; index < room.poly.length; index++) {
    const a = room.poly[index], b = room.poly[(index + 1) % room.poly.length];
    const key = wallKey(a, b, 1);
    if (!unique.has(key)) unique.set(key, { key, a, b, cm: 20 });
  }
  const walls = [...unique.values()];
  const raw = { ...space, walls, led_strips: [{ id: 'led', points: [[0, 0], [100, 0]] }] };
  const sharedWallGeometry = wallBodiesGeometry(space.rooms, walls, [], [], 1, 5, 5, 1, []);
  assert.equal(sharedWallGeometry.status, 'ok');
  Object.defineProperty(sharedWallGeometry, 'sourceFingerprint', {
    value: lightGeometryFingerprint(raw, 5, 5), enumerable: false,
  });
  const revisionFor = (rawSpaceConfig) => resolveLightBarrierRevision({
    rawSpaceConfig, space, openings: [], cellCm: 5, gridPitch: 5, openingAmount: () => 0,
  });
  const revision = revisionFor(raw);
  raw.led_strips[0].points[1][1] = 90;
  const edited = revisionFor(raw);
  assert.equal(edited.geometryFingerprint, sharedWallGeometry.sourceFingerprint);
  assert.equal(edited.fingerprint, revision.fingerprint);

  let wallIterations = 0;
  Object.defineProperty(walls, Symbol.iterator, { value() {
    wallIterations++;
    return Array.prototype[Symbol.iterator].call(this);
  } });
  const input = {
    space, revision: edited, walls,
    zeroWalls: { contour: [], barriers: [], transmissive: [] },
    wallKeyPitch: 1, cellCm: 5, gridPitch: 5, coordScale: 1,
    physicalBodies: () => [],
  };
  const reused = buildLightBarrierScene({ ...input, sharedWallGeometry });
  assert.equal(wallIterations, 1, 'matching source tag avoids the second wall rebuild traversal');
  assert.ok(reused.masonryGeometry.length);
  wallIterations = 0;
  const rebuilt = buildLightBarrierScene(input);
  assert.equal(wallIterations, 2, 'a scene without shared geometry must rebuild masonry');
  assert.deepEqual(reused, rebuilt, 'recut and uncached rebuild retain identical light geometry');
  const changedRevision = revisionFor({ ...raw, wall_style: 'changed' });
  wallIterations = 0;
  buildLightBarrierScene({
    ...input, revision: changedRevision, sharedWallGeometry,
  });
  assert.equal(wallIterations, 2, 'architectural changes reject the old shared-masonry tag');
});

test('shared light revision admits only floor-to-floor architectural passages', () => {
  const space = {
    id: 's', rooms: [square('left', 0, 100), square('right', 100, 200)],
    partitions: [], room_drafts: [], wall_columns: [],
  };
  const opening = (id, type, rx, amount) => ({
    id, type, rx, ry: 50, rlen: 40, angle: 90, amount,
    contact: type === 'door' ? `binary_sensor.${id}` : null,
  });
  const openings = [
    opening('inside-door', 'door', 100, 0.51),
    opening('outside-door', 'door', 0, 1),
    opening('window', 'window', 100, 1),
    opening('passage', 'passage', 100, 1),
  ];
  const revision = resolveLightBarrierRevision({
    rawSpaceConfig: { id: 's', rooms: space.rooms },
    space,
    openings,
    cellCm: 5,
    gridPitch: 20,
    openingAmount: (candidate) => candidate.amount,
  });
  assert.deepEqual(
    revision.passageStates.map(({ opening: candidate }) => candidate.id),
    // Glass candidates receive their host/interval proof on the structural miss.
    ['inside-door', 'window', 'passage'],
  );
  assert.equal(revision.passageStates[0].amount, 0.5);

  const sameBucket = resolveLightBarrierRevision({
    rawSpaceConfig: { id: 's', rooms: space.rooms }, space,
    openings: openings.map((candidate) => candidate.id === 'inside-door'
      ? { ...candidate, amount: 0.52 } : candidate),
    cellCm: 5, gridPitch: 20,
    openingAmount: (candidate) => candidate.amount,
  });
  assert.equal(sameBucket.fingerprint, revision.fingerprint,
    'leaf animation inside one quantised aperture bucket must reuse barriers');

  const nextBucket = resolveLightBarrierRevision({
    rawSpaceConfig: { id: 's', rooms: space.rooms }, space,
    openings: openings.map((candidate) => candidate.id === 'inside-door'
      ? { ...candidate, amount: 0.8 } : candidate),
    cellCm: 5, gridPitch: 20,
    openingAmount: (candidate) => candidate.amount,
  });
  assert.notEqual(nextBucket.fingerprint, revision.fingerprint);
});

test('one shared source projection owns radius, colour and marker-stable identity', () => {
  const device = {
    id: 'lamp', name: 'Lamp', model: '', area: 'living', space: 's',
    icon: 'mdi:lightbulb', entities: [], virtual: true,
    marker: {
      id: 'lamp', binding: 'virtual', is_light: true,
      glow_radius_cm: 175, glow_color: { c: '#123456' },
    },
  };
  const [candidate] = resolveGlowCandidates({
    hass: { states: {} }, devices: [device], spaceId: 's',
    defaultColor: '#ffffff', paletteAlpha: 0.7,
    defaultRadiusUnits: 1200, cellCm: 5, gridPitch: 20,
    position: () => ({ x: 25, y: 75 }),
  });
  assert.equal(candidate.key, 's|lamp');
  assert.equal(candidate.sourceEid, '');
  assert.deepEqual(candidate.pos, { x: 25, y: 75 });
  assert.equal(candidate.radius, 700);
  assert.equal(candidate.appearance.c, '#123456');
  assert.ok(candidate.appearance.alpha > 0 && candidate.appearance.alpha <= 0.7);
});

test('shared Glow runtime is bounded and tears down every timer and source', () => {
  let seq = 0;
  const timers = new Set();
  const rafs = new Set();
  const fakeWindow = {
    setTimeout: () => { const id = ++seq; timers.add(id); return id; },
    clearTimeout: (id) => timers.delete(id),
    requestAnimationFrame: () => { const id = ++seq; rafs.add(id); return id; },
    cancelAnimationFrame: (id) => rafs.delete(id),
  };
  const host = {
    window: () => fakeWindow,
    isConnected: () => true,
    requestUpdate: () => undefined,
    reducedMotion: () => false,
  };
  const state = createGlowRuntimeState();
  const entering = transitionGlowSource(state, host, 's|lamp', true);
  assert.equal(entering.entering, true);
  assert.equal(state.renderedSources.has('s|lamp'), true);
  transitionGlowSource(state, host, 's|lamp', false);
  assert.equal(state.fadeTimers.has('s|lamp'), true);

  for (let index = 0; index < 300; index++) {
    writeGlowClip(state, `clip-${index}`, { lit: [`M ${index} 0 Z`] }, 256);
  }
  assert.equal(state.clipCache.size, 256);
  assert.equal(readGlowClip(state, 'clip-299').hit, true);
  assert.equal(readGlowClip(state, 'clip-0').hit, false);

  disposeGlowRuntime(state, host);
  assert.equal(state.renderedSources.size, 0);
  assert.equal(state.clipCache.size, 0);
  assert.equal(state.fadeTimers.size, 0);
  assert.equal(timers.size, 0);
  assert.equal(rafs.size, 0);
});

test('space card exposes one explicit default-off visual-editor flag', () => {
  const card = readFileSync(new URL('../src/space-card.ts', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('../src/space-editor.ts', import.meta.url), 'utf8');
  assert.match(card, /light_pools\?: boolean/);
  assert.match(card, /light_pools: false/);
  assert.match(card, /lightPools: this\._config\.light_pools === true/);
  assert.match(editor, /name: 'light_pools', selector: \{ boolean: \{\} \}/);
  assert.match(editor, /light_pools: settingsT\(L, 'editor\.light_pools'\)/);
});

test('#850 AC4(а): the architectural fingerprint is computed once per raw floor record, epoch and scale', async () => {
  // The memo is the live runtime's (the View's lazy chunk); without it the card computes it every pass.
  const { LiveRuntime } = await import('../test-build/live-interaction-runtime.js');
  const host = { _mode: 'view', _cfgEpoch: 1, _cellCm: 5, _gridPitch: 20 };
  const runtime = new LiveRuntime(host);
  assert.equal(typeof runtime.geometry, 'function', 'the View remembers the architectural fingerprint');
  const builds = () => runtime.work().lightGeometry;
  const record = { id: 'f', rooms: [square('room', 0, 100)], walls: [{ key: 'w', a: [0, 0], b: [100, 0], cm: 20 }],
    openings: [], led_strips: [{ id: 'led', points: [[0, 0], [1, 0]], marker: null }] };
  const first = runtime.geometry(record);
  assert.equal(first, lightGeometryFingerprint(record, 5, 20));
  // HA ticks, camera and hover passes of View: the same record, epoch and scale.
  for (let pass = 0; pass < 100; pass++) assert.equal(runtime.geometry(record), first);
  assert.equal(builds(), 1, 'one computation for a hundred render passes');
  // Every config write bumps the epoch (`_saveConfig`): an in-place wall edit is seen.
  record.walls[0].cm = 40;
  host._cfgEpoch = 2;
  const edited = runtime.geometry(record);
  assert.notEqual(edited, first, 'a wall edit is a new fingerprint');
  assert.equal(edited, lightGeometryFingerprint(record, 5, 20));
  // A config replaced from the server brings new records under the same floor id.
  const replaced = { ...record, walls: [{ ...record.walls[0], cm: 60 }] };
  assert.equal(runtime.geometry(replaced), lightGeometryFingerprint(replaced, 5, 20),
    'a record of the same floor id is not the same geometry');
  const opened = { ...replaced, openings: [{ id: 'o', type: 'door', rx: 50, ry: 0, rlen: 20, angle: 0 }] };
  assert.equal(runtime.geometry(opened), lightGeometryFingerprint(opened, 5, 20), 'an added opening as well');
  host._cellCm = 10;
  assert.equal(runtime.geometry(opened), lightGeometryFingerprint(opened, 10, 20), 'cell_cm is an input');
  host._gridPitch = 40;
  assert.equal(runtime.geometry(opened), lightGeometryFingerprint(opened, 10, 40), 'the grid pitch is an input');
  // An editor may mutate the record during a gesture without a new epoch:
  // every editor pass is fresh, and View never reuses what it remembered before the edit.
  const before = builds();
  host._mode = 'plan';
  opened.walls[0].cm = 80;
  assert.equal(runtime.geometry(opened), lightGeometryFingerprint(opened, 10, 40));
  assert.equal(runtime.geometry(opened), lightGeometryFingerprint(opened, 10, 40));
  assert.equal(builds(), before + 2, 'an editor pass never hits');
  opened.walls[0].cm = 90;
  host._mode = 'view';
  assert.equal(runtime.geometry(opened), lightGeometryFingerprint(opened, 10, 40), 'back in View: no stale entry');
  runtime.dispose();
  const disposed = builds();
  runtime.geometry(opened);
  assert.equal(builds(), disposed + 1, 'disconnect forgets the remembered fingerprints');
  // The door state is not in this part: the same remembered geometry, a new door amount, a new revision.
  const space = { id: 's', rooms: [square('left', 0, 100), square('right', 100, 200)] };
  const door = { id: 'd', type: 'door', rx: 100, ry: 50, rlen: 40, angle: 90, contact: 'binary_sensor.d' };
  const revision = (amount) => resolveLightBarrierRevision({
    rawSpaceConfig: { id: 's', rooms: space.rooms }, space, openings: [door], cellCm: 5, gridPitch: 20,
    openingAmount: () => amount, geometryFingerprint: 'remembered',
  });
  assert.equal(revision(0).geometryFingerprint, 'remembered', 'the caller remembers the architectural part');
  assert.notEqual(revision(0).fingerprint, revision(1).fingerprint, 'opening a door changes the scene in the same pass');
});
