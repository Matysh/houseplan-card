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
  canonicalizeConfigGeometryInPlace, canonicalizeLayoutGeometryInPlace,
  latticeCanonicalizationReport, type LatticeSpaceReport,
} from './coordinate-canonicalization';
import {
  DECOR_TEXT_BASE, decorTextScale, liveTextReference, liveTextToken, roomPoly,
} from './logic';
import {
  GRID_PITCH, GRID_STEP_N, NORM_W, PLAN_SCALE_MAX, PLAN_SCALE_MIN, spaceModels,
} from './space-geometry';
import {
  degradeWalls, normalizeWallIntervals, rekeyWallsAfterMove, roomWallProfile,
  setWallThickness, wallKey, type WallEntry,
} from './wall-thickness';
import { applyOpeningMoves, mergeCollinearPartitions, spaceMergeGeometry } from './wall-merge';
import { reconcileCoincidentPartitions } from './coincident-partitions';
import {
  repairSpaceReferences, type SpaceReferenceRepairContext, type SpaceReferenceReport,
} from './space-reference-repair';
import { repairNearAxisRoomWalls } from './near-axis';
import {
  commitWallSegmentModelInPlace,
} from './wall-segment-model';
import { legacyZeroContourLines } from './zero-walls';

/** Bump when a new lossless maintenance pass is added. */
export const PLAN_MODEL_VERSION = 9;
const DEFAULT_CELL_CM = 5;
const CELL_CM_MIN = 0.1;
const CELL_CM_MAX = 1000;
const DECOR_WIDTH_CM_MIN = 0.1;
const DECOR_WIDTH_CM_MAX = 100;
const DECOR_TEXT_CM_MIN = 0.1;
const DECOR_TEXT_CM_MAX = 2000;

export interface OptimizeReport extends AlignReport, SpaceReferenceReport {
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
  /** Contour-wall atoms materialised into the stable v8 catalogue. */
  wallSegmentsMigrated: number;
  /** Read-compatible legacy virtual spans converted into zero-wall atoms. */
  legacyZeroWallsMigrated: number;
  /** Redundant equal-thickness wall entries removed by canonicalisation. */
  wallsMerged: number;
  /** Touching/overlapping zero-wall atoms merged on the same room pair. */
  spansMerged: number;
  /** Collinear independent-wall records collapsed into one (#229). */
  partitionsMerged: number;
  /** Independent walls converted into an exact coincident shared room wall. */
  partitionsReconciled: number;
  /** Hosted openings materialised onto the coincident shared room wall. */
  openingsRehosted: number;
  /** Saved wall chains removed because solid room masonry covers every segment. */
  redundantDraftsRemoved: number;
  /** Unique physical near-axis walls accepted for explicit straightening. */
  wallsStraightened: number;
  /** Near-axis walls found but rejected by structural safety checks. */
  wallsStraightenSkipped: number;
  /** Largest accepted endpoint movement in centimetres. */
  maxStraightenShiftCm: number;
  /** Space owning the largest accepted straightening movement. */
  maxStraightenSpace: string;
  /** Near-node coordinate components rewritten to the exact 1/240 double. */
  latticeCoordinatesCanonicalized: number;
  /** Authored off-grid components observed and deliberately left for Align. */
  latticeCoordinatesFar: number;
  /** Largest storage-only coordinate shift in normalized units. */
  latticeMaxShift: number;
  /** Largest storage-only coordinate shift through its owning space scale. */
  latticeMaxShiftCm: number;
  /** Only user-named spaces with at least one rewritten coordinate. */
  latticeSpaces: LatticeSpaceReport[];
}

export interface OptimizeResult {
  config: any;
  layout: Record<string, any>;
  report: OptimizeReport;
  changed: boolean;
}

/** Test/benchmark seam for proving that structural maintenance stays inside Optimize. */
export interface OptimizeDependencies {
  reconcileCoincidentPartitions?: typeof reconcileCoincidentPartitions;
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
 * edge. Opening endpoints and spans between two room topology nodes stay
 * protected; one room T-node plus one synthetic endpoint is safe because the
 * node coordinate and its incident edges are not changed. Candidates are
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
  const roomNodes: number[][] = [];
  for (const room of rooms || []) {
    for (const point of roomPoly(room) || []) roomNodes.push([point[0], point[1]]);
  }
  const openingNodes: number[][] = [];
  for (const cut of openCuts || []) {
    if (Array.isArray(cut) && cut.length >= 4 && cut.slice(0, 4).every(Number.isFinite)) {
      openingNodes.push([cut[0], cut[1]], [cut[2], cut[3]]);
    }
  }
  const isNode = (point: number[], nodes: number[][]): boolean => nodes.some((node) => (
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
        // An opening boundary is always semantic. Room vertices are different:
        // a micro interval between two vertices is semantic, while exactly one
        // vertex is the confirmed T-junction shape from #273. Replacing only
        // the interval cm keeps that vertex and every incident edge intact.
        if (isNode(a, openingNodes) || isNode(b, openingNodes)) continue;
        if (isNode(a, roomNodes) && isNode(b, roomNodes)) continue;
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
export function optimizePlans(
  configIn: any,
  layoutIn: Record<string, any>,
  context: SpaceReferenceRepairContext = {},
  dependencies: OptimizeDependencies = {},
): OptimizeResult {
  const reconcilePartitions = dependencies.reconcileCoincidentPartitions
    ?? reconcileCoincidentPartitions;
  const references = repairSpaceReferences(configIn, layoutIn, context);
  const config = references.config;
  const lattice = latticeCanonicalizationReport(config, references.layout);
  // repairSpaceReferences already owns the immutable candidate clone. Apply
  // the boundary in-place here so Optimize does not allocate a second full
  // config/layout clone merely to remove sub-pixel storage tails (#291).
  canonicalizeConfigGeometryInPlace(config);
  canonicalizeLayoutGeometryInPlace(references.layout);
  const original = JSON.stringify(configIn || {});
  const originalLayout = JSON.stringify(layoutIn || {});
  const modelFrom = Number.isInteger(Number(config.model_version))
    ? Number(config.model_version)
    : 0;
  const migration = migrateLosslessly(config);
  let migrated = migration.total;

  const beforeSpaces = clone(config.spaces || []);
  const aligned = alignAllToGrid(config.spaces || [], references.layout);
  let wallsStraightened = 0;
  let wallsStraightenSkipped = 0;
  let maxStraightenShiftCm = 0;
  let maxStraightenSpace = '';
  const straightenedSpaces = aligned.spaces.map((space: any) => {
    const repaired = repairNearAxisRoomWalls(space);
    wallsStraightened += repaired.report.wallsStraightened;
    wallsStraightenSkipped += repaired.report.wallsStraightenSkipped;
    const cellCm = Number(space?.cell_cm) > 0 ? Number(space.cell_cm) : DEFAULT_CELL_CM;
    const shiftCm = (repaired.report.maxStraightenShift / GRID_STEP_N) * cellCm;
    if (shiftCm > maxStraightenShiftCm) {
      maxStraightenShiftCm = shiftCm;
      maxStraightenSpace = String(space?.id || '');
    }
    return repaired.space;
  });
  // Openings are wall-bound. Once a room endpoint has been straightened, run
  // the same production alignment once more so their centres/angles follow
  // the final host instead of the pre-repair edge.
  const finalAligned = wallsStraightened
    ? alignAllToGrid(straightenedSpaces, aligned.layout)
    : { ...aligned, spaces: straightenedSpaces };
  config.spaces = finalAligned.spaces;
  const alignReport: AlignReport = wallsStraightened ? {
    ...aligned.report,
    moved: aligned.report.moved + finalAligned.report.moved,
    coordsCanonicalized: aligned.report.coordsCanonicalized
      + finalAligned.report.coordsCanonicalized,
    maxShift: Math.max(aligned.report.maxShift, finalAligned.report.maxShift),
    maxShiftCm: Math.max(aligned.report.maxShiftCm, finalAligned.report.maxShiftCm),
    maxSpace: finalAligned.report.maxShiftCm > aligned.report.maxShiftCm
      ? finalAligned.report.maxSpace : aligned.report.maxSpace,
    rotated: aligned.report.rotated + finalAligned.report.rotated,
    removedDrafts: aligned.report.removedDrafts + finalAligned.report.removedDrafts,
  } : { ...aligned.report };

  let wallsMerged = 0;
  let legacyZeroWallsMigrated = 0;
  let spansMerged = 0;
  let partitionsMerged = 0;
  let partitionsReconciled = 0;
  let openingsRehosted = 0;
  let redundantDraftsRemoved = 0;
  let canonicalized = 0;
  for (let i = 0; i < config.spaces.length; i++) {
    const before = beforeSpaces[i];
    const space = config.spaces[i];
    const canonicalBefore = JSON.stringify({
      zero: (before.wall_segments || []).filter((wall: any) => Number(wall.cm) === 0),
      walls: before.walls || [],
    });
    const oldModel = modelOf(before);
    const nextModel = modelOf(space);
    if (!oldModel || !nextModel) continue;

    const oldEdges = edgePairs(oldModel.rooms);
    const nextEdges = edgePairs(nextModel.rooms);
    const eps = GRID_PITCH * 0.02;

    const sourceZeroWalls: WallEntry[] = (before.wall_segments || [])
      .filter((wall: any) => Number(wall.cm) === 0)
      .map((wall: any) => ({
        ...wall,
        key: wallKey(wall.a, wall.b, GRID_STEP_N),
        cm: 0,
      }));
    // A pre-v9 plan is still allowed to reach Optimize. Project its legacy
    // virtual spans in memory, move them with the same room carriers, and let
    // the final identity barrier assign stable catalogue IDs. No production
    // maintenance pass writes open_spans/open_to back into the candidate.
    const knownZeroKeys = new Set(sourceZeroWalls.map((wall) => wall.key));
    const legacyZeroLines = legacyZeroContourLines(before, oldModel.rooms, NORM_W, eps);
    legacyZeroWallsMigrated += legacyZeroLines.length;
    for (const line of legacyZeroLines) {
      const a = [line[0] / NORM_W, line[1] / NORM_W];
      const b = [line[2] / NORM_W, line[3] / NORM_W];
      const key = wallKey(a, b, GRID_STEP_N);
      if (knownZeroKeys.has(key)) continue;
      knownZeroKeys.add(key);
      sourceZeroWalls.push({ key, a, b, cm: 0 });
    }
    const zeroParts = sourceZeroWalls.length;
    const movedZeroWalls = rekeyWallsAfterMove(
      sourceZeroWalls, oldEdges, nextEdges, GRID_STEP_N, NORM_W,
    );
    const pointDistance = (point: number[], a: number[], b: number[]): number => {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const length2 = dx * dx + dy * dy;
      if (!(length2 > 0)) return Math.hypot(point[0] - a[0], point[1] - a[1]);
      const t = Math.max(0, Math.min(1,
        ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2));
      return Math.hypot(point[0] - (a[0] + dx * t), point[1] - (a[1] + dy * t));
    };
    const zeroWalls = movedZeroWalls.filter((wall) => {
      if (!Array.isArray(wall.a) || !Array.isArray(wall.b)) return false;
      const a = wall.a.map((value) => value * NORM_W);
      const b = wall.b.map((value) => value * NORM_W);
      return nextEdges.some(([ea, eb]) => (
        pointDistance(a, ea, eb) <= eps * 4 && pointDistance(b, ea, eb) <= eps * 4
      ));
    });
    spansMerged += Math.max(0, zeroParts - zeroWalls.length);
    const positiveCatalog = (space.wall_segments || [])
      .filter((wall: any) => Number(wall.cm) > 0);
    space.wall_segments = [...positiveCatalog, ...zeroWalls.map(({ key: _key, ...wall }) => wall)];
    const cuts = zeroWalls.map((wall) => [
      wall.a![0] * NORM_W, wall.a![1] * NORM_W,
      wall.b![0] * NORM_W, wall.b![1] * NORM_W,
    ]);

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
      geometry: spaceMergeGeometry(space),
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
    // An independent wall can be a redundant centred body over one exact
    // shared room wall. Reconcile it only after ordinary partition merging so
    // the proof sees the final host axis, and before the exact geometry
    // preflight checks the candidate (#276).
    const reconciledModel = modelOf(space);
    if (reconciledModel) {
      const reconciled = reconcilePartitions(
        space, reconciledModel, space.walls || [], cuts,
        {
          pitch: GRID_STEP_N,
          cellCm: Number(space.cell_cm) > 0 ? Number(space.cell_cm) : DEFAULT_CELL_CM,
          gridPitch: GRID_PITCH,
          coordScale: NORM_W,
        },
      );
      if (reconciled.partitionsReconciled) {
        partitionsReconciled += reconciled.partitionsReconciled;
        openingsRehosted += reconciled.openingsRehosted;
        if (reconciled.partitions.length) space.partitions = reconciled.partitions;
        else delete space.partitions;
        if (reconciled.openings.length) space.openings = reconciled.openings;
        else delete space.openings;
        if (reconciled.walls.length) space.walls = reconciled.walls;
        else delete space.walls;
      }
      if (reconciled.removedDrafts) {
        redundantDraftsRemoved += reconciled.removedDrafts;
        if (reconciled.roomDrafts.length) space.room_drafts = reconciled.roomDrafts;
        else delete space.room_drafts;
      }
    }
    const canonicalAfter = JSON.stringify({
      zero: (space.wall_segments || []).filter((wall: any) => Number(wall.cm) === 0),
      walls: space.walls || [],
    });
    if (canonicalAfter !== canonicalBefore) canonicalized++;
  }

  // Stage 1 of ADR 282 is itself a lossless maintenance pass.  Run it after
  // every geometry repair so its catalogue describes the final candidate, not
  // the pre-Optimize shape. Future model versions remain opaque/fail-soft.
  let wallSegmentsMigrated = 0;
  if (modelFrom <= PLAN_MODEL_VERSION)
    wallSegmentsMigrated = commitWallSegmentModelInPlace(config).migratedSegments;

  // The storage barrier (#224) is part of Optimize's idempotence contract.
  // A 1/240 grid node has no finite decimal representation: comparing or
  // returning the raw binary result would let the backend's nine-decimal
  // canonical form look dirty again after the update event reloads it (#248).
  // Canonicalise the complete pair before both the diff and the return so the
  // preview, durable intent, live stores and next preview all see one target.
  const persistedConfig = canonicalizeConfigGeometryInPlace(config);
  const persistedLayout = canonicalizeLayoutGeometryInPlace(finalAligned.layout);

  // A version marker is bookkeeping, not maintenance by itself. Persist it
  // only alongside a real config/layout transformation; otherwise an already
  // canonical plan would forever offer an Optimize action that changes no
  // user data. Never downgrade a model written by a newer client.
  const meaningfulChanged = JSON.stringify(persistedConfig) !== original
    || JSON.stringify(persistedLayout) !== originalLayout;
  if (modelFrom < PLAN_MODEL_VERSION && meaningfulChanged) {
    persistedConfig.model_version = PLAN_MODEL_VERSION;
  }

  const changed = JSON.stringify(persistedConfig) !== original
    || JSON.stringify(persistedLayout) !== originalLayout;
  const modelTo = Number.isInteger(Number(persistedConfig.model_version))
    ? Number(persistedConfig.model_version)
    : modelFrom;
  // Passes may briefly produce a more precise double which the shared storage
  // boundary maps straight back to the input. Such internal work is not a
  // persisted change and must not leak into the user-visible report.
  const persistedAlignReport: AlignReport = changed ? alignReport : {
    ...alignReport,
    moved: 0,
    coordsCanonicalized: 0,
    maxShift: 0,
    maxShiftCm: 0,
    maxSpace: '',
    rotated: 0,
    removedDrafts: 0,
  };
  const persistedReferences: SpaceReferenceReport = changed ? references.report : {
    ...references.report,
    spaceRefsRemapped: 0,
    roomRefsRemapped: 0,
    positionsRemapped: 0,
    markersDetached: 0,
    orphanRoomLabelsRemoved: 0,
    orphanDevicePositionsRemoved: 0,
    orphanGroupPositionsRemoved: 0,
    liveMissingPositionsRemoved: 0,
  };
  return {
    config: persistedConfig,
    layout: persistedLayout,
    report: {
      ...persistedAlignReport,
      modelFrom,
      modelTo,
      migrated: changed ? migrated : 0,
      glowSpacesMigrated: changed ? migration.glowSpaces : 0,
      glowRoomsMigrated: changed ? migration.glowRooms : 0,
      canonicalized: changed ? canonicalized : 0,
      wallSegmentsMigrated: changed ? wallSegmentsMigrated : 0,
      legacyZeroWallsMigrated: changed ? legacyZeroWallsMigrated : 0,
      wallsMerged: changed ? wallsMerged : 0,
      spansMerged: changed ? spansMerged : 0,
      partitionsMerged: changed ? partitionsMerged : 0,
      partitionsReconciled: changed ? partitionsReconciled : 0,
      openingsRehosted: changed ? openingsRehosted : 0,
      redundantDraftsRemoved: changed ? redundantDraftsRemoved : 0,
      wallsStraightened: changed ? wallsStraightened : 0,
      wallsStraightenSkipped,
      maxStraightenShiftCm: changed ? maxStraightenShiftCm : 0,
      maxStraightenSpace: changed ? maxStraightenSpace : '',
      latticeCoordinatesCanonicalized: changed ? lattice.canonicalized : 0,
      latticeCoordinatesFar: changed ? lattice.far : 0,
      latticeMaxShift: changed ? lattice.maxShift : 0,
      latticeMaxShiftCm: changed ? lattice.maxShiftCm : 0,
      latticeSpaces: changed ? lattice.spaces : [],
      ...persistedReferences,
    },
    changed,
  };
}
