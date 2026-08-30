import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalizePosition } from '../test-build/coordinate-canonicalization.js';
import { contentFingerprint } from '../test-build/visual-continuity.js';

// #397: the card sends the canonical position to the server and must keep the
// same value locally. While it kept the raw one, its own echo came back
// looking foreign — the fingerprints differed — and the next reload wiped the
// undo history the user had just filled (AC10 of #74).

const CARD = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');

test('#397: the premise holds — canonicalization is not identity', () => {
  // If it were, the whole issue would be moot and the guards below decorative.
  const raw = { s: 'ground', x: 0.024999999999999942, y: 0.63 / 3 };
  const canonical = canonicalizePosition(raw);
  assert.notEqual(contentFingerprint(canonical), contentFingerprint(raw),
    'the lattice snap must actually change the value');
  assert.ok(Math.abs(canonical.x - raw.x) < 1e-9,
    'and it must be a snap, not a move — the difference is invisible on screen');
});

test('#397 AC1: the update branch stores what it sends, before sending it', () => {
  const branch = CARD.slice(
    CARD.indexOf('private async _persistDevicePlacement'),
    CARD.indexOf('this._persistLocalLayout();', CARD.indexOf('private async _persistDevicePlacement')),
  );
  assert.ok(branch, 'the persist method must be found');
  const write = branch.indexOf('this._layout = { ...this._layout, [deviceId]: pos }');
  const send = branch.indexOf("type: 'houseplan/layout/update'");
  const fingerprint = branch.indexOf('this._layoutContentFingerprint = contentFingerprint(this._layout)');
  assert.ok(write > 0, 'the canonical position must be written back into _layout');
  assert.ok(write < send,
    'the local copy is updated BEFORE the wire, so a reload racing the answer '
    + 'sees the value that was sent');
  assert.ok(send < fingerprint,
    'the fingerprint is taken after the write, over the canonical layout');
});

test('#397 AC5a: the delete branch removes the key before the fingerprint', () => {
  const method = CARD.slice(CARD.indexOf('private async _persistDevicePlacement'));
  const apply = method.indexOf('applyDevicePlacement(this._layout, deviceId, placement)');
  const fingerprint = method.indexOf('this._layoutContentFingerprint = contentFingerprint(this._layout)');
  assert.ok(apply > 0 && apply < fingerprint,
    'both branches mutate _layout through applyDevicePlacement before the '
    + 'fingerprint is recorded — deletion removes the key, not replaces a value');
});
