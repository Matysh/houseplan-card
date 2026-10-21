// #1006: an independent astronomical fixture, both mask sweeps and runtime invalidation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moonFingerprint, moonIllumination, moonPhasePath, moonView } from '../test-build/moon.js';
import { moonTick, renderMoon } from '../test-build/moon-runtime.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/moon-nasa-2026.json', import.meta.url)));
const home = { latitude: 55.75, longitude: 37.62 };
const settings = { moon: true };
const waxing = new Date('2026-10-21T17:54:54Z');
const waning = new Date('2026-10-30T07:00:00Z');

test('#1006 AC1: NASA hourly percentages independently establish phase direction', () => {
  for (const row of fixture.rows) {
    const computed = moonIllumination(new Date(row.utc));
    assert.ok(Math.abs(100 * computed.fraction - row.percent) <= 2.5, row.utc);
    assert.equal(computed.waxing, row.nextPercent > row.percent, row.utc);
    for (const config of [home, {}, { latitude: -33.87, longitude: 151.21 }]) {
      const view = moonView(settings, 'night', config, new Date(row.utc));
      assert.equal(view.waxing, computed.waxing, 'including hidden views');
      assert.equal(view.k, Math.round(100 * computed.fraction) / 100);
    }
  }
  const a = moonView(settings, 'night', home, waxing);
  const b = moonView(settings, 'night', home, waning);
  assert.equal(a.k, 0.79); assert.equal(b.k, a.k);
  assert.ok(a.visible && b.visible && a.waxing && !b.waxing);
});

test('#1006 AC2: mask coordinates stay finite and continuous at quarters and end points', () => {
  for (const side of [false, true]) {
    for (const k of [0, 0.00001, 0.03, 0.25, 0.49999, 0.5, 0.50001, 0.75, 0.97, 0.99999, 1]) {
      const path = moonPhasePath(k, side);
      assert.doesNotMatch(path, /NaN|Infinity|undefined/);
      const arcs = [...path.matchAll(/A([\d.]+) ([\d.]+) 0 0 ([01])/g)];
      const right = side && k > 0 && k < 1;
      assert.equal(+arcs[0][3], +right, 'outer sweep chooses only the mask side');
      const radius = 240 * Math.abs(2 * k - 1);
      if (radius < 0.5) assert.equal(arcs.length, 1, 'quarter uses a straight line');
      else {
        assert.ok(Math.abs(+arcs[1][1] - radius) <= 0.0051);
        assert.equal(+arcs[1][2], 240);
        assert.equal(+arcs[1][3], +((k > 0.5) === right));
      }
    }
  }
  // Exact pre-#1006 full-disc geometry, rather than an ideal circle which changes its AA raster.
  for (const side of [false, true]) assert.equal(moonPhasePath(1, side),
    'M256 0A256 256 0 0 0 256 512L256 496A240.00 240 0 0 0 256 16L256 0Z');
});

test('#1006 AC5: equal share, opposite direction invalidates once; poles and stable ticks do not', () => {
  for (const k of [0.03, 0.25, 0.5, 0.79, 0.97]) {
    assert.notEqual(moonFingerprint({ visible: true, k, waxing: true }),
      moonFingerprint({ visible: true, k, waxing: false }));
  }
  for (const k of [0, 1]) assert.equal(moonFingerprint({ visible: true, k, waxing: true }),
    moonFingerprint({ visible: true, k, waxing: false }), 'no pointless full/empty render');
  const host = { isConnected: true, hass: { config: home }, updateComplete: Promise.resolve(),
    updates: 0, requestUpdate() { this.updates++; } };
  try {
    renderMoon(host, settings, 'night', waxing);
    moonTick(host, waning); moonTick(host, waning);
    assert.equal(host.updates, 1);
    renderMoon(host, settings, 'night', waning);
    for (let n = 1; n <= 3; n++) moonTick(host, new Date(+waning + n * 30_000));
    assert.equal(host.updates, 1);
    // A full cycle across the rounded full and new discs: the next visible side is fresh.
    for (const at of ['2026-10-25T18:00Z', '2026-10-26T14:00Z', '2026-11-08T18:00Z',
      '2026-11-09T18:00Z', '2026-11-13T18:00Z']) {
      const date = new Date(at);
      const view = moonView(settings, 'night', home, date);
      const before = host.updates;
      moonTick(host, date);
      const template = renderMoon(host, settings, 'night', date);
      assert.ok(template.values.includes(moonPhasePath(view.k, view.waxing)));
      moonTick(host, date);
      assert.ok(host.updates === before || host.updates === before + 1);
    }
  } finally { host.isConnected = false; moonTick(host); }
});
