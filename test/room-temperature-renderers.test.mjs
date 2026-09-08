import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');

test('#487 full and static renderers consume one effective room temperature range', () => {
  const full = read('houseplan-card.ts');
  const staticCard = read('space-render.ts');
  assert.match(full, /const tempRange = roomTempRangeFromDraft\(/);
  assert.match(full, /tempRange\.min,\s*tempRange\.max,/);
  assert.match(staticCard, /const tempRange = roomTempRangeOf\(/);
  assert.match(staticCard, /tempRange\.min,\s*tempRange\.max,/);
  assert.doesNotMatch(staticCard, /fill === 'temp'[\s\S]{0,180}disp\.tempMin,[\s\n ]*disp\.tempMax/);
});
