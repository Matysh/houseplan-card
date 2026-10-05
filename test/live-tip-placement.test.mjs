import test from 'node:test';
import assert from 'node:assert/strict';
import { placeDeviceTooltip } from '../test-build/live-tip-placement.js';

const rect = (left, top, width, height) => ({
  left, top, width, height, right: left + width, bottom: top + height,
});

const input = (overrides = {}) => ({
  preferred: { x: 200, y: 150 },
  size: { width: 160, height: 60 },
  bounds: rect(0, 0, 640, 480),
  blockers: [],
  ...overrides,
});

const assertFits = (placement, data) => {
  assert.ok(placement, 'a complete free position exists');
  const { left, top } = placement;
  const { width, height } = data.size;
  const edge = data.edge ?? 8;
  const gap = data.gap ?? 8;
  assert.ok(left >= data.bounds.left + edge);
  assert.ok(top >= data.bounds.top + edge);
  assert.ok(left + width <= data.bounds.right - edge);
  assert.ok(top + height <= data.bounds.bottom - edge);
  for (const blocker of data.blockers) {
    if (!blocker.width || !blocker.height) continue;
    assert.ok(left + width + gap <= blocker.left || left >= blocker.right + gap
      || top + height + gap <= blocker.top || top >= blocker.bottom + gap,
    `tooltip ${JSON.stringify(placement)} covers ${JSON.stringify(blocker)}`);
  }
};

test('tooltip preserves the preferred position when no obstacle occupies it', () => {
  for (const blockers of [[], [rect(400, 100, 120, 40)], [rect(180, 100, 20, 20)]]) {
    const data = input({ blockers });
    assert.deepEqual(placeDeviceTooltip(data), { left: 200, top: 150 });
  }
});

test('tooltip moves below a naturally colliding status badge, clear of the source marker', () => {
  const data = input({
    preferred: { x: 310, y: 160 },
    size: { width: 190, height: 72 },
    blockers: [rect(286, 136, 24, 24), rect(308, 160, 240, 30)],
  });
  const placement = placeDeviceTooltip(data);
  assert.deepEqual(placement, { left: 310, top: 198 });
  assertFits(placement, data);
});

test('tooltip avoids every badge and the source, not only the closest diagnostic text', () => {
  const data = input({
    blockers: [rect(190, 100, 30, 30), rect(200, 145, 220, 35),
      rect(200, 180, 150, 40), rect(430, 120, 70, 30)],
  });
  const placement = placeDeviceTooltip(data);
  assertFits(placement, data);
  assert.deepEqual(placement, { left: 200, top: 228 });
});

test('tooltip reports no space in a tight card without shrinking the tooltip or moving blockers', () => {
  const blockers = [Object.freeze(rect(75, 20, 80, 45))];
  const data = Object.freeze(input({
    preferred: Object.freeze({ x: 90, y: 40 }),
    size: Object.freeze({ width: 120, height: 70 }),
    bounds: Object.freeze(rect(0, 0, 180, 110)),
    blockers: Object.freeze(blockers),
  }));
  assert.equal(placeDeviceTooltip(data), null);
  assert.deepEqual(blockers[0], rect(75, 20, 80, 45));
});

test('recalculation restores a hidden tooltip after expanding the bounds or removing a badge', () => {
  const data = input({ size: { width: 120, height: 70 }, bounds: rect(0, 0, 180, 110),
    blockers: [rect(75, 20, 80, 45)] });
  assert.equal(placeDeviceTooltip(data), null);
  const expanded = { ...data, bounds: rect(0, 0, 640, 480) };
  assertFits(placeDeviceTooltip(expanded), expanded);
  const cleared = { ...data, blockers: [] };
  assertFits(placeDeviceTooltip(cleared), cleared);
  assert.equal(placeDeviceTooltip(data), null, 'no placement state leaks between calls');
});

test('tooltip clamps all four edges without obstacles and accepts an exact safe-area fit', () => {
  const bounds = rect(20, 30, 300, 200);
  const size = { width: 120, height: 60 };
  for (const [preferred, expected] of [
    [{ x: -500, y: -500 }, { left: 28, top: 38 }],
    [{ x: 1000, y: 1000 }, { left: 192, top: 162 }],
    [{ x: 120, y: 1000 }, { left: 120, top: 162 }],
    [{ x: -500, y: 120 }, { left: 28, top: 120 }],
  ]) assert.deepEqual(placeDeviceTooltip(input({ bounds, size, preferred })), expected);
  assert.deepEqual(placeDeviceTooltip(input({ bounds,
    size: { width: 284, height: 184 } })), { left: 28, top: 38 });
});

test('negative origins, subpixels and long tooltip sizes remain in screen coordinates', () => {
  const data = input({
    bounds: rect(-300.5, -100.25, 1100, 360),
    preferred: { x: 500, y: 160.5 },
    size: { width: 800.25, height: 100.5 },
    blockers: [rect(-250, -60, 80, 70)],
  });
  const placement = placeDeviceTooltip(data);
  assert.deepEqual(placement, { left: -8.75, top: 151.25 });
  assertFits(placement, data);
});

test('cross-product search finds an interior pocket unavailable to four directional guesses', () => {
  // Four strips leave only the central 30 x 30 notch. Staying on either of the
  // preferred axes, even at a bounds edge, would incorrectly claim no space.
  const data = input({
    bounds: rect(0, 0, 100, 100), size: { width: 20, height: 20 },
    preferred: { x: 10, y: 10 }, gap: 0, edge: 0,
    blockers: [rect(0, 0, 100, 40), rect(0, 70, 100, 30),
      rect(0, 40, 40, 30), rect(70, 40, 30, 30)],
  });
  const placement = placeDeviceTooltip(data);
  assert.deepEqual(placement, { left: 40, top: 40 });
  assertFits(placement, data);
  assert.equal(placeDeviceTooltip({ ...data, blockers: [...data.blockers, rect(40, 40, 30, 30)] }), null);
});

test('clearance is exact, configurable, and is never rounded back into a badge', () => {
  const data = input({
    size: { width: 40.5, height: 30.25 }, preferred: { x: 150.25, y: 120.5 },
    blockers: [rect(150.25, 120.5, 90.75, 45.5)],
  });
  assert.deepEqual(placeDeviceTooltip(data), { left: 150.25, top: 82.25 });
  assertFits(placeDeviceTooltip(data), data);
  assert.deepEqual(placeDeviceTooltip({ ...data, gap: 0 }), { left: 150.25, top: 90.25 });
  assert.deepEqual(placeDeviceTooltip({ ...data, gap: 12.5 }), { left: 150.25, top: 77.75 });
});

test('equal-distance placements are deterministic regardless of blocker order', () => {
  const data = input({ preferred: { x: 100, y: 100 }, size: { width: 20, height: 20 },
    blockers: [rect(100, 100, 20, 20), rect(300, 300, 20, 20)] });
  assert.deepEqual(placeDeviceTooltip(data), { left: 100, top: 72 });
  assert.deepEqual(placeDeviceTooltip({ ...data, blockers: [...data.blockers].reverse() }),
    placeDeviceTooltip(data));
});

test('empty and off-stage blockers do not invent a collision', () => {
  const data = input({ blockers: [rect(180, 100, 0, 160), rect(180, 160, 180, 0),
    rect(1000, 1000, 400, 400), rect(-1000, -1000, 50, 50)] });
  assert.deepEqual(placeDeviceTooltip(data), { left: 200, top: 150 });
});

test('closest feasible result agrees with exhaustive placement across 200 small layouts', () => {
  let seed = 802;
  const next = (limit) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % limit;
  };
  for (let scene = 0; scene < 200; scene++) {
    const data = input({ bounds: rect(-5, -4, 32, 28),
      size: { width: 3 + next(10), height: 2 + next(9) },
      preferred: { x: next(50) - 10, y: next(40) - 8 }, gap: next(4), edge: next(4),
      blockers: Array.from({ length: 1 + next(5) }, () =>
        rect(next(40) - 8, next(36) - 8, next(13), next(13))),
    });
    let expected = null;
    let bestDistance = Infinity;
    // All input edges and preferred coordinates are integral, so an integer
    // closest point exists. This oracle scans the area, not obstacle candidates.
    for (let top = data.bounds.top + data.edge;
      top + data.size.height <= data.bounds.bottom - data.edge; top++) {
      for (let left = data.bounds.left + data.edge;
        left + data.size.width <= data.bounds.right - data.edge; left++) {
        if (data.blockers.some((b) => b.width && b.height
          && left < b.right + data.gap && left + data.size.width + data.gap > b.left
          && top < b.bottom + data.gap && top + data.size.height + data.gap > b.top)) continue;
        const distance = (left - data.preferred.x) ** 2 + (top - data.preferred.y) ** 2;
        if (distance < bestDistance) {
          expected = { left, top };
          bestDistance = distance;
        }
      }
    }
    assert.deepEqual(placeDeviceTooltip(data), expected, `layout ${scene}: ${JSON.stringify(data)}`);
  }
});

test('invalid, unmeasurable and oversized inputs fail closed without throwing', () => {
  for (const overrides of [
    { preferred: { x: NaN, y: 10 } }, { preferred: { x: 10, y: Infinity } },
    { size: { width: 0, height: 20 } }, { size: { width: -20, height: 20 } },
    { size: { width: 20, height: NaN } }, { size: { width: 20, height: -1 } },
    { size: { width: 20, height: Infinity } }, { size: { width: 1000, height: 20 } },
    { size: { width: 20, height: 1000 } }, { bounds: rect(0, 0, 0, 0) },
    { bounds: rect(0, 0, -100, 100) }, { bounds: rect(Infinity, 0, 100, 100) },
    { blockers: [rect(10, 10, -10, 10)] }, { blockers: [rect(10, NaN, 10, 10)] },
    { gap: -1 }, { gap: Infinity }, { edge: -1 }, { edge: NaN },
  ]) assert.equal(placeDeviceTooltip(input(overrides)), null, JSON.stringify(overrides));
});
