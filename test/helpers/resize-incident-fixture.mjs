import { migrateGraphSpace } from '../../test-build/plan-graph.js';
import { commitGraphEdit } from '../../test-build/graph-edit-intent.js';

export function incidentResizeFixture() {
  const room = (id, x0, y0, x1, y1) => ({ id, name: id, area: null,
    poly: [[x0,y0],[x1,y0],[x1,y1],[x0,y1]], custom: { keep: id } });
  let before = migrateGraphSpace({ id: 'incident', title: 'Incident fixture', cell_cm: 20, view_box: [0,0,1,1], extra: { keep: true }, rooms: [
    room('upper-left',.1,.15,.5,.5), room('upper-right',.5,.15,.9,.5),
    room('lower-left',.1,.5,.5,.85), room('lower-right',.5,.5,.9,.85), room('remote',.1,.85,.5,1.2)],
    partitions: [{ id: 'independent', a: [.1,.5], b: [.5,.5], cm: 13, custom: { keep: 'separate material' } }],
    decor: [{ id: 'd', kind: 'text', x: 2, y: 2, text: 'keep' }],
  }).space;
  before = commitGraphEdit(before, structuredClone(before), { kind: 'thickness', cm: 37,
    edges: before.wall_segments.filter(w => w.a[1] === w.b[1]).map(w => ({ kind: 'wall', id: w.id })) });
  return before;
}

export function incidentResizeDraft(before) {
  const draft = structuredClone(before);
  for (const room of draft.rooms) if (room.id.startsWith('upper-'))
    room.poly = room.poly.map(([x,y]) => [x === .5 ? .45 : x, y]);
  return draft;
}

export function incidentResizeOpening(before) {
  const host = before.wall_segments.find(w => w.a[1] === .5 && w.b[1] === .5
    && Math.min(w.a[0],w.b[0]) === .1 && Math.max(w.a[0],w.b[0]) === .5);
  const draft = structuredClone(before);
  draft.openings = [{ id: 'window', type: 'window', x: .475, y: .5, length: .02, angle: 0,
    host: { kind: 'wall', id: host.id, t: (.475-host.a[0])/(host.b[0]-host.a[0]) },
    contact: 'binary_sensor.synthetic', custom: { keep: true } }];
  return commitGraphEdit(before, draft, { kind: 'openings', ids: ['window'] });
}
