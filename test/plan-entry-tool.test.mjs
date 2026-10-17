import test from 'node:test';
import assert from 'node:assert/strict';
import { planEntryTool } from '../test-build/plan-entry-tool.js';

for (const key of ['rooms', 'wall_segments', 'partitions', 'wall_columns', 'stairs']) {
  test(`Plan entry selects a lone ${key} object, even without rooms or masonry`, () => {
    const space = { [key]: [{ cm: 0 }] };
    const before = structuredClone(space);
    assert.equal(planEntryTool(space), 'select');
    assert.deepEqual(space, before);
    assert.equal(planEntryTool({ [key]: [] }), 'draw');
  });
}
test('a current-space opening counts independently of visible geometry', () => {
  const openings = Object.freeze([Object.freeze({ id: 'door' })]);
  assert.equal(planEntryTool({}, openings), 'select');
  assert.equal(planEntryTool({}, []), 'draw');
  assert.equal(planEntryTool({}, null), 'draw');
});
test('non-Plan content and another floor do not count', () => {
  for (const content of [
    {}, { bg: {} }, { decor: [{}] }, { devices: [{}] }, { led_strips: [{}] },
    { otherSpace: { rooms: [{}], openings: [{}] } },
    { rooms: [], wall_segments: [], partitions: [], wall_columns: [], stairs: [] },
  ]) assert.equal(planEntryTool(content), 'draw');
});
