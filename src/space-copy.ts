import type { ServerConfig } from './types';

export const SPACE_COPY_LIMITS = Object.freeze({
  spaces: 50,
  partitions: 2000,
  openings: 500,
  decor: 1000,
  columns: 500,
});

export type SpaceCopyErrorCode =
  | 'source_missing'
  | 'source_invalid'
  | 'spaces_limit'
  | 'partitions_limit'
  | 'openings_limit'
  | 'decor_limit'
  | 'columns_limit'
  | 'opening_host_missing'
  | 'opening_host_unknown'
  | 'geometry_unsafe';

export class SpaceCopyError extends Error {
  public constructor(public readonly code: SpaceCopyErrorCode) {
    super(code);
    this.name = 'SpaceCopyError';
  }
}

type SpaceRecord = Record<string, unknown>;
type GeometryRecord = Record<string, unknown> & { id: string };

export interface SpaceCopyResult {
  config: ServerConfig;
  space: SpaceRecord & { id: string; title: string };
  sourceIndex: number;
}

const own = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const clone = <T>(value: T): T => value === undefined
  ? value : JSON.parse(JSON.stringify(value)) as T;

const record = (value: unknown): SpaceRecord | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as SpaceRecord : null;

function geometryList(value: unknown, required = false): GeometryRecord[] {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value)) throw new SpaceCopyError('source_invalid');
  return value.map((item) => {
    const row = record(item);
    if (!row || typeof row.id !== 'string' || !row.id) {
      throw new SpaceCopyError('source_invalid');
    }
    return row as GeometryRecord;
  });
}

const point = (value: unknown): value is [number, number] => Array.isArray(value)
  && value.length === 2 && value.every((coordinate) => Number.isFinite(coordinate));

/** Same visible convention as import: the first free "Name (N)". */
export function nextSpaceCopyTitle(
  sourceTitle: unknown,
  spaces: readonly unknown[],
  fallback: string,
): string {
  const base = String(sourceTitle ?? '').trim() || fallback;
  const names = new Set(spaces.map((item) => {
    const candidate = record(item);
    return String(candidate?.title ?? '').trim();
  }));
  let suffix = 2;
  while (names.has(`${base} (${suffix})`)) suffix++;
  return `${base} (${suffix})`;
}

/** One bounded seed for a space id and every geometry id in one copy. */
export function newSpaceCopySeed(now = Date.now(), random = Math.random()): string {
  const entropy = Math.floor(Math.max(0, Math.min(0.999999999, random)) * 0x1000000)
    .toString(36).padStart(5, '0');
  return `${Math.max(0, Math.floor(now)).toString(36)}${entropy}`;
}

const COPY_KEYS = [
  'settings', 'zero_wall_style', 'cell_cm', 'view_box',
  'plan_url', 'plan_aspect', 'plan_x', 'plan_y', 'plan_scale',
  'plan_scale_x', 'plan_scale_y', 'plan_angle',
] as const;

/**
 * Build an immutable full-config candidate. Room-owned walls become
 * independent partitions; markers and layout live outside the copied space.
 */
export function createSpaceCopyCandidate(
  input: ServerConfig,
  sourceId: string,
  title: string,
  seed: string,
): SpaceCopyResult {
  const spaces = input.spaces as SpaceRecord[];
  if (!title.trim()) throw new SpaceCopyError('source_invalid');
  if (spaces.length >= SPACE_COPY_LIMITS.spaces) throw new SpaceCopyError('spaces_limit');
  const sourceIndex = spaces.findIndex((item) => item.id === sourceId);
  if (sourceIndex < 0) throw new SpaceCopyError('source_missing');
  const source = spaces[sourceIndex];
  if (!Array.isArray(source.view_box)) throw new SpaceCopyError('source_invalid');

  const wallSegments = geometryList(source.wall_segments, true);
  const sourcePartitions = geometryList(source.partitions);
  const openings = geometryList(source.openings);
  const decor = geometryList(source.decor);
  const columns = geometryList(source.wall_columns);
  const partitionCount = wallSegments.length + sourcePartitions.length;
  if (partitionCount > SPACE_COPY_LIMITS.partitions) throw new SpaceCopyError('partitions_limit');
  if (openings.length > SPACE_COPY_LIMITS.openings) throw new SpaceCopyError('openings_limit');
  if (decor.length > SPACE_COPY_LIMITS.decor) throw new SpaceCopyError('decor_limit');
  if (columns.length > SPACE_COPY_LIMITS.columns) throw new SpaceCopyError('columns_limit');

  let serial = 0;
  const nextId = (prefix: string): string => `${prefix}${seed}${(serial++).toString(36)}`;
  const wallMap = new Map<string, string>();
  const partitionMap = new Map<string, string>();
  const copiedPartitions: SpaceRecord[] = [];

  for (const wall of wallSegments) {
    if (wallMap.has(wall.id) || !point(wall.a) || !point(wall.b)
        || typeof wall.cm !== 'number' || !Number.isFinite(wall.cm)) {
      throw new SpaceCopyError('source_invalid');
    }
    const id = nextId('cw');
    wallMap.set(wall.id, id);
    copiedPartitions.push({ id, a: clone(wall.a), b: clone(wall.b), cm: wall.cm });
  }
  for (const partition of sourcePartitions) {
    if (partitionMap.has(partition.id) || !point(partition.a) || !point(partition.b)
        || typeof partition.cm !== 'number' || !Number.isFinite(partition.cm)) {
      throw new SpaceCopyError('source_invalid');
    }
    const id = nextId('cp');
    partitionMap.set(partition.id, id);
    copiedPartitions.push({ id, a: clone(partition.a), b: clone(partition.b), cm: partition.cm });
  }

  const copiedOpenings = openings.map((opening) => {
    const host = record(opening.host);
    if (!host || typeof host.id !== 'string' || typeof host.kind !== 'string') {
      throw new SpaceCopyError('opening_host_missing');
    }
    const mapped = host.kind === 'wall'
      ? wallMap.get(host.id)
      : host.kind === 'partition' ? partitionMap.get(host.id) : undefined;
    if (!mapped) throw new SpaceCopyError('opening_host_unknown');
    const copied: SpaceRecord = {
      ...clone(opening),
      id: nextId('co'),
      host: { ...clone(host), kind: 'partition', id: mapped },
    };
    delete copied.contact;
    delete copied.lock;
    return copied;
  });
  const copiedDecor = decor.map((item) => ({ ...clone(item), id: nextId('cd') }));
  const copiedColumns = columns.map((item) => ({ ...clone(item), id: nextId('cc') }));

  const newSpaceId = `s${seed}`;
  if (spaces.some((item) => item.id === newSpaceId)) throw new SpaceCopyError('source_invalid');
  const copiedSpace: SpaceRecord & { id: string; title: string } = {
    id: newSpaceId,
    title: title.trim(),
    rooms: [],
    wall_segments: [],
    view_box: clone(source.view_box),
  };
  for (const key of COPY_KEYS) {
    if (key !== 'view_box' && own(source, key)) copiedSpace[key] = clone(source[key]);
  }
  if (copiedPartitions.length) copiedSpace.partitions = copiedPartitions;
  if (copiedOpenings.length) copiedSpace.openings = copiedOpenings;
  if (copiedDecor.length) copiedSpace.decor = copiedDecor;
  if (copiedColumns.length) copiedSpace.wall_columns = copiedColumns;

  const config = clone(input);
  config.spaces.splice(sourceIndex + 1, 0, copiedSpace);
  return { config, space: copiedSpace, sourceIndex };
}
