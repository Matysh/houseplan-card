import test from 'node:test';
import assert from 'node:assert/strict';
import { annotateGraphOpeningRuns, graphOpeningRun } from '../test-build/graph-opening-run.js';
import { migrateGraphSpace, projectGraphSpace } from '../test-build/plan-graph.js';
import { resolvePartitionOpeningCompat, resolvePartitionOpeningStrict, partitionOpeningCut,
  materializePartitionOpening, hostedOpeningIntervalsOverlap } from '../test-build/partition-openings.js';
import { physicalBodyParts, unionBodies, pointInPhysicalGeometry, scalePartitionOpeningCut } from '../test-build/physical-geometry.js';

const clone = value => JSON.parse(JSON.stringify(value));
const SCALE = 1000, PITCH = SCALE / 240;
const fixture = (reverse = false) => migrateGraphSpace({
  id: 's', cell_cm: 5, rooms: [{ id: 'triangle', poly: [[0, 0], [1, 0], [0, 1]] }],
  partitions: [{ id: 'p', a: reverse ? [1, .5] : [0, .5], b: reverse ? [0, .5] : [1, .5], cm: 15 }],
  openings: [{ id: 'window', type: 'window', x: .5, y: .5, angle: 0, length: .2,
    host: { kind: 'partition', id: 'p', t: .5 }, future: { keep: true } }],
}, { sourceModelVersion: 10 }).space;
const carriers = (space, scale = SCALE) => space.partitions.map(p => ({
  ...p, a: p.a.map(v => v * scale), b: p.b.map(v => v * scale),
}));
const annotated = (space, scale = SCALE) => {
  const result = carriers(space, scale);
  annotateGraphOpeningRuns(space.plan_graph, result, 'partition', scale);
  return result;
};
const resolve = (space, parts = annotated(space), opening = space.openings[0], strict = false, scale = SCALE) =>
  (strict ? resolvePartitionOpeningStrict : resolvePartitionOpeningCompat)(opening, parts, scale, 5, scale / 240);
const solid = (parts, cuts = []) => unionBodies(physicalBodyParts({ partitions: parts, wall_columns: [] }, 5, PITCH, 1e-6, cuts).all);
const child = (space, id) => space.plan_graph.edges.find(e => e.kind === 'partition' && e.id === id);

test('reused run metadata remains carrier-local and a replacement graph cannot reuse old coordinates', () => {
  const space = fixture(); annotated(space, 1);
  const first = annotated(space), second = annotated(space);
  const before = resolve(space, second).resolved;
  assert.ok(before);
  first[0].a[0] += 1;
  assert.equal(graphOpeningRun(first[0]), undefined);
  assert.deepEqual(resolve(space, second).resolved, before);
  const graph = clone(space.plan_graph);
  for (const node of graph.nodes) {
    assert.equal(node.p[0], 'l');
    node.p[1] = String(BigInt(node.p[1]) + 240n);
  }
  annotateGraphOpeningRuns(graph, second, 'partition', SCALE);
  assert.ok(second.every(carrier => !graphOpeningRun(carrier)), 'old projected carriers fail closed against the replacement graph');
  const translated = projectGraphSpace(space, graph).space;
  assert.equal(resolve(translated).resolved.center[0], before.center[0] + SCALE);
});

test('migrated anchorchild t=1 retains a valid crossing window and its exact persisted host', () => {
  const space = fixture(), frozen = clone(space), parts = annotated(space);
  assert.equal(space.partitions.length, 2, 'zero-wall crossing really split the source carrier');
  assert.deepEqual(space.openings[0].host.tq, ['1', '1']);
  assert.equal(space.openings[0].host.t, 1);
  assert.equal(resolve(space, carriers(space)).reason, 'does-not-fit', 'old per-child fit is falsifiably too short');
  for (const strict of [false, true]) {
    const result = resolve(space, parts, space.openings[0], strict);
    assert.equal(result.reason, null);
    assert.deepEqual(result.resolved.center, [500, 500]);
    assert.equal(result.resolved.t, 1, 'public t remains the anchor child parameter');
    assert.equal(result.resolved.axis.length, 500, 'public axis retains child semantics');
    assert.deepEqual(result.resolved.host, frozen.openings[0].host);
    assert.deepEqual(materializePartitionOpening(space.openings[0], result.resolved, SCALE), frozen.openings[0]);
  }
  assert.deepEqual(space, frozen);
});

test('full window slot cuts both graph children; far masonry remains present', () => {
  const space = fixture(), parts = annotated(space), resolved = resolve(space, parts).resolved;
  const cut = partitionOpeningCut(resolved), before = solid(parts), after = solid(parts, [cut]);
  assert.deepEqual(graphOpeningRun(cut).members, parts.map(p => p.id).sort());
  for (const point of [[450, 500], [550, 500]]) {
    assert.equal(pointInPhysicalGeometry(point, before), true);
    assert.equal(pointInPhysicalGeometry(point, after), false);
  }
  for (const point of [[350, 500], [650, 500]]) assert.equal(pointInPhysicalGeometry(point, after), true);
  const halfCut = scalePartitionOpeningCut(cut, .5);
  assert.equal(graphOpeningRun(halfCut).key, graphOpeningRun(cut).key);
  const half = solid(parts, [halfCut]);
  assert.equal(pointInPhysicalGeometry([475, 500], half), false);
  assert.equal(pointInPhysicalGeometry([525, 500], half), false);
  assert.equal(pointInPhysicalGeometry([425, 500], half), true);
});

test('run annotation is ephemeral, immutable and refreshed for each carrier scale', () => {
  const space = fixture(), raw = carriers(space, 1), before = JSON.stringify(raw), graphBefore = clone(space.plan_graph);
  annotateGraphOpeningRuns(space.plan_graph, raw, 'partition', 1);
  assert.equal(JSON.stringify(raw), before);
  assert.ok(graphOpeningRun({ ...raw[0] }), 'ordinary spreads retain derived context');
  assert.equal(graphOpeningRun(clone(raw[0])), undefined, 'JSON does not persist private run metadata');
  const scaled = raw.map(p => ({ ...p, a: p.a.map(v => v * SCALE), b: p.b.map(v => v * SCALE) }));
  assert.equal(graphOpeningRun(scaled[0]), undefined, 'stale inherited scale cannot authorize a run');
  annotateGraphOpeningRuns(space.plan_graph, scaled, 'partition', SCALE);
  assert.equal(resolve(space, scaled).reason, null);
  assert.throws(() => { graphOpeningRun(scaled[0]).members.push('forged'); }, TypeError);
  assert.deepEqual(space.plan_graph, graphBefore);
});

test('reversed host direction and non-unit exact tq preserve midpoint without changing the host', () => {
  for (const reverse of [false, true]) {
    let space = fixture(reverse);
    if (reverse) {
      const graph = clone(space.plan_graph);
      for (const edge of graph.edges.filter(e => e.kind === 'partition')) [edge.from, edge.to] = [edge.to, edge.from];
      const raw = clone(space);
      raw.openings[0].host = { ...raw.openings[0].host, t: 0, tq: ['0', '1'] };
      space = projectGraphSpace(raw, graph).space;
    }
    const parts = annotated(space), original = clone(space.openings[0]);
    const result = resolve(space, parts).resolved;
    assert.deepEqual(result.center, [500, 500]);
    assert.deepEqual(result.host, original.host);
    const near = { ...original, id: 'near', host: { ...original.host, t: 2 / 3, tq: ['2', '3'] }, length: .1 };
    const n = resolve(space, parts, near).resolved;
    assert.ok(n);
    assert.equal(n.center[0], reverse ? 1000 / 6 : 1000 / 3);
    assert.deepEqual(n.host.tq, ['2', '3']);
  }
});

test('openings on different children share one overlap reservation namespace', () => {
  const space = fixture(), parts = annotated(space), a = resolve(space, parts).resolved;
  const otherId = parts.find(p => p.id !== a.host.id).id;
  const b = resolve(space, parts, { ...space.openings[0], id: 'other', length: .1,
    host: { kind: 'partition', id: otherId, t: .1, tq: ['1', '10'] } }).resolved;
  assert.ok(b);
  assert.notEqual(a.host.id, b.host.id);
  assert.equal(hostedOpeningIntervalsOverlap(a, [b]), true);
  assert.equal(hostedOpeningIntervalsOverlap(b, [a]), true);
  const far = resolve(space, parts, { ...space.openings[0], id: 'far', length: .05,
    host: { kind: 'partition', id: otherId, t: .9, tq: ['9', '10'] } }).resolved;
  assert.equal(hostedOpeningIntervalsOverlap(a, [far]), false);
});

test('real run endpoints retain compat versus strict physical jamb policy', () => {
  const space = fixture(), parts = annotated(space), opening = { ...space.openings[0], length: .08,
    host: { ...space.openings[0].host, t: .09, tq: ['9', '100'] } };
  assert.equal(resolve(space, parts, opening, false).reason, null);
  assert.equal(resolve(space, parts, opening, true).reason, 'does-not-fit-jamb');
  assert.equal(resolve(space, parts, { ...opening, length: .12 }).reason, 'does-not-fit');
  assert.equal(resolve(space, parts, { ...space.openings[0], length: 1.01 }).reason, 'does-not-fit');
});

test('same-coordinate intentional detachment never supplies continuation', () => {
  const space = fixture(), graph = clone(space.plan_graph), first = child(space, 'p'), second = graph.edges.find(e => e.kind === 'partition' && e.id !== first.id);
  const shared = [first.from, first.to].find(id => second.from === id || second.to === id);
  const node = clone(graph.nodes.find(n => n.id === shared));
  node.id = 'intentional-detach'; graph.nodes.push(node);
  if (second.from === shared) second.from = node.id; else second.to = node.id;
  const detached = projectGraphSpace(space, graph).space, parts = annotated(detached);
  assert.equal(graphOpeningRun(parts[0]).members.length, 1);
  assert.equal(resolve(detached, parts).reason, 'does-not-fit');
});

test('different thickness, opaque metadata and zero-thickness physical continuity are not merged', () => {
  for (const variant of ['thickness', 'props', 'zero']) {
    const space = fixture(), graph = clone(space.plan_graph);
    const next = graph.edges.find(e => e.kind === 'partition' && e.id !== 'p');
    if (variant === 'thickness') next.cm = 20;
    else if (variant === 'zero') next.cm = 0;
    else next.props = { future: { protected: true } };
    const changed = projectGraphSpace(space, graph).space;
    assert.equal(resolve(changed).reason, 'does-not-fit', variant);
  }
});

test('perpendicular positive branch stays outside the run and stays opaque outside the crossing slot', () => {
  const space = fixture(), graph = clone(space.plan_graph), a = child(space, 'p');
  const at = a.to;
  graph.nodes.push({ id: 'branch-end', p: ['l', '120', '240'] });
  graph.edges.push({ kind: 'partition', id: 'branch', from: at, to: 'branch-end', cm: 15 });
  const branched = projectGraphSpace(space, graph).space, parts = annotated(branched), result = resolve(branched, parts);
  assert.equal(result.reason, null);
  assert.equal(graphOpeningRun(result.resolved).members.includes('branch'), false);
  const geometry = solid(parts, [partitionOpeningCut(result.resolved)]);
  assert.equal(pointInPhysicalGeometry([500, 550], geometry), true);
  assert.equal(pointInPhysicalGeometry([450, 500], geometry), false);
  assert.equal(pointInPhysicalGeometry([550, 500], geometry), false);
});

test('ambiguous collinear continuation is symmetric for every anchor, independent of array order', () => {
  const space = fixture(), graph = clone(space.plan_graph), a = child(space, 'p');
  graph.nodes.push({ id: 'duplicate-end', p: ['l', '288', '120'] });
  graph.edges.push({ kind: 'partition', id: 'duplicate', from: a.to, to: 'duplicate-end', cm: 15 });
  for (const candidate of [graph, { ...graph, edges: graph.edges.slice().reverse() }]) {
    const changed = projectGraphSpace(space, candidate).space, parts = annotated(changed);
    for (const p of parts) assert.deepEqual(graphOpeningRun(p).members, [p.id]);
    assert.equal(resolve(changed, parts).reason, 'does-not-fit');
  }
});

test('malformed or out-of-range exact host tq fails dark without changing its metadata', () => {
  const space = fixture(), parts = annotated(space);
  for (const tq of [['1', '0'], ['3', '2'], ['-1', '2'], ['not-a-number', '1']]) {
    const opening = { ...space.openings[0], host: { ...space.openings[0].host, tq } }, before = clone(opening);
    assert.equal(resolve(space, parts, opening).reason, 'invalid-position');
    assert.deepEqual(opening, before);
  }
});

test('a diagonal exact run fits and cuts across both children without axis snapping', () => {
  const space = migrateGraphSpace({ id: 's', cell_cm: 5, rooms: [],
    partitions: [{ id: 'a', a: [0, 0], b: [.5, .5], cm: 15 },
      { id: 'b', a: [.5, .5], b: [1, 1], cm: 15 }],
    openings: [{ id: 'window', type: 'window', x: .5, y: .5, angle: 45, length: .2,
      host: { kind: 'partition', id: 'a', t: 1 } }],
  }, { sourceModelVersion: 10 }).space;
  const parts = annotated(space), result = resolve(space, parts, space.openings[0], true);
  assert.equal(result.reason, null);
  assert.deepEqual(result.resolved.center, [500, 500]);
  assert.equal(result.resolved.angle, 45);
  const before = solid(parts), after = solid(parts, [partitionOpeningCut(result.resolved)]);
  for (const point of [[450, 450], [550, 550]]) {
    assert.equal(pointInPhysicalGeometry(point, before), true);
    assert.equal(pointInPhysicalGeometry(point, after), false);
  }
  assert.equal(pointInPhysicalGeometry([350, 350], after), true);
});
