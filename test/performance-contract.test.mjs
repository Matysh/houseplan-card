import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GLOW_CARD_CONTRACT,
  LARGE_HOUSE_CARD_CONTRACT,
} from '../demo/performance/card-contract.mjs';

const directCardMembers = (relativePath) => {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
  return [...new Set([...source.matchAll(/\bcard\.(_[A-Za-z0-9_]+)/g)].map((match) => match[1]))].sort();
};

const declaredMembers = (contract) => new Set([...contract.methods, ...contract.fields]);

test('large-house benchmark declares every private card member it consumes', () => {
  const declared = declaredMembers(LARGE_HOUSE_CARD_CONTRACT);
  assert.deepEqual(
    directCardMembers('demo/benchmark_large_house.mjs').filter((name) => !declared.has(name)),
    [],
  );
});

test('Glow benchmark declares every private card member it consumes', () => {
  const declared = declaredMembers(GLOW_CARD_CONTRACT);
  assert.deepEqual(
    directCardMembers('demo/benchmark_glow.mjs').filter((name) => !declared.has(name)),
    [],
  );
});
