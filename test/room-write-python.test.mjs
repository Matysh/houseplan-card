import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateOrdinaryRoomWrite, ordinaryRoomWriteReply } from '../demo/helpers/room-write-python.mjs';
import { incidentResizeFixture, incidentResizeDraft, incidentResizeOpening } from './helpers/resize-incident-fixture.mjs';
import { commitGraphEdit } from '../test-build/graph-edit-intent.js';

test('#1264 ordinary production validation accepts the exact Resize child host and rejects an orphan', () => {
  const source = incidentResizeOpening(incidentResizeFixture());
  const target = commitGraphEdit(source, incidentResizeDraft(source), { kind: 'resize', rooms: ['upper-left','upper-right'] });
  const previous = { model_version: 11, spaces: [source], markers: [], settings: {} };
  const candidate = { ...structuredClone(previous), spaces: [target] };
  const accepted = validateOrdinaryRoomWrite(previous, { type: 'houseplan/config/set', config: candidate });
  assert.deepEqual(accepted.spaces[0].openings, candidate.spaces[0].openings);
  assert.notEqual(accepted.spaces[0].openings[0].host.id, source.openings[0].host.id);
  const invalid = structuredClone(candidate);
  invalid.spaces[0].openings[0].host.id = 'missing-wall';
  const refused = ordinaryRoomWriteReply(previous, { type: 'houseplan/config/set', config: invalid });
  assert.equal(refused.ok, false);
  assert.equal(refused.error.code, 'invalid_format');
});

// Synthetic #804 source and the exact candidate emitted by native Select/Save.
// It promotes the fully consumed atomic child, never the old carrier's tails.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/room-host-promotion.json', import.meta.url)));
test('#1265 the production ordinary-write boundary accepts same-ID atomic wall promotion', () => {
  const pair = structuredClone(fixture), frozen = structuredClone(pair);
  const result = validateOrdinaryRoomWrite(pair.previous, pair.message);
  const old = pair.previous.spaces[0].openings[0], next = result.spaces[0].openings[0];
  assert.equal(old.host.kind, 'partition'); assert.equal(next.host.kind, 'wall');
  assert.equal(next.host.id, old.host.id);
  assert.deepEqual(result.spaces[0].openings, pair.message.config.spaces[0].openings);
  assert.deepEqual(pair, frozen);
});
test('#1265 production promotion cannot transfer the opening to a foreign valid wall', () => {
  const pair = structuredClone(fixture), opening = pair.message.config.spaces[0].openings[0];
  opening.host.id = 'neighbour-left'; opening.x = 102 / 240;
  const result = ordinaryRoomWriteReply(pair.previous, pair.message);
  assert.equal(result.ok, false); assert.equal(result.error.code, 'invalid_format');
  assert.match(result.error.message, /host changed/);
});
test('#1265 promotion cannot silently resize an existing hosted opening', () => {
  const pair = structuredClone(fixture);
  pair.message.config.spaces[0].openings[0].length *= 1.1;
  assert.throws(() => validateOrdinaryRoomWrite(pair.previous, pair.message),
    error => error.code === 'invalid_format' && /host changed/.test(error.message));
});
test('#1265 malformed future models never get a successful synthetic server reply', () => {
  const pair = structuredClone(fixture); pair.message.config.model_version = 12;
  const result = ordinaryRoomWriteReply(pair.previous, pair.message);
  assert.equal(result.ok, false); assert.equal(result.error.code, 'invalid_format');
});
