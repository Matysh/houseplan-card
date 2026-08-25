import assert from 'node:assert/strict';
import test from 'node:test';

import { filterOpeningEntityCandidates } from '../test-build/logic.js';

const candidates = [
  { value: 'binary_sensor.garage_contact', label: 'Garage Door' },
  { value: 'binary_sensor.window_lounge', label: 'Living room' },
  { value: 'binary_sensor.attic_motion', label: 'Attic Motion' },
  { value: 'binary_sensor.side_window', label: 'Side window' },
];

test('opening entity search matches friendly name and preserves resolver order (#301)', () => {
  assert.deepEqual(
    filterOpeningEntityCandidates(candidates, 'window'),
    [candidates[1], candidates[3]],
  );
  assert.deepEqual(filterOpeningEntityCandidates(candidates, ''), candidates);
});

test('opening entity search matches entity id even when the label does not (#301)', () => {
  assert.deepEqual(
    filterOpeningEntityCandidates(candidates, 'binary_sensor.window_lou'),
    [candidates[1]],
  );
});

test('opening entity search is case insensitive and trims edge whitespace (#301)', () => {
  assert.deepEqual(
    filterOpeningEntityCandidates(candidates, '  GARAGE door  '),
    [candidates[0]],
  );
});

test('opening entity search caps only after filtering (#301)', () => {
  const many = Array.from({ length: 240 }, (_, index) => ({
    value: `binary_sensor.window_${index}`,
    label: index % 2 ? `Window ${index}` : `Other ${index}`,
  }));
  const result = filterOpeningEntityCandidates(many, 'window', 25);
  assert.equal(result.length, 25);
  assert.deepEqual(result, many.filter((item) =>
    item.label.toLowerCase().includes('window') || item.value.includes('window')).slice(0, 25));
});
