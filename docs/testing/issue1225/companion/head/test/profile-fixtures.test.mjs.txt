import test from 'node:test';
import assert from 'node:assert/strict';
import { currentProfile, legacyScreenDefaults, screenDefaults, profileView } from '../tests/lib/profile-fixtures.mjs';

test('v2 fixtures keep per-space presentation separate and legacy remains an explicit fixture', () => {
  const legacy = { ...legacyScreenDefaults(3), rotation: 90, summary: 'show', hidden_devices: 'show', controls: false,
    future: { sentinel: 'kept' } };
  const original = structuredClone(legacy), row = currentProfile(legacy);
  assert.deepEqual(legacy, original, 'fixture conversion never mutates the source');
  assert.deepEqual(row.default_view, { rotation: 90, zoom: 1, summary: 'show', center_summary: false, icon_scale: null, font_scale: null });
  assert.ok(!('rotation' in row) && !('hidden_devices' in row) && !('controls' in row));
  row.space_views = { f2: { ...row.default_view, rotation: 270, zoom: 2 } };
  const config = { settings: { external_screens: { version: 2, screens: [row] } } };
  assert.equal(profileView(config, 3, 'f2').rotation, 270);
  assert.equal(profileView(config, 3, 'f1').rotation, 90);
  assert.deepEqual(screenDefaults(4, 1), legacyScreenDefaults(4));
  assert.equal(screenDefaults(4).default_view.zoom, 1);
});
