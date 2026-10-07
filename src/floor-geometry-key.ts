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
