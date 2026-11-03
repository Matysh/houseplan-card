// Manual diagnostic, not a replacement for the retained #832 assertions.
// Run after `node process-next/catalog/prepare.mjs tests`.
import assert from 'node:assert/strict';
import { currentGraphFixture } from '../../../../test/helpers/graph-fixture.mjs';
import { commitGraphEditResult } from '../../../../test-build/graph-edit-intent.js';
import { checkSpacePhysicalGeometry } from '../../../../test-build/plan-geometry-preflight.js';

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const fixture = id => currentGraphFixture({ spaces: [{ id, cell_cm: 20, rooms: [
  { id: 'left', poly: rect(.1, .15, .5, .5) },
  { id: 'right', poly: rect(.5, .15, .9, .5) },
  { id: 'bottom-left', poly: rect(.1, .5, .5, .85), extension: { fixed: true } },
  { id: 'bottom-right', poly: rect(.5, .5, .9, .85) },
  { id: 'remote', poly: rect(.1, .85, .5, 1.2), extension: { untouched: true } },
] }] }).spaces[0];
const draftOf = source => {
  const draft = structuredClone(source);
  for (const room of draft.rooms) if (['left', 'right'].includes(room.id)) {
    room.poly = room.poly.map(([x, y]) => [x === .5 ? .45 : x, y]);
  }
  return draft;
};
const intent = { kind: 'resize', rooms: ['left', 'right'] };
const observe = (name, run) => {
  try { run(); console.log(JSON.stringify({ name, status: 'PASS' })); }
  catch (error) {
    console.log(JSON.stringify({ name, status: 'FAIL', error: String(error) }));
    process.exitCode = 1;
  }
};

observe('current graph inserts the fixed-neighbour split seam', () => {
  const source = fixture('split'), next = commitGraphEditResult(source, draftOf(source), intent).space;
  assert.equal(checkSpacePhysicalGeometry({ spaces: [next] }, source.id).ok, true);
  const bottom = next.rooms.find(room => room.id === 'bottom-left');
  console.log(JSON.stringify({ name: 'split observation', bottom: bottom.poly,
    horizontal: next.wall_segments.filter(s => s.a[1] === .5 && s.b[1] === .5) }));
  // A shared physical boundary must be split at the newly incident node,
  // rather than retained as a whole carrier plus a coincident shorter edge.
  assert.ok(bottom.poly.some(([x, y]) => x === .45 && y === .5), 'fixed neighbour lacks the incident split node');
});
observe('current resize never serializes the remote owner', () => {
  const source = fixture('bounded'), draft = draftOf(source);
  draft.rooms.find(room => room.id === 'remote').toJSON = () => { throw new Error('remote owner serialized'); };
  commitGraphEditResult(source, draft, intent);
});
observe('current graph remaps the opening to a split child', () => {
  let source = fixture('hosts');
  for (const cm of [37, 0]) {
    source = commitGraphEditResult(source, structuredClone(source), { kind: 'thickness', cm,
      edges: source.wall_segments.filter(s => (s.a[1] === s.b[1] ? 37 : 0) === cm)
        .map(s => ({ kind: 'wall', id: s.id })) }).space;
  }
  const host = source.wall_segments.find(s => s.a[1] === .5 && s.b[1] === .5
    && Math.min(s.a[0], s.b[0]) === .1 && Math.max(s.a[0], s.b[0]) === .5);
  const draft = structuredClone(source);
  draft.openings = [{ id: 'split-window', kind: 'window', x: .475, y: .5, angle: 0, length: .02,
    host: { kind: 'wall', id: host.id, t: (.475 - host.a[0]) / (host.b[0] - host.a[0]) }, extension: { preserve: true } }];
  source = commitGraphEditResult(source, draft, { kind: 'openings', ids: ['split-window'] }).space;
  const next = commitGraphEditResult(source, draftOf(source), intent).space;
  assert.equal(next.openings[0].x, .475);
  assert.equal(next.openings[0].y, .5);
  assert.deepEqual(next.openings[0].extension, { preserve: true });
  assert.ok(next.wall_segments.filter(s => s.a[0] === s.b[0]).every(s => s.cm === 0));
  const child = next.wall_segments.find(s => s.id === next.openings[0].host.id);
  assert.equal(child.cm, 37);
  assert.notEqual(child.id, host.id, 'opening remains attached to the unsplit original carrier');
});
