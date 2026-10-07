/**
 * #744: the structural key of one floor for the four floor-geometry caches of
 * the card — physical bodies, the wall union, inner room contours and the
 * clean floor.
 *
 * Those caches used to carry the global `_cfgEpoch`. Every edit of any floor
 * bumps it, so one edit made every other floor cold again: in the large-house
 * fixture the first visit to an untouched floor rebuilt its wall union for
 * ≈0.6 s. A floor's geometry reads only its own config record (rooms, walls,
 * openings, partitions, columns, stairs, `cell_cm`, frame — `spaceModels`)
 * and constants, so the key is a content fingerprint of that record. It is
 * complete by construction: any change of the record is a new key, and an
 * edit of another floor cannot change it.
 *
 * The geometry reads the model of the floor it is given next to the CURRENT
 * floor's config (`_curSpaceCfg`: walls, openings, `cell_cm`). Both come from
 * the config as rendered, live resize preview included. When the two records
 * differ — a fallback or a foreign floor — the key fingerprints both, so such
 * a value never shares a key with the floor's own geometry.
 *
 * A fingerprint costs ≈1.5 ms per floor in large-house, so it is remembered
 * per epoch and per source record object: every mutation path bumps the epoch
 * (`_saveConfig`), the resize preview is its own record object (`pv.sp`), and
 * a config replaced before the next `willUpdate` brings new record objects. An
 * in-place edit without a new epoch shows on the next epoch, as it always did
 * for these caches.
 */
import { lruRead, lruWrite } from './card-runtime';
import { lightGeometryFingerprint } from './glow-scene';
import { roomPoly } from './logic';
import { contentFingerprint } from './visual-continuity';

/** The card members the key reads; the card passes itself. */
export interface FloorKeySource {
  readonly _cfgEpoch: number;
  /** The config as rendered: the live resize preview substituted in. */
  readonly _renderCfg: { readonly spaces: readonly unknown[] } | null;
  /** The current floor's record as rendered (resize preview included). */
  readonly _curSpaceCfg: unknown;
}

type Slot = { model: unknown; current: unknown; key: string };

/** The content key of one floor's input records; see `floorRecordKeyMemo`. */
export type FloorRecordKey = (
  epoch: number, slot: string, id: string, model: unknown, current: unknown,
) => string;

/**
 * #769: the content key of one floor's input records, the helper shared by the
 * card's reader below and the summary panel's area (`summary-panel-runtime-loaded.ts`).
 * `model` is the record the floor's model was built from, `current` the record
 * its geometry reads walls, openings and `cell_cm` from. When they are one
 * object (View) the key fingerprints it once; when they differ (a resize
 * preview, a duplicate id) it fingerprints both. The key reads nothing else,
 * so it does not depend on which floor is shown.
 *
 * Remembered per epoch and per caller `slot` by the record objects: at most
 * one fingerprint per slot and epoch while the records stay the same objects.
 * `fingerprint` is a test seam.
 */
export function floorRecordKeyMemo(
  fingerprint: (value: unknown) => string = contentFingerprint,
): FloorRecordKey {
  let remembered = Number.NaN;
  const slots = new Map<string, Slot>();
  return (epoch, slot, id, model, current) => {
    if (epoch !== remembered) {
      remembered = epoch;
      slots.clear();
    }
    const known = slots.get(slot);
    if (known && known.model === model && known.current === current) return known.key;
    const key = `${id}|${fingerprint(model === current ? model : [model, current])}`;
    slots.set(slot, { model, current, key });
    return key;
  };
}

/** A reader `spaceId → key`, remembered per epoch and per source record. */
export function floorGeometryKeyReader(source: FloorKeySource): (spaceId: string) => string {
  const keyOf = floorRecordKeyMemo();
  return (spaceId) => keyOf(
    source._cfgEpoch, spaceId, spaceId,
    source._renderCfg?.spaces
      .find((space) => (space as { id?: unknown } | null)?.id === spaceId) ?? null,
    source._curSpaceCfg ?? null,
  );
}

/*
 * #769: the one source of the wall-union and physical-bodies keys, the bound of
 * the union pool and its entry. The card's miss branch and the resize runtime
 * (`_rszEdgeDown` finds the pre-drag union, `_rszCancelDrag` aliases it back,
 * the preview and cancel re-key the physical bodies) build them only here: a
 * copy in another format would silently stop hitting. The LED editor keys its
 * own placement bodies with `physicalBodiesKey` too.
 */

/** Recently shown floors whose wall union stays warm. */
export const WALL_UNION_POOL_LIMIT = 8;

/** The wall-union key of a floor: its content key and its room count. */
export const wallUnionKey = (floorKey: string, roomCount: number): string => `${floorKey}|${roomCount}`;

/** The physical-bodies key of a floor at a grid scale. */
export const physicalBodiesKey = (floorKey: string, cellCm: number, gridPitch: number): string =>
  `${floorKey}|${cellCm}|${gridPitch}`;

/** One entry of the wall-union pool. */
export interface WallUnionPoolEntry<T> { key: string; value: T }

/**
 * The pool entry of a union built from `record`, the floor record as rendered.
 * The union carries that record's light-geometry fingerprint as the
 * non-enumerable `sourceFingerprint`: Glow and the light barriers reuse the
 * masonry only for the record it was built from.
 */
export function wallUnionPoolEntry<T extends object | null>(
  key: string, value: T, record: unknown, cellCm: number, gridPitch: number,
): WallUnionPoolEntry<T> {
  if (value) Object.defineProperty(value, 'sourceFingerprint', {
    value: lightGeometryFingerprint(record, cellCm, gridPitch),
    enumerable: false,
  });
  return { key, value };
}

/** Write `entry` into the union pool under its own key, most recent; returns it. */
export function writeWallUnionPool<T>(
  pool: Map<string, WallUnionPoolEntry<T>>, entry: WallUnionPoolEntry<T>,
): WallUnionPoolEntry<T> {
  lruWrite(pool, entry.key, entry, WALL_UNION_POOL_LIMIT);
  return entry;
}

/**
 * #814: the entry of `key` in a per-floor pool of the card (physical bodies,
 * opening tunnels), bounded like the union pool. `active` is the card's current
 * entry (`_physicalBodiesCache`, `_openingTunnelCache`); its own key answers
 * first, so the Resize preview that re-keys it in place stays a hit without
 * entering the pool. Otherwise a pooled entry, or `build()` written as the most
 * recent — a full pool evicts the least recent floor. Any read of a pooled key
 * refreshes its recency. The caller gets a copy: re-keying it never renames a
 * pooled record.
 */
export function floorPoolEntry<T extends { key: string }>(
  pool: Map<string, T>, active: T | null, key: string, build: () => T,
): T {
  const pooled = lruRead(pool, key);
  if (active?.key === key) return active;
  if (pooled.hit) return { ...pooled.value };
  const entry = build();
  lruWrite(pool, key, entry, WALL_UNION_POOL_LIMIT);
  return { ...entry };
}

/**
 * #814: the key of the opening wall index (`openingWallIndex` in
 * wall-thickness.ts), read afresh on every call — an in-place edit counts.
 * Every input: the floor, its rooms in order (id and the polygon `roomPoly`
 * reads, the rect fallback included), its wall records, the open cuts and the
 * scale. Not the global config epoch: another floor's edit, a shared setting
 * or a Home Assistant update leaves every one of them as it was.
 */
export const openingWallIndexKey = (
  spaceId: string, rooms: readonly unknown[], walls: readonly { key: string; cm: number; a?: number[]; b?: number[] }[],
  cuts: readonly number[][], scale: readonly number[],
): string => [
  spaceId, ...scale,
  rooms.map((room) => `${(room as { id?: string } | null)?.id || ''}:${roomPoly(room)?.join('/')}`).join(';'),
  walls.map((wall) => `${wall.key}:${wall.a}:${wall.b}:${wall.cm}`).join(';'),
  cuts.join(';'),
].join('|');

/** #814: an exterior window of the sun layer, in render units (docs/SUN.md). */
export interface SunWindow { id: string; x: number; y: number; angle: number; length: number }

/**
 * #814: the key of the sun wedges (`_renderSunRays`; the 2.5D wash adds its
 * cell size and lit floors). `index` is the opening wall index key (rooms,
 * walls, cuts, scale), `bodies` the physical bodies key — the floor record the
 * occluders, the wall union and the inner contours are cached by — then the
 * windows, `sun` (azimuth, elevation, north, ray origin) and the zero walls.
 * Not the global config epoch (see `openingWallIndexKey`).
 */
export const sunGeometryKey = (
  index: string, bodies: string, windows: readonly SunWindow[], sun: readonly unknown[],
  zero: { style: unknown; barriers: readonly number[][] },
): string => [
  index, bodies, windows.map((w) => `${w.id}:${w.x},${w.y},${w.angle},${w.length}`).join(';'),
  ...sun, zero.style, zero.barriers.join(';'),
].join('|');
