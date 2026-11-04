// #1285/#1287: the deletion invariant includes the production config/layout
// candidates. Fixture placement is arranged with the existing placement writer.
import assert from 'node:assert/strict';
import * as roomDeletion from '../../test-build/room-deletion.js';
import { markerDeletionCandidate } from '../../test-build/marker-deletion.js';
import { createSpaceDeletionCandidate } from '../../test-build/space-deletion.js';
import { rewriteMarkerRoomReferences } from '../../test-build/room-reference-transaction.js';
import { applyDevicePlacement } from '../../test-build/device-position-history.js';
import { emptyPlan, editorStep, graphInvariant, fixedPointPairInvariant, random,
  SequencePrecondition } from './graph-editor-sequences.mjs';

const copy = structuredClone;
const context = { ownerRoster: { authoritative: true, entityIds: ['light.synthetic'], deviceIds: ['synthetic'] } };
const primary = pair => pair.config.spaces.find(s => s.id === 'new-floor');
export const LAYOUT_OPERATIONS = ['labels', 'devices', 'delete-room', 'merge', 'delete-markers',
  'new-space', 'delete-space', 'blocked-space'];

export function layoutSequence(seed, family) {
  const next = random(seed), x = 12 + next(60), y = 12 + next(60);
  const ops = [
    { kind: 'face', id: 'a', poly: [[x, y], [x + 60, y], [x + 60, y + 80], [x, y + 80]] },
    { kind: 'face', id: 'b', poly: [[x + 60, y], [x + 120, y], [x + 120, y + 80], [x + 60, y + 80]] },
    { kind: 'thickness', room: 'a', cm: [5, 10, 20][next(3)] },
    { kind: 'labels', x: x + 10 + next(30), y: y + 10 + next(30) },
    { kind: 'devices', x: x + 12 + next(30), y: y + 12 + next(30) },
  ];
  if (next(2)) ops.push({ kind: 'resize', room: 'a', steps: next(2) ? 1 : -1 });
  switch (family % 7) {
    case 0: ops.push({ kind: 'delete-room', id: 'a', keepWalls: !!next(2) },
      { kind: 'delete-markers', ids: ['virtual'] }); break;
    case 1: ops.push({ kind: 'merge', keep: 'a', drop: 'b' }); break;
    case 2: ops.push({ kind: 'new-space' }, { kind: 'blocked-space' },
      { kind: 'delete-markers', ids: ['virtual', 'physical'] }, { kind: 'delete-space', removeMarkers: false }); break;
    case 3: ops.push({ kind: 'new-space' }, { kind: 'delete-space', removeMarkers: true }); break;
    case 4: ops.push({ kind: 'delete-markers', ids: ['virtual'] },
      { kind: 'delete-markers', ids: ['physical'] }); break;
    case 5: ops.push({ kind: 'delete-space', removeMarkers: !!next(2) }); break;
    case 6: ops.push({ kind: 'delete-room', id: 'a', keepWalls: !!next(2) },
      { kind: 'delete-room', id: 'b', keepWalls: !!next(2) }); break;
  }
  return ops;
}

export function layoutStep(pair, op) {
  let config = copy(pair.config), layout = copy(pair.layout);
  const before = primary(pair);
  switch (op.kind) {
    case 'labels':
      for (const id of ['a', 'b']) {
        if (!before?.rooms.some(r => r.id === id)) throw new SequencePrecondition('label room');
        layout = applyDevicePlacement(layout, 'rl_' + id, { x: op.x / 240, y: op.y / 240, s: before.id });
      }
      break;
    case 'devices':
      if (!before?.rooms.some(r => r.id === 'a') || !before.rooms.some(r => r.id === 'b'))
        throw new SequencePrecondition('device rooms');
      config.markers = [{ id: 'virtual', binding: 'virtual', space: before.id, room_id: 'a' },
        { id: 'physical', binding: 'device:synthetic', space: before.id, room_id: 'b' }];
      for (const id of ['virtual', 'physical', 'lg_light.synthetic'])
        layout = applyDevicePlacement(layout, id, { x: op.x / 240, y: op.y / 240, s: before.id });
      break;
    case 'new-space': {
      const space = emptyPlan(); space.id = 'other-floor';
      config.spaces.push(space);
      config.markers.push({ id: 'kept', binding: 'virtual', space: space.id });
      layout = applyDevicePlacement(layout, 'kept', { x: 16 / 240, y: 24 / 240, s: space.id });
      break;
    }
    case 'blocked-space':
    case 'delete-space': {
      if (!before) throw new SequencePrecondition('deleted space');
      const candidate = createSpaceDeletionCandidate(config, layout, before.id, op.removeMarkers ?? false);
      if (op.kind === 'blocked-space') {
        assert.ok(candidate.dependencies.count > 0, 'real device dependencies block deletion');
        assert.deepEqual(candidate.config, pair.config);
        assert.deepEqual(candidate.layout, pair.layout);
      } else {
        assert.ok(!candidate.config.spaces.some(s => s.id === before.id));
        assert.ok(!Object.values(candidate.layout).some(p => p.s === before.id));
        if (pair.layout.kept) {
          assert.deepEqual(candidate.layout.kept, pair.layout.kept, 'another floor keeps its position');
          assert.deepEqual(candidate.config.markers.find(m => m.id === 'kept'), pair.config.markers.find(m => m.id === 'kept'));
        }
      }
      config = candidate.config; layout = candidate.layout; break;
    }
    case 'delete-markers': {
      const targets = op.ids.map(id => {
        const marker = config.markers.find(m => m.id === id && !m.removed);
        if (!marker) throw new SequencePrecondition('marker ' + id);
        return { id, binding: marker.binding };
      });
      const candidate = markerDeletionCandidate(config, targets, layout);
      assert.ok(candidate.layout, 'production marker deletion returns its paired layout candidate');
      config = candidate.candidate; layout = candidate.layout;
      for (const id of candidate.cleanupIds) assert.ok(!(id in layout), 'deleted marker leaves no position');
      for (const target of targets) {
        const marker = config.markers.find(m => m.id === target.id);
        if (target.binding === 'virtual') assert.equal(marker, undefined);
        else assert.equal(marker?.removed, true, 'HA deletion keeps its intended minimal tombstone');
      }
      break;
    }
    default: {
      if (!before) throw new SequencePrecondition('geometry space');
      const after = editorStep(before, op);
      config.spaces = config.spaces.map(s => s.id === before.id ? after : s);
      if (op.kind === 'delete-room' || op.kind === 'merge') {
        const refs = op.kind === 'delete-room' ? { kind: 'delete', roomId: op.id }
          : { kind: 'merge', keepId: op.keep, dropId: op.drop };
        config.markers = rewriteMarkerRoomReferences(config.markers, refs).markers;
        assert.equal(typeof roomDeletion.roomTopologyLayoutCandidate, 'function', 'production room/layout candidate exists');
        const candidate = roomDeletion.roomTopologyLayoutCandidate(before, after, layout);
        layout = candidate.layout;
        const removed = op.kind === 'delete-room' ? op.id : op.drop;
        assert.ok(!('rl_' + removed in layout), 'deleted/absorbed room label is gone');
        if (op.kind === 'merge') assert.deepEqual(layout['rl_' + op.keep], pair.layout['rl_' + op.keep]);
      }
    }
  }
  return { config, layout };
}

export function replayLayout(sequence, { cellCm = 5 } = {}) {
  let pair = { config: { model_version: 11, spaces: [emptyPlan(cellCm)], markers: [], settings: {} }, layout: {} };
  for (const [i, op] of sequence.entries()) {
    const snapshot = copy(pair);
    try {
      const next = layoutStep(pair, op);
      assert.deepEqual(pair, snapshot, 'paired candidate keeps its full source immutable');
      for (const space of next.config.spaces) graphInvariant(space);
      fixedPointPairInvariant(next.config, next.layout, context);
      pair = next;
    } catch (error) { error.step = i; throw error; }
  }
  return pair;
}
