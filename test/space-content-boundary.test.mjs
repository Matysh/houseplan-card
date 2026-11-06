import test from 'node:test';
import assert from 'node:assert/strict';
import { spaceHasContent } from '../test-build/space-content.js';
const empty = { id: 'empty', view_box: [0, 0, 8, 8], plan_graph: { nodes: [], edges: [], rooms: [] } };
test('camera bounds, settings and empty graph metadata do not count as content', () => {
  assert.equal(spaceHasContent({ ...empty, settings: { hide_devices: true } }, [], []), false);
});
test('all saved content families count independently of hidden presentation', () => {
  for (const key of ['rooms', 'wall_segments', 'partitions', 'wall_columns', 'openings', 'open_spans', 'decor', 'stairs', 'led_strips']) {
    assert.equal(spaceHasContent({ ...empty, [key]: [{ hidden: true }] }, [], []), true, key);
  }
  assert.equal(spaceHasContent({ ...empty, plan_url: '/plan.svg', plan_opacity: 0 }, [], []), true);
  assert.equal(spaceHasContent({ ...empty, plan_graph: { edges: [{}] } }, [], []), true);
});
test('hidden and unavailable assigned devices count; foreign devices and removed markers do not', () => {
  assert.equal(spaceHasContent(empty, [{ space: 'empty', hidden: true }], []), true);
  assert.equal(spaceHasContent(empty, [], [{ space: 'empty', hidden: true }]), true);
  assert.equal(spaceHasContent(empty, [{ space: 'other' }], [{ space: 'empty', removed: true }]), false);
});
