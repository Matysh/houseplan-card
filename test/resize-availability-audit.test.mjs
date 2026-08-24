import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { optimizePlans } from '../test-build/plan-optimizer.js';
import {
  auditSafeResizeEligibility,
} from '../test-build/resize.js';
import { GRID_PITCH, NORM_W } from '../test-build/space-geometry.js';
import {
  thicknessCmAt, wallCmToUnits,
} from '../test-build/wall-thickness.js';

const fixture = (name) => JSON.parse(readFileSync(
  new URL(`./fixtures/${name}`, import.meta.url), 'utf8',
));
const clone = (value) => structuredClone(value);

function optimizedSpace(name) {
  const source = fixture(name).space;
  return optimizePlans({ spaces: [clone(source)], markers: [], settings: {} }, {}).config.spaces[0];
}

function auditSpace(space) {
  const cellCm = Number(space.cell_cm) > 0 ? Number(space.cell_cm) : 5;
  const rooms = (space.rooms || []).map((room) => ({
    id: room.id,
    poly: room.poly.map(([x, y]) => [x * NORM_W, y * NORM_W]),
  }));
  const openings = (space.openings || []).map((opening) => ({
    id: opening.id,
    x: opening.x * NORM_W,
    y: opening.y * NORM_W,
    length: opening.length * NORM_W,
    angle: opening.angle,
    type: opening.type,
    hosted: !!opening.host,
  }));
  const obstacles = [];
  for (const partition of space.partitions || []) {
    obstacles.push({
      kind: 'segment',
      a: partition.a.map((value) => value * NORM_W),
      b: partition.b.map((value) => value * NORM_W),
      half: wallCmToUnits(partition.cm, cellCm, GRID_PITCH) / 2,
    });
  }
  for (const draft of space.room_drafts || []) {
    for (let index = 0; index + 1 < draft.points.length; index++) {
      obstacles.push({
        kind: 'segment',
        a: draft.points[index].map((value) => value * NORM_W),
        b: draft.points[index + 1].map((value) => value * NORM_W),
        half: wallCmToUnits(Number(draft.segments?.[index]?.cm) || 15, cellCm, GRID_PITCH) / 2,
      });
    }
  }
  for (const column of space.wall_columns || []) {
    const half = wallCmToUnits(column.cm, cellCm, GRID_PITCH) / 2;
    obstacles.push({
      kind: 'circle',
      center: column.center.map((value) => value * NORM_W),
      radius: column.shape === 'square' ? half * Math.SQRT2 : half,
    });
  }
  const walls = (space.walls || []).filter((wall) =>
    Array.isArray(wall.a) && Array.isArray(wall.b)
    && wall.a.length >= 2 && wall.b.length >= 2);
  const wallKeyPitch = GRID_PITCH / NORM_W;
  const optionsFor = (_roomId, _edge, a, b) => {
    const cm = thicknessCmAt(walls, a, b, wallKeyPitch, NORM_W);
    const axis = Math.abs(a[0] - b[0]) <= GRID_PITCH * 0.05 ? 'v'
      : Math.abs(a[1] - b[1]) <= GRID_PITCH * 0.05 ? 'h' : null;
    const overlaps = walls.filter((wall) => {
      const wa = [wall.a[0] * NORM_W, wall.a[1] * NORM_W];
      const wb = [wall.b[0] * NORM_W, wall.b[1] * NORM_W];
      if (axis === 'h') {
        if (Math.abs(wa[1] - a[1]) > GRID_PITCH * 0.05
            || Math.abs(wb[1] - a[1]) > GRID_PITCH * 0.05) return false;
        return Math.min(Math.max(a[0], b[0]), Math.max(wa[0], wb[0]))
          - Math.max(Math.min(a[0], b[0]), Math.min(wa[0], wb[0])) > GRID_PITCH * 0.05;
      }
      if (axis === 'v') {
        if (Math.abs(wa[0] - a[0]) > GRID_PITCH * 0.05
            || Math.abs(wb[0] - a[0]) > GRID_PITCH * 0.05) return false;
        return Math.min(Math.max(a[1], b[1]), Math.max(wa[1], wb[1]))
          - Math.max(Math.min(a[1], b[1]), Math.min(wa[1], wb[1])) > GRID_PITCH * 0.05;
      }
      return false;
    });
    const cms = new Set(overlaps.map((wall) => Number(wall.cm)).filter((value) => value > 0));
    return {
      minDim: wallCmToUnits(30, cellCm, GRID_PITCH),
      eps: GRID_PITCH * 0.05,
      step: GRID_PITCH,
      movingHalf: cm > 0 ? wallCmToUnits(cm, cellCm, GRID_PITCH) / 2 : 0,
      obstacles,
      thicknessConflict: cms.size > 1,
    };
  };
  return auditSafeResizeEligibility(rooms, openings, optionsFor);
}

const EXPECTED = {
  'real-plan-first-floor.json': {
    total: 38,
    enabled: 8,
    disabled: {
      diagonal: 0, 'side-angle': 0, 'duplicate-physical-wall': 4,
      'partial-shared': 15, 'unequal-shared': 10, 'multiple-rooms': 0,
      'thickness-conflict': 1, 'opening-conflict': 0, 'invalid-geometry': 0,
    },
    byRoom: {
      'room-a': 'partial-shared enabled partial-shared unequal-shared duplicate-physical-wall unequal-shared unequal-shared enabled unequal-shared duplicate-physical-wall',
      'room-b': 'enabled duplicate-physical-wall unequal-shared partial-shared',
      'room-c': 'enabled unequal-shared unequal-shared partial-shared',
      'room-d': 'partial-shared partial-shared enabled partial-shared',
      'room-e': 'partial-shared enabled partial-shared partial-shared',
      'room-f': 'unequal-shared partial-shared partial-shared partial-shared',
      'room-g': 'partial-shared unequal-shared enabled unequal-shared',
      'room-h': 'partial-shared enabled thickness-conflict duplicate-physical-wall',
    },
    idDigest: 'bac14112c65ddbabd3e92867d3db722eeb6f5e9a54c56af8c29994e3e69345ec',
  },
  'real-plan-second-floor.json': {
    total: 37,
    enabled: 9,
    disabled: {
      diagonal: 0, 'side-angle': 3, 'duplicate-physical-wall': 0,
      'partial-shared': 18, 'unequal-shared': 7, 'multiple-rooms': 0,
      'thickness-conflict': 0, 'opening-conflict': 0, 'invalid-geometry': 0,
    },
    byRoom: {
      'room-a': 'partial-shared partial-shared enabled partial-shared',
      'room-b': 'partial-shared unequal-shared enabled partial-shared',
      'room-c': 'partial-shared enabled side-angle partial-shared',
      'room-d': 'partial-shared enabled partial-shared enabled',
      'room-e': 'partial-shared unequal-shared unequal-shared enabled',
      'room-f': 'side-angle unequal-shared enabled partial-shared side-angle',
      'room-g': 'enabled unequal-shared partial-shared partial-shared',
      'room-h': 'partial-shared unequal-shared partial-shared enabled partial-shared unequal-shared partial-shared partial-shared',
    },
    idDigest: 'dc6abb9c55fbcc81e32a53b1b76eee35ca51033b71ecd08433551e2af38cf6f2',
  },
};

function statusByRoom(audit) {
  const result = {};
  for (const handle of audit.handles) {
    const status = handle.resolution.enabled ? 'enabled' : handle.resolution.reason;
    (result[handle.roomId] ||= [])[handle.edge] = status;
  }
  return Object.fromEntries(Object.entries(result).map(([roomId, statuses]) => [
    roomId, statuses.join(' '),
  ]));
}

const handleLines = (audit) => audit.handles.map((handle) => (
  `${handle.id}=${handle.resolution.enabled ? 'enabled' : handle.resolution.reason}`
));

function assertExactAudit(name, audit) {
  const expected = EXPECTED[name];
  const lines = handleLines(audit);
  const details = `\nActual handles:\n${lines.join('\n')}`;
  assert.deepEqual({ total: audit.total, enabled: audit.enabled, disabled: audit.disabled }, {
    total: expected.total, enabled: expected.enabled, disabled: expected.disabled,
  }, `reason-count baseline changed for ${name}${details}`);
  assert.deepEqual(statusByRoom(audit), expected.byRoom,
    `per-edge status baseline changed for ${name}${details}`);
  const digest = createHash('sha256').update(lines.join('\n')).digest('hex');
  assert.equal(digest, expected.idDigest,
    `canonical endpoint/handle identity baseline changed for ${name}; actual digest ${digest}${details}`);
}

test('issue 292 measures exact post-Optimize availability on both real plans', () => {
  for (const name of Object.keys(EXPECTED)) {
    assertExactAudit(name, auditSpace(optimizedSpace(name)));
  }
});

test('issue 292 known second-floor shared wall has equivalent enabled owner handles', () => {
  const audit = auditSpace(optimizedSpace('real-plan-second-floor.json'));
  for (const [roomId, edge] of [['room-a', 2], ['room-b', 2]]) {
    const handle = audit.handles.find((entry) => entry.roomId === roomId && entry.edge === edge);
    assert.ok(handle?.resolution.enabled, `${roomId}:${edge} must be enabled`);
    assert.deepEqual(handle.resolution.plan.roomIds.slice().sort(), ['room-a', 'room-b']);
  }
});

test('issue 292 Optimize removes the confirmed false near-axis reasons only', () => {
  const raw = auditSpace(fixture('real-plan-second-floor.json').space);
  const optimized = auditSpace(optimizedSpace('real-plan-second-floor.json'));
  assert.deepEqual({
    diagonal: raw.disabled.diagonal,
    sideAngle: raw.disabled['side-angle'],
  }, { diagonal: 2, sideAngle: 6 });
  assert.deepEqual({
    diagonal: optimized.disabled.diagonal,
    sideAngle: optimized.disabled['side-angle'],
  }, { diagonal: 0, sideAngle: 3 });
  assert.equal(optimized.handles.some((handle) =>
    !handle.resolution.enabled && handle.resolution.reason === 'side-angle'), true,
  'true angled adjacency must remain disabled after near-axis repair');
});
