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

/** A reader `spaceId → key`, remembered per epoch and per source record. */
export function floorGeometryKeyReader(source: FloorKeySource): (spaceId: string) => string {
  let epoch = Number.NaN;
  const slots = new Map<string, Slot>();
  return (spaceId) => {
    if (source._cfgEpoch !== epoch) {
      epoch = source._cfgEpoch;
      slots.clear();
    }
    const model = source._renderCfg?.spaces
      .find((space) => (space as { id?: unknown } | null)?.id === spaceId) ?? null;
    const current = source._curSpaceCfg ?? null;
    const slot = slots.get(spaceId);
    if (slot && slot.model === model && slot.current === current) return slot.key;
    const key = `${spaceId}|${contentFingerprint(model === current ? model : [model, current])}`;
    slots.set(spaceId, { model, current, key });
    return key;
  };
}
