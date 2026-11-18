import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyHousePrefix, readHousePrefix } from '../test-build/house-transfer-prefix.js';

const vector = JSON.parse(readFileSync(new URL('./fixtures/1464-house-prefix.json', import.meta.url)));
const raw = new Uint8Array(Buffer.from(vector.prefixHex, 'hex'));
test('#1464 fixed Python/TS prefix vector routes only the canonical first record', async () => {
  assert.equal(raw.length, vector.length);
  assert.equal(classifyHousePrefix(raw), 'house');
  for (let n = 0; n < raw.length; n++) assert.equal(classifyHousePrefix(raw.subarray(0, n)), 'other');
  for (const offset of [0, 4, 6, 8, 10, 12, 14, 18, 22, 26, 28, 30, 38, 81]) {
    const changed = raw.slice(); changed[offset] ^= 1;
    assert.equal(classifyHousePrefix(changed), 'other', `byte ${offset}`);
  }
  const reads = [];
  const blob = { slice(start, end) { reads.push([start, end]); return new Blob([raw]); } };
  assert.deepEqual(await readHousePrefix(blob), { kind: 'house', zip: true });
  assert.deepEqual(reads, [[0, 1024]], 'never read or parse a portable document to choose a route');
});
