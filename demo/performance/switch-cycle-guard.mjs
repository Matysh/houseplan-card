/**
 * #769: the #735 switch-cycle guard — the size snapshot, the build counters and
 * one pure pass/fail decision, shared by `demo/benchmark_large_house.mjs`, the
 * floor-cache smoke (`demo/smoke_floor_geometry_cache.mjs`) and
 * `test/switch-cycle-guard.test.mjs`. The browser runners serialise these
 * functions with `toString()`: keep each one self-contained.
 *
 * Sizes cannot see a cold build once an LRU is full: the build evicts one entry
 * and the size stays. So the guard judges the card's own build counters
 * (`_floorCacheBuilds`, incremented in each miss branch) and keeps the size
 * snapshot only as a diagnostic. Judged families keep every floor warm: any
 * build inside the window fails. Reported families are single-slot by design
 * and rebuild on a floor switch: at most one build per switch. A comparison
 * bundle without the counters reads `null` and is not judged.
 */

/** Cache sizes the guard used to compare, now a diagnostic of the report. */
export function floorCacheSnapshot(card) {
  return {
    cleanFloor: card._cleanFloorCache?.size ?? 0,
    glowClip: card._glowClipCache?.size ?? 0,
    wallUnion: card._wallUnionCache ? 1 : 0,
    // #744: the union is pooled per floor, and the inner contours are the
    // second structural cache of a floor visit.
    wallUnionPool: card._wallUnionPool?.size ?? 0,
    innerContour: card._innerContourCache?.size ?? 0,
    openingTunnel: card._openingTunnelCache ? 1 : 0,
    // #769: the index is a Map; a truthiness check read 1 forever.
    openingWallIndex: card._openingWallIndexCache?.size ?? 0,
    isoGeometry: card._isoGeometryCache?.size ?? 0,
    planSnapGeometry: card._planSnapGeometryCache ? 1 : 0,
    wallFaceGraph: card._wallFaceGraphCache?.length ?? 0,
  };
}

/** A copy of the card's build counters, or `null` for a bundle without them. */
export function floorCacheBuilds(card) {
  const counters = card._floorCacheBuilds;
  return counters && typeof counters === 'object' ? { ...counters } : null;
}

/**
 * The decision. `before`/`after` are `floorCacheBuilds` around the window,
 * `switches` the number of floor switches in it, `isoBefore`/`isoAfter` the
 * 2.5D `_isoStructuralBuildCount` (`null` when the bundle has none).
 * Returns `{ ok, supported, builds, failures }`; each failure names the family
 * and its growth.
 */
export function judgeSwitchCycle({ before, after, switches, isoBefore = null, isoAfter = null }) {
  const judged = {
    wallUnion: 'wall union',
    innerContour: 'inner contour',
    cleanFloor: 'clean floor',
    openingWallIndex: 'opening wall index',
    lightBarrier: 'light barrier',
    glowClip: 'glow clip',
  };
  const reported = {
    physicalBodies: 'physical bodies',
    openingTunnel: 'opening tunnel',
    lightPhysicalBodies: 'light physical bodies',
  };
  const failures = [];
  const supported = !!before && !!after && typeof before === 'object' && typeof after === 'object';
  let builds = null;
  if (supported) {
    builds = {};
    for (const [family, label] of Object.entries({ ...judged, ...reported })) {
      const growth = Number(after[family]) - Number(before[family]);
      if (!Number.isInteger(growth)) {
        builds[family] = null;
        failures.push(`${label} counter is missing`);
        continue;
      }
      builds[family] = growth;
      if (growth < 0) failures.push(`${label} counter went back by ${-growth}`);
      else if (family in judged ? growth > 0 : growth > switches)
        failures.push(family in judged
          ? `${label} +${growth}`
          : `${label} +${growth} (more than ${switches} floor switches)`);
    }
  }
  if (isoBefore != null && isoAfter !== isoBefore)
    failures.push(`isoStructuralBuilds +${isoAfter - isoBefore}`);
  return { ok: failures.length === 0, supported, builds, failures };
}
