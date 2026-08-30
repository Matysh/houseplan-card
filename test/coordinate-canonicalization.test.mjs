import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readHouseplanProductionSource } from './houseplan-source.mjs';

import {
  COORDINATE_DECIMALS,
  LATTICE_GRID_N,
  LATTICE_NOISE_STEPS,
  canonicalizeConfigGeometry,
  canonicalizeConfigGeometryInPlace,
  canonicalizeLatticeCoordinate,
  canonicalizeLayoutGeometry,
  canonicalizeNumber,
  canonicalizePosition,
  formatLatticeShiftCm,
  latticeCanonicalizationReport,
} from '../test-build/coordinate-canonicalization.js';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/coordinate-canonicalization.json', import.meta.url),
  'utf8',
));

test('frontend and backend share the scalar+lattice fixture contract (#291)', () => {
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

test('all 4801 lattice nodes and their nine-decimal forms share exact bits (#291)', () => {
  assert.equal(LATTICE_GRID_N, 240);
  assert.equal(LATTICE_NOISE_STEPS, 1e-4);
  for (let k = -2400; k <= 2400; k++) {
    const node = k / LATTICE_GRID_N;
    const nineDecimal = Number(node.toFixed(COORDINATE_DECIMALS));
    assert.equal(canonicalizeLatticeCoordinate(node), node, `node ${k}`);
    assert.equal(canonicalizeLatticeCoordinate(nineDecimal), node, `stored node ${k}`);
    assert.equal(canonicalizeLatticeCoordinate(
      canonicalizeLatticeCoordinate(nineDecimal),
    ), node, `idempotent node ${k}`);
  }
  assert.equal(Object.is(canonicalizeLatticeCoordinate(-0), -0), false);
  assert.equal(canonicalizeLatticeCoordinate(0.06), 0.06);
  assert.equal(canonicalizeLatticeCoordinate(0.2875), 0.2875);
  assert.equal(canonicalizeLatticeCoordinate((1 + 0.999e-4) / 240), 1 / 240);
  assert.equal(canonicalizeLatticeCoordinate((1 + 1.001e-4) / 240), 0.004167084);
});

test('lattice report separates noise, far values and physical per-space maxima (#291)', () => {
  const node = 83 / 240;
  const noise = Number(node.toFixed(9));
  const report = latticeCanonicalizationReport({ spaces: [
    { id: 'quiet', title: 'Quiet', cell_cm: 1, rooms: [{ poly: [[0, 0], [0.06, 0]] }] },
    { id: 'touched', title: 'Touched', cell_cm: 10, rooms: [{ poly: [[noise, node], [0.06, 0]] }] },
  ] }, { marker: { s: 'touched', x: noise, y: 0 }, orphan: { x: noise, y: 0 } });
  assert.equal(report.canonicalized, 3);
  assert.equal(report.far, 2);
  assert.equal(report.spaces.length, 1, 'unchanged spaces stay out of the breakdown');
  assert.deepEqual(report.spaces[0], {
    spaceId: 'touched', space: 'Touched', canonicalized: 2, far: 1,
    maxShift: Math.abs(node - noise),
    maxShiftCm: Math.abs(node - noise) * 240 * 10,
  });
  assert.equal(report.maxShift, Math.abs(node - noise));
  assert.equal(report.maxShiftCm, Math.abs(node - noise) * 240 * 10);
});

test('lattice movement format keeps three significant digits without fake 0.1 cm (#291)', () => {
  assert.equal(formatLatticeShiftCm(0), '0');
  assert.equal(formatLatticeShiftCm(0.000033), '3.30e-5');
  assert.equal(formatLatticeShiftCm(0.0012345), '0.00123');
  assert.equal(formatLatticeShiftCm(1.2), '1.2');
});

test('Optimize can apply the same barrier in-place without a second clone (#291)', () => {
  const input = structuredClone(fixture.configInput);
  assert.equal(canonicalizeConfigGeometryInPlace(input), input);
  assert.deepEqual(input, fixture.configExpected);
});

test('#383 furniture flip flags survive frontend canonicalization unchanged', () => {
  const config = { spaces: [{
    id: 's', decor: [{
      id: 'f', kind: 'furniture', symbol: 'sofa', x: 0.2000000001, y: 0.3,
      w: 0.18, h: 0.075, flip_h: true, flip_v: false,
    }],
  }] };
  const furniture = canonicalizeConfigGeometry(config).spaces[0].decor[0];
  assert.equal(furniture.flip_h, true);
  assert.equal(furniture.flip_v, false);
});

test('one position changes only x/y and preserves future metadata (#224)', () => {
  const input = {
    s: 'floor', x: 0.1000000006, y: -0.0000000004,
    k: 1.0000000004, nested: { numeric: 0.1234567896 },
  };
  assert.deepEqual(canonicalizePosition(input), {
    s: 'floor', x: 0.1, y: 0,
    k: 1.0000000004, nested: { numeric: 0.1234567896 },
  });
});

test('frontend write paths adopt canonical candidates before persistence (#224)', () => {
  const source = readHouseplanProductionSource();
  const eagerCardSource = readFileSync(
    new URL('../src/houseplan-card.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /enqueueSerializedWrite\(this\._writeChain, async \(\) =>/);
  assert.match(
    source,
    /const candidate = canonicalizeConfigGeometry\(this\._serverCfg\);/,
  );
  assert.match(
    eagerCardSource,
    /const candidate = canonicalizeConfigGeometry\(this\._serverCfg\);/,
    'the eager View writer keeps the same canonicalization barrier as the lazy editor writer',
  );
  assert.match(
    source,
    /const canonicalCandidate = canonicalizeConfigGeometry\(candidate\);[\s\S]*config: canonicalCandidate/,
  );
  assert.match(
    source,
    /if \(candidateFingerprint !== contentFingerprint\(this\._serverCfg\)\) \{\s*this\._serverCfg = candidate;/,
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
