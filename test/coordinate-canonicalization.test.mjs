import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  COORDINATE_DECIMALS,
  canonicalizeConfigGeometry,
  canonicalizeLayoutGeometry,
  canonicalizeNumber,
  canonicalizePosition,
} from '../test-build/coordinate-canonicalization.js';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/coordinate-canonicalization.json', import.meta.url),
  'utf8',
));

test('frontend and backend share the nine-decimal fixture contract (#224)', () => {
  assert.equal(COORDINATE_DECIMALS, fixture.decimals);
  const configBefore = structuredClone(fixture.configInput);
  const layoutBefore = structuredClone(fixture.layoutInput);

  const config = canonicalizeConfigGeometry(fixture.configInput);
  const layout = canonicalizeLayoutGeometry(fixture.layoutInput);

  assert.deepEqual(config, fixture.configExpected);
  assert.deepEqual(layout, fixture.layoutExpected);
  assert.deepEqual(fixture.configInput, configBefore, 'config input is immutable');
  assert.deepEqual(fixture.layoutInput, layoutBefore, 'layout input is immutable');
  assert.deepEqual(canonicalizeConfigGeometry(config), config, 'config is idempotent');
  assert.deepEqual(canonicalizeLayoutGeometry(layout), layout, 'layout is idempotent');
  assert.equal(Object.is(layout['rl:poly'].x, -0), false, 'negative zero becomes positive');
});

test('scalar canonicalization is symmetric and never snaps off-grid geometry (#224)', () => {
  assert.equal(canonicalizeNumber(1.2345678905), 1.234567891);
  assert.equal(canonicalizeNumber(-1.2345678905), -1.234567891);
  assert.equal(canonicalizeNumber(0.20833333333333334), 0.208333333);
  assert.ok(Math.abs(canonicalizeNumber(0.20833333333333334) - 0.20833333333333334) <= 5e-10);
  assert.equal(canonicalizeNumber(Number.NaN), Number.NaN);
  assert.equal(canonicalizeNumber(Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY);
});

test('one position changes only x/y and preserves future metadata (#224)', () => {
  const input = {
    s: 'floor', x: 0.1000000006, y: -0.0000000004,
    k: 1.0000000004, nested: { numeric: 0.1234567896 },
  };
  assert.deepEqual(canonicalizePosition(input), {
    s: 'floor', x: 0.100000001, y: 0,
    k: 1.0000000004, nested: { numeric: 0.1234567896 },
  });
});

test('frontend write paths adopt canonical candidates before persistence (#224)', () => {
  const source = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  assert.match(
    source,
    /const candidate = canonicalizeConfigGeometry\(this\._serverCfg\);[\s\S]*config: candidate/,
  );
  assert.match(
    source,
    /const pos = canonicalizePosition\(this\._layout\[id\]\);[\s\S]*device_id: id, pos/,
  );
  assert.match(
    source,
    /this\._layout = canonicalizeLayoutGeometry\(this\._layout\);[\s\S]*localStorage\.setItem/,
  );
});
