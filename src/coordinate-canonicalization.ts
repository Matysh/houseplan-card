/**
 * Stable, allow-listed persisted geometry.
 *
 * Mirrored by custom_components/houseplan/coordinate_canonicalization.py.
 * Keep the precision, lattice formula and field allow-list in lockstep.
 */

import {
  DECOR_BOX_KINDS,
  type DecorBoxKind,
} from './editors/decor/types';

export { DECOR_BOX_KINDS };

export const COORDINATE_DECIMALS = 9;
export const COORDINATE_FACTOR = 10 ** COORDINATE_DECIMALS;
export const LATTICE_GRID_N = 240;
export const LATTICE_NOISE_STEPS = 1e-4;

type JsonRecord = Record<string, any>;

export interface LatticeSpaceReport {
  spaceId: string;
  space: string;
  canonicalized: number;
  far: number;
  maxShift: number;
  maxShiftCm: number;
}

export interface LatticeCanonicalizationReport {
  canonicalized: number;
  far: number;
  maxShift: number;
  maxShiftCm: number;
  spaces: LatticeSpaceReport[];
}

interface MutableLatticeReport extends LatticeCanonicalizationReport {
  bySpace: Map<string, LatticeSpaceReport>;
}

function cloneJson<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneJson(item)) as T;
  if (value !== null && typeof value === 'object') {
    const out: JsonRecord = {};
    for (const [key, item] of Object.entries(value as JsonRecord)) out[key] = cloneJson(item);
    return out as T;
  }
  return value;
}

/** Existing scalar contract for transforms, angles, lengths and ratios. */
export function canonicalizeNumber(value: unknown): unknown {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;
  const sign = value < 0 || Object.is(value, -0) ? -1 : 1;
  const result = sign
    * (Math.floor(Math.abs(value) * COORDINATE_FACTOR + 0.5) / COORDINATE_FACTOR);
  return result === 0 ? 0 : result;
}

/** Collapse only an unobservable tail around a 1/240 node. */
export function canonicalizeLatticeCoordinate(value: unknown): unknown {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;
  const scaled = value * LATTICE_GRID_N;
  const nearest = Math.round(scaled);
  const deviation = Math.abs(scaled - nearest);
  if (deviation < LATTICE_NOISE_STEPS) {
    const result = nearest / LATTICE_GRID_N;
    return result === 0 ? 0 : result;
  }
  return canonicalizeNumber(value);
}

/** Three significant digits without turning a non-zero sub-millimetre shift into zero. */
export function formatLatticeShiftCm(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  const absolute = Math.abs(value);
  if (absolute < 0.001) return value.toExponential(2);
  return String(Number(value.toPrecision(3)));
}

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord : null;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => record(item) !== null)
    : [];
}

function isDecorBoxKind(value: unknown): value is DecorBoxKind {
  return typeof value === 'string'
    && (DECOR_BOX_KINDS as readonly string[]).includes(value);
}

function scalarFields(item: JsonRecord, names: readonly string[]): void {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(item, name)) {
      item[name] = canonicalizeNumber(item[name]);
    }
  }
}

function latticeFields(item: JsonRecord, names: readonly string[]): void {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(item, name)) {
      item[name] = canonicalizeLatticeCoordinate(item[name]);
    }
  }
}

function latticePoint(value: unknown): void {
  if (!Array.isArray(value)) return;
  for (let index = 0; index < Math.min(2, value.length); index++) {
    value[index] = canonicalizeLatticeCoordinate(value[index]);
  }
}

function latticePoints(value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const item of value) latticePoint(item);
}

/** Visit exactly the persisted coordinate allow-list, without cloning. */
function visitLatticeCoordinates(
  config: unknown,
  layout: unknown,
  visit: (value: number, space: JsonRecord | null) => void,
): void {
  const root = record(config);
  if (root) {
    for (const space of records(root.spaces)) {
      const fieldValues = (item: JsonRecord, names: readonly string[]): void => {
        for (const name of names) {
          const value = item[name];
          if (typeof value === 'number' && Number.isFinite(value)) visit(value, space);
        }
      };
      const pointValues = (value: unknown): void => {
        if (!Array.isArray(value)) return;
        for (let index = 0; index < Math.min(2, value.length); index++) {
          const coordinate = value[index];
          if (typeof coordinate === 'number' && Number.isFinite(coordinate)) {
            visit(coordinate, space);
          }
        }
      };
      const pointsValues = (value: unknown): void => {
        if (Array.isArray(value)) for (const point of value) pointValues(point);
      };

      for (const room of records(space.rooms)) {
        fieldValues(room, ['x', 'y', 'w', 'h']);
        pointsValues(room.poly);
      }
      for (const wall of records(space.walls)) {
        pointValues(wall.a);
        pointValues(wall.b);
      }
      for (const segment of records(space.wall_segments)) {
        pointValues(segment.a);
        pointValues(segment.b);
      }
      for (const opening of records(space.openings)) fieldValues(opening, ['x', 'y']);
      for (const decor of records(space.decor)) {
        if (decor.kind === 'line') fieldValues(decor, ['x1', 'y1', 'x2', 'y2']);
        else if (isDecorBoxKind(decor.kind)) {
          fieldValues(decor, ['x', 'y', 'w', 'h']);
        } else if (decor.kind === 'text') fieldValues(decor, ['x', 'y']);
      }
      for (const draft of records(space.room_drafts)) pointsValues(draft.points);
      for (const partition of records(space.partitions)) {
        pointValues(partition.a);
        pointValues(partition.b);
      }
      for (const column of records(space.wall_columns)) pointValues(column.center);
      for (const span of records(space.open_spans)) {
        pointValues(span.a);
        pointValues(span.b);
      }
    }
  }

  const layoutRoot = record(layout);
  if (!layoutRoot) return;
  const spacesById = new Map<string, JsonRecord>();
  if (root) {
    for (const space of records(root.spaces)) {
      if (space.id != null) spacesById.set(String(space.id), space);
    }
  }
  for (const value of Object.values(layoutRoot)) {
    const item = record(value);
    if (!item) continue;
    const owner = item.s != null ? spacesById.get(String(item.s)) || null : null;
    for (const name of ['x', 'y']) {
      const coordinate = item[name];
      if (typeof coordinate === 'number' && Number.isFinite(coordinate)) visit(coordinate, owner);
    }
  }
}

function emptyReport(): MutableLatticeReport {
  return {
    canonicalized: 0,
    far: 0,
    maxShift: 0,
    maxShiftCm: 0,
    spaces: [],
    bySpace: new Map(),
  };
}

function cellCm(space: JsonRecord | null): number {
  const value = Number(space?.cell_cm);
  return value > 0 ? value : 5;
}

/** Measure the exact work the boundary will do, without cloning or writing. */
export function latticeCanonicalizationReport(
  config: unknown,
  layout: unknown = {},
): LatticeCanonicalizationReport {
  const report = emptyReport();
  const spaces = records(record(config)?.spaces);
  let worstCellCm = 5;
  for (const space of spaces) worstCellCm = Math.max(worstCellCm, cellCm(space));

  visitLatticeCoordinates(config, layout, (value, space) => {
    const scaled = value * LATTICE_GRID_N;
    const deviation = Math.abs(scaled - Math.round(scaled));
    const canonical = canonicalizeLatticeCoordinate(value);
    const isNoise = deviation > 0 && deviation < LATTICE_NOISE_STEPS;
    const isFar = deviation >= LATTICE_NOISE_STEPS;
    if (!isNoise && !isFar) return;

    const shift = isNoise && typeof canonical === 'number' ? Math.abs(canonical - value) : 0;
    if (isNoise) report.canonicalized++;
    else report.far++;
    report.maxShift = Math.max(report.maxShift, shift);
    report.maxShiftCm = Math.max(
      report.maxShiftCm,
      shift * LATTICE_GRID_N * (space ? cellCm(space) : worstCellCm),
    );

    if (!space?.id || !isNoise) return;
    const id = String(space.id);
    let item = report.bySpace.get(id);
    if (!item) {
      item = {
        spaceId: id,
        space: String(space.title || id),
        canonicalized: 0,
        far: 0,
        maxShift: 0,
        maxShiftCm: 0,
      };
      report.bySpace.set(id, item);
    }
    item.canonicalized++;
    item.maxShift = Math.max(item.maxShift, shift);
    item.maxShiftCm = Math.max(item.maxShiftCm, shift * LATTICE_GRID_N * cellCm(space));
  });

  // Far values are useful only next to a space that the barrier actually
  // touched. Count them in a second allocation-free pass into those rows.
  if (report.bySpace.size) {
    visitLatticeCoordinates(config, layout, (value, space) => {
      if (!space?.id) return;
      const item = report.bySpace.get(String(space.id));
      if (!item) return;
      const scaled = value * LATTICE_GRID_N;
      if (Math.abs(scaled - Math.round(scaled)) >= LATTICE_NOISE_STEPS) item.far++;
    });
  }
  report.spaces = [...report.bySpace.values()];
  const { bySpace: _bySpace, ...publicReport } = report;
  return publicReport;
}

export function canonicalizePosition<T>(position: T): T {
  const result = cloneJson(position);
  return canonicalizePositionInPlace(result);
}

export function canonicalizePositionInPlace<T>(position: T): T {
  const result = position;
  const item = record(result);
  if (item) latticeFields(item, ['x', 'y']);
  return result;
}

export function canonicalizeLayoutGeometry<T>(layout: T): T {
  const result = cloneJson(layout);
  return canonicalizeLayoutGeometryInPlace(result);
}

export function canonicalizeLayoutGeometryInPlace<T>(layout: T): T {
  const result = layout;
  const root = record(result);
  if (!root) return result;
  for (const value of Object.values(root)) {
    const item = record(value);
    if (item) latticeFields(item, ['x', 'y']);
  }
  return result;
}

export function canonicalizeConfigGeometry<T>(config: T): T {
  const result = cloneJson(config);
  return canonicalizeConfigGeometryInPlace(result);
}

export function canonicalizeConfigGeometryInPlace<T>(config: T): T {
  const result = config;
  const root = record(result);
  if (!root) return result;

  for (const space of records(root.spaces)) {
    scalarFields(space, [
      'plan_x', 'plan_y', 'plan_scale', 'plan_scale_x', 'plan_scale_y', 'plan_angle',
    ]);

    for (const room of records(space.rooms)) {
      latticeFields(room, ['x', 'y', 'w', 'h']);
      latticePoints(room.poly);
    }

    for (const wall of records(space.walls)) {
      latticePoint(wall.a);
      latticePoint(wall.b);
    }
    for (const segment of records(space.wall_segments)) {
      latticePoint(segment.a);
      latticePoint(segment.b);
    }

    for (const opening of records(space.openings)) {
      latticeFields(opening, ['x', 'y']);
      scalarFields(opening, ['angle', 'length']);
      const host = record(opening.host);
      if (host) scalarFields(host, ['t']);
    }

    for (const decor of records(space.decor)) {
      if (decor.kind === 'line') latticeFields(decor, ['x1', 'y1', 'x2', 'y2']);
      else if (isDecorBoxKind(decor.kind)) {
        latticeFields(decor, ['x', 'y', 'w', 'h']);
        scalarFields(decor, ['angle']);
      } else if (decor.kind === 'text') {
        latticeFields(decor, ['x', 'y']);
        scalarFields(decor, ['scale', 'angle']);
      }
    }

    for (const draft of records(space.room_drafts)) latticePoints(draft.points);

    for (const partition of records(space.partitions)) {
      latticePoint(partition.a);
      latticePoint(partition.b);
    }

    for (const column of records(space.wall_columns)) {
      latticePoint(column.center);
      if (column.shape === 'square') scalarFields(column, ['angle']);
    }

    for (const span of records(space.open_spans)) {
      latticePoint(span.a);
      latticePoint(span.b);
    }
  }

  for (const marker of records(root.markers)) scalarFields(marker, ['angle']);
  return result;
}
