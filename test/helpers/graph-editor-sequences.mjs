// #1285: replayable editor commands, starting at a genuinely empty current graph.
// No migration or Optimize is used to prepare or repair a generated plan.
import assert from 'node:assert/strict';
import { commitGraphEdit } from '../../test-build/graph-edit-intent.js';
import { projectGraphSpace, graphIndex, validateGraph, verifyGraphProjection } from '../../test-build/plan-graph.js';
import * as Q from '../../test-build/plan-exact.js';
import { nudgePlan } from '../../test-build/editors/plan-nudge.js';
import { annotateSpaceGraphOpeningRuns, graphOpeningRunTarget } from '../../test-build/graph-opening-run.js';
import { finalizeWallChainSpace } from '../../test-build/writer-fixed-point.js';
import { applyNodeDelete } from '../../test-build/wall-node-delete.js';
import { resolveSafeResize, applySafeResize } from '../../test-build/resize.js';
import { spaceModels, GRID_PITCH, GRID_STEP_N, NORM_W } from '../../test-build/space-geometry.js';
import { geometryOpenCuts } from '../../test-build/plan-geometry-preflight.js';
import { optimizePlans } from '../../test-build/plan-optimizer.js';

const copy = structuredClone;
const point = p => p.map(k => k / 240);
export const OPERATIONS = ['partition', 'on-edge', 'on-node', 'nudge', 'translate', 'detach',
  'remove-partition', 'face', 'opening', 'move-opening', 'thickness', 'resize',
  'merge', 'delete-room', 'finish', 'delete-node'];

export function emptyPlan(cellCm = 5) {
  return projectGraphSpace({ id: 'new-floor', title: 'Synthetic new plan', cell_cm: cellCm, rooms: [] },
    { version: 1, nodes: [], edges: [], rooms: [], dependencies: [] }).space;
}

// Invalid replay preconditions are separate from a product refusal/invariant
// failure. The shrinker must never replace a real failure with a missing ID.
export class SequencePrecondition extends Error {}
function requireValue(value, why) {
  if (!value) throw new SequencePrecondition(why);
  return value;
}
const partition = (space, id) => requireValue(space.partitions?.find(p => p.id === id), 'partition ' + id);
const room = (space, id) => requireValue(space.rooms?.find(r => r.id === id), 'room ' + id);

export function editorStep(space, op) {
  const draft = copy(space);
  switch (op.kind) {
    case 'partition':
    case 'on-edge':
    case 'on-node': {
      const p = { id: op.id, a: point(op.a), b: point(op.b), cm: op.cm ?? 10 };
      let refs;
      if (op.kind !== 'partition') {
        const roomHost = op.hostRoom && room(space, op.hostRoom);
        const wall = roomHost && space.wall_segments.find(w => roomHost.wall_ids.includes(w.id)
          && w.a[1] === w.b[1] && w.a[1] === Math.min(...roomHost.poly.map(p => p[1])));
        const host = requireValue(space.plan_graph.edges.find(e => e.id === (wall?.id ?? op.host)), 'named host');
        const index = graphIndex(space.plan_graph);
        let start;
        if (op.kind === 'on-edge') {
          const t = Q.decodeRational(op.t);
          start = Q.pointAt(index.points.get(host.from), index.points.get(host.to), t);
          refs = [{ kind: 'on-edge', edge: { kind: host.kind, id: host.id }, t: op.t,
            node: op.id + '-contact', splitIds: [op.id + '-child'] }, undefined];
        } else {
          const node = op.end === 'to' ? host.to : host.from;
          start = index.points.get(node);
          refs = [{ kind: 'existing-node', node }, undefined];
        }
        p.a = Q.pointToNumbers(start);
      }
      draft.partitions = [...draft.partitions ?? [], p];
      return commitGraphEdit(space, draft, { kind: 'partitions', ids: [op.id],
        ...(refs ? { endpointRefs: { [op.id]: refs } } : {}) });
    }
    case 'nudge': {
      partition(space, op.id);
      const moved = nudgePlan(space, { kind: 'partition', id: op.id }, op.dx / 240, op.dy / 240, space.cell_cm);
      assert.ok(moved, 'a generated free wall permits its complete keyboard step');
      return commitGraphEdit(space, moved, { kind: 'partitions', ids: [op.id] });
    }
    case 'translate':
    case 'detach': {
      const p = partition(draft, op.id);
      // Translate uses precisely the float arithmetic of a grid-authored body
      // target. Detach names new grid targets, including a previously q T-end.
      if (op.kind === 'detach') { p.a = point(op.a); p.b = point(op.b); }
      else { p.a = p.a.map((v, i) => v + (i ? op.dy : op.dx) / 240);
        p.b = p.b.map((v, i) => v + (i ? op.dy : op.dx) / 240); }
      return commitGraphEdit(space, draft, { kind: 'partitions', ids: [op.id] });
    }
    case 'remove-partition': {
      partition(space, op.id);
      draft.partitions = draft.partitions.filter(p => p.id !== op.id);
      draft.openings = (draft.openings ?? []).filter(o => o.host?.kind !== 'partition' || o.host.id !== op.id);
      return commitGraphEdit(space, draft, { kind: 'partitions', ids: [op.id] });
    }
    case 'face': {
      draft.rooms.push({ id: op.id, name: op.id, poly: op.poly.map(point) });
      return commitGraphEdit(space, draft, { kind: 'faces', rooms: [op.id] });
    }
    case 'thickness': {
      if (op.room) { room(space, op.room);
        return commitGraphEdit(space, draft, { kind: 'thickness', rooms: [op.room], cm: op.cm }); }
      // A new selection after compaction comes from the currently painted
      // carrier, not the retired child ID from an earlier gesture.
      const selected = op.anchor ? (space.partitions ?? []).filter(p => [p.a, p.b]
        .some(end => end.every((v, i) => v === op.anchor[i] / 240))) : [];
      if (op.anchor) requireValue(selected.length === 1, 'unique current support selection');
      const id = op.anchor ? selected[0].id : op.id;
      const edge = requireValue(space.plan_graph.edges.find(e => e.id === id), 'edge ' + id);
      return commitGraphEdit(space, draft, { kind: 'thickness', edges: [edge], cm: op.cm });
    }
    case 'opening':
    case 'move-opening': {
      let host;
      if (op.kind === 'opening') {
        if (op.partition) host = partition(space, op.partition);
        else {
          const r = room(space, op.room);
          host = requireValue(space.wall_segments.find(w => r.wall_ids.includes(w.id)
            && w.a[1] === w.b[1] && w.a[1] === Math.min(...r.poly.map(p => p[1]))), 'top wall');
        }
      } else {
        const o = requireValue(space.openings?.find(o => o.id === op.id), 'opening ' + op.id);
        host = requireValue((o.host.kind === 'partition' ? space.partitions : space.wall_segments)
          .find(w => w.id === o.host.id), 'opening host');
      }
      annotateSpaceGraphOpeningRuns(draft);
      const dx = host.b[0] - host.a[0], dy = host.b[1] - host.a[1], length = Math.hypot(dx, dy);
      const physical = op.alongSteps === undefined ? [op.x / 240, host.a[1]]
        : [host.a[0] + dx / length * op.alongSteps / 240, host.a[1] + dy / length * op.alongSteps / 240];
      const carriers = op.partition ? draft.partitions : draft.wall_segments;
      const target = graphOpeningRunTarget(carriers, host.id, physical);
      assert.ok(target, 'real run target exists');
      const opening = { ...(draft.openings?.find(o => o.id === op.id) ?? {}),
        id: op.id, type: 'door', length: 6 / 240, angle: Math.atan2(dy, dx) * 180 / Math.PI,
        x: target.normalized[0], y: target.normalized[1], host: target.host };
      draft.openings = [...(draft.openings ?? []).filter(o => o.id !== op.id), opening];
      return commitGraphEdit(space, draft, { kind: 'openings', ids: [op.id] });
    }
    case 'resize': {
      const r = room(space, op.room);
      const inputs = space.rooms.map(r => ({ ...r, poly: r.poly.map(p => p.map(v => v * NORM_W)) }));
      const openings = (space.openings ?? []).map(o => ({ ...o, x: o.x * NORM_W,
        y: o.y * NORM_W, length: o.length * NORM_W, hosted: !!o.host }));
      const edge = r.poly.findIndex((p, i) => p[0] === r.poly[(i + 1) % r.poly.length][0]
        && p[0] === Math.max(...r.poly.map(p => p[0])));
      requireValue(edge >= 0, 'right Resize side');
      const resolution = resolveSafeResize(inputs, openings, op.room, edge,
        { eps: GRID_PITCH * .05, step: GRID_PITCH, minDim: GRID_PITCH * 6 });
      assert.ok(resolution.enabled, 'real Resize solver grants the generated side');
      const moved = applySafeResize(inputs, openings, resolution.plan, op.steps * GRID_PITCH);
      for (const r of draft.rooms) if (moved.polys[r.id]) r.poly = moved.polys[r.id].map(p => p.map(v => v / NORM_W));
      for (const o of draft.openings ?? []) if (moved.openings[o.id])
        [o.x, o.y] = moved.openings[o.id].map(v => v / NORM_W);
      return commitGraphEdit(space, draft, { kind: 'resize', rooms: resolution.plan.roomIds });
    }
    case 'merge': {
      const a = room(space, op.keep), b = room(space, op.drop), points = [...a.poly, ...b.poly];
      const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
      draft.rooms = draft.rooms.filter(r => r.id !== op.drop);
      room(draft, op.keep).poly = [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.min(...ys)],
        [Math.max(...xs), Math.max(...ys)], [Math.min(...xs), Math.max(...ys)]];
      return commitGraphEdit(space, draft, { kind: 'merge-rooms', keep: op.keep, drop: op.drop,
        sourceEdges: space.plan_graph.edges });
    }
    case 'delete-room': {
      room(space, op.id);
      draft.rooms = draft.rooms.filter(r => r.id !== op.id);
      return commitGraphEdit(space, draft, { kind: 'delete-room', room: op.id, keepWalls: op.keepWalls });
    }
    case 'finish': {
      const model = spaceModels({ model_version: 11, spaces: [space], markers: [], settings: {} })[0];
      return finalizeWallChainSpace(space, model, geometryOpenCuts(space, model), op.ids,
        { pitch: GRID_STEP_N, cellCm: space.cell_cm, gridPitch: GRID_PITCH, coordScale: NORM_W }).space;
    }
    case 'delete-node': {
      const a = requireValue(space.plan_graph.edges.find(e => e.id === op.a), 'first node carrier');
      const b = requireValue(space.plan_graph.edges.find(e => e.id === op.b), 'second node carrier');
      const node = requireValue([a.from, a.to].find(n => n === b.from || n === b.to), 'shared node');
      const result = applyNodeDelete(space, { node_id: node, point: Q.pointToNumbers(graphIndex(space.plan_graph).points.get(node)) });
      assert.equal(result.ok, true, 'native node deletion accepts generated corner');
      return result.space;
    }
    default: throw Error('Unknown operation: ' + op.kind);
  }
}

export function graphInvariant(space) {
  assert.equal(validateGraph(space.plan_graph, { hosts: space.openings ?? [] }).ok, true, 'graph and hosts valid');
  verifyGraphProjection(space, space.plan_graph);
}

export function fixedPointInvariant(space) {
  const config = { model_version: 11, spaces: [space], markers: [], settings: {} };
  return fixedPointPairInvariant(config, {});
}

export function fixedPointPairInvariant(config, layout, context = {}) {
  const snapshot = copy(config);
  const layoutSnapshot = copy(layout);
  const optimized = optimizePlans(config, layout, context);
  assert.deepEqual(config, snapshot, 'Optimize cannot mutate the input while examining it');
  assert.deepEqual(layout, layoutSnapshot, 'Optimize cannot mutate the input layout');
  assert.equal(optimized.changed, false, 'a completed native editor sequence leaves no Optimize work');
  assert.deepEqual(optimized.config, config);
  assert.deepEqual(optimized.layout, layout);
  assert.deepEqual(optimized.report.deadSpaceIds, []);
  for (const [name, value] of Object.entries(optimized.report)) {
    // total/currentPositions count examined items/saved live positions,
    // while modelFrom/To identify the schema.
    // They are observations, not claims that Optimize will change the plan.
    if (typeof value === 'number' && !['modelFrom', 'modelTo', 'total', 'currentPositions'].includes(name))
      assert.equal(value, 0, 'zero no-op report counter: ' + name);
  }
}

function editorEffects(before, after, op) {
  if (['nudge', 'translate', 'detach'].includes(op.kind)) {
    const old = partition(before, op.id), moved = partition(after, op.id);
    for (const end of ['a', 'b']) {
      const expected = op.kind === 'detach' ? point(op[end])
        : old[end].map((v, i) => (Math.round(v * 240) + (i ? op.dy : op.dx)) / 240);
      assert.deepEqual(moved[end], expected, 'the writer really applies its complete grid target');
    }
  }
  if (['partition', 'on-edge', 'on-node'].includes(op.kind)) assert.ok(partition(after, op.id));
  if (op.kind === 'remove-partition') assert.ok(!after.partitions?.some(p => p.id === op.id));
  if (op.kind === 'face') assert.ok(room(after, op.id));
  if (op.kind === 'delete-room') assert.ok(!after.rooms.some(r => r.id === op.id));
  if (op.kind === 'merge') {
    assert.ok(room(after, op.keep));
    assert.ok(!after.rooms.some(r => r.id === op.drop));
  }
  if (op.kind === 'resize') {
    const previous = Math.max(...room(before, op.room).poly.map(p => p[0]));
    const target = (Math.round(previous * 240) + op.steps) / 240;
    assert.equal(Math.max(...room(after, op.room).poly.map(p => p[0])), target, 'Resize applies the authored side step');
  }
  if (['opening', 'move-opening'].includes(op.kind)) {
    const opening = after.openings.find(o => o.id === op.id);
    if (op.alongSteps === undefined)
      assert.equal(opening?.x, op.x / 240, 'opening really reaches its named grid centre');
    else {
      const host = partition(before, op.partition);
      assert.ok(Math.abs(Math.hypot(opening.x - host.a[0], opening.y - host.a[1]) - op.alongSteps / 240) < 1e-14,
        'diagonal opening reaches the actual quantized distance along its host');
    }
  }
  if (op.kind === 'delete-node') assert.equal(after.plan_graph.edges.length, before.plan_graph.edges.length - 1);
}

export function replay(sequence, { cellCm = 5 } = {}) {
  let space = emptyPlan(cellCm);
  for (const [i, op] of sequence.entries()) {
    const snapshot = copy(space);
    try {
      const next = editorStep(space, op);
      assert.deepEqual(space, snapshot, 'writer keeps source immutable');
      editorEffects(space, next, op);
      graphInvariant(next);
      // A live collinear chain is finalized by its explicit next command.
      // Every other completed prefix is itself an editor sequence: later
      // deletion/translation must not hide maintenance debt from an earlier step.
      if (!(op.kind === 'on-node' && sequence[i + 1]?.kind === 'finish')) fixedPointInvariant(next);
      space = next;
    } catch (error) { error.step = i; throw error; }
  }
  fixedPointInvariant(space);
  return space;
}

// Deterministic PRNG: seed alone reproduces both the operations and their data.
export function random(seed) {
  let state = seed >>> 0;
  return n => { state += 0x6d2b79f5;
    let v = state; v = Math.imul(v ^ v >>> 15, v | 1); v ^= v + Math.imul(v ^ v >>> 7, v | 61);
    return ((v ^ v >>> 14) >>> 0) % n; };
}

export function generatedSequence(seed, family) {
  const next = random(seed), k = 3 + next(200), y = 30 + next(90), cm = [5, 10, 15, 25][next(4)];
  let ops;
  switch (family % 7) {
    case 0: ops = [{ kind: 'partition', id: 'free', a: [k, y], b: [k + 30, y + 20], cm },
      { kind: 'opening', id: 'diagonal-door', partition: 'free', alongSteps: 18 }]; break;
    case 1: {
      ops = [{ kind: 'partition', id: 'support', a: [24, 24], b: [120, 24 + next(3) * 32 + 3], cm },
        { kind: 'on-edge', id: 'branch', host: 'support', a: [72, 40], b: [72, 170], t: ['1', '2'], cm }];
      const end = next(3);
      if (end === 1) ops.push({ kind: 'detach', id: 'branch', a: [150, 160], b: [200, 160] });
      if (end === 2) ops.push({ kind: 'remove-partition', id: 'branch' });
      break;
    }
    case 2: ops = [{ kind: 'face', id: 'r', poly: [[k, y], [k + 40, y], [k + 80, y], [k + 80, y + 80], [k, y + 80]] },
      { kind: 'thickness', room: 'r', cm }]; break;
    case 3: ops = [{ kind: 'face', id: 'r', poly: [[k, y], [k + 80, y], [k + 80, y + 80], [k, y + 80]] },
      { kind: 'thickness', room: 'r', cm }, { kind: 'opening', id: 'door', room: 'r', x: k + 24 },
      { kind: 'move-opening', id: 'door', x: k + 30 + next(25) }, { kind: 'resize', room: 'r', steps: 1 + next(3) }]; break;
    case 4: ops = [{ kind: 'face', id: 'a', poly: [[k, y], [k + 40, y], [k + 40, y + 80], [k, y + 80]] },
      { kind: 'face', id: 'b', poly: [[k + 40, y], [k + 80, y], [k + 80, y + 80], [k + 40, y + 80]] },
      { kind: 'resize', room: 'a', steps: next(2) ? 1 : -1 },
      { kind: 'merge', keep: 'a', drop: 'b' }]; break;
    case 5: ops = [{ kind: 'partition', id: 'left', a: [k, y], b: [k + 30, y], cm },
      { kind: 'on-node', id: 'right', host: 'left', end: 'to', a: [k + 30, y], b: [k + 60, y], cm },
      { kind: 'finish', ids: ['left', 'right'] }]; break;
    case 6: ops = [{ kind: 'partition', id: 'left', a: [k, y], b: [k + 30, y + 20], cm },
      { kind: 'on-node', id: 'right', host: 'left', end: 'to', a: [k + 30, y + 20], b: [k + 60, y], cm },
      { kind: 'delete-node', a: 'left', b: 'right' }]; break;
  }
  // Additional actions operate on the SAME result. They are not independent
  // fixtures sampled repeatedly. IDs surviving topology edits are intentional.
  const targetLength = Math.max(ops.length + 1, 4 + next(9));
  let existingRoom = ['r', 'a'].find(id => ops.some(o => o.kind === 'face' && o.id === id));
  const free = family % 7 === 0 ? 'free' : family % 7 >= 5 ? 'left' : undefined;
  while (ops.length < targetLength) {
    const choice = next(4);
    if (free) {
      if (choice === 0 && family % 7 === 0 && next(2))
        ops.push({ kind: 'move-opening', id: 'diagonal-door', partition: free, alongSteps: next(2) ? 17 : 19 });
      else if (choice === 0) ops.push({ kind: 'thickness', id: free, cm: [5, 10, 20][next(3)] });
      else ops.push({ kind: choice === 1 ? 'translate' : 'nudge', id: free,
        dx: choice === 3 ? 0 : next(2) ? 1 : -1, dy: choice === 3 ? 1 : 0 });
    } else if (existingRoom) {
      if (choice === 0 && ops.length === targetLength - 1) {
        ops.push({ kind: 'delete-room', id: existingRoom, keepWalls: !!next(2) }); existingRoom = undefined;
      } else if (choice === 1) ops.push({ kind: 'thickness', room: existingRoom, cm: [0, 10, 20][next(3)] });
      else ops.push({ kind: 'resize', room: existingRoom, steps: next(2) ? 1 : -1 });
    } else ops.push({ kind: 'thickness', anchor: [24, 24], cm: [5, 10, 20][next(3)] });
  }
  return ops;
}

/** Delta debugging preserves the failure class and replay preconditions. */
export function shrink(sequence, fails) {
  let current = sequence;
  for (let size = Math.floor(current.length / 2); size >= 1; size = Math.floor(size / 2)) {
    for (let i = 0; i < current.length;) {
      const candidate = current.slice(0, i).concat(current.slice(i + size));
      if (candidate.length && fails(candidate)) { current = candidate; i = 0; }
      else i += size;
    }
  }
  return current;
}
