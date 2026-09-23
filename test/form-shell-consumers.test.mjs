import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const consumers = [
  ['space', 'src/editors/space-settings-dialog.ts'],
  ['settings', 'src/editors/general-settings-dialog.ts'],
  ['room', 'src/editors/room-settings-dialog.ts'],
  ['marker', 'src/editors/marker-dialog.ts'],
  ['onboarding', 'src/houseplan-onboarding-runtime.ts'],
];

test('#609 all five settings consumers opt into the shared form shell', () => {
  for (const [kind, file] of consumers) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, new RegExp(`data-kind=["']${kind}["'][^>]*form-shell`), file);
  }
});
