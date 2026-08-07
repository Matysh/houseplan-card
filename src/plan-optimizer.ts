/**
 * Explicit, idempotent maintenance for a whole House Plan model.
 *
 * This is deliberately narrower than "delete anything suspicious". It only
 * performs transformations whose meaning is known and lossless, then aligns
 * plan objects to the lattice and rewrites derived wall/open-span storage into
 * its canonical form. Unknown fields, backdrop calibration, view boxes,
 * unattached layout entries and files are preserved.
 */

import { alignAllToGrid, type AlignReport } from './align-grid';
import { hasLegacySelfLightIntent } from './devices';
import {
  DECOR_TEXT_BASE, decorTextScale, liveTextReference, liveTextToken, roomPoly,
} from './logic';
import {
  clipOpenSpansToShared, cutsToSpanEntries, entryToSeg,
  projectOnSeg, rekeyOpenSpansAfterMove, resolveOpenCuts, sanitizeOpenSpans,
  snapOpenPoint, spanToEntry, syncOpenToFromCuts,
} from './open-spans';
import {
  GRID_PITCH, GRID_STEP_N, NORM_W, PLAN_SCALE_MAX, PLAN_SCALE_MIN, spaceModels,
} from './space-geometry';
import {
  degradeWalls, normalizeWallIntervals, rekeyWallsAfterMove,
} from './wall-thickness';

/** Bump when a new lossless maintenance pass is added. */
export const PLAN_MODEL_VERSION = 4;
const DEFAULT_CELL_CM = 5;
const CELL_CM_MIN = 0.1;
const CELL_CM_MAX = 1000;
const DECOR_WIDTH_CM_MIN = 0.1;
const DECOR_WIDTH_CM_MAX = 100;
const DECOR_TEXT_CM_MIN = 0.1;
const DECOR_TEXT_CM_MAX = 2000;

export interface OptimizeReport extends AlignReport {
  modelFrom: number;
  modelTo: number;
  /** Legacy fields converted or removed. */
  migrated: number;
  /** Spaces whose wall/open-span representation was rewritten canonically. */
  canonicalized: number;
  /** Redundant equal-thickness wall entries removed by canonicalisation. */
  wallsMerged: number;
  /** Touching/overlapping virtual pieces merged on the same room pair. */
  spansMerged: number;
}

export interface OptimizeResult {
  config: any;
  layout: Record<string, any>;
  report: OptimizeReport;
  changed: boolean;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const own = (o: any, key: string): boolean => Object.prototype.hasOwnProperty.call(o, key);
const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

const modelOf = (space: any): any => (
  spaceModels({ spaces: [space], markers: [], settings: {} } as any)[0]
);

/** Parallel per-room edges; unlike deduped roomEdges(), indices remain stable
 * while vertices are rounded, which lets exact wall fragments follow a move. */
const edgePairs = (rooms: any[]): [number[], number[]][] => {
  const out: [number[], number[]][] = [];
  for (const room of rooms || []) {
    const poly = roomPoly(room);
    if (!poly?.length) continue;
    for (let i = 0; i < poly.length; i++) {
      out.push([
        [poly[i][0], poly[i][1]],
        [poly[(i + 1) % poly.length][0], poly[(i + 1) % poly.length][1]],
      ]);
    }
  }
  return out;
};

/** Convert read-compatible legacy fields where the conversion is exact. */
const migrateLosslessly = (config: any): number => {
  let n = 0;
  for (const marker of config.markers || []) {
    if (marker.display === 'ripple') { marker.display = 'icon_ripple'; n++; }
    if (Array.isArray(marker.controls)) {
      // R2: preserve the old, once-supported declaration that an entity-bound
      // switch is itself a light source before removing its redundant control.
      if (hasLegacySelfLightIntent(marker.binding, marker.controls) && marker.is_light !== true) {
        marker.is_light = true;
        n++;
      }
      // R6: maintenance knows only the direct entity binding. Do not run the
      // runtime filter here: YAML-only targets and duplicates are user data,
      // not garbage that a "lossless" optimiser may silently discard.
      const self = typeof marker.binding === 'string' && marker.binding.startsWith('entity:')
        ? marker.binding.slice('entity:'.length) : '';
      const controls = self ? marker.controls.filter((eid: unknown) => eid !== self) : marker.controls;
      if (JSON.stringify(controls) !== JSON.stringify(marker.controls)) {
        marker.controls = controls.length ? controls : null;
        n++;
      }
    }
    const vacuum = marker.vacuum;
    if (vacuum && own(vacuum, 'trail')) {
      if (!['never', 'cleaning', 'always'].includes(vacuum.trail_mode)) {
        vacuum.trail_mode = vacuum.trail === false ? 'never' : 'cleaning';
      }
      delete vacuum.trail;
      n++;
    }
  }

  for (const space of config.spaces || []) {
    if (own(space, 'segments')) { delete space.segments; n++; }
    if (own(space, 'plan_scale')) {
      const k = Number(space.plan_scale);
      if (Number.isFinite(k) && k >= PLAN_SCALE_MIN && k <= PLAN_SCALE_MAX) {
        if (!own(space, 'plan_scale_x')) space.plan_scale_x = k;
        if (!own(space, 'plan_scale_y')) space.plan_scale_y = k;
        delete space.plan_scale;
        n++;
      }
    }
    const rawCellCm = Number(space.cell_cm);
    if (own(space, 'cell_cm') && (
      !Number.isFinite(rawCellCm) || rawCellCm < CELL_CM_MIN || rawCellCm > CELL_CM_MAX
    )) {
      space.cell_cm = Number.isFinite(rawCellCm)
        ? clamp(rawCellCm, CELL_CM_MIN, CELL_CM_MAX)
        : DEFAULT_CELL_CM;
      n++;
    }
    const repairedCellCm = Number(space.cell_cm);
    const cellCm = Number.isFinite(repairedCellCm) && repairedCellCm > 0
      ? repairedCellCm : DEFAULT_CELL_CM;
    for (const shape of space.decor || []) {
      if (own(shape, 'width')) {
        const legacyWidth = Number(shape.width);
        if (own(shape, 'width_cm') || Number.isFinite(legacyWidth)) {
          if (!own(shape, 'width_cm'))
            shape.width_cm = Number(clamp(
              (legacyWidth / GRID_PITCH) * cellCm,
              DECOR_WIDTH_CM_MIN,
              DECOR_WIDTH_CM_MAX,
            ).toFixed(6));
          delete shape.width;
          n++;
        }
      }
      if ((shape?.kind === 'rect' || shape?.kind === 'ellipse') && shape.fill === true) {
        if (!own(shape, 'fill_color')) { shape.fill_color = shape.color || '#607d8b'; n++; }
        if (!own(shape, 'fill_opacity')) { shape.fill_opacity = 0.25; n++; }
      }
      if (shape?.kind !== 'text') continue;

      // Text size is physical styling, like stroke thickness. Convert either
      // legacy representation to centimetres without changing its current
      // appearance at this space's scale.
      if (shape.size_cm === undefined) {
        shape.size_cm = Number(clamp(
          ((DECOR_TEXT_BASE * decorTextScale(shape)) / GRID_PITCH) * cellCm,
          DECOR_TEXT_CM_MIN,
          DECOR_TEXT_CM_MAX,
        ).toFixed(6));
        delete shape.scale;
        delete shape.size;
        n++;
      } else if (own(shape, 'scale') || own(shape, 'size')) {
        delete shape.scale;
        delete shape.size;
        n++;
      }

      let text = String(shape.text ?? '');
      const hasInline = [...text.matchAll(/\{([^{}\r\n]+)\}/g)]
        .some((m) => !!liveTextReference(m[1]));
      const hasLegacy = own(shape, 'entity') || own(shape, 'attr') || own(shape, 'unit');
      if (!hasLegacy) continue;

      // Inline references are already authoritative, so stale side fields can
      // be discarded. Otherwise migrate only the subset representable without
      // losing an explicit unit or a non-canonical attribute.
      const explicitUnit = String(shape.unit ?? '').trim();
      // The legacy selector stored the entity state as attr="state". In the
      // inline grammar state is the bare entity token; `:state` would instead
      // ask Home Assistant for an attribute named "state" and change meaning.
      const legacyAttr = String(shape.attr ?? '').trim().toLowerCase() === 'state'
        ? null
        : shape.attr;
      const token = !hasInline && !explicitUnit
        ? liveTextToken(shape.entity, legacyAttr)
        : '';
      if (hasInline || token) {
        if (token) {
          const slot = text.indexOf('{}');
          text = slot >= 0
            ? text.slice(0, slot) + token + text.slice(slot + 2)
            : `${text}${text ? ' ' : ''}${token}`;
          shape.text = text;
        }
        delete shape.entity;
        delete shape.attr;
        delete shape.unit;
        n++;
      }
    }
  }
  return n;
};

/**
 * Produce the exact config/layout pair that the confirmation dialog previews.
 * Calling it again on its own output is a no-op.
 */
export function optimizePlans(configIn: any, layoutIn: Record<string, any>): OptimizeResult {
  const config = clone(configIn || { spaces: [], markers: [], settings: {} });
  const original = JSON.stringify(configIn || {});
  const originalLayout = JSON.stringify(layoutIn || {});
  const modelFrom = Number.isInteger(Number(config.model_version))
    ? Number(config.model_version)
    : 0;
  let migrated = migrateLosslessly(config);

  // Materialise legacy open_to before geometry moves. Once explicit spans
  // exist, they are the source of truth and open_to becomes a derived index.
  for (const space of config.spaces || []) {
    const model = modelOf(space);
    if (!model) continue;
    const existing = sanitizeOpenSpans(space.open_spans);
    if (!existing.length) {
      const cuts = resolveOpenCuts(
        model.rooms, null, NORM_W, GRID_PITCH * 0.02, true,
      );
      if (cuts.length) {
        space.open_spans = cutsToSpanEntries(cuts, NORM_W);
        migrated++;
      }
    }
  }

  const beforeSpaces = clone(config.spaces || []);
  const aligned = alignAllToGrid(config.spaces || [], layoutIn || {});
  config.spaces = aligned.spaces;
  const alignReport: AlignReport = { ...aligned.report };

  let wallsMerged = 0;
  let spansMerged = 0;
  let canonicalized = 0;
  for (let i = 0; i < config.spaces.length; i++) {
    const before = beforeSpaces[i];
    const space = config.spaces[i];
    const canonicalBefore = JSON.stringify({
      spans: before.open_spans || [],
      links: (before.rooms || []).map((r: any) => [r.id, r.open_to || []]),
      walls: before.walls || [],
    });
    const oldModel = modelOf(before);
    const nextModel = modelOf(space);
    if (!oldModel || !nextModel) continue;

    const oldEdges = edgePairs(oldModel.rooms);
    const nextEdges = edgePairs(nextModel.rooms);
    const eps = GRID_PITCH * 0.02;

    const sourceSpans = sanitizeOpenSpans(before.open_spans);
    let spans = rekeyOpenSpansAfterMove(sourceSpans, oldEdges, nextEdges, NORM_W);
    const spanParts = spans.length;
    spans = clipOpenSpansToShared(spans, nextModel.rooms, NORM_W, eps);
    // Virtual endpoints are wall-bound: snap them by distance along the room
    // edge, just like the drawing tool, instead of rounding X/Y independently
    // (which would pull a point off a diagonal wall).
    spans = spans.map((entry) => {
      const sg = entryToSeg(entry, NORM_W);
      const a = [sg[0], sg[1]], b = [sg[2], sg[3]];
      const mid = [(sg[0] + sg[2]) / 2, (sg[1] + sg[3]) / 2];
      const dx = sg[2] - sg[0], dy = sg[3] - sg[1];
      const len = Math.hypot(dx, dy) || 1;
      const edge = nextEdges
        .map(([ea, eb]) => [ea[0], ea[1], eb[0], eb[1]])
        .filter((candidate) => {
          const ex = candidate[2] - candidate[0], ey = candidate[3] - candidate[1];
          const elen = Math.hypot(ex, ey) || 1;
          return Math.abs(dx * ey - dy * ex) / (len * elen) <= 1e-6
            && projectOnSeg(mid, candidate).d <= eps * 4
            && projectOnSeg(a, candidate).d <= eps * 4
            && projectOnSeg(b, candidate).d <= eps * 4;
        })
        .sort((x, y) => Math.hypot(y[2] - y[0], y[3] - y[1])
          - Math.hypot(x[2] - x[0], x[3] - x[1]))[0];
      alignReport.total++;
      if (!edge) return entry;
      const joints = [[edge[0], edge[1]], [edge[2], edge[3]]];
      const na = snapOpenPoint(a, edge, joints, GRID_PITCH, eps * 2);
      const nb = snapOpenPoint(b, edge, joints, GRID_PITCH, eps * 2);
      if (Math.hypot(nb[0] - na[0], nb[1] - na[1]) < GRID_PITCH * 0.5) return entry;
      const shift = Math.max(Math.hypot(na[0] - a[0], na[1] - a[1]),
        Math.hypot(nb[0] - b[0], nb[1] - b[1]));
      if (shift > GRID_PITCH * 1e-6) {
        alignReport.moved++;
        const shiftN = shift / NORM_W;
        if (shiftN > alignReport.maxShift) alignReport.maxShift = shiftN;
        const shiftCm = (shift / GRID_PITCH)
          * (Number(space.cell_cm) > 0 ? Number(space.cell_cm) : DEFAULT_CELL_CM);
        if (shiftCm > alignReport.maxShiftCm) {
          alignReport.maxShiftCm = shiftCm;
          alignReport.maxSpace = String(space.id || '');
        }
      }
      return spanToEntry(na, nb, NORM_W);
    });
    spans = clipOpenSpansToShared(spans, nextModel.rooms, NORM_W, eps);
    spansMerged += Math.max(0, spanParts - spans.length);
    const cuts = spans.map((entry) => entryToSeg(entry, NORM_W));
    if (spans.length) space.open_spans = spans;
    else delete space.open_spans;
    syncOpenToFromCuts(space.rooms || [], nextModel.rooms, cuts, eps);

    const wallParts = Array.isArray(before.walls) ? before.walls.length : 0;
    let walls = rekeyWallsAfterMove(
      before.walls, oldEdges, nextEdges, GRID_STEP_N, NORM_W,
    );
    walls = normalizeWallIntervals(
      nextModel.rooms, walls, cuts, GRID_STEP_N,
      Number(space.cell_cm) > 0 ? Number(space.cell_cm) : DEFAULT_CELL_CM,
      GRID_PITCH, NORM_W,
    );
    walls = degradeWalls(
      walls, space.rooms || [], GRID_STEP_N, 1,
      cuts.map((c) => [c[0] / NORM_W, c[1] / NORM_W, c[2] / NORM_W, c[3] / NORM_W]),
    );
    wallsMerged += Math.max(0, wallParts - walls.length);
    if (walls.length) space.walls = walls;
    else delete space.walls;
    const canonicalAfter = JSON.stringify({
      spans: space.open_spans || [],
      links: (space.rooms || []).map((r: any) => [r.id, r.open_to || []]),
      walls: space.walls || [],
    });
    if (canonicalAfter !== canonicalBefore) canonicalized++;
  }

  // A version marker is bookkeeping, not maintenance by itself. Persist it
  // only alongside a real config/layout transformation; otherwise an already
  // canonical plan would forever offer an Optimize action that changes no
  // user data. Never downgrade a model written by a newer client.
  const meaningfulChanged = JSON.stringify(config) !== original
    || JSON.stringify(aligned.layout) !== originalLayout;
  if (modelFrom < PLAN_MODEL_VERSION && meaningfulChanged) {
    config.model_version = PLAN_MODEL_VERSION;
  }

  const changed = JSON.stringify(config) !== original
    || JSON.stringify(aligned.layout) !== originalLayout;
  const modelTo = Number.isInteger(Number(config.model_version))
    ? Number(config.model_version)
    : modelFrom;
  return {
    config,
    layout: aligned.layout,
    report: {
      ...alignReport,
      modelFrom,
      modelTo,
      migrated,
      canonicalized,
      wallsMerged,
      spansMerged,
    },
    changed,
  };
}
