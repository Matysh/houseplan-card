import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { modernDocument } from '../scripts/sh3d-convert/output.mjs';

test('#937 canonical emitter builds the real catalogue and hosts, not a changed version number', () => {
  const old = JSON.parse(readFileSync(new URL('../scripts/sh3d-convert/golden/flat-two-rooms.space-1.json', import.meta.url)));
  const { document, notes } = modernDocument(old.payload.config.spaces[0], { planOnly: true, now: '2000-01-01T00:00:00Z' });
  const space = document.payload.config.spaces[0];
  assert.equal(document.model_version, 10);
  assert.equal(space.wall_segments.length, 7);
  assert.ok(space.rooms.every(room => room.wall_ids.length === room.poly.length));
  assert.deepEqual(space.openings.map(opening => opening.host.kind), ['wall', 'wall']);
  assert.deepEqual(notes, []);
  assert.equal(document.transfer.plan_only, true);
  assert.deepEqual(document.placement_manifest, []);
});

test('#937 ordinary space carries exact markers/layout/content and an independent partition opening', () => {
  const space = { id: 'test', title: 'Test', cell_cm: 5, rooms: [], plan_url: '/local/test.png',
    partitions: [{ id: 'p1', a: [0.1, 0.2], b: [0.9, 0.2], cm: 20 }],
    openings: [{ id: 'o1', type: 'door', x: 0.5, y: 0.2, angle: 0, length: 0.1 }] };
  const marker = { id: 'v_test', binding: 'entity:light.test', space: 'test', name: 'Lamp' };
  const { document } = modernDocument(space, { markers: [marker], layout: { v_test: { x: 0.3, y: 0.4, s: 'test' } } });
  assert.equal(document.transfer, undefined, 'real bindings must not claim plan-only privacy');
  assert.equal(document.payload.config.spaces[0].wall_segments.length, 0);
  assert.equal(document.payload.config.spaces[0].openings[0].host.kind, 'partition');
  assert.deepEqual(document.placement_manifest, [{ layout_id: 'v_test', space_id: 'test',
    owner: 'marker', owner_id: 'v_test', binding: 'entity:light.test', label: 'Lamp', icon: null }]);
  assert.deepEqual(document.content_manifest, [{ kind: 'plan', owner: 'space', owner_id: 'test',
    field: 'plan_url', url: '/local/test.png', storage: 'external', exists_at_export: null }]);
});

test('#937 ambiguous opening carriers are reported, not chosen by array order', () => {
  const space = { id: 'test', title: 'Test', cell_cm: 5, rooms: [],
    partitions: ['a', 'b'].map(id => ({ id, a: [0.1, 0.2], b: [0.9, 0.2], cm: 20 })),
    openings: [{ id: 'o1', type: 'door', x: 0.5, y: 0.2, angle: 0, length: 0.1 }] };
  const result = modernDocument(space);
  assert.equal(result.document.payload.config.spaces[0].openings, undefined);
  assert.deepEqual(result.notes, [{ code: 'opening_ambiguous', id: 'o1' }]);
  assert.throws(() => modernDocument({ ...space, cell_cm: Infinity }), /non_finite/);
  assert.throws(() => modernDocument(space, { layout: { unknown: { x: 1, y: 1 } } }), /unknown/);
  assert.throws(() => modernDocument(space, { planOnly: true, markers: [{ id: 'unsafe', binding: 'entity:light.a' }] }), /invalid_plan_only/);
  assert.throws(() => modernDocument({ ...space, plan_url: '/local/a.png' }, { planOnly: true }), /invalid_plan_only/);
  assert.throws(() => modernDocument({ ...space, oversized: 'x'.repeat(2 * 1024 * 1024) }), /output_too_large/);
});
