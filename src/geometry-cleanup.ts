/**
 * Write-time candidate preparation that never loses plan objects silently (#842).
 *
 * Every editor write used to pass the live config through a cleanup that
 * filtered `partitions` and `wall_columns` (bad or repeated id, point off the
 * canvas, a degenerate partition) and rebuilt columns from a field whitelist —
 * in place, on the live `_serverCfg`, before anything was decided. Old stores
 * still carry such records (the backend does not re-validate on load), so an
 * unrelated save could delete them, or fail on the backend when a removed
 * partition still hosted an opening.
 *
 * The contract (ТЗ #842, К1–К3):
 * - R is what the preparation would delete: those partitions and columns plus
 *   every opening hosted (`host.kind === 'partition'`) by a removed partition
 *   whose id no kept partition carries. It is computed on the candidate as the
 *   operation hands it over, so the operation's own deletions are not in R.
 * - A non-empty R refuses the write: nothing is sent, the live config is not
 *   touched, and the destructive confirmation (K3) names the counts. Teardown
 *   has no interface to ask in, so it only refuses.
 * - Normalisation that deletes nothing (column canonical fields with unknown
 *   fields kept, partition `cm`, legacy `segments`, `display: ripple`, and the
 *   canonical `walls` degradation of thickness records for vanished edges)
 *   runs only once R is empty, i.e. once the write is decided.
 *
 * Lives in the lazy editor graph: View never prepares an editor candidate.
 */
import { CANVAS_LIMIT, GRID_PITCH, GRID_STEP_N, NORM_W } from './canvas-constants';
import { GEOMETRY_CLEANUP_REFUSED } from './config-adoption';
import type { HpConfirmRequest } from './danger-confirm';
import type { I18nKey } from './i18n';
import { sanitizeOpenSpans } from './open-spans';
import { canonicalColumnAngle, clampColumnCm } from './physical-geometry';
import { spaceModels } from './space-geometry';
import { selectSpaceModelById } from './space-model-selection';
import type { ServerConfig } from './types';
import { contentFingerprint } from './visual-continuity';
import { degradeWalls } from './wall-thickness';
import { resolveZeroWalls } from './zero-walls';

/** Positions of R inside one space (array indices of the inspected config). */
export interface SpaceGeometryRemoval {
  readonly space: number;
  readonly partitions: readonly number[];
  readonly columns: readonly number[];
  readonly openings: readonly number[];
}

/** R: what preparing this config for a write would delete. */
export interface GeometryRemoval {
  readonly spaces: readonly SpaceGeometryRemoval[];
  readonly partitions: number;
  readonly columns: number;
  readonly openings: number;
  /** Positions and contents of every removed record — R is applied only while it still matches. */
  readonly fingerprint: string;
}

type AnyRecord = Record<string, any>; // any-ok: legacy store records are untyped by definition

const finitePoint = (point: unknown): boolean => Array.isArray(point) && point.length === 2
  && point.every((value) => Number.isFinite(Number(value)) && Math.abs(Number(value)) <= CANVAS_LIMIT);

const records = (value: unknown): AnyRecord[] | null => (Array.isArray(value) ? value : null);

/**
 * R for `config`, read-only. The predicates are exactly the historical write
 * filter: ids are 1–64-character strings unique across partitions + columns of
 * a space (first valid owner wins), points finite inside ±CANVAS_LIMIT, a
 * partition longer than 1e-9.
 */
export function findGeometryRemoval(config: ServerConfig | null | undefined): GeometryRemoval | null {
  const found: SpaceGeometryRemoval[] = [];
  const removedRecords: unknown[] = [];
  let partitionCount = 0;
  let columnCount = 0;
  let openingCount = 0;
  (records(config?.spaces) || []).forEach((space, spaceIndex) => {
    const ids = new Set<unknown>();
    const claim = (id: unknown, valid: boolean): boolean => {
      if (!valid || typeof id !== 'string' || id.length < 1 || id.length > 64 || ids.has(id)) return false;
      ids.add(id);
      return true;
    };
    const partitions: number[] = [];
    const removedIds = new Set<unknown>();
    (records(space?.partitions) || []).forEach((partition, index) => {
      const valid = !!partition && finitePoint(partition.a) && finitePoint(partition.b)
        && Math.hypot(partition.a[0] - partition.b[0], partition.a[1] - partition.b[1]) > 1e-9;
      if (claim(partition?.id, valid)) return;
      partitions.push(index);
      if (typeof partition?.id === 'string') removedIds.add(partition.id);
    });
    const keptPartitionIds = new Set(ids);
    const columns: number[] = [];
    (records(space?.wall_columns) || []).forEach((column, index) => {
      if (!claim(column?.id, !!column && finitePoint(column.center))) columns.push(index);
    });
    const openings: number[] = [];
    (records(space?.openings) || []).forEach((opening, index) => {
      const host = opening?.host;
      if (host?.kind === 'partition' && removedIds.has(host.id) && !keptPartitionIds.has(host.id)) {
        openings.push(index);
      }
    });
    if (!partitions.length && !columns.length && !openings.length) return;
    found.push({ space: spaceIndex, partitions, columns, openings });
    removedRecords.push(spaceIndex, space?.id,
      partitions.map((index) => space.partitions[index]),
      columns.map((index) => space.wall_columns[index]),
      openings.map((index) => space.openings[index]));
    partitionCount += partitions.length;
    columnCount += columns.length;
    openingCount += openings.length;
  });
  if (!found.length) return null;
  return {
    spaces: found, partitions: partitionCount, columns: columnCount, openings: openingCount,
    fingerprint: contentFingerprint(removedRecords),
  };
}

/** K3 «Delete and save»: delete exactly R from `config`, in place. */
export function removeGeometryEntries(config: ServerConfig, removal: GeometryRemoval): void {
  const spaces = records(config.spaces) || [];
  const drop = (list: AnyRecord[] | null, indices: readonly number[]): void => {
    if (!list) return;
    for (const index of [...indices].sort((a, b) => b - a)) list.splice(index, 1);
  };
  for (const entry of removal.spaces) {
    const space = spaces[entry.space];
    if (!space) continue;
    drop(records(space.partitions), entry.partitions);
    drop(records(space.wall_columns), entry.columns);
    drop(records(space.openings), entry.openings);
  }
}

/** A column in its canonical write form; fields the backend allows but this client does not know stay (K1). */
function canonicalColumn(column: AnyRecord): AnyRecord {
  const circle = column.shape === 'circle';
  const next: AnyRecord = {
    ...column,
    shape: circle ? 'circle' : 'square',
    center: [Number(column.center[0]), Number(column.center[1])],
    cm: clampColumnCm(Number(column.cm) || 15),
  };
  if (circle) delete next.angle;
  else next.angle = canonicalColumnAngle(column.angle);
  return next;
}

/**
 * The deleting-nothing part of the write preparation, in place. Call it only
 * when `findGeometryRemoval(config)` is null: then the historical filters keep
 * every record and this is exactly the historical result.
 */
export function normalizeLegacyGeometryInPlace(config: ServerConfig): void {
  // «Ripple only» was removed from the UI: keep old configs readable, then
  // materialise the recognisable icon+activity presentation on any write.
  for (const marker of config?.markers || []) {
    if (marker.display === 'ripple') marker.display = 'icon_ripple';
  }
  for (const sp of config?.spaces || []) {
    const space = sp as AnyRecord;
    delete space.segments;
    if (Array.isArray(space.partitions)) {
      space.partitions = space.partitions.map((partition: AnyRecord) => ({
        ...partition,
        cm: Number.isFinite(Number(partition.cm)) ? Math.max(0, Math.min(100, Number(partition.cm))) : 15,
      }));
      if (!space.partitions.length) delete space.partitions;
    }
    if (Array.isArray(space.wall_columns)) {
      space.wall_columns = space.wall_columns.map(canonicalColumn);
      if (!space.wall_columns.length) delete space.wall_columns;
    }
    if (Array.isArray(sp.walls)) {
      // Thickness records keyed to an edge that no longer exists are not plan
      // objects; dropping them stays the canonical write cleanup (AUD-159B6-01).
      const model = selectSpaceModelById(spaceModels({ spaces: [sp] } as ServerConfig), sp.id);
      const cuts = model
        ? resolveZeroWalls(sp, model, NORM_W, GRID_PITCH * 0.02).contour
          .map((cut) => cut.map((value) => value / NORM_W))
        : sanitizeOpenSpans(space.open_spans).map((e) => [e.a[0], e.a[1], e.b[0], e.b[1]]);
      sp.walls = degradeWalls(sp.walls, sp.rooms || [], GRID_STEP_N, 1, cuts);
      if (!sp.walls.length) delete sp.walls;
    }
  }
}

/** What the refusal and the K3 dialog need from the editor runtime. */
export interface GeometryCleanupPort {
  readonly host: {
    readonly _serverCfg: ServerConfig | null;
    readonly isConnected: boolean;
    readonly _writeChain: Promise<void>;
    readonly _saveConfigDebounced: { (): void; flush(): void };
    _confirmDanger(request: HpConfirmRequest): Promise<boolean>;
    _t(key: I18nKey, vars?: Record<string, string | number>): string;
    _showToast(message: string): void;
  };
  /** Bump the geometry epoch and (re)arm the one deferred write. */
  _saveConfig(): void;
}

/** Host → fingerprint of the R its open K3 dialog shows (session state, never persisted). */
const asking = new WeakMap<object, string>();

/**
 * K2: the error a refused write throws. While connected it also asks K3, once
 * per R: a repeated refusal of the same R while its dialog is open (the
 * restored deferred write of a refused Save, the next deferred write) opens no
 * second dialog; a different R replaces it (`HpConfirmController`).
 */
export function refuseGeometryWrite(runtime: GeometryCleanupPort, removal: GeometryRemoval): Error {
  const host = runtime.host;
  if (host.isConnected && asking.get(host) !== removal.fingerprint) void askGeometryCleanup(runtime, removal);
  return Object.assign(new Error(GEOMETRY_CLEANUP_REFUSED), { code: GEOMETRY_CLEANUP_REFUSED });
}

async function askGeometryCleanup(runtime: GeometryCleanupPort, removal: GeometryRemoval): Promise<void> {
  const host = runtime.host;
  asking.set(host, removal.fingerprint);
  let accepted = false;
  try {
    accepted = await host._confirmDanger({
      key: 'geometry-cleanup',
      kind: 'destructive',
      title: host._t('confirm.geometry_cleanup_title'),
      message: host._t('confirm.geometry_cleanup_body', {
        partitions: removal.partitions, columns: removal.columns, openings: removal.openings,
      }),
      confirmLabel: host._t('btn.delete_and_save'),
      cancelLabel: host._t('btn.cancel'),
    });
  } finally {
    if (asking.get(host) === removal.fingerprint) asking.delete(host);
  }
  // «Cancel»: nothing is sent and nothing changes; the next write passes K2 again.
  if (!accepted || !host.isConnected) return;
  const live = host._serverCfg;
  const current = findGeometryRemoval(live);
  if (live && current && current.fingerprint === removal.fingerprint) removeGeometryEntries(live, current);
  // One ordinary write of the current plan, pending edits included (an open
  // dialog's draft is not part of the plan). If the plan changed while the
  // dialog was open, nothing was deleted and this write simply asks again.
  runtime._saveConfig();
  host._saveConfigDebounced.flush();
  if (!current || current.fingerprint !== removal.fingerprint) return;
  host._writeChain.then(
    () => host._showToast(host._t('toast.geometry_cleanup_done')),
    () => undefined, // the deferred writer's ordinary failure policy already answered
  );
}
