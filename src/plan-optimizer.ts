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
  degradeWalls, normalizeWallIntervals, rekeyWallsAfterMove, roomWallProfile,
  setWallThickness, type WallEntry,
} from './wall-thickness';
import { applyOpeningMoves, mergeCollinearPartitions } from './wall-merge';

/** Bump when a new lossless maintenance pass is added. */
export const PLAN_MODEL_VERSION = 6;
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
  /** Legacy space Glow tokens projected into data fill + overlay. */
  glowSpacesMigrated: number;
  /** Legacy room Glow tokens projected into inherited fill + overlay. */
  glowRoomsMigrated: number;
  /** Spaces whose wall/open-span representation was rewritten canonically. */
  canonicalized: number;
  /** Redundant equal-thickness wall entries removed by canonicalisation. */
  wallsMerged: number;
  /** Touching/overlapping virtual pieces merged on the same room pair. */
  spansMerged: number;
  /** Collinear independent-wall records collapsed into one (#229). */
  partitionsMerged: number;
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

/** Canonical physical identity for a segment, independent of endpoint order. */
const optimizerSpanKey = (a: number[], b: number[], coordScale: number): string => {
  const scale = coordScale > 0 ? coordScale : 1;
  const point = (p: number[]) => `${(p[0] / scale).toFixed(12)},${(p[1] / scale).toFixed(12)}`;
  const ka = point(a), kb = point(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};

/**
 * Explicit-Optimize-only lossy cleanup for one otherwise inaccessible wall
 * artefact. Runtime/editor normalisation deliberately remains lossless.
 *
 * A positive interval shorter than half a grid step may inherit its two equal
 * neighbours only when all three pieces belong to one original straight room
 * edge and neither endpoint is a room/opening topology node. Candidates are
 * collected from the untouched effective profile first, so replacements never
 * cascade and input order cannot change the result.
 */
export function collapseIsolatedWallThicknessIslands(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): WallEntry[] {
  if (!walls?.length) return [];
  const scale = coordScale > 0 ? coordScale : 1;
  const eps = Math.max(pitch * scale * 0.02, 1e-9);
  const nodes: number[][] = [];
  for (const room of rooms || []) {
    for (const point of roomPoly(room) || []) nodes.push([point[0], point[1]]);
  }
  for (const cut of openCuts || []) {
    if (Array.isArray(cut) && cut.length >= 4 && cut.slice(0, 4).every(Number.isFinite)) {
      nodes.push([cut[0], cut[1]], [cut[2], cut[3]]);
    }
  }
  const isTopologyNode = (point: number[]): boolean => nodes.some((node) => (
    Math.hypot(point[0] - node[0], point[1] - node[1]) <= eps * 2
  ));

  interface Candidate {
    a: number[];
    b: number[];
    targets: Set<number>;
  }
  const candidates = new Map<string, Candidate>();
  for (const room of rooms || []) {
    if (!room?.id) continue;
    const profile = roomWallProfile(
      rooms, room.id, walls, openCuts, pitch, cellCm, gridPitch, scale,
    );
    if (!profile) continue;
    for (let parent = 0; parent < profile.orig.length; parent++) {
      const children: number[] = [];
      for (let index = 0; index < profile.parent.length; index++) {
        if (profile.parent[index] === parent) children.push(index);
      }
      for (let at = 1; at + 1 < children.length; at++) {
        const left = children[at - 1], centre = children[at], right = children[at + 1];
        if (profile.kinds[left] === null || profile.kinds[centre] === null
            || profile.kinds[right] === null) continue;
        const leftCm = profile.cms[left], centreCm = profile.cms[centre];
        const rightCm = profile.cms[right];
        if (!(leftCm > 0) || !(centreCm > 0) || leftCm !== rightCm || centreCm === leftCm) continue;
        const a = profile.poly[centre], b = profile.poly[(centre + 1) % profile.poly.length];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        // The product boundary is strict. A mathematically exact half-step can
        // arrive a few ulps short after endpoint subtraction, so keep a tiny
        // scale-relative numeric guard instead of accidentally deleting it.
        const halfStep = gridPitch * 0.5;
        if (!(length > eps) || !(length < halfStep - gridPitch * 1e-9)) continue;
        if (isTopologyNode(a) || isTopologyNode(b)) continue;
        const key = optimizerSpanKey(a, b, scale);
        const found = candidates.get(key);
        if (found) found.targets.add(leftCm);
        else candidates.set(key, {
          a: [a[0], a[1]], b: [b[0], b[1]], targets: new Set([leftCm]),
        });
      }
    }
  }

  let out = walls.slice();
  const samePoint = (x: number[], y: number[]): boolean => (
    Math.hypot(x[0] - y[0], x[1] - y[1]) <= eps * 2
  );
  const exactMatches = (wall: WallEntry, candidate: Candidate): boolean => {
    if (!Array.isArray(wall.a) || !Array.isArray(wall.b)
        || wall.a.length < 2 || wall.b.length < 2) return false;
    const a = [Number(wall.a[0]) * scale, Number(wall.a[1]) * scale];
    const b = [Number(wall.b[0]) * scale, Number(wall.b[1]) * scale];
    if (![...a, ...b].every(Number.isFinite)) return false;
    return (samePoint(a, candidate.a) && samePoint(b, candidate.b))
      || (samePoint(a, candidate.b) && samePoint(b, candidate.a));
  };
  for (const candidate of [...candidates.values()]
    .filter((item) => item.targets.size === 1)
    .sort((x, y) => optimizerSpanKey(x.a, x.b, scale)
      .localeCompare(optimizerSpanKey(y.a, y.b, scale)))) {
    const target = [...candidate.targets][0];
    const owners = out.filter((wall) => exactMatches(wall, candidate));
    if (new Set(owners.map((wall) => wall.cm)).size > 1) continue;
    let exactMatch = false;
    out = out.map((wall) => {
      if (!exactMatches(wall, candidate)) return wall;
      exactMatch = true;
      return wall.cm === target ? wall : { ...wall, cm: target };
    });
    // An effective breakpoint can originate from a legacy-compatible key. If
    // no exact row owns it, materialise only this proven interval; the normal
    // lossless canonicaliser immediately following this helper does the merge.
    if (!exactMatch) {
      out = setWallThickness(out, candidate.a, candidate.b, target, pitch, scale);
    }
  }
  return out;
}

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
const migrateLosslessly = (config: any): {
  total: number; glowSpaces: number; glowRooms: number;
} => {
  let n = 0;
  let glowSpaces = 0;
  let glowRooms = 0;
  for (const marker of config.markers || []) {
    if (marker.display === 'ripple') { marker.display = 'icon_ripple'; n++; }
    if (Array.isArray(marker.controls)) {
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
    const spaceSettings = space.settings;
    if (spaceSettings?.fill_mode === 'glow') {
      if (typeof spaceSettings.glow_enabled !== 'boolean') spaceSettings.glow_enabled = true;
      spaceSettings.fill_mode = 'none';
      n++;
      glowSpaces++;
    }
    for (const room of space.rooms || []) {
      const roomSettings = room.settings;
      if (roomSettings?.fill_mode !== 'glow') continue;
      if (typeof roomSettings.glow !== 'boolean') roomSettings.glow = true;
      delete roomSettings.fill_mode;
      n++;
      glowRooms++;
    }
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
      // Non-positive values have always meant "use the 5 cm runtime default".
      // Repairing 0/null to the schema minimum (0.1) silently changed the
      // effective scale fiftyfold instead of preserving what the plan showed.
      space.cell_cm = Number.isFinite(rawCellCm) && rawCellCm > 0
        ? clamp(rawCellCm, CELL_CM_MIN, CELL_CM_MAX)
        : DEFAULT_CELL_CM;
      n++;
    }
    const repairedCellCm = Number(space.cell_cm);
    const cellCm = Number.isFinite(repairedCellCm) && repairedCellCm > 0
      ? repairedCellCm : DEFAULT_CELL_CM;
    for (const column of space.wall_columns || []) {
      if (column.shape === 'circle') {
        if (own(column, 'angle')) { delete column.angle; n++; }
      } else if (column.shape === 'square' && own(column, 'angle')) {
        const raw = Number(column.angle) || 0;
        const angle = ((raw % 90) + 90) % 90;
        if (column.angle !== angle) { column.angle = angle; n++; }
      }
    }
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
  return { total: n, glowSpaces, glowRooms };
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
  const migration = migrateLosslessly(config);
  let migrated = migration.total;

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
  let partitionsMerged = 0;
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
    walls = collapseIsolatedWallThicknessIslands(
      nextModel.rooms, walls, cuts, GRID_STEP_N,
      Number(space.cell_cm) > 0 ? Number(space.cell_cm) : DEFAULT_CELL_CM,
      GRID_PITCH, NORM_W,
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

    // Independent walls drawn in several clicks: collapse the seams that have
    // piled up. Drawing merges only its own chain, so this is where an older
    // plan finally loses them — explicitly, with a report and an undo (#229).
    const partitionMerge = mergeCollinearPartitions(space.partitions || [], {
      pitch: GRID_STEP_N,
      geometry: {
        // Rooms are stored in the same coordinates as partitions: `roomPoly`
        // hands back the raw config polygon, so scaling it here would push
        // every room into a corner and no junction would ever be found
        // (review CODE-REVIEW-229-r1, High-1).
        roomPolygons: (space.rooms || [])
          .map((room: any) => roomPoly(room))
          .filter((poly: number[][] | null): poly is number[][] => !!poly),
        columns: space.wall_columns || [],
        draftEnds: (space.room_drafts || []).flatMap((draft: any) => {
          const points = draft?.points || [];
          return points.length ? [points[0], points[points.length - 1]] : [];
        }),
      },
    });
    if (partitionMerge.merged) {
      partitionsMerged += partitionMerge.merged;
      space.partitions = partitionMerge.partitions;
      applyOpeningMoves(space.openings, space.partitions, partitionMerge.openingMoves, {
        coordScale: NORM_W,
        cellCm: Number(space.cell_cm) > 0 ? Number(space.cell_cm) : DEFAULT_CELL_CM,
        gridPitch: GRID_PITCH,
      });
    }
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
      glowSpacesMigrated: migration.glowSpaces,
      glowRoomsMigrated: migration.glowRooms,
      canonicalized,
      wallsMerged,
      spansMerged,
      partitionsMerged,
    },
    changed,
  };
}
