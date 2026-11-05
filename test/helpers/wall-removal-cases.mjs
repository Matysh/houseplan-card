/** Shared TS/Python corpus, produced by the native structural editor. */
import { commitWallSegmentModel } from '../../test-build/wall-segment-model.js';
import { commitGraphEditResult } from '../../test-build/graph-edit-intent.js';
const p = (x, y) => [x / 240, y / 240];
const segment = (id, a, b) => ({ id, a, b, cm: 20 });

export function wallRemovalCase(name) {
  const room = name.startsWith('room');
  const space = { id: 'f', title: 'Synthetic floor', view_box: [0, 0, 1, 1], plan_url: null,
    cell_cm: 5, rooms: [], partitions: [
      segment('short', p(44, 24), p(46, 24)),
      segment('q-low', p(24, 0), p(24, 24)), segment('q-high', p(24, 24), p(24, 48)),
    ] };
  if (room) {
    const poly = [p(24, 24), p(44, 24), p(44, 72), p(0, 72)], ids = ['long', 'right', 'bottom', 'left'];
    space.rooms = [{ id: 'room', name: 'Room', poly, wall_ids: ids }];
    space.wall_segments = poly.map((a, i) => segment(ids[i], a, poly[(i + 1) % 4]));
  } else space.partitions.unshift(segment('long', p(24, 24), p(44, 24)));
  const before = commitWallSegmentModel({ model_version: 10, spaces: [space], markers: [], settings: {} }).config;
  const draft = structuredClone(before.spaces[0]);
  const intent = room ? { kind: 'delete-room', room: 'room', keepWalls: name === 'room-keep' }
    : { kind: 'partitions', ids: ['long'] };
  if (room) draft.rooms = []; else draft.partitions = draft.partitions.filter(p => p.id !== 'long');
  const edit = commitGraphEditResult(before.spaces[0], draft, intent);
  return { before, after: { ...structuredClone(before), spaces: [edit.space] }, intent, operations: edit.operations };
}

export function wallRemovalProofCases() {
  const out = [];
  for (const name of ['t', 'room-drop']) {
    const c = wallRemovalCase(name);
    out.push({ name, before: c.before.spaces[0].plan_graph, after: c.after.spaces[0].plan_graph, expected: true });
  }
  const t = wallRemovalCase('t'), before = t.before.spaces[0].plan_graph, after = t.after.spaces[0].plan_graph;
  const merged = after.edges.find(e => e.id.startsWith('q-'));
  for (const name of ['thickness', 'properties', 'extension', 'retained-seam', 'rekey', 'gap']) {
    const old = structuredClone(before), next = structuredClone(after), edge = next.edges.find(e => e.id === merged.id);
    if (name === 'thickness') edge.cm = 25;
    if (name === 'properties') edge.props = { future: 'changed' };
    if (name === 'rekey') edge.id = 'new-id';
    if (name === 'retained-seam') {
      const seam = before.nodes.find(n => !after.nodes.some(other => other.id === n.id));
      next.nodes.push(structuredClone(seam));
    }
    if (name === 'extension') {
      const extra = { id: 'extra-old-node', p: ['l', '24', '60'] };
      old.nodes.push(extra); next.nodes.push(structuredClone(extra));
      const end = next.nodes.find(n => n.id === edge.to);
      // Extend the high end, regardless of the retained edge's orientation.
      const high = end.p[2] === '48' ? 'to' : 'from', former = edge[high];
      edge[high] = extra.id; next.nodes = next.nodes.filter(n => n.id !== former);
    }
    if (name === 'gap') old.edges = old.edges.filter(e => e.id !== 'q-low');
    out.push({ name, before: old, after: next, expected: false });
  }
  // A straight node deletion without any removed material is not an exemption.
  const onlyChain = structuredClone(before);
  onlyChain.edges = onlyChain.edges.filter(e => e.id.startsWith('q-'));
  const onlyMerged = structuredClone(after); onlyMerged.edges = onlyMerged.edges.filter(e => e.id.startsWith('q-'));
  out.push({ name: 'node-merge-only', before: onlyChain, after: onlyMerged, expected: false });
  const propertySource = structuredClone(before), propertyTarget = structuredClone(after);
  for (const edge of propertySource.edges.filter(e => e.id.startsWith('q-'))) edge.props = { a: 1, b: 2 };
  propertyTarget.edges.find(e => e.id === merged.id).props = { b: 2, a: 1 };
  out.push({ name: 'property-key-order', before: propertySource, after: structuredClone(propertyTarget), expected: true });
  propertyTarget.edges.find(e => e.id === merged.id).props.a = true;
  out.push({ name: 'boolean-is-not-number', before: propertySource, after: propertyTarget, expected: false });
  return out;
}
