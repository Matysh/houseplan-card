import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertCardContract,
  GLOW_CARD_CONTRACT,
  LARGE_HOUSE_CARD_CONTRACT,
} from '../demo/performance/card-contract.mjs';

const directCardMembers = (relativePath) => {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
  // Runner-local names never start with one underscore. Tokenising every
  // single-underscore member also catches optional chaining, bracket/in access
  // and a future alias such as `const target = card; target._loadOk`.
  return [...new Set(
    [...source.matchAll(/\b(_(?!_)[A-Za-z0-9_]+)\b/g)].map((match) => match[1]),
  )].sort();
};

const declaredMembers = (contract) => new Set([
  ...contract.methods, ...contract.fields, ...(contract.optionalFields || []),
]);

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

test('performance contracts reference real production members', () => {
  const source = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  for (const contract of [LARGE_HOUSE_CARD_CONTRACT, GLOW_CARD_CONTRACT]) {
    for (const name of declaredMembers(contract)) {
      assert.match(source, new RegExp(`\\b(?:private\\s+(?:get\\s+)?|get\\s+)${name}\\b`),
        `${contract.label} declares missing production member ${name}`);
    }
  }
});

test('contract accepts recent optional fields only when their runtime type is valid', () => {
  const base = {
    _cleanFloorCache: new Map(), _glowClipCache: new Map(),
    _wallUnionCache: null, _openingTunnelCache: null, _openingWallIndexCache: null,
    _devices: [], _loadOk: false,
  };
  assert.doesNotThrow(() => assertCardContract(base, GLOW_CARD_CONTRACT));
  assert.doesNotThrow(() => assertCardContract({ ...base, _glowScreenBlend: false }, GLOW_CARD_CONTRACT));
  assert.throws(
    () => assertCardContract({ ...base, _glowScreenBlend: undefined }, GLOW_CARD_CONTRACT),
    /invalid private API types: _glowScreenBlend:boolean/,
  );
  assert.throws(
    () => assertCardContract({ ...base, _cleanFloorCache: {} }, GLOW_CARD_CONTRACT),
    /invalid private API types: _cleanFloorCache:map/,
  );
});
