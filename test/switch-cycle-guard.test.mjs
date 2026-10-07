// #769: the #735 switch-cycle guard judges build counters, not cache sizes.
// The decision is the one pure function the benchmark serialises into the page
// and the floor-cache smoke uses (demo/performance/switch-cycle-guard.mjs).
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  floorCacheBuilds, floorCacheSnapshot, judgeSwitchCycle,
} from '../demo/performance/switch-cycle-guard.mjs';

const counters = (overrides = {}) => ({
  wallUnion: 3, innerContour: 60, cleanFloor: 60, openingWallIndex: 3, lightBarrier: 3,
  glowClip: 3, physicalBodies: 5, openingTunnel: 5, lightPhysicalBodies: 3, ...overrides,
});

/** The guard before #769: a failure is any grown size. */
const legacySizeGuard = (before, after) => Object.keys(after)
  .filter((key) => after[key] > before[key]).map((key) => `${key} +${after[key] - before[key]}`);

test('#769 AC6: a warm cycle passes; single-slot families may rebuild once per switch', () => {
  const verdict = judgeSwitchCycle({
    before: counters(),
    after: counters({ physicalBodies: 17, openingTunnel: 17 }),
    switches: 12,
  });
  assert.deepEqual(verdict, {
    ok: true, supported: true, failures: [],
    builds: {
      wallUnion: 0, innerContour: 0, cleanFloor: 0, openingWallIndex: 0, lightBarrier: 0,
      glowClip: 0, physicalBodies: 12, openingTunnel: 12, lightPhysicalBodies: 0,
    },
  });
});

test('#769 AC6: any build of a pooled family fails and names the family', () => {
  for (const [family, label] of [
    ['wallUnion', 'wall union'], ['innerContour', 'inner contour'], ['cleanFloor', 'clean floor'],
    ['openingWallIndex', 'opening wall index'], ['lightBarrier', 'light barrier'], ['glowClip', 'glow clip'],
  ]) {
    const before = counters();
    const verdict = judgeSwitchCycle({ before, after: counters({ [family]: before[family] + 2 }), switches: 12 });
    assert.equal(verdict.ok, false, family);
    assert.deepEqual(verdict.failures, [`${label} +2`]);
  }
});

test('#769 AC6: a single-slot family is judged by the number of switches only', () => {
  const before = counters();
  assert.equal(judgeSwitchCycle({ before, after: counters({ physicalBodies: 5 + 12 }), switches: 12 }).ok, true);
  const over = judgeSwitchCycle({ before, after: counters({ physicalBodies: 5 + 13 }), switches: 12 });
  assert.equal(over.ok, false);
  assert.deepEqual(over.failures, ['physical bodies +13 (more than 12 floor switches)']);
  assert.deepEqual(
    judgeSwitchCycle({ before, after: counters({ lightPhysicalBodies: 3 + 13 }), switches: 12 }).failures,
    ['light physical bodies +13 (more than 12 floor switches)'],
  );
});

test('#769 AC6: a base without counters is not judged; a candidate without one family is', () => {
  for (const [before, after] of [[null, null], [null, counters()], [counters(), null]]) {
    const verdict = judgeSwitchCycle({ before, after, switches: 12 });
    assert.deepEqual(verdict, { ok: true, supported: false, builds: null, failures: [] });
  }
  const { glowClip: _glowClip, ...partial } = counters();
  const verdict = judgeSwitchCycle({ before: partial, after: partial, switches: 12 });
  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.failures, ['glow clip counter is missing']);
  assert.equal(floorCacheBuilds({}), null, 'an old bundle reads null');
  assert.deepEqual(floorCacheBuilds({ _floorCacheBuilds: counters() }), counters());
});

test('#769 AC6: the 2.5D structural counter is still judged', () => {
  const verdict = judgeSwitchCycle({
    before: counters(), after: counters(), switches: 12, isoBefore: 4, isoAfter: 5,
  });
  assert.deepEqual(verdict.failures, ['isoStructuralBuilds +1']);
  assert.equal(judgeSwitchCycle({
    before: null, after: null, switches: 12, isoBefore: null, isoAfter: 7,
  }).ok, true, 'a base without the 2.5D counter is not judged');
});

test('#769 AC7: a cold build in a full LRU keeps every size and still fails', () => {
  // A full union pool: the cold floor's union is built and one entry is
  // evicted, so the pool stays at 8; the floor's contours and clean floors
  // were warm. Sizes before and after are identical.
  const sizes = {
    cleanFloor: 60, glowClip: 3, wallUnion: 1, wallUnionPool: 8, innerContour: 60,
    openingTunnel: 1, openingWallIndex: 3, isoGeometry: 0, planSnapGeometry: 0, wallFaceGraph: 0,
  };
  assert.deepEqual(legacySizeGuard(sizes, { ...sizes }), [], 'the size guard saw nothing');
  const verdict = judgeSwitchCycle({
    before: counters(), after: counters({ wallUnion: 4, physicalBodies: 9, openingTunnel: 9 }), switches: 4,
  });
  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.failures, ['wall union +1']);
});

test('#769: the size snapshot reads the real size of the opening wall index', () => {
  const card = {
    _cleanFloorCache: new Map([[1, 1]]), _glowClipCache: new Map(),
    _wallUnionCache: { key: 'k' }, _wallUnionPool: new Map([[1, 1], [2, 2]]),
    _innerContourCache: new Map(), _openingTunnelCache: null,
    _openingWallIndexCache: new Map([[1, 1], [2, 2], [3, 3]]),
  };
  assert.deepEqual(floorCacheSnapshot(card), {
    cleanFloor: 1, glowClip: 0, wallUnion: 1, wallUnionPool: 2, innerContour: 0,
    openingTunnel: 0, openingWallIndex: 3, isoGeometry: 0, planSnapGeometry: 0, wallFaceGraph: 0,
  });
});
