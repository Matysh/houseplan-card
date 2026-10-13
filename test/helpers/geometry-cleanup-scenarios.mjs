// #842 scenarios shared by test/geometry-cleanup-842.test.mjs and the
// generator of test/fixtures/842-geometry-cleanup.json (validated by
// tests_backend/test_geometry_cleanup_842.py).
import { editorWriteHarness, markerDraft, settle } from './editor-write-host.mjs';

/** A valid plan: rooms, a room-wall and a partition-hosted opening, partitions, columns with unknown fields. */
export function plan() {
  return {
    spaces: [{
      id: 'f1', title: 'Floor', view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: [
        { id: 'r-hall', name: 'Hall', area: null, poly: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]] },
        { id: 'r-kitchen', name: 'Kitchen', area: null, poly: [[0.5, 0.1], [0.9, 0.1], [0.9, 0.5], [0.5, 0.5]] },
      ],
      openings: [
        { id: 'o-room', type: 'door', x: 0.3, y: 0.1, angle: 0, length: 0.1 },
        { id: 'o-partition', type: 'door', x: 0.3, y: 0.7, angle: 0, length: 0.1,
          host: { kind: 'partition', id: 'p-host', t: 0.5 } },
      ],
      partitions: [
        { id: 'p-host', a: [0.2, 0.7], b: [0.4, 0.7], cm: 15 },
        { id: 'p-free', a: [0.6, 0.7], b: [0.8, 0.7], cm: 10, note: 'kept by the backend' },
      ],
      wall_columns: [
        { id: 'c-square', shape: 'square', center: [0.7, 0.85], cm: 30, angle: 0, finish: 'brick' },
        { id: 'c-round', shape: 'circle', center: [0.3, 0.85], cm: 20, label: 'pillar' },
      ],
    }],
    markers: [{ id: 'v_842', binding: 'virtual', name: 'Lamp', space: 'f1', area: null, room_id: null, hidden: false }],
    settings: {},
  };
}

/** AC2 fixtures: records the write filter rejects, with the K3 counts they produce. */
export const DAMAGED = {
  'duplicate id partition/column': (cfg) => {
    cfg.spaces[0].wall_columns.push({ id: 'p-free', shape: 'square', center: [0.5, 0.9], cm: 20, angle: 0 });
    return { partitions: 0, columns: 1, openings: 0 };
  },
  'degenerate partition': (cfg) => {
    cfg.spaces[0].partitions.push({ id: 'p-zero', a: [0.6, 0.6], b: [0.6, 0.6], cm: 15 });
    return { partitions: 1, columns: 0, openings: 0 };
  },
  'column off the canvas': (cfg) => {
    cfg.spaces[0].wall_columns.push({ id: 'c-far', shape: 'square', center: [6000, 0.5], cm: 20, angle: 0 });
    return { partitions: 0, columns: 1, openings: 0 };
  },
  'partition carrying an opening': (cfg) => {
    cfg.spaces[0].partitions.push({ id: 'p-lost', a: [0.6, 0.3], b: [0.6, 0.3], cm: 15 });
    cfg.spaces[0].openings.push({ id: 'o-lost', type: 'door', x: 0.6, y: 0.3, angle: 0, length: 0.05,
      host: { kind: 'partition', id: 'p-lost', t: 0.5 } });
    return { partitions: 1, columns: 0, openings: 1 };
  },
};

export const ids = (list) => (list || []).map((item) => item.id);
export const composition = (cfg) => {
  const space = cfg.spaces[0];
  return {
    rooms: ids(space.rooms), openings: ids(space.openings),
    partitions: ids(space.partitions), columns: ids(space.wall_columns),
  };
};
export const k3Body = (counts) => `confirm.geometry_cleanup_body:${JSON.stringify(counts)}`;

export function markerSave(config, reject = null) {
  const h = editorWriteHarness({ config, reject, marker: config.markers[0] });
  h.host._markerDialog = markerDraft(config.markers[0], { name: 'Lamp renamed' });
  return h;
}

/** The AC3 scenario whose documents the backend test validates (test/fixtures/842-geometry-cleanup.json). */
export async function cleanupScenario() {
  const before = plan();
  DAMAGED['partition carrying an opening'](before);
  DAMAGED['column off the canvas'](before);
  const h = markerSave(before);
  await h.runtime._saveMarker();
  await settle();
  const asked = h.activeConfirm()?.request?.message;
  h.answer(true);
  await settle();
  return { h, before, asked, cleaned: h.server.sets[0] };
}

