/**
 * Stable, allow-listed persisted geometry.
 *
 * Mirrored by custom_components/houseplan/coordinate_canonicalization.py.
 * Keep the precision, scalar formula and field allow-list in lockstep.
 */

export const COORDINATE_DECIMALS = 9;
export const COORDINATE_FACTOR = 10 ** COORDINATE_DECIMALS;

type JsonRecord = Record<string, any>;

function cloneJson<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneJson(item)) as T;
  if (value !== null && typeof value === 'object') {
    const out: JsonRecord = {};
    for (const [key, item] of Object.entries(value as JsonRecord)) out[key] = cloneJson(item);
    return out as T;
  }
  return value;
}

export function canonicalizeNumber(value: unknown): unknown {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;
  const sign = value < 0 || Object.is(value, -0) ? -1 : 1;
  const result = sign
    * (Math.floor(Math.abs(value) * COORDINATE_FACTOR + 0.5) / COORDINATE_FACTOR);
  return result === 0 ? 0 : result;
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

function fields(item: JsonRecord, names: readonly string[]): void {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(item, name)) {
      item[name] = canonicalizeNumber(item[name]);
    }
  }
}

function point(value: unknown): void {
  if (!Array.isArray(value)) return;
  for (let index = 0; index < Math.min(2, value.length); index++) {
    value[index] = canonicalizeNumber(value[index]);
  }
}

function points(value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const item of value) point(item);
}

export function canonicalizePosition<T>(position: T): T {
  const result = cloneJson(position);
  const item = record(result);
  if (item) fields(item, ['x', 'y']);
  return result;
}

export function canonicalizeLayoutGeometry<T>(layout: T): T {
  const result = cloneJson(layout);
  const root = record(result);
  if (!root) return result;
  for (const value of Object.values(root)) {
    const item = record(value);
    if (item) fields(item, ['x', 'y']);
  }
  return result;
}

export function canonicalizeConfigGeometry<T>(config: T): T {
  const result = cloneJson(config);
  const root = record(result);
  if (!root) return result;

  for (const space of records(root.spaces)) {
    fields(space, [
      'plan_x', 'plan_y', 'plan_scale', 'plan_scale_x', 'plan_scale_y', 'plan_angle',
    ]);

    for (const room of records(space.rooms)) {
      fields(room, ['x', 'y', 'w', 'h']);
      points(room.poly);
    }

    for (const wall of records(space.walls)) {
      point(wall.a);
      point(wall.b);
    }

    for (const opening of records(space.openings)) {
      fields(opening, ['x', 'y', 'angle', 'length']);
      const host = record(opening.host);
      if (host) fields(host, ['t']);
    }

    for (const decor of records(space.decor)) {
      if (decor.kind === 'line') fields(decor, ['x1', 'y1', 'x2', 'y2']);
      else if (decor.kind === 'rect' || decor.kind === 'ellipse' || decor.kind === 'furniture') {
        fields(decor, ['x', 'y', 'w', 'h', 'angle']);
      } else if (decor.kind === 'text') {
        fields(decor, ['x', 'y', 'scale', 'angle']);
      }
    }

    for (const draft of records(space.room_drafts)) points(draft.points);

    for (const partition of records(space.partitions)) {
      point(partition.a);
      point(partition.b);
    }

    for (const column of records(space.wall_columns)) {
      point(column.center);
      if (column.shape === 'square') fields(column, ['angle']);
    }

    for (const span of records(space.open_spans)) {
      point(span.a);
      point(span.b);
    }
  }

  for (const marker of records(root.markers)) fields(marker, ['angle']);
  return result;
}
